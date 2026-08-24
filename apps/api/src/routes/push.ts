import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import { DeletePushSubscriptionSchema, PushSubscriptionSchema } from "@kaizenlife/shared";
import type { Bindings, AppDb } from "../db/client";
import { pushSubscriptions } from "../db/schema";
import { apiError } from "../lib/api";

const pushRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// ─── GET /push/vapid-public-key ──────────────────────────────────────────────
// Public info — the application server key clients pass to pushManager.subscribe().
pushRouter.get("/push/vapid-public-key", (c) => {
  const publicKey = c.env.VAPID_PUBLIC_KEY ?? null;
  return c.json({ data: { publicKey } });
});

// ─── POST /push/subscriptions ────────────────────────────────────────────────
// Upsert by endpoint (one row per browser subscription; re-subscribes refresh keys).
pushRouter.post("/push/subscriptions", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const parsed = PushSubscriptionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid subscription", parsed.error.flatten());
  }
  const sub = parsed.data;
  const now = Math.floor(Date.now() / 1000);
  const userAgent = c.req.header("User-Agent") ?? null;

  await db
    .insert(pushSubscriptions)
    .values({
      id: crypto.randomUUID(),
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: {
        userId,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        userAgent,
        updatedAt: now,
      },
    })
    .run();

  return c.json({ data: { success: true } }, 201);
});

// ─── DELETE /push/subscriptions ──────────────────────────────────────────────
// Body: { endpoint }. Hard delete — a removed browser must stop receiving pushes.
pushRouter.delete("/push/subscriptions", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  const parsed = DeletePushSubscriptionSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) {
    return apiError(c, 400, "VALIDATION_ERROR", "Invalid request", parsed.error.flatten());
  }

  // Scope to the caller so one user can never delete another's subscription.
  await db
    .delete(pushSubscriptions)
    .where(
      and(eq(pushSubscriptions.endpoint, parsed.data.endpoint), eq(pushSubscriptions.userId, userId)),
    )
    .run();

  return c.json({ data: { success: true } });
});

export default pushRouter;
