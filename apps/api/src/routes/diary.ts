import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Bindings, AppDb } from "../db/client";
import { diaryEntries } from "../db/schema";
import { eq, and, isNull, gte, lte, asc } from "drizzle-orm";
import {
  UpsertDiaryEntrySchema,
  DiaryRangeSchema,
} from "@kaizenlife/shared";
import { apiError, validationHook } from "../lib/api";

const diaryRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// ---------------------------------------------------------------------------
// GET /diary — list diary entries, optional ?from=&to= date range filter
// ---------------------------------------------------------------------------
diaryRouter.get(
  "/diary",
  zValidator("query", DiaryRangeSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const { from, to } = c.req.valid("query");

    const conditions = [eq(diaryEntries.userId, userId), isNull(diaryEntries.deletedAt)];
    if (from) conditions.push(gte(diaryEntries.date, from));
    if (to) conditions.push(lte(diaryEntries.date, to));

    const rows = await db
      .select()
      .from(diaryEntries)
      .where(and(...conditions))
      .orderBy(asc(diaryEntries.date))
      .all();

    return c.json(rows);
  },
);

// ---------------------------------------------------------------------------
// PUT /diary/:date — upsert a diary entry for a specific date.
// Resurrects soft-deleted rows (G1): the previous code updated an invisible
// soft-deleted row without clearing deletedAt, so saves silently vanished.
// ---------------------------------------------------------------------------
diaryRouter.put(
  "/diary/:date",
  zValidator("json", UpsertDiaryEntrySchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const date = String(c.req.param("date"));

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return apiError(c, 400, "VALIDATION_ERROR", "Date must be YYYY-MM-DD");
    }

    const body = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);

    // Look for ANY row for this date — including soft-deleted ones — so the
    // unique index can never collide and saves always land visibly.
    const existing = await db
      .select({ id: diaryEntries.id })
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date)))
      .get();

    if (existing) {
      const updated = await db
        .update(diaryEntries)
        .set({ ...body, deletedAt: null, updatedAt: now })
        .where(and(eq(diaryEntries.userId, userId), eq(diaryEntries.date, date)))
        .returning()
        .get();
      return c.json(updated);
    }

    const id = crypto.randomUUID();
    const inserted = await db
      .insert(diaryEntries)
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

export default diaryRouter;
