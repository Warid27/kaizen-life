import { createMiddleware } from "hono/factory";
import type { Bindings, AppDb } from "../db/client";
import { apiError } from "../lib/api";

type Env = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

/**
 * Single source of per-request identity — replaces the 18 copies of
 * `const USER_ID = "default-user"` (A2). Routes read `c.get("userId")`.
 *
 * Stopgap for S1 while real auth is pending: when the API_TOKEN binding is
 * configured (set it as a Worker secret in production), every request must
 * present `Authorization: Bearer <API_TOKEN>`. Dev stays frictionless.
 */
export const userIdMiddleware = createMiddleware<Env>(async (c, next) => {
  const expected = c.env.API_TOKEN;
  if (expected) {
    const header = c.req.header("Authorization") ?? "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token || token !== expected) {
      return apiError(c, 401, "UNAUTHORIZED", "Missing or invalid bearer token");
    }
  }
  // TODO: derive userId from a verified session/token once auth lands.
  c.set("userId", "default-user");
  await next();
});
