import { z } from "zod";

// ---------------------------------------------------------------------------
// Course + Course Schedule schemas (mirrors apps/api/src/routes/courses.ts)
// ---------------------------------------------------------------------------

// ─── Course (full record) ───────────────────────────────────────────────────
export const CourseSchema = z.object({
  id: z.string(),
  userId: z.string(),
  semesterId: z.string(),
  name: z.string().min(1).max(200),
  code: z.string().max(50).nullable().optional(),
  lecturer: z.string().max(200).nullable().optional(),
  room: z.string().max(100).nullable().optional(),
  color: z.string().max(20).nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Course = z.infer<typeof CourseSchema>;

// ─── Create / Update Course ─────────────────────────────────────────────────
export const CreateCourseSchema = z
  .object({
    semesterId: z.string().min(1),
    name: z.string().min(1).max(200),
    code: z.string().max(50).nullable().optional(),
    lecturer: z.string().max(200).nullable().optional(),
    room: z.string().max(100).nullable().optional(),
    color: z.string().max(20).nullable().optional(),
  })
  .strict();

export type CreateCourse = z.infer<typeof CreateCourseSchema>;

export const UpdateCourseSchema = CreateCourseSchema.partial().strict();

export type UpdateCourse = z.infer<typeof UpdateCourseSchema>;

// ─── Course Schedule (full record) ──────────────────────────────────────────
export const CourseScheduleSchema = z.object({
  id: z.string(),
  userId: z.string(),
  courseId: z.string(),
  dayOfWeek: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endTime: z.string().regex(/^\d{2}:\d{2}$/),
  room: z.string().max(100).nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type CourseSchedule = z.infer<typeof CourseScheduleSchema>;

// ─── Create / Update Course Schedule ────────────────────────────────────────
export const CreateScheduleSchema = z
  .object({
    courseId: z.string().min(1),
    dayOfWeek: z.number().int().min(0).max(6),
    startTime: z.string().regex(/^\d{2}:\d{2}$/),
    endTime: z.string().regex(/^\d{2}:\d{2}$/),
    room: z.string().max(100).nullable().optional(),
  })
  .strict();

export type CreateSchedule = z.infer<typeof CreateScheduleSchema>;

export const UpdateScheduleSchema = CreateScheduleSchema.partial().strict();

export type UpdateSchedule = z.infer<typeof UpdateScheduleSchema>;
