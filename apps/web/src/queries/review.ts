import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api-client';

// ─── Types (server contract — BL21: field names now match the API) ───────────

/** Row returned by GET/PUT /api/reviews — mirrors the monthly_reviews table. */
export interface MonthlyReview {
  id: string;
  userId: string;
  year: number;
  month: number;
  biggestAchievement: string | null;
  biggestLesson: string | null;
  nextMonthPriorities: string | null;
  autoSummaryJson: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

/** PUT body — identity comes from the path; year/month are NOT sent (B2/G5). */
export interface UpsertReview {
  biggestAchievement?: string;
  biggestLesson?: string;
  nextMonthPriorities?: string;
  autoSummaryJson?: string;
}

interface ReviewEnvelope {
  data: MonthlyReview | null;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const reviewKeys = {
  all: ['reviews'] as const,
  lists: () => [...reviewKeys.all, 'list'] as const,
  monthly: (month: string) => [...reviewKeys.all, 'monthly', month] as const,
};

/**
 * Normalize a month identifier to "YYYY-MM" — accepts "2026-08", 2026/8
 * style inputs from callers.
 */
function normalizeMonth(month: string): string {
  const m = /^(\d{4})[-/](\d{1,2})$/.exec(month);
  if (!m) return month; // assume caller already sends YYYY-MM
  return `${m[1]}-${String(m[2]).padStart(2, '0')}`;
}

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Get a monthly review. `data` is null when none exists yet (not an error). */
export function useMonthlyReview(month: string) {
  return useQuery({
    queryKey: reviewKeys.monthly(month),
    queryFn: ({ signal }) =>
      apiGet<ReviewEnvelope>(`/api/reviews/${normalizeMonth(month)}`, undefined, signal),
    select: (res) => res.data,
    staleTime: 60_000,
    enabled: !!month,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create or update a monthly review */
export function useUpsertReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ month, data }: { month: string; data: UpsertReview }) =>
      apiPut<ReviewEnvelope>(`/api/reviews/${normalizeMonth(month)}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: reviewKeys.monthly(variables.month) });
      qc.invalidateQueries({ queryKey: reviewKeys.lists() });
    },
  });
}
