import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type GoalLevel = 'annual' | 'monthly' | 'weekly';

export interface Goal {
  id: string;
  title: string;
  description: string | null;
  level: GoalLevel;
  parentId: string | null;
  targetValue: number;
  currentValue: number;
  unit: string;
  deadline: string | null;
  status: 'active' | 'completed' | 'paused' | 'abandoned';
  createdAt: string;
  children?: Goal[];
}

export interface CreateGoal {
  title: string;
  description?: string;
  level: GoalLevel;
  parentId?: string;
  targetValue: number;
  unit: string;
  deadline?: string;
}

export interface UpdateGoal {
  title?: string;
  description?: string;
  targetValue?: number;
  currentValue?: number;
  status?: Goal['status'];
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const goalKeys = {
  all: ['goals'] as const,
  lists: () => [...goalKeys.all, 'list'] as const,
  list: (level?: GoalLevel) => [...goalKeys.lists(), level] as const,
  detail: (id: string) => [...goalKeys.all, 'detail', id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List all goals, optionally filtered by level */
export function useGoals(level?: GoalLevel) {
  return useQuery({
    queryKey: goalKeys.list(level),
    queryFn: ({ signal }) =>
      apiGet<Goal[]>(
        '/api/goals',
        level ? { level } : undefined,
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
