import { eq } from "drizzle-orm";
import { todayStr } from "@kaizenlife/shared";
import type { AppDb } from "../db/client";
import { users } from "../db/schema";

/**
 * Resolve "today" as YYYY-MM-DD in the owning user's timezone.
 * Fixes BL1: server-UTC dates disagreed with the user's WIB clock, so
 * check-ins/logs written between 00:00–06:59 WIB landed on the wrong day.
 */
export async function getTodayForUser(db: AppDb, userId: string): Promise<string> {
  const row = await db
    .select({ timezone: users.timezone })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  return todayStr(row?.timezone || "UTC");
}
