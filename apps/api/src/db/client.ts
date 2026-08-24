import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// D1 binding is injected via Cloudflare Workers env (c.env.DB)
export type Bindings = {
  DB: D1Database;
  ENVIRONMENT?: string;
  /** When set (prod secret), all requests require Authorization: Bearer <token>. */
  API_TOKEN?: string;
  /** VAPID keypair for Web Push (secrets). Push is disabled when unset. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  /** Contact for the VAPID `sub` claim, e.g. "mailto:you@example.com". */
  VAPID_SUBJECT?: string;
};

export function createDb(env: Bindings) {
  return drizzle(env.DB, { schema });
}

export type AppDb = ReturnType<typeof createDb>;
