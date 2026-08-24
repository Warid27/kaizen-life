import { z } from "zod";

// ─── Create / Update Monthly Review ─────────────────────────────────────────
export const CreateReviewSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
  biggestAchievement: z.string().nullable().optional(),
  biggestLesson: z.string().nullable().optional(),
  nextMonthPriorities: z.string().nullable().optional(),
  autoSummaryJson: z.string().nullable().optional(),
});

export type CreateReviewInput = z.infer<typeof CreateReviewSchema>;

// ─── Update Monthly Review ──────────────────────────────────────────────────
// year/month are OPTIONAL here: they duplicate the /reviews/:year/:month path
// params and the server injects them — a compliant REST caller gets 400 otherwise.
export const UpdateReviewSchema = z.object({
  year: z.number().int().min(2020).max(2100).optional(),
  month: z.number().int().min(1).max(12).optional(),
  biggestAchievement: z.string().nullable().optional(),
  biggestLesson: z.string().nullable().optional(),
  nextMonthPriorities: z.string().nullable().optional(),
  autoSummaryJson: z.string().nullable().optional(),
});

export type UpdateReviewInput = z.infer<typeof UpdateReviewSchema>;

// ─── Upsert by year/month (param validation) ────────────────────────────────
export const UpsertReviewParamsSchema = z.object({
  year: z.string().regex(/^\d{4}$/, "Year must be YYYY"),
  month: z.string().regex(/^\d{2}$/, "Month must be MM"),
});

export type UpsertReviewParams = z.infer<typeof UpsertReviewParamsSchema>;
