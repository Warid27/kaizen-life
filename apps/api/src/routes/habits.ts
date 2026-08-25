import { Hono } from "hono";
import { eq, and, asc, inArray, isNull } from "drizzle-orm";
import type { Bindings, AppDb } from "../db/client";
import { habits, habitLogs } from "../db/schema";
import {
  CreateHabitSchema,
  UpdateHabitSchema,
  LogHabitSchema,
  HabitFilterSchema,
} from "@kaizenlife/shared";
import {
  ensureTodayLogs,
  computeHabitStats,
  isScheduledOnDate,
} from "../services/habit-recurrence";
import { parseDate } from "../services/habit-recurrence";
import { apiError, notFound } from "../lib/api";
import { getTodayForUser } from "../lib/date";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const habitsRouter = new Hono<RouteEnv>();

/** First Zod issue → unified validation envelope. */
function zodFail(
  c: { json: (body: unknown, status?: number) => Response },
  error: { issues: { message: string; path: (string | number | symbol)[] }[] },
): Response {
  const first = error.issues[0];
  if (!first) return apiError(c as never, 400, "VALIDATION_ERROR", "Validation failed");
  return c.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: first.message,
        details: { field: first.path.join(".") },
      },
    },
    400,
  );
}

// ─── GET /habits ────────────────────────────────────────────────────────────
// List all habits for the user with today's log state joined in (BL5: the UI
// could never show completion because log fields were missing). Recurrence
// materialization is batched (constant query count) and timezone-aware (BL1).
habitsRouter.get("/habits", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");
    const queryResult = HabitFilterSchema.safeParse(c.req.query());
    const filters = queryResult.success ? queryResult.data : {};

    const today = await getTodayForUser(db, userId);
    await ensureTodayLogs(db, userId, today);

    const conditions = [eq(habits.userId, userId), isNull(habits.deletedAt)];
    if (filters.active !== undefined) {
      conditions.push(eq(habits.active, filters.active));
    }
    if (filters.category) {
      conditions.push(eq(habits.category, filters.category));
    }

    const rows = await db
      .select()
      .from(habits)
      .where(and(...conditions))
      .orderBy(asc(habits.sortOrder))
      .all();

    // Join today's logs so clients can render completion without a second
    // request per habit.
    const habitIds = rows.map((h) => h.id);
    const todaysLogs =
      habitIds.length > 0
        ? await db
            .select()
            .from(habitLogs)
            .where(and(eq(habitLogs.date, today), inArray(habitLogs.habitId, habitIds)))
        : [];
    const logByHabitId = new Map(todaysLogs.map((l) => [l.habitId, l]));

    const data = rows.map((habit) => {
      const log = logByHabitId.get(habit.id) ?? null;
      const scheduledToday = isScheduledOnDate(habit, parseDate(today));
      return {
        ...habit,
        scheduledToday,
        completedToday: log != null && log.completedCount >= log.targetCount,
        progress: log ? { completedCount: log.completedCount, targetCount: log.targetCount } : null,
      };
    });

    return c.json({ data });
  } catch (err) {
    console.error("GET /habits error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to fetch habits");
  }
});

// ─── POST /habits ───────────────────────────────────────────────────────────
habitsRouter.post("/habits", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");
    const parsed = CreateHabitSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return zodFail(c, parsed.error);
    }

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const data = parsed.data;

    const row = await db
      .insert(habits)
      .values({
        id,
        userId,
        name: data.name,
        icon: data.icon ?? null,
        category: data.category ?? null,
        frequency: data.frequency ?? "daily",
        targetCountPerPeriod: data.targetCountPerPeriod ?? 1,
        customDays: data.customDays ?? null,
        active: data.active ?? true,
        sortOrder: data.sortOrder ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json({ data: row }, 201);
  } catch (err) {
    console.error("POST /habits error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to create habit");
  }
});

// ─── GET /habits/:id ────────────────────────────────────────────────────────
habitsRouter.get("/habits/:id", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));

    const row = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId), isNull(habits.deletedAt)))
      .get();

    if (!row) {
      return notFound(c, "Habit");
    }

    return c.json({ data: row });
  } catch (err) {
    console.error("GET /habits/:id error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to fetch habit");
  }
});

// ─── PATCH /habits/:id ──────────────────────────────────────────────────────
habitsRouter.patch("/habits/:id", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));
    const parsed = UpdateHabitSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return zodFail(c, parsed.error);
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return apiError(c, 400, "VALIDATION_ERROR", "No fields to update");
    }

    const existing = await db
      .select({ id: habits.id })
      .from(habits)
      .where(and(eq(habits.id, id), eq(habits.userId, userId), isNull(habits.deletedAt)))
      .get();

    if (!existing) {
      return notFound(c, "Habit");
    }

    const now = Math.floor(Date.now() / 1000);
    const updates: Record<string, unknown> = { updatedAt: now };

    if (data.name !== undefined) updates.name = data.name;
    if (data.icon !== undefined) updates.icon = data.icon ?? null;
    if (data.category !== undefined) updates.category = data.category ?? null;
    if (data.frequency !== undefined) updates.frequency = data.frequency;
    if (data.targetCountPerPeriod !== undefined)
      updates.targetCountPerPeriod = data.targetCountPerPeriod;
    if (data.customDays !== undefined) updates.customDays = data.customDays ?? null;
    if (data.active !== undefined) updates.active = data.active;
    if (data.sortOrder !== undefined) updates.sortOrder = data.sortOrder;

    // Guards kept in the write (B5).
    const row = await db
      .update(habits)
      .set(updates)
      .where(and(eq(habits.id, id), eq(habits.userId, userId), isNull(habits.deletedAt)))
      .returning()
      .get();

    return c.json({ data: row });
  } catch (err) {
    console.error("PATCH /habits/:id error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to update habit");
  }
});

// ─── DELETE /habits/:id ─────────────────────────────────────────────────────
habitsRouter.delete("/habits/:id", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));
    const now = Math.floor(Date.now() / 1000);

    const result = await db
      .update(habits)
      .set({ deletedAt: now, updatedAt: now })
      .where(and(eq(habits.id, id), eq(habits.userId, userId), isNull(habits.deletedAt)))
      .returning({ id: habits.id })
      .run();

    if (!result.success || result.meta.changes === 0) {
      return notFound(c, "Habit");
    }

    return c.json({ data: { success: true } });
  } catch (err) {
    console.error("DELETE /habits/:id error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to delete habit");
  }
});

// ─── POST /habits/:id/log ───────────────────────────────────────────────────
// Increment (+n) or decrement (-n) completion for a date.
// Fixes: cap against the habit's CURRENT target (was frozen log snapshot),
// soft-deleted log resurrection instead of UNIQUE-violation 500 (DB3),
// decrement support for undo (BL6).
habitsRouter.post("/habits/:id/log", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");
    const habitId = String(c.req.param("id"));
    const parsed = LogHabitSchema.safeParse(await c.req.json());

    if (!parsed.success) {
      return zodFail(c, parsed.error);
    }

    const { date, increment, note } = parsed.data;

    const habit = await db
      .select()
      .from(habits)
      .where(and(eq(habits.id, habitId), eq(habits.userId, userId), isNull(habits.deletedAt)))
      .get();

    if (!habit) {
      return notFound(c, "Habit");
    }

    const now = Math.floor(Date.now() / 1000);

    // Fetch ANY row for this (habit, date) — including soft-deleted ones —
    // so we can resurrect it rather than collide with the unique index.
    const existing = await db
      .select()
      .from(habitLogs)
      .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.date, date)))
      .get();

    let row: typeof habitLogs.$inferSelect;

    if (existing) {
      const baseTarget = habit.targetCountPerPeriod;
      const rawCount = existing.completedCount + increment;
      // Clamp to [0, current target]; the current target governs the cap,
      // not the frozen per-row snapshot taken when the log was created.
      const newCount = Math.max(0, Math.min(rawCount, baseTarget));

      row = await db
        .update(habitLogs)
        .set({
          completedCount: newCount,
          deletedAt: null,
          note: note ?? existing.note,
          updatedAt: now,
        })
        // Defense-in-depth: re-check ownership on the write itself.
        .where(and(eq(habitLogs.id, existing.id), eq(habitLogs.userId, userId)))
        .returning()
        .get();
    } else if (increment > 0) {
      const initialCount = Math.min(increment, habit.targetCountPerPeriod);
      row = await db
        .insert(habitLogs)
        .values({
          id: crypto.randomUUID(),
          userId,
          habitId,
          date,
          completedCount: initialCount,
          targetCount: habit.targetCountPerPeriod,
          note: note ?? null,
          createdAt: now,
          updatedAt: now,
        })
        .returning()
        .get();
    } else {
      // Decrement with no existing row → nothing to undo; report the empty
      // state explicitly instead of creating a zero row.
      return apiError(c, 404, "NOT_FOUND", `No log entry for ${date} to undo`);
    }

    return c.json({ data: row });
  } catch (err) {
    console.error("POST /habits/:id/log error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to log habit");
  }
});

// ─── DELETE /habits/:id/logs/:date ──────────────────────────────────────────
// Undo a check-in for a specific date (BL6): soft-delete that day's log.
habitsRouter.delete("/habits/:id/logs/:date", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");
    const habitId = String(c.req.param("id"));
    const date = String(c.req.param("date"));
    const now = Math.floor(Date.now() / 1000);

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError(c, 400, "VALIDATION_ERROR", "Date must be YYYY-MM-DD");
    }

    const result = await db
      .update(habitLogs)
      .set({ deletedAt: now, updatedAt: now })
      .where(
        and(
          eq(habitLogs.habitId, habitId),
          eq(habitLogs.userId, userId),
          eq(habitLogs.date, date),
          isNull(habitLogs.deletedAt),
        ),
      )
      .returning({ id: habitLogs.id })
      .run();

    if (!result.success || result.meta.changes === 0) {
      return notFound(c, "Log entry");
    }

    return c.json({ data: { success: true } });
  } catch (err) {
    console.error("DELETE /habits/:id/logs/:date error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to undo check-in");
  }
});

// ─── GET /habits/:id/stats ──────────────────────────────────────────────────
habitsRouter.get("/habits/:id/stats", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");
    const habitId = String(c.req.param("id"));

    const today = await getTodayForUser(db, userId);
    const stats = await computeHabitStats(db, habitId, userId, today);

    if (!stats) {
      return notFound(c, "Habit");
    }

    return c.json({ data: stats });
  } catch (err) {
    console.error("GET /habits/:id/stats error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to compute habit stats");
  }
});

export default habitsRouter;
