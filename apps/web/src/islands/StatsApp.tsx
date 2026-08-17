import { useState, useMemo } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useStatsOverview,
  type StatsRange,
  type HabitStatsPoint,
  type SleepStatsPoint,
  type MoodStatsPoint,
  type FinanceStatsPoint,
  type ProjectStatsPoint,
} from '@/queries/stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  Activity,
  Moon,
  Brain,
  DollarSign,
  FolderKanban,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCentsCompact } from '@/lib/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Tooltip,
  Legend,
  Filler,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 365, label: '1Y' },
];

// ─── Demo data generators ─────────────────────────────────────────────────────

function generateDemoHabitStats(days: number): HabitStatsPoint[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const total = 5 + (i % 3);
    const completed = Math.floor(total * (0.5 + Math.random() * 0.5));
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      completed,
      total,
      rate: Math.round((completed / total) * 100),
    };
  });
}

function generateDemoSleepStats(days: number): SleepStatsPoint[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      totalMinutes: 360 + Math.floor(Math.random() * 180),
      quality: 1 + Math.floor(Math.random() * 4),
    };
  });
}

function generateDemoMoodStats(days: number): MoodStatsPoint[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      mood: 1 + Math.floor(Math.random() * 4),
      energy: 1 + Math.floor(Math.random() * 4),
      focus: 1 + Math.floor(Math.random() * 4),
    };
  });
}

function generateDemoFinanceStats(days: number): FinanceStatsPoint[] {
  const now = new Date();
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    const isPayday = d.getDate() === 1 || d.getDate() === 15;
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      incomeCents: isPayday ? 3500000 : 0,
      expenseCents: 50000 + Math.floor(Math.random() * 150000),
      netCents: isPayday
        ? 3500000 - 50000 - Math.floor(Math.random() * 150000)
        : -(50000 + Math.floor(Math.random() * 150000)),
    };
  });
}

function generateDemoProjectStats(days: number): ProjectStatsPoint[] {
  const now = new Date();
  let tasksCompleted = 0;
  let tasksCreated = 0;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(now);
    d.setDate(d.getDate() - (days - 1 - i));
    tasksCompleted += Math.floor(Math.random() * 4);
    tasksCreated += Math.floor(Math.random() * 3);
    return {
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
      tasksCompleted,
      tasksCreated,
      projectsActive: 2 + (i % 2),
    };
  });
}

// ─── Chart config helpers ─────────────────────────────────────────────────────

const CHART_COLORS = {
  primary: 'hsl(222.2, 47.4%, 11.2%)',
  muted: 'hsl(215.4, 16.3%, 46.9%)',
  border: 'hsl(214.3, 31.8%, 91.4%)',
  emerald: 'hsl(160, 84%, 39%)',
  amber: 'hsl(38, 92%, 50%)',
  rose: 'hsl(346, 77%, 50%)',
  blue: 'hsl(217, 91%, 60%)',
  violet: 'hsl(270, 91%, 65%)',
};

function baseScaleOptions(showY = true) {
  return {
    x: {
      grid: { display: false },
      ticks: { font: { size: 9 }, color: CHART_COLORS.muted, maxTicksLimit: 8 },
    },
    ...(showY && {
      y: {
        grid: { color: CHART_COLORS.border },
        ticks: { font: { size: 9 }, color: CHART_COLORS.muted },
      },
    }),
  };
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function StatsApp() {
  return (
    <QueryProvider>
      <StatsContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function StatsContent() {
  const [range, setRange] = useState<StatsRange>(30);

  const { data: stats, isLoading } = useStatsOverview(range);

  // Demo data
  const habitData = stats?.habits ?? generateDemoHabitStats(range);
  const sleepData = stats?.sleep ?? generateDemoSleepStats(range);
  const moodData = stats?.mood ?? generateDemoMoodStats(range);
  const financeData = stats?.finance ?? generateDemoFinanceStats(range);
  const projectData = stats?.projects ?? generateDemoProjectStats(range);

  const labels = habitData.map((d) => {
    const parts = d.date.split('-');
    return `${parseInt(parts[1])}/${parseInt(parts[2])}`;
  });

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Statistics</h1>
          <p className="text-sm text-muted-foreground">
            Your life at a glance
          </p>
        </div>

        {/* Date Range Selector */}
        <div className="flex gap-1 rounded-lg border border-border p-0.5">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setRange(opt.value)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition-colors',
                range === opt.value
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Charts Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-3 h-5 w-32" />
                <Skeleton className="h-[200px] w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Habits Chart */}
          <StatsCard
            title="Habit Completion"
            icon={<Activity className="h-4 w-4 text-emerald-600" />}
            badge={`${Math.round(habitData.reduce((s, d) => s + d.rate, 0) / habitData.length)}% avg`}
          >
            <Bar
              data={{
                labels,
                datasets: [
                  {
                    label: 'Completion Rate %',
                    data: habitData.map((d) => d.rate),
                    backgroundColor: CHART_COLORS.emerald,
                    borderRadius: 3,
                    barPercentage: 0.7,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  ...baseScaleOptions(),
                  y: {
                    ...baseScaleOptions().y,
                    max: 100,
                    ticks: { ...baseScaleOptions().y.ticks, callback: (v: any) => `${v}%` },
                  },
                },
              }}
            />
          </StatsCard>

          {/* Sleep Chart */}
          <StatsCard
            title="Sleep Duration"
            icon={<Moon className="h-4 w-4 text-blue-600" />}
            badge={`${(sleepData.reduce((s, d) => s + (d.totalMinutes ?? 0), 0) / sleepData.length / 60).toFixed(1)}h avg`}
          >
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: 'Hours',
                    data: sleepData.map((d) => d.totalMinutes != null ? +(d.totalMinutes / 60).toFixed(1) : null),
                    borderColor: CHART_COLORS.blue,
                    backgroundColor: 'hsla(217, 91%, 60%, 0.1)',
                    fill: true,
                    tension: 0.3,
                    pointRadius: range <= 30 ? 2 : 0,
                    pointHoverRadius: 4,
                    borderWidth: 2,
                    spanGaps: true,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                  ...baseScaleOptions(),
                  y: {
                    ...baseScaleOptions().y,
                    ticks: { ...baseScaleOptions().y.ticks, callback: (v: any) => `${v}h` },
                  },
                },
              }}
            />
          </StatsCard>

          {/* Mood Chart */}
          <StatsCard
            title="Mood & Energy"
            icon={<Brain className="h-4 w-4 text-violet-600" />}
          >
            <Line
              data={{
                labels,
                datasets: [
                  {
                    label: 'Mood',
                    data: moodData.map((d) => d.mood),
                    borderColor: CHART_COLORS.violet,
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointRadius: range <= 30 ? 2 : 0,
                    borderWidth: 2,
                  },
                  {
                    label: 'Energy',
                    data: moodData.map((d) => d.energy),
                    borderColor: CHART_COLORS.amber,
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointRadius: range <= 30 ? 2 : 0,
                    borderWidth: 2,
                  },
                  {
                    label: 'Focus',
                    data: moodData.map((d) => d.focus),
                    borderColor: CHART_COLORS.emerald,
                    backgroundColor: 'transparent',
                    tension: 0.3,
                    pointRadius: range <= 30 ? 2 : 0,
                    borderWidth: 2,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: 'bottom' as const,
                    labels: { font: { size: 10 }, boxWidth: 12, padding: 12 },
                  },
                },
                scales: {
                  ...baseScaleOptions(),
                  y: {
                    ...baseScaleOptions().y,
                    min: 0,
                    max: 5,
                    ticks: { ...baseScaleOptions().y.ticks, stepSize: 1 },
                  },
                },
              }}
            />
          </StatsCard>

          {/* Finance Chart */}
          <StatsCard
            title="Income vs Expenses"
            icon={<DollarSign className="h-4 w-4 text-emerald-600" />}
          >
            <Bar
              data={{
                labels,
                datasets: [
                  {
                    label: 'Income',
                    data: financeData.map((d) => d.incomeCents / 100),
                    backgroundColor: CHART_COLORS.emerald,
                    borderRadius: 3,
                    barPercentage: 0.6,
                  },
                  {
                    label: 'Expenses',
                    data: financeData.map((d) => d.expenseCents / 100),
                    backgroundColor: CHART_COLORS.rose,
                    borderRadius: 3,
                    barPercentage: 0.6,
                  },
                ],
              }}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                  legend: {
                    display: true,
                    position: 'bottom' as const,
                    labels: { font: { size: 10 }, boxWidth: 12, padding: 12 },
                  },
                },
                scales: {
                  ...baseScaleOptions(),
                  y: {
                    ...baseScaleOptions().y,
                    ticks: { ...baseScaleOptions().y.ticks, callback: (v: any) => formatCentsCompact(Math.round(v * 100)) },
                  },
                },
              }}
            />
          </StatsCard>

          {/* Project Progress */}
          <StatsCard
            title="Project Progress"
            icon={<FolderKanban className="h-4 w-4 text-amber-600" />}
            badge={`${projectData[projectData.length - 1]?.projectsActive ?? 0} active`}
            className="lg:col-span-2"
          >
            <div style={{ height: 200 }}>
              <Line
                data={{
                  labels,
                  datasets: [
                    {
                      label: 'Tasks Completed (cumulative)',
                      data: projectData.map((d) => d.tasksCompleted),
                      borderColor: CHART_COLORS.emerald,
                      backgroundColor: 'hsla(160, 84%, 39%, 0.1)',
                      fill: true,
                      tension: 0.3,
                      pointRadius: 0,
                      borderWidth: 2,
                    },
                    {
                      label: 'Tasks Created (cumulative)',
                      data: projectData.map((d) => d.tasksCreated),
                      borderColor: CHART_COLORS.amber,
                      backgroundColor: 'transparent',
                      tension: 0.3,
                      pointRadius: 0,
                      borderWidth: 2,
                      borderDash: [5, 5],
                    },
                  ],
                }}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: {
                      display: true,
                      position: 'bottom' as const,
                      labels: { font: { size: 10 }, boxWidth: 12, padding: 12 },
                    },
                  },
                  scales: baseScaleOptions(),
                }}
              />
            </div>
          </StatsCard>
        </div>
      )}
    </div>
  );
}

// ─── Stats Card wrapper ───────────────────────────────────────────────────────

function StatsCard({
  title,
  icon,
  badge,
  children,
  className,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn(className)}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm">
            {icon}
            {title}
          </span>
          {badge && (
            <Badge variant="secondary" className="text-[10px]">
              {badge}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ height: 200 }}>{children}</div>
      </CardContent>
    </Card>
  );
}
