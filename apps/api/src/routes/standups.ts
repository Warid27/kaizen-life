import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { standups, teamMembers } from "../db/schema";
import {
  CreateStandupSchema,
  UpdateStandupSchema,
  StandupFilterSchema,
  CreateTeamMemberSchema,
  UpdateTeamMemberSchema,
  TeamMemberFilterSchema,
} from "@kaizenlife/shared";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";
import { apiError, notFound } from "../lib/api";

const standupsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// ══════════════════════════════════════════════════════════════
// TEAM MEMBERS
// ══════════════════════════════════════════════════════════════

// ─── List Team Members ───────────────────────────────────────
standupsRouter.get("/team-members", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = TeamMemberFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid query parameters", parsed.error.flatten());
  }

  const conditions = [eq(teamMembers.userId, userId), isNull(teamMembers.deletedAt)];

  if (parsed.data.active !== undefined) {
    conditions.push(eq(teamMembers.active, parsed.data.active));
  }

  const rows = await db
    .select()
    .from(teamMembers)
    .where(and(...conditions))
    .orderBy(desc(teamMembers.createdAt))
    .all();

  return c.json(rows);
});

// ─── Get Team Member by ID ───────────────────────────────────
standupsRouter.get("/team-members/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, userId), isNull(teamMembers.deletedAt)),
    )
    .get();

  if (!row) {
    return notFound(c, "Team member");
  }

  return c.json(row);
});

// ─── Create Team Member ──────────────────────────────────────
standupsRouter.post("/team-members", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = CreateTeamMemberSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  const inserted = await db
    .insert(teamMembers)
    .values({
      id,
      userId,
      name: data.name,
      role: data.role ?? null,
      active: data.active ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

// ─── Update Team Member ──────────────────────────────────────
standupsRouter.patch("/team-members/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));
  const body = await c.req.json();
  const parsed = UpdateTeamMemberSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const existing = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, userId), isNull(teamMembers.deletedAt)),
    )
    .get();

  if (!existing) {
    return notFound(c, "Team member");
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.name !== undefined) fieldsToUpdate.name = data.name;
  if (data.role !== undefined) fieldsToUpdate.role = data.role ?? null;
  if (data.active !== undefined) fieldsToUpdate.active = data.active;

  // Guards kept in the write itself (B5).
  const updated = await db
    .update(teamMembers)
    .set(fieldsToUpdate)
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, userId), isNull(teamMembers.deletedAt)),
    )
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Team Member (soft) ───────────────────────────────
standupsRouter.delete("/team-members/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const existing = await db
    .select({ id: teamMembers.id })
    .from(teamMembers)
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, userId), isNull(teamMembers.deletedAt)),
    )
    .get();

  if (!existing) {
    return notFound(c, "Team member");
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(teamMembers)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, userId), isNull(teamMembers.deletedAt)),
    )
    .run();

  return c.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
// STANDUPS
// ══════════════════════════════════════════════════════════════

// ─── List Standups ───────────────────────────────────────────
standupsRouter.get("/standups", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = StandupFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid query parameters", parsed.error.flatten());
  }

  const { teamMemberId, projectId, date, dateFrom, dateTo, status } = parsed.data;
  const conditions = [eq(standups.userId, userId), isNull(standups.deletedAt)];

  if (teamMemberId) conditions.push(eq(standups.teamMemberId, teamMemberId));
  if (projectId) conditions.push(eq(standups.projectId, projectId));
  if (date) {
    conditions.push(eq(standups.date, date));
  } else {
    if (dateFrom) conditions.push(gte(standups.date, dateFrom));
    if (dateTo) conditions.push(lte(standups.date, dateTo));
  }
  if (status) conditions.push(eq(standups.status, status));

  const rows = await db
    .select()
    .from(standups)
    .where(and(...conditions))
    .orderBy(desc(standups.date), desc(standups.createdAt))
    .all();

  return c.json(rows);
});

// ─── Get Standup by ID ───────────────────────────────────────
standupsRouter.get("/standups/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(standups)
    .where(and(eq(standups.id, id), eq(standups.userId, userId), isNull(standups.deletedAt)))
    .get();

  if (!row) {
    return notFound(c, "Standup");
  }

  return c.json(row);
});

// ─── Create Standup ──────────────────────────────────────────
standupsRouter.post("/standups", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = CreateStandupSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  const inserted = await db
    .insert(standups)
    .values({
      id,
      userId,
      teamMemberId: data.teamMemberId,
      projectId: data.projectId ?? null,
      date: data.date,
      currentTask: data.currentTask ?? null,
      todayTarget: data.todayTarget ?? null,
      actualResult: data.actualResult ?? null,
      blocker: data.blocker ?? null,
      status: data.status ?? "on_track",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

// ─── Update Standup ──────────────────────────────────────────
standupsRouter.patch("/standups/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));
  const body = await c.req.json();
  const parsed = UpdateStandupSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const existing = await db
    .select({ id: standups.id })
    .from(standups)
    .where(and(eq(standups.id, id), eq(standups.userId, userId), isNull(standups.deletedAt)))
    .get();

  if (!existing) {
    return notFound(c, "Standup");
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.teamMemberId !== undefined) fieldsToUpdate.teamMemberId = data.teamMemberId;
  if (data.projectId !== undefined) fieldsToUpdate.projectId = data.projectId ?? null;
  if (data.date !== undefined) fieldsToUpdate.date = data.date;
  if (data.currentTask !== undefined) fieldsToUpdate.currentTask = data.currentTask ?? null;
  if (data.todayTarget !== undefined) fieldsToUpdate.todayTarget = data.todayTarget ?? null;
  if (data.actualResult !== undefined) fieldsToUpdate.actualResult = data.actualResult ?? null;
  if (data.blocker !== undefined) fieldsToUpdate.blocker = data.blocker ?? null;
  if (data.status !== undefined) fieldsToUpdate.status = data.status;

  // Guards kept in the write itself (B5).
  const updated = await db
    .update(standups)
    .set(fieldsToUpdate)
    .where(and(eq(standups.id, id), eq(standups.userId, userId), isNull(standups.deletedAt)))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Standup (soft) ───────────────────────────────────
standupsRouter.delete("/standups/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const existing = await db
    .select({ id: standups.id })
    .from(standups)
    .where(and(eq(standups.id, id), eq(standups.userId, userId), isNull(standups.deletedAt)))
    .get();

  if (!existing) {
    return notFound(c, "Standup");
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(standups)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(standups.id, id), eq(standups.userId, userId), isNull(standups.deletedAt)))
    .run();

  return c.json({ success: true });
});

export default standupsRouter;
