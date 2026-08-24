import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { sql } from "drizzle-orm";
import type { Bindings, AppDb } from "../db/client";
import * as XLSX from "xlsx";
import crypto from "crypto";
import {
  EntityTypeSchema,
  PreviewRequestSchema,
  ImportRequestSchema,
  ENTITY_FIELD_DEFINITIONS,
  ENTITY_VALIDATION_SCHEMAS,
} from "@kaizenlife/shared";
import {
  transactions,
  tasks,
  habits,
  habitLogs,
  checkins,
  diaryEntries,
  goals,
  projects,
  clients,
  clientFollowups,
  teamMembers,
  standups,
  meetings,
  meetingActionItems,
  semesters,
  courses,
  courseSchedule,
  assignments,
  semesterEvents,
  monthlyReviews,
  reminders,
} from "../db/schema";
import type { EntityType } from "@kaizenlife/shared";
import { apiError, validationHook } from "../lib/api";

const importRouter = new Hono<{ Bindings: Bindings; Variables: { db: AppDb; userId: string } }>();

// ---------------------------------------------------------------------------
// In-memory session storage.
// KNOWN LIMITATION (S6): Worker isolates are ephemeral and per-isolate, so an
// upload may land in a different isolate than its preview/execute calls,
// producing intermittent "Session not found". Sessions are bounded below so
// this state can never become a memory-DoS vector; a durable (D1/KV) session
// store is the real fix and is tracked as follow-up debt.
// ---------------------------------------------------------------------------
interface ImportSession {
  data: Record<string, unknown>[];
  headers: string[];
  userId: string;
  createdAt: number;
}

const sessions = new Map<string, ImportSession>();

export const SESSION_TTL_MS = 3_600_000;
// Hard ceilings so concurrent uploads cannot OOM the 128MB isolate (S6).
const MAX_SESSIONS = 50;

export function purgeExpiredSessions() {
  const now = Date.now();
  for (const [key, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(key);
    }
  }
}

function evictOldestSessionIfNeeded() {
  while (sessions.size >= MAX_SESSIONS) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [key, session] of sessions.entries()) {
      if (session.createdAt < oldestAt) {
        oldestAt = session.createdAt;
        oldestKey = key;
      }
    }
    if (!oldestKey) break;
    sessions.delete(oldestKey);
  }
}

/**
 * Build the ON CONFLICT DO UPDATE set clause: every listed DB column takes
 * the value from the conflicting incoming row (`excluded.<col>`).
 */
function buildUpsertSet(dbColumns: string[]): Record<string, unknown> {
  const set: Record<string, unknown> = {};
  for (const col of dbColumns) {
    set[col] = sql`excluded.${sql.identifier(col)}`;
  }
  return set;
}

// ---------------------------------------------------------------------------
// Table lookup map
// ---------------------------------------------------------------------------
// NOTE: `users` intentionally NOT importable (S7): a public write path into
// the user table is an account-injection primitive the moment real auth lands.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const TABLE_MAP: Partial<Record<EntityType, any>> = {
  transactions,
  tasks,
  habits,
  habitLogs,
  checkins,
  diaryEntries,
  goals,
  projects,
  clients,
  clientFollowups,
  teamMembers,
  standups,
  meetings,
  meetingActionItems,
  semesters,
  courses,
  courseSchedule,
  assignments,
  semesterEvents,
  monthlyReviews,
  reminders,
};

// ---------------------------------------------------------------------------
// File validation
// ---------------------------------------------------------------------------
const ALLOWED_EXTENSIONS = ["xlsx", "xls", "csv"];
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
// Hard budgets (S6): a 5MB xlsx can expand 10–100x through sheet_to_json;
// these caps bound worst-case memory per session.
export const MAX_IMPORT_ROWS = 5000;
export const MAX_IMPORT_COLUMNS = 64;

export function validateFile(file: File): { valid: boolean; error?: string } {
  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false,
      error: "File too large. Maximum size is 5 MB.",
    };
  }

  const ext = file.name.toLowerCase().split(".").pop();
  if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
    return {
      valid: false,
      error: "Invalid file type. Only .xlsx, .xls, and .csv files are allowed.",
    };
  }

  return { valid: true };
}

// ---------------------------------------------------------------------------
// POST /import/upload — Upload file, parse with xlsx, return headers + preview
// ---------------------------------------------------------------------------
importRouter.post("/import/upload", async (c) => {
  try {
    const userId = c.get("userId");
    const body = await c.req.parseBody();
    const file = body["file"];

    if (!file || !(file instanceof File)) {
      return apiError(c, 400, "VALIDATION_ERROR", "No file provided");
    }

    const validation = validateFile(file);
    if (!validation.valid) {
      return apiError(c, 400, "VALIDATION_ERROR", validation.error ?? "Invalid file");
    }

    // Defense-in-depth (S6): extension checks are spoofable; SheetJS parses
    // content regardless of extension, so wrap parse failures explicitly.
    const buffer = await file.arrayBuffer();
    let workbook: XLSX.WorkBook;
    try {
      workbook = XLSX.read(buffer, { type: "array" });
    } catch {
      return apiError(c, 400, "VALIDATION_ERROR", "File could not be parsed as a spreadsheet");
    }

    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return apiError(c, 400, "VALIDATION_ERROR", "No sheets found in file");
    }

    const sheet = workbook.Sheets[sheetName];
    if (!sheet) {
      return apiError(c, 400, "VALIDATION_ERROR", "No sheets found in file");
    }

    const data = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet);

    if (data.length === 0) {
      return apiError(c, 400, "VALIDATION_ERROR", "File contains no data rows");
    }
    if (data.length > MAX_IMPORT_ROWS) {
      return apiError(
        c,
        400,
        "VALIDATION_ERROR",
        `File contains ${data.length} rows; maximum is ${MAX_IMPORT_ROWS}. Split the file and import in parts.`,
      );
    }
    if (data[0] && Object.keys(data[0]).length > MAX_IMPORT_COLUMNS) {
      return apiError(
        c,
        400,
        "VALIDATION_ERROR",
        `File has more than ${MAX_IMPORT_COLUMNS} columns; maximum is ${MAX_IMPORT_COLUMNS}.`,
      );
    }

    // Extract headers from first row keys
    const headers = Object.keys(data[0]!);

    purgeExpiredSessions();
    evictOldestSessionIfNeeded();

    const sessionId = crypto.randomUUID();
    sessions.set(sessionId, { data, headers, userId, createdAt: Date.now() });

    return c.json({
      sessionId,
      headers,
      totalRows: data.length,
      previewRows: data.slice(0, 100),
    });
  } catch (err) {
    console.error("Import upload error:", err);
    return apiError(c, 500, "INTERNAL", "Failed to process file");
  }
});

// ---------------------------------------------------------------------------
// GET /import/schemas — Return entity field definitions for the mapping UI
// ---------------------------------------------------------------------------
importRouter.get("/import/schemas", async (c) => {
  const entityType = c.req.query("entityType");

  if (entityType) {
    const parsed = EntityTypeSchema.safeParse(entityType);
    if (!parsed.success) {
      return c.json({ error: "Invalid entity type" }, 400);
    }
    const definition = ENTITY_FIELD_DEFINITIONS[parsed.data];
    return c.json(definition);
  }

  return c.json(Object.values(ENTITY_FIELD_DEFINITIONS));
});

// ---------------------------------------------------------------------------
// GET /import/templates/:type — Download template Excel file
// ---------------------------------------------------------------------------
importRouter.get("/import/templates/:type", async (c) => {
  try {
    const type = c.req.param("type");

    const parsed = EntityTypeSchema.safeParse(type);
    if (!parsed.success) {
      return c.json({ error: "Invalid entity type" }, 400);
    }

    const definition = ENTITY_FIELD_DEFINITIONS[parsed.data];
    if (!definition) {
      return c.json({ error: "Entity type not found" }, 404);
    }

    const headers = definition.fields.map((f) => f.label);

    const exampleRow: Record<string, string> = {};
    for (const field of definition.fields) {
      switch (field.key) {
        // ─── Dates ──────────────────────────────────────────────────────────
        case "date":
          exampleRow[field.label] = "2024-01-15";
          break;
        case "periodStart":
          exampleRow[field.label] = "2024-01-01";
          break;
        case "periodEnd":
          exampleRow[field.label] = "2024-12-31";
          break;
        case "startDate":
          exampleRow[field.label] = "2024-08-19";
          break;
        case "endDate":
          exampleRow[field.label] = "2025-01-15";
          break;
        case "deadline":
          exampleRow[field.label] = "2024-02-28";
          break;
        case "dueDate":
          exampleRow[field.label] = "2024-03-15";
          break;
        case "lastContactDate":
          exampleRow[field.label] = "2024-01-10";
          break;
        case "nextFollowupDate":
          exampleRow[field.label] = "2024-01-25";
          break;

        // ─── Times ──────────────────────────────────────────────────────────
        case "startTime":
          exampleRow[field.label] = "09:00";
          break;
        case "endTime":
          exampleRow[field.label] = "17:00";
          break;
        case "bedTime":
          exampleRow[field.label] = "23:00";
          break;
        case "wakeTime":
          exampleRow[field.label] = "06:30";
          break;

        // ─── Enums ──────────────────────────────────────────────────────────
        case "type":
          exampleRow[field.label] = field.enumValues?.[0] ?? "income";
          break;
        case "account":
          exampleRow[field.label] = "bank";
          break;
        case "priority":
          exampleRow[field.label] = "medium";
          break;
        case "status":
          exampleRow[field.label] = field.enumValues?.[0] ?? "active";
          break;
        case "frequency":
          exampleRow[field.label] = "daily";
          break;
        case "dayOfWeek":
          exampleRow[field.label] = "1";
          break;

        // ─── Numbers ────────────────────────────────────────────────────────
        case "amountCents":
          exampleRow[field.label] = "50000";
          break;
        case "targetCountPerPeriod":
          exampleRow[field.label] = "1";
          break;
        case "completedCount":
          exampleRow[field.label] = "1";
          break;
        case "targetCount":
          exampleRow[field.label] = "1";
          break;
        case "napMinutes":
          exampleRow[field.label] = "0";
          break;
        case "totalSleepMinutes":
          exampleRow[field.label] = "420";
          break;
        case "sleepQuality":
          exampleRow[field.label] = "4";
          break;
        case "mood":
          exampleRow[field.label] = "7";
          break;
        case "energy":
          exampleRow[field.label] = "8";
          break;
        case "stress":
          exampleRow[field.label] = "3";
          break;
        case "progressPct":
          exampleRow[field.label] = "25";
          break;
        case "estimatedDurationMin":
          exampleRow[field.label] = "60";
          break;
        case "year":
          exampleRow[field.label] = "2024";
          break;
        case "month":
          exampleRow[field.label] = "1";
          break;
        case "triggerAt":
          exampleRow[field.label] = "1705276800";
          break;
        case "sortOrder":
          exampleRow[field.label] = "1";
          break;

        // ─── Booleans ───────────────────────────────────────────────────────
        case "active":
          exampleRow[field.label] = "true";
          break;

        // ─── IDs (reference placeholders) ───────────────────────────────────
        case "habitId":
          exampleRow[field.label] = "habit-uuid-here";
          break;
        case "clientId":
          exampleRow[field.label] = "client-uuid-here";
          break;
        case "teamMemberId":
          exampleRow[field.label] = "member-uuid-here";
          break;
        case "meetingId":
          exampleRow[field.label] = "meeting-uuid-here";
          break;
        case "semesterId":
          exampleRow[field.label] = "semester-uuid-here";
          break;
        case "courseId":
          exampleRow[field.label] = "course-uuid-here";
          break;
        case "projectId":
          exampleRow[field.label] = "project-uuid-here";
          break;
        case "parentGoalId":
          exampleRow[field.label] = "goal-uuid-here";
          break;
        case "linkedHabitId":
          exampleRow[field.label] = "habit-uuid-here";
          break;
        case "referenceId":
          exampleRow[field.label] = "ref-uuid-here";
          break;

        // ─── Reference Type (reminder) ──────────────────────────────────────
        case "referenceType":
          exampleRow[field.label] = "task";
          break;

        // ─── Strings ────────────────────────────────────────────────────────
        case "category":
          exampleRow[field.label] =
            definition.entityType === "transactions"
              ? "Food & Drinks"
              : "Health";
          break;
        case "name":
          exampleRow[field.label] =
            definition.entityType === "courses"
              ? "Introduction to CS"
              : definition.entityType === "semesters"
                ? "Fall 2024"
                : definition.entityType === "clients"
                  ? "Acme Corp"
                  : definition.entityType === "teamMembers"
                    ? "John Doe"
                    : definition.entityType === "users"
                      ? "Jane Smith"
                      : definition.entityType === "habits"
                        ? "Exercise"
                        : "Sample Name";
          break;
        case "title":
          exampleRow[field.label] =
            definition.entityType === "tasks"
              ? "Review assignment"
              : definition.entityType === "goals"
                ? "Read 12 books this year"
                : definition.entityType === "assignments"
                  ? "Final Project"
                  : "Sample Title";
          break;
        case "description":
          exampleRow[field.label] = "Review and submit before deadline";
          break;
        case "note":
          exampleRow[field.label] = "Optional note here";
          break;
        case "note":
          exampleRow[field.label] = "Optional note here";
          break;
        case "notes":
          exampleRow[field.label] = "Additional notes";
          break;
        case "tags":
          exampleRow[field.label] = "urgent, deadline";
          break;
        case "icon":
          exampleRow[field.label] = "💪";
          break;
        case "customDays":
          exampleRow[field.label] = "[1,3,5]";
          break;
        case "gratefulFor":
          exampleRow[field.label] = "Supportive friends and family";
          break;
        case "lessonLearned":
          exampleRow[field.label] = "Time management is key";
          break;
        case "tomorrowFocus":
          exampleRow[field.label] = "Start project early";
          break;
        case "freeText":
          exampleRow[field.label] = "Today was productive and fulfilling";
          break;
        case "unit":
          exampleRow[field.label] = "books";
          break;
        case "currentTask":
          exampleRow[field.label] = "Working on API endpoint";
          break;
        case "todayTarget":
          exampleRow[field.label] = "Complete feature implementation";
          break;
        case "actualResult":
          exampleRow[field.label] = "Finished 80% of the task";
          break;
        case "blocker":
          exampleRow[field.label] = "Waiting for design review";
          break;
        case "agenda":
          exampleRow[field.label] = "Sprint planning and blockers";
          break;
        case "decisions":
          exampleRow[field.label] = "Proceed with option A";
          break;
        case "pic":
          exampleRow[field.label] = "John Doe";
          break;
        case "grade":
          exampleRow[field.label] = "A";
          break;
        case "biggestAchievement":
          exampleRow[field.label] = "Completed major feature release";
          break;
        case "biggestLesson":
          exampleRow[field.label] = "Better time estimation needed";
          break;
        case "nextMonthPriorities":
          exampleRow[field.label] = "Focus on Q1 goals";
          break;
        case "autoSummaryJson":
          exampleRow[field.label] = '{"score":85,"summary":"Strong month"}';
          break;
        case "lecturer":
          exampleRow[field.label] = "Prof. Smith";
          break;
        case "room":
          exampleRow[field.label] = "Room 301";
          break;
        case "color":
          exampleRow[field.label] = "#4A90D9";
          break;
        case "code":
          exampleRow[field.label] = "CS101";
          break;
        case "email":
          exampleRow[field.label] = "jane@example.com";
          break;
        case "timezone":
          exampleRow[field.label] = "Asia/Jakarta";
          break;
        case "company":
          exampleRow[field.label] = "Acme Industries";
          break;
        case "contactInfo":
          exampleRow[field.label] = "john@acme.com / +1234567890";
          break;
        case "role":
          exampleRow[field.label] = "Developer";
          break;

        // ─── Fallback ───────────────────────────────────────────────────────
        default:
          exampleRow[field.label] = "";
          break;
      }
    }

    // Create workbook with headers and example row
    const ws = XLSX.utils.aoa_to_sheet([
      headers,
      headers.map((h) => exampleRow[h] ?? ""),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, definition.label);

    const buffer = XLSX.write(wb, { type: "array", bookType: "xlsx" });

    return new Response(buffer, {
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${parsed.data}-template.xlsx"`,
      },
    });
  } catch (err) {
    console.error("Template download error:", err);
    return c.json({ error: "Failed to generate template" }, 500);
  }
});

// ---------------------------------------------------------------------------
// POST /import/preview — Validate rows with column mapping
// ---------------------------------------------------------------------------
importRouter.post(
  "/import/preview",
  zValidator("json", PreviewRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid request", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const userId = c.get("userId");
    const { sessionId, entityType, mapping } = c.req.valid("json");

    purgeExpiredSessions();
    const session = sessions.get(sessionId);
    if (!session) {
      return apiError(c, 404, "NOT_FOUND", "Session not found or expired");
    }
    if (session.userId !== userId) {
      return apiError(c, 403, "UNAUTHORIZED", "Session belongs to another user");
    }

    const validationSchema = ENTITY_VALIDATION_SCHEMAS[entityType];
    if (!validationSchema) {
      return apiError(c, 400, "VALIDATION_ERROR", "Unsupported entity type");
    }

    const errors: Array<{ row: number; field: string; message: string }> = [];
    const validRows: Array<Record<string, unknown>> = [];

    for (let i = 0; i < session.data.length; i++) {
      const row = session.data[i]!;
      const mappedRow: Record<string, unknown> = {};

      for (const [excelCol, dbField] of Object.entries(mapping)) {
        if (row[excelCol] !== undefined && row[excelCol] !== null) {
          mappedRow[dbField] = row[excelCol];
        }
      }

      const result = validationSchema.safeParse(mappedRow);
      if (result.success) {
        validRows.push(result.data as Record<string, unknown>);
      } else {
        for (const err of result.error.errors) {
          errors.push({
            row: i + 2, // +1 for 0-index, +1 for header row
            field: err.path.join("."),
            message: err.message,
          });
        }
      }
    }

    return c.json({
      totalRows: session.data.length,
      validRows: validRows.length,
      invalidRows: session.data.length - validRows.length,
      errors,
      mappedData: validRows.slice(0, 100), // Preview first 100 valid rows
    });
  },
);

// ---------------------------------------------------------------------------
// POST /import/execute — Insert valid rows into the database (atomic)
// ---------------------------------------------------------------------------
importRouter.post(
  "/import/execute",
  zValidator("json", ImportRequestSchema, (result, c) => {
    if (!result.success) {
      return c.json(
        { error: "Invalid request", details: result.error.flatten() },
        400,
      );
    }
  }),
  async (c) => {
    const db = c.get("db");
    const userId = c.get("userId");
    const { sessionId, entityType, mapping } = c.req.valid("json");

    purgeExpiredSessions();
    const session = sessions.get(sessionId);
    if (!session) {
      return apiError(c, 404, "NOT_FOUND", "Session not found or expired");
    }
    if (session.userId !== userId) {
      return apiError(c, 403, "UNAUTHORIZED", "Session belongs to another user");
    }

    const validationSchema = ENTITY_VALIDATION_SCHEMAS[entityType];
    if (!validationSchema) {
      return apiError(c, 400, "VALIDATION_ERROR", "Unsupported entity type");
    }

    const table = TABLE_MAP[entityType];
    if (!table) {
      // Includes entityType === "users" — deliberately not importable (S7).
      return apiError(c, 400, "VALIDATION_ERROR", "Unsupported entity type");
    }

    const now = Math.floor(Date.now() / 1000);
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const validRows: Array<Record<string, unknown>> = [];

    // Pass 1: map + validate every row up-front so the write phase is atomic.
    for (let i = 0; i < session.data.length; i++) {
      const row = session.data[i]!;
      const mappedRow: Record<string, unknown> = {};

      for (const [excelCol, dbField] of Object.entries(mapping)) {
        if (row[excelCol] !== undefined && row[excelCol] !== null) {
          mappedRow[dbField] = row[excelCol];
        }
      }

      const result = validationSchema.safeParse(mappedRow);
      if (result.success) {
        validRows.push({
          ...(result.data as Record<string, unknown>),
          id: crypto.randomUUID(),
          userId,
          createdAt: now,
          updatedAt: now,
        });
      } else {
        for (const err of result.error.errors) {
          errors.push({
            row: i + 2, // +1 for 0-index, +1 for header row
            field: err.path.join("."),
            message: err.message,
          });
        }
      }
    }

    // Within-file dedup: re-uploading the same file twice must not double
    // every row when a single retry is retried after a network error.
    const seen = new Set<string>();
    const dedupedRows = validRows.filter((r) => {
      const key = JSON.stringify(r);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Natural-key upserts (B-import): these entities have UNIQUE keys, so
    // re-imports update instead of colliding/duplicating. Other entities
    // rely on the within-file dedup above; cross-run duplicates of
    // non-keyed entities remain possible and are documented debt.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let conflictConfig: { target: any[]; set: Record<string, unknown> } | null = null;
    if (entityType === "habitLogs") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = table as any;
      conflictConfig = {
        target: [t.habitId, t.date],
        set: buildUpsertSet(["completed_count", "target_count", "note", "updated_at", "deleted_at"]),
      };
    } else if (entityType === "checkins" || entityType === "diaryEntries") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = table as any;
      conflictConfig = {
        target: [t.userId, t.date],
        set: buildUpsertSet(
          entityType === "checkins"
            ? ["bed_time", "wake_time", "nap_minutes", "total_sleep_minutes", "sleep_quality", "mood", "energy", "stress", "note", "updated_at", "deleted_at"]
            : ["grateful_for", "lesson_learned", "tomorrow_focus", "free_text", "updated_at", "deleted_at"],
        ),
      };
    } else if (entityType === "monthlyReviews") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = table as any;
      conflictConfig = {
        target: [t.userId, t.year, t.month],
        set: buildUpsertSet([
          "biggest_achievement",
          "biggest_lesson",
          "next_month_priorities",
          "auto_summary_json",
          "updated_at",
          "deleted_at",
        ]),
      };
    }

    const BATCH_SIZE = 100;
    type BatchStmts = Parameters<AppDb["batch"]>[0];
    const statements: unknown[] = [];

    for (let i = 0; i < dedupedRows.length; i += BATCH_SIZE) {
      const chunk = dedupedRows.slice(i, i + BATCH_SIZE);
      const base = db.insert(table).values(chunk);
      const stmt = conflictConfig ? base.onConflictDoUpdate(conflictConfig as never) : base;
      statements.push(stmt);
    }

    let imported = 0;

    if (statements.length > 0) {
      try {
        // D1 batch() is all-or-nothing: no more partial imports where an
        // earlier batch commits and a later one fails (B-import HIGH).
        await db.batch(statements as unknown as BatchStmts);
        imported = dedupedRows.length;
      } catch (err) {
        console.error("Atomic import failed:", err);
        sessions.delete(sessionId);
        return c.json(
          {
            imported: 0,
            skipped: validRows.length - dedupedRows.length + dedupedRows.length,
            errors: [
              ...errors,
              {
                row: 0,
                field: "database",
                message:
                  err instanceof Error
                    ? `Import aborted atomically, nothing was written: ${err.message}`
                    : "Import aborted atomically, nothing was written",
              },
            ],
          },
          500,
        );
      }
    }

    const skipped = session.data.length - dedupedRows.length;

    // Cleanup session after successful execution
    sessions.delete(sessionId);

    return c.json({ imported, skipped, errors });
  },
);

// ---------------------------------------------------------------------------
// DELETE /import/:sessionId — Cancel and cleanup session
// ---------------------------------------------------------------------------
importRouter.delete("/import/:sessionId", async (c) => {
  const userId = c.get("userId");
  const sessionId = String(c.req.param("sessionId"));

  purgeExpiredSessions();
  const session = sessions.get(sessionId);
  if (!session) {
    return apiError(c, 404, "NOT_FOUND", "Session not found");
  }
  if (session.userId !== userId) {
    return apiError(c, 403, "UNAUTHORIZED", "Session belongs to another user");
  }

  sessions.delete(sessionId);
  return c.json({ success: true });
});

export default importRouter;
