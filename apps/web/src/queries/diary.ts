import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api-client';
import type { DiaryEntry, UpsertDiaryEntry, DiaryRange } from '@kaizenlife/shared';

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const diaryKeys = {
  all: ['diary'] as const,
  lists: () => [...diaryKeys.all, 'list'] as const,
  list: (filters?: DiaryRange) => [...diaryKeys.lists(), filters] as const,
  byDate: (date: string) => [...diaryKeys.all, 'date', date] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List diary entries within a date range */
export function useDiaryEntries(range?: DiaryRange) {
  return useQuery({
    queryKey: diaryKeys.list(range),
    queryFn: ({ signal }) =>
      apiGet<DiaryEntry[]>('/api/diary', range as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

/** Get a single diary entry by date */
export function useDiaryEntry(date: string) {
  return useQuery({
    queryKey: diaryKeys.byDate(date),
    queryFn: ({ signal }) =>
      apiGet<DiaryEntry>(`/api/diary/${date}`, undefined, signal),
    enabled: !!date,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create or update a diary entry (PUT /diary/:date) */
export function useUpsertDiaryEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: UpsertDiaryEntry }) =>
      apiPut<DiaryEntry>(`/api/diary/${date}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: diaryKeys.byDate(variables.date) });
      qc.invalidateQueries({ queryKey: diaryKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
