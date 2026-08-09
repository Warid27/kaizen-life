import { Hono } from "hono";
import { eq, and, asc, sql } from "drizzle-orm";
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
} from "../services/habit-recurrence";

const habitsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Temporary: single-user mode (no auth yet)
const DEFAULT_USER_ID = "default-user";

// ─── Helper: today's date as YYYY-MM-DD ─────────────────────────────────────
function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// ─── GET /habits ────────────────────────────────────────────────────────────
// List all habits for the user. Also triggers recurrence engine to ensure
// today's habit_log rows exist for all scheduled active habits.
habitsRouter.get("/habits", async (c) => {
  try {
    const db = c.get("db");
    // Parse optional query filters
    const queryResult = HabitFilterSchema.safeParse(c.req.query());
    const filters = queryResult.success ? queryResult.data : {};

    // Trigger recurrence: ensure today's logs exist
    await ensureTodayLogs(db, DEFAULT_USER_ID, todayStr());

    // Build query conditions
    const conditions = [
      eq(habits.userId, DEFAULT_USER_ID),
      sql`${habits.deletedAt} IS NULL`,
    ];
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

    return c.json({ data: rows });
  } catch (err) {
    console.error("GET /habits error:", err);
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to fetch habits" } },
      500,
    );
  }
});

// ─── POST /habits ───────────────────────────────────────────────────────────
// Create a new habit.
habitsRouter.post("/habits", async (c) => {
  try {
    const db = c.get("db");
    const body = await c.req.json();
    const parsed = CreateHabitSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return c.json(
        {
          error: {
            code: "VALIDATION",
            message: firstError.message,
            field: firstError.path.join("."),
          },
        },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();
    const data = parsed.data;

    const row = await db
      .insert(habits)
      .values({
        id,
        userId: DEFAULT_USER_ID,
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
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to create habit" } },
      500,
    );
  }
});

// ─── GET /habits/:id ────────────────────────────────────────────────────────
habitsRouter.get("/habits/:id", async (c) => {
  try {
    const db = c.get("db");
    const id = c.req.param("id");

    const row = await db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.id, id),
          eq(habits.userId, DEFAULT_USER_ID),
          sql`${habits.deletedAt} IS NULL`,
        ),
      )
      .get();

    if (!row) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Habit not found" } },
        404,
      );
    }

    return c.json({ data: row });
  } catch (err) {
    console.error("GET /habits/:id error:", err);
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to fetch habit" } },
      500,
    );
  }
});

// ─── PATCH /habits/:id ──────────────────────────────────────────────────────
// Update a habit (partial update).
habitsRouter.patch("/habits/:id", async (c) => {
  try {
    const db = c.get("db");
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = UpdateHabitSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return c.json(
        {
          error: {
            code: "VALIDATION",
            message: firstError.message,
            field: firstError.path.join("."),
          },
        },
        400,
      );
    }

    const data = parsed.data;
    if (Object.keys(data).length === 0) {
      return c.json(
        { error: { code: "VALIDATION", message: "No fields to update" } },
        400,
      );
    }

    // Check habit exists
    const existing = await db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.id, id),
          eq(habits.userId, DEFAULT_USER_ID),
          sql`${habits.deletedAt} IS NULL`,
        ),
      )
      .get();

    if (!existing) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Habit not found" } },
        404,
      );
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

    const row = await db
      .update(habits)
      .set(updates)
      .where(eq(habits.id, id))
      .returning()
      .get();

    return c.json({ data: row });
  } catch (err) {
    console.error("PATCH /habits/:id error:", err);
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to update habit" } },
      500,
    );
  }
});

// ─── DELETE /habits/:id ─────────────────────────────────────────────────────
// Soft-delete a habit.
habitsRouter.delete("/habits/:id", async (c) => {
  try {
    const db = c.get("db");
    const id = c.req.param("id");
    const now = Math.floor(Date.now() / 1000);

    const existing = await db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.id, id),
          eq(habits.userId, DEFAULT_USER_ID),
          sql`${habits.deletedAt} IS NULL`,
        ),
      )
      .get();

    if (!existing) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Habit not found" } },
        404,
      );
    }

    await db
      .update(habits)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(habits.id, id))
      .run();

    return c.json({ data: { success: true } });
  } catch (err) {
    console.error("DELETE /habits/:id error:", err);
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to delete habit" } },
      500,
    );
  }
});

// ─── POST /habits/:id/log ───────────────────────────────────────────────────
// Log completion for a habit. Increments completedCount for the given date.
// If no log row exists for the date, creates one.
habitsRouter.post("/habits/:id/log", async (c) => {
  try {
    const db = c.get("db");
    const habitId = c.req.param("id");
    const body = await c.req.json();
    const parsed = LogHabitSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.issues[0];
      return c.json(
        {
          error: {
            code: "VALIDATION",
            message: firstError.message,
            field: firstError.path.join("."),
          },
        },
        400,
      );
    }

    const { date, increment, note } = parsed.data;

    // Verify habit exists and belongs to user
    const habit = await db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.id, habitId),
          eq(habits.userId, DEFAULT_USER_ID),
          sql`${habits.deletedAt} IS NULL`,
        ),
      )
      .get();

    if (!habit) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Habit not found" } },
        404,
      );
    }

    const now = Math.floor(Date.now() / 1000);

    // Check for existing log row on this date
    const existing = await db
      .select()
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.habitId, habitId),
          eq(habitLogs.date, date),
          sql`${habitLogs.deletedAt} IS NULL`,
        ),
      )
      .get();

    let row: typeof habitLogs.$inferSelect;

    if (existing) {
      // Increment completedCount (cap at targetCount)
      const newCount = Math.min(
        existing.completedCount + increment,
        existing.targetCount,
      );

      row = await db
        .update(habitLogs)
        .set({
          completedCount: newCount,
          note: note ?? existing.note,
          updatedAt: now,
        })
        .where(eq(habitLogs.id, existing.id))
        .returning()
        .get();
    } else {
      // Create new log row
      const id = crypto.randomUUID();
      const initialCount = Math.min(increment, habit.targetCountPerPeriod);

      row = await db
        .insert(habitLogs)
        .values({
          id,
          userId: DEFAULT_USER_ID,
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
    }

    return c.json({ data: row });
  } catch (err) {
    console.error("POST /habits/:id/log error:", err);
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to log habit" } },
      500,
    );
  }
});

// ─── GET /habits/:id/stats ──────────────────────────────────────────────────
// Compute streak, completion rate, and totals for a habit.
habitsRouter.get("/habits/:id/stats", async (c) => {
  try {
    const db = c.get("db");
    const habitId = c.req.param("id");

    const stats = await computeHabitStats(db, habitId, DEFAULT_USER_ID);

    if (!stats) {
      return c.json(
        { error: { code: "NOT_FOUND", message: "Habit not found" } },
        404,
      );
    }

    return c.json({ data: stats });
  } catch (err) {
    console.error("GET /habits/:id/stats error:", err);
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to compute habit stats" } },
      500,
    );
  }
});

export default habitsRouter;
