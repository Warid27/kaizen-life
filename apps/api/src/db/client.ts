import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

// D1 binding is injected via Cloudflare Workers env (c.env.DB)
export type Bindings = {
  DB: any; // D1Database — typed at runtime by Cloudflare Workers
};

export function createDb(env: Bindings) {
  return drizzle(env.DB, { schema });
}

export type AppDb = ReturnType<typeof createDb>;
