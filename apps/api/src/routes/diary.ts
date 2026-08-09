import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import type { Bindings, AppDb } from "../db/client";
import { diaryEntries } from "../db/schema";
import { eq, and, isNull, gte, lte, asc } from "drizzle-orm";
import {
  UpsertDiaryEntrySchema,
  DiaryRangeSchema,
} from "@kaizenlife/shared";

const diaryRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Hardcoded user for now (no auth middleware yet)
const USER_ID = "default-user";

// ---------------------------------------------------------------------------
// GET /diary — list diary entries, optional ?from=&to= date range filter
// ---------------------------------------------------------------------------
diaryRouter.get(
  "/diary",
  zValidator("query", DiaryRangeSchema, (result, c) => {
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

    const conditions = [eq(diaryEntries.userId, USER_ID), isNull(diaryEntries.deletedAt)];
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
// PUT /diary/:date — upsert a diary entry for a specific date
// ---------------------------------------------------------------------------
diaryRouter.put(
  "/diary/:date",
  zValidator("json", UpsertDiaryEntrySchema, (result, c) => {
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
      .from(diaryEntries)
      .where(and(eq(diaryEntries.userId, USER_ID), eq(diaryEntries.date, date)))
      .get();

    if (existing) {
      const updated = await db
        .update(diaryEntries)
        .set({ ...body, updatedAt: now })
        .where(and(eq(diaryEntries.userId, USER_ID), eq(diaryEntries.date, date)))
        .returning()
        .get();
      return c.json(updated);
    }

    const id = crypto.randomUUID();
    const inserted = await db
      .insert(diaryEntries)
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

export default diaryRouter;
