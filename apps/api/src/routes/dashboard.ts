import { Hono } from "hono";
import { eq, and, isNull, gte, lte, lt, sql, asc } from "drizzle-orm";
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

const dashboardRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

const USER_ID = "default-user";

// ─── Helpers ─────────────────────────────────────────────────────────────────
function todayStr(): string {
  return toDateStr(new Date());
}

function toDateStr(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Shift a date string by N days and return YYYY-MM-DD */
function shiftDate(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00");
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

/** Return YYYY-MM-DD of the first day of the current month */
function currentMonthStart(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

/** Return YYYY-MM-DD of the last day of the current month */
function currentMonthEnd(): string {
  const d = new Date();
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
}

// ─── GET /dashboard/today ────────────────────────────────────────────────────
dashboardRouter.get("/dashboard/today", async (c) => {
  try {
    const db = c.get("db");
    const today = todayStr();
    const yesterday = shiftDate(today, -1);
    const weekLater = shiftDate(today, 7);
    const monthStart = currentMonthStart();
    const monthEnd = currentMonthEnd();
    const baseConditions = [eq(tasks.userId, USER_ID), isNull(tasks.deletedAt)];

    // 1. Today's tasks (schedule + priorities)
    const todayTasks = await db
      .select()
      .from(tasks)
      .where(and(...baseConditions, eq(tasks.date, today)))
      .orderBy(asc(tasks.startTime))
      .all();

    // 2. Today's habit checklist with completion status
    const todayHabits = await db
      .select({
        id: habits.id,
        name: habits.name,
        icon: habits.icon,
        category: habits.category,
        targetCountPerPeriod: habits.targetCountPerPeriod,
        sortOrder: habits.sortOrder,
        completedCount: habitLogs.completedCount,
        targetCount: habitLogs.targetCount,
      })
      .from(habits)
      .leftJoin(
        habitLogs,
        and(eq(habits.id, habitLogs.habitId), eq(habitLogs.date, today)),
      )
      .where(
        and(
          eq(habits.userId, USER_ID),
          isNull(habits.deletedAt),
          eq(habits.active, true),
        ),
      )
      .orderBy(asc(habits.sortOrder))
      .all();

    // 3. Yesterday's sleep summary
    const yesterdaySleep = await db
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
          eq(checkins.userId, USER_ID),
          eq(checkins.date, yesterday),
          isNull(checkins.deletedAt),
        ),
      )
      .get();

    // 4. 7-day sleep average
    const sevenDaysAgo = shiftDate(today, -7);
    const recentSleepRows = await db
      .select({
        totalSleepMinutes: checkins.totalSleepMinutes,
      })
      .from(checkins)
      .where(
        and(
          eq(checkins.userId, USER_ID),
          gte(checkins.date, sevenDaysAgo),
          lte(checkins.date, today),
          isNull(checkins.deletedAt),
          sql`${checkins.totalSleepMinutes} IS NOT NULL`,
        ),
      )
      .all();

    const sleepDaysCount = recentSleepRows.length;
    const avgSleepMinutes =
      sleepDaysCount > 0
        ? Math.round(
            recentSleepRows.reduce(
              (sum, r) => sum + (r.totalSleepMinutes ?? 0),
              0,
            ) / sleepDaysCount,
          )
        : null;

    // 5. Current month income/expense/net from transactions
    const monthTxRows = await db
      .select({
        type: transactions.type,
        amountCents: transactions.amountCents,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, USER_ID),
          gte(transactions.date, monthStart),
          lte(transactions.date, monthEnd),
          isNull(transactions.deletedAt),
        ),
      )
      .all();

    let incomeCents = 0;
    let expenseCents = 0;
    for (const tx of monthTxRows) {
      if (tx.type === "income") {
        incomeCents += tx.amountCents;
      } else {
        expenseCents += tx.amountCents;
      }
    }

    // 6. Active projects
    const activeProjects = await db
      .select()
      .from(projects)
      .where(
        and(
          eq(projects.userId, USER_ID),
          eq(projects.status, "active"),
          isNull(projects.deletedAt),
        ),
      )
      .all();

    // 7. Upcoming deadlines — tasks with date in [today, today+7]
    const upcomingTaskDeadlines = await db
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
          eq(tasks.userId, USER_ID),
          isNull(tasks.deletedAt),
          gte(tasks.date, today),
          lte(tasks.date, weekLater),
        ),
      )
      .orderBy(asc(tasks.date))
      .all();

    // Upcoming deadlines — assignments with due_date in [today, today+7]
    const upcomingAssignmentDeadlines = await db
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
          eq(assignments.userId, USER_ID),
          isNull(assignments.deletedAt),
          gte(assignments.dueDate, today),
          lte(assignments.dueDate, weekLater),
        ),
      )
      .orderBy(asc(assignments.dueDate))
      .all();

    const upcomingDeadlines = [...upcomingTaskDeadlines, ...upcomingAssignmentDeadlines]
      .sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));

    // 8. Overdue client follow-ups
    const overdueFollowups = await db
      .select({
        id: clientFollowups.id,
        clientId: clientFollowups.clientId,
        clientName: clients.name,
        lastContactDate: clientFollowups.lastContactDate,
        nextFollowupDate: clientFollowups.nextFollowupDate,
        notes: clientFollowups.notes,
      })
      .from(clientFollowups)
      .innerJoin(clients, eq(clientFollowups.clientId, clients.id))
      .where(
        and(
          eq(clientFollowups.userId, USER_ID),
          isNull(clientFollowups.deletedAt),
          eq(clientFollowups.status, "pending"),
          lt(clientFollowups.nextFollowupDate, today),
        ),
      )
      .all();

    return c.json({
      date: today,
      tasks: todayTasks,
      habits: todayHabits,
      sleep: {
        yesterday: yesterdaySleep ?? null,
        avgLast7Days: {
          minutes: avgSleepMinutes,
          daysCount: sleepDaysCount,
        },
      },
      finance: {
        month: { start: monthStart, end: monthEnd },
        incomeCents,
        expenseCents,
        netCents: incomeCents - expenseCents,
        transactionCount: monthTxRows.length,
      },
      projects: activeProjects,
      upcomingDeadlines,
      overdueFollowups,
    });
  } catch (err) {
    console.error("GET /dashboard/today error:", err);
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to build dashboard" } },
      500,
    );
  }
});

export default dashboardRouter;
