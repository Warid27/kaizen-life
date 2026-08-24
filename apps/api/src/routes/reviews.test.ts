import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { Hono } from "hono";
import { drizzle } from "drizzle-orm/better-sqlite3";
import type { Bindings, AppDb } from "../db/client";
import * as schema from "../db/schema";
import reviewsRouter from "./reviews";

const BASE_EPOCH = Math.floor(Date.parse("2026-08-01T00:00:00Z") / 1000);

const DDL = [
  `CREATE TABLE monthly_reviews (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    year integer NOT NULL,
    month integer NOT NULL,
    biggest_achievement text,
    biggest_lesson text,
    next_month_priorities text,
    auto_summary_json text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
  )`,
  `CREATE UNIQUE INDEX uniq_reviews_user_month_live ON monthly_reviews (user_id, year, month) WHERE deleted_at IS NULL`,
  `CREATE TABLE transactions (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    date text NOT NULL,
    type text NOT NULL,
    amount_cents integer NOT NULL,
    currency text DEFAULT 'idr' NOT NULL,
    category text NOT NULL,
    account text NOT NULL,
    note text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
  )`,
  `CREATE TABLE goals (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    type text NOT NULL,
    period_start text NOT NULL,
    period_end text NOT NULL,
    target_value real,
    current_value real DEFAULT 0,
    unit text,
    status text DEFAULT 'not_started' NOT NULL,
    parent_goal_id text,
    linked_habit_id text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
  )`,
  `CREATE TABLE habits (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    name text NOT NULL,
    icon text,
    category text,
    frequency text DEFAULT 'daily' NOT NULL,
    target_count_per_period integer DEFAULT 1 NOT NULL,
    custom_days text,
    active integer DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    archived_at integer,
    deleted_at integer
  )`,
  `CREATE TABLE habit_logs (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    habit_id text NOT NULL,
    date text NOT NULL,
    completed_count integer DEFAULT 0 NOT NULL,
    target_count integer NOT NULL,
    note text,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
  )`,
  `CREATE UNIQUE INDEX uniq_habit_logs_habit_date_live ON habit_logs (habit_id, date) WHERE deleted_at IS NULL`,
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
  `CREATE TABLE tasks (
    id text PRIMARY KEY NOT NULL,
    user_id text NOT NULL,
    title text NOT NULL,
    description text,
    date text,
    start_time text,
    end_time text,
    estimated_duration_min integer,
    priority text DEFAULT 'medium' NOT NULL,
    status text DEFAULT 'todo' NOT NULL,
    project_id text,
    course_id text,
    tags text,
    completed_at integer,
    created_at integer NOT NULL,
    updated_at integer NOT NULL,
    deleted_at integer
  )`,
];

interface TestCtx {
  db: AppDb;
  sqlite: Database.Database;
  app: Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>;
}

function createTestEnv(): TestCtx {
  const sqlite = new Database(":memory:");
  for (const ddl of DDL) sqlite.exec(ddl);
  const db = drizzle(sqlite, { schema }) as unknown as AppDb;
  const app = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();
  app.use("*", async (c, next) => {
    c.set("db", db);
    c.set("userId", "u1");
    await next();
  });
  app.route("/", reviewsRouter);
  return { db, sqlite, app };
}

function makeCompletedAugustLogs(habitId: string, dates: string[]) {
  return dates.map((date) => ({
    id: crypto.randomUUID(),
    userId: "u1",
    habitId,
    date,
    completedCount: 1,
    targetCount: 1,
    note: null,
    createdAt: BASE_EPOCH,
    updatedAt: BASE_EPOCH,
    deletedAt: null,
  }));
}

const AUGUST_DATES = Array.from({ length: 31 }, (_, i) => `2026-08-${String(i + 1).padStart(2, "0")}`);

describe("GET /reviews/:yearMonth and /reviews/:year/:month", () => {
  let ctx: TestCtx;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  it("returns { data: null } when no review exists (single-segment form)", async () => {
    const res = await ctx.app.request("/reviews/2026-08");
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: unknown };
    expect(json.data).toBeNull();
  });

  it("serves the same row through both path forms", async () => {
    const putRes = await ctx.app.request("/reviews/2026-08", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ biggestAchievement: "Shipped test suite" }),
    });
    expect(putRes.status).toBe(201);
    const putJson = (await putRes.json()) as { data: { id: string } };

    const single = await ctx.app.request("/reviews/2026-08");
    expect(single.status).toBe(200);
    const singleJson = (await single.json()) as { data: { id: string } | null };
    expect(singleJson.data?.id).toBe(putJson.data.id);

    const paired = await ctx.app.request("/reviews/2026/8");
    expect(paired.status).toBe(200);
    const pairedJson = (await paired.json()) as { data: { id: string } | null };
    expect(pairedJson.data?.id).toBe(putJson.data.id);
  });

  it("rejects malformed month identifiers with VALIDATION_ERROR", async () => {
    const res = await ctx.app.request("/reviews/2026-13");
    expect(res.status).toBe(400);
    const json = (await res.json()) as { error: { code: string } };
    expect(json.error.code).toBe("VALIDATION_ERROR");
  });
});

describe("PUT /reviews/:yearMonth upsert", () => {
  let ctx: TestCtx;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  it("creates a review WITHOUT year/month in the request body", async () => {
    const res = await ctx.app.request("/reviews/2026-08", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ biggestAchievement: "First save" }),
    });

    expect(res.status).toBe(201);
    const json = (await res.json()) as {
      data: { id: string; year: number; month: number; biggestAchievement: string | null };
    };
    expect(json.data.year).toBe(2026);
    expect(json.data.month).toBe(8);
    expect(json.data.biggestAchievement).toBe("First save");

    const rows = ctx.sqlite.prepare("SELECT COUNT(*) AS n FROM monthly_reviews").get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it("second PUT updates the same row instead of duplicating or crashing", async () => {
    const first = await ctx.app.request("/reviews/2026-08", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ biggestAchievement: "First save" }),
    });
    const firstJson = (await first.json()) as { data: { id: string; updatedAt: number } };

    const second = await ctx.app.request("/reviews/2026-08", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        biggestAchievement: "Updated save",
        nextMonthPriorities: "Keep testing",
      }),
    });

    expect(second.status).toBe(200);
    const secondJson = (await second.json()) as {
      data: { id: string; biggestAchievement: string | null; nextMonthPriorities: string | null };
    };
    expect(secondJson.data.id).toBe(firstJson.data.id);
    expect(secondJson.data.biggestAchievement).toBe("Updated save");
    expect(secondJson.data.nextMonthPriorities).toBe("Keep testing");

    const rows = ctx.sqlite.prepare("SELECT COUNT(*) AS n FROM monthly_reviews").get() as { n: number };
    expect(rows.n).toBe(1);
  });

  it("resurrects a soft-deleted review on save", async () => {
    await ctx.app.request("/reviews/2026-08", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ biggestAchievement: "v1" }),
    });
    ctx.sqlite.prepare("UPDATE monthly_reviews SET deleted_at = 1756000000 WHERE year = 2026 AND month = 8").run();

    const res = await ctx.app.request("/reviews/2026-08", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ biggestAchievement: "revived" }),
    });
    expect(res.status).toBe(200);
    const json = (await res.json()) as { data: { deletedAt: number | null } };
    expect(json.data.deletedAt).toBeNull();

    const rows = ctx.sqlite.prepare("SELECT COUNT(*) AS n FROM monthly_reviews").get() as { n: number };
    expect(rows.n).toBe(1);
  });
});

describe("POST /reviews/generate/:year/:month", () => {
  let ctx: TestCtx;

  beforeEach(() => {
    ctx = createTestEnv();
  });

  it("caps habit completionRatePct at <= 100 and rolls up real data", async () => {
    const now = BASE_EPOCH;
    const habitA = { id: crypto.randomUUID(), userId: "u1", name: "A", frequency: "daily" as const, targetCountPerPeriod: 1, active: true, createdAt: now, updatedAt: now };
    const habitB = { id: crypto.randomUUID(), userId: "u1", name: "B", frequency: "daily" as const, targetCountPerPeriod: 1, active: true, createdAt: now, updatedAt: now };
    const habitInactive = { id: crypto.randomUUID(), userId: "u1", name: "C", frequency: "daily" as const, targetCountPerPeriod: 1, active: false, createdAt: now, updatedAt: now };
    await ctx.db.insert(schema.habits).values([
      { ...habitA, icon: null, category: null, customDays: null, sortOrder: 0, archivedAt: null, deletedAt: null },
      { ...habitB, icon: null, category: null, customDays: null, sortOrder: 0, archivedAt: null, deletedAt: null },
      { ...habitInactive, icon: null, category: null, customDays: null, sortOrder: 0, archivedAt: null, deletedAt: null },
    ]).run();

    const logs = [
      ...makeCompletedAugustLogs(habitA.id, AUGUST_DATES),
      ...makeCompletedAugustLogs(habitB.id, AUGUST_DATES),
      ...makeCompletedAugustLogs(habitInactive.id, AUGUST_DATES.slice(0, 5)),
    ];
    await ctx.db.insert(schema.habitLogs).values(logs).run();

    await ctx.db.insert(schema.transactions).values({
      id: crypto.randomUUID(),
      userId: "u1",
      date: "2026-08-10",
      type: "income",
      amountCents: 500_000,
      currency: "idr",
      category: "Salary",
      account: "bank",
      note: null,
      createdAt: now,
      updatedAt: now,
      deletedAt: null,
    }).run();

    const res = await ctx.app.request("/reviews/generate/2026/8", { method: "POST" });
    expect(res.status).toBe(200);

    const json = (await res.json()) as {
      review: { year: number; month: number; autoSummaryJson: string | null };
      autoSummary: {
        habits: { activeCount: number; completionRatePct: number };
        finance: { byCurrency: Record<string, { incomeCents: number; expenseCents: number }>; transactionCount: number };
        sleep: { avgMinutes: number | null; daysTracked: number };
      };
    };

    expect(json.review.year).toBe(2026);
    expect(json.review.month).toBe(8);

    expect(json.autoSummary.habits.activeCount).toBe(2);
    expect(json.autoSummary.habits.completionRatePct).toBeLessThanOrEqual(100);
    expect(json.autoSummary.habits.completionRatePct).toBe(100);

    expect(json.autoSummary.finance.transactionCount).toBe(1);
    expect(json.autoSummary.finance.byCurrency.idr?.incomeCents).toBe(500_000);
    expect(json.autoSummary.finance.byCurrency.idr?.expenseCents).toBe(0);

    expect(json.autoSummary.sleep.avgMinutes).toBeNull();

    const persisted = JSON.parse(json.review.autoSummaryJson ?? "{}") as typeof json.autoSummary;
    expect(persisted.habits.completionRatePct).toBe(100);
  });
});
