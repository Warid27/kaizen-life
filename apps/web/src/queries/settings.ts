import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPatch } from '@/lib/api-client';
import type { Settings, UpdateSettingsInput } from '@kaizenlife/shared';

// ─── Types (server contract — /api/settings now exists; B1) ──────────────────

export type UserSettings = Settings;

export interface ReminderItem {
  type: string;
  title: string;
  detail: string;
  date: string;
  priority: 'info' | 'warning' | 'urgent';
}

interface ReminderListResponse {
  data: ReminderItem[];
}

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const settingsKeys = {
  all: ['settings'] as const,
  user: () => [...settingsKeys.all, 'user'] as const,
};

export const reminderKeys = {
  all: ['reminders'] as const,
  list: () => [...reminderKeys.all, 'list'] as const,
};

// ─── Settings queries ─────────────────────────────────────────────────────────

export function useUserSettings() {
  return useQuery({
    queryKey: settingsKeys.user(),
    queryFn: ({ signal }) => apiGet<UserSettings>('/api/settings', undefined, signal),
    staleTime: 5 * 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateSettingsInput) => apiPatch<UserSettings>('/api/settings', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: settingsKeys.all });
    },
  });
}

/** Trigger the full-data JSON export download (GET returns an attachment). */
export function useExportData() {
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const base =
        (import.meta.env.PUBLIC_API_URL as string | undefined) || 'http://localhost:3001';
      // Let the browser handle the Content-Disposition attachment.
      window.open(`${base}/api/export/json`, '_blank', 'noopener');
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

// ─── Local settings (localStorage fallback for UI-only prefs) ────────────────

const LOCAL_SETTINGS_KEY = 'kaizenlife-settings';

interface LocalPrefs {
  theme: 'light' | 'dark' | 'system';
}

const defaultLocalPrefs: LocalPrefs = { theme: 'system' };

export function getLocalPrefs(): LocalPrefs {
  if (typeof window === 'undefined') return defaultLocalPrefs;
  try {
    const stored = localStorage.getItem(LOCAL_SETTINGS_KEY);
    if (stored) return { ...defaultLocalPrefs, ...JSON.parse(stored) };
  } catch {
    // fall through
  }
  return defaultLocalPrefs;
}

export function saveLocalPrefs(prefs: LocalPrefs): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(LOCAL_SETTINGS_KEY, JSON.stringify({ ...getLocalPrefs(), ...prefs }));
}
