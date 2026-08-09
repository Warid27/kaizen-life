import { z } from "zod";

export const TeamMemberSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(200),
  role: z.string().nullable().optional(),
  active: z.boolean().default(true),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type TeamMember = z.infer<typeof TeamMemberSchema>;

export const CreateTeamMemberSchema = TeamMemberSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).strict();

export type CreateTeamMember = z.infer<typeof CreateTeamMemberSchema>;

export const UpdateTeamMemberSchema = CreateTeamMemberSchema.partial().strict();

export type UpdateTeamMember = z.infer<typeof UpdateTeamMemberSchema>;

export const TeamMemberFilterSchema = z
  .object({
    active: z
      .string()
      .transform((v) => v === "true")
      .optional(),
  })
  .strict();

export type TeamMemberFilter = z.infer<typeof TeamMemberFilterSchema>;
