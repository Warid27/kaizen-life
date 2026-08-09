import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type StatsRange = 7 | 30 | 90 | 365;

export interface HabitStatsPoint {
  date: string;
  completed: number;
  total: number;
  rate: number; // 0-100
}

export interface SleepStatsPoint {
  date: string;
  totalMinutes: number | null;
  quality: number | null; // 1-5
}

export interface MoodStatsPoint {
  date: string;
  mood: number | null; // 1-5
  energy: number | null; // 1-5
  focus: number | null; // 1-5
}

export interface FinanceStatsPoint {
  date: string;
  incomeCents: number;
  expenseCents: number;
  netCents: number;
}

export interface ProjectStatsPoint {
  date: string;
  tasksCompleted: number;
  tasksCreated: number;
  projectsActive: number;
}

export interface StatsOverview {
  range: StatsRange;
  habits: HabitStatsPoint[];
  sleep: SleepStatsPoint[];
  mood: MoodStatsPoint[];
  finance: FinanceStatsPoint[];
  projects: ProjectStatsPoint[];
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const statsKeys = {
  all: ['stats'] as const,
  overview: (range: StatsRange) => [...statsKeys.all, 'overview', range] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** Get aggregated stats for a date range */
export function useStatsOverview(range: StatsRange) {
  return useQuery({
    queryKey: statsKeys.overview(range),
    queryFn: ({ signal }) =>
      apiGet<StatsOverview>(
        '/api/stats/overview',
        { range },
        signal,
      ),
    staleTime: 60_000,
  });
}
