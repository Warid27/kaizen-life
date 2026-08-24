import { useState, useEffect } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { useDashboardData } from '@/queries/dashboard';
import { useLogHabit, useUndoHabitLog } from '@/queries/habits';
import { todayStr } from '@/stores/ui';
import { ScheduleCard } from '@/components/dashboard/ScheduleCard';
import { PrioritiesCard } from '@/components/dashboard/PrioritiesCard';
import { HabitsCard } from '@/components/dashboard/HabitsCard';
import { FollowupsCard } from '@/components/dashboard/FollowupsCard';
import { DeadlinesCard } from '@/components/dashboard/DeadlinesCard';
import { ProjectsCard } from '@/components/dashboard/ProjectsCard';
import { FinanceCard } from '@/components/dashboard/FinanceCard';
import { SleepCard } from '@/components/dashboard/SleepCard';
import { QuoteCard } from '@/components/dashboard/QuoteCard';

export default function DashboardApp() {
  return (
    <QueryProvider>
      <DashboardContent />
    </QueryProvider>
  );
}

function DashboardContent() {
  const [greeting, setGreeting] = useState('');
  const { data, isLoading } = useDashboardData();
  const logMut = useLogHabit();
  const undoMut = useUndoHabitLog();

  useEffect(() => {
    const hour = new Date().getHours();
    if (hour < 12) setGreeting('Good morning');
    else if (hour < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  // Working habit toggle (was a dead optional prop): check in when incomplete,
  // undo today's log when complete. The dashboard payload is for today, so
  // completedCount >= targetCount is today's done state.
  const handleToggleHabit = (habitId: string) => {
    const habit = data?.habits.find((h) => h.id === habitId);
    if (!habit) return;
    if (habit.completedCount >= habit.targetCount) {
      undoMut.mutate({ habitId, date: todayStr() });
    } else {
      logMut.mutate({ habitId, data: { date: todayStr(), increment: 1 } });
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          {greeting}, Operator
        </h1>
        <p className="text-sm text-muted-foreground">
          Here's what's on your plate today.
        </p>
      </div>

      {/* Dashboard Grid — PRD §11 card order */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        <ScheduleCard tasks={data?.tasks} isLoading={isLoading} />
        <PrioritiesCard tasks={data?.tasks} isLoading={isLoading} />
        <HabitsCard habits={data?.habits} isLoading={isLoading} onToggleHabit={handleToggleHabit} />
        <FollowupsCard followups={data?.overdueFollowups} isLoading={isLoading} />
        <DeadlinesCard deadlines={data?.upcomingDeadlines} isLoading={isLoading} />
        <ProjectsCard projects={data?.projects} isLoading={isLoading} />
        <FinanceCard finance={data?.finance} isLoading={isLoading} />
        <SleepCard sleep={data?.sleep} isLoading={isLoading} />
        <QuoteCard />
      </div>
    </div>
  );
}
