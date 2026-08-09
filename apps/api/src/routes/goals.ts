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

const goalsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Hardcoded user for now (no auth middleware yet)
const USER_ID = "default-user";

// ---------------------------------------------------------------------------
// GET /goals — list goals with optional filters
// ---------------------------------------------------------------------------
goalsRouter.get(
  "/goals",
  zValidator("query", GoalQuerySchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid query parameters", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const { type, status, parentGoalId } = c.req.valid("query");

    const conditions = [
      eq(goals.userId, USER_ID),
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
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.id, id),
        eq(goals.userId, USER_ID),
        isNull(goals.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ error: "Goal not found" }, 404);
  }

  // Fetch child goals
  const children = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.parentGoalId, id),
        eq(goals.userId, USER_ID),
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
  zValidator("json", CreateGoalSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    // Validate parentGoalId exists if provided
    if (body.parentGoalId) {
      const parent = await db
        .select()
        .from(goals)
        .where(
          and(
            eq(goals.id, body.parentGoalId),
            eq(goals.userId, USER_ID),
            isNull(goals.deletedAt),
          ),
        )
        .get();

      if (!parent) {
        return c.json({ error: "Parent goal not found" }, 404);
      }
    }

    const inserted = await db
      .insert(goals)
      .values({
        id,
        userId: USER_ID,
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
// ---------------------------------------------------------------------------
goalsRouter.patch(
  "/goals/:id",
  zValidator("json", UpdateGoalSchema, (result, c) => {
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

    // Verify ownership
    const existing = await db
      .select()
      .from(goals)
      .where(
        and(
          eq(goals.id, id),
          eq(goals.userId, USER_ID),
          isNull(goals.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return c.json({ error: "Goal not found" }, 404);
    }

    // Validate parentGoalId exists if being changed and is not self
    if (body.parentGoalId && body.parentGoalId !== id) {
      const parent = await db
        .select()
        .from(goals)
        .where(
          and(
            eq(goals.id, body.parentGoalId),
            eq(goals.userId, USER_ID),
            isNull(goals.deletedAt),
          ),
        )
        .get();

      if (!parent) {
        return c.json({ error: "Parent goal not found" }, 404);
      }
    }

    const updated = await db
      .update(goals)
      .set({ ...body, updatedAt: now })
      .where(and(eq(goals.id, id), eq(goals.userId, USER_ID)))
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
  const id = c.req.param("id");
  const now = Math.floor(Date.now() / 1000);

  const existing = await db
    .select()
    .from(goals)
    .where(
      and(
        eq(goals.id, id),
        eq(goals.userId, USER_ID),
        isNull(goals.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Goal not found" }, 404);
  }

  // Unlink children (set parentGoalId to null)
  await db.update(goals)
    .set({ parentGoalId: null, updatedAt: now })
    .where(and(eq(goals.parentGoalId, id), eq(goals.userId, USER_ID)))
    .run();

  await db.update(goals)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(goals.id, id), eq(goals.userId, USER_ID)))
    .run();

  return c.json({ success: true });
});

export default goalsRouter;
