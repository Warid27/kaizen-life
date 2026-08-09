import { Hono } from "hono";
import { Bindings, AppDb } from "../db/client";
import { tasks } from "../db/schema";
import { CreateTaskSchema, UpdateTaskSchema, TaskFilterSchema } from "@kaizenlife/shared";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";

const tasksRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

const USER_ID = "default-user";

tasksRouter.get("/tasks", async (c) => {
  const db = c.get("db");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = TaskFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      400,
    );
  }

  const { date, dateFrom, dateTo, status, projectId, courseId, priority } = parsed.data;
  const conditions = [eq(tasks.userId, USER_ID), isNull(tasks.deletedAt)];

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
  const body = await c.req.json();
  const parsed = CreateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  const inserted = await db
    .insert(tasks)
    .values({
      id,
      userId: USER_ID,
      title: data.title,
      description: data.description ?? null,
      date: data.date ?? null,
      startTime: data.startTime ?? null,
      endTime: data.endTime ?? null,
      estimatedDurationMin: data.estimatedDurationMin ?? null,
      priority: data.priority ?? "medium",
      status: data.status ?? "todo",
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
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, USER_ID), isNull(tasks.deletedAt)))
    .get();

  if (!row) {
    return c.json({ error: "Task not found" }, 404);
  }

  return c.json(row);
});

tasksRouter.patch("/tasks/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateTaskSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, USER_ID), isNull(tasks.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.title !== undefined) fieldsToUpdate.title = data.title;
  if (data.description !== undefined) fieldsToUpdate.description = data.description ?? null;
  if (data.date !== undefined) fieldsToUpdate.date = data.date ?? null;
  if (data.startTime !== undefined) fieldsToUpdate.startTime = data.startTime ?? null;
  if (data.endTime !== undefined) fieldsToUpdate.endTime = data.endTime ?? null;
  if (data.estimatedDurationMin !== undefined) fieldsToUpdate.estimatedDurationMin = data.estimatedDurationMin ?? null;
  if (data.priority !== undefined) fieldsToUpdate.priority = data.priority;
  if (data.status !== undefined) {
    fieldsToUpdate.status = data.status;
    if (data.status === "done" && !existing.completedAt) {
      fieldsToUpdate.completedAt = now;
    }
  }
  if (data.projectId !== undefined) fieldsToUpdate.projectId = data.projectId ?? null;
  if (data.courseId !== undefined) fieldsToUpdate.courseId = data.courseId ?? null;
  if (data.tags !== undefined) fieldsToUpdate.tags = data.tags ?? null;

  const updated = await db
    .update(tasks)
    .set(fieldsToUpdate)
    .where(eq(tasks.id, id))
    .returning()
    .get();

  return c.json(updated);
});

tasksRouter.delete("/tasks/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(tasks)
    .where(and(eq(tasks.id, id), eq(tasks.userId, USER_ID), isNull(tasks.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Task not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(tasks)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(tasks.id, id))
    .run();

  return c.json({ success: true });
});

export default tasksRouter;
