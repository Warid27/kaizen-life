import { z } from "zod";

// ---------------------------------------------------------------------------
// Check-in schemas (sleep + mood + energy + stress, one per user per date)
// ---------------------------------------------------------------------------

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

// Sane upper bound for sleep/duration numerics (24h in minutes); a typo like
// 4200 otherwise skews averages forever.
const MAX_SLEEP_MINUTES = 1440;
const sleepMinutesMessage = "Sleep duration cannot exceed 1440 minutes";

/** Full check-in record returned from the API */
export const CheckinSchema = z.object({
  id: z.string(),
  userId: z.string(),
  date: z.string().regex(dateRegex, "Date must be YYYY-MM-DD"),
  bedTime: z.string().nullable().optional(),
  wakeTime: z.string().nullable().optional(),
  napMinutes: z
    .number()
    .int()
    .max(MAX_SLEEP_MINUTES, sleepMinutesMessage)
    .nullable()
    .optional(),
  totalSleepMinutes: z
    .number()
    .int()
    .max(MAX_SLEEP_MINUTES, sleepMinutesMessage)
    .nullable()
    .optional(),
  sleepQuality: z.number().int().min(1).max(5).nullable().optional(),
  mood: z.number().int().min(1).max(10).nullable().optional(),
  energy: z.number().int().min(1).max(10).nullable().optional(),
  stress: z.number().int().min(1).max(10).nullable().optional(),
  note: z.string().nullable().optional(),
  createdAt: z.number().int(),
  updatedAt: z.number().int(),
  deletedAt: z.number().int().nullable().optional(),
});

export type Checkin = z.infer<typeof CheckinSchema>;

/** Payload for creating / updating a check-in (PUT /checkins/:date) */
export const UpsertCheckinSchema = z.object({
  bedTime: z.string().nullable().optional(),
  wakeTime: z.string().nullable().optional(),
  napMinutes: z
    .number()
    .int()
    .min(0)
    .max(MAX_SLEEP_MINUTES, sleepMinutesMessage)
    .optional(),
  totalSleepMinutes: z
    .number()
    .int()
    .min(0)
    .max(MAX_SLEEP_MINUTES, sleepMinutesMessage)
    .nullable()
    .optional(),
  sleepQuality: z.number().int().min(1).max(5).nullable().optional(),
  mood: z.number().int().min(1).max(10).nullable().optional(),
  energy: z.number().int().min(1).max(10).nullable().optional(),
  stress: z.number().int().min(1).max(10).nullable().optional(),
  note: z.string().nullable().optional(),
});

export type UpsertCheckin = z.infer<typeof UpsertCheckinSchema>;

/** Query params for GET /checkins */
export const CheckinRangeSchema = z.object({
  from: z.string().regex(dateRegex, "Date must be YYYY-MM-DD").optional(),
  to: z.string().regex(dateRegex, "Date must be YYYY-MM-DD").optional(),
});

export type CheckinRange = z.infer<typeof CheckinRangeSchema>;
