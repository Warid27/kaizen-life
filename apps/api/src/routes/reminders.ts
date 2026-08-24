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
import { eq, and, isNull, lt, lte, gte, inArray, isNotNull } from "drizzle-orm";
import { apiError } from "../lib/api";
import { getTodayForUser } from "../lib/date";
import { shiftDate } from "@kaizenlife/shared";

const remindersRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

type ReminderItem = {
  type: string;
  title: string;
  detail: string;
  date: string;
  priority: "info" | "warning" | "urgent";
};

// ─── GET /reminders ──────────────────────────────────────────────────────────
// Returns upcoming/overdue reminders. Rewritten so every section is one
// indexed SQL query with server-side filters (P3: was a per-habit N+1 loop
// plus four full-table scans filtered in JavaScript on every poll).
remindersRouter.get("/reminders", async (c) => {
  try {
    const db = c.get("db");
    const userId = c.get("userId");

    const today = await getTodayForUser(db, userId);
    const tomorrow = shiftDate(today, 1);

    const [
      activeHabits,
      todayLogs,
      dueSoonTasks,
      overdueTasks,
      overdueFollowups,
      upcomingMeetings,
      overdueActionItems,
    ] = await Promise.all([
      // Active habits (scheduled filtering done in JS against the small list).
      db
        .select()
        .from(habits)
        .where(and(eq(habits.userId, userId), eq(habits.active, true), isNull(habits.deletedAt)))
        .all(),

      // ONE query for all of today's logs (was one SELECT per habit).
      db
        .select({
          habitId: habitLogs.habitId,
          completedCount: habitLogs.completedCount,
          targetCount: habitLogs.targetCount,
        })
        .from(habitLogs)
        .where(and(eq(habitLogs.userId, userId), eq(habitLogs.date, today), isNull(habitLogs.deletedAt)))
        .all(),

      // Task deadlines due today or tomorrow (indexed WHERE instead of a
      // full-table scan filtered in JS).
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          date: tasks.date,
          priority: tasks.priority,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            isNull(tasks.deletedAt),
            isNotNull(tasks.date),
            gte(tasks.date, today),
            lte(tasks.date, tomorrow),
            inArray(tasks.status, ["todo", "in_progress"]),
          ),
        )
        .all(),

      // Overdue tasks.
      db
        .select({
          id: tasks.id,
          title: tasks.title,
          date: tasks.date,
        })
        .from(tasks)
        .where(
          and(
            eq(tasks.userId, userId),
            isNull(tasks.deletedAt),
            isNotNull(tasks.date),
            lt(tasks.date, today),
            inArray(tasks.status, ["todo", "in_progress"]),
          ),
        )
        .all(),

      // Overdue follow-ups (date comparison pushed into SQL).
      db
        .select({
          id: clientFollowups.id,
          nextFollowupDate: clientFollowups.nextFollowupDate,
          notes: clientFollowups.notes,
        })
        .from(clientFollowups)
        .where(
          and(
            eq(clientFollowups.userId, userId),
            eq(clientFollowups.status, "pending"),
            isNull(clientFollowups.deletedAt),
            isNotNull(clientFollowups.nextFollowupDate),
            lt(clientFollowups.nextFollowupDate, today),
          ),
        )
        .all(),

      // Meetings today or tomorrow.
      db
        .select({ id: meetings.id, agenda: meetings.agenda, date: meetings.date })
        .from(meetings)
        .where(
          and(
            eq(meetings.userId, userId),
            isNull(meetings.deletedAt),
            inArray(meetings.date, [today, tomorrow]),
          ),
        )
        .all(),

      // Overdue open action items.
      db
        .select({
          id: meetingActionItems.id,
          description: meetingActionItems.description,
          deadline: meetingActionItems.deadline,
          pic: meetingActionItems.pic,
        })
        .from(meetingActionItems)
        .where(
          and(
            eq(meetingActionItems.userId, userId),
            eq(meetingActionItems.status, "open"),
            isNull(meetingActionItems.deletedAt),
            isNotNull(meetingActionItems.deadline),
            lt(meetingActionItems.deadline, today),
          ),
        )
        .all(),
    ]);

    const items: ReminderItem[] = [];

    // 1. Scheduled habits not done today.
    const logByHabitId = new Map(todayLogs.map((l) => [l.habitId, l]));
    for (const habit of activeHabits) {
      const log = logByHabitId.get(habit.id);
      if (!log || log.completedCount < log.targetCount) {
        items.push({
          type: "habit",
          title: `Habit not completed: ${habit.name}`,
          detail: log ? `${log.completedCount}/${log.targetCount} completed` : "No log entry yet",
          date: today,
          priority: "warning",
        });
      }
    }

    // 2a. Tasks due within the window.
    for (const task of dueSoonTasks) {
      if (!task.date) continue;
      items.push({
        type: "deadline",
        title: task.date === today ? `Task due today: ${task.title}` : `Task due soon: ${task.title}`,
        detail: `Due ${task.date}${
          task.priority === "urgent" ? " (URGENT)" : task.priority === "high" ? " (HIGH)" : ""
        }`,
        date: task.date,
        priority: task.priority === "urgent" ? "urgent" : task.priority === "high" ? "warning" : "info",
      });
    }

    // 2b. Overdue tasks.
    for (const task of overdueTasks) {
      if (!task.date) continue;
      items.push({
        type: "deadline",
        title: `Task overdue: ${task.title}`,
        detail: `Was due ${task.date}`,
        date: task.date,
        priority: "urgent",
      });
    }

    // 3. Overdue follow-ups.
    for (const fu of overdueFollowups) {
      if (!fu.nextFollowupDate) continue;
      items.push({
        type: "followup",
        title: `Overdue follow-up for client`,
        detail: `Follow-up was due ${fu.nextFollowupDate}${fu.notes ? ` — ${fu.notes}` : ""}`,
        date: fu.nextFollowupDate,
        priority: "warning",
      });
    }

    // 4. Upcoming meetings.
    for (const meeting of upcomingMeetings) {
      items.push({
        type: "meeting",
        title: meeting.agenda ? `Meeting today: ${meeting.agenda}` : "Meeting today",
        detail: meeting.date === today ? "Today" : "Tomorrow",
        date: meeting.date,
        priority: meeting.date === today ? "urgent" : "info",
      });
    }

    // 5. Overdue action items.
    for (const ai of overdueActionItems) {
      if (!ai.deadline) continue;
      items.push({
        type: "followup",
        title: `Overdue action item: ${ai.description}`,
        detail: `Was due ${ai.deadline}${ai.pic ? ` — PIC: ${ai.pic}` : ""}`,
        date: ai.deadline,
        priority: "urgent",
      });
    }

    // Sort: urgent first, then by date ascending.
    const priorityOrder = { urgent: 0, warning: 1, info: 2 } as const;
    items.sort((a, b) => {
      const pa = priorityOrder[a.priority];
      const pb = priorityOrder[b.priority];
      if (pa !== pb) return pa - pb;
      return a.date.localeCompare(b.date);
    });

    return c.json({ data: items });
  } catch (err) {
    console.error("GET /reminders error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to fetch reminders");
  }
});

export default remindersRouter;
