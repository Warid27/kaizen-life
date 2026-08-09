import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { meetings, meetingActionItems } from "../db/schema";
import {
  CreateMeetingSchema,
  UpdateMeetingSchema,
  MeetingFilterSchema,
  CreateActionItemSchema,
  UpdateActionItemSchema,
  ActionItemFilterSchema,
} from "@kaizenlife/shared";
import { eq, and, isNull, gte, lte, desc } from "drizzle-orm";

const meetingsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

const USER_ID = "default-user";

// ══════════════════════════════════════════════════════════════
// MEETINGS
// ══════════════════════════════════════════════════════════════

// ─── List Meetings ───────────────────────────────────────────
meetingsRouter.get("/meetings", async (c) => {
  const db = c.get("db");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = MeetingFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      400,
    );
  }

  const { projectId, date, dateFrom, dateTo } = parsed.data;
  const conditions = [eq(meetings.userId, USER_ID), isNull(meetings.deletedAt)];

  if (projectId) conditions.push(eq(meetings.projectId, projectId));
  if (date) {
    conditions.push(eq(meetings.date, date));
  } else {
    if (dateFrom) conditions.push(gte(meetings.date, dateFrom));
    if (dateTo) conditions.push(lte(meetings.date, dateTo));
  }

  const rows = await db
    .select()
    .from(meetings)
    .where(and(...conditions))
    .orderBy(desc(meetings.date), desc(meetings.createdAt))
    .all();

  return c.json(rows);
});

// ─── Get Meeting by ID ───────────────────────────────────────
meetingsRouter.get("/meetings/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.userId, USER_ID), isNull(meetings.deletedAt)))
    .get();

  if (!row) {
    return c.json({ error: "Meeting not found" }, 404);
  }

  return c.json(row);
});

// ─── Create Meeting ──────────────────────────────────────────
meetingsRouter.post("/meetings", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = CreateMeetingSchema.safeParse(body);

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
    .insert(meetings)
    .values({
      id,
      userId: USER_ID,
      projectId: data.projectId ?? null,
      date: data.date,
      agenda: data.agenda ?? null,
      decisions: data.decisions ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

// ─── Update Meeting ──────────────────────────────────────────
meetingsRouter.patch("/meetings/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateMeetingSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.userId, USER_ID), isNull(meetings.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Meeting not found" }, 404);
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.projectId !== undefined) fieldsToUpdate.projectId = data.projectId ?? null;
  if (data.date !== undefined) fieldsToUpdate.date = data.date;
  if (data.agenda !== undefined) fieldsToUpdate.agenda = data.agenda ?? null;
  if (data.decisions !== undefined) fieldsToUpdate.decisions = data.decisions ?? null;

  const updated = await db
    .update(meetings)
    .set(fieldsToUpdate)
    .where(eq(meetings.id, id))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Meeting (soft) ───────────────────────────────────
meetingsRouter.delete("/meetings/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(meetings)
    .where(and(eq(meetings.id, id), eq(meetings.userId, USER_ID), isNull(meetings.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Meeting not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(meetings)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(meetings.id, id))
    .run();

  return c.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
// MEETING ACTION ITEMS
// ══════════════════════════════════════════════════════════════

// ─── List Action Items ───────────────────────────────────────
meetingsRouter.get("/action-items", async (c) => {
  const db = c.get("db");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = ActionItemFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      400,
    );
  }

  const { meetingId, status } = parsed.data;
  const conditions = [
    eq(meetingActionItems.userId, USER_ID),
    isNull(meetingActionItems.deletedAt),
  ];

  if (meetingId) conditions.push(eq(meetingActionItems.meetingId, meetingId));
  if (status) conditions.push(eq(meetingActionItems.status, status));

  const rows = await db
    .select()
    .from(meetingActionItems)
    .where(and(...conditions))
    .orderBy(desc(meetingActionItems.createdAt))
    .all();

  return c.json(rows);
});

// ─── Get Action Item by ID ───────────────────────────────────
meetingsRouter.get("/action-items/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(meetingActionItems)
    .where(
      and(
        eq(meetingActionItems.id, id),
        eq(meetingActionItems.userId, USER_ID),
        isNull(meetingActionItems.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ error: "Action item not found" }, 404);
  }

  return c.json(row);
});

// ─── Create Action Item ──────────────────────────────────────
meetingsRouter.post("/action-items", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = CreateActionItemSchema.safeParse(body);

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
    .insert(meetingActionItems)
    .values({
      id,
      userId: USER_ID,
      meetingId: data.meetingId,
      description: data.description,
      pic: data.pic ?? null,
      deadline: data.deadline ?? null,
      status: data.status ?? "open",
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

// ─── Update Action Item ──────────────────────────────────────
meetingsRouter.patch("/action-items/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateActionItemSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await db
    .select()
    .from(meetingActionItems)
    .where(
      and(
        eq(meetingActionItems.id, id),
        eq(meetingActionItems.userId, USER_ID),
        isNull(meetingActionItems.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Action item not found" }, 404);
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.meetingId !== undefined) fieldsToUpdate.meetingId = data.meetingId;
  if (data.description !== undefined) fieldsToUpdate.description = data.description;
  if (data.pic !== undefined) fieldsToUpdate.pic = data.pic ?? null;
  if (data.deadline !== undefined) fieldsToUpdate.deadline = data.deadline ?? null;
  if (data.status !== undefined) fieldsToUpdate.status = data.status;

  const updated = await db
    .update(meetingActionItems)
    .set(fieldsToUpdate)
    .where(eq(meetingActionItems.id, id))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Action Item (soft) ───────────────────────────────
meetingsRouter.delete("/action-items/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(meetingActionItems)
    .where(
      and(
        eq(meetingActionItems.id, id),
        eq(meetingActionItems.userId, USER_ID),
        isNull(meetingActionItems.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Action item not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(meetingActionItems)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(meetingActionItems.id, id))
    .run();

  return c.json({ success: true });
});

export default meetingsRouter;
