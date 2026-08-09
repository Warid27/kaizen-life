import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoalLevel = 'annual' | 'monthly' | 'weekly';
export type GoalStatus = 'not_started' | 'in_progress' | 'completed' | 'abandoned';

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  type: GoalLevel;
  periodStart: string;
  periodEnd: string;
  targetValue: number | null;
  currentValue: number;
  unit: string | null;
  status: GoalStatus;
  parentGoalId: string | null;
  linkedHabitId: string | null;
  createdAt: string;
  children?: Goal[];
}

export interface CreateGoal {
  title: string;
  description?: string;
  type: GoalLevel;
  periodStart: string;
  periodEnd: string;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  status?: GoalStatus;
  parentGoalId?: string | null;
  linkedHabitId?: string | null;
}

export interface UpdateGoal {
  title?: string;
  description?: string;
  type?: GoalLevel;
  periodStart?: string;
  periodEnd?: string;
  targetValue?: number | null;
  currentValue?: number | null;
  unit?: string | null;
  status?: GoalStatus;
  parentGoalId?: string | null;
  linkedHabitId?: string | null;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const goalKeys = {
  all: ['goals'] as const,
  lists: () => [...goalKeys.all, 'list'] as const,
  list: (type?: GoalLevel) => [...goalKeys.lists(), type] as const,
  detail: (id: string) => [...goalKeys.all, 'detail', id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List all goals, optionally filtered by type */
export function useGoals(type?: GoalLevel) {
  return useQuery({
    queryKey: goalKeys.list(type),
    queryFn: ({ signal }) =>
      apiGet<Goal[]>(
        '/api/goals',
        type ? { type } : undefined,
        signal,
      ),
    staleTime: 60_000,
  });
}

/** Get a single goal with children */
export function useGoal(id: string) {
  return useQuery({
    queryKey: goalKeys.detail(id),
    queryFn: ({ signal }) =>
      apiGet<Goal>(`/api/goals/${id}`, undefined, signal),
    enabled: !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create a new goal */
export function useCreateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateGoal) => apiPost<Goal>('/api/goals', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: goalKeys.all });
    },
  });
}

/** Update an existing goal */
export function useUpdateGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateGoal }) =>
      apiPatch<Goal>(`/api/goals/${id}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: goalKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: goalKeys.lists() });
    },
  });
}
