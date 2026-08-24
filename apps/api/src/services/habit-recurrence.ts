import { eq, and, desc, inArray, isNull } from "drizzle-orm";
import type { AppDb } from "../db/client";
import { habits, habitLogs } from "../db/schema";

// ─── Types ──────────────────────────────────────────────────────────────────
type HabitRow = typeof habits.$inferSelect;
type HabitLogRow = typeof habitLogs.$inferSelect;

// ─── Pure date helpers (UTC-safe; no server-localtime dependence) ───────────

/** Format a Date as YYYY-MM-DD using UTC calendar fields. */
export function formatDate(d: Date): string {
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Parse a YYYY-MM-DD string to a UTC-midnight Date. Throws on bad input. */
export function parseDate(s: string): Date {
  const [y = NaN, m = NaN, d = NaN] = s.split("-").map(Number);
  if (Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    throw new RangeError(`Invalid date string "${s}"`);
  }
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(d: Date, days: number): Date {
  const copy = new Date(d.getTime());
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function diffDays(a: Date, b: Date): number {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

/** Epoch seconds → YYYY-MM-DD (UTC calendar of that instant). */
export function epochToDateStr(epochSec: number): string {
  return new Date(epochSec * 1000).toISOString().slice(0, 10);
}

// ─── Recurrence engine ──────────────────────────────────────────────────────

/**
 * Determine whether a habit is scheduled for a given date (UTC fields).
 *
 * - `daily`       → every day
 * - `weekly_n`    → every day (user chooses which N days of the week to
 *                   complete; quota handled in stats, not scheduling)
 * - `custom_days` → only on weekdays listed in customDays JSON (0 = Sunday)
 */
export function isScheduledOnDate(habit: HabitRow, date: Date): boolean {
  if (!habit.active) return false;
  if (habit.deletedAt != null) return false;

  if (habit.frequency === "daily") return true;
  if (habit.frequency === "weekly_n") return true;

  if (habit.frequency === "custom_days") {
    if (!habit.customDays) return false;
    try {
      const days: unknown = JSON.parse(habit.customDays);
      if (!Array.isArray(days)) return false;
      return days.includes(date.getUTCDay());
    } catch {
      return false;
    }
  }

  return false;
}

/**
 * Ensure every active habit scheduled for `today` (YYYY-MM-DD) has a live
 * `habit_logs` row, in a CONSTANT number of queries regardless of habit
 * count (was one SELECT + INSERT per habit inside GET /habits — A1/P4).
 *
 * - One SELECT for habits, one SELECT for existing logs, one batched INSERT
 *   for missing rows, one UPDATE resurrecting soft-deleted rows.
 * - Resurrecting (deletedAt → NULL) instead of re-inserting avoids the
 *   UNIQUE(habit_id, date) collision 500s (DB3).
 */
export async function ensureTodayLogs(
  db: AppDb,
  userId: string,
  todayStr: string,
): Promise<HabitLogRow[]> {
  const now = Math.floor(Date.now() / 1000);
  const today = parseDate(todayStr);

  const activeHabits = await db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.active, true), isNull(habits.deletedAt)))
    .all();

  const scheduled = activeHabits.filter((h) => isScheduledOnDate(h, today));
  if (scheduled.length === 0) return [];

  const habitIds = scheduled.map((h) => h.id);

  // ALL rows for these habits on this date — including soft-deleted ones —
  // so unique-constraint collisions are impossible.
  const existingLogs = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.date, todayStr), inArray(habitLogs.habitId, habitIds)))
    .all();

  const byHabitId = new Map<string, HabitLogRow>();
  for (const log of existingLogs) byHabitId.set(log.habitId, log);

  const targetsByHabitId = new Map(scheduled.map((h) => [h.id, h.targetCountPerPeriod] as const));

  // Resurrect soft-deleted placeholder rows.
  const deadLogs = existingLogs.filter((l) => l.deletedAt != null);
  if (deadLogs.length > 0) {
    await db
      .update(habitLogs)
      .set({ deletedAt: null, updatedAt: now })
      .where(inArray(habitLogs.id, deadLogs.map((l) => l.id)))
      .run();
    for (const l of deadLogs) l.deletedAt = null;
  }

  // Batch-insert missing placeholder rows in ONE statement.
  const missingHabits = scheduled.filter((h) => !byHabitId.has(h.id));
  if (missingHabits.length > 0) {
    await db
      .insert(habitLogs)
      .values(
        missingHabits.map((h) => ({
          id: crypto.randomUUID(),
          userId,
          habitId: h.id,
          date: todayStr,
          completedCount: 0,
          targetCount: h.targetCountPerPeriod,
          createdAt: now,
          updatedAt: now,
        })),
      )
      .run();

    for (const h of missingHabits) {
      byHabitId.set(h.id, {
        id: "",
        userId,
        habitId: h.id,
        date: todayStr,
        completedCount: 0,
        targetCount: targetsByHabitId.get(h.id) ?? h.targetCountPerPeriod,
        note: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      });
    }
  }

  return scheduled
    .map((h) => byHabitId.get(h.id))
    .filter((l): l is HabitLogRow => l !== undefined);
}

// ─── Stats computation ──────────────────────────────────────────────────────

const MAX_LOOKBACK_DAYS = 365;

type DayStatus = "scheduled" | "not_scheduled";

function isDayCompleted(log: HabitLogRow | undefined): boolean {
  return log !== undefined && log.completedCount >= log.targetCount;
}

/**
 * Walk `dates` (ascending YYYY-MM-DD strings) and compute the longest run of
 * completed days among scheduled ones.
 */
function longestCompletedRun(
  dates: string[],
  scheduled: Map<string, DayStatus>,
  logMap: Map<string, HabitLogRow>,
): number {
  let best = 0;
  let cur = 0;
  for (const date of dates) {
    if (scheduled.get(date) !== "scheduled") continue;
    if (isDayCompleted(logMap.get(date))) {
      cur += 1;
      best = Math.max(best, cur);
    } else {
      cur = 0;
    }
  }
  return best;
}

// ── weekly_n helpers ─────────────────────────────────────────────────────────
// A weekly_n habit with target N is judged per calendar week (Mon–Sun):
// each week needs N completed DAYS; extra days don't compensate other weeks.

function startOfWeek(d: Date): Date {
  const copy = new Date(d.getTime());
  const dow = copy.getUTCDay(); // 0=Sun
  const shiftToMonday = dow === 0 ? -6 : 1 - dow;
  return addDays(copy, shiftToMonday);
}

interface WeekResult {
  completedDays: number;
  /** Days still ahead inside this week relative to `today`. */
  daysRemaining: number;
}

function summarizeWeeks(
  weekStarts: Date[],
  logMap: Map<string, HabitLogRow>,
  today: Date,
): WeekResult[] {
  return weekStarts.map((ws) => {
    const we = addDays(ws, 6);
    let completedDays = 0;
    let daysRemaining = 0;
    for (let d = ws; d <= we; d = addDays(d, 1)) {
      if (d > today) {
        daysRemaining += 1;
        continue;
      }
      const log = logMap.get(formatDate(d));
      if (isDayCompleted(log)) completedDays += 1;
    }
    return { completedDays, daysRemaining };
  });
}

function weeklyStreaks(weeks: WeekResult[], targetPerWeek: number): { current: number; longest: number } {
  let current = 0;
  let longest = 0;
  let run = 0;
  for (let i = 0; i < weeks.length; i++) {
    const w = weeks[i]!;
    const isLast = i === weeks.length - 1;
    const met = w.completedDays >= targetPerWeek;
    // Grace: the running week keeps the streak alive while the remaining
    // days can still cover the quota.
    const alive = isLast && w.daysRemaining >= Math.max(targetPerWeek - w.completedDays, 0);
    if (met || alive) {
      run += 1;
      longest = Math.max(longest, run);
      if (met || alive) current = run;
    } else {
      run = 0;
      current = 0;
    }
  }
  // If even the last week is still empty-but-recoverable, current reflects it.
  return { current, longest };
}

/**
 * Compute streak, completion rate, and totals for a single habit.
 *
 * Semantics fixed here (reviews BL5–BL9):
 * - Window starts at the habit's creation date (rate denominator no longer
 *   includes pre-creation days).
 * - Longest streak scans full history (no artificial 365-day cap), current
 *   streak capped at the lookback window.
 * - `weekly_n` uses weekly-quota math instead of being scored against every
 *   day (which capped a "3x/week" habit at ~43%).
 */
export async function computeHabitStats(
  db: AppDb,
  habitId: string,
  userId: string,
  todayStr?: string,
): Promise<null | {
  habitId: string;
  frequency: HabitRow["frequency"];
  currentStreak: number;
  longestStreak: number;
  completionRate: number;
  totalCompletions: number;
  totalScheduledDays: number;
  recentLogs: HabitLogRow[];
}> {
  const habit = await db
    .select()
    .from(habits)
    .where(and(eq(habits.id, habitId), eq(habits.userId, userId), isNull(habits.deletedAt)))
    .get();

  if (!habit) return null;

  const logs = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.habitId, habitId), eq(habitLogs.userId, userId), isNull(habitLogs.deletedAt)))
    .orderBy(desc(habitLogs.date))
    .all();

  const today = todayStr ? parseDate(todayStr) : new Date();
  const todayDateStr = formatDate(today);

  const createdDate = parseDate(epochToDateStr(habit.createdAt));
  const lookbackStart = addDays(today, -MAX_LOOKBACK_DAYS);
  const windowStart = createdDate > lookbackStart ? createdDate : lookbackStart;

  const logMap = new Map<string, HabitLogRow>();
  for (const log of logs) logMap.set(log.date, log);

  // ── weekly_n: quota-based scoring ──
  if (habit.frequency === "weekly_n") {
    const targetPerWeek = Math.max(habit.targetCountPerPeriod, 1);
    const firstWeek = startOfWeek(windowStart);
    const currentWeek = startOfWeek(today);

    const weekStarts: Date[] = [];
    for (let ws = firstWeek; ws <= currentWeek; ws = addDays(ws, 7)) {
      weekStarts.push(ws);
    }
    const weeks = summarizeWeeks(weekStarts, logMap, today);

    const completeWeeks = weeks.filter((w) => w.daysRemaining === 0);
    const avgWeekRatio =
      completeWeeks.length > 0
        ? completeWeeks.reduce((acc, w) => acc + Math.min(w.completedDays / targetPerWeek, 1), 0) /
          completeWeeks.length
        : 0;

    const streaks = weeklyStreaks(weeks, targetPerWeek);
    const totalCompletions = weeks.reduce((acc, w) => acc + w.completedDays, 0);

    return {
      habitId: habit.id,
      frequency: habit.frequency,
      currentStreak: streaks.current,
      longestStreak: streaks.longest,
      completionRate: Math.round(avgWeekRatio * 1000) / 1000,
      totalCompletions,
      totalScheduledDays: weekStarts.length * 7,
      recentLogs: logs.slice(0, 30),
    };
  }

  // ── daily / custom_days: day-based scoring ──
  const totalDays = diffDays(today, windowStart) + 1;
  if (totalDays <= 0) {
    return {
      habitId: habit.id,
      frequency: habit.frequency,
      currentStreak: 0,
      longestStreak: 0,
      completionRate: 0,
      totalCompletions: 0,
      totalScheduledDays: 0,
      recentLogs: logs.slice(0, 30),
    };
  }

  const scheduled = new Map<string, DayStatus>();
  const scheduledDates: string[] = [];
  for (let i = 0; i < totalDays; i++) {
    const d = addDays(windowStart, i);
    const ds = formatDate(d);
    if (isScheduledOnDate(habit, d)) {
      scheduled.set(ds, "scheduled");
      scheduledDates.push(ds);
    } else {
      scheduled.set(ds, "not_scheduled");
    }
  }

  let totalCompletions = 0;
  for (const ds of scheduledDates) {
    if (isDayCompleted(logMap.get(ds))) totalCompletions += 1;
  }

  const completionRate =
    scheduledDates.length > 0 ? totalCompletions / scheduledDates.length : 0;

  // Current streak: walk backwards from today (grace through non-scheduled
  // days and through "today not yet logged").
  let currentStreak = 0;
  let cursor = new Date(today);
  let broke = false;
  for (let i = 0; i < totalDays && !broke; i++) {
    const ds = formatDate(cursor);
    const status = scheduled.get(ds);
    if (status === "scheduled") {
      const done = isDayCompleted(logMap.get(ds));
      if (done) {
        currentStreak += 1;
      } else if (ds === todayDateStr) {
        // Today not done yet — doesn't break yesterday's streak.
      } else {
        broke = true;
        break;
      }
    }
    cursor = addDays(cursor, -1);
  }

  // Longest streak over full history present in logs (extends beyond lookback
  // when the habit predates the window — BL8 cap removed).
  const earliestLog = logs.length > 0 ? (logs[logs.length - 1]?.date ?? null) : null;
  const historyStart =
    earliestLog && parseDate(earliestLog) < windowStart ? parseDate(earliestLog) : windowStart;
  const historyDates: string[] = [];
  for (let d = historyStart; d <= today; d = addDays(d, 1)) {
    historyDates.push(formatDate(d));
  }
  const historyScheduled = new Map<string, DayStatus>(
    historyDates.map((ds) => [
      ds,
      isScheduledOnDate(habit, parseDate(ds)) ? ("scheduled" as DayStatus) : ("not_scheduled" as DayStatus),
    ]),
  );
  const longestStreak = longestCompletedRun(historyDates, historyScheduled, logMap);

  return {
    habitId: habit.id,
    frequency: habit.frequency,
    currentStreak,
    longestStreak,
    completionRate: Math.round(completionRate * 1000) / 1000,
    totalCompletions,
    totalScheduledDays: scheduledDates.length,
    recentLogs: logs.slice(0, 30),
  };
}

/** Count of active habits scheduled on a given date — used by dashboards. */
export function countScheduledOnDate(activeHabits: HabitRow[], date: Date): number {
  return activeHabits.filter((h) => isScheduledOnDate(h, date)).length;
}
