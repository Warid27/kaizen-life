import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type {
  Habit,
  CreateHabit,
  UpdateHabit,
  LogHabit,
  HabitStats,
  HabitFilter,
} from '@kaizenlife/shared';

// ─── API response wrappers (habits API wraps in { data: ... }) ────────────────

/** Habit row enriched with today's log state (BL5 — UI can now show completion). */
export interface HabitWithToday extends Habit {
  scheduledToday: boolean;
  completedToday: boolean;
  progress: { completedCount: number; targetCount: number } | null;
}

type HabitListResponse = { data: HabitWithToday[] };
type HabitSingleResponse = { data: Habit };
export type HabitLogRow = {
  id: string;
  habitId: string;
  date: string;
  completedCount: number;
  targetCount: number;
};
type HabitLogResponse = { data: HabitLogRow };
type HabitStatsResponse = { data: HabitStats };

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const habitKeys = {
  all: ['habits'] as const,
  lists: () => [...habitKeys.all, 'list'] as const,
  list: (filters?: HabitFilter) => [...habitKeys.lists(), filters] as const,
  details: () => [...habitKeys.all, 'detail'] as const,
  detail: (id: string) => [...habitKeys.details(), id] as const,
  stats: (id: string) => [...habitKeys.all, 'stats', id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List habits with optional filters (active, category) */
export function useHabits(filters?: { active?: boolean; category?: string }) {
  return useQuery({
    queryKey: habitKeys.list(filters as HabitFilter | undefined),
    queryFn: ({ signal }) =>
      apiGet<HabitListResponse>(
        '/api/habits',
        filters as Record<string, string | number | boolean | undefined>,
        signal,
      ),
    select: (res) => res.data,
    staleTime: 60_000,
  });
}

/** Get a single habit by ID */
export function useHabit(id: string) {
  return useQuery({
    queryKey: habitKeys.detail(id),
    queryFn: ({ signal }) =>
      apiGet<HabitSingleResponse>(`/api/habits/${id}`, undefined, signal),
    select: (res) => res.data,
    enabled: !!id,
  });
}

/** Get stats for a habit (streaks, completion rate, etc.) */
export function useHabitStats(id: string) {
  return useQuery({
    queryKey: habitKeys.stats(id),
    queryFn: ({ signal }) =>
      apiGet<HabitStatsResponse>(`/api/habits/${id}/stats`, undefined, signal),
    select: (res) => res.data,
    enabled: !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create a new habit */
export function useCreateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateHabit) =>
      apiPost<HabitSingleResponse>('/api/habits', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: habitKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Update an existing habit (partial) */
export function useUpdateHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateHabit }) =>
      apiPatch<HabitSingleResponse>(`/api/habits/${id}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: habitKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Soft-delete a habit */
export function useDeleteHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiDelete<{ data: { success: boolean } }>(`/api/habits/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: habitKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Log a habit completion for a specific date (increment may be negative to undo) */
export function useLogHabit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, data }: { habitId: string; data: LogHabit }) =>
      apiPost<HabitLogResponse>(`/api/habits/${habitId}/log`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: habitKeys.detail(variables.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
      qc.invalidateQueries({ queryKey: habitKeys.stats(variables.habitId) });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Undo a check-in for a specific date (DELETE /habits/:id/logs/:date — BL6). */
export function useUndoHabitLog() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ habitId, date }: { habitId: string; date: string }) =>
      apiDelete<{ data: { success: boolean } }>(`/api/habits/${habitId}/logs/${date}`),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: habitKeys.detail(variables.habitId) });
      qc.invalidateQueries({ queryKey: habitKeys.lists() });
      qc.invalidateQueries({ queryKey: habitKeys.stats(variables.habitId) });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
