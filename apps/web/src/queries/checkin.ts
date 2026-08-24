import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api-client';
import type { Checkin, UpsertCheckin, CheckinRange } from '@kaizenlife/shared';

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const checkinKeys = {
  all: ['checkins'] as const,
  lists: () => [...checkinKeys.all, 'list'] as const,
  list: (filters?: CheckinRange) => [...checkinKeys.lists(), filters] as const,
  byDate: (date: string) => [...checkinKeys.all, 'date', date] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List check-ins within a date range */
export function useCheckins(range?: CheckinRange) {
  return useQuery({
    queryKey: checkinKeys.list(range),
    queryFn: ({ signal }) =>
      apiGet<Checkin[]>('/api/checkins', range as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

/** Get a single check-in by date.
 *  The server has no GET-by-date route — derive it from the range list
 *  (from = to = date), fixing the guaranteed-404 path (B1). */
export function useCheckin(date: string) {
  return useQuery({
    queryKey: checkinKeys.byDate(date),
    queryFn: ({ signal }) =>
      apiGet<Checkin[]>('/api/checkins', { from: date, to: date }, signal),
    select: (rows) => rows.find((r) => r.date === date) ?? null,
    enabled: !!date,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create or update a check-in (PUT /checkins/:date) */
export function useUpsertCheckin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ date, data }: { date: string; data: UpsertCheckin }) =>
      apiPut<Checkin>(`/api/checkins/${date}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: checkinKeys.byDate(variables.date) });
      qc.invalidateQueries({ queryKey: checkinKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
