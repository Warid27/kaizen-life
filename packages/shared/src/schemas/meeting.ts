import { z } from "zod";

// ---------------------------------------------------------------------------
// Meeting
// ---------------------------------------------------------------------------
export const MeetingSchema = z.object({
  id: z.string(),
  userId: z.string(),
  projectId: z.string().nullable().optional(),
  date: z.string(),
  agenda: z.string().nullable().optional(),
  decisions: z.string().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Meeting = z.infer<typeof MeetingSchema>;

export const CreateMeetingSchema = MeetingSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).strict();

export type CreateMeeting = z.infer<typeof CreateMeetingSchema>;

export const UpdateMeetingSchema = CreateMeetingSchema.partial().strict();

export type UpdateMeeting = z.infer<typeof UpdateMeetingSchema>;

export const MeetingFilterSchema = z
  .object({
    projectId: z.string().optional(),
    date: z.string().optional(),
    dateFrom: z.string().optional(),
    dateTo: z.string().optional(),
  })
  .strict();

export type MeetingFilter = z.infer<typeof MeetingFilterSchema>;

// ---------------------------------------------------------------------------
// Meeting Action Item
// ---------------------------------------------------------------------------
export const ActionItemStatusSchema = z.enum(["open", "done"]);

export type ActionItemStatus = z.infer<typeof ActionItemStatusSchema>;

export const MeetingActionItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  meetingId: z.string(),
  description: z.string().min(1).max(1000),
  pic: z.string().nullable().optional(),
  deadline: z.string().nullable().optional(),
  status: ActionItemStatusSchema.default("open"),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type MeetingActionItem = z.infer<typeof MeetingActionItemSchema>;

export const CreateActionItemSchema = MeetingActionItemSchema.omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  deletedAt: true,
}).strict();

export type CreateActionItem = z.infer<typeof CreateActionItemSchema>;

export const UpdateActionItemSchema = CreateActionItemSchema.partial().strict();

export type UpdateActionItem = z.infer<typeof UpdateActionItemSchema>;

export const ActionItemFilterSchema = z
  .object({
    meetingId: z.string().optional(),
    status: ActionItemStatusSchema.optional(),
  })
  .strict();

export type ActionItemFilter = z.infer<typeof ActionItemFilterSchema>;
