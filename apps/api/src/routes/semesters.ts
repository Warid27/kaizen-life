import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { semesters, semesterEvents } from "../db/schema";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

const semestersRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

// Hardcoded user for now (no auth middleware yet)
const USER_ID = "default-user";

// ─── Zod Schemas ────────────────────────────────────────────────────────────

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const CreateSemesterSchema = z
  .object({
    name: z.string().min(1).max(200),
    startDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
    endDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
  })
  .strict();

const UpdateSemesterSchema = CreateSemesterSchema.partial().strict();

const CreateSemesterEventSchema = z
  .object({
    semesterId: z.string().min(1),
    title: z.string().min(1).max(500),
    date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
    type: z.enum(["midterm", "final", "deadline", "other"]),
  })
  .strict();

const UpdateSemesterEventSchema = CreateSemesterEventSchema.partial().strict();

// ─── Semesters CRUD ─────────────────────────────────────────────────────────

// GET /semesters — list all semesters for user
semestersRouter.get("/semesters", async (c) => {
  const db = c.get("db");
  const rows = await db
    .select()
    .from(semesters)
    .where(and(eq(semesters.userId, USER_ID), isNull(semesters.deletedAt)))
    .orderBy(desc(semesters.startDate))
    .all();

  return c.json(rows);
});

// GET /semesters/:id
semestersRouter.get("/semesters/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const row = await db
    .select()
    .from(semesters)
    .where(
      and(
        eq(semesters.id, id),
        eq(semesters.userId, USER_ID),
        isNull(semesters.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return c.json({ error: "Semester not found" }, 404);
  }

  return c.json(row);
});

// POST /semesters
semestersRouter.post(
  "/semesters",
  zValidator("json", CreateSemesterSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const data = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(semesters)
      .values({
        id,
        userId: USER_ID,
        name: data.name,
        startDate: data.startDate,
        endDate: data.endDate,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

// PATCH /semesters/:id
semestersRouter.patch(
  "/semesters/:id",
  zValidator("json", UpdateSemesterSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(semesters)
      .where(
        and(
          eq(semesters.id, id),
          eq(semesters.userId, USER_ID),
          isNull(semesters.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return c.json({ error: "Semester not found" }, 404);
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.name !== undefined) fieldsToUpdate.name = data.name;
    if (data.startDate !== undefined) fieldsToUpdate.startDate = data.startDate;
    if (data.endDate !== undefined) fieldsToUpdate.endDate = data.endDate;

    const updated = await db
      .update(semesters)
      .set(fieldsToUpdate)
      .where(eq(semesters.id, id))
      .returning()
      .get();

    return c.json(updated);
  },
);

// DELETE /semesters/:id (soft delete)
semestersRouter.delete("/semesters/:id", async (c) => {
  const db = c.get("db");
  const id = c.req.param("id");

  const existing = await db
    .select()
    .from(semesters)
    .where(
      and(
        eq(semesters.id, id),
        eq(semesters.userId, USER_ID),
        isNull(semesters.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Semester not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  await db.update(semesters)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(semesters.id, id))
    .run();

  return c.json({ success: true });
});

// ─── Semester Events CRUD ───────────────────────────────────────────────────

// GET /semesters/:semesterId/events — list events for a semester
semestersRouter.get("/semesters/:semesterId/events", async (c) => {
  const db = c.get("db");
  const semesterId = c.req.param("semesterId");

  const rows = await db
    .select()
    .from(semesterEvents)
    .where(
      and(
        eq(semesterEvents.userId, USER_ID),
        eq(semesterEvents.semesterId, semesterId),
        isNull(semesterEvents.deletedAt),
      ),
    )
    .orderBy(asc(semesterEvents.date))
    .all();

  return c.json(rows);
});

// POST /semesters/:semesterId/events
semestersRouter.post(
  "/semesters/:semesterId/events",
  zValidator("json", CreateSemesterEventSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const semesterId = c.req.param("semesterId");
    const data = c.req.valid("json");

    // Ensure semesterId in body matches the URL param
    if (data.semesterId !== semesterId) {
      return c.json(
        { error: "semesterId in body must match the URL parameter" },
        400,
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(semesterEvents)
      .values({
        id,
        userId: USER_ID,
        semesterId,
        title: data.title,
        date: data.date,
        type: data.type,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    return c.json(inserted, 201);
  },
);

// PATCH /semesters/events/:eventId
semestersRouter.patch(
  "/semesters/events/:eventId",
  zValidator("json", UpdateSemesterEventSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Validation failed", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const eventId = c.req.param("eventId");
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(semesterEvents)
      .where(
        and(
          eq(semesterEvents.id, eventId),
          eq(semesterEvents.userId, USER_ID),
          isNull(semesterEvents.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return c.json({ error: "Event not found" }, 404);
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.semesterId !== undefined) fieldsToUpdate.semesterId = data.semesterId;
    if (data.title !== undefined) fieldsToUpdate.title = data.title;
    if (data.date !== undefined) fieldsToUpdate.date = data.date;
    if (data.type !== undefined) fieldsToUpdate.type = data.type;

    const updated = await db
      .update(semesterEvents)
      .set(fieldsToUpdate)
      .where(eq(semesterEvents.id, eventId))
      .returning()
      .get();

    return c.json(updated);
  },
);

// DELETE /semesters/events/:eventId (soft delete)
semestersRouter.delete("/semesters/events/:eventId", async (c) => {
  const db = c.get("db");
  const eventId = c.req.param("eventId");

  const existing = await db
    .select()
    .from(semesterEvents)
    .where(
      and(
        eq(semesterEvents.id, eventId),
        eq(semesterEvents.userId, USER_ID),
        isNull(semesterEvents.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return c.json({ error: "Event not found" }, 404);
  }

  const now = Math.floor(Date.now() / 1000);
  await db.update(semesterEvents)
    .set({ deletedAt: now, updatedAt: now })
    .where(eq(semesterEvents.id, eventId))
    .run();

  return c.json({ success: true });
});

export default semestersRouter;
