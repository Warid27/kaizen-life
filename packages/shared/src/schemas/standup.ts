import { z } from "zod";

export const StandupStatusSchema = z.enum(["on_track", "at_risk", "blocked"]);

export type StandupStatus = z.infer<typeof StandupStatusSchema>;

export const StandupSchema = z.object({
  id: z.string(),
  userId: z.string(),
  teamMemberId: z.string(),
  projectId: z.string().nullable().optional(),
  date: z.string(),
  currentTask: z.string().nullable().optional(),
  todayTarget: z.string().nullable().optional(),
  actualResult: z.string().nullable().optional(),
  blocker: z.string().nullable().optional(),
  status: StandupStatusSchema.default("on_track"),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Standup = z.infer<typeof StandupSchema>;

export const CreateStandupSchema = StandupSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).strict();

export type CreateStandup = z.infer<typeof CreateStandupSchema>;

export const UpdateStandupSchema = CreateStandupSchema.partial().strict();

export type UpdateStandup = z.infer<typeof UpdateStandupSchema>;

export const StandupFilterSchema = z
  .object({
    teamMemberId: z.string().optional(),
    projectId: z.string().optional(),
    date: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
    status: StandupStatusSchema.optional(),
  })
  .strict();

export type StandupFilter = z.infer<typeof StandupFilterSchema>;
