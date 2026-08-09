import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Bindings, AppDb } from "../db/client";
import {
  monthlyReviews,
  transactions,
  goals,
  habitLogs,
  habits,
  checkins,
  tasks,
} from "../db/schema";
import { eq, and, isNull, gte, lte, asc, sql } from "drizzle-orm";
import {
  CreateReviewSchema,
  UpdateReviewSchema,
} from "@kaizenlife/shared";

const reviewsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Hardcoded user for now (no auth middleware yet)
const USER_ID = "default-user";

// ---------------------------------------------------------------------------
// GET /reviews — list monthly reviews, optional ?year= filter
// ---------------------------------------------------------------------------
reviewsRouter.get("/reviews", async (c) => {
  const db = c.get("db");
  const yearParam = c.req.query("year");

  const conditions = [
    eq(monthlyReviews.userId, USER_ID),
    isNull(monthlyReviews.deletedAt),
  ];
  if (yearParam) {
    const y = parseInt(yearParam, 10);
    if (!isNaN(y)) conditions.push(eq(monthlyReviews.year, y));
  }

  const rows = await db
    .select()
    .from(monthlyReviews)
    .where(and(...conditions))
    .orderBy(asc(monthlyReviews.year), asc(monthlyReviews.month))
    .all();

  return c.json(rows);
});

// ---------------------------------------------------------------------------
// GET /reviews/:year/:month — get a specific monthly review
// ---------------------------------------------------------------------------
reviewsRouter.get("/reviews/:year/:month", async (c) => {
  const db = c.get("db");
  const year = parseInt(c.req.param("year"), 10);
  const month = parseInt(c.req.param("month"), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return c.json({ error: "Invalid year or month" }, 400);
  }

  const row = await db
    .select()
    .from(monthlyReviews)
    .where(
      and(
        eq(monthlyReviews.userId, USER_ID),
        eq(monthlyReviews.year, year),
        eq(monthlyReviews.month, month),
        isNull(monthlyReviews.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ error: "Review not found" }, 404);
  }

  return c.json(row);
});

// ---------------------------------------------------------------------------
// PUT /reviews/:year/:month — upsert a monthly review
// ---------------------------------------------------------------------------
reviewsRouter.put(
  "/reviews/:year/:month",
  zValidator("json", CreateReviewSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const year = parseInt(c.req.param("year"), 10);
    const month = parseInt(c.req.param("month"), 10);

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return c.json({ error: "Invalid year or month" }, 400);
    }

    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    // Check for existing row
    const existing = await db
      .select()
      .from(monthlyReviews)
      .where(
        and(
          eq(monthlyReviews.userId, USER_ID),
          eq(monthlyReviews.year, year),
          eq(monthlyReviews.month, month),
        ),
      )
      .get();

    if (existing) {
      const updated = await db
        .update(monthlyReviews)
        .set({
          biggestAchievement: body.biggestAchievement,
          biggestLesson: body.biggestLesson,
          nextMonthPriorities: body.nextMonthPriorities,
          autoSummaryJson: body.autoSummaryJson,
          updatedAt: now,
        })
        .where(
          and(
            eq(monthlyReviews.userId, USER_ID),
            eq(monthlyReviews.year, year),
            eq(monthlyReviews.month, month),
          ),
        )
        .returning()
        .get();
      return c.json(updated);
    }

    const id = crypto.randomUUID();
    const inserted = await db
      .insert(monthlyReviews)
      .values({
        id,
        userId: USER_ID,
        year,
        month,
        biggestAchievement: body.biggestAchievement ?? null,
        biggestLesson: body.biggestLesson ?? null,
        nextMonthPriorities: body.nextMonthPriorities ?? null,
        autoSummaryJson: body.autoSummaryJson ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /reviews/:id — update a monthly review by ID
// ---------------------------------------------------------------------------
reviewsRouter.patch(
  "/reviews/:id",
  zValidator("json", UpdateReviewSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    const existing = await db
      .select()
      .from(monthlyReviews)
      .where(
        and(
          eq(monthlyReviews.id, id),
          eq(monthlyReviews.userId, USER_ID),
          isNull(monthlyReviews.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return c.json({ error: "Review not found" }, 404);
    }

    const updated = await db
      .update(monthlyReviews)
      .set({ ...body, updatedAt: now })
      .where(and(eq(monthlyReviews.id, id), eq(monthlyReviews.userId, USER_ID)))
      .returning()
      .get();

    return c.json(updated);
  },
);

// ---------------------------------------------------------------------------
// DELETE /reviews/:id — soft delete a monthly review
// ---------------------------------------------------------------------------
reviewsRouter.delete("/reviews/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .select()
    .from(monthlyReviews)
    .where(
      and(
        eq(monthlyReviews.id, id),
        eq(monthlyReviews.userId, USER_ID),
        isNull(monthlyReviews.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Review not found" }, 404);
  }

  await db.update(monthlyReviews)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(monthlyReviews.id, id), eq(monthlyReviews.userId, USER_ID)))
    .run();

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /reviews/generate/:year/:month — auto-draft a review from existing data
// ---------------------------------------------------------------------------
reviewsRouter.post("/reviews/generate/:year/:month", async (c) => {
  const db = c.get("db");
  const year = parseInt(c.req.param("year"), 10);
  const month = parseInt(c.req.param("month"), 10);

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return c.json({ error: "Invalid year or month" }, 400);
  }

  const lastDay = new Date(year, month, 0).getDate();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const now = Math.floor(Date.now() / 1000);

  // ── 1. Finance summary ───────────────────────────────────────────────────
  const txRows = await db
    .select({
      type: transactions.type,
      amountCents: transactions.amountCents,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, USER_ID),
        isNull(transactions.deletedAt),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
      ),
    )
    .all();

  let incomeCents = 0;
  let expenseCents = 0;
  for (const tx of txRows) {
    if (tx.type === "income") incomeCents += tx.amountCents;
    else expenseCents += tx.amountCents;
  }

  // ── 2. Goals progress ────────────────────────────────────────────────────
  const monthGoals = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, USER_ID),
        isNull(goals.deletedAt),
        eq(goals.type, "monthly"),
        gte(goals.periodStart, monthStart),
        lte(goals.periodEnd, monthEnd),
      ),
    )
    .all();

  const goalsCompleted = monthGoals.filter((g) => g.status === "completed").length;

  // ── 3. Habit completion rate ─────────────────────────────────────────────
  const activeHabits = await db
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.userId, USER_ID),
        isNull(habits.deletedAt),
        eq(habits.active, true),
      ),
    )
    .all();

  const habitLogsThisMonth = await db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, USER_ID),
        isNull(habitLogs.deletedAt),
        gte(habitLogs.date, monthStart),
        lte(habitLogs.date, monthEnd),
      ),
    )
    .all();

  const totalPossibleHabitDays = activeHabits.length * lastDay;
  const habitCompletionRate =
    totalPossibleHabitDays > 0
      ? Math.round(
          (habitLogsThisMonth.reduce((sum, h) => sum + h.completedCount, 0) /
            totalPossibleHabitDays) *
            100,
        )
      : 0;

  // ── 4. Sleep average ─────────────────────────────────────────────────────
  const checkinRows = await db
    .select({ totalSleepMinutes: checkins.totalSleepMinutes })
    .from(checkins)
    .where(
      and(
        eq(checkins.userId, USER_ID),
        isNull(checkins.deletedAt),
        gte(checkins.date, monthStart),
        lte(checkins.date, monthEnd),
        sql`${checkins.totalSleepMinutes} IS NOT NULL`,
      ),
    )
    .all();

  const avgSleepMinutes =
    checkinRows.length > 0
      ? Math.round(
          checkinRows.reduce((sum, r) => sum + (r.totalSleepMinutes ?? 0), 0) /
            checkinRows.length,
        )
      : null;

  // ── 5. Tasks completed ───────────────────────────────────────────────────
  const tasksCompletedRows = await db
    .select({ id: tasks.id })
    .from(tasks)
    .where(
      and(
        eq(tasks.userId, USER_ID),
        isNull(tasks.deletedAt),
        eq(tasks.status, "done"),
        gte(tasks.date, monthStart),
        lte(tasks.date, monthEnd),
      ),
    )
    .all();
  const tasksCompleted = tasksCompletedRows.length;

  // ── Build auto-summary ────────────────────────────────────────────────────
  const autoSummary = {
    finance: {
      incomeCents,
      expenseCents,
      netCents: incomeCents - expenseCents,
      transactionCount: txRows.length,
    },
    goals: {
      total: monthGoals.length,
      completed: goalsCompleted,
    },
    habits: {
      activeCount: activeHabits.length,
      completionRatePct: habitCompletionRate,
    },
    sleep: {
      avgMinutes: avgSleepMinutes,
      daysTracked: checkinRows.length,
    },
    tasks: {
      completed: tasksCompleted,
    },
    generatedAt: now,
  };

  // ── Upsert the review ────────────────────────────────────────────────────
  const existing = await db
    .select()
    .from(monthlyReviews)
    .where(
      and(
        eq(monthlyReviews.userId, USER_ID),
        eq(monthlyReviews.year, year),
        eq(monthlyReviews.month, month),
      ),
    )
    .get();

  let review;

  if (existing) {
    review = await db
      .update(monthlyReviews)
      .set({
        autoSummaryJson: JSON.stringify(autoSummary),
        updatedAt: now,
      })
      .where(
        and(
          eq(monthlyReviews.userId, USER_ID),
          eq(monthlyReviews.year, year),
          eq(monthlyReviews.month, month),
        ),
      )
      .returning()
      .get();
  } else {
    const id = crypto.randomUUID();
    review = await db
      .insert(monthlyReviews)
      .values({
        id,
        userId: USER_ID,
        year,
        month,
        autoSummaryJson: JSON.stringify(autoSummary),
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();
  }

  return c.json({ review, autoSummary });
});

export default reviewsRouter;
