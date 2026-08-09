import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyReview {
  id: string;
  month: string; // YYYY-MM
  autoSummary: string | null;
  achievements: string | null;
  lessons: string | null;
  nextPriorities: string | null;
  mood: number | null; // 1-5
  energy: number | null; // 1-5
  satisfaction: number | null; // 1-5
  createdAt: string;
  updatedAt: string;
}

export interface UpsertReview {
  achievements?: string;
  lessons?: string;
  nextPriorities?: string;
  mood?: number;
  energy?: number;
  satisfaction?: number;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const reviewKeys = {
  all: ['reviews'] as const,
  lists: () => [...reviewKeys.all, 'list'] as const,
  monthly: (month: string) => [...reviewKeys.all, 'monthly', month] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Get a monthly review */
export function useMonthlyReview(month: string) {
  return useQuery({
    queryKey: reviewKeys.monthly(month),
    queryFn: ({ signal }) =>
      apiGet<MonthlyReview>(`/api/reviews/${month}`, undefined, signal),
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
      apiPut<MonthlyReview>(`/api/reviews/${month}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: reviewKeys.monthly(variables.month) });
      qc.invalidateQueries({ queryKey: reviewKeys.lists() });
    },
  });
}
