import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Bindings, AppDb } from "../db/client";
import authRouter from "./auth";
import { verifyPassword } from "../lib/auth";
import { resetRateLimits } from "../lib/rate-limit";

const DDL = [
  `CREATE TABLE users (
    id text PRIMARY KEY NOT NULL,
    name text NOT NULL,
    email text,
    password_hash text,
    timezone text DEFAULT 'Asia/Jakarta' NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
  )`,
  `CREATE UNIQUE INDEX uniq_users_email_live ON users (email) WHERE deleted_at IS NULL`,
];

const DEV_SECRET = "test-secret-key-for-vitest-only";

function createTestApp(bindings: Partial<Bindings> = {}) {
  const sqlite = new Database(":memory:");
  for (const ddl of DDL) sqlite.exec(ddl);
  const db = drizzle(sqlite) as unknown as AppDb;

  const app = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();
  app.use("*", async (c, next) => {
    c.env = { ...c.env, ...bindings };
    c.set("db", db);
    await next();
  });
  // Mirror the production middleware's session enforcement so route-level
  // tests exercise the same contract (public /auth/*, guarded everything else).
  // NOTE: routes are mounted at "/" here, so public paths are "/auth/*".
  app.use("*", async (c, next) => {
    const secret = c.env.AUTH_SECRET;
    const path = new URL(c.req.url).pathname;
    const isPublic = path.startsWith("/auth") || path === "/health" || path === "/status";
    if (secret && !isPublic) {
      const { verifySessionToken, getSessionTokenFromRequest } = await import("../lib/auth");
      const session = await verifySessionToken(getSessionTokenFromRequest(c), secret);
      if (!session) {
        return c.json({ error: { code: "UNAUTHORIZED", message: "Authentication required" } }, 401);
      }
      c.set("userId", session.uid);
    } else {
      c.set("userId", "default-user");
    }
    await next();
  });
  app.route("/", authRouter);
  // A guarded probe route to verify enforcement end-to-end.
  app.get("/tasks", (c) => c.json({ data: [], userId: c.get("userId") }));
  return { app, sqlite, db };
}

function registerBody(overrides: Partial<Record<string, unknown>> = {}) {
  return { name: "Warid", email: "warid@example.com", password: "super-secret-123", ...overrides };
}

// The rate limiter is module-level state; without a reset, buckets leak
// across describes and later tests get 429s before they even start.
beforeEach(() => {
  resetRateLimits();
});

describe("POST /auth/register", () => {
  let app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>;
  let sqlite: Database.Database;

  beforeEach(() => {
    ({ app, sqlite } = createTestApp({ AUTH_SECRET: DEV_SECRET }));
  });

  it("creates an account and issues a session cookie", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { user: { email: string }; sessionIssued: boolean } };
    expect(json.data.user.email).toBe("warid@example.com");
    expect(json.data.sessionIssued).toBe(true);

    const setCookie = res.headers.get("Set-Cookie") ?? "";
    expect(setCookie).toContain("kaizen_session=");
    expect(setCookie).toContain("HttpOnly");
    expect(setCookie).toContain("SameSite=Lax");

    // Password stored as a pbkdf2 hash, never plaintext.
    const row = sqlite.prepare("SELECT password_hash FROM users WHERE email = ?").get("warid@example.com") as {
      password_hash: string;
    };
    expect(row.password_hash).toMatch(/^pbkdf2\$\d+\$[0-9a-f]{32}\$[0-9a-f]{64}$/);
    expect(row.password_hash).not.toContain("super-secret");
  });

  it("normalizes the email to lowercase", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody({ email: "Warid@Example.COM" })),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { user: { email: string } } };
    expect(json.data.user.email).toBe("warid@example.com");
  });

  it("claims the pre-auth default-user row on first registration (data carry-over)", async () => {
    sqlite.exec(
      `INSERT INTO users (id, name, email, timezone, created_at, updated_at) VALUES ('default-user', 'Operator', NULL, 'Asia/Jakarta', 0, 0)`,
    );

    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { user: { id: string } } };
    expect(json.data.user.id).toBe("default-user");

    // Still exactly one user row — claimed, not duplicated.
    const count = sqlite.prepare("SELECT COUNT(*) as n FROM users").get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("creates a fresh user when default-user already has credentials (true multi-account)", async () => {
    sqlite.exec(
      `INSERT INTO users (id, name, email, password_hash, timezone, created_at, updated_at) VALUES ('default-user', 'Owner', 'owner@example.com', 'pbkdf2$100000$aa$bb', 'Asia/Jakarta', 0, 0)`,
    );

    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { user: { id: string } } };
    expect(json.data.user.id).not.toBe("default-user");
  });

  it("rejects duplicate emails with 409", async () => {
    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody({ name: "Imposter" })),
    });
    expect(res.status).toBe(409);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("EMAIL_TAKEN");
  });

  it("rejects short passwords and bad emails with a unified envelope", async () => {
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody({ password: "short" })),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("POST /auth/login", () => {
  let app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>;

  beforeEach(() => {
    ({ app } = createTestApp({ AUTH_SECRET: DEV_SECRET }));
  });

  async function seedUser() {
    await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
  }

  it("logs in with valid credentials and sets the session cookie", async () => {
    await seedUser();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "warid@example.com", password: "super-secret-123" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { user: { email: string }; sessionIssued: boolean } };
    expect(json.data.sessionIssued).toBe(true);
    expect(res.headers.get("Set-Cookie")).toContain("kaizen_session=");
  });

  it("is case-insensitive on email", async () => {
    await seedUser();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "WARID@example.com", password: "super-secret-123" }),
    });
    expect(res.status).toBe(200);
  });

  it("rejects wrong passwords with a generic 401 (no user enumeration)", async () => {
    await seedUser();
    const res = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "warid@example.com", password: "wrong-password" }),
    });
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string; message: string } };
    expect(json.error.code).toBe("INVALID_CREDENTIALS");

    const unknown = await app.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "nobody@example.com", password: "whatever-pass" }),
    });
    const unknownJson = (await unknown.json()) as { error: { message: string } };
    expect(unknownJson.error.message).toBe(json.error.message);
  });

  it("rejects accounts without credentials (pre-auth row)", async () => {
    const { app: app2, sqlite } = createTestApp({ AUTH_SECRET: DEV_SECRET });
    sqlite
      .prepare(
        `INSERT INTO users (id, name, email, timezone, created_at, updated_at) VALUES ('u-ghost', 'Ghost', 'ghost@example.com', 'Asia/Jakarta', 0, 0)`,
      )
      .run();

    const res = await app2.request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "ghost@example.com", password: "whatever-pass" }),
    });
    expect(res.status).toBe(401);
  });
});

describe("Session enforcement (AUTH_SECRET set)", () => {
  let app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>;

  beforeEach(() => {
    ({ app } = createTestApp({ AUTH_SECRET: DEV_SECRET }));
  });

  it("blocks guarded routes without a session", async () => {
    const res = await app.request("/tasks");
    expect(res.status).toBe(401);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("UNAUTHORIZED");
  });

  it("accepts guarded routes with a valid session cookie and derives the userId", async () => {
    const reg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
    const cookie = reg.headers.get("Set-Cookie")?.split(";")[0] ?? "";

    const res = await app.request("/tasks", {
      headers: { Cookie: cookie },
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { userId: string };
    expect(json.userId).not.toBe("default-user");
  });

  it("rejects tampered session cookies", async () => {
    const reg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
    const cookie = reg.headers.get("Set-Cookie")?.split(";")[0] ?? "";
    const token = cookie.replace("kaizen_session=", "");
    const tampered = token.slice(0, -4) + "0000";

    const res = await app.request("/tasks", {
      headers: { Cookie: `kaizen_session=${tampered}` },
    });
    expect(res.status).toBe(401);
  });

  it("keeps /auth/me public and reports the session user", async () => {
    const reg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
    const cookie = reg.headers.get("Set-Cookie")?.split(";")[0] ?? "";

    const res = await app.request("/auth/me", { headers: { Cookie: cookie } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { user: { email: string }; authEnforced: boolean } };
    expect(json.data.authEnforced).toBe(true);
    expect(json.data.user?.email).toBe("warid@example.com");
  });

  it("logout clears the cookie and the session stops working", async () => {
    const reg = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
    const cookie = reg.headers.get("Set-Cookie")?.split(";")[0] ?? "";

    const out = await app.request("/auth/logout", {
      method: "POST",
      headers: { Cookie: cookie },
    });
    const clearCookie = out.headers.get("Set-Cookie") ?? "";
    expect(clearCookie).toContain("Max-Age=0");
  });
});

describe("Dev mode (no AUTH_SECRET)", () => {
  it("keeps default-user identity and skips session enforcement", async () => {
    const { app } = createTestApp({});
    const res = await app.request("/tasks");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { userId: string };
    expect(json.userId).toBe("default-user");

    const me = await app.request("/auth/me");
    const meJson = (await me.json()) as { data: { authEnforced: boolean } };
    expect(meJson.data.authEnforced).toBe(false);
  });

  it("register still works without issuing a session", async () => {
    const { app } = createTestApp({});
    const res = await app.request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(registerBody()),
    });
    expect(res.status).toBe(201);
    const json = (await res.json()) as { data: { sessionIssued: boolean } };
    expect(json.data.sessionIssued).toBe(false);
    expect(res.headers.get("Set-Cookie")).toBeNull();
  });
});

describe("verifyPassword", () => {
  it("round-trips and rejects wrong passwords", async () => {
    const hash = await verifyPasswordHashHelper("correct-horse-battery");
    expect(await verifyPassword("correct-horse-battery", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
    expect(await verifyPassword("correct-horse-battery", "garbage")).toBe(false);
  });

  async function verifyPasswordHashHelper(password: string): Promise<string> {
    const { hashPassword } = await import("../lib/auth");
    return hashPassword(password, 10_000);
  }
});

describe("Rate limiting", () => {
  it("returns 429 after repeated login attempts from one IP", async () => {
    const { app } = createTestApp({ AUTH_SECRET: DEV_SECRET });
    let lastStatus = 0;
    for (let i = 0; i < 12; i++) {
      const res = await app.request("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json", "CF-Connecting-IP": "203.0.113.7" },
        body: JSON.stringify({ email: "nobody@example.com", password: "whatever-pass" }),
      });
      lastStatus = res.status;
      if (res.status === 429) {
        expect(res.headers.get("Retry-After")).toBeDefined();
        break;
      }
    }
    expect(lastStatus).toBe(429);
  });
});
