import { z } from "zod";

// ---------------------------------------------------------------------------
// Assignment schemas (mirrors apps/api/src/routes/assignments.ts)
// ---------------------------------------------------------------------------

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ─── Assignment (full record) ───────────────────────────────────────────────
export const AssignmentSchema = z.object({
  id: z.string(),
  userId: z.string(),
  courseId: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().max(5000).nullable().optional(),
  dueDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
  priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
  status: z
    .enum(["not_started", "in_progress", "submitted", "graded"])
    .default("not_started"),
  grade: z.string().max(50).nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Assignment = z.infer<typeof AssignmentSchema>;

// ─── Create / Update Assignment ─────────────────────────────────────────────
export const CreateAssignmentSchema = z
  .object({
    courseId: z.string().min(1),
    title: z.string().min(1).max(500),
    description: z.string().max(5000).nullable().optional(),
    dueDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
    priority: z.enum(["low", "medium", "high", "urgent"]).default("medium"),
    status: z
      .enum(["not_started", "in_progress", "submitted", "graded"])
      .default("not_started"),
    grade: z.string().max(50).nullable().optional(),
  })
  .strict();

export type CreateAssignment = z.infer<typeof CreateAssignmentSchema>;

export const UpdateAssignmentSchema = CreateAssignmentSchema.partial().strict();

export type UpdateAssignment = z.infer<typeof UpdateAssignmentSchema>;
