import { describe, it, expect, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import {
  isScheduledOnDate,
  formatDate,
  parseDate,
  epochToDateStr,
  countScheduledOnDate,
  ensureTodayLogs,
  computeHabitStats,
} from "./habit-recurrence";
import type { AppDb } from "../db/client";
import { habits, habitLogs } from "../db/schema";

type HabitRow = typeof habits.$inferSelect;
type HabitLogRow = typeof habitLogs.$inferSelect;

const MONDAY = "2026-08-24";
const TUESDAY = "2026-08-25";
const WEDNESDAY = "2026-08-26";
const FRIDAY = "2026-08-28";
const SUNDAY = "2026-08-30";

const epochOf = (dateStr: string): number => Date.parse(`${dateStr}T00:00:00Z`) / 1000;

const HABITS_DDL = `
CREATE TABLE habits (
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
)`;

const HABIT_LOGS_DDL = `
CREATE TABLE habit_logs (
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
)`;

function createTestDb(): { db: AppDb; sqlite: Database.Database } {
  const sqlite = new Database(":memory:");
  sqlite.exec(HABITS_DDL);
  sqlite.exec(HABIT_LOGS_DDL);
  sqlite.exec(
    "CREATE UNIQUE INDEX uniq_habit_logs_habit_date_live ON habit_logs (habit_id, date) WHERE deleted_at IS NULL",
  );
  sqlite.exec("CREATE INDEX idx_habit_logs_user_date ON habit_logs (user_id, date)");
  const db = drizzle(sqlite, { schema: { habits, habitLogs } }) as unknown as AppDb;
  return { db, sqlite };
}

function makeHabit(overrides: Partial<HabitRow> = {}): HabitRow {
  return {
    id: crypto.randomUUID(),
    userId: "u1",
    name: "Test habit",
    icon: null,
    category: null,
    frequency: "daily",
    targetCountPerPeriod: 1,
    customDays: null,
    active: true,
    sortOrder: 0,
    createdAt: epochOf("2026-07-01"),
    updatedAt: epochOf("2026-07-01"),
    archivedAt: null,
    deletedAt: null,
    ...overrides,
  };
}

async function insertHabits(db: AppDb, rows: HabitRow[]): Promise<void> {
  if (rows.length === 0) return;
  await db.insert(habits).values(rows).run();
}

async function insertLogs(db: AppDb, rows: Partial<HabitLogRow>[]): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .insert(habitLogs)
    .values(
      rows.map((r) => ({
        id: crypto.randomUUID(),
        userId: "u1",
        habitId: r.habitId ?? "h",
        date: r.date ?? MONDAY,
        completedCount: r.completedCount ?? 1,
        targetCount: r.targetCount ?? 1,
        note: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        ...r,
      })),
    )
    .run();
}

describe("habit-recurrence date helpers", () => {
  it("formatDate renders UTC calendar fields", () => {
    expect(formatDate(new Date(Date.UTC(2026, 7, 24)))).toBe(MONDAY);
    expect(formatDate(new Date(Date.UTC(2024, 1, 29)))).toBe("2024-02-29");
  });

  it("parseDate produces UTC midnight", () => {
    const d = parseDate(MONDAY);
    expect(d.toISOString()).toBe("2026-08-24T00:00:00.000Z");
    expect(d.getUTCDay()).toBe(1);
  });

  it("formatDate/parseDate round-trip", () => {
    for (const s of [MONDAY, "1970-01-01", "2024-02-29", SUNDAY]) {
      expect(formatDate(parseDate(s))).toBe(s);
    }
  });

  it("parseDate throws on malformed input", () => {
    expect(() => parseDate("garbage")).toThrow(RangeError);
    expect(() => parseDate("")).toThrow(RangeError);
    expect(() => parseDate("2026-xx-01")).toThrow(RangeError);
    expect(() => parseDate("2026-08")).toThrow(RangeError);
  });

  it("epochToDateStr converts seconds using the UTC calendar", () => {
    expect(epochToDateStr(0)).toBe("1970-01-01");
    expect(epochToDateStr(Date.UTC(2026, 7, 24) / 1000)).toBe(MONDAY);
    expect(epochToDateStr(Date.UTC(2026, 7, 24, 23, 59, 59) / 1000)).toBe(MONDAY);
    expect(epochToDateStr(Date.UTC(2026, 7, 25) / 1000 - 1)).toBe(MONDAY);
  });
});

describe("isScheduledOnDate", () => {
  it("daily habit is scheduled every day", () => {
    const h = makeHabit({ frequency: "daily" });
    expect(isScheduledOnDate(h, parseDate(MONDAY))).toBe(true);
    expect(isScheduledOnDate(h, parseDate(SUNDAY))).toBe(true);
  });

  it("weekly_n habit is scheduled every day (quota handled by stats)", () => {
    const h = makeHabit({ frequency: "weekly_n", targetCountPerPeriod: 3 });
    expect(isScheduledOnDate(h, parseDate(MONDAY))).toBe(true);
    expect(isScheduledOnDate(h, parseDate(SUNDAY))).toBe(true);
  });

  it("custom_days matches weekdays listed in JSON (0=Sunday)", () => {
    const h = makeHabit({ frequency: "custom_days", customDays: "[1,3,5]" });
    expect(isScheduledOnDate(h, parseDate(MONDAY))).toBe(true);
    expect(isScheduledOnDate(h, parseDate(TUESDAY))).toBe(false);
    expect(isScheduledOnDate(h, parseDate(WEDNESDAY))).toBe(true);
    expect(isScheduledOnDate(h, parseDate(FRIDAY))).toBe(true);
    expect(isScheduledOnDate(h, parseDate(SUNDAY))).toBe(false);
  });

  it("custom_days with invalid/garbage JSON is never scheduled", () => {
    const badJson = makeHabit({ frequency: "custom_days", customDays: "{not json" });
    const nonArray = makeHabit({ frequency: "custom_days", customDays: '"[1,3]"' });
    const empty = makeHabit({ frequency: "custom_days", customDays: null });
    for (const h of [badJson, nonArray, empty]) {
      expect(isScheduledOnDate(h, parseDate(MONDAY))).toBe(false);
    }
  });

  it("inactive or soft-deleted habits are never scheduled", () => {
    const inactive = makeHabit({ active: false });
    const deleted = makeHabit({ deletedAt: epochOf(MONDAY) });
    expect(isScheduledOnDate(inactive, parseDate(MONDAY))).toBe(false);
    expect(isScheduledOnDate(deleted, parseDate(MONDAY))).toBe(false);
  });
});

describe("countScheduledOnDate", () => {
  it("counts only live, active, scheduled habits across mixed frequencies", () => {
    const list = [
      makeHabit({ frequency: "daily" }),
      makeHabit({ frequency: "weekly_n", targetCountPerPeriod: 3 }),
      makeHabit({ frequency: "custom_days", customDays: "[1,3,5]" }),
      makeHabit({ frequency: "custom_days", customDays: "[0,6]" }),
      makeHabit({ frequency: "daily", active: false }),
      makeHabit({ frequency: "daily", deletedAt: epochOf(MONDAY) }),
    ];
    expect(countScheduledOnDate(list, parseDate(MONDAY))).toBe(3);
  });
});

describe("ensureTodayLogs", () => {
  let db: AppDb;
  let sqlite: Database.Database;

  beforeEach(() => {
    ({ db, sqlite } = createTestDb());
  });

  it("creates placeholder logs for scheduled habits only", async () => {
    const daily = makeHabit({ frequency: "daily", targetCountPerPeriod: 1 });
    const customMonday = makeHabit({
      frequency: "custom_days",
      customDays: "[1]",
      targetCountPerPeriod: 2,
    });
    const inactive = makeHabit({ active: false });
    const deleted = makeHabit({ deletedAt: epochOf("2026-08-20") });
    await insertHabits(db, [daily, customMonday, inactive, deleted]);

    const logs = await ensureTodayLogs(db, "u1", MONDAY);

    expect(logs).toHaveLength(2);
    const byHabit = new Map(logs.map((l) => [l.habitId, l]));
    expect(byHabit.get(daily.id)?.completedCount).toBe(0);
    expect(byHabit.get(daily.id)?.targetCount).toBe(1);
    expect(byHabit.get(customMonday.id)?.targetCount).toBe(2);
    expect(byHabit.has(inactive.id)).toBe(false);
    expect(byHabit.has(deleted.id)).toBe(false);

    const allRows = await db.select().from(habitLogs).all();
    expect(allRows).toHaveLength(2);
  });

  it("second call does not duplicate placeholders", async () => {
    const daily = makeHabit({});
    await insertHabits(db, [daily]);

    await ensureTodayLogs(db, "u1", MONDAY);
    await ensureTodayLogs(db, "u1", MONDAY);

    const allRows = await db.select().from(habitLogs).all();
    expect(allRows).toHaveLength(1);
    expect(allRows[0]?.habitId).toBe(daily.id);
  });

  it("resurrects a soft-deleted log instead of crashing on UNIQUE", async () => {
    const daily = makeHabit({});
    await insertHabits(db, [daily]);
    await ensureTodayLogs(db, "u1", MONDAY);

    sqlite.prepare("UPDATE habit_logs SET deleted_at = 1756000000 WHERE habit_id = ?").run(daily.id);

    const before = await db.select().from(habitLogs).all();
    expect(before).toHaveLength(1);
    expect(before[0]?.deletedAt).toBe(1756000000);

    const logs = await ensureTodayLogs(db, "u1", MONDAY);

    expect(logs).toHaveLength(1);
    expect(logs[0]?.deletedAt).toBeNull();

    const allRows = await db.select().from(habitLogs).all();
    expect(allRows).toHaveLength(1);
    expect(allRows[0]?.deletedAt).toBeNull();
  });
});

describe("computeHabitStats", () => {
  let db: AppDb;
  let sqlite: Database.Database;

  beforeEach(() => {
    ({ db, sqlite } = createTestDb());
  });

  it("returns null for a soft-deleted habit", async () => {
    const h = makeHabit({ deletedAt: epochOf(MONDAY) });
    await insertHabits(db, [h]);
    const stats = await computeHabitStats(db, h.id, "u1", MONDAY);
    expect(stats).toBeNull();
  });

  it("daily habit: rate denominator starts at creation date, not 365-day lookback", async () => {
    const h = makeHabit({ frequency: "daily", createdAt: epochOf("2026-08-23") });
    await insertHabits(db, [h]);
    await insertLogs(db, [{ habitId: h.id, date: MONDAY, completedCount: 1, targetCount: 1 }]);

    const stats = await computeHabitStats(db, h.id, "u1", MONDAY);

    expect(stats).not.toBeNull();
    expect(stats?.totalScheduledDays).toBeLessThanOrEqual(2);
    expect(stats?.totalScheduledDays).toBe(2);
    expect(stats?.totalCompletions).toBe(1);
    expect(stats?.completionRate).toBe(0.5);
    expect(stats?.currentStreak).toBe(1);
    expect(stats?.longestStreak).toBe(1);
  });

  it("weekly_n target 3: completing 3 days of the week yields full-week completion rate", async () => {
    const h = makeHabit({
      frequency: "weekly_n",
      targetCountPerPeriod: 3,
      createdAt: epochOf(WEDNESDAY),
    });
    await insertHabits(db, [h]);
    await insertLogs(db, [
      { habitId: h.id, date: "2026-08-27", completedCount: 1, targetCount: 1 },
      { habitId: h.id, date: FRIDAY, completedCount: 1, targetCount: 1 },
      { habitId: h.id, date: "2026-08-29", completedCount: 1, targetCount: 1 },
    ]);

    const stats = await computeHabitStats(db, h.id, "u1", SUNDAY);

    expect(stats?.frequency).toBe("weekly_n");
    expect(stats?.completionRate).toBeGreaterThanOrEqual(0.9);
    expect(stats?.completionRate).toBe(1);
    expect(stats?.totalCompletions).toBe(3);
    expect(stats?.currentStreak).toBe(1);
  });

  it("weekly_n streak counts weeks-with-quota; grace keeps an empty running week alive", async () => {
    const h = makeHabit({
      frequency: "weekly_n",
      targetCountPerPeriod: 3,
      createdAt: epochOf("2026-07-01"),
    });
    await insertHabits(db, [h]);
    await insertLogs(db, [
      { habitId: h.id, date: "2026-08-17", completedCount: 1, targetCount: 1 },
      { habitId: h.id, date: "2026-08-18", completedCount: 1, targetCount: 1 },
      { habitId: h.id, date: "2026-08-19", completedCount: 1, targetCount: 1 },
    ]);

    const stats = await computeHabitStats(db, h.id, "u1", MONDAY);

    expect(stats?.currentStreak).toBe(2);
    expect(stats?.longestStreak).toBe(2);
    expect(stats?.totalCompletions).toBe(3);
  });
});
