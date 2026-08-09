import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import {
  habits,
  habitLogs,
  tasks,
  clientFollowups,
  meetings,
  meetingActionItems,
} from "../db/schema";
import { eq, and, isNull } from "drizzle-orm";

const remindersRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb } }>();

const USER_ID = "default-user";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayStr(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function tomorrowStr(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** Convert YYYY-MM-DD to Unix epoch seconds at 23:59:59 */
function endOfDayEpoch(dateStr: string): number {
  return Math.floor(new Date(dateStr + "T23:59:59").getTime() / 1000);
}

// ─── GET /reminders ──────────────────────────────────────────────────────────
// Returns upcoming/overdue reminders:
//   1. Habits not done today
//   2. Task deadlines within 24h
//   3. Overdue follow-ups (nextFollowupDate in the past)
//   4. Upcoming meetings (today or tomorrow)
//   5. Overdue meeting action items
remindersRouter.get("/reminders", async (c) => {
  try {
    const db = c.get("db");
    const today = todayStr();
    const tomorrow = tomorrowStr();
    const now = Math.floor(Date.now() / 1000);
    const in24h = now + 86400;

    const items: Array<{
      type: string;
      title: string;
      detail: string;
      date: string;
      priority: "info" | "warning" | "urgent";
    }> = [];

    // ─── 1. Habits not done today ───────────────────────────────────────────
    const activeHabits = await db
      .select()
      .from(habits)
      .where(
        and(
          eq(habits.userId, USER_ID),
          eq(habits.active, true),
          isNull(habits.deletedAt),
        ),
      )
      .all();

    for (const habit of activeHabits) {
      const log = await db
        .select()
        .from(habitLogs)
        .where(
          and(
            eq(habitLogs.habitId, habit.id),
            eq(habitLogs.date, today),
            isNull(habitLogs.deletedAt),
          ),
        )
        .get();

      if (!log || log.completedCount < log.targetCount) {
        items.push({
          type: "habit",
          title: `Habit not completed: ${habit.name}`,
          detail: log
            ? `${log.completedCount}/${log.targetCount} completed`
            : "No log entry yet",
          date: today,
          priority: "warning",
        });
      }
    }

    // ─── 2. Task deadlines within 24h ───────────────────────────────────────
    const upcomingTasks = await db
      .select()
      .from(tasks)
      .where(
        and(
          eq(tasks.userId, USER_ID),
          isNull(tasks.deletedAt),
        ),
      )
      .all();

    for (const task of upcomingTasks) {
      if (
        task.date &&
        task.status !== "done" &&
        task.status !== "cancelled"
      ) {
        const taskEpoch = endOfDayEpoch(task.date);
        if (taskEpoch >= now && taskEpoch <= in24h) {
          items.push({
            type: "deadline",
            title: `Task due soon: ${task.title}`,
            detail: `Due ${task.date}${task.priority === "urgent" ? " (URGENT)" : task.priority === "high" ? " (HIGH)" : ""}`,
            date: task.date,
            priority:
              task.priority === "urgent"
                ? "urgent"
                : task.priority === "high"
                  ? "warning"
                  : "info",
          });
        } else if (taskEpoch < now) {
          // Overdue task
          items.push({
            type: "deadline",
            title: `Task overdue: ${task.title}`,
            detail: `Was due ${task.date}`,
            date: task.date,
            priority: "urgent",
          });
        }
      }
    }

    // ─── 3. Overdue follow-ups ──────────────────────────────────────────────
    const pendingFollowups = await db
      .select()
      .from(clientFollowups)
      .where(
        and(
          eq(clientFollowups.userId, USER_ID),
          eq(clientFollowups.status, "pending"),
          isNull(clientFollowups.deletedAt),
        ),
      )
      .all();

    for (const fu of pendingFollowups) {
      if (fu.nextFollowupDate && fu.nextFollowupDate < today) {
        items.push({
          type: "followup",
          title: `Overdue follow-up for client`,
          detail: `Follow-up was due ${fu.nextFollowupDate}${fu.notes ? ` — ${fu.notes}` : ""}`,
          date: fu.nextFollowupDate,
          priority: "warning",
        });
      }
    }

    // ─── 4. Upcoming meetings (today or tomorrow) ──────────────────────────
    const upcomingMeetings = await db
      .select()
      .from(meetings)
      .where(
        and(
          eq(meetings.userId, USER_ID),
          isNull(meetings.deletedAt),
        ),
      )
      .all();

    for (const meeting of upcomingMeetings) {
      if (meeting.date === today || meeting.date === tomorrow) {
        items.push({
          type: "meeting",
          title: meeting.agenda
            ? `Meeting today: ${meeting.agenda}`
            : "Meeting today",
          detail:
            meeting.date === today ? "Today" : "Tomorrow",
          date: meeting.date,
          priority: meeting.date === today ? "urgent" : "info",
        });
      }
    }

    // ─── 5. Overdue meeting action items ────────────────────────────────────
    const openActionItems = await db
      .select()
      .from(meetingActionItems)
      .where(
        and(
          eq(meetingActionItems.userId, USER_ID),
          eq(meetingActionItems.status, "open"),
          isNull(meetingActionItems.deletedAt),
        ),
      )
      .all();

    for (const ai of openActionItems) {
      if (ai.deadline && ai.deadline < today) {
        items.push({
          type: "followup",
          title: `Overdue action item: ${ai.description}`,
          detail: `Was due ${ai.deadline}${ai.pic ? ` — PIC: ${ai.pic}` : ""}`,
          date: ai.deadline,
          priority: "urgent",
        });
      }
    }

    // Sort: urgent first, then by date ascending
    const priorityOrder = { urgent: 0, warning: 1, info: 2 };
    items.sort((a, b) => {
      const pa = priorityOrder[a.priority];
      const pb = priorityOrder[b.priority];
      if (pa !== pb) return pa - pb;
      return a.date.localeCompare(b.date);
    });

    return c.json({ data: items });
  } catch (err) {
    console.error("GET /reminders error:", err);
    return c.json(
      { error: { code: "INTERNAL", message: "Failed to fetch reminders" } },
      500,
    );
  }
});

export default remindersRouter;
