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

const clientsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

const USER_ID = "default-user";

// ══════════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════════

// ─── List Clients ────────────────────────────────────────────
clientsRouter.get("/clients", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(clients)
    .where(and(eq(clients.userId, USER_ID), isNull(clients.deletedAt)))
    .orderBy(desc(clients.createdAt))
    .all();

  return c.json(rows);
});

// ─── Get Client by ID ────────────────────────────────────────
clientsRouter.get("/clients/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, USER_ID), isNull(clients.deletedAt)))
    .get();

  if (!row) {
    return c.json({ error: "Client not found" }, 404);
  }

  return c.json(row);
});

// ─── Create Client ───────────────────────────────────────────
clientsRouter.post("/clients", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = CreateClientSchema.safeParse(body);

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
    .insert(clients)
    .values({
      id,
      userId: USER_ID,
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
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateClientSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, USER_ID), isNull(clients.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Client not found" }, 404);
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.name !== undefined) fieldsToUpdate.name = data.name;
  if (data.company !== undefined) fieldsToUpdate.company = data.company ?? null;
  if (data.contactInfo !== undefined) fieldsToUpdate.contactInfo = data.contactInfo ?? null;
  if (data.notes !== undefined) fieldsToUpdate.notes = data.notes ?? null;

  const updated = await db
    .update(clients)
    .set(fieldsToUpdate)
    .where(eq(clients.id, id))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Client (soft) ────────────────────────────────────
clientsRouter.delete("/clients/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(clients)
    .where(and(eq(clients.id, id), eq(clients.userId, USER_ID), isNull(clients.deletedAt)))
    .get();

  if (!existing) {
    return c.json({ error: "Client not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(clients)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(clients.id, id))
    .run();

  return c.json({ success: true });
});

// ══════════════════════════════════════════════════════════════
// CLIENT FOLLOW-UPS
// ══════════════════════════════════════════════════════════════

// ─── List Follow-ups ─────────────────────────────────────────
clientsRouter.get("/followups", async (c) => {
  const db = c.get("db");
  const rawQuery: Record<string, string> = {};
  for (const [k, v] of Object.entries(c.req.query())) {
    if (v !== undefined) rawQuery[k] = v;
  }
  const parsed = FollowupFilterSchema.safeParse(rawQuery);

  if (!parsed.success) {
    return c.json(
      { error: "Invalid query parameters", details: parsed.error.flatten() },
      400,
    );
  }

  const { clientId, status } = parsed.data;
  const conditions = [
    eq(clientFollowups.userId, USER_ID),
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
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(clientFollowups)
    .where(
      and(
        eq(clientFollowups.id, id),
        eq(clientFollowups.userId, USER_ID),
        isNull(clientFollowups.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ error: "Follow-up not found" }, 404);
  }

  return c.json(row);
});

// ─── Create Follow-up ────────────────────────────────────────
clientsRouter.post("/followups", async (c) => {
  const db = c.get("db");
  const body = await c.req.json();
  const parsed = CreateClientFollowupSchema.safeParse(body);

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
    .insert(clientFollowups)
    .values({
      id,
      userId: USER_ID,
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
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateClientFollowupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      400,
    );
  }

  const existing = await db
    .select()
    .from(clientFollowups)
    .where(
      and(
        eq(clientFollowups.id, id),
        eq(clientFollowups.userId, USER_ID),
        isNull(clientFollowups.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Follow-up not found" }, 404);
  }

  const data = parsed.data;
  const now = Math.floor(Date.now() / 1000);

  const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

  if (data.clientId !== undefined) fieldsToUpdate.clientId = data.clientId;
  if (data.lastContactDate !== undefined) fieldsToUpdate.lastContactDate = data.lastContactDate ?? null;
  if (data.nextFollowupDate !== undefined) fieldsToUpdate.nextFollowupDate = data.nextFollowupDate ?? null;
  if (data.status !== undefined) fieldsToUpdate.status = data.status;
  if (data.notes !== undefined) fieldsToUpdate.notes = data.notes ?? null;

  const updated = await db
    .update(clientFollowups)
    .set(fieldsToUpdate)
    .where(eq(clientFollowups.id, id))
    .returning()
    .get();

  return c.json(updated);
});

// ─── Delete Follow-up (soft) ─────────────────────────────────
clientsRouter.delete("/followups/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(clientFollowups)
    .where(
      and(
        eq(clientFollowups.id, id),
        eq(clientFollowups.userId, USER_ID),
        isNull(clientFollowups.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Follow-up not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);

  await db.update(clientFollowups)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(clientFollowups.id, id))
    .run();

  return c.json({ success: true });
});

export default clientsRouter;
