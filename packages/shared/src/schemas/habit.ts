import { z } from "zod";

// ─── Enums ──────────────────────────────────────────────────────────────────
export const HabitFrequencySchema = z.enum(["daily", "weekly_n", "custom_days"]);
export const HabitCategorySchema = z.enum(["spiritual", "health", "self-care", "mindfulness"]);

// ─── Habit (full record) ────────────────────────────────────────────────────
export const HabitSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(100),
  icon: z.string().nullable().optional(),
  category: HabitCategorySchema.nullable().optional(),
  frequency: HabitFrequencySchema.default("daily"),
  targetCountPerPeriod: z.number().int().positive().default(1),
  customDays: z.string().nullable().optional(), // JSON array of weekday ints [0..6]
  active: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  archivedAt: z.number().int().nullable().optional(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Habit = z.infer<typeof HabitSchema>;

// ─── Create Habit (POST body) ───────────────────────────────────────────────
/**
 * True when `raw` is a JSON-encoded array of weekday integers 0-6 with at
 * least one entry. Guards against zombie habits: a custom_days habit with
 * garbage JSON is never scheduled (recurrence swallows the parse error).
 */
export function isValidCustomDaysJson(raw: string): boolean {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return false;
  }
  if (!Array.isArray(parsed) || parsed.length < 1) return false;
  return parsed.every(
    (n) => typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= 6,
  );
}

const CUSTOM_DAYS_MESSAGE =
  "customDays must be a JSON array of weekday integers 0-6 with at least one entry when frequency is custom_days";

// Base without refinement so the partial update schema can reuse the shape.
const CreateHabitBase = HabitSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  archivedAt: true,
  deletedAt: true,
}).strict();

export const CreateHabitSchema = CreateHabitBase.superRefine((data, ctx) => {
  if (
    data.frequency === "custom_days" &&
    (data.customDays == null || !isValidCustomDaysJson(data.customDays))
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["customDays"],
      message: CUSTOM_DAYS_MESSAGE,
    });
  }
});

export type CreateHabit = z.infer<typeof CreateHabitSchema>;

// ─── Update Habit (PATCH body) ──────────────────────────────────────────────
// Lenient by design (a PATCH may carry only one field), but when BOTH
// frequency=custom_days and a non-null customDays are provided, the same
// rule applies.
export const UpdateHabitSchema = CreateHabitBase.partial()
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.frequency === "custom_days" &&
      data.customDays !== undefined &&
      data.customDays !== null &&
      !isValidCustomDaysJson(data.customDays)
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["customDays"],
        message: CUSTOM_DAYS_MESSAGE,
      });
    }
  });

export type UpdateHabit = z.infer<typeof UpdateHabitSchema>;

// ─── Habit Log (full record) ────────────────────────────────────────────────
export const HabitLogSchema = z.object({
  id: z.string(),
  userId: z.string(),
  habitId: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  completedCount: z.number().int().min(0).default(0),
  targetCount: z.number().int().positive(),
  note: z.string().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type HabitLog = z.infer<typeof HabitLogSchema>;

// ─── Log Habit Completion (POST /habits/:id/log body) ──────────────────────
export const LogHabitSchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
    // Non-zero int: +n to check in, -n to undo (BL6 — check-ins were
    // previously irreversible and aria-labels promised an undo that no-op'd).
    increment: z.number().int().refine((v) => v !== 0, "increment must be non-zero").default(1),
    note: z.string().max(500).optional(),
  })
  .strict();

export type LogHabit = z.infer<typeof LogHabitSchema>;

// ─── Habit Stats Response ───────────────────────────────────────────────────
export const HabitStatsSchema = z.object({
  habitId: z.string(),
  currentStreak: z.number().int().min(0),
  longestStreak: z.number().int().min(0),
  completionRate: z.number().min(0).max(1),
  totalCompletions: z.number().int().min(0),
  totalScheduledDays: z.number().int().min(0),
  recentLogs: z.array(HabitLogSchema),
});

export type HabitStats = z.infer<typeof HabitStatsSchema>;

// ─── Habit Query Filters (GET /habits) ──────────────────────────────────────
export const HabitFilterSchema = z
  .object({
    active: z
      .string()
      .transform((v) => v === "true")
      .optional(),
    category: HabitCategorySchema.optional(),
  })
  .strict();

export type HabitFilter = z.infer<typeof HabitFilterSchema>;
