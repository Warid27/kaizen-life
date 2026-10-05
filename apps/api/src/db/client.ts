import { drizzle as drizzleD1 } from "drizzle-orm/d1";
import { drizzle as drizzleSqlite } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";
import * as schema from "./schema";

// D1 binding is injected via Cloudflare Workers env (c.env.DB)
export type Bindings = {
  DB?: any;
  ENVIRONMENT?: string;
  /** When set (prod secret), all requests require Authorization: Bearer <token>. */
  API_TOKEN?: string;
  /**
   * When set (prod secret), real auth is enforced: requests need a valid
   * `kaizen_session` cookie (HMAC-signed by /api/auth/login). Unset = local
   * dev frictionless mode with the shared default-user identity.
   */
  AUTH_SECRET?: string;
  /** Optional override for PBKDF2 iterations (10000–1000000; default 100000). */
  PBKDF2_ITERATIONS?: string;
  /** VAPID keypair for Web Push (secrets). Push is disabled when unset. */
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
};

let localDb: any = null;

function initLocalSqlite() {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");

  const DDL = `
CREATE TABLE IF NOT EXISTS users (
  id text PRIMARY KEY NOT NULL,
  name text NOT NULL,
  email text,
  password_hash text,
  timezone text DEFAULT 'Asia/Jakarta' NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_users_email_live ON users (email) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS semesters (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  start_date text NOT NULL,
  end_date text NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS courses (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  semester_id text NOT NULL,
  name text NOT NULL,
  code text,
  lecturer text,
  room text,
  color text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS course_schedule (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  course_id text NOT NULL,
  day_of_week integer NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  room text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS semester_events (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  semester_id text NOT NULL,
  title text NOT NULL,
  date text NOT NULL,
  type text NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS assignments (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  course_id text NOT NULL,
  title text NOT NULL,
  description text,
  due_date text NOT NULL,
  priority text DEFAULT 'medium' NOT NULL,
  status text DEFAULT 'not_started' NOT NULL,
  grade text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE INDEX IF NOT EXISTS idx_assignments_user_due ON assignments (user_id, due_date);

CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  description text,
  date text,
  start_time text,
  end_time text,
  estimated_duration_min integer,
  priority text DEFAULT 'medium' NOT NULL,
  status text DEFAULT 'todo' NOT NULL,
  project_id text,
  course_id text,
  tags text,
  completed_at integer,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE INDEX IF NOT EXISTS idx_tasks_user_date ON tasks (user_id, date);
CREATE INDEX IF NOT EXISTS idx_tasks_user_status ON tasks (user_id, status);

CREATE TABLE IF NOT EXISTS habits (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  icon text,
  category text,
  frequency text DEFAULT 'daily' NOT NULL,
  target_count_per_period integer DEFAULT 1 NOT NULL,
  custom_days text,
  active integer DEFAULT 1 NOT NULL,
  sort_order integer DEFAULT 0 NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  archived_at integer,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS habit_logs (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  habit_id text NOT NULL,
  date text NOT NULL,
  completed_count integer DEFAULT 0 NOT NULL,
  target_count integer NOT NULL,
  note text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_habit_logs_habit_date_live ON habit_logs (habit_id, date) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_habit_logs_user_date ON habit_logs (user_id, date);

CREATE TABLE IF NOT EXISTS checkins (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  date text NOT NULL,
  bed_time text,
  wake_time text,
  nap_minutes integer DEFAULT 0,
  total_sleep_minutes integer,
  sleep_quality integer,
  mood integer,
  energy integer,
  stress integer,
  note text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_checkins_user_date_live ON checkins (user_id, date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS diary_entries (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  date text NOT NULL,
  grateful_for text,
  lesson_learned text,
  tomorrow_focus text,
  free_text text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_diary_user_date_live ON diary_entries (user_id, date) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS clients (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  company text,
  contact_info text,
  notes text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS client_followups (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  client_id text NOT NULL,
  last_contact_date text,
  next_followup_date text,
  status text DEFAULT 'pending' NOT NULL,
  notes text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE INDEX IF NOT EXISTS idx_followups_user_next_date ON client_followups (user_id, next_followup_date);

CREATE TABLE IF NOT EXISTS team_members (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  role text,
  active integer DEFAULT 1 NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS projects (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  name text NOT NULL,
  client_id text,
  status text DEFAULT 'planning' NOT NULL,
  priority text DEFAULT 'medium' NOT NULL,
  deadline text,
  progress_pct integer DEFAULT 0 NOT NULL,
  pic text,
  description text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS standups (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  team_member_id text NOT NULL,
  project_id text,
  date text NOT NULL,
  current_task text,
  today_target text,
  actual_result text,
  blocker text,
  status text DEFAULT 'on_track' NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE INDEX IF NOT EXISTS idx_standups_member_date ON standups (team_member_id, date);

CREATE TABLE IF NOT EXISTS meetings (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  project_id text,
  date text NOT NULL,
  agenda text,
  decisions text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE INDEX IF NOT EXISTS idx_meetings_user_date ON meetings (user_id, date);

CREATE TABLE IF NOT EXISTS meeting_action_items (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  meeting_id text NOT NULL,
  description text NOT NULL,
  pic text,
  deadline text,
  status text DEFAULT 'open' NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE INDEX IF NOT EXISTS idx_action_items_user_deadline ON meeting_action_items (user_id, deadline);

CREATE TABLE IF NOT EXISTS transactions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  date text NOT NULL,
  type text NOT NULL,
  amount_cents integer NOT NULL,
  currency text DEFAULT 'idr' NOT NULL,
  category text NOT NULL,
  account text NOT NULL,
  note text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions (user_id, date);

CREATE TABLE IF NOT EXISTS goals (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  title text NOT NULL,
  type text NOT NULL,
  period_start text NOT NULL,
  period_end text NOT NULL,
  target_value real,
  current_value real DEFAULT 0,
  unit text,
  status text DEFAULT 'not_started' NOT NULL,
  parent_goal_id text,
  linked_habit_id text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);

CREATE TABLE IF NOT EXISTS monthly_reviews (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL,
  biggest_achievement text,
  biggest_lesson text,
  next_month_priorities text,
  auto_summary_json text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_reviews_user_month_live ON monthly_reviews (user_id, year, month) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS reminders (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  type text NOT NULL,
  reference_type text NOT NULL,
  reference_id text NOT NULL,
  trigger_at integer NOT NULL,
  status text DEFAULT 'pending' NOT NULL,
  created_at integer NOT NULL,
  updated_at integer NOT NULL,
  deleted_at integer
);
CREATE INDEX IF NOT EXISTS idx_reminders_status_trigger ON reminders (status, trigger_at);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  endpoint text NOT NULL,
  p256dh text NOT NULL,
  auth text NOT NULL,
  user_agent text,
  created_at integer NOT NULL,
  updated_at integer NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_unique ON push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions (user_id);
`;

  sqlite.exec(DDL);

  const nowSec = Math.floor(Date.now() / 1000);
  const todayStr = new Date().toISOString().slice(0, 10);

  // Seed default-user
  sqlite.prepare(`
    INSERT OR IGNORE INTO users (id, name, email, timezone, created_at, updated_at)
    VALUES ('default-user', 'Operator', 'operator@example.com', 'Asia/Jakarta', ?, ?)
  `).run(nowSec, nowSec);

  // Seed sample semester
  sqlite.prepare(`
    INSERT OR IGNORE INTO semesters (id, user_id, name, start_date, end_date, created_at, updated_at)
    VALUES ('sem-1', 'default-user', 'Fall Semester 2026', '2026-09-01', '2027-01-31', ?, ?)
  `).run(nowSec, nowSec);

  // Seed sample course
  sqlite.prepare(`
    INSERT OR IGNORE INTO courses (id, user_id, semester_id, name, code, lecturer, room, color, created_at, updated_at)
    VALUES ('course-1', 'default-user', 'sem-1', 'Advanced Software Engineering', 'CS401', 'Prof. Smith', 'Hall B', '#3b82f6', ?, ?)
  `).run(nowSec, nowSec);

  // Seed sample project
  sqlite.prepare(`
    INSERT OR IGNORE INTO projects (id, user_id, name, status, priority, progress_pct, description, created_at, updated_at)
    VALUES ('proj-1', 'default-user', 'KaizenLife Workspace', 'active', 'high', 75, 'Personal life & work operating system', ?, ?)
  `).run(nowSec, nowSec);

  // Seed sample tasks
  sqlite.prepare(`
    INSERT OR IGNORE INTO tasks (id, user_id, title, description, date, priority, status, created_at, updated_at)
    VALUES
      ('task-1', 'default-user', 'Review weekly sprint priorities', 'Align with sprint milestones', ?, 'high', 'todo', ?, ?),
      ('task-2', 'default-user', 'Prepare client progress report', 'Summary of deliverable updates', ?, 'medium', 'in_progress', ?, ?),
      ('task-3', 'default-user', 'Morning workout & meditation', '30 min cardio and breathwork', ?, 'low', 'done', ?, ?)
  `).run(todayStr, nowSec, nowSec, todayStr, nowSec, nowSec, todayStr, nowSec, nowSec);

  // Seed sample habits
  sqlite.prepare(`
    INSERT OR IGNORE INTO habits (id, user_id, name, icon, category, frequency, target_count_per_period, active, sort_order, created_at, updated_at)
    VALUES
      ('habit-1', 'default-user', 'Read 20 pages', '📖', 'spiritual', 'daily', 1, 1, 1, ?, ?),
      ('habit-2', 'default-user', 'Drink 2.5L Water', '💧', 'health', 'daily', 1, 1, 2, ?, ?),
      ('habit-3', 'default-user', 'Daily Journaling', '✍️', 'mindfulness', 'daily', 1, 1, 3, ?, ?)
  `).run(nowSec, nowSec, nowSec, nowSec, nowSec, nowSec);

  // Seed sample transactions for current month
  const ym = todayStr.slice(0, 7);
  sqlite.prepare(`
    INSERT OR IGNORE INTO transactions (id, user_id, date, type, amount_cents, currency, category, account, note, created_at, updated_at)
    VALUES
      ('tx-1', 'default-user', '${ym}-01', 'income', 1500000000, 'idr', 'Salary', 'bank', 'Monthly Base Salary', ?, ?),
      ('tx-2', 'default-user', '${ym}-02', 'income', 350000000, 'idr', 'Freelance', 'bank', 'Web Design Project Milestone', ?, ?),
      ('tx-3', 'default-user', '${ym}-02', 'expense', 45000000, 'idr', 'Housing', 'bank', 'Internet & Utilities', ?, ?),
      ('tx-4', 'default-user', '${ym}-03', 'expense', 12500000, 'idr', 'Food & Dining', 'cash', 'Team lunch & groceries', ?, ?),
      ('tx-5', 'default-user', '${ym}-04', 'expense', 6000000, 'idr', 'Transportation', 'cash', 'Commute & fuel', ?, ?),
      ('tx-6', 'default-user', ?, 'expense', 18500000, 'idr', 'Subscriptions', 'bank', 'Cloud hosting & software licenses', ?, ?)
  `).run(nowSec, nowSec, nowSec, nowSec, nowSec, nowSec, nowSec, nowSec, nowSec, nowSec, todayStr, nowSec, nowSec);

  return drizzleSqlite(sqlite, { schema });
}

export function createDb(env?: Bindings) {
  if (env?.DB && typeof env.DB.prepare === "function") {
    try {
      return drizzleD1(env.DB, { schema });
    } catch {
      // Fall through to local sqlite
    }
  }

  if (!localDb) {
    try {
      localDb = initLocalSqlite();
    } catch (err) {
      console.warn("[AI Studio] SQLite initialization failed, using mock", err);
      const noOp = {
        findMany: async () => [],
        findFirst: async () => null,
        findUnique: async () => null,
        create: async (d: any) => d?.data ?? {},
        update: async (d: any) => d?.data ?? {},
        delete: async () => ({}),
      };
      localDb = new Proxy({}, {
        get: (_, prop) =>
          prop === "query"
            ? new Proxy({}, { get: () => noOp })
            : () => ({
                from: () => ({
                  where: () => ({
                    get: async () => null,
                    all: async () => [],
                    limit: () => ({ all: async () => [] }),
                  }),
                  get: async () => null,
                  all: async () => [],
                }),
              }),
      });
    }
  }

  return localDb;
}

export type AppDb = ReturnType<typeof createDb>;
