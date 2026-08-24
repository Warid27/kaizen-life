import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { clients, clientFollowups } from "../db/schema";
import {
  CreateClientSchema,
  UpdateClientSchema,
  CreateClientFollowupSchema,
  UpdateClientFollowupSchema,
  FollowupFilterSchema,
} from "@kaizenlife/shared";
import { eq, and, isNull, desc } from "drizzle-orm";
import { apiError, notFound } from "../lib/api";

const clientsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// ══════════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════════

// ─── List Clients ────────────────────────────────────────────
clientsRouter.get("/clients", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.userId, userId), isNull(clients.deletedAt)))
    .orderBy(desc(clients.createdAt))
    .all();

  return c.json(rows);
});

// ─── Get Client by ID ────────────────────────────────────────
clientsRouter.get("/clients/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, userId), isNull(clients.deletedAt)))
    .get();

  if (!row) {
    return notFound(c, "Client");
  }

  return c.json(row);
});

// ─── Create Client ───────────────────────────────────────────
clientsRouter.post("/clients", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = CreateClientSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  const inserted = await db
    .insert(clients)
    .values({
      id,
      userId,
      name: data.name,
      company: data.company ?? null,
      contactInfo: data.contactInfo ?? null,
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

// ─── Update Client ───────────────────────────────────────────
clientsRouter.patch("/clients/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));
  const body = await c.req.json();
  const parsed = UpdateClientSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, userId), isNull(clients.deletedAt)))
    .get();

  if (!existing) {
    return notFound(c, "Client");
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.name !== undefined) fieldsToUpdate.name = data.name;
  if (data.company !== undefined) fieldsToUpdate.company = data.company ?? null;
  if (data.contactInfo !== undefined) fieldsToUpdate.contactInfo = data.contactInfo ?? null;
  if (data.notes !== undefined) fieldsToUpdate.notes = data.notes ?? null;

  // Guards kept in the write itself (B5).
  const updated = await db
    .update(clients)
    .set(fieldsToUpdate)
    .where(and(eq(clients.id, id), eq(clients.userId, userId), isNull(clients.deletedAt)))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Client (soft) ────────────────────────────────────
clientsRouter.delete("/clients/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const existing = await db
    .select({ id: clients.id })
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, userId), isNull(clients.deletedAt)))
    .get();

  if (!existing) {
    return notFound(c, "Client");
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(clients)
    .set({ deletedAt: now, updatedAt: now })
    .where(and(eq(clients.id, id), eq(clients.userId, userId), isNull(clients.deletedAt)))
    .run();

  return c.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
// CLIENT FOLLOW-UPS
// ══════════════════════════════════════════════════════════════

// ─── List Follow-ups ─────────────────────────────────────────
clientsRouter.get("/followups", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = FollowupFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid query parameters", parsed.error.flatten());
  }

  const { clientId, status } = parsed.data;
  const conditions = [
    eq(clientFollowups.userId, userId),
    isNull(clientFollowups.deletedAt),
  ];

  if (clientId) conditions.push(eq(clientFollowups.clientId, clientId));
  if (status) conditions.push(eq(clientFollowups.status, status));

  const rows = await db
    .select()
    .from(clientFollowups)
    .where(and(...conditions))
    .orderBy(desc(clientFollowups.createdAt))
    .all();

  return c.json(rows);
});

// ─── Get Follow-up by ID ─────────────────────────────────────
clientsRouter.get("/followups/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(clientFollowups)
    .where(
      and(
        eq(clientFollowups.id, id),
        eq(clientFollowups.userId, userId),
        isNull(clientFollowups.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return notFound(c, "Follow-up");
  }

  return c.json(row);
});

// ─── Create Follow-up ────────────────────────────────────────
clientsRouter.post("/followups", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const body = await c.req.json();
  const parsed = CreateClientFollowupSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();

  const inserted = await db
    .insert(clientFollowups)
    .values({
      id,
      userId,
      clientId: data.clientId,
      lastContactDate: data.lastContactDate ?? null,
      nextFollowupDate: data.nextFollowupDate ?? null,
      status: data.status ?? "pending",
      notes: data.notes ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return c.json(inserted, 201);
});

// ─── Update Follow-up ────────────────────────────────────────
clientsRouter.patch("/followups/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));
  const body = await c.req.json();
  const parsed = UpdateClientFollowupSchema.safeParse(body);

  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Validation failed", parsed.error.flatten());
  }

  const existing = await db
    .select({ id: clientFollowups.id })
    .from(clientFollowups)
    .where(
      and(
        eq(clientFollowups.id, id),
        eq(clientFollowups.userId, userId),
        isNull(clientFollowups.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return notFound(c, "Follow-up");
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.clientId !== undefined) fieldsToUpdate.clientId = data.clientId;
  if (data.lastContactDate !== undefined) fieldsToUpdate.lastContactDate = data.lastContactDate ?? null;
  if (data.nextFollowupDate !== undefined) fieldsToUpdate.nextFollowupDate = data.nextFollowupDate ?? null;
  if (data.status !== undefined) fieldsToUpdate.status = data.status;
  if (data.notes !== undefined) fieldsToUpdate.notes = data.notes ?? null;

  // Guards kept in the write itself (B5).
  const updated = await db
    .update(clientFollowups)
    .set(fieldsToUpdate)
    .where(
      and(
        eq(clientFollowups.id, id),
        eq(clientFollowups.userId, userId),
        isNull(clientFollowups.deletedAt),
      ),
    )
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Follow-up (soft) ─────────────────────────────────
clientsRouter.delete("/followups/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const existing = await db
    .select({ id: clientFollowups.id })
    .from(clientFollowups)
    .where(
      and(
        eq(clientFollowups.id, id),
        eq(clientFollowups.userId, userId),
        isNull(clientFollowups.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return notFound(c, "Follow-up");
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(clientFollowups)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(clientFollowups.id, id),
        eq(clientFollowups.userId, userId),
        isNull(clientFollowups.deletedAt),
      ),
    )
    .run();

  return c.json({ success: true });
});

export default clientsRouter;
