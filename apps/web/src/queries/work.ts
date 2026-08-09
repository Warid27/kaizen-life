import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPatch, apiDelete } from '@/lib/api-client';
import type {
  Project,
  CreateProject,
  UpdateProject,
  Client,
  CreateClient,
  UpdateClient,
  ClientFollowup,
  CreateClientFollowup,
  UpdateClientFollowup,
  Standup,
  CreateStandup,
  UpdateStandup,
  Meeting,
  CreateMeeting,
  UpdateMeeting,
  MeetingActionItem,
  CreateActionItem,
  UpdateActionItem,
  TeamMember,
  CreateTeamMember,
  UpdateTeamMember,
} from '@kaizenlife/shared';

// ─── Project Keys ─────────────────────────────────────────────────────────────

export const projectKeys = {
  all: ['projects'] as const,
  lists: () => [...projectKeys.all, 'list'] as const,
  list: (filters?: Record<string, string | undefined>) => [...projectKeys.lists(), filters] as const,
  details: () => [...projectKeys.all, 'detail'] as const,
  detail: (id: string) => [...projectKeys.details(), id] as const,
};

// ─── Client Keys ──────────────────────────────────────────────────────────────

export const clientKeys = {
  all: ['clients'] as const,
  lists: () => [...clientKeys.all, 'list'] as const,
  list: () => [...clientKeys.lists()] as const,
  details: () => [...clientKeys.all, 'detail'] as const,
  detail: (id: string) => [...clientKeys.details(), id] as const,
};

export const followupKeys = {
  all: ['followups'] as const,
  lists: () => [...followupKeys.all, 'list'] as const,
  list: (filters?: Record<string, string | undefined>) => [...followupKeys.lists(), filters] as const,
};

// ─── Standup Keys ─────────────────────────────────────────────────────────────

export const standupKeys = {
  all: ['standups'] as const,
  lists: () => [...standupKeys.all, 'list'] as const,
  list: (filters?: Record<string, string | undefined>) => [...standupKeys.lists(), filters] as const,
  details: () => [...standupKeys.all, 'detail'] as const,
  detail: (id: string) => [...standupKeys.details(), id] as const,
};

export const teamMemberKeys = {
  all: ['team-members'] as const,
  lists: () => [...teamMemberKeys.all, 'list'] as const,
  list: (filters?: Record<string, string | undefined>) => [...teamMemberKeys.lists(), filters] as const,
};

// ─── Meeting Keys ─────────────────────────────────────────────────────────────

export const meetingKeys = {
  all: ['meetings'] as const,
  lists: () => [...meetingKeys.all, 'list'] as const,
  list: (filters?: Record<string, string | undefined>) => [...meetingKeys.lists(), filters] as const,
  details: () => [...meetingKeys.all, 'detail'] as const,
  detail: (id: string) => [...meetingKeys.details(), id] as const,
};

export const actionItemKeys = {
  all: ['action-items'] as const,
  lists: () => [...actionItemKeys.all, 'list'] as const,
  list: (filters?: Record<string, string | undefined>) => [...actionItemKeys.lists(), filters] as const,
};

// ══════════════════════════════════════════════════════════════
// PROJECTS
// ══════════════════════════════════════════════════════════════

export function useProjects(filters?: { status?: string; priority?: string; clientId?: string }) {
  return useQuery({
    queryKey: projectKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<Project[]>('/api/projects', filters as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

export function useProject(id: string) {
  return useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: ({ signal }) => apiGet<Project>(`/api/projects/${id}`, undefined, signal),
    enabled: !!id,
  });
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateProject) => apiPost<Project>('/api/projects', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateProject }) =>
      apiPatch<Project>(`/api/projects/${id}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: projectKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: projectKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/projects/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: projectKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// CLIENTS
// ══════════════════════════════════════════════════════════════

export function useClients() {
  return useQuery({
    queryKey: clientKeys.list(),
    queryFn: ({ signal }) => apiGet<Client[]>('/api/clients', undefined, signal),
    staleTime: 60_000,
  });
}

export function useClient(id: string) {
  return useQuery({
    queryKey: clientKeys.detail(id),
    queryFn: ({ signal }) => apiGet<Client>(`/api/clients/${id}`, undefined, signal),
    enabled: !!id,
  });
}

export function useCreateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClient) => apiPost<Client>('/api/clients', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClient }) =>
      apiPatch<Client>(`/api/clients/${id}`, data),
    onSuccess: (_result, variables) => {
      qc.invalidateQueries({ queryKey: clientKeys.detail(variables.id) });
      qc.invalidateQueries({ queryKey: clientKeys.lists() });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteClient() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/clients/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: clientKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ─── Follow-ups ───────────────────────────────────────────────────────────────

export function useFollowups(filters?: { clientId?: string; status?: string }) {
  return useQuery({
    queryKey: followupKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<ClientFollowup[]>('/api/followups', filters as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

export function useCreateFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateClientFollowup) => apiPost<ClientFollowup>('/api/followups', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: followupKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateClientFollowup }) =>
      apiPatch<ClientFollowup>(`/api/followups/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: followupKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteFollowup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/followups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: followupKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// STANDUPS
// ══════════════════════════════════════════════════════════════

export function useStandups(filters?: { teamMemberId?: string; projectId?: string; date?: string; dateFrom?: string; dateTo?: string; status?: string }) {
  return useQuery({
    queryKey: standupKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<Standup[]>('/api/standups', filters as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

export function useCreateStandup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateStandup) => apiPost<Standup>('/api/standups', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: standupKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateStandup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateStandup }) =>
      apiPatch<Standup>(`/api/standups/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: standupKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteStandup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/standups/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: standupKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ─── Team Members ─────────────────────────────────────────────────────────────

export function useTeamMembers(filters?: { active?: boolean }) {
  return useQuery({
    queryKey: teamMemberKeys.list(filters as Record<string, string | undefined> | undefined),
    queryFn: ({ signal }) =>
      apiGet<TeamMember[]>('/api/team-members', filters as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

export function useCreateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateTeamMember) => apiPost<TeamMember>('/api/team-members', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamMemberKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTeamMember }) =>
      apiPatch<TeamMember>(`/api/team-members/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamMemberKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteTeamMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/team-members/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: teamMemberKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ══════════════════════════════════════════════════════════════
// MEETINGS
// ══════════════════════════════════════════════════════════════

export function useMeetings(filters?: { projectId?: string; date?: string; dateFrom?: string; dateTo?: string }) {
  return useQuery({
    queryKey: meetingKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<Meeting[]>('/api/meetings', filters as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

export function useCreateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateMeeting) => apiPost<Meeting>('/api/meetings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateMeeting }) =>
      apiPatch<Meeting>(`/api/meetings/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteMeeting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/meetings/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

// ─── Action Items ─────────────────────────────────────────────────────────────

export function useActionItems(filters?: { meetingId?: string; status?: string }) {
  return useQuery({
    queryKey: actionItemKeys.list(filters),
    queryFn: ({ signal }) =>
      apiGet<MeetingActionItem[]>('/api/action-items', filters as Record<string, string | undefined>, signal),
    staleTime: 60_000,
  });
}

export function useCreateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateActionItem) => apiPost<MeetingActionItem>('/api/action-items', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: actionItemKeys.all });
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useUpdateActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateActionItem }) =>
      apiPatch<MeetingActionItem>(`/api/action-items/${id}`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: actionItemKeys.all });
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}

export function useDeleteActionItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiDelete<{ success: boolean }>(`/api/action-items/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: actionItemKeys.all });
      qc.invalidateQueries({ queryKey: meetingKeys.all });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
    },
  });
}
