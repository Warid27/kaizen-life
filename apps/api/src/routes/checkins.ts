import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Bindings, AppDb } from "../db/client";
import { checkins } from "../db/schema";
import { eq, and, isNull, gte, lte, asc } from "drizzle-orm";
import {
  UpsertCheckinSchema,
  CheckinRangeSchema,
} from "@kaizenlife/shared";
import { apiError, validationHook } from "../lib/api";

const checkinsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// ---------------------------------------------------------------------------
// GET /checkins — list check-ins, optional ?from=&to= date range filter
// ---------------------------------------------------------------------------
checkinsRouter.get(
  "/checkins",
  zValidator("query", CheckinRangeSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const { from, to } = c.req.valid("query");

    const conditions = [eq(checkins.userId, userId), isNull(checkins.deletedAt)];
    if (from) conditions.push(gte(checkins.date, from));
    if (to) conditions.push(lte(checkins.date, to));

    const rows = await db
      .select()
      .from(checkins)
      .where(and(...conditions))
      .orderBy(asc(checkins.date))
      .all();

    return c.json(rows);
  },
);

// ---------------------------------------------------------------------------
// PUT /checkins/:date — upsert a check-in for a specific date.
// Resurrects soft-deleted rows (G1): the previous code updated an invisible
// soft-deleted row without clearing deletedAt, so saves silently vanished.
// ---------------------------------------------------------------------------
checkinsRouter.put(
  "/checkins/:date",
  zValidator("json", UpsertCheckinSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const date = String(c.req.param("date"));

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError(c, 400, "VALIDATION_ERROR", "Date must be YYYY-MM-DD");
    }

    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    // Look for ANY row for this date — including soft-deleted ones.
    const existing = await db
      .select({ id: checkins.id })
      .from(checkins)
      .where(and(eq(checkins.userId, userId), eq(checkins.date, date)))
      .get();

    if (existing) {
      const updated = await db
        .update(checkins)
        .set({ ...body, deletedAt: null, updatedAt: now })
        .where(and(eq(checkins.userId, userId), eq(checkins.date, date)))
        .returning()
        .get();
      return c.json(updated);
    }

    const id = crypto.randomUUID();
    const inserted = await db
      .insert(checkins)
      .values({
        id,
        userId,
        date,
        ...body,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

export default checkinsRouter;
