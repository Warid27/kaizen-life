import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// D1 binding is injected via Cloudflare Workers env (c.env.DB)
export type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  /** When set (prod secret), all requests require Authorization: Bearer <token>. */
  API_TOKEN?: string;
  /**
   * When set (prod secret), real auth is enforced: requests need a valid
   * `kaizen_session` cookie (HMAC-signed by /api/auth/login). Unset = local
   * dev frictionless mode with the shared default-user identity.
   */
  AUTH_SECRET?: string;
  /** Optional override for PBKDF2 iterations (10000–1000000; default 100000). */
  PBKDF2_ITERATIONS?: string;
  /** VAPID keypair for Web Push (secrets). Push is disabled when unset. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

export function createDb(env: Bindings) {
  return drizzle(env.DB, { schema });
}

export type AppDb = ReturnType<typeof createDb>;
