import { useState } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useStatsOverview,
  type StatsRange,
  type StatsOverview,
} from '@/queries/stats';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  BarChart3,
  ListTodo,
  Repeat,
  Moon,
  BookOpen,
  Wallet,
  AlertCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatCents, type Currency } from '@/lib/currency';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
);

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RANGE_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: 7, label: '7D' },
  { value: 30, label: '30D' },
  { value: 90, label: '90D' },
  { value: 365, label: '1Y' },
];

const CHART_COLORS = {
  primary: 'hsl(222.2, 47.4%, 11.2%)',
  muted: 'hsl(215.4, 16.3%, 46.9%)',
  border: 'hsl(214.3, 31.8%, 91.4%)',
  emerald: 'hsl(160, 84%, 39%)',
  amber: 'hsl(38, 92%, 50%)',
};

function formatSleep(minutes: number | null): string {
  if (minutes == null) return '—';
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function isEmptyOverview(data: StatsOverview): boolean {
  return (
    data.tasks.created === 0 &&
    data.tasks.completed === 0 &&
    data.habits.active === 0 &&
    data.habits.completions === 0 &&
    data.sleep.nights === 0 &&
    data.diary.entries === 0 &&
    Object.keys(data.finance.byCurrency).length === 0
  );
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

  const { data: stats, isPending, error, refetch } = useStatsOverview(range);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Statistics</h1>
          <p className="text-sm text-muted-foreground">
            Your life at a glance — last {range} days
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

      {isPending ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-3 w-16" />
                  <Skeleton className="h-6 w-20" />
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="mb-3 h-5 w-32" />
                  <Skeleton className="h-[200px] w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ) : error ? (
        <ErrorCard message={error.message} onRetry={() => refetch()} />
      ) : stats ? (
        isEmptyOverview(stats) ? (
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart3 className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm font-medium text-foreground">
                No activity recorded in this period
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Log habits, tasks, sleep, diary entries or transactions and your stats will appear here.
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Aggregate stat cards */}
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
              <StatCard
                icon={<ListTodo className="h-4 w-4 text-blue-600" />}
                label="Tasks"
                value={`${stats.tasks.completed}/${stats.tasks.created}`}
                sub="completed / created"
              />
              <StatCard
                icon={<Repeat className="h-4 w-4 text-emerald-600" />}
                label="Habits"
                value={`${stats.habits.completions}`}
                sub={`${stats.habits.active} active`}
              />
              <StatCard
                icon={<Moon className="h-4 w-4 text-indigo-600" />}
                label="Sleep"
                value={formatSleep(stats.sleep.avgMinutes)}
                sub={
                  stats.sleep.nights > 0
                    ? `across ${stats.sleep.nights} night${stats.sleep.nights === 1 ? '' : 's'}`
                    : 'no nights logged'
                }
              />
              <StatCard
                icon={<BookOpen className="h-4 w-4 text-violet-600" />}
                label="Diary"
                value={`${stats.diary.entries}`}
                sub="entries"
              />
              <FinanceStatCard byCurrency={stats.finance.byCurrency} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {/* Tasks created vs completed */}
              <StatsCard
                title="Tasks: Created vs Completed"
                icon={<ListTodo className="h-4 w-4 text-blue-600" />}
                badge={`${
                  stats.tasks.created > 0
                    ? Math.round((stats.tasks.completed / stats.tasks.created) * 100)
                    : 0
                }% done`}
              >
                {stats.tasks.created === 0 && stats.tasks.completed === 0 ? (
                  <EmptyChart label="No tasks in this period." />
                ) : (
                  <Bar
                    data={{
                      labels: ['Created', 'Completed'],
                      datasets: [
                        {
                          label: 'Tasks',
                          data: [stats.tasks.created, stats.tasks.completed],
                          backgroundColor: [
                            CHART_COLORS.amber,
                            CHART_COLORS.emerald,
                          ],
                          borderRadius: 4,
                          barPercentage: 0.5,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: baseScaleOptions(),
                    }}
                  />
                )}
              </StatsCard>

              {/* Habits completions vs active */}
              <StatsCard
                title="Habit Completions"
                icon={<Repeat className="h-4 w-4 text-emerald-600" />}
                badge={`${stats.habits.active} active`}
              >
                {stats.habits.active === 0 && stats.habits.completions === 0 ? (
                  <EmptyChart label="No habit activity in this period." />
                ) : (
                  <Bar
                    data={{
                      labels: ['Active habits', 'Completions'],
                      datasets: [
                        {
                          label: 'Habits',
                          data: [stats.habits.active, stats.habits.completions],
                          backgroundColor: [
                            CHART_COLORS.muted,
                            CHART_COLORS.emerald,
                          ],
                          borderRadius: 4,
                          barPercentage: 0.5,
                        },
                      ],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: baseScaleOptions(),
                    }}
                  />
                )}
              </StatsCard>
            </div>
          </>
        )
      ) : null}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function baseScaleOptions(showY = true) {
  return {
    x: {
      grid: { display: false },
      ticks: { font: { size: 10 }, color: CHART_COLORS.muted },
    },
    ...(showY && {
      y: {
        beginAtZero: true,
        grid: { color: CHART_COLORS.border },
        ticks: { font: { size: 10 }, color: CHART_COLORS.muted, precision: 0 },
      },
    }),
  };
}

function StatCard({
  icon,
  label,
  value,
  sub,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2">
          {icon}
          <span className="text-xs text-muted-foreground">{label}</span>
        </div>
        <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
        {sub && <p className="mt-0.5 text-[11px] text-muted-foreground">{sub}</p>}
      </CardContent>
    </Card>
  );
}

/** Per-currency finance totals — never sums across currencies (BL12). */
function FinanceStatCard({
  byCurrency,
}: {
  byCurrency: StatsOverview['finance']['byCurrency'];
}) {
  const entries = Object.entries(byCurrency);
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-1 flex items-center gap-2">
          <Wallet className="h-4 w-4 text-emerald-600" />
          <span className="text-xs text-muted-foreground">Net flow</span>
        </div>
        {entries.length === 0 ? (
          <p className="text-xl font-semibold text-foreground">—</p>
        ) : (
          <div className="mt-1 space-y-1">
            {entries.map(([ccy, v]) => (
              <div key={ccy} className="flex items-baseline justify-between gap-2">
                <span className="text-[11px] font-medium uppercase text-muted-foreground">
                  {ccy}
                </span>
                <span
                  className={cn(
                    'text-sm font-semibold tabular-nums',
                    v.netCents >= 0 ? 'text-emerald-600' : 'text-destructive',
                  )}
                >
                  {formatCents(v.netCents, ccy as Currency)}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function StatsCard({
  title,
  icon,
  badge,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  badge?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
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

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-md border border-dashed border-border">
      <p className="px-4 text-center text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-destructive">{message}</p>
        <Button variant="outline" size="sm" onClick={onRetry}>
          Retry
        </Button>
      </CardContent>
    </Card>
  );
}
