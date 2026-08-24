import { z } from "zod";

// ---------------------------------------------------------------------------
// Semester + Semester Event schemas (mirrors apps/api/src/routes/semesters.ts)
// ---------------------------------------------------------------------------

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// ─── Semester (full record) ─────────────────────────────────────────────────
export const SemesterSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(200),
  startDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
  endDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Semester = z.infer<typeof SemesterSchema>;

// ─── Create Semester (POST body) ────────────────────────────────────────────
// Base kept unrefined so the partial update schema can reuse the shape.
const SemesterCreateBase = z
  .object({
    name: z.string().min(1).max(200),
    startDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
    endDate: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
  })
  .strict();

export const CreateSemesterSchema = SemesterCreateBase.refine(
  (data) => data.endDate > data.startDate,
  {
    message: "endDate must be after startDate",
    path: ["endDate"],
  },
);

export type CreateSemester = z.infer<typeof CreateSemesterSchema>;

// ─── Update Semester (PATCH body) ───────────────────────────────────────────
// Range check fires only when both fields are present in the payload.
export const UpdateSemesterSchema = SemesterCreateBase.partial()
  .strict()
  .superRefine((data, ctx) => {
    if (
      data.startDate !== undefined &&
      data.endDate !== undefined &&
      data.endDate <= data.startDate
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "endDate must be after startDate",
        path: ["endDate"],
      });
    }
  });

export type UpdateSemester = z.infer<typeof UpdateSemesterSchema>;

// ─── Semester Event (full record) ───────────────────────────────────────────
export const SemesterEventSchema = z.object({
  id: z.string(),
  userId: z.string(),
  semesterId: z.string(),
  title: z.string().min(1).max(500),
  date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
  type: z.enum(["midterm", "final", "deadline", "other"]),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type SemesterEvent = z.infer<typeof SemesterEventSchema>;

// ─── Create / Update Semester Event ─────────────────────────────────────────
export const CreateSemesterEventSchema = z
  .object({
    semesterId: z.string().min(1),
    title: z.string().min(1).max(500),
    date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
    type: z.enum(["midterm", "final", "deadline", "other"]),
  })
  .strict();

export type CreateSemesterEvent = z.infer<typeof CreateSemesterEventSchema>;

export const UpdateSemesterEventSchema =
  CreateSemesterEventSchema.partial().strict();

export type UpdateSemesterEvent = z.infer<typeof UpdateSemesterEventSchema>;
