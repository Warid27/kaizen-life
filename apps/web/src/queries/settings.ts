import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPost, apiPut } from '@/lib/api-client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface UserSettings {
  name: string;
  email: string;
  timezone: string;
  language: string;
  theme: 'light' | 'dark' | 'system';
  notifications: {
    email: boolean;
    push: boolean;
    habitReminders: boolean;
    taskDeadlines: boolean;
    dailyCheckIn: boolean;
    weeklyReview: boolean;
  };
  habits: {
    defaultFrequency: string;
    weekStartsOn: 'monday' | 'sunday';
    showCompletedHabits: boolean;
  };
}

export interface Reminder {
  id: string;
  type: 'habit' | 'task' | 'checkin' | 'diary' | 'meeting' | 'custom';
  title: string;
  description?: string;
  scheduledAt: string;
  completedAt?: string;
  overdue: boolean;
  href?: string;
}

export interface BackupEntry {
  id: string;
  createdAt: string;
  sizeBytes: number;
  type: 'manual' | 'scheduled';
}

// ─── Response wrappers ────────────────────────────────────────────────────────

type SettingsResponse = { data: UserSettings };
type ReminderListResponse = { data: Reminder[] };
type BackupListResponse = { data: BackupEntry[] };
type BackupCreateResponse = { data: BackupEntry };
type ExportResponse = { data: { downloadUrl: string } };

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const settingsKeys = {
  all: ['settings'] as const,
  user: () => [...settingsKeys.all, 'user'] as const,
};

export const reminderKeys = {
  all: ['reminders'] as const,
  list: () => [...reminderKeys.all, 'list'] as const,
};

export const backupKeys = {
  all: ['backups'] as const,
  list: () => [...backupKeys.all, 'list'] as const,
};

// ─── Settings queries ─────────────────────────────────────────────────────────

export function useUserSettings() {
  return useQuery({
    queryKey: settingsKeys.user(),
    queryFn: ({ signal }) =>
      apiGet<SettingsResponse>('/api/settings', undefined, signal),
    select: (res) => res.data,
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Partial<UserSettings>) =>
      apiPut<SettingsResponse>('/api/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

// ─── Reminders queries ────────────────────────────────────────────────────────

export function useReminders() {
  return useQuery({
    queryKey: reminderKeys.list(),
    queryFn: ({ signal }) =>
      apiGet<ReminderListResponse>('/api/reminders', undefined, signal),
    select: (res) => res.data,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

// ─── Backup queries ───────────────────────────────────────────────────────────

export function useBackups() {
  return useQuery({
    queryKey: backupKeys.list(),
    queryFn: ({ signal }) =>
      apiGet<BackupListResponse>('/api/backups', undefined, signal),
    select: (res) => res.data,
    staleTime: 30_000,
  });
}

export function useCreateBackup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiPost<BackupCreateResponse>('/api/backups'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: backupKeys.all });
    },
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: () => apiPost<ExportResponse>('/api/export/json'),
  });
}

// ─── Local settings (localStorage fallback when no API) ──────────────────────

const LOCAL_SETTINGS_KEY = 'kaizenlife-settings';

const defaultSettings: UserSettings = {
  name: '',
  email: '',
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  language: 'en',
  theme: 'system',
  notifications: {
    email: false,
    push: true,
    habitReminders: true,
    taskDeadlines: true,
    dailyCheckIn: true,
    weeklyReview: false,
  },
  habits: {
    defaultFrequency: 'daily',
    weekStartsOn: 'monday',
    showCompletedHabits: true,
  },
};

export function getLocalSettings(): UserSettings {
  if (typeof window === 'undefined') return defaultSettings;
  try {
    const stored = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (stored) return { ...defaultSettings, ...JSON.parse(stored) };
  } catch {
    // fall through
  }
  return defaultSettings;
}

export function saveLocalSettings(settings: UserSettings): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify(settings));
}
