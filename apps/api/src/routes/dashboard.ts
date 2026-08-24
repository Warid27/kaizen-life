import { Hono } from "hono";
import { eq, and, isNull, gte, lte, lt, sql, asc, isNull as isNullCol, ne, inArray } from "drizzle-orm";
import type { Bindings, AppDb } from "../db/client";
import {
  tasks,
  habits,
  habitLogs,
  checkins,
  transactions,
  projects,
  assignments,
  clients,
  clientFollowups,
} from "../db/schema";
import { apiError } from "../lib/api";
import { getTodayForUser } from "../lib/date";
import { shiftDate, DEFAULT_CURRENCY } from "@kaizenlife/shared";
import { isScheduledOnDate, parseDate } from "../services/habit-recurrence";

const dashboardRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// ─── GET /dashboard/today ────────────────────────────────────────────────────
// Fixes applied:
// - P5: independent sections now run via Promise.all instead of ~10 serial
//   round trips.
// - BL1/BL23: "today" resolves through the user's timezone; the task list no
//   longer silently drops undated and overdue work.
// - BL24: habit checklist respects recurrence scheduling; NULL progress
//   renders as explicit zeros.
// - BL12: finance totals are bucketed per currency (flat fields kept for the
//   primary currency so existing consumers don't break).
// - DB1: follow-up join excludes soft-deleted clients.
dashboardRouter.get("/dashboard/today", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");

    const today = await getTodayForUser(db, userId);
    const yesterday = shiftDate(today, -1);
    const weekLater = shiftDate(today, 7);

    // Month window derived from the user's "today", not server-UTC.
    const monthPrefix = today.slice(0, 7);
    const [yearStr = "", monStr = ""] = monthPrefix.split("-");
    const lastDay = new Date(Date.UTC(parseInt(yearStr, 10), parseInt(monStr, 10), 0)).getUTCDate();
    const monthStart = `${monthPrefix}-01`;
    const monthEnd = `${monthPrefix}-${String(lastDay).padStart(2, "0")}`;

    // 1. Today's tasks: scheduled today + undated backlog items.
    const todayTasksPromise = db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
          ne(tasks.status, "cancelled"),
          sql`(${tasks.date} = ${today} OR ${tasks.date} IS NULL)`,
        ),
      )
      .orderBy(asc(tasks.startTime))
      .all();

    // 1b. Overdue: dated before today but not done/cancelled.
    const overdueTasksPromise = db
      .select({
        id: tasks.id,
        title: tasks.title,
        date: tasks.date,
        priority: tasks.priority,
        status: tasks.status,
        startTime: tasks.startTime,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
          lt(tasks.date, today),
          inArray(tasks.status, ["todo", "in_progress"]),
        ),
      )
      .orderBy(asc(tasks.date))
      .all();

    // 2. Active habits (scheduling filtered below against the user's today).
    const activeHabitsPromise = db
      .select()
      .from(habits)
      .where(and(eq(habits.userId, userId), isNull(habits.deletedAt), eq(habits.active, true)))
      .orderBy(asc(habits.sortOrder))
      .all();

    const todaysLogsPromise = db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.userId, userId), eq(habitLogs.date, today)))
      .all();

    // 3. Yesterday's sleep summary + 4. 7-day sleep average (single scan).
    const sevenDaysAgo = shiftDate(today, -7);
    const sleepRowsPromise = db
      .select({
        date: checkins.date,
        bedTime: checkins.bedTime,
        wakeTime: checkins.wakeTime,
        totalSleepMinutes: checkins.totalSleepMinutes,
        sleepQuality: checkins.sleepQuality,
        napMinutes: checkins.napMinutes,
      })
      .from(checkins)
      .where(
        and(
          eq(checkins.userId, userId),
          gte(checkins.date, sevenDaysAgo),
          lte(checkins.date, yesterday),
          isNull(checkins.deletedAt),
        ),
      )
      .all();

    // 5. Current-month transactions (per-currency aggregation client-side).
    const monthTxRowsPromise = db
      .select({
        type: transactions.type,
        amountCents: transactions.amountCents,
        currency: transactions.currency,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
          isNull(transactions.deletedAt),
        ),
      )
      .all();

    // 6. Active projects
    const activeProjectsPromise = db
      .select()
      .from(projects)
      .where(and(eq(projects.userId, userId), eq(projects.status, "active"), isNull(projects.deletedAt)))
      .all();

    // 7a. Upcoming task deadlines — open items only (BL23).
    const upcomingTaskDeadlinesPromise = db
      .select({
        id: tasks.id,
        title: tasks.title,
        date: tasks.date,
        priority: tasks.priority,
        status: tasks.status,
        type: sql<string>`'task'`,
      })
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, userId),
          isNull(tasks.deletedAt),
          gte(tasks.date, today),
          lte(tasks.date, weekLater),
          inArray(tasks.status, ["todo", "in_progress"]),
        ),
      )
      .orderBy(asc(tasks.date))
      .all();

    // 7b. Upcoming assignment deadlines.
    const upcomingAssignmentDeadlinesPromise = db
      .select({
        id: assignments.id,
        title: assignments.title,
        date: assignments.dueDate,
        priority: assignments.priority,
        status: assignments.status,
        type: sql<string>`'assignment'`,
      })
      .from(assignments)
      .where(
        and(
          eq(assignments.userId, userId),
          isNull(assignments.deletedAt),
          gte(assignments.dueDate, today),
          lte(assignments.dueDate, weekLater),
        ),
      )
      .orderBy(asc(assignments.dueDate))
      .all();

    // 8. Overdue client follow-ups — join excludes deleted clients (DB1).
    const overdueFollowupsPromise = db
      .select({
        id: clientFollowups.id,
        clientId: clientFollowups.clientId,
        clientName: clients.name,
        lastContactDate: clientFollowups.lastContactDate,
        nextFollowupDate: clientFollowups.nextFollowupDate,
        notes: clientFollowups.notes,
      })
      .from(clientFollowups)
      .innerJoin(clients, and(eq(clientFollowups.clientId, clients.id), isNullCol(clients.deletedAt)))
      .where(
        and(
          eq(clientFollowups.userId, userId),
          isNull(clientFollowups.deletedAt),
          eq(clientFollowups.status, "pending"),
          lt(clientFollowups.nextFollowupDate, today),
        ),
      )
      .all();

    const [
      todayTasks,
      overdueTasks,
      activeHabits,
      todaysLogs,
      sleepRows,
      monthTxRows,
      activeProjects,
      upcomingTaskDeadlines,
      upcomingAssignmentDeadlines,
      overdueFollowups,
    ] = await Promise.all([
      todayTasksPromise,
      overdueTasksPromise,
      activeHabitsPromise,
      todaysLogsPromise,
      sleepRowsPromise,
      monthTxRowsPromise,
      activeProjectsPromise,
      upcomingTaskDeadlinesPromise,
      upcomingAssignmentDeadlinesPromise,
      overdueFollowupsPromise,
    ]);

    // Habit checklist: only habits actually scheduled on the user's today.
    const logByHabitId = new Map(todaysLogs.map((l) => [l.habitId, l]));
    const todayHabits = activeHabits
      .filter((habit) => isScheduledOnDate(habit, parseDate(today)))
      .map((habit) => {
        const log = logByHabitId.get(habit.id);
        const completedCount = log?.completedCount ?? 0;
        return {
          id: habit.id,
          name: habit.name,
          icon: habit.icon,
          category: habit.category,
          frequency: habit.frequency,
          targetCountPerPeriod: habit.targetCountPerPeriod,
          sortOrder: habit.sortOrder,
          completedCount,
          targetCount: log?.targetCount ?? habit.targetCountPerPeriod,
          completedToday: completedCount >= (log?.targetCount ?? habit.targetCountPerPeriod),
        };
      });

    // Sleep aggregates from the single 7-day scan.
    const yesterdaySleep = sleepRows.find((r) => r.date === yesterday) ?? null;
    const measuredNights = sleepRows.filter((r) => r.totalSleepMinutes != null);
    const sleepDaysCount = measuredNights.length;
    const avgSleepMinutes =
      sleepDaysCount > 0
        ? Math.round(
            measuredNights.reduce((sum, r) => sum + (r.totalSleepMinutes ?? 0), 0) / sleepDaysCount,
          )
        : null;

    // Finance per currency (BL12).
    const financeByCurrency: Record<
      string,
      { incomeCents: number; expenseCents: number; netCents: number }
    > = {};
    let transactionCount = 0;
    for (const tx of monthTxRows) {
      transactionCount += 1;
      const bucket =
        financeByCurrency[tx.currency] ??
        (financeByCurrency[tx.currency] = { incomeCents: 0, expenseCents: 0, netCents: 0 });
      if (tx.type === "income") bucket.incomeCents += tx.amountCents;
      else bucket.expenseCents += tx.amountCents;
      bucket.netCents = bucket.incomeCents - bucket.expenseCents;
    }
    const primaryFinance =
      financeByCurrency[DEFAULT_CURRENCY] ?? Object.values(financeByCurrency)[0] ?? {
        incomeCents: 0,
        expenseCents: 0,
        netCents: 0,
      };

    const upcomingDeadlines = [...upcomingTaskDeadlines, ...upcomingAssignmentDeadlines].sort(
      (a, b) => (a.date ?? "").localeCompare(b.date ?? ""),
    );

    return c.json({
      date: today,
      tasks: todayTasks,
      overdueTasks,
      habits: todayHabits,
      sleep: {
        yesterday: yesterdaySleep,
        avgLast7Days: {
          minutes: avgSleepMinutes,
          daysCount: sleepDaysCount,
        },
      },
      finance: {
        month: { start: monthStart, end: monthEnd },
        byCurrency: financeByCurrency,
        incomeCents: primaryFinance.incomeCents,
        expenseCents: primaryFinance.expenseCents,
        netCents: primaryFinance.netCents,
        transactionCount,
      },
      projects: activeProjects,
      upcomingDeadlines,
      overdueFollowups,
    });
  } catch (err) {
    console.error("GET /dashboard/today error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to build dashboard");
  }
});

export default dashboardRouter;
