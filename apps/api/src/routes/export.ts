import { Hono } from "hono";
import type { Bindings, AppDb } from "../db/client";
import {
  tasks,
  habits,
  habitLogs,
  checkins,
  diaryEntries,
  semesters,
  semesterEvents,
  courses,
  courseSchedule,
  assignments,
  teamMembers,
  clients,
  projects,
  clientFollowups,
  standups,
  meetings,
  meetingActionItems,
  transactions,
  goals,
  monthlyReviews,
  reminders,
} from "../db/schema";
import { eq } from "drizzle-orm";

type RouteEnv = { Bindings: Bindings; Variables: { db: AppDb; userId: string } };

const exportRouter = new Hono<RouteEnv>();

// GET /api/export/json — full-data backup as a downloadable JSON document.
// Previously called by the Settings page with no server implementation (B1).
exportRouter.get("/export/json", async (c) => {
  const db = c.get("db");
  const userId = c.get("userId");

  // Each table scoped to the requesting user; soft-deleted rows are included
  // so a backup can faithfully restore history.
  const [
    taskRows,
    habitRows,
    habitLogRows,
    checkinRows,
    diaryRows,
    semesterRows,
    semesterEventRows,
    courseRows,
    courseScheduleRows,
    assignmentRows,
    teamMemberRows,
    clientRows,
    projectRows,
    followupRows,
    standupRows,
    meetingRows,
    actionItemRows,
    transactionRows,
    goalRows,
    reviewRows,
    reminderRows,
  ] = await Promise.all([
    db.select().from(tasks).where(eq(tasks.userId, userId)).all(),
    db.select().from(habits).where(eq(habits.userId, userId)).all(),
    db.select().from(habitLogs).where(eq(habitLogs.userId, userId)).all(),
    db.select().from(checkins).where(eq(checkins.userId, userId)).all(),
    db.select().from(diaryEntries).where(eq(diaryEntries.userId, userId)).all(),
    db.select().from(semesters).where(eq(semesters.userId, userId)).all(),
    db.select().from(semesterEvents).where(eq(semesterEvents.userId, userId)).all(),
    db.select().from(courses).where(eq(courses.userId, userId)).all(),
    db.select().from(courseSchedule).where(eq(courseSchedule.userId, userId)).all(),
    db.select().from(assignments).where(eq(assignments.userId, userId)).all(),
    db.select().from(teamMembers).where(eq(teamMembers.userId, userId)).all(),
    db.select().from(clients).where(eq(clients.userId, userId)).all(),
    db.select().from(projects).where(eq(projects.userId, userId)).all(),
    db.select().from(clientFollowups).where(eq(clientFollowups.userId, userId)).all(),
    db.select().from(standups).where(eq(standups.userId, userId)).all(),
    db.select().from(meetings).where(eq(meetings.userId, userId)).all(),
    db.select().from(meetingActionItems).where(eq(meetingActionItems.userId, userId)).all(),
    db.select().from(transactions).where(eq(transactions.userId, userId)).all(),
    db.select().from(goals).where(eq(goals.userId, userId)).all(),
    db.select().from(monthlyReviews).where(eq(monthlyReviews.userId, userId)).all(),
    db.select().from(reminders).where(eq(reminders.userId, userId)).all(),
  ]);

  const today = new Date().toISOString().slice(0, 10);

  return c.json(
    {
      exportedAt: new Date().toISOString(),
      schemaVersion: 1,
      data: {
        tasks: taskRows,
        habits: habitRows,
        habitLogs: habitLogRows,
        checkins: checkinRows,
        diaryEntries: diaryRows,
        semesters: semesterRows,
        semesterEvents: semesterEventRows,
        courses: courseRows,
        courseSchedule: courseScheduleRows,
        assignments: assignmentRows,
        teamMembers: teamMemberRows,
        clients: clientRows,
        projects: projectRows,
        clientFollowups: followupRows,
        standups: standupRows,
        meetings: meetingRows,
        meetingActionItems: actionItemRows,
        transactions: transactionRows,
        goals: goalRows,
        monthlyReviews: reviewRows,
        reminders: reminderRows,
      },
    },
    200,
    {
      "Content-Disposition": `attachment; filename="kaizenlife-export-${today}.json"`,
    },
  );
});

export default exportRouter;
