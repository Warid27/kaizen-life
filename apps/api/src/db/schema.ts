import { sqliteTable, text, integer, real, unique, uniqueIndex, index } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

/**
 * Partial-unique helper: uniqueness that ignores soft-deleted rows.
 * Fixes DB3 — with plain UNIQUE constraints, re-creating a soft-deleted row
 * hit the unique index and 500'd (habit logs) or updates landed invisibly on
 * soft-deleted rows (checkins/diary/reviews).
 */
const liveRowsOnly = sql`deleted_at IS NULL`;

// ---------------------------------------------------------------------------
// Users
// ---------------------------------------------------------------------------
export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email"),
    timezone: text("timezone").notNull().default("Asia/Jakarta"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    // Auth groundwork: one live account per email. Partial (live rows only)
    // so a soft-deleted user's address can be reused; multiple NULLs are
    // fine in SQLite unique indexes.
    uniqueIndex("uniq_users_email_live").on(t.email).where(liveRowsOnly),
  ],
);

// ---------------------------------------------------------------------------
// Tasks (universal work-item table — planner, work, college)
// ---------------------------------------------------------------------------
export const tasks = sqliteTable("tasks", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  date: text("date"), // YYYY-MM-DD
  startTime: text("start_time"), // HH:mm
  endTime: text("end_time"),
  estimatedDurationMin: integer("estimated_duration_min"),
  priority: text("priority", {
    enum: ["low", "medium", "high", "urgent"],
  })
    .notNull()
    .default("medium"),
  status: text("status", {
    enum: ["todo", "in_progress", "done", "cancelled"],
  })
    .notNull()
    .default("todo"),
  projectId: text("project_id"), // nullable FK -> projects.id
  courseId: text("course_id"), // nullable FK -> courses.id
  tags: text("tags"), // JSON array as text
  completedAt: integer("completed_at"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => [
  index("idx_tasks_user_date").on(t.userId, t.date),
  index("idx_tasks_user_status").on(t.userId, t.status),
]);

// ---------------------------------------------------------------------------
// Habits
// ---------------------------------------------------------------------------
export const habits = sqliteTable("habits", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  icon: text("icon"),
  category: text("category"),
  frequency: text("frequency", {
    enum: ["daily", "weekly_n", "custom_days"],
  })
    .notNull()
    .default("daily"),
  targetCountPerPeriod: integer("target_count_per_period")
    .notNull()
    .default(1),
  customDays: text("custom_days"), // JSON array of weekday ints, if custom_days
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  archivedAt: integer("archived_at"),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Habit Logs (one row per active day per habit)
// ---------------------------------------------------------------------------
export const habitLogs = sqliteTable(
  "habit_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    habitId: text("habit_id").notNull(),
    date: text("date").notNull(), // YYYY-MM-DD
    completedCount: integer("completed_count").notNull().default(0),
    targetCount: integer("target_count").notNull(),
    note: text("note"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    uniqueIndex("uniq_habit_logs_habit_date_live")
      .on(t.habitId, t.date)
      .where(liveRowsOnly),
    index("idx_habit_logs_user_date").on(t.userId, t.date),
  ],
);

// ---------------------------------------------------------------------------
// Check-ins (sleep + mood + energy + stress, one per user per date)
// ---------------------------------------------------------------------------
export const checkins = sqliteTable(
  "checkins",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    bedTime: text("bed_time"),
    wakeTime: text("wake_time"),
    napMinutes: integer("nap_minutes").default(0),
    totalSleepMinutes: integer("total_sleep_minutes"),
    sleepQuality: integer("sleep_quality"), // 1-5
    mood: integer("mood"), // 1-10
    energy: integer("energy"), // 1-10
    stress: integer("stress"), // 1-10
    note: text("note"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    uniqueIndex("uniq_checkins_user_date_live")
      .on(t.userId, t.date)
      .where(liveRowsOnly),
  ],
);

// ---------------------------------------------------------------------------
// Diary Entries (one per user per date)
// ---------------------------------------------------------------------------
export const diaryEntries = sqliteTable(
  "diary_entries",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    date: text("date").notNull(),
    gratefulFor: text("grateful_for"),
    lessonLearned: text("lesson_learned"),
    tomorrowFocus: text("tomorrow_focus"),
    freeText: text("free_text"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    uniqueIndex("uniq_diary_user_date_live")
      .on(t.userId, t.date)
      .where(liveRowsOnly),
  ],
);

// ---------------------------------------------------------------------------
// Semesters
// ---------------------------------------------------------------------------
export const semesters = sqliteTable("semesters", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Courses
// ---------------------------------------------------------------------------
export const courses = sqliteTable("courses", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  semesterId: text("semester_id").notNull(),
  name: text("name").notNull(),
  code: text("code"),
  lecturer: text("lecturer"),
  room: text("room"),
  color: text("color"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Course Schedule (weekly recurring class per course)
// ---------------------------------------------------------------------------
export const courseSchedule = sqliteTable("course_schedule", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  courseId: text("course_id").notNull(),
  dayOfWeek: integer("day_of_week").notNull(), // 0-6
  startTime: text("start_time").notNull(),
  endTime: text("end_time").notNull(),
  room: text("room"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Assignments
// ---------------------------------------------------------------------------
export const assignments = sqliteTable("assignments", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  courseId: text("course_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: text("due_date").notNull(),
  priority: text("priority", {
    enum: ["low", "medium", "high", "urgent"],
  })
    .notNull()
    .default("medium"),
  status: text("status", {
    enum: ["not_started", "in_progress", "submitted", "graded"],
  })
    .notNull()
    .default("not_started"),
  grade: text("grade"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => [
  index("idx_assignments_user_due").on(t.userId, t.dueDate),
]);

// ---------------------------------------------------------------------------
// Semester Events (midterm, final, deadline, other)
// ---------------------------------------------------------------------------
export const semesterEvents = sqliteTable("semester_events", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  semesterId: text("semester_id").notNull(),
  title: text("title").notNull(),
  date: text("date").notNull(),
  type: text("type", {
    enum: ["midterm", "final", "deadline", "other"],
  }).notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Team Members
// ---------------------------------------------------------------------------
export const teamMembers = sqliteTable("team_members", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  role: text("role"),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Clients
// ---------------------------------------------------------------------------
export const clients = sqliteTable("clients", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  company: text("company"),
  contactInfo: text("contact_info"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  name: text("name").notNull(),
  clientId: text("client_id"),
  status: text("status", {
    enum: ["planning", "active", "on_hold", "completed", "cancelled"],
  })
    .notNull()
    .default("planning"),
  priority: text("priority", {
    enum: ["low", "medium", "high", "urgent"],
  })
    .notNull()
    .default("medium"),
  deadline: text("deadline"),
  progressPct: integer("progress_pct").notNull().default(0),
  pic: text("pic"),
  description: text("description"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Client Follow-ups (is_overdue computed at query time)
// ---------------------------------------------------------------------------
export const clientFollowups = sqliteTable("client_followups", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  clientId: text("client_id").notNull(),
  lastContactDate: text("last_contact_date"),
  nextFollowupDate: text("next_followup_date"),
  status: text("status", { enum: ["pending", "done"] })
    .notNull()
    .default("pending"),
  notes: text("notes"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => [
  index("idx_followups_user_next_date").on(t.userId, t.nextFollowupDate),
]);

// ---------------------------------------------------------------------------
// Standups (daily standup per team member)
// ---------------------------------------------------------------------------
export const standups = sqliteTable("standups", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  teamMemberId: text("team_member_id").notNull(),
  projectId: text("project_id"),
  date: text("date").notNull(),
  currentTask: text("current_task"),
  todayTarget: text("today_target"),
  actualResult: text("actual_result"),
  blocker: text("blocker"),
  status: text("status", {
    enum: ["on_track", "at_risk", "blocked"],
  })
    .notNull()
    .default("on_track"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => [
  // Plain index (not UNIQUE): existing rows may already violate the natural
  // key, and a unique constraint would break inserts (DB4 noted as debt).
  index("idx_standups_member_date").on(t.teamMemberId, t.date),
]);

// ---------------------------------------------------------------------------
// Meetings
// ---------------------------------------------------------------------------
export const meetings = sqliteTable("meetings", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  projectId: text("project_id"),
  date: text("date").notNull(),
  agenda: text("agenda"),
  decisions: text("decisions"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => [
  index("idx_meetings_user_date").on(t.userId, t.date),
]);

// ---------------------------------------------------------------------------
// Meeting Action Items
// ---------------------------------------------------------------------------
export const meetingActionItems = sqliteTable("meeting_action_items", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  meetingId: text("meeting_id").notNull(),
  description: text("description").notNull(),
  pic: text("pic"),
  deadline: text("deadline"),
  status: text("status", { enum: ["open", "done"] })
    .notNull()
    .default("open"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => [
  index("idx_action_items_user_deadline").on(t.userId, t.deadline),
]);

// ---------------------------------------------------------------------------
// Transactions (finance — amounts in integer cents)
// ---------------------------------------------------------------------------
export const transactions = sqliteTable("transactions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  date: text("date").notNull(),
  type: text("type", { enum: ["income", "expense"] }).notNull(),
  amountCents: integer("amount_cents").notNull(),
  currency: text("currency").notNull().default("idr"),
  category: text("category").notNull(),
  account: text("account", { enum: ["cash", "bank"] }).notNull(),
  note: text("note"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => [
  index("idx_transactions_user_date").on(t.userId, t.date),
]);

// ---------------------------------------------------------------------------
// Goals (self-referential hierarchy: annual → monthly → weekly)
// ---------------------------------------------------------------------------
export const goals = sqliteTable("goals", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  title: text("title").notNull(),
  type: text("type", { enum: ["annual", "monthly", "weekly"] }).notNull(),
  periodStart: text("period_start").notNull(),
  periodEnd: text("period_end").notNull(),
  targetValue: real("target_value"),
  currentValue: real("current_value").default(0),
  unit: text("unit"),
  status: text("status", {
    enum: ["not_started", "in_progress", "completed", "abandoned"],
  })
    .notNull()
    .default("not_started"),
  parentGoalId: text("parent_goal_id"),
  linkedHabitId: text("linked_habit_id"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
});

// ---------------------------------------------------------------------------
// Monthly Reviews (one per user per year/month)
// ---------------------------------------------------------------------------
export const monthlyReviews = sqliteTable(
  "monthly_reviews",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    year: integer("year").notNull(),
    month: integer("month").notNull(),
    biggestAchievement: text("biggest_achievement"),
    biggestLesson: text("biggest_lesson"),
    nextMonthPriorities: text("next_month_priorities"),
    autoSummaryJson: text("auto_summary_json"),
    createdAt: integer("created_at").notNull(),
    updatedAt: integer("updated_at").notNull(),
    deletedAt: integer("deleted_at"),
  },
  (t) => [
    uniqueIndex("uniq_reviews_user_month_live")
      .on(t.userId, t.year, t.month)
      .where(liveRowsOnly),
  ],
);

// ---------------------------------------------------------------------------
// Reminders (polymorphic — reference_type + reference_id)
// ---------------------------------------------------------------------------
export const reminders = sqliteTable("reminders", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  type: text("type", {
    enum: ["habit", "deadline", "followup", "meeting"],
  }).notNull(),
  referenceType: text("reference_type").notNull(),
  referenceId: text("reference_id").notNull(),
  triggerAt: integer("trigger_at").notNull(),
  status: text("status", {
    enum: ["pending", "sent", "dismissed"],
  })
    .notNull()
    .default("pending"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
  deletedAt: integer("deleted_at"),
}, (t) => [
  index("idx_reminders_status_trigger").on(t.status, t.triggerAt),
]);

// ---------------------------------------------------------------------------
// Web Push subscriptions (one row per browser endpoint; hard-deleted, no soft delete)
// ---------------------------------------------------------------------------
export const pushSubscriptions = sqliteTable("push_subscriptions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  /** Push-service endpoint URL � globally unique per browser subscription. */
  endpoint: text("endpoint").notNull(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  userAgent: text("user_agent"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
}, (t) => [
  uniqueIndex("push_subscriptions_endpoint_unique").on(t.endpoint),
  index("idx_push_subscriptions_user_id").on(t.userId),
]);
