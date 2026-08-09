import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { projects } from "../db/schema";
import {
  CreateProjectSchema,
  UpdateProjectSchema,
  ProjectFilterSchema,
} from "@kaizenlife/shared";
import { eq, and, isNull, desc } from "drizzle-orm";

const projectsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

const USER_ID = "default-user";

// ─── List Projects ───────────────────────────────────────────
projectsRouter.get("/projects", async (c) => {
  const db = c.get("db");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = ProjectFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      400,
    );
  }

  const { status, priority, clientId } = parsed.data;
  const conditions = [eq(projects.userId, USER_ID), isNull(projects.deletedAt)];

  if (status) conditions.push(eq(projects.status, status));
  if (priority) conditions.push(eq(projects.priority, priority));
  if (clientId) conditions.push(eq(projects.clientId, clientId));

  const rows = await db
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.createdAt))
    .all();

  return c.json(rows);
});

// ─── Get Project by ID ───────────────────────────────────────
projectsRouter.get("/projects/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, USER_ID), isNull(projects.deletedAt)))
    .get();

  if (!row) {
    return c.json({ error: "Project not found" }, 404);
  }

  return c.json(row);
});

// ─── Create Project ──────────────────────────────────────────
projectsRouter.post("/projects", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = CreateProjectSchema.safeParse(body);

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
    .insert(projects)
    .values({
      id,
      userId: USER_ID,
      name: data.name,
      clientId: data.clientId ?? null,
      status: data.status ?? "planning",
      priority: data.priority ?? "medium",
      deadline: data.deadline ?? null,
      progressPct: data.progressPct ?? 0,
      pic: data.pic ?? null,
      description: data.description ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

// ─── Update Project ──────────────────────────────────────────
projectsRouter.patch("/projects/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateProjectSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, USER_ID), isNull(projects.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.name !== undefined) fieldsToUpdate.name = data.name;
  if (data.clientId !== undefined) fieldsToUpdate.clientId = data.clientId ?? null;
  if (data.status !== undefined) fieldsToUpdate.status = data.status;
  if (data.priority !== undefined) fieldsToUpdate.priority = data.priority;
  if (data.deadline !== undefined) fieldsToUpdate.deadline = data.deadline ?? null;
  if (data.progressPct !== undefined) fieldsToUpdate.progressPct = data.progressPct;
  if (data.pic !== undefined) fieldsToUpdate.pic = data.pic ?? null;
  if (data.description !== undefined) fieldsToUpdate.description = data.description ?? null;

  const updated = await db
    .update(projects)
    .set(fieldsToUpdate)
    .where(eq(projects.id, id))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Project (soft) ───────────────────────────────────
projectsRouter.delete("/projects/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(projects)
    .where(and(eq(projects.id, id), eq(projects.userId, USER_ID), isNull(projects.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Project not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(projects)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(projects.id, id))
    .run();

  return c.json({ success: true });
});

export default projectsRouter;
