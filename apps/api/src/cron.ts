// ─────────────────────────────────────────────────────────────────────────────
// Cron-triggered push dispatcher.
//
// Runs every 15 minutes (wrangler.toml [triggers]) and delivers:
//   1. Due rows from the polymorphic `reminders` table (status=pending,
//      trigger_at <= now) → pushed once, then marked "sent".
//   2. A one-shot daily digest per user at ~08:00 local time summarizing
//      scheduled-but-incomplete habits and open tasks for today.
//
// Delivery targets come from `push_subscriptions`. Rows whose endpoints are
// gone (404/410) are pruned automatically.
// ─────────────────────────────────────────────────────────────────────────────

import { and, eq, isNull, lte, sql } from "drizzle-orm";
import type { Bindings, AppDb } from "./db/client";
import { createDb } from "./db/client";
import {
  habits,
  habitLogs,
  pushSubscriptions,
  reminders,
  tasks,
  users,
} from "./db/schema";
import { getTodayForUser } from "./lib/date";
import {
  sendPushNotification,
  type PushMessagePayload,
  type VapidKeys,
} from "./lib/webpush";

/** Local wall-clock minutes since midnight for an IANA timezone. */
function localMinutesNow(timeZone: string, nowMs: number): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date(nowMs));
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return ((hour % 24) * 60 + minute);
}

async function deliverToUser(
  db: AppDb,
  userId: string,
  payload: PushMessagePayload,
  vapidKeys: VapidKeys,
  vapidSubject: string,
): Promise<void> {
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId))
    .all();

  if (subs.length === 0) return;

  await Promise.all(
    subs.map(async (sub) => {
      const result = await sendPushNotification({
        endpoint: sub.endpoint,
        p256dh: sub.p256dh,
        auth: sub.auth,
        payload,
        vapidKeys,
        vapidSubject,
      });
      if (result === "gone") {
        await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id)).run();
      }
    }),
  );
}

/** Push every due pending reminder row, then mark it sent. */
export async function dispatchDueReminders(
  db: AppDb,
  nowSec: number,
  vapidKeys: VapidKeys,
  vapidSubject: string,
): Promise<number> {
  const due = await db
    .select()
    .from(reminders)
    .where(
      and(
        eq(reminders.status, "pending"),
        lte(reminders.triggerAt, nowSec),
        isNull(reminders.deletedAt),
      ),
    )
    .limit(100)
    .all();

  let delivered = 0;
  for (const row of due) {
    await deliverToUser(
      db,
      row.userId,
      { title: "KaizenLife reminder", body: `${row.referenceType}: ${row.referenceId}`, tag: `reminder-${row.id}`, url: "/" },
      vapidKeys,
      vapidSubject,
    );
    await db.update(reminders).set({ status: "sent", updatedAt: nowSec }).where(eq(reminders.id, row.id)).run();
    delivered++;
  }
  return delivered;
}

/**
 * Daily ~08:00 local-time digest: scheduled habits not yet completed today
 * plus today's open task count. Fired in the [08:00, 08:15) local window so
 * a 15-minute cron hits each user exactly once per day.
 */
export async function dispatchDailyDigests(
  db: AppDb,
  nowMs: number,
  vapidKeys: VapidKeys,
  vapidSubject: string,
): Promise<number> {
  const allUsers = await db.select().from(users).all();
  const DIGEST_MINUTE = 8 * 60;

  let sent = 0;
  for (const user of allUsers) {
    let minutes: number;
    try {
      minutes = localMinutesNow(user.timezone || "UTC", nowMs);
    } catch {
      continue; // invalid stored timezone — skip silently
    }
    if (minutes < DIGEST_MINUTE || minutes >= DIGEST_MINUTE + 15) continue;

    const today = await getTodayForUser(db, user.id);

    const [scheduledHabits, doneLogs, openTasks] = await Promise.all([
      db.select().from(habits).where(and(isNull(habits.deletedAt), eq(habits.active, true))).all(),
      db
        .select()
        .from(habitLogs)
        .where(and(isNull(habitLogs.deletedAt), eq(habitLogs.date, today)))
        .all(),
      db
        .select({ n: sql<number>`count(*)` })
        .from(tasks)
        .where(
          and(
            isNull(tasks.deletedAt),
            eq(tasks.userId, user.id),
            lte(tasks.date, today),
            sql`${tasks.status} != 'completed'`,
          ),
        )
        .get(),
    ]);

    const doneHabitIds = new Set(doneLogs.map((l) => l.habitId));
    // Habits with any log for today count as handled (increment model may log >1).
    const habitsDue = scheduledHabits.filter((h) => !doneHabitIds.has(h.id)).length;
    const openTaskCount = Number(openTasks?.n ?? 0);

    if (habitsDue === 0 && openTaskCount === 0) continue;

    const bodyParts: string[] = [];
    if (habitsDue > 0) bodyParts.push(`${habitsDue} habit${habitsDue === 1 ? "" : "s"} to do`);
    if (openTaskCount > 0) bodyParts.push(`${openTaskCount} open task${openTaskCount === 1 ? "" : "s"}`);

    await deliverToUser(
      db,
      user.id,
      {
        title: "Good morning ☀️",
        body: `Today: ${bodyParts.join(", ")} (${today}).`,
        tag: `daily-digest-${today}`,
        url: "/",
      },
      vapidKeys,
      vapidSubject,
    );
    sent++;
  }
  return sent;
}

/** Entry point wired to the Workers `scheduled` event. */
export async function handleScheduled(
  _event: unknown,
  env: Bindings,
): Promise<{ remindersSent: number; digestsSent: number }> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { remindersSent: 0, digestsSent: 0 }; // push not configured — no-op
  }
  const vapidKeys: VapidKeys = {
    publicKey: env.VAPID_PUBLIC_KEY,
    privateKey: env.VAPID_PRIVATE_KEY,
  };
  const vapidSubject = env.VAPID_SUBJECT || "mailto:kaizenlife@warid.web.id";

  const db = createDb(env);
  const nowMs = Date.now();
  const nowSec = Math.floor(nowMs / 1000);

  const remindersSent = await dispatchDueReminders(db, nowSec, vapidKeys, vapidSubject);
  const digestsSent = await dispatchDailyDigests(db, nowMs, vapidKeys, vapidSubject);

  return { remindersSent, digestsSent };
}
