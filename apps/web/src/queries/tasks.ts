import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type { Task, CreateTask, UpdateTask, TaskFilter } from '@kaizenlife/shared';

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const taskKeys = {
  all: ['tasks'] as const,
  lists: () => [...taskKeys.all, 'list'] as const,
  list: (filters?: TaskFilter) => [...taskKeys.lists(), filters] as const,
  details: () => [...taskKeys.all, 'detail'] as const,
  detail: (id: string) => [...taskKeys.details(), id] as const,
};

// ─── Queries ──────────────────────────────────────────────────────────────────

/** List tasks with optional filters (date, status, priority, projectId, courseId) */
export function useTasks(filters?: TaskFilter) {
  return useQuery({
    queryKey: taskKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<Task[]>('/api/tasks', filters as Record<string, string | number | boolean | undefined>, signal),
    staleTime: 60_000,
  });
}

/** Get a single task by ID */
export function useTask(id: string) {
  return useQuery({
    queryKey: taskKeys.detail(id),
    queryFn: ({ signal }) => apiGet<Task>(`/api/tasks/${id}`, undefined, signal),
    enabled: !!id,
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

/** Create a new task */
export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTask) => apiPost<Task>('/api/tasks', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      // Also invalidate dashboard since it shows today's tasks
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Update an existing task (partial) */
export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTask }) =>
      apiPatch<Task>(`/api/tasks/${id}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: taskKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: taskKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

/** Soft-delete a task */
export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/tasks/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: taskKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
