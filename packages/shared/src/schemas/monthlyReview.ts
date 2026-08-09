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

export const UpdateReviewSchema = z.object({
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
