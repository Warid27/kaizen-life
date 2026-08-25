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
import { UpdateReviewSchema } from "@kaizenlife/shared";
import { apiError, notFound, validationHook } from "../lib/api";

const reviewsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

/** Parse flexible month identifiers used in paths:
 *  - "2026-08"  → { year: 2026, month: 8 }
 *  - "2026"/"8" pair handled by the two-segment routes below.
 */
function parseYearMonth(raw: string): { year: number; month: number } | null {
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const year = parseInt(m[1]!, 10);
  const month = parseInt(m[2]!, 10);
  if (month < 1 || month > 12) return null;
  return { year, month };
}

function parseYearMonthPair(yearRaw: string, monthRaw: string): { year: number; month: number } | null {
  const year = parseInt(yearRaw, 10);
  const month = parseInt(monthRaw, 10);
  if (isNaN(year) || isNaN(month) || month < 1 || month > 12 || year < 1970 || year > 2200) {
    return null;
  }
  return { year, month };
}

// ---------------------------------------------------------------------------
// GET /reviews — list monthly reviews, optional ?year= filter
// ---------------------------------------------------------------------------
reviewsRouter.get("/reviews", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const yearParam = c.req.query("year");

  const conditions = [eq(monthlyReviews.userId, userId), isNull(monthlyReviews.deletedAt)];
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
// GET /reviews/:yearMonth — accepts "YYYY-MM" (web contract, BL21) —
// previously the web called /api/reviews/2026-08 while only /2026/08 existed,
// so every load 404'd into fabricated demo data.
// ---------------------------------------------------------------------------
reviewsRouter.get("/reviews/:yearMonth", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const parsed = parseYearMonth(String(c.req.param("yearMonth")));
  if (!parsed) {
    return apiError(c, 400, "VALIDATION_ERROR", "Month must be YYYY-MM");
  }

  const row = await db
    .select()
    .from(monthlyReviews)
    .where(
      and(
        eq(monthlyReviews.userId, userId),
        eq(monthlyReviews.year, parsed.year),
        eq(monthlyReviews.month, parsed.month),
        isNull(monthlyReviews.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ data: null }, 200);
  }

  return c.json({ data: row });
});

// GET /reviews/:year/:month — two-segment REST form kept working.
reviewsRouter.get("/reviews/:year/:month", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const parsed = parseYearMonthPair(String(c.req.param("year")), String(c.req.param("month")));
  if (!parsed) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid year or month");
  }

  const row = await db
    .select()
    .from(monthlyReviews)
    .where(
      and(
        eq(monthlyReviews.userId, userId),
        eq(monthlyReviews.year, parsed.year),
        eq(monthlyReviews.month, parsed.month),
        isNull(monthlyReviews.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ data: row ?? null }, 200);
  }

  return c.json({ data: row });
});

// ---------------------------------------------------------------------------
// Shared upsert used by both PUT path shapes.
// ---------------------------------------------------------------------------
async function upsertReview(
  db: AppDb,
  userId: string,
  parsed: { year: number; month: number },
  body: UpdateBody,
): Promise<Response> {
  const now = Math.floor(Date.now() / 1000);

  // Any existing row (including soft-deleted) — resurrect instead of
  // colliding with UNIQUE(user_id, year, month) or losing saves invisibly.
  const existing = await db
    .select({ id: monthlyReviews.id })
    .from(monthlyReviews)
    .where(
      and(
        eq(monthlyReviews.userId, userId),
        eq(monthlyReviews.year, parsed.year),
        eq(monthlyReviews.month, parsed.month),
      ),
    )
    .get();

  if (existing) {
    const updated = await db
      .update(monthlyReviews)
      .set({
        biggestAchievement: body.biggestAchievement ?? null,
        biggestLesson: body.biggestLesson ?? null,
        nextMonthPriorities: body.nextMonthPriorities ?? null,
        autoSummaryJson: body.autoSummaryJson ?? null,
        deletedAt: null,
        updatedAt: now,
      })
      // Defense-in-depth: the write re-checks ownership even though the
      // SELECT above already scoped `existing` by userId.
      .where(
        and(eq(monthlyReviews.id, existing.id), eq(monthlyReviews.userId, userId)),
      )
      .returning()
      .get();
    return Response.json({ data: updated });
  }

  const id = crypto.randomUUID();
  const inserted = await db
    .insert(monthlyReviews)
    .values({
      id,
      userId,
      year: parsed.year,
      month: parsed.month,
      biggestAchievement: body.biggestAchievement ?? null,
      biggestLesson: body.biggestLesson ?? null,
      nextMonthPriorities: body.nextMonthPriorities ?? null,
      autoSummaryJson: body.autoSummaryJson ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return Response.json({ data: inserted }, { status: 201 });
}

type UpdateBody = {
  biggestAchievement?: string | null;
  biggestLesson?: string | null;
  nextMonthPriorities?: string | null;
  autoSummaryJson?: string | null;
};

function extractUpdateBody(raw: unknown): UpdateBody {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v : v == null ? undefined : String(v));
  return {
    biggestAchievement: str(obj.biggestAchievement),
    biggestLesson: str(obj.biggestLesson),
    nextMonthPriorities: str(obj.nextMonthPriorities),
    autoSummaryJson: str(obj.autoSummaryJson),
  };
}

reviewsRouter.put("/reviews/:yearMonth", async (c) => {
  const parsed = parseYearMonth(String(c.req.param("yearMonth")));
  if (!parsed) {
    return apiError(c, 400, "VALIDATION_ERROR", "Month must be YYYY-MM");
  }
  const db = c.get("db");
  const userId = c.get("userId");
  const body = extractUpdateBody(await c.req.json().catch(() => ({})));
  return upsertReview(db, userId, parsed, body);
});

reviewsRouter.put("/reviews/:year/:month", async (c) => {
  const parsed = parseYearMonthPair(String(c.req.param("year")), String(c.req.param("month")));
  if (!parsed) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid year or month");
  }
  const db = c.get("db");
  const userId = c.get("userId");
  const body = extractUpdateBody(await c.req.json().catch(() => ({})));
  return upsertReview(db, userId, parsed, body);
});

// ---------------------------------------------------------------------------
// PATCH /reviews/:id — update by ID (guards restored, B5)
// ---------------------------------------------------------------------------
reviewsRouter.patch(
  "/reviews/:id",
  zValidator("json", UpdateReviewSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    // Strip path-param duplicates — identity comes from the URL.
    const { year: _y, month: _m, ...fields } = body;

    const updated = await db
      .update(monthlyReviews)
      .set({ ...fields, updatedAt: now })
      .where(
        and(
          eq(monthlyReviews.id, id),
          eq(monthlyReviews.userId, userId),
          isNull(monthlyReviews.deletedAt),
        ),
      )
      .returning()
      .get();

    if (!updated) {
      return notFound(c, "Review");
    }

    return c.json(updated);
  },
);

// ---------------------------------------------------------------------------
// DELETE /reviews/:id — soft delete (guards restored, B5)
// ---------------------------------------------------------------------------
reviewsRouter.delete("/reviews/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));
  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .update(monthlyReviews)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(monthlyReviews.id, id),
        eq(monthlyReviews.userId, userId),
        isNull(monthlyReviews.deletedAt),
      ),
    )
    .returning({ id: monthlyReviews.id })
    .run();

  if (!result.success || result.meta.changes === 0) {
    return notFound(c, "Review");
  }

  return c.json({ success: true });
});

// ---------------------------------------------------------------------------
// POST /reviews/generate/:year/:month — auto-draft a review from real data.
// Fixes: per-currency finance totals (BL12), habit rate can no longer exceed
// 100% or count deleted/inactive habits' logs (G6), goals matching widened to
// overlapping months (G7 partial).
// ---------------------------------------------------------------------------
reviewsRouter.post("/reviews/generate/:year/:month", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const parsed = parseYearMonthPair(String(c.req.param("year")), String(c.req.param("month")));
  if (!parsed) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid year or month");
  }
  const { year, month } = parsed;

  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const monthEnd = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const now = Math.floor(Date.now() / 1000);

  // ── 1. Finance summary (per-currency buckets — BL12) ────────────────────
  const txRows = await db
    .select({
      type: transactions.type,
      amountCents: transactions.amountCents,
      currency: transactions.currency,
      category: transactions.category,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
        gte(transactions.date, monthStart),
        lte(transactions.date, monthEnd),
      ),
    )
    .all();

  const financeByCurrency: Record<string, { incomeCents: number; expenseCents: number }> = {};
  for (const tx of txRows) {
    const bucket =
      financeByCurrency[tx.currency] ??
      (financeByCurrency[tx.currency] = { incomeCents: 0, expenseCents: 0 });
    if (tx.type === "income") bucket.incomeCents += tx.amountCents;
    else bucket.expenseCents += tx.amountCents;
  }

  // ── 2. Goals progress — overlap counts (monthly/weekly periods rarely
  // exactly contain a month; G7) ────────────────────────────────────────────
  const monthGoals = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.userId, userId),
        isNull(goals.deletedAt),
        sql`${goals.periodStart} <= ${monthEnd}`,
        sql`${goals.periodEnd} >= ${monthStart}`,
      ),
    )
    .all();

  const goalsCompleted = monthGoals.filter((g) => g.status === "completed").length;

  // ── 3. Habit completion rate — completed DAYS over scheduled capacity,
  // restricted to currently-active habits (G6) ──────────────────────────────
  const activeHabits = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), isNull(habits.deletedAt), eq(habits.active, true)))
    .all();
  const activeHabitIds = new Set(activeHabits.map((h) => h.id));

  const habitLogsThisMonth = await db
    .select({
      habitId: habitLogs.habitId,
      completedCount: habitLogs.completedCount,
      targetCount: habitLogs.targetCount,
    })
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.userId, userId),
        isNull(habitLogs.deletedAt),
        gte(habitLogs.date, monthStart),
        lte(habitLogs.date, monthEnd),
      ),
    )
    .all();

  const completedHabitDays = habitLogsThisMonth.filter(
    (l) => activeHabitIds.has(l.habitId) && l.completedCount >= l.targetCount,
  ).length;
  const totalPossibleHabitDays = activeHabits.length * lastDay;
  const habitCompletionRate =
    totalPossibleHabitDays > 0
      ? Math.min(100, Math.round((completedHabitDays / totalPossibleHabitDays) * 100))
      : 0;

  // ── 4. Sleep average ─────────────────────────────────────────────────────
  const checkinRows = await db
    .select({ totalSleepMinutes: checkins.totalSleepMinutes })
    .from(checkins)
    .where(
      and(
        eq(checkins.userId, userId),
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
        eq(tasks.userId, userId),
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
      byCurrency: financeByCurrency,
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

  // ── Upsert the review (resurrect soft-deleted rows) ─────────────────────
  const existing = await db
    .select({ id: monthlyReviews.id })
    .from(monthlyReviews)
    .where(
      and(
        eq(monthlyReviews.userId, userId),
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
        deletedAt: null,
        updatedAt: now,
      })
      // Defense-in-depth: re-check ownership on the write itself.
      .where(
        and(eq(monthlyReviews.id, existing.id), eq(monthlyReviews.userId, userId)),
      )
      .returning()
      .get();
  } else {
    const id = crypto.randomUUID();
    review = await db
      .insert(monthlyReviews)
      .values({
        id,
        userId,
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
