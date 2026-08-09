import { eq, and, desc, sql } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { habits, habitLogs } from "../db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────
type HabitRow = typeof habits.$inferSelect;
type HabitLogRow = typeof habitLogs.$inferSelect;

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Format a Date as YYYY-MM-DD in the local timezone. */
function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse a YYYY-MM-DD string back to a Date (midnight local). */
function parseDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

// ─── Recurrence engine ──────────────────────────────────────────────────────

/**
 * Determine whether a habit is scheduled for a given date.
 *
 * - `daily`      → every day
 * - `weekly_n`   → every day (user decides which N days to complete in a week)
 * - `custom_days`→ only on weekdays listed in `customDays` (JSON array of 0-6,
 *                   where 0 = Sunday)
 */
export function isScheduledOnDate(habit: HabitRow, date: Date): boolean {
  if (habit.frequency === "daily") return true;

  if (habit.frequency === "weekly_n") return true; // active every day; target is N/week

  if (habit.frequency === "custom_days" && habit.customDays) {
    try {
      const days: number[] = JSON.parse(habit.customDays);
      return days.includes(date.getDay());
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Ensure that every active habit scheduled for `todayStr` (YYYY-MM-DD) has a
 * `habit_logs` row. If none exists, create one with `completedCount = 0`.
 *
 * Returns the list of created / existing log rows for today.
 */
export async function ensureTodayLogs(
  db: AppDb,
  userId: string,
  todayStr: string,
): Promise<HabitLogRow[]> {
  const today = parseDate(todayStr);
  const now = Math.floor(Date.now() / 1000);

  // 1. Fetch all active, non-deleted habits for this user
  const activeHabits = await db
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.userId, userId),
        eq(habits.active, true),
        sql`${habits.deletedAt} IS NULL`,
      ),
    )
    .all();

  const todayLogs: HabitLogRow[] = [];

  for (const habit of activeHabits) {
    if (!isScheduledOnDate(habit, today)) continue;

    // 2. Check for existing log row
    const existing = await db
      .select()
      .from(habitLogs)
      .where(
        and(
          eq(habitLogs.habitId, habit.id),
          eq(habitLogs.date, todayStr),
          sql`${habitLogs.deletedAt} IS NULL`,
        ),
      )
      .get();

    if (existing) {
      todayLogs.push(existing);
      continue;
    }

    // 3. Create placeholder row
    const id = crypto.randomUUID();
    const row = await db
      .insert(habitLogs)
      .values({
        id,
        userId,
        habitId: habit.id,
        date: todayStr,
        completedCount: 0,
        targetCount: habit.targetCountPerPeriod,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    todayLogs.push(row);
  }

  return todayLogs;
}

// ─── Stats computation ──────────────────────────────────────────────────────

/**
 * Compute streak, completion rate, and totals for a single habit.
 *
 * Returns a stats object ready for the API response.
 */
export async function computeHabitStats(db: AppDb, habitId: string, userId: string) {
  // 1. Fetch the habit to get its frequency and target
  const habit = await db
    .select()
    .from(habits)
    .where(
      and(
        eq(habits.id, habitId),
        eq(habits.userId, userId),
        sql`${habits.deletedAt} IS NULL`,
      ),
    )
    .get();

  if (!habit) return null;

  // 2. Fetch all logs for this habit (most recent first)
  const logs = await db
    .select()
    .from(habitLogs)
    .where(
      and(
        eq(habitLogs.habitId, habitId),
        eq(habitLogs.userId, userId),
        sql`${habitLogs.deletedAt} IS NULL`,
      ),
    )
    .orderBy(desc(habitLogs.date))
    .all();

  const todayStr = formatDate(new Date());
  const today = parseDate(todayStr);

  // 3. Determine which days this habit was ever "scheduled"
  //    For simplicity, look back up to 365 days from today.
  const lookbackDays = 365;
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - lookbackDays);

  let totalScheduledDays = 0;
  let totalCompletions = 0;

  // Build a set of scheduled dates within the lookback window
  const scheduledDates: string[] = [];
  const cursor = new Date(startDate);
  while (cursor <= today) {
    if (isScheduledOnDate(habit, cursor)) {
      scheduledDates.push(formatDate(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  totalScheduledDays = scheduledDates.length;

  // Build a map of date → log for quick lookup
  const logMap = new Map<string, HabitLogRow>();
  for (const log of logs) {
    logMap.set(log.date, log);
  }

  // Count completions (days where completedCount >= targetCount)
  for (const dateStr of scheduledDates) {
    const log = logMap.get(dateStr);
    if (log && log.completedCount >= log.targetCount) {
      totalCompletions++;
    }
  }

  const completionRate =
    totalScheduledDays > 0 ? totalCompletions / totalScheduledDays : 0;

  // 4. Compute current streak (consecutive completed days ending at today or yesterday)
  let currentStreak = 0;
  const streakCursor = new Date(today);
  // Allow the streak to start from today or yesterday (habit might not be logged yet today)
  for (let i = 0; i <= 1; i++) {
    const dateStr = formatDate(streakCursor);
    const log = logMap.get(dateStr);
    if (log && log.completedCount >= log.targetCount) {
      break; // today is completed, start counting from today
    }
    if (i === 0) {
      streakCursor.setDate(streakCursor.getDate() - 1); // try yesterday
    }
  }

  // Now count backwards from streakCursor
  const streakStart = new Date(streakCursor);
  while (true) {
    const dateStr = formatDate(streakStart);
    if (parseDate(dateStr).getTime() < startDate.getTime()) break;

    if (isScheduledOnDate(habit, streakStart)) {
      const log = logMap.get(dateStr);
      if (log && log.completedCount >= log.targetCount) {
        currentStreak++;
      } else {
        break;
      }
    }
    streakStart.setDate(streakStart.getDate() - 1);
  }

  // 5. Compute longest streak
  let longestStreak = 0;
  let tempStreak = 0;
  // Walk forward through scheduled dates
  for (const dateStr of scheduledDates) {
    const log = logMap.get(dateStr);
    if (log && log.completedCount >= log.targetCount) {
      tempStreak++;
      longestStreak = Math.max(longestStreak, tempStreak);
    } else {
      tempStreak = 0;
    }
  }

  // 6. Return recent logs (last 30)
  const recentLogs = logs.slice(0, 30);

  return {
    habitId: habit.id,
    currentStreak,
    longestStreak,
    completionRate: Math.round(completionRate * 1000) / 1000, // 3 decimal places
    totalCompletions,
    totalScheduledDays,
    recentLogs,
  };
}
