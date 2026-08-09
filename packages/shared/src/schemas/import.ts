import { z } from "zod";

// ---------------------------------------------------------------------------
// Entity Types Enum — all 22 importable tables
// ---------------------------------------------------------------------------
export const EntityTypeSchema = z.enum([
  "transactions",
  "tasks",
  "habits",
  "habitLogs",
  "checkins",
  "diaryEntries",
  "goals",
  "projects",
  "clients",
  "clientFollowups",
  "teamMembers",
  "standups",
  "meetings",
  "meetingActionItems",
  "semesters",
  "courses",
  "courseSchedule",
  "assignments",
  "semesterEvents",
  "monthlyReviews",
  "users",
  "reminders",
]);
export type EntityType = z.infer<typeof EntityTypeSchema>;

// ---------------------------------------------------------------------------
// Column Mapping — maps Excel column header → DB field name
// ---------------------------------------------------------------------------
export const ColumnMappingSchema = z.record(z.string(), z.string());
export type ColumnMapping = z.infer<typeof ColumnMappingSchema>;

// ---------------------------------------------------------------------------
// Upload Response
// ---------------------------------------------------------------------------
export const UploadResponseSchema = z.object({
  sessionId: z.string(),
  headers: z.array(z.string()),
  totalRows: z.number(),
  previewRows: z.array(z.record(z.string(), z.unknown())).max(100),
});
export type UploadResponse = z.infer<typeof UploadResponseSchema>;

// ---------------------------------------------------------------------------
// Preview Request
// ---------------------------------------------------------------------------
export const PreviewRequestSchema = z.object({
  sessionId: z.string(),
  entityType: EntityTypeSchema,
  mapping: ColumnMappingSchema,
});
export type PreviewRequest = z.infer<typeof PreviewRequestSchema>;

// ---------------------------------------------------------------------------
// Row Validation Error
// ---------------------------------------------------------------------------
export const RowErrorSchema = z.object({
  row: z.number(),
  field: z.string(),
  message: z.string(),
});
export type RowError = z.infer<typeof RowErrorSchema>;

// ---------------------------------------------------------------------------
// Preview Response
// ---------------------------------------------------------------------------
export const PreviewResponseSchema = z.object({
  totalRows: z.number(),
  validRows: z.number(),
  invalidRows: z.number(),
  errors: z.array(RowErrorSchema),
  mappedData: z.array(z.record(z.string(), z.unknown())),
});
export type PreviewResponse = z.infer<typeof PreviewResponseSchema>;

// ---------------------------------------------------------------------------
// Import Request
// ---------------------------------------------------------------------------
export const ImportRequestSchema = z.object({
  sessionId: z.string(),
  entityType: EntityTypeSchema,
  mapping: ColumnMappingSchema,
});
export type ImportRequest = z.infer<typeof ImportRequestSchema>;

// ---------------------------------------------------------------------------
// Import Response
// ---------------------------------------------------------------------------
export const ImportResponseSchema = z.object({
  imported: z.number(),
  skipped: z.number(),
  errors: z.array(RowErrorSchema),
});
export type ImportResponse = z.infer<typeof ImportResponseSchema>;

// ---------------------------------------------------------------------------
// Entity Field Definition (for column-mapping UI)
// ---------------------------------------------------------------------------
export const EntityFieldSchema = z.object({
  key: z.string(),
  label: z.string(),
  type: z.enum(["string", "number", "date", "enum", "boolean"]),
  required: z.boolean(),
  enumValues: z.array(z.string()).optional(),
});
export type EntityField = z.infer<typeof EntityFieldSchema>;

// ---------------------------------------------------------------------------
// Entity Schema Definition
// ---------------------------------------------------------------------------
export const EntitySchemaDefinitionSchema = z.object({
  entityType: EntityTypeSchema,
  label: z.string(),
  fields: z.array(EntityFieldSchema),
});
export type EntitySchemaDefinition = z.infer<typeof EntitySchemaDefinitionSchema>;

// ===========================================================================
// ENTITY FIELD DEFINITIONS — all 22 entity types
// Fields: importable user-provided fields only (excludes id, userId,
//         createdAt, updatedAt, deletedAt which are auto-generated)
// ===========================================================================
export const ENTITY_FIELD_DEFINITIONS: Record<
  EntityType,
  EntitySchemaDefinition
> = {
  // ─── Transactions ───────────────────────────────────────────────────────────
  transactions: {
    entityType: "transactions",
    label: "Finance Transactions",
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      {
        key: "type",
        label: "Type",
        type: "enum",
        required: true,
        enumValues: ["income", "expense"],
      },
      {
        key: "amountCents",
        label: "Amount (cents)",
        type: "number",
        required: true,
      },
      { key: "category", label: "Category", type: "string", required: true },
      {
        key: "account",
        label: "Account",
        type: "enum",
        required: true,
        enumValues: ["cash", "bank"],
      },
      { key: "note", label: "Note", type: "string", required: false },
    ],
  },

  // ─── Tasks ──────────────────────────────────────────────────────────────────
  tasks: {
    entityType: "tasks",
    label: "Tasks",
    fields: [
      { key: "title", label: "Title", type: "string", required: true },
      {
        key: "description",
        label: "Description",
        type: "string",
        required: false,
      },
      { key: "date", label: "Date", type: "date", required: false },
      {
        key: "startTime",
        label: "Start Time",
        type: "string",
        required: false,
      },
      { key: "endTime", label: "End Time", type: "string", required: false },
      {
        key: "estimatedDurationMin",
        label: "Estimated Duration (min)",
        type: "number",
        required: false,
      },
      {
        key: "priority",
        label: "Priority",
        type: "enum",
        required: false,
        enumValues: ["low", "medium", "high", "urgent"],
      },
      {
        key: "status",
        label: "Status",
        type: "enum",
        required: false,
        enumValues: ["todo", "in_progress", "done", "cancelled"],
      },
      {
        key: "projectId",
        label: "Project ID",
        type: "string",
        required: false,
      },
      { key: "courseId", label: "Course ID", type: "string", required: false },
      { key: "tags", label: "Tags", type: "string", required: false },
    ],
  },

  // ─── Habits ─────────────────────────────────────────────────────────────────
  habits: {
    entityType: "habits",
    label: "Habits",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "icon", label: "Icon", type: "string", required: false },
      { key: "category", label: "Category", type: "string", required: false },
      {
        key: "frequency",
        label: "Frequency",
        type: "enum",
        required: false,
        enumValues: ["daily", "weekly_n", "custom_days"],
      },
      {
        key: "targetCountPerPeriod",
        label: "Target Count Per Period",
        type: "number",
        required: false,
      },
      {
        key: "customDays",
        label: "Custom Days (JSON)",
        type: "string",
        required: false,
      },
      { key: "active", label: "Active", type: "boolean", required: false },
      {
        key: "sortOrder",
        label: "Sort Order",
        type: "number",
        required: false,
      },
    ],
  },

  // ─── Habit Logs ─────────────────────────────────────────────────────────────
  habitLogs: {
    entityType: "habitLogs",
    label: "Habit Logs",
    fields: [
      { key: "habitId", label: "Habit ID", type: "string", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      {
        key: "completedCount",
        label: "Completed Count",
        type: "number",
        required: false,
      },
      {
        key: "targetCount",
        label: "Target Count",
        type: "number",
        required: true,
      },
      { key: "note", label: "Note", type: "string", required: false },
    ],
  },

  // ─── Check-ins ──────────────────────────────────────────────────────────────
  checkins: {
    entityType: "checkins",
    label: "Daily Check-ins",
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      {
        key: "bedTime",
        label: "Bed Time",
        type: "string",
        required: false,
      },
      {
        key: "wakeTime",
        label: "Wake Time",
        type: "string",
        required: false,
      },
      {
        key: "napMinutes",
        label: "Nap Minutes",
        type: "number",
        required: false,
      },
      {
        key: "totalSleepMinutes",
        label: "Total Sleep Minutes",
        type: "number",
        required: false,
      },
      {
        key: "sleepQuality",
        label: "Sleep Quality (1-5)",
        type: "number",
        required: false,
      },
      { key: "mood", label: "Mood (1-10)", type: "number", required: false },
      {
        key: "energy",
        label: "Energy (1-10)",
        type: "number",
        required: false,
      },
      {
        key: "stress",
        label: "Stress (1-10)",
        type: "number",
        required: false,
      },
      { key: "note", label: "Note", type: "string", required: false },
    ],
  },

  // ─── Diary Entries ──────────────────────────────────────────────────────────
  diaryEntries: {
    entityType: "diaryEntries",
    label: "Diary Entries",
    fields: [
      { key: "date", label: "Date", type: "date", required: true },
      {
        key: "gratefulFor",
        label: "Grateful For",
        type: "string",
        required: false,
      },
      {
        key: "lessonLearned",
        label: "Lesson Learned",
        type: "string",
        required: false,
      },
      {
        key: "tomorrowFocus",
        label: "Tomorrow Focus",
        type: "string",
        required: false,
      },
      { key: "freeText", label: "Free Text", type: "string", required: false },
    ],
  },

  // ─── Goals ──────────────────────────────────────────────────────────────────
  goals: {
    entityType: "goals",
    label: "Goals",
    fields: [
      { key: "title", label: "Title", type: "string", required: true },
      {
        key: "type",
        label: "Type",
        type: "enum",
        required: true,
        enumValues: ["annual", "monthly", "weekly"],
      },
      {
        key: "periodStart",
        label: "Period Start",
        type: "date",
        required: true,
      },
      { key: "periodEnd", label: "Period End", type: "date", required: true },
      {
        key: "targetValue",
        label: "Target Value",
        type: "number",
        required: false,
      },
      {
        key: "currentValue",
        label: "Current Value",
        type: "number",
        required: false,
      },
      { key: "unit", label: "Unit", type: "string", required: false },
      {
        key: "status",
        label: "Status",
        type: "enum",
        required: false,
        enumValues: ["not_started", "in_progress", "completed", "abandoned"],
      },
      {
        key: "parentGoalId",
        label: "Parent Goal ID",
        type: "string",
        required: false,
      },
      {
        key: "linkedHabitId",
        label: "Linked Habit ID",
        type: "string",
        required: false,
      },
    ],
  },

  // ─── Projects ───────────────────────────────────────────────────────────────
  projects: {
    entityType: "projects",
    label: "Projects",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      {
        key: "clientId",
        label: "Client ID",
        type: "string",
        required: false,
      },
      {
        key: "status",
        label: "Status",
        type: "enum",
        required: false,
        enumValues: ["planning", "active", "on_hold", "completed", "cancelled"],
      },
      {
        key: "priority",
        label: "Priority",
        type: "enum",
        required: false,
        enumValues: ["low", "medium", "high", "urgent"],
      },
      { key: "deadline", label: "Deadline", type: "date", required: false },
      {
        key: "progressPct",
        label: "Progress %",
        type: "number",
        required: false,
      },
      { key: "pic", label: "Person In Charge", type: "string", required: false },
      {
        key: "description",
        label: "Description",
        type: "string",
        required: false,
      },
    ],
  },

  // ─── Clients ────────────────────────────────────────────────────────────────
  clients: {
    entityType: "clients",
    label: "Clients",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "company", label: "Company", type: "string", required: false },
      {
        key: "contactInfo",
        label: "Contact Info",
        type: "string",
        required: false,
      },
      { key: "notes", label: "Notes", type: "string", required: false },
    ],
  },

  // ─── Client Follow-ups ──────────────────────────────────────────────────────
  clientFollowups: {
    entityType: "clientFollowups",
    label: "Client Follow-ups",
    fields: [
      {
        key: "clientId",
        label: "Client ID",
        type: "string",
        required: true,
      },
      {
        key: "lastContactDate",
        label: "Last Contact Date",
        type: "date",
        required: false,
      },
      {
        key: "nextFollowupDate",
        label: "Next Follow-up Date",
        type: "date",
        required: false,
      },
      {
        key: "status",
        label: "Status",
        type: "enum",
        required: false,
        enumValues: ["pending", "done"],
      },
      { key: "notes", label: "Notes", type: "string", required: false },
    ],
  },

  // ─── Team Members ───────────────────────────────────────────────────────────
  teamMembers: {
    entityType: "teamMembers",
    label: "Team Members",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "role", label: "Role", type: "string", required: false },
      { key: "active", label: "Active", type: "boolean", required: false },
    ],
  },

  // ─── Standups ───────────────────────────────────────────────────────────────
  standups: {
    entityType: "standups",
    label: "Standups",
    fields: [
      {
        key: "teamMemberId",
        label: "Team Member ID",
        type: "string",
        required: true,
      },
      {
        key: "projectId",
        label: "Project ID",
        type: "string",
        required: false,
      },
      { key: "date", label: "Date", type: "date", required: true },
      {
        key: "currentTask",
        label: "Current Task",
        type: "string",
        required: false,
      },
      {
        key: "todayTarget",
        label: "Today Target",
        type: "string",
        required: false,
      },
      {
        key: "actualResult",
        label: "Actual Result",
        type: "string",
        required: false,
      },
      { key: "blocker", label: "Blocker", type: "string", required: false },
      {
        key: "status",
        label: "Status",
        type: "enum",
        required: false,
        enumValues: ["on_track", "at_risk", "blocked"],
      },
    ],
  },

  // ─── Meetings ───────────────────────────────────────────────────────────────
  meetings: {
    entityType: "meetings",
    label: "Meetings",
    fields: [
      {
        key: "projectId",
        label: "Project ID",
        type: "string",
        required: false,
      },
      { key: "date", label: "Date", type: "date", required: true },
      { key: "agenda", label: "Agenda", type: "string", required: false },
      {
        key: "decisions",
        label: "Decisions",
        type: "string",
        required: false,
      },
    ],
  },

  // ─── Meeting Action Items ───────────────────────────────────────────────────
  meetingActionItems: {
    entityType: "meetingActionItems",
    label: "Meeting Action Items",
    fields: [
      {
        key: "meetingId",
        label: "Meeting ID",
        type: "string",
        required: true,
      },
      {
        key: "description",
        label: "Description",
        type: "string",
        required: true,
      },
      { key: "pic", label: "Person In Charge", type: "string", required: false },
      { key: "deadline", label: "Deadline", type: "date", required: false },
      {
        key: "status",
        label: "Status",
        type: "enum",
        required: false,
        enumValues: ["open", "done"],
      },
    ],
  },

  // ─── Semesters ──────────────────────────────────────────────────────────────
  semesters: {
    entityType: "semesters",
    label: "Semesters",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      {
        key: "startDate",
        label: "Start Date",
        type: "date",
        required: true,
      },
      { key: "endDate", label: "End Date", type: "date", required: true },
    ],
  },

  // ─── Courses ────────────────────────────────────────────────────────────────
  courses: {
    entityType: "courses",
    label: "Courses",
    fields: [
      {
        key: "semesterId",
        label: "Semester ID",
        type: "string",
        required: true,
      },
      { key: "name", label: "Name", type: "string", required: true },
      { key: "code", label: "Code", type: "string", required: false },
      { key: "lecturer", label: "Lecturer", type: "string", required: false },
      { key: "room", label: "Room", type: "string", required: false },
      { key: "color", label: "Color", type: "string", required: false },
    ],
  },

  // ─── Course Schedule ────────────────────────────────────────────────────────
  courseSchedule: {
    entityType: "courseSchedule",
    label: "Course Schedule",
    fields: [
      { key: "courseId", label: "Course ID", type: "string", required: true },
      {
        key: "dayOfWeek",
        label: "Day of Week (0-6)",
        type: "number",
        required: true,
      },
      {
        key: "startTime",
        label: "Start Time",
        type: "string",
        required: true,
      },
      { key: "endTime", label: "End Time", type: "string", required: true },
      { key: "room", label: "Room", type: "string", required: false },
    ],
  },

  // ─── Assignments ────────────────────────────────────────────────────────────
  assignments: {
    entityType: "assignments",
    label: "Assignments",
    fields: [
      { key: "courseId", label: "Course ID", type: "string", required: true },
      { key: "title", label: "Title", type: "string", required: true },
      {
        key: "description",
        label: "Description",
        type: "string",
        required: false,
      },
      { key: "dueDate", label: "Due Date", type: "date", required: true },
      {
        key: "priority",
        label: "Priority",
        type: "enum",
        required: false,
        enumValues: ["low", "medium", "high", "urgent"],
      },
      {
        key: "status",
        label: "Status",
        type: "enum",
        required: false,
        enumValues: ["not_started", "in_progress", "submitted", "graded"],
      },
      { key: "grade", label: "Grade", type: "string", required: false },
    ],
  },

  // ─── Semester Events ────────────────────────────────────────────────────────
  semesterEvents: {
    entityType: "semesterEvents",
    label: "Semester Events",
    fields: [
      {
        key: "semesterId",
        label: "Semester ID",
        type: "string",
        required: true,
      },
      { key: "title", label: "Title", type: "string", required: true },
      { key: "date", label: "Date", type: "date", required: true },
      {
        key: "type",
        label: "Type",
        type: "enum",
        required: true,
        enumValues: ["midterm", "final", "deadline", "other"],
      },
    ],
  },

  // ─── Monthly Reviews ────────────────────────────────────────────────────────
  monthlyReviews: {
    entityType: "monthlyReviews",
    label: "Monthly Reviews",
    fields: [
      { key: "year", label: "Year", type: "number", required: true },
      { key: "month", label: "Month", type: "number", required: true },
      {
        key: "biggestAchievement",
        label: "Biggest Achievement",
        type: "string",
        required: false,
      },
      {
        key: "biggestLesson",
        label: "Biggest Lesson",
        type: "string",
        required: false,
      },
      {
        key: "nextMonthPriorities",
        label: "Next Month Priorities",
        type: "string",
        required: false,
      },
      {
        key: "autoSummaryJson",
        label: "Auto Summary (JSON)",
        type: "string",
        required: false,
      },
    ],
  },

  // ─── Users ──────────────────────────────────────────────────────────────────
  users: {
    entityType: "users",
    label: "Users",
    fields: [
      { key: "name", label: "Name", type: "string", required: true },
      { key: "email", label: "Email", type: "string", required: false },
      { key: "timezone", label: "Timezone", type: "string", required: false },
    ],
  },

  // ─── Reminders ──────────────────────────────────────────────────────────────
  reminders: {
    entityType: "reminders",
    label: "Reminders",
    fields: [
      {
        key: "type",
        label: "Type",
        type: "enum",
        required: true,
        enumValues: ["habit", "deadline", "followup", "meeting"],
      },
      {
        key: "referenceType",
        label: "Reference Type",
        type: "string",
        required: true,
      },
      {
        key: "referenceId",
        label: "Reference ID",
        type: "string",
        required: true,
      },
      {
        key: "triggerAt",
        label: "Trigger At (unix timestamp)",
        type: "number",
        required: true,
      },
      {
        key: "status",
        label: "Status",
        type: "enum",
        required: false,
        enumValues: ["pending", "sent", "dismissed"],
      },
    ],
  },
};

// ===========================================================================
// VALIDATION SCHEMAS — one per entity type for import row validation
// ===========================================================================

const YYYYMMDD = /^\d{4}-\d{2}-\d{2}$/;
const HHmm = /^\d{2}:\d{2}$/;

// ─── Transaction ────────────────────────────────────────────────────────────
export const TransactionImportSchema = z.object({
  date: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  type: z.enum(["income", "expense"]),
  amountCents: z.coerce.number().int().min(0, "Amount must be non-negative"),
  category: z.string().min(1, "Category is required"),
  account: z.enum(["cash", "bank"]),
  note: z.string().optional(),
});

// ─── Task ───────────────────────────────────────────────────────────────────
export const TaskImportSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  date: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD").optional(),
  startTime: z.string().regex(HHmm, "Time must be HH:mm").optional(),
  endTime: z.string().regex(HHmm, "Time must be HH:mm").optional(),
  estimatedDurationMin: z.coerce.number().int().min(0).optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z
    .enum(["todo", "in_progress", "done", "cancelled"])
    .default("todo"),
  projectId: z.string().optional(),
  courseId: z.string().optional(),
  tags: z.string().optional(),
});

// ─── Habit ──────────────────────────────────────────────────────────────────
export const HabitImportSchema = z.object({
  name: z.string().min(1).max(100),
  icon: z.string().optional(),
  category: z.string().optional(),
  frequency: z.enum(["daily", "weekly_n", "custom_days"]).default("daily"),
  targetCountPerPeriod: z.coerce.number().int().min(1).default(1),
  customDays: z.string().optional(),
  active: z.coerce.boolean().default(true),
  sortOrder: z.coerce.number().int().default(0),
});

// ─── Habit Log ──────────────────────────────────────────────────────────────
export const HabitLogImportSchema = z.object({
  habitId: z.string().min(1, "Habit ID is required"),
  date: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  completedCount: z.coerce.number().int().min(0).default(0),
  targetCount: z.coerce.number().int().min(1),
  note: z.string().optional(),
});

// ─── Check-in ───────────────────────────────────────────────────────────────
export const CheckinImportSchema = z.object({
  date: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  bedTime: z.string().regex(HHmm, "Time must be HH:mm").optional(),
  wakeTime: z.string().regex(HHmm, "Time must be HH:mm").optional(),
  napMinutes: z.coerce.number().int().min(0).default(0),
  totalSleepMinutes: z.coerce.number().int().min(0).optional(),
  sleepQuality: z.coerce.number().int().min(1).max(5).optional(),
  mood: z.coerce.number().int().min(1).max(10).optional(),
  energy: z.coerce.number().int().min(1).max(10).optional(),
  stress: z.coerce.number().int().min(1).max(10).optional(),
  note: z.string().optional(),
});

// ─── Diary Entry ────────────────────────────────────────────────────────────
export const DiaryEntryImportSchema = z.object({
  date: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  gratefulFor: z.string().optional(),
  lessonLearned: z.string().optional(),
  tomorrowFocus: z.string().optional(),
  freeText: z.string().optional(),
});

// ─── Goal ───────────────────────────────────────────────────────────────────
export const GoalImportSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["annual", "monthly", "weekly"]),
  periodStart: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  periodEnd: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  targetValue: z.coerce.number().optional(),
  currentValue: z.coerce.number().default(0),
  unit: z.string().optional(),
  status: z
    .enum(["not_started", "in_progress", "completed", "abandoned"])
    .default("not_started"),
  parentGoalId: z.string().optional(),
  linkedHabitId: z.string().optional(),
});

// ─── Project ────────────────────────────────────────────────────────────────
export const ProjectImportSchema = z.object({
  name: z.string().min(1).max(200),
  clientId: z.string().optional(),
  status: z
    .enum(["planning", "active", "on_hold", "completed", "cancelled"])
    .default("planning"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  deadline: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD").optional(),
  progressPct: z.coerce.number().int().min(0).max(100).default(0),
  pic: z.string().optional(),
  description: z.string().optional(),
});

// ─── Client ─────────────────────────────────────────────────────────────────
export const ClientImportSchema = z.object({
  name: z.string().min(1).max(200),
  company: z.string().optional(),
  contactInfo: z.string().optional(),
  notes: z.string().optional(),
});

// ─── Client Follow-up ───────────────────────────────────────────────────────
export const ClientFollowupImportSchema = z.object({
  clientId: z.string().min(1, "Client ID is required"),
  lastContactDate: z
    .string()
    .regex(YYYYMMDD, "Date must be YYYY-MM-DD")
    .optional(),
  nextFollowupDate: z
    .string()
    .regex(YYYYMMDD, "Date must be YYYY-MM-DD")
    .optional(),
  status: z.enum(["pending", "done"]).default("pending"),
  notes: z.string().optional(),
});

// ─── Team Member ────────────────────────────────────────────────────────────
export const TeamMemberImportSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.string().optional(),
  active: z.coerce.boolean().default(true),
});

// ─── Standup ────────────────────────────────────────────────────────────────
export const StandupImportSchema = z.object({
  teamMemberId: z.string().min(1, "Team Member ID is required"),
  projectId: z.string().optional(),
  date: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  currentTask: z.string().optional(),
  todayTarget: z.string().optional(),
  actualResult: z.string().optional(),
  blocker: z.string().optional(),
  status: z.enum(["on_track", "at_risk", "blocked"]).default("on_track"),
});

// ─── Meeting ────────────────────────────────────────────────────────────────
export const MeetingImportSchema = z.object({
  projectId: z.string().optional(),
  date: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  agenda: z.string().optional(),
  decisions: z.string().optional(),
});

// ─── Meeting Action Item ────────────────────────────────────────────────────
export const MeetingActionItemImportSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  description: z.string().min(1, "Description is required"),
  pic: z.string().optional(),
  deadline: z
    .string()
    .regex(YYYYMMDD, "Date must be YYYY-MM-DD")
    .optional(),
  status: z.enum(["open", "done"]).default("open"),
});

// ─── Semester ───────────────────────────────────────────────────────────────
export const SemesterImportSchema = z.object({
  name: z.string().min(1).max(100),
  startDate: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  endDate: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
});

// ─── Course ─────────────────────────────────────────────────────────────────
export const CourseImportSchema = z.object({
  semesterId: z.string().min(1, "Semester ID is required"),
  name: z.string().min(1).max(200),
  code: z.string().optional(),
  lecturer: z.string().optional(),
  room: z.string().optional(),
  color: z.string().optional(),
});

// ─── Course Schedule ────────────────────────────────────────────────────────
export const CourseScheduleImportSchema = z.object({
  courseId: z.string().min(1, "Course ID is required"),
  dayOfWeek: z.coerce.number().int().min(0).max(6),
  startTime: z.string().regex(HHmm, "Time must be HH:mm"),
  endTime: z.string().regex(HHmm, "Time must be HH:mm"),
  room: z.string().optional(),
});

// ─── Assignment ─────────────────────────────────────────────────────────────
export const AssignmentImportSchema = z.object({
  courseId: z.string().min(1, "Course ID is required"),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  dueDate: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z
    .enum(["not_started", "in_progress", "submitted", "graded"])
    .default("not_started"),
  grade: z.string().optional(),
});

// ─── Semester Event ─────────────────────────────────────────────────────────
export const SemesterEventImportSchema = z.object({
  semesterId: z.string().min(1, "Semester ID is required"),
  title: z.string().min(1).max(200),
  date: z.string().regex(YYYYMMDD, "Date must be YYYY-MM-DD"),
  type: z.enum(["midterm", "final", "deadline", "other"]),
});

// ─── Monthly Review ─────────────────────────────────────────────────────────
export const MonthlyReviewImportSchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
  month: z.coerce.number().int().min(1).max(12),
  biggestAchievement: z.string().optional(),
  biggestLesson: z.string().optional(),
  nextMonthPriorities: z.string().optional(),
  autoSummaryJson: z.string().optional(),
});

// ─── User ───────────────────────────────────────────────────────────────────
export const UserImportSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email().optional(),
  timezone: z.string().default("Asia/Jakarta"),
});

// ─── Reminder ───────────────────────────────────────────────────────────────
export const ReminderImportSchema = z.object({
  type: z.enum(["habit", "deadline", "followup", "meeting"]),
  referenceType: z.string().min(1, "Reference type is required"),
  referenceId: z.string().min(1, "Reference ID is required"),
  triggerAt: z.coerce.number().int().min(0),
  status: z.enum(["pending", "sent", "dismissed"]).default("pending"),
});

// ===========================================================================
// ENTITY VALIDATION SCHEMAS — lookup map
// ===========================================================================
export const ENTITY_VALIDATION_SCHEMAS: Record<EntityType, z.ZodType> = {
  transactions: TransactionImportSchema,
  tasks: TaskImportSchema,
  habits: HabitImportSchema,
  habitLogs: HabitLogImportSchema,
  checkins: CheckinImportSchema,
  diaryEntries: DiaryEntryImportSchema,
  goals: GoalImportSchema,
  projects: ProjectImportSchema,
  clients: ClientImportSchema,
  clientFollowups: ClientFollowupImportSchema,
  teamMembers: TeamMemberImportSchema,
  standups: StandupImportSchema,
  meetings: MeetingImportSchema,
  meetingActionItems: MeetingActionItemImportSchema,
  semesters: SemesterImportSchema,
  courses: CourseImportSchema,
  courseSchedule: CourseScheduleImportSchema,
  assignments: AssignmentImportSchema,
  semesterEvents: SemesterEventImportSchema,
  monthlyReviews: MonthlyReviewImportSchema,
  users: UserImportSchema,
  reminders: ReminderImportSchema,
};
