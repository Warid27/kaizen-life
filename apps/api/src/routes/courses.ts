import { Hono } from "hono";
import type { Context } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { courses, courseSchedule, semesters } from "../db/schema";
import {
  CreateCourseSchema,
  UpdateCourseSchema,
  CreateScheduleSchema,
  UpdateScheduleSchema,
} from "@kaizenlife/shared";
import { eq, and, isNull, asc } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { apiError, notFound, validationHook } from "../lib/api";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const coursesRouter = new Hono<RouteEnv>();

// BL18: a course may only reference a semester that exists, belongs to the
// requesting user, and has not been soft-deleted.
async function assertSemesterExists(
  c: Context<RouteEnv>,
  db: AppDb,
  userId: string,
  semesterId: string,
): Promise<Response | null> {
  const parent = await db
    .select({ id: semesters.id })
    .from(semesters)
    .where(
      and(
        eq(semesters.id, semesterId),
        eq(semesters.userId, userId),
        isNull(semesters.deletedAt),
      ),
    )
    .get();

  if (!parent) {
    return apiError(
      c,
      400,
      "VALIDATION_ERROR",
      `Semester ${semesterId} does not exist`,
    );
  }
  return null;
}

// ─── Courses CRUD ───────────────────────────────────────────────────────────

// GET /courses — list all courses for user, optional ?semesterId=
coursesRouter.get("/courses", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const semesterId = c.req.query("semesterId");

  const conditions = [eq(courses.userId, userId), isNull(courses.deletedAt)];
  if (semesterId) conditions.push(eq(courses.semesterId, semesterId));

  const rows = await db
    .select()
    .from(courses)
    .where(and(...conditions))
    .orderBy(asc(courses.name))
    .all();

  return c.json(rows);
});

// GET /courses/:id
coursesRouter.get("/courses/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(courses)
    .where(
      and(eq(courses.id, id), eq(courses.userId, userId), isNull(courses.deletedAt)),
    )
    .get();

  if (!row) {
    return notFound(c, "Course");
  }

  return c.json(row);
});

// POST /courses
coursesRouter.post(
  "/courses",
  zValidator("json", CreateCourseSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const data = c.req.valid("json");

    // BL18: dangling semester references used to create orphan courses.
    const refCheck = await assertSemesterExists(c, db, userId, data.semesterId);
    if (refCheck) return refCheck;

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(courses)
      .values({
        id,
        userId,
        semesterId: data.semesterId,
        name: data.name,
        code: data.code ?? null,
        lecturer: data.lecturer ?? null,
        room: data.room ?? null,
        color: data.color ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

// PATCH /courses/:id
coursesRouter.patch(
  "/courses/:id",
  zValidator("json", UpdateCourseSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(courses)
      .where(
        and(
          eq(courses.id, id),
          eq(courses.userId, userId),
          isNull(courses.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return notFound(c, "Course");
    }

    // BL18: validate the target semester when the course is being moved.
    if (data.semesterId !== undefined) {
      const refCheck = await assertSemesterExists(c, db, userId, data.semesterId);
      if (refCheck) return refCheck;
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.semesterId !== undefined) fieldsToUpdate.semesterId = data.semesterId;
    if (data.name !== undefined) fieldsToUpdate.name = data.name;
    if (data.code !== undefined) fieldsToUpdate.code = data.code ?? null;
    if (data.lecturer !== undefined) fieldsToUpdate.lecturer = data.lecturer ?? null;
    if (data.room !== undefined) fieldsToUpdate.room = data.room ?? null;
    if (data.color !== undefined) fieldsToUpdate.color = data.color ?? null;

    // B5: keep ownership + soft-delete guards on the UPDATE itself.
    const updated = await db
      .update(courses)
      .set(fieldsToUpdate)
      .where(
        and(
          eq(courses.id, id),
          eq(courses.userId, userId),
          isNull(courses.deletedAt),
        ),
      )
      .returning()
      .get();

    return c.json(updated);
  },
);

// DELETE /courses/:id (soft delete)
coursesRouter.delete("/courses/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const existing = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.id, id),
        eq(courses.userId, userId),
        isNull(courses.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return notFound(c, "Course");
  }

  const now = Math.floor(Date.now() / 1000);
  // B5: guard the DELETE as well as the preceding SELECT.
  await db.update(courses)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(courses.id, id),
        eq(courses.userId, userId),
        isNull(courses.deletedAt),
      ),
    )
    .run();

  return c.json({ success: true });
});

// ─── Course Schedules CRUD ──────────────────────────────────────────────────

// GET /courses/:courseId/schedules — list schedules for a course
coursesRouter.get("/courses/:courseId/schedules", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const courseId = String(c.req.param("courseId"));

  const rows = await db
    .select()
    .from(courseSchedule)
    .where(
      and(
        eq(courseSchedule.userId, userId),
        eq(courseSchedule.courseId, courseId),
        isNull(courseSchedule.deletedAt),
      ),
    )
    .orderBy(asc(courseSchedule.dayOfWeek))
    .all();

  return c.json(rows);
});

// POST /courses/:courseId/schedules
coursesRouter.post(
  "/courses/:courseId/schedules",
  zValidator("json", CreateScheduleSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const courseId = String(c.req.param("courseId"));
    const data = c.req.valid("json");

    // Ensure courseId in body matches the URL param
    if (data.courseId !== courseId) {
      return apiError(
        c,
        400,
        "VALIDATION_ERROR",
        "courseId in body must match the URL parameter",
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(courseSchedule)
      .values({
        id,
        userId,
        courseId,
        dayOfWeek: data.dayOfWeek,
        startTime: data.startTime,
        endTime: data.endTime,
        room: data.room ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

// PATCH /courses/schedules/:scheduleId
coursesRouter.patch(
  "/courses/schedules/:scheduleId",
  zValidator("json", UpdateScheduleSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const scheduleId = String(c.req.param("scheduleId"));
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(courseSchedule)
      .where(
        and(
          eq(courseSchedule.id, scheduleId),
          eq(courseSchedule.userId, userId),
          isNull(courseSchedule.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return notFound(c, "Schedule");
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.courseId !== undefined) fieldsToUpdate.courseId = data.courseId;
    if (data.dayOfWeek !== undefined) fieldsToUpdate.dayOfWeek = data.dayOfWeek;
    if (data.startTime !== undefined) fieldsToUpdate.startTime = data.startTime;
    if (data.endTime !== undefined) fieldsToUpdate.endTime = data.endTime;
    if (data.room !== undefined) fieldsToUpdate.room = data.room ?? null;

    // B5: keep ownership + soft-delete guards on the UPDATE itself.
    const updated = await db
      .update(courseSchedule)
      .set(fieldsToUpdate)
      .where(
        and(
          eq(courseSchedule.id, scheduleId),
          eq(courseSchedule.userId, userId),
          isNull(courseSchedule.deletedAt),
        ),
      )
      .returning()
      .get();

    return c.json(updated);
  },
);

// DELETE /courses/schedules/:scheduleId (soft delete)
coursesRouter.delete("/courses/schedules/:scheduleId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const scheduleId = String(c.req.param("scheduleId"));

  const existing = await db
    .select()
    .from(courseSchedule)
    .where(
      and(
        eq(courseSchedule.id, scheduleId),
        eq(courseSchedule.userId, userId),
        isNull(courseSchedule.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return notFound(c, "Schedule");
  }

  const now = Math.floor(Date.now() / 1000);
  // B5: guard the DELETE as well as the preceding SELECT.
  await db.update(courseSchedule)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(courseSchedule.id, scheduleId),
        eq(courseSchedule.userId, userId),
        isNull(courseSchedule.deletedAt),
      ),
    )
    .run();

  return c.json({ success: true });
});

export default coursesRouter;
