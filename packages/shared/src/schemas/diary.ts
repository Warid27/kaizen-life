import { z } from "zod";

// ---------------------------------------------------------------------------
// Diary Entry schemas (one per user per date)
// ---------------------------------------------------------------------------

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

/** Full diary entry record returned from the API */
export const DiaryEntrySchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
  gratefulFor: z.string().nullable().optional(),
  lessonLearned: z.string().nullable().optional(),
  tomorrowFocus: z.string().nullable().optional(),
  freeText: z.string().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type DiaryEntry = z.infer<typeof DiaryEntrySchema>;

/** Payload for creating / updating a diary entry (PUT /diary/:date) */
export const UpsertDiaryEntrySchema = z.object({
  gratefulFor: z.string().nullable().optional(),
  lessonLearned: z.string().nullable().optional(),
  tomorrowFocus: z.string().nullable().optional(),
  freeText: z.string().nullable().optional(),
});

export type UpsertDiaryEntry = z.infer<typeof UpsertDiaryEntrySchema>;

/** Query params for GET /diary */
export const DiaryRangeSchema = z.object({
  from: z.string().regex(dateRegex, "Date must be YYYY-MM-DD").optional(),
  to: z.string().regex(dateRegex, "Date must be YYYY-MM-DD").optional(),
});

export type DiaryRange = z.infer<typeof DiaryRangeSchema>;
