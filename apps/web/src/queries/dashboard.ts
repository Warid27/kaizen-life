import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import type { Task, TaskFilter } from '@kaizenlife/shared';

// ─── Response shapes ──────────────────────────────────────────────────────────

export type DashboardData = {
  date: string;
  tasks: Task[];
  habits: {
    id: string;
    name: string;
    icon: string | null;
    category: string | null;
    targetCountPerPeriod: number;
    sortOrder: number;
    completedCount: number;
    targetCount: number;
  }[];
  sleep: {
    yesterday: {
      date: string;
      bedTime: string | null;
      wakeTime: string | null;
      totalSleepMinutes: number | null;
      sleepQuality: number | null;
      napMinutes: number | null;
    } | null;
    avgLast7Days: {
      minutes: number | null;
      daysCount: number;
    };
  };
  finance: {
    month: { start: string; end: string };
    incomeCents: number;
    expenseCents: number;
    netCents: number;
    transactionCount: number;
  };
  projects: {
    id: string;
    name: string;
    status: string;
    priority: string;
    progressPct: number;
    deadline: string | null;
  }[];
  upcomingDeadlines: {
    id: string;
    title: string;
    date: string | null;
    priority: string;
    status: string;
    type: string;
  }[];
  overdueFollowups: {
    id: string;
    clientId: string;
    clientName: string;
    lastContactDate: string | null;
    nextFollowupDate: string | null;
    notes: string | null;
  }[];
};

// ─── Keys ─────────────────────────────────────────────────────────────────────

export const dashboardKeys = {
  all: ['dashboard'] as const,
  today: () => [...dashboardKeys.all, 'today'] as const,
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDashboardData() {
  return useQuery({
    queryKey: dashboardKeys.today(),
    queryFn: ({ signal }) => apiGet<DashboardData>('/api/dashboard/today', undefined, signal),
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // auto-refresh every 5 minutes
  });
}
