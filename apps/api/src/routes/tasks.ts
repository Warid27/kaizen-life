import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { tasks, projects, courses } from "../db/schema";
import { CreateTaskSchema, UpdateTaskSchema, TaskFilterSchema } from "@kaizenlife/shared";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";
import { apiError, notFound } from "../lib/api";

const tasksRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

/** Validate that referenced parents exist and belong to the user (BL18). */
async function validateReferences(
  db: AppDb,
  userId: string,
  refs: { projectId?: string | null; courseId?: string | null },
): Promise<{ ok: true } | { ok: false; response: Response }> {
  if (refs.projectId) {
    const parent = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, refs.projectId), eq(projects.userId, userId), isNull(projects.deletedAt)))
      .get();
    if (!parent) {
      return {
        ok: false,
        response: Response.json(
          { error: { code: "VALIDATION_ERROR", message: `Project ${refs.projectId} does not exist` } },
          { status: 400 },
        ),
      };
    }
  }
  if (refs.courseId) {
    const parent = await db
      .select({ id: courses.id })
      .from(courses)
      .where(and(eq(courses.id, refs.courseId), eq(courses.userId, userId), isNull(courses.deletedAt)))
      .get();
    if (!parent) {
      return {
        ok: false,
        response: Response.json(
          { error: { code: "VALIDATION_ERROR", message: `Course ${refs.courseId} does not exist` } },
          { status: 400 },
        ),
      };
    }
  }
  return { ok: true };
}

tasksRouter.get("/tasks", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = TaskFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid query parameters", parsed.error.flatten());
  }

  const { date, dateFrom, dateTo, status, projectId, courseId, priority } = parsed.data;
  const conditions = [eq(tasks.userId, userId), isNull(tasks.deletedAt)];

  if (date) {
    conditions.push(eq(tasks.date, date));
  } else {
    if (dateFrom) conditions.push(gte(tasks.date, dateFrom));
    if (dateTo) conditions.push(lte(tasks.date, dateTo));
  }

  if (status) conditions.push(eq(tasks.status, status));
  if (projectId) conditions.push(eq(tasks.projectId, projectId));
  if (courseId) conditions.push(eq(tasks.courseId, courseId));
  if (priority) conditions.push(eq(tasks.priority, priority));

  const rows = await db
    .select()
    .from(tasks)
    .where(and(...conditions))
    .orderBy(desc(tasks.date), desc(tasks.createdAt))
    .all();

  return c.json(rows);
});

tasksRouter.post("/tasks", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const parsed = CreateTaskSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const data = parsed.data;

  // Referential validation on writes (BL18): dangling projectId/courseId
  // used to create orphan rows that rendered forever.
  const refCheck = await validateReferences(db, userId, {
    projectId: data.projectId ?? null,
    courseId: data.courseId ?? null,
  });
  if (!refCheck.ok) return refCheck.response;

  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  const inserted = await db
    .insert(tasks)
    .values({
      id,
      userId,
      title: data.title,
      description: data.description ?? null,
      date: data.date ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      estimatedDurationMin: data.estimatedDurationMin ?? null,
      priority: data.priority ?? "medium",
      status: data.status ?? "todo",
      completedAt: data.status === "done" ? now : null,
      projectId: data.projectId ?? null,
      courseId: data.courseId ?? null,
      tags: data.tags ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

tasksRouter.get("/tasks/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .get();

  if (!row) {
    return notFound(c, "Task");
  }

  return c.json(row);
});

tasksRouter.patch("/tasks/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));
  const parsed = UpdateTaskSchema.safeParse(await c.req.json());

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .get();

  if (!existing) {
    return notFound(c, "Task");
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const refCheck = await validateReferences(db, userId, {
    projectId: data.projectId ?? null,
    courseId: data.courseId ?? null,
  });
  if (!refCheck.ok) return refCheck.response;

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) fieldsToUpdate.title = data.title;
  if (data.description !== undefined) fieldsToUpdate.description = data.description ?? null;
  if (data.date !== undefined) fieldsToUpdate.date = data.date ?? null;
  if (data.startTime !== undefined) fieldsToUpdate.startTime = data.startTime ?? null;
  if (data.endTime !== undefined) fieldsToUpdate.endTime = data.endTime ?? null;
  if (data.estimatedDurationMin !== undefined)
    fieldsToUpdate.estimatedDurationMin = data.estimatedDurationMin ?? null;
  if (data.priority !== undefined) fieldsToUpdate.priority = data.priority;
  if (data.status !== undefined) {
    fieldsToUpdate.status = data.status;
    // BL15: completedAt must track the status machine — stamp on entering
    // done, clear on leaving it. Previously a todo task kept a stale
    // completedAt forever, corrupting any completed-at metric.
    if (data.status === "done") {
      fieldsToUpdate.completedAt = now; // re-stamp on every completion
    } else {
      fieldsToUpdate.completedAt = null;
    }
  }
  if (data.projectId !== undefined) fieldsToUpdate.projectId = data.projectId ?? null;
  if (data.courseId !== undefined) fieldsToUpdate.courseId = data.courseId ?? null;
  if (data.tags !== undefined) fieldsToUpdate.tags = data.tags ?? null;

  // Guards kept in the write itself (B5).
  const updated = await db
    .update(tasks)
    .set(fieldsToUpdate)
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .returning()
    .get();

  return c.json(updated);
});

tasksRouter.delete("/tasks/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const now = Math.floor(Date.now() / 1000);

  const result = await db
    .update(tasks)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId), isNull(tasks.deletedAt)))
    .returning({ id: tasks.id })
    .run();

  if (!result.success || result.meta.changes === 0) {
    return notFound(c, "Task");
  }

  return c.json({ success: true });
});

export default tasksRouter;
