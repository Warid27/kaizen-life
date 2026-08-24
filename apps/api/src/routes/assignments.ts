import { Hono } from "hono";
import type { Context } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { assignments, courses } from "../db/schema";
import {
  CreateAssignmentSchema,
  UpdateAssignmentSchema,
} from "@kaizenlife/shared";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { apiError, notFound, validationHook } from "../lib/api";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const assignmentsRouter = new Hono<RouteEnv>();

/** Valid statuses, derived from the drizzle column's enum (single source of truth). */
type AssignmentStatus = (typeof assignments.status.enumValues)[number];

// BL18: an assignment may only reference a course that exists, belongs to the
// requesting user, and has not been soft-deleted.
async function assertCourseExists(
  c: Context<RouteEnv>,
  db: AppDb,
  userId: string,
  courseId: string,
): Promise<Response | null> {
  const parent = await db
    .select({ id: courses.id })
    .from(courses)
    .where(
      and(
        eq(courses.id, courseId),
        eq(courses.userId, userId),
        isNull(courses.deletedAt),
      ),
    )
    .get();

  if (!parent) {
    return apiError(
      c,
      400,
      "VALIDATION_ERROR",
      `Course ${courseId} does not exist`,
    );
  }
  return null;
}

// ─── GET /assignments — list all, optional ?courseId=&status= ────────────────
assignmentsRouter.get("/assignments", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const courseId = c.req.query("courseId");
  const status = c.req.query("status");

  const conditions = [
    eq(assignments.userId, userId),
    isNull(assignments.deletedAt),
  ];
  if (courseId) conditions.push(eq(assignments.courseId, courseId));
  if (status) {
    // Typed against the column enum instead of `status as any`.
    const match = assignments.status.enumValues.find((s) => s === status);
    if (!match) {
      return apiError(
        c,
        400,
        "VALIDATION_ERROR",
        `Invalid status filter "${status}"`,
      );
    }
    conditions.push(eq(assignments.status, match));
  }

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
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.id, id),
        eq(assignments.userId, userId),
        isNull(assignments.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return notFound(c, "Assignment");
  }

  return c.json(row);
});

// ─── POST /assignments ──────────────────────────────────────────────────────
assignmentsRouter.post(
  "/assignments",
  zValidator("json", CreateAssignmentSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const data = c.req.valid("json");

    // BL18: dangling course references used to create orphan assignments.
    const refCheck = await assertCourseExists(c, db, userId, data.courseId);
    if (refCheck) return refCheck;

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(assignments)
      .values({
        id,
        userId,
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
  zValidator("json", UpdateAssignmentSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(assignments)
      .where(
        and(
          eq(assignments.id, id),
          eq(assignments.userId, userId),
          isNull(assignments.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return notFound(c, "Assignment");
    }

    // BL18: validate the target course when the assignment is being moved.
    if (data.courseId !== undefined) {
      const refCheck = await assertCourseExists(c, db, userId, data.courseId);
      if (refCheck) return refCheck;
    }

    // ── BL19: assignment status-transition guards ──────────────────────────
    // The resulting status after this patch.
    const nextStatus: AssignmentStatus = data.status ?? existing.status;

    // "graded" is terminal: no backward moves to not_started/in_progress/submitted.
    if (
      existing.status === "graded" &&
      data.status !== undefined &&
      data.status !== "graded"
    ) {
      return apiError(
        c,
        400,
        "VALIDATION_ERROR",
        "Graded assignments cannot regress to a non-graded status",
      );
    }

    // A grade may only be written when the assignment is or becomes "graded".
    if (data.grade !== undefined && nextStatus !== "graded") {
      return apiError(
        c,
        400,
        "VALIDATION_ERROR",
        'Grade can only be set when the assignment status is "graded"',
      );
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

    // B5: keep ownership + soft-delete guards on the UPDATE itself.
    const updated = await db
      .update(assignments)
      .set(fieldsToUpdate)
      .where(
        and(
          eq(assignments.id, id),
          eq(assignments.userId, userId),
          isNull(assignments.deletedAt),
        ),
      )
      .returning()
      .get();

    return c.json(updated);
  },
);

// ─── DELETE /assignments/:id (soft delete) ──────────────────────────────────
assignmentsRouter.delete("/assignments/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const existing = await db
    .select()
    .from(assignments)
    .where(
      and(
        eq(assignments.id, id),
        eq(assignments.userId, userId),
        isNull(assignments.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return notFound(c, "Assignment");
  }

  const now = Math.floor(Date.now() / 1000);
  // B5: guard the DELETE as well as the preceding SELECT.
  await db.update(assignments)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(assignments.id, id),
        eq(assignments.userId, userId),
        isNull(assignments.deletedAt),
      ),
    )
    .run();

  return c.json({ success: true });
});

export default assignmentsRouter;
