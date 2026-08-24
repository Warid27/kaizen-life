import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { UpdateSettingsSchema } from "@kaizenlife/shared";
import type { Bindings, AppDb } from "../db/client";
import { users } from "../db/schema";
import { eq } from "drizzle-orm";import { apiError, notFound, validationHook } from "../lib/api";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const settingsRouter = new Hono<RouteEnv>();

// GET /api/settings — current user settings (was previously called by the web
// app but had no server implementation: B1).
settingsRouter.get("/settings", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const row = await db
    .select({
      name: users.name,
      email: users.email,
      timezone: users.timezone,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!row) {
    return notFound(c, "User");
  }

  return c.json(row);
});

// PATCH /api/settings — update profile fields (name/email/timezone).
// timezone drives all server-side "today" resolution (BL1), so it is
// validated against the runtime's IANA zone list.
settingsRouter.patch(
  "/settings",
  zValidator("json", UpdateSettingsSchema, validationHook),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const body = c.req.valid("json");

    if (body.timezone) {
      try {
        new Intl.DateTimeFormat("en-CA", { timeZone: body.timezone });
      } catch {
        return apiError(c, 400, "VALIDATION_ERROR", `Unknown IANA timezone: ${body.timezone}`);
      }
    }

    const existing = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .get();

    if (!existing) {
      return notFound(c, "User");
    }

    const now = Math.floor(Date.now() / 1000);
    const updated = await db
      .update(users)
      .set({ ...body, updatedAt: now })
      .where(eq(users.id, userId))
      .returning({
        name: users.name,
        email: users.email,
        timezone: users.timezone,
        updatedAt: users.updatedAt,
      })
      .get();

    return c.json(updated);
  },
);

export default settingsRouter;
