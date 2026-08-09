import { z } from "zod";

export const TaskPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);
export const TaskStatusSchema = z.enum(["todo", "in_progress", "done", "cancelled"]);

export type TaskPriority = z.infer<typeof TaskPrioritySchema>;
export type TaskStatus = z.infer<typeof TaskStatusSchema>;

export const TaskSchema = z.object({
  id: z.string(),
  userId: z.string(),
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  date: z.string().nullable().optional(),
  startTime: z.string().nullable().optional(),
  endTime: z.string().nullable().optional(),
  estimatedDurationMin: z.number().int().positive().nullable().optional(),
  priority: TaskPrioritySchema.default("medium"),
  status: TaskStatusSchema.default("todo"),
  projectId: z.string().nullable().optional(),
  courseId: z.string().nullable().optional(),
  tags: z.string().nullable().optional(),
  completedAt: z.number().int().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Task = z.infer<typeof TaskSchema>;

export const CreateTaskSchema = TaskSchema.omit({
  id: true,
  completedAt: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).strict();

export type CreateTask = z.infer<typeof CreateTaskSchema>;

export const UpdateTaskSchema = CreateTaskSchema.partial().strict();

export type UpdateTask = z.infer<typeof UpdateTaskSchema>;

export const TaskFilterSchema = z.object({
  date: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  status: TaskStatusSchema.optional(),
  projectId: z.string().optional(),
  courseId: z.string().optional(),
  priority: TaskPrioritySchema.optional(),
}).strict();

export type TaskFilter = z.infer<typeof TaskFilterSchema>;

// ---------------------------------------------------------------------------
// Quick Capture — create a task with just a title; everything else deferred
// ---------------------------------------------------------------------------
export const QuickCaptureSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  startTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  endTime: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  estimatedDurationMin: z.number().int().positive().optional(),
  priority: z.enum(["low", "medium", "high", "urgent"]).optional(),
  projectId: z.string().optional(),
  courseId: z.string().optional(),
  tags: z.string().optional(),
});

export type QuickCapture = z.infer<typeof QuickCaptureSchema>;

// ---------------------------------------------------------------------------
// Search — query parameter for command-palette search
// ---------------------------------------------------------------------------
export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(200),
});

export type SearchQuery = z.infer<typeof SearchQuerySchema>;
