import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { courses, courseSchedule } from "../db/schema";
import { eq, and, isNull, asc } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const coursesRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Hardcoded user for now (no auth middleware yet)
const USER_ID = "default-user";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const CreateCourseSchema = z
  .object({
    semesterId: z.string().min(1),
    name: z.string().min(1).max(200),
    code: z.string().max(50).nullable().optional(),
    lecturer: z.string().max(200).nullable().optional(),
    room: z.string().max(100).nullable().optional(),
    color: z.string().max(20).nullable().optional(),
  })
  .strict();

const UpdateCourseSchema = CreateCourseSchema.partial().strict();

const CreateScheduleSchema = z
  .object({
    courseId: z.string().min(1),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    room: z.string().max(100).nullable().optional(),
  })
  .strict();

const UpdateScheduleSchema = CreateScheduleSchema.partial().strict();

// ─── Courses CRUD ───────────────────────────────────────────────────────────

// GET /courses — list all courses for user, optional ?semesterId=
coursesRouter.get("/courses", async (c) => {
  const db = c.get("db");
  const semesterId = c.req.query("semesterId");

  const conditions = [eq(courses.userId, USER_ID), isNull(courses.deletedAt)];
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
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(courses)
    .where(
      and(eq(courses.id, id), eq(courses.userId, USER_ID), isNull(courses.deletedAt)),
    )
    .get();

  if (!row) {
    return c.json({ error: "Course not found" }, 404);
  }

  return c.json(row);
});

// POST /courses
coursesRouter.post(
  "/courses",
  zValidator("json", CreateCourseSchema, (result, c) => {
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
      .insert(courses)
      .values({
        id,
        userId: USER_ID,
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
  zValidator("json", UpdateCourseSchema, (result, c) => {
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
      .from(courses)
      .where(
        and(
          eq(courses.id, id),
          eq(courses.userId, USER_ID),
          isNull(courses.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return c.json({ error: "Course not found" }, 404);
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.semesterId !== undefined) fieldsToUpdate.semesterId = data.semesterId;
    if (data.name !== undefined) fieldsToUpdate.name = data.name;
    if (data.code !== undefined) fieldsToUpdate.code = data.code ?? null;
    if (data.lecturer !== undefined) fieldsToUpdate.lecturer = data.lecturer ?? null;
    if (data.room !== undefined) fieldsToUpdate.room = data.room ?? null;
    if (data.color !== undefined) fieldsToUpdate.color = data.color ?? null;

    const updated = await db
      .update(courses)
      .set(fieldsToUpdate)
      .where(eq(courses.id, id))
      .returning()
      .get();

    return c.json(updated);
  },
);

// DELETE /courses/:id (soft delete)
coursesRouter.delete("/courses/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(courses)
    .where(
      and(
        eq(courses.id, id),
        eq(courses.userId, USER_ID),
        isNull(courses.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Course not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  await db.update(courses)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(courses.id, id))
    .run();

  return c.json({ success: true });
});

// ─── Course Schedules CRUD ──────────────────────────────────────────────────

// GET /courses/:courseId/schedules — list schedules for a course
coursesRouter.get("/courses/:courseId/schedules", async (c) => {
  const db = c.get("db");
  const courseId = c.req.param("courseId");

  const rows = await db
    .select()
    .from(courseSchedule)
    .where(
      and(
        eq(courseSchedule.userId, USER_ID),
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
  zValidator("json", CreateScheduleSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const courseId = c.req.param("courseId");
    const data = c.req.valid("json");

    // Ensure courseId in body matches the URL param
    if (data.courseId !== courseId) {
      return c.json(
        { error: "courseId in body must match the URL parameter" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(courseSchedule)
      .values({
        id,
        userId: USER_ID,
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
  zValidator("json", UpdateScheduleSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const scheduleId = c.req.param("scheduleId");
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(courseSchedule)
      .where(
        and(
          eq(courseSchedule.id, scheduleId),
          eq(courseSchedule.userId, USER_ID),
          isNull(courseSchedule.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return c.json({ error: "Schedule not found" }, 404);
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.courseId !== undefined) fieldsToUpdate.courseId = data.courseId;
    if (data.dayOfWeek !== undefined) fieldsToUpdate.dayOfWeek = data.dayOfWeek;
    if (data.startTime !== undefined) fieldsToUpdate.startTime = data.startTime;
    if (data.endTime !== undefined) fieldsToUpdate.endTime = data.endTime;
    if (data.room !== undefined) fieldsToUpdate.room = data.room ?? null;

    const updated = await db
      .update(courseSchedule)
      .set(fieldsToUpdate)
      .where(eq(courseSchedule.id, scheduleId))
      .returning()
      .get();

    return c.json(updated);
  },
);

// DELETE /courses/schedules/:scheduleId (soft delete)
coursesRouter.delete("/courses/schedules/:scheduleId", async (c) => {
  const db = c.get("db");
  const scheduleId = c.req.param("scheduleId");

  const existing = await db
    .select()
    .from(courseSchedule)
    .where(
      and(
        eq(courseSchedule.id, scheduleId),
        eq(courseSchedule.userId, USER_ID),
        isNull(courseSchedule.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Schedule not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  await db.update(courseSchedule)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(courseSchedule.id, scheduleId))
    .run();

  return c.json({ success: true });
});

export default coursesRouter;
