import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Bindings, AppDb } from "../db/client";
import { checkins } from "../db/schema";
import { eq, and, isNull, gte, lte, asc } from "drizzle-orm";
import {
  UpsertCheckinSchema,
  CheckinRangeSchema,
} from "@kaizenlife/shared";

const checkinsRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Hardcoded user for now (no auth middleware yet)
const USER_ID = "default-user";

// ---------------------------------------------------------------------------
// GET /checkins — list check-ins, optional ?from=&to= date range filter
// ---------------------------------------------------------------------------
checkinsRouter.get(
  "/checkins",
  zValidator("query", CheckinRangeSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid query parameters", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const { from, to } = c.req.valid("query");

    const conditions = [eq(checkins.userId, USER_ID), isNull(checkins.deletedAt)];
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
// PUT /checkins/:date — upsert a check-in for a specific date
// ---------------------------------------------------------------------------
checkinsRouter.put(
  "/checkins/:date",
  zValidator("json", UpsertCheckinSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid body", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const date = c.req.param("date");

    // Validate the date param matches YYYY-MM-DD
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return c.json({ error: "Date must be YYYY-MM-DD" }, 400);
    }

    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    // Check for existing row
    const existing = await db
      .select()
      .from(checkins)
      .where(and(eq(checkins.userId, USER_ID), eq(checkins.date, date)))
      .get();

    if (existing) {
      const updated = await db
        .update(checkins)
        .set({ ...body, updatedAt: now })
        .where(and(eq(checkins.userId, USER_ID), eq(checkins.date, date)))
        .returning()
        .get();
      return c.json(updated);
    }

    const id = crypto.randomUUID();
    const inserted = await db
      .insert(checkins)
      .values({
        id,
        userId: USER_ID,
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
