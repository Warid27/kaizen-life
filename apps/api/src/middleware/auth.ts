import { createMiddleware } from "hono/factory";
import type { Bindings, AppDb } from "../db/client";
import { apiError } from "../lib/api";
import { getSessionTokenFromRequest, verifySessionToken } from "../lib/auth";

type Env = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

/** Paths that must stay reachable without a session. */
const PUBLIC_PATHS = ["/api/auth/", "/api/health", "/api/status"];

function isPublicPath(path: string): boolean {
  return PUBLIC_PATHS.some((p) => path === p.slice(0, -1) || path.startsWith(p));
}

/**
 * Single source of per-request identity — routes read `c.get("userId")`.
 *
 * Layers (all optional by env, so dev stays frictionless):
 *  1. `API_TOKEN` — machine gate: when set, every request needs
 *     `Authorization: Bearer <token>` regardless of cookies.
 *  2. `AUTH_SECRET` — real auth: when set, requests must carry a valid
 *     signed session cookie (`kaizen_session`, set by /api/auth/login) and
 *     the userId comes from the verified session. Without it, identity
 *     falls back to the single `default-user` (pre-auth behavior).
 *
 * `/api/auth/*` and `/api/health` are always public.
 */
export const userIdMiddleware = createMiddleware<Env>(async (c, next) => {
  // 1. Machine bearer-token gate (unchanged from the S1 stopgap).
  const apiToken = c.env.API_TOKEN;
  if (apiToken) {
    const header = c.req.header("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token || token !== apiToken) {
      return apiError(c, 401, "UNAUTHORIZED", "Missing or invalid bearer token");
    }
  }

  // 2. Real per-user auth when configured.
  const secret = c.env.AUTH_SECRET;
  if (secret && !isPublicPath(new URL(c.req.url).pathname)) {
    const session = await verifySessionToken(getSessionTokenFromRequest(c), secret);
    if (!session) {
      return apiError(c, 401, "UNAUTHORIZED", "Authentication required");
    }
    c.set("userId", session.uid);
    await next();
    return;
  }

  // Pre-auth fallback: single shared identity (dev / not yet configured).
  c.set("userId", "default-user");
  await next();
});
