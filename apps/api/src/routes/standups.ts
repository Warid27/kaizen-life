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

const standupsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

const USER_ID = "default-user";

// ══════════════════════════════════════════════════════════════
// TEAM MEMBERS
// ══════════════════════════════════════════════════════════════

// ─── List Team Members ───────────────────────────────────────
standupsRouter.get("/team-members", async (c) => {
  const db = c.get("db");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = TeamMemberFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      400,
    );
  }

  const conditions = [eq(teamMembers.userId, USER_ID), isNull(teamMembers.deletedAt)];

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
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, USER_ID), isNull(teamMembers.deletedAt)),
    )
    .get();

  if (!row) {
    return c.json({ error: "Team member not found" }, 404);
  }

  return c.json(row);
});

// ─── Create Team Member ──────────────────────────────────────
standupsRouter.post("/team-members", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = CreateTeamMemberSchema.safeParse(body);

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
    .insert(teamMembers)
    .values({
      id,
      userId: USER_ID,
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
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateTeamMemberSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, USER_ID), isNull(teamMembers.deletedAt)),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Team member not found" }, 404);
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.name !== undefined) fieldsToUpdate.name = data.name;
  if (data.role !== undefined) fieldsToUpdate.role = data.role ?? null;
  if (data.active !== undefined) fieldsToUpdate.active = data.active;

  const updated = await db
    .update(teamMembers)
    .set(fieldsToUpdate)
    .where(eq(teamMembers.id, id))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Team Member (soft) ───────────────────────────────
standupsRouter.delete("/team-members/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(teamMembers)
    .where(
      and(eq(teamMembers.id, id), eq(teamMembers.userId, USER_ID), isNull(teamMembers.deletedAt)),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Team member not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(teamMembers)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(teamMembers.id, id))
    .run();

  return c.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
// STANDUPS
// ══════════════════════════════════════════════════════════════

// ─── List Standups ───────────────────────────────────────────
standupsRouter.get("/standups", async (c) => {
  const db = c.get("db");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = StandupFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      400,
    );
  }

  const { teamMemberId, projectId, date, dateFrom, dateTo, status } = parsed.data;
  const conditions = [eq(standups.userId, USER_ID), isNull(standups.deletedAt)];

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
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(standups)
    .where(and(eq(standups.id, id), eq(standups.userId, USER_ID), isNull(standups.deletedAt)))
    .get();

  if (!row) {
    return c.json({ error: "Standup not found" }, 404);
  }

  return c.json(row);
});

// ─── Create Standup ──────────────────────────────────────────
standupsRouter.post("/standups", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = CreateStandupSchema.safeParse(body);

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
    .insert(standups)
    .values({
      id,
      userId: USER_ID,
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
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateStandupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await db
    .select()
    .from(standups)
    .where(and(eq(standups.id, id), eq(standups.userId, USER_ID), isNull(standups.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Standup not found" }, 404);
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

  const updated = await db
    .update(standups)
    .set(fieldsToUpdate)
    .where(eq(standups.id, id))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Standup (soft) ───────────────────────────────────
standupsRouter.delete("/standups/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(standups)
    .where(and(eq(standups.id, id), eq(standups.userId, USER_ID), isNull(standups.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Standup not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(standups)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(standups.id, id))
    .run();

  return c.json({ success: true });
});

export default standupsRouter;
