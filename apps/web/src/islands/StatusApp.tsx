import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api-client';
import { QueryProvider } from '@/lib/query-provider';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

interface StatusComponent {
  name: string;
  value: string;
  status: string;
  version?: string;
  type?: string;
}

interface StatusResponse {
  app: {
    name: string;
    version: string;
    status: string;
    uptime: string;
    uptimeMs: number;
    startedAt: string;
  };
  environment: string;
  timestamp: string;
  components: StatusComponent[];
  memory: {
    heapUsed: string;
    heapTotal: string;
    rss: string;
  };
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function isOperational(status: string): boolean {
  return status === 'ok' || status === 'operational';
}

/* ------------------------------------------------------------------ */
/*  Primitives                                                         */
/* ------------------------------------------------------------------ */

function StatusDot({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'inline-block h-2 w-2 shrink-0 rounded-full',
        isOperational(status) ? 'bg-emerald-500' : 'bg-red-500',
      )}
      aria-hidden="true"
    />
  );
}

function StatusChip({ status }: { status: string }) {
  const ok = isOperational(status);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
        ok
          ? 'bg-emerald-500/10 text-emerald-500 ring-1 ring-emerald-500/20'
          : 'bg-red-500/10 text-red-500 ring-1 ring-red-500/20',
      )}
    >
      <StatusDot status={status} />
      {ok ? 'Operational' : 'Error'}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Stat Card                                                          */
/* ------------------------------------------------------------------ */

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: 'green' | 'red' | 'default';
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 transition-colors hover:bg-accent/5">
      <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          'mt-3 font-mono text-2xl font-semibold tracking-tight',
          accent === 'green' && 'text-emerald-500',
          accent === 'red' && 'text-red-500',
          !accent && 'text-card-foreground',
        )}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 font-mono text-xs text-muted-foreground">{sub}</div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Loading Skeleton                                                   */
/* ------------------------------------------------------------------ */

function LoadingSkeleton() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="animate-pulse rounded-xl border border-border bg-card p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-6 w-72 rounded bg-muted" />
            <div className="h-4 w-48 rounded bg-muted" />
          </div>
          <div className="h-7 w-36 rounded-full bg-muted" />
        </div>
      </div>
      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <div
            key={i}
            className="animate-pulse rounded-xl border border-border bg-card p-5"
          >
            <div className="h-3 w-24 rounded bg-muted" />
            <div className="mt-3 h-8 w-28 rounded bg-muted" />
            <div className="mt-2 h-3 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
      {/* Table */}
      <div className="animate-pulse rounded-xl border border-border bg-card p-5">
        <div className="mb-4 h-4 w-28 rounded bg-muted" />
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="flex items-center justify-between border-b border-border py-3 last:border-0"
          >
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
            <div className="h-5 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Error State                                                        */
/* ------------------------------------------------------------------ */

function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="mx-auto max-w-5xl p-4 sm:p-6">
      <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-12 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10">
          <svg
            className="h-7 w-7 text-destructive"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="1.5"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-foreground">
          Unable to Fetch Status
        </h3>
        <p className="mt-2 text-sm text-muted-foreground">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 active:bg-primary/80"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth="2"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182"
            />
          </svg>
          Try Again
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main Status Page                                                   */
/* ------------------------------------------------------------------ */

function StatusPage() {
  const [latency, setLatency] = useState<number | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const { data, isLoading, error, refetch } = useQuery<StatusResponse>({
    queryKey: ['status'],
    queryFn: async ({ signal }) => {
      const start = performance.now();
      const result = await apiGet<StatusResponse>(
        '/api/status',
        undefined,
        signal,
      );
      setLatency(Math.round(performance.now() - start));
      setLastChecked(new Date());
      return result;
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
    refetchOnWindowFocus: true,
  });

  /* ---------- Loading ---------- */
  if (isLoading) return <LoadingSkeleton />;

  /* ---------- Error ---------- */
  if (error || !data) {
    return (
      <ErrorState
        message={
          error instanceof Error
            ? error.message
            : 'The status endpoint is unreachable.'
        }
        onRetry={() => refetch()}
      />
    );
  }

  /* ---------- Derived data ---------- */
  const db = data.components.find((c) => c.name === 'Database');
  const runtime = data.components.find((c) => c.name === 'Runtime');

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      {/* ── Header ─────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-card p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl font-semibold text-card-foreground">
              {data.app.name}
              <span className="text-muted-foreground"> · Backend Status</span>
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              v{data.app.version} · Real-time system health monitoring
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Live indicator */}
            <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>
            <StatusChip status={data.app.status} />
          </div>
        </div>
      </div>

      {/* ── Stat Cards ────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard
          label="Database Status"
          value={
            db
              ? isOperational(db.status)
                ? 'Connected'
                : 'Disconnected'
              : '—'
          }
          sub={db?.value ?? undefined}
          accent={db ? (isOperational(db.status) ? 'green' : 'red') : 'default'}
        />

        <StatCard
          label="Database Info"
          value={db?.value ?? '—'}
          sub={db?.type ?? undefined}
        />

        <StatCard label="Cache Status" value="N/A" sub="No cache layer" />

        <StatCard
          label="Response Time"
          value={latency !== null ? `${latency} ms` : '—'}
          sub="API round-trip latency"
        />

        <StatCard
          label="Memory Usage"
          value={data.memory.heapUsed}
          sub={`Total: ${data.memory.heapTotal} · RSS: ${data.memory.rss}`}
        />

        <StatCard
          label="Application Uptime"
          value={data.app.uptime}
          sub={`Since ${new Date(data.app.startedAt).toLocaleDateString()}`}
        />

        <StatCard
          label="Environment"
          value={data.environment}
          sub={runtime?.type ?? undefined}
        />
      </div>

      {/* ── Components Table ───────────────────────────── */}
      <div className="rounded-xl border border-border bg-card">
        <div className="border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold text-card-foreground">
            Components
          </h2>
        </div>
        <div className="divide-y divide-border">
          {data.components.map((comp) => (
            <div
              key={comp.name}
              className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-muted/30"
            >
              <div className="flex items-center gap-3">
                <StatusDot status={comp.status} />
                <div>
                  <span className="text-sm font-medium text-card-foreground">
                    {comp.name}
                  </span>
                  <span className="ml-2 font-mono text-xs text-muted-foreground">
                    {comp.value}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {(comp.version || comp.type) && (
                  <span className="hidden font-mono text-xs text-muted-foreground sm:inline">
                    {comp.version || comp.type}
                  </span>
                )}
                <StatusChip status={comp.status} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      <div className="flex flex-col items-center justify-between gap-2 rounded-xl border border-border bg-card px-5 py-3 sm:flex-row">
        <span className="text-xs text-muted-foreground">
          {lastChecked
            ? `Last checked ${lastChecked.toLocaleTimeString()}`
            : 'Checking...'}
        </span>
        <span className="font-mono text-xs text-muted-foreground">
          Generated {new Date(data.timestamp).toLocaleString()}
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Exported wrapper with QueryProvider                                */
/* ------------------------------------------------------------------ */

export default function StatusApp() {
  return (
    <QueryProvider>
      <StatusPage />
    </QueryProvider>
  );
}
