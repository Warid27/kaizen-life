import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { assignments } from "../db/schema";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const assignmentsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Hardcoded user for now (no auth middleware yet)
const USER_ID = "default-user";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const CreateAssignmentSchema = z
  .object({
    courseId: z.string().min(1),
    title: z.string().min(1).max(500),
    description: z.string().max(5000).nullable().optional(),
    dueDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    status: z
      .enum(["not_started", "in_progress", "submitted", "graded"])
      .default("not_started"),
    grade: z.string().max(50).nullable().optional(),
  })
  .strict();

const UpdateAssignmentSchema = CreateAssignmentSchema.partial().strict();

// ─── GET /assignments — list all, optional ?courseId=&status= ────────────────
assignmentsRouter.get("/assignments", async (c) => {
  const db = c.get("db");
  const courseId = c.req.query("courseId");
  const status = c.req.query("status");

  const conditions = [
    eq(assignments.userId, USER_ID),
    isNull(assignments.deletedAt),
  ];
  if (courseId) conditions.push(eq(assignments.courseId, courseId));
  if (status) conditions.push(eq(assignments.status, status as any));

  const rows = await db
    .select()
    .from(assignments)
    .where(and(...conditions))
    .orderBy(asc(assignments.dueDate), desc(assignments.createdAt))
    .all();

  return c.json(rows);
});

// ─── GET /assignments/:id ───────────────────────────────────────────────────
assignmentsRouter.get("/assignments/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.id, id),
        eq(assignments.userId, USER_ID),
        isNull(assignments.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ error: "Assignment not found" }, 404);
  }

  return c.json(row);
});

// ─── POST /assignments ──────────────────────────────────────────────────────
assignmentsRouter.post(
  "/assignments",
  zValidator("json", CreateAssignmentSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const data = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(assignments)
      .values({
        id,
        userId: USER_ID,
        courseId: data.courseId,
        title: data.title,
        description: data.description ?? null,
        dueDate: data.dueDate,
        priority: data.priority ?? "medium",
        status: data.status ?? "not_started",
        grade: data.grade ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

// ─── PATCH /assignments/:id ─────────────────────────────────────────────────
assignmentsRouter.patch(
  "/assignments/:id",
  zValidator("json", UpdateAssignmentSchema, (result, c) => {
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
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.id, id),
          eq(assignments.userId, USER_ID),
          isNull(assignments.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return c.json({ error: "Assignment not found" }, 404);
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.courseId !== undefined) fieldsToUpdate.courseId = data.courseId;
    if (data.title !== undefined) fieldsToUpdate.title = data.title;
    if (data.description !== undefined)
      fieldsToUpdate.description = data.description ?? null;
    if (data.dueDate !== undefined) fieldsToUpdate.dueDate = data.dueDate;
    if (data.priority !== undefined) fieldsToUpdate.priority = data.priority;
    if (data.status !== undefined) fieldsToUpdate.status = data.status;
    if (data.grade !== undefined) fieldsToUpdate.grade = data.grade ?? null;

    const updated = await db
      .update(assignments)
      .set(fieldsToUpdate)
      .where(eq(assignments.id, id))
      .returning()
      .get();

    return c.json(updated);
  },
);

// ─── DELETE /assignments/:id (soft delete) ──────────────────────────────────
assignmentsRouter.delete("/assignments/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.id, id),
        eq(assignments.userId, USER_ID),
        isNull(assignments.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Assignment not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  await db.update(assignments)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(assignments.id, id))
    .run();

  return c.json({ success: true });
});

export default assignmentsRouter;
