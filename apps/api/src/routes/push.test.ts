import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Bindings, AppDb } from "../db/client";
import pushRouter from "./push";

const DDL = [
  `CREATE TABLE push_subscriptions (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    endpoint text NOT NULL,
    p256dh text NOT NULL,
    auth text NOT NULL,
    user_agent text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL
  )`,
  `CREATE UNIQUE INDEX push_subscriptions_endpoint_unique ON push_subscriptions (endpoint)`,
];

type Env = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

function createTestApp(bindings: Partial<Bindings> = {}) {
  const sqlite = new Database(":memory:");
  for (const ddl of DDL) sqlite.exec(ddl);
  const db = drizzle(sqlite) as unknown as AppDb;
  const app = new Hono<Env>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("userId", "u1");
    c.env = { ...c.env, ...bindings };
    await next();
  });
  app.route("/", pushRouter);
  return { app, sqlite };
}

const SUB_A = {
  endpoint: "https://push.example/sub/aaaa",
  keys: { p256dh: "BPK1".repeat(16), auth: "authsecret1" },
};
const SUB_B = {
  endpoint: "https://push.example/sub/bbbb",
  keys: { p256dh: "BPK2".repeat(16), auth: "authsecret2" },
};

describe("GET /push/vapid-public-key", () => {
  it("returns the configured key", async () => {
    const { app } = createTestApp({ VAPID_PUBLIC_KEY: "pub-key-123" });
    const res = await app.request("/push/vapid-public-key");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { publicKey: string | null } };
    expect(json.data.publicKey).toBe("pub-key-123");
  });

  it("returns null (not an error) when push is not configured", async () => {
    const { app } = createTestApp();
    const res = await app.request("/push/vapid-public-key");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { publicKey: string | null } };
    expect(json.data.publicKey).toBeNull();
  });
});

describe("POST /push/subscriptions", () => {
  let app: Hono<Env>;
  let sqlite: Database.Database;

  beforeEach(() => {
    ({ app, sqlite } = createTestApp());
  });

  it("stores a subscription with the calling userId", async () => {
    const res = await app.request("/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SUB_A),
    });
    expect(res.status).toBe(201);
    const row = sqlite
      .prepare("SELECT user_id, endpoint FROM push_subscriptions")
      .get() as { user_id: string; endpoint: string };
    expect(row.user_id).toBe("u1");
    expect(row.endpoint).toBe(SUB_A.endpoint);
  });

  it("rejects invalid payloads with a unified envelope", async () => {
    const res = await app.request("/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: "not-a-url", keys: {} }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });

  it("upserts on the same endpoint instead of duplicating", async () => {
    await app.request("/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SUB_A),
    });
    const refreshed = { ...SUB_A, keys: { ...SUB_A.keys, auth: "rotated-auth" } };
    await app.request("/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(refreshed),
    });

    const rows = sqlite.prepare("SELECT auth FROM push_subscriptions").all() as Array<{
      auth: string;
    }>;
    expect(rows.length).toBe(1);
    expect(rows[0]!.auth).toBe("rotated-auth");
  });
});

describe("DELETE /push/subscriptions", () => {
  let app: Hono<Env>;
  let sqlite: Database.Database;

  beforeEach(async () => {
    ({ app, sqlite } = createTestApp());
    await app.request("/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SUB_A),
    });
    await app.request("/push/subscriptions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(SUB_B),
    });
  });

  it("removes only the requested endpoint", async () => {
    const res = await app.request("/push/subscriptions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: SUB_A.endpoint }),
    });
    expect(res.status).toBe(200);

    const endpoints = (
      sqlite.prepare("SELECT endpoint FROM push_subscriptions").all() as Array<{
        endpoint: string;
      }>
    ).map((r) => r.endpoint);
    expect(endpoints).toEqual([SUB_B.endpoint]);
  });

  it("does nothing when the endpoint belongs to another user", async () => {
    sqlite
      .prepare("UPDATE push_subscriptions SET user_id = 'someone-else' WHERE endpoint = ?")
      .run(SUB_A.endpoint);

    await app.request("/push/subscriptions", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ endpoint: SUB_A.endpoint }),
    });

    // u1's subscription (SUB_B) survives; someone-else's untouched.
    const n = sqlite
      .prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id != 'u1'")
      .get() as { n: number };
    expect(n.n).toBe(1);
    const mine = sqlite
      .prepare("SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = 'u1'")
      .get() as { n: number };
    expect(mine.n).toBe(1);
  });
});
