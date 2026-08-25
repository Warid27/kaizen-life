import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { users } from "../db/schema";
import { RegisterSchema, LoginSchema, type AuthUser } from "@kaizenlife/shared";
import { and, eq, isNull, sql } from "drizzle-orm";
import { apiError } from "../lib/api";
import {
  createSessionToken,
  getSessionTokenFromRequest,
  hashPassword,
  sessionClearCookie,
  sessionSetCookie,
  verifyPassword,
  verifySessionToken,
  SESSION_TTL_SEC,
} from "../lib/auth";
import { clientIp, rateLimit } from "../lib/rate-limit";

type Env = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const authRouter = new Hono<Env>();

/** The pre-auth shared identity row — first registration claims its data. */
const DEFAULT_USER_ID = "default-user";

function isSecure(c: { env: Bindings }): boolean {
  return c.env.ENVIRONMENT === "production";
}

function pbkdf2Iterations(env: Bindings): number {
  const n = env.PBKDF2_ITERATIONS ? parseInt(env.PBKDF2_ITERATIONS, 10) : NaN;
  if (Number.isFinite(n) && n >= 10_000 && n <= 1_000_000) return n;
  return 100_000;
}

function toAuthUser(row: { id: string; name: string; email: string | null; timezone: string }): AuthUser {
  return { id: row.id, name: row.name, email: row.email, timezone: row.timezone };
}

authRouter.post("/auth/register", async (c) => {
  try {
    // Rate limit: 10 registrations per minute per IP.
    const rl = rateLimit(`register:${clientIp(c.req.raw.headers)}`, 10, 60_000);
    if (!rl.ok) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return apiError(c, 429, "RATE_LIMITED", "Too many attempts. Try again shortly.");
    }

    const db = c.get("db");
    const parsed = RegisterSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
    }
    const { name, email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    // Uniqueness among live accounts (the partial unique index is the hard
    // guarantee; this pre-check returns a friendly 409 instead of a 500).
    const existingByEmail = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, normalizedEmail), isNull(users.deletedAt)))
      .get();
    if (existingByEmail) {
      return apiError(c, 409, "EMAIL_TAKEN", "An account with this email already exists.");
    }

    const passwordHash = await hashPassword(password, pbkdf2Iterations(c.env));
    const now = Math.floor(Date.now() / 1000);

    // First registration claims the pre-auth `default-user` row so all
    // existing data carries over; later registrations create fresh users.
    const defaultUser = await db
      .select()
      .from(users)
      .where(and(eq(users.id, DEFAULT_USER_ID), isNull(users.deletedAt)))
      .get();

    let user: { id: string; name: string; email: string | null; timezone: string };

    if (defaultUser && !defaultUser.passwordHash) {
      const updated = await db
        .update(users)
        .set({ name, email: normalizedEmail, passwordHash, updatedAt: now })
        .where(eq(users.id, DEFAULT_USER_ID))
        .returning()
        .get();
      if (!updated) {
        return apiError(c, 500, "INTERNAL", "Failed to create account");
      }
      user = updated;
    } else {
      const inserted = await db
        .insert(users)
        .values({
          id: crypto.randomUUID(),
          name,
          email: normalizedEmail,
          timezone: "Asia/Jakarta",
          passwordHash,
          createdAt: now,
          updatedAt: now,
        })
        // Targetless DO NOTHING: drizzle's onConflictDoNothing cannot attach
        // a WHERE to the conflict target (needed to match our PARTIAL unique
        // index), and SQLite requires an exact match when a target is given.
        // The only other unique constraint is the random-uuid PK, so nothing
        // else can be swallowed here.
        .onConflictDoNothing()
        .returning()
        .get();
      if (!inserted) {
        // Lost a race against the unique index.
        return apiError(c, 409, "EMAIL_TAKEN", "An account with this email already exists.");
      }
      user = inserted;
    }

    const secret = c.env.AUTH_SECRET;
    if (!secret) {
      // Auth not enforced in this environment; the account exists but no
      // session is needed (middleware keeps default-user identity).
      return c.json({ data: { user: toAuthUser(user), sessionIssued: false } }, 201);
    }

    const { token } = await createSessionToken(user.id, secret);
    c.header("Set-Cookie", sessionSetCookie(token, SESSION_TTL_SEC, isSecure(c)));
    return c.json({ data: { user: toAuthUser(user), sessionIssued: true } }, 201);
  } catch (err) {
    console.error("POST /auth/register error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to register");
  }
});

authRouter.post("/auth/login", async (c) => {
  try {
    // Rate limit: 10 login attempts per minute per IP (credential stuffing).
    const rl = rateLimit(`login:${clientIp(c.req.raw.headers)}`, 10, 60_000);
    if (!rl.ok) {
      c.header("Retry-After", String(rl.retryAfterSec));
      return apiError(c, 429, "RATE_LIMITED", "Too many attempts. Try again shortly.");
    }

    const db = c.get("db");
    const parsed = LoginSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
    }
    const { email, password } = parsed.data;
    const normalizedEmail = email.trim().toLowerCase();

    const user = await db
      .select()
      .from(users)
      .where(and(sql`lower(${users.email}) = ${normalizedEmail}`, isNull(users.deletedAt)))
      .get();

    // Generic message — never reveal whether the email exists.
    if (!user || !user.passwordHash) {
      return apiError(c, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      return apiError(c, 401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const secret = c.env.AUTH_SECRET;
    if (!secret) {
      return c.json({ data: { user: toAuthUser(user), sessionIssued: false } });
    }

    const { token } = await createSessionToken(user.id, secret);
    c.header("Set-Cookie", sessionSetCookie(token, SESSION_TTL_SEC, isSecure(c)));
    return c.json({ data: { user: toAuthUser(user), sessionIssued: true } });
  } catch (err) {
    console.error("POST /auth/login error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to log in");
  }
});

authRouter.post("/auth/logout", async (c) => {
  // Stateless tokens: logout is client-side cookie clearing.
  c.header("Set-Cookie", sessionClearCookie(isSecure(c)));
  return c.json({ data: { success: true } });
});

authRouter.get("/auth/me", async (c) => {
  const db = c.get("db");
  const secret = c.env.AUTH_SECRET;

  if (!secret) {
    // Auth not configured: report the effective (default) identity so the UI
    // does not bounce to /login in dev.
    const row = await db
      .select()
      .from(users)
      .where(eq(users.id, "default-user"))
      .get();
    return c.json({
      data: {
        user: row ? toAuthUser(row) : null,
        authEnforced: false,
      },
    });
  }

  const session = await verifySessionToken(getSessionTokenFromRequest(c), secret);
  if (!session) {
    return c.json({ data: { user: null, authEnforced: true } });
  }

  const row = await db
    .select()
    .from(users)
    .where(and(eq(users.id, session.uid), isNull(users.deletedAt)))
    .get();
  if (!row) {
    return c.json({ data: { user: null, authEnforced: true } });
  }

  return c.json({ data: { user: toAuthUser(row), authEnforced: true } });
});

export default authRouter;
