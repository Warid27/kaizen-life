import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Bindings, AppDb } from "../db/client";
import { goals } from "../db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import {
  CreateGoalSchema,
  UpdateGoalSchema,
  GoalQuerySchema,
} from "@kaizenlife/shared";
import { apiError, notFound, validationHook } from "../lib/api";

const goalsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// ---------------------------------------------------------------------------
// GET /goals — list goals with optional filters
// ---------------------------------------------------------------------------
goalsRouter.get(
  "/goals",
  zValidator("query", GoalQuerySchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const { type, status, parentGoalId } = c.req.valid("query");

    const conditions = [
      eq(goals.userId, userId),
      isNull(goals.deletedAt),
    ];
    if (type) conditions.push(eq(goals.type, type));
    if (status) conditions.push(eq(goals.status, status));
    if (parentGoalId) conditions.push(eq(goals.parentGoalId, parentGoalId));

    const rows = await db
      .select()
      .from(goals)
      .where(and(...conditions))
      .orderBy(asc(goals.createdAt))
      .all();

    return c.json(rows);
  },
);

// ---------------------------------------------------------------------------
// GET /goals/:id — get single goal with children
// ---------------------------------------------------------------------------
goalsRouter.get("/goals/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.id, id),
        eq(goals.userId, userId),
        isNull(goals.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return notFound(c, "Goal");
  }

  // Fetch child goals
  const children = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.parentGoalId, id),
        eq(goals.userId, userId),
        isNull(goals.deletedAt),
      ),
    )
    .orderBy(asc(goals.createdAt))
    .all();

  return c.json({ ...row, children });
});

// ---------------------------------------------------------------------------
// POST /goals — create a new goal
// ---------------------------------------------------------------------------
goalsRouter.post(
  "/goals",
  zValidator("json", CreateGoalSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    // Validate parentGoalId exists if provided
    if (body.parentGoalId) {
      const parent = await db
        .select({ id: goals.id })
        .from(goals)
        .where(
          and(
            eq(goals.id, body.parentGoalId),
            eq(goals.userId, userId),
            isNull(goals.deletedAt),
          ),
        )
        .get();

      if (!parent) {
        return notFound(c, "Parent goal");
      }
    }

    const inserted = await db
      .insert(goals)
      .values({
        id,
        userId,
        ...body,
        status: body.status ?? "not_started",
        currentValue: body.currentValue ?? 0,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

// ---------------------------------------------------------------------------
// PATCH /goals/:id — update a goal
// NOTE (BL17): status is never mutated implicitly here — a client-sent status
// is applied as-is, but progress/currentValue updates do NOT resurrect an
// abandoned goal to in_progress server-side.
// ---------------------------------------------------------------------------
goalsRouter.patch(
  "/goals/:id",
  zValidator("json", UpdateGoalSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    // Verify ownership
    const existing = await db
      .select({ id: goals.id })
      .from(goals)
      .where(
        and(
          eq(goals.id, id),
          eq(goals.userId, userId),
          isNull(goals.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return notFound(c, "Goal");
    }

    // Validate parentGoalId exists if being changed and is not self
    if (body.parentGoalId && body.parentGoalId !== id) {
      const parent = await db
        .select({ id: goals.id })
        .from(goals)
        .where(
          and(
            eq(goals.id, body.parentGoalId),
            eq(goals.userId, userId),
            isNull(goals.deletedAt),
          ),
        )
        .get();

      if (!parent) {
        return notFound(c, "Parent goal");
      }
    }

    // Guards kept in the write itself (B5).
    const updated = await db
      .update(goals)
      .set({ ...body, updatedAt: now })
      .where(and(eq(goals.id, id), eq(goals.userId, userId), isNull(goals.deletedAt)))
      .returning()
      .get();

    return c.json(updated);
  },
);

// ---------------------------------------------------------------------------
// DELETE /goals/:id — soft delete a goal
// ---------------------------------------------------------------------------
goalsRouter.delete("/goals/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .select({ id: goals.id })
    .from(goals)
    .where(
      and(
        eq(goals.id, id),
        eq(goals.userId, userId),
        isNull(goals.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return notFound(c, "Goal");
  }

  // Unlink live children (set parentGoalId to null) — guarded by user + soft-delete state
  await db.update(goals)
    .set({ parentGoalId: null, updatedAt: now })
    .where(and(eq(goals.parentGoalId, id), eq(goals.userId, userId), isNull(goals.deletedAt)))
    .run();

  await db.update(goals)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(goals.id, id), eq(goals.userId, userId), isNull(goals.deletedAt)))
    .run();

  return c.json({ success: true });
});

export default goalsRouter;
