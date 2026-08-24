import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { tasks, habits, habitLogs, checkins, transactions, diaryEntries } from "../db/schema";
import { and, eq, isNull, gte, lte, sql } from "drizzle-orm";
import type { AnySQLiteColumn } from "drizzle-orm/sqlite-core";
import { shiftDate } from "@kaizenlife/shared";
import { getTodayForUser } from "../lib/date";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const statsRouter = new Hono<RouteEnv>();

// GET /api/stats/overview?days=30 — real aggregates over a rolling window.
// This endpoint previously did not exist at all, so the Stats page rendered
// Math.random() demo data as if it were the user's life (F2/P6/BL22).
statsRouter.get("/stats/overview", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const daysRaw = c.req.query("days") ?? "30";
  const days = /^\d+$/.test(daysRaw) ? Math.min(Math.max(parseInt(daysRaw, 10), 1), 365) : 30;

  const today = await getTodayForUser(db, userId);
  const from = shiftDate(today, -(days - 1));
  const to = today;
  // Epoch (seconds) approximation of local midnight — used for created_at /
  // completed_at columns which store epoch seconds.
  const sinceEpoch = Math.floor(Date.parse(`${from}T00:00:00Z`) / 1000);

  const dateWindow = (col: AnySQLiteColumn) => and(gte(col, from), lte(col, to))!;

  const [taskStats, habitCompletions, activeHabits, sleepStats, financeRows, diaryCount] =
    await Promise.all([
      // Tasks created vs completed inside the window.
      Promise.all([
        db
          .select({ n: sql<number>`COUNT(*)` })
          .from(tasks)
          .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt), gte(tasks.createdAt, sinceEpoch)))
          .get(),
        db
          .select({ n: sql<number>`COUNT(*)` })
          .from(tasks)
          .where(
            and(
              eq(tasks.userId, userId),
              eq(tasks.status, "done"),
              isNull(tasks.deletedAt),
              gte(tasks.completedAt, sinceEpoch),
            ),
          )
          .get(),
      ]),

      // Habit completions: logs with progress > 0 in the window.
      db
        .select({ n: sql<number>`COUNT(*)` })
        .from(habitLogs)
        .where(
          and(
            eq(habitLogs.userId, userId),
            isNull(habitLogs.deletedAt),
            sql`${habitLogs.completedCount} > 0`,
            dateWindow(habitLogs.date),
          ),
        )
        .get(),

      // Active habits tracked.
      db
        .select({ n: sql<number>`COUNT(*)` })
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.active, true), isNull(habits.deletedAt)))
        .get(),

      // Sleep: nights recorded + average duration over the window.
      db
        .select({
          nights: sql<number>`COUNT(*)`,
          avgMinutes: sql<number>`AVG(${checkins.totalSleepMinutes})`,
        })
        .from(checkins)
        .where(
          and(
            eq(checkins.userId, userId),
            isNull(checkins.deletedAt),
            sql`${checkins.totalSleepMinutes} IS NOT NULL`,
            dateWindow(checkins.date),
          ),
        )
        .get(),

      // Finance totals per currency (never mixed across currencies — BL12).
      db
        .select({
          currency: transactions.currency,
          type: transactions.type,
          total: sql<number>`COALESCE(SUM(${transactions.amountCents}), 0)`,
        })
        .from(transactions)
        .where(
          and(
            eq(transactions.userId, userId),
            isNull(transactions.deletedAt),
            dateWindow(transactions.date),
          ),
        )
        .groupBy(transactions.currency, transactions.type)
        .all(),

      // Diary entries written in the window.
      db
        .select({ n: sql<number>`COUNT(*)` })
        .from(diaryEntries)
        .where(and(eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt), dateWindow(diaryEntries.date)))
        .get(),
    ]);

  const financeByCurrency: Record<string, { incomeCents: number; expenseCents: number; netCents: number }> = {};
  for (const row of financeRows) {
    const bucket =
      financeByCurrency[row.currency] ??
      (financeByCurrency[row.currency] = { incomeCents: 0, expenseCents: 0, netCents: 0 });
    if (row.type === "income") bucket.incomeCents += row.total;
    else bucket.expenseCents += row.total;
    bucket.netCents = bucket.incomeCents - bucket.expenseCents;
  }

  return c.json({
    range: { days, from, to },
    tasks: {
      created: taskStats[0]?.n ?? 0,
      completed: taskStats[1]?.n ?? 0,
    },
    habits: {
      active: activeHabits?.n ?? 0,
      completions: habitCompletions?.n ?? 0,
    },
    sleep: {
      nights: sleepStats?.nights ?? 0,
      avgMinutes: sleepStats?.avgMinutes != null ? Math.round(sleepStats.avgMinutes) : null,
    },
    finance: {
      byCurrency: financeByCurrency,
    },
    diary: {
      entries: diaryCount?.n ?? 0,
    },
  });
});

export default statsRouter;
