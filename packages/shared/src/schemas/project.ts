import { z } from "zod";

export const ProjectStatusSchema = z.enum(["planning", "active", "on_hold", "completed", "cancelled"]);
export const ProjectPrioritySchema = z.enum(["low", "medium", "high", "urgent"]);

export type ProjectStatus = z.infer<typeof ProjectStatusSchema>;
export type ProjectPriority = z.infer<typeof ProjectPrioritySchema>;

export const ProjectSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(200),
  clientId: z.string().nullable().optional(),
  status: ProjectStatusSchema.default("planning"),
  priority: ProjectPrioritySchema.default("medium"),
  deadline: z.string().nullable().optional(),
  progressPct: z.number().int().min(0).max(100).default(0),
  pic: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Project = z.infer<typeof ProjectSchema>;

export const CreateProjectSchema = ProjectSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).strict();

export type CreateProject = z.infer<typeof CreateProjectSchema>;

export const UpdateProjectSchema = CreateProjectSchema.partial().strict();

export type UpdateProject = z.infer<typeof UpdateProjectSchema>;

export const ProjectFilterSchema = z
  .object({
    status: ProjectStatusSchema.optional(),
    priority: ProjectPrioritySchema.optional(),
    clientId: z.string().optional(),
  })
  .strict();

export type ProjectFilter = z.infer<typeof ProjectFilterSchema>;
