import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';

// ─── Types (not in @kaizenlife/shared — defined inline from DB schema) ────────

export interface Semester {
  id: string;
  userId: string;
  name: string;
  startDate: string;
  endDate: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Course {
  id: string;
  userId: string;
  semesterId: string;
  name: string;
  code: string | null;
  lecturer: string | null;
  room: string | null;
  color: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface CourseSchedule {
  id: string;
  userId: string;
  courseId: string;
  dayOfWeek: number; // 0-6
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  room: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface Assignment {
  id: string;
  userId: string;
  courseId: string;
  title: string;
  description: string | null;
  dueDate: string; // YYYY-MM-DD
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'not_started' | 'in_progress' | 'submitted' | 'graded';
  grade: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface SemesterEvent {
  id: string;
  userId: string;
  semesterId: string;
  title: string;
  date: string;
  type: 'midterm' | 'final' | 'deadline' | 'other';
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const semesterKeys = {
  all: ['semesters'] as const,
  lists: () => [...semesterKeys.all, 'list'] as const,
  list: () => [...semesterKeys.lists()] as const,
  details: () => [...semesterKeys.all, 'detail'] as const,
  detail: (id: string) => [...semesterKeys.details(), id] as const,
  events: (semesterId: string) => [...semesterKeys.all, 'events', semesterId] as const,
};

export const courseKeys = {
  all: ['courses'] as const,
  lists: () => [...courseKeys.all, 'list'] as const,
  list: (filters?: { semesterId?: string }) => [...courseKeys.lists(), filters] as const,
  details: () => [...courseKeys.all, 'detail'] as const,
  detail: (id: string) => [...courseKeys.details(), id] as const,
  schedules: (courseId: string) => [...courseKeys.all, 'schedules', courseId] as const,
};

export const assignmentKeys = {
  all: ['assignments'] as const,
  lists: () => [...assignmentKeys.all, 'list'] as const,
  list: (filters?: { courseId?: string; status?: string }) => [...assignmentKeys.lists(), filters] as const,
  details: () => [...assignmentKeys.all, 'detail'] as const,
  detail: (id: string) => [...assignmentKeys.details(), id] as const,
};

// ─── Semester Queries ─────────────────────────────────────────────────────────

export function useSemesters() {
  return useQuery({
    queryKey: semesterKeys.list(),
    queryFn: ({ signal }) => apiGet<Semester[]>('/api/semesters', undefined, signal),
    staleTime: 60_000,
  });
}

export function useSemester(id: string) {
  return useQuery({
    queryKey: semesterKeys.detail(id),
    queryFn: ({ signal }) => apiGet<Semester>(`/api/semesters/${id}`, undefined, signal),
    enabled: !!id,
  });
}

export function useSemesterEvents(semesterId: string) {
  return useQuery({
    queryKey: semesterKeys.events(semesterId),
    queryFn: ({ signal }) => apiGet<SemesterEvent[]>(`/api/semesters/${semesterId}/events`, undefined, signal),
    enabled: !!semesterId,
    staleTime: 60_000,
  });
}

export function useCreateSemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; startDate: string; endDate: string }) =>
      apiPost<Semester>('/api/semesters', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: semesterKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateSemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; startDate: string; endDate: string }> }) =>
      apiPatch<Semester>(`/api/semesters/${id}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: semesterKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: semesterKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteSemester() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/semesters/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: semesterKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateSemesterEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ semesterId, data }: { semesterId: string; data: { title: string; date: string; type: string } }) =>
      apiPost<SemesterEvent>(`/api/semesters/${semesterId}/events`, { ...data, semesterId }),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: semesterKeys.events(variables.semesterId) });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteSemesterEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => apiDelete<{ success: boolean }>(`/api/semesters/events/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: semesterKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ─── Course Queries ───────────────────────────────────────────────────────────

export function useCourses(filters?: { semesterId?: string }) {
  return useQuery({
    queryKey: courseKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<Course[]>('/api/courses', filters as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

export function useCourse(id: string) {
  return useQuery({
    queryKey: courseKeys.detail(id),
    queryFn: ({ signal }) => apiGet<Course>(`/api/courses/${id}`, undefined, signal),
    enabled: !!id,
  });
}

export function useCourseSchedules(courseId: string) {
  return useQuery({
    queryKey: courseKeys.schedules(courseId),
    queryFn: ({ signal }) => apiGet<CourseSchedule[]>(`/api/courses/${courseId}/schedules`, undefined, signal),
    enabled: !!courseId,
    staleTime: 60_000,
  });
}

export function useCreateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { semesterId: string; name: string; code?: string; lecturer?: string; room?: string; color?: string }) =>
      apiPost<Course>('/api/courses', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ name: string; code: string; lecturer: string; room: string; color: string }> }) =>
      apiPatch<Course>(`/api/courses/${id}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: courseKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: courseKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteCourse() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/courses/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: courseKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useCreateCourseSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, data }: { courseId: string; data: { courseId: string; dayOfWeek: number; startTime: string; endTime: string; room?: string } }) =>
      apiPost<CourseSchedule>(`/api/courses/${courseId}/schedules`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: courseKeys.schedules(variables.courseId) });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteCourseSchedule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ courseId, scheduleId }: { courseId: string; scheduleId: string }) =>
      apiDelete<{ success: boolean }>(`/api/courses/schedules/${scheduleId}`),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: courseKeys.schedules(variables.courseId) });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ─── Assignment Queries ──────────────────────────────────────────────────────

export function useAssignments(filters?: { courseId?: string; status?: string }) {
  return useQuery({
    queryKey: assignmentKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<Assignment[]>('/api/assignments', filters as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

export function useAssignment(id: string) {
  return useQuery({
    queryKey: assignmentKeys.detail(id),
    queryFn: ({ signal }) => apiGet<Assignment>(`/api/assignments/${id}`, undefined, signal),
    enabled: !!id,
  });
}

export function useCreateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: {
      courseId: string;
      title: string;
      description?: string;
      dueDate: string;
      priority?: string;
      status?: string;
    }) => apiPost<Assignment>('/api/assignments', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assignmentKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<{ courseId: string; title: string; description: string; dueDate: string; priority: string; status: string; grade: string }> }) =>
      apiPatch<Assignment>(`/api/assignments/${id}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: assignmentKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: assignmentKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteAssignment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/assignments/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: assignmentKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
