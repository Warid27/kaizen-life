import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';

// ─── Types (server contract — GET /api/stats/overview now exists) ────────────

export type StatsRange = 7 | 30 | 90 | 365;

export interface StatsOverview {
  range: { days: number; from: string; to: string };
  tasks: { created: number; completed: number };
  habits: { active: number; completions: number };
  sleep: { nights: number; avgMinutes: number | null };
  finance: {
    byCurrency: Record<
      string,
      { incomeCents: number; expenseCents: number; netCents: number }
    >;
  };
  diary: { entries: number };
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const statsKeys = {
  all: ['stats'] as const,
  overview: (range: StatsRange) => [...statsKeys.all, 'overview', range] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Get aggregated stats for a rolling window of `range` days */
export function useStatsOverview(range: StatsRange) {
  return useQuery({
    queryKey: statsKeys.overview(range),
    queryFn: ({ signal }) =>
      apiGet<StatsOverview>('/api/stats/overview', { days: range }, signal),
    staleTime: 60_000,
  });
}
