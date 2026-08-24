import { Hono } from "hono";
import type { Context } from "hono";
import type { Bindings, AppDb } from "../db/client";
import { semesters, semesterEvents } from "../db/schema";
import {
  CreateSemesterSchema,
  UpdateSemesterSchema,
  CreateSemesterEventSchema,
  UpdateSemesterEventSchema,
} from "@kaizenlife/shared";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { zValidator } from "@hono/zod-validator";
import { apiError, notFound, validationHook } from "../lib/api";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const semestersRouter = new Hono<RouteEnv>();

// BL18: a semester event may only reference a semester that exists, belongs
// to the requesting user, and has not been soft-deleted.
async function assertSemesterExists(
  c: Context<RouteEnv>,
  db: AppDb,
  userId: string,
  semesterId: string,
): Promise<Response | null> {
  const parent = await db
    .select({ id: semesters.id })
    .from(semesters)
    .where(
      and(
        eq(semesters.id, semesterId),
        eq(semesters.userId, userId),
        isNull(semesters.deletedAt),
      ),
    )
    .get();

  if (!parent) {
    return apiError(
      c,
      400,
      "VALIDATION_ERROR",
      `Semester ${semesterId} does not exist`,
    );
  }
  return null;
}

// ─── Semesters CRUD ─────────────────────────────────────────────────────────

// GET /semesters — list all semesters for user
semestersRouter.get("/semesters", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const rows = await db
    .select()
    .from(semesters)
    .where(and(eq(semesters.userId, userId), isNull(semesters.deletedAt)))
    .orderBy(desc(semesters.startDate))
    .all();

  return c.json(rows);
});

// GET /semesters/:id
semestersRouter.get("/semesters/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const row = await db
    .select()
    .from(semesters)
    .where(
      and(
        eq(semesters.id, id),
        eq(semesters.userId, userId),
        isNull(semesters.deletedAt),
      ),
    )
    .get();

  if (!row) {
    return notFound(c, "Semester");
  }

  return c.json(row);
});

// POST /semesters
semestersRouter.post(
  "/semesters",
  zValidator("json", CreateSemesterSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const data = c.req.valid("json");
    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(semesters)
      .values({
        id,
        userId,
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
  zValidator("json", UpdateSemesterSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const id = String(c.req.param("id"));
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(semesters)
      .where(
        and(
          eq(semesters.id, id),
          eq(semesters.userId, userId),
          isNull(semesters.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return notFound(c, "Semester");
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.name !== undefined) fieldsToUpdate.name = data.name;
    if (data.startDate !== undefined) fieldsToUpdate.startDate = data.startDate;
    if (data.endDate !== undefined) fieldsToUpdate.endDate = data.endDate;

    // B5: keep ownership + soft-delete guards on the UPDATE itself.
    const updated = await db
      .update(semesters)
      .set(fieldsToUpdate)
      .where(
        and(
          eq(semesters.id, id),
          eq(semesters.userId, userId),
          isNull(semesters.deletedAt),
        ),
      )
      .returning()
      .get();

    return c.json(updated);
  },
);

// DELETE /semesters/:id (soft delete)
semestersRouter.delete("/semesters/:id", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const id = String(c.req.param("id"));

  const existing = await db
    .select()
    .from(semesters)
    .where(
      and(
        eq(semesters.id, id),
        eq(semesters.userId, userId),
        isNull(semesters.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return notFound(c, "Semester");
  }

  const now = Math.floor(Date.now() / 1000);
  // B5: guard the DELETE as well as the preceding SELECT.
  await db.update(semesters)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(semesters.id, id),
        eq(semesters.userId, userId),
        isNull(semesters.deletedAt),
      ),
    )
    .run();

  return c.json({ success: true });
});

// ─── Semester Events CRUD ───────────────────────────────────────────────────

// GET /semesters/:semesterId/events — list events for a semester
semestersRouter.get("/semesters/:semesterId/events", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const semesterId = String(c.req.param("semesterId"));

  const rows = await db
    .select()
    .from(semesterEvents)
    .where(
      and(
        eq(semesterEvents.userId, userId),
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
  zValidator("json", CreateSemesterEventSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const semesterId = String(c.req.param("semesterId"));
    const data = c.req.valid("json");

    // Ensure semesterId in body matches the URL param
    if (data.semesterId !== semesterId) {
      return apiError(
        c,
        400,
        "VALIDATION_ERROR",
        "semesterId in body must match the URL parameter",
      );
    }

    // BL18: dangling semester references used to create orphan events.
    const refCheck = await assertSemesterExists(c, db, userId, semesterId);
    if (refCheck) return refCheck;

    const now = Math.floor(Date.now() / 1000);
    const id = crypto.randomUUID();

    const inserted = await db
      .insert(semesterEvents)
      .values({
        id,
        userId,
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
  zValidator("json", UpdateSemesterEventSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const eventId = String(c.req.param("eventId"));
    const data = c.req.valid("json");

    const existing = await db
      .select()
      .from(semesterEvents)
      .where(
        and(
          eq(semesterEvents.id, eventId),
          eq(semesterEvents.userId, userId),
          isNull(semesterEvents.deletedAt),
        ),
      )
      .get();

    if (!existing) {
      return notFound(c, "Event");
    }

    // BL18: validate the target semester when the event is being moved.
    if (data.semesterId !== undefined) {
      const refCheck = await assertSemesterExists(
        c,
        db,
        userId,
        data.semesterId,
      );
      if (refCheck) return refCheck;
    }

    const now = Math.floor(Date.now() / 1000);
    const fieldsToUpdate: Record<string, unknown> = { updatedAt: now };

    if (data.semesterId !== undefined) fieldsToUpdate.semesterId = data.semesterId;
    if (data.title !== undefined) fieldsToUpdate.title = data.title;
    if (data.date !== undefined) fieldsToUpdate.date = data.date;
    if (data.type !== undefined) fieldsToUpdate.type = data.type;

    // B5: keep ownership + soft-delete guards on the UPDATE itself.
    const updated = await db
      .update(semesterEvents)
      .set(fieldsToUpdate)
      .where(
        and(
          eq(semesterEvents.id, eventId),
          eq(semesterEvents.userId, userId),
          isNull(semesterEvents.deletedAt),
        ),
      )
      .returning()
      .get();

    return c.json(updated);
  },
);

// DELETE /semesters/events/:eventId (soft delete)
semestersRouter.delete("/semesters/events/:eventId", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");
  const eventId = String(c.req.param("eventId"));

  const existing = await db
    .select()
    .from(semesterEvents)
    .where(
      and(
        eq(semesterEvents.id, eventId),
        eq(semesterEvents.userId, userId),
        isNull(semesterEvents.deletedAt),
      ),
    )
    .get();

  if (!existing) {
    return notFound(c, "Event");
  }

  const now = Math.floor(Date.now() / 1000);
  // B5: guard the DELETE as well as the preceding SELECT.
  await db.update(semesterEvents)
    .set({ deletedAt: now, updatedAt: now })
    .where(
      and(
        eq(semesterEvents.id, eventId),
        eq(semesterEvents.userId, userId),
        isNull(semesterEvents.deletedAt),
      ),
    )
    .run();

  return c.json({ success: true });
});

export default semestersRouter;
