import { z } from "zod";

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------
export const ClientSchema = z.object({
  id: z.string(),
  userId: z.string(),
  name: z.string().min(1).max(200),
  company: z.string().nullable().optional(),
  contactInfo: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Client = z.infer<typeof ClientSchema>;

export const CreateClientSchema = ClientSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).strict();

export type CreateClient = z.infer<typeof CreateClientSchema>;

export const UpdateClientSchema = CreateClientSchema.partial().strict();

export type UpdateClient = z.infer<typeof UpdateClientSchema>;

// ---------------------------------------------------------------------------
// Client Follow-up
// ---------------------------------------------------------------------------
export const FollowupStatusSchema = z.enum(["pending", "done"]);

export type FollowupStatus = z.infer<typeof FollowupStatusSchema>;

export const ClientFollowupSchema = z.object({
  id: z.string(),
  userId: z.string(),
  clientId: z.string(),
  lastContactDate: z.string().nullable().optional(),
  nextFollowupDate: z.string().nullable().optional(),
  status: FollowupStatusSchema.default("pending"),
  notes: z.string().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type ClientFollowup = z.infer<typeof ClientFollowupSchema>;

export const CreateClientFollowupSchema = ClientFollowupSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).strict();

export type CreateClientFollowup = z.infer<typeof CreateClientFollowupSchema>;

export const UpdateClientFollowupSchema = CreateClientFollowupSchema.partial().strict();

export type UpdateClientFollowup = z.infer<typeof UpdateClientFollowupSchema>;

export const FollowupFilterSchema = z
  .object({
    clientId: z.string().optional(),
    status: FollowupStatusSchema.optional(),
  })
  .strict();

export type FollowupFilter = z.infer<typeof FollowupFilterSchema>;
