import { z } from "zod";

// ─── Create Goal ────────────────────────────────────────────────────────────
// targetValue must be > 0: a zero target makes percent-complete math NaN/Infinity.
export const CreateGoalSchema = z.object({
  title: z.string().min(1, "Title is required"),
  type: z.enum(["annual", "monthly", "weekly"]),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD"),
  targetValue: z
    .number()
    .positive("Target value must be greater than 0")
    .nullable()
    .optional(),
  currentValue: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "abandoned"]).optional(),
  parentGoalId: z.string().nullable().optional(),
  linkedHabitId: z.string().nullable().optional(),
});

export type CreateGoalInput = z.infer<typeof CreateGoalSchema>;

// ─── Update Goal ────────────────────────────────────────────────────────────
export const UpdateGoalSchema = z.object({
  title: z.string().min(1).optional(),
  type: z.enum(["annual", "monthly", "weekly"]).optional(),
  periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  targetValue: z
    .number()
    .positive("Target value must be greater than 0")
    .nullable()
    .optional(),
  currentValue: z.number().nullable().optional(),
  unit: z.string().nullable().optional(),
  status: z.enum(["not_started", "in_progress", "completed", "abandoned"]).optional(),
  parentGoalId: z.string().nullable().optional(),
  linkedHabitId: z.string().nullable().optional(),
});

export type UpdateGoalInput = z.infer<typeof UpdateGoalSchema>;

// ─── Goal Query (list filter) ───────────────────────────────────────────────
export const GoalQuerySchema = z.object({
  type: z.enum(["annual", "monthly", "weekly"]).optional(),
  status: z.enum(["not_started", "in_progress", "completed", "abandoned"]).optional(),
  parentGoalId: z.string().optional(),
});

export type GoalQuery = z.infer<typeof GoalQuerySchema>;
