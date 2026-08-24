import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Bindings, AppDb } from "../db/client";
import checkinsRouter from "./checkins";

const DDL = [
  `CREATE TABLE checkins (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    date text NOT NULL,
    bed_time text,
    wake_time text,
    nap_minutes integer DEFAULT 0,
    total_sleep_minutes integer,
    sleep_quality integer,
    mood integer,
    energy integer,
    stress integer,
    note text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
  )`,
  `CREATE UNIQUE INDEX uniq_checkins_user_date_live ON checkins (user_id, date) WHERE deleted_at IS NULL`,
];

function createTestApp(): { app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  for (const ddl of DDL) sqlite.exec(ddl);
  const db = drizzle(sqlite) as unknown as AppDb;
  const app = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("userId", "u1");
    await next();
  });
  app.route("/", checkinsRouter);
  return { app, sqlite };
}

describe("PUT /checkins/:date", () => {
  let app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>;
  let sqlite: Database.Database;

  beforeEach(() => {
    ({ app, sqlite } = createTestApp());
  });

  it("creates then updates the same row on repeated PUT (no duplicate)", async () => {
    const first = await app.request("/checkins/2026-08-23", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bedTime: "23:00", mood: 7 }),
    });
    expect(first.status).toBe(201);
    const firstJson = (await first.json()) as { id: string; mood: number | null };
    expect(firstJson.mood).toBe(7);

    const second = await app.request("/checkins/2026-08-23", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ bedTime: "22:30", mood: 9, energy: 8 }),
    });
    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as {
      id: string;
      bedTime: string | null;
      mood: number | null;
      energy: number | null;
    };
    expect(secondJson.id).toBe(firstJson.id);
    expect(secondJson.bedTime).toBe("22:30");
    expect(secondJson.mood).toBe(9);
    expect(secondJson.energy).toBe(8);

    const count = sqlite.prepare("SELECT COUNT(*) AS n FROM checkins").get() as { n: number };
    expect(count.n).toBe(1);
  });

  it("resurrects a soft-deleted check-in with deletedAt back to null (G1)", async () => {
    const created = await app.request("/checkins/2026-08-23", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mood: 5 }),
    });
    const createdJson = (await created.json()) as { id: string };

    sqlite.prepare("UPDATE checkins SET deleted_at = 1756000000 WHERE id = ?").run(createdJson.id);
    const softDeleted = sqlite
      .prepare("SELECT deleted_at FROM checkins WHERE id = ?")
      .get(createdJson.id) as { deleted_at: number | null };
    expect(softDeleted.deleted_at).toBe(1756000000);

    const res = await app.request("/checkins/2026-08-23", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mood: 8, note: "back" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as {
      id: string;
      deletedAt: number | null;
      mood: number | null;
    };
    expect(json.id).toBe(createdJson.id);
    expect(json.deletedAt).toBeNull();
    expect(json.mood).toBe(8);

    const count = sqlite.prepare("SELECT COUNT(*) AS n FROM checkins").get() as { n: number };
    expect(count.n).toBe(1);

    const live = sqlite
      .prepare("SELECT COUNT(*) AS n FROM checkins WHERE deleted_at IS NULL")
      .get() as { n: number };
    expect(live.n).toBe(1);
  });

  it("rejects a non-YYYY-MM-DD path param", async () => {
    const res = await app.request("/checkins/not-a-date", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mood: 3 }),
    });
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});
