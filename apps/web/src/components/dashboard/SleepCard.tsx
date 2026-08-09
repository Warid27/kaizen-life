import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Moon, Smile, Zap, Activity } from "lucide-react";
import { cn } from "@/lib/utils";

interface SleepData {
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
}

interface SleepCardProps {
  sleep: SleepData | undefined;
  isLoading: boolean;
}

function formatMinutes(mins: number | null): string {
  if (mins === null) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h ${m}m`;
}

function StatBlock({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md px-2 py-1.5">
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-md", color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground">{label}</p>
        <p className="text-sm font-semibold tabular-nums text-card-foreground">{value}</p>
      </div>
    </div>
  );
}

export function SleepCard({ sleep, isLoading }: SleepCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sleep & Wellness</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-7 w-7 rounded-md" />
              <Skeleton className="h-8 w-16" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const avg = sleep?.avgLast7Days;
  const y = sleep?.yesterday;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Sleep & Wellness</span>
          {avg && (
            <span className="text-xs font-normal text-muted-foreground">
              {avg.daysCount}-day avg
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!avg && !y ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No sleep data recorded yet.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-1">
            <StatBlock
              icon={Moon}
              label="Avg Sleep"
              value={formatMinutes(avg?.minutes ?? null)}
              color="bg-indigo-100 text-indigo-600 dark:bg-indigo-950 dark:text-indigo-400"
            />
            <StatBlock
              icon={Smile}
              label="Yesterday"
              value={y?.sleepQuality != null ? `${y.sleepQuality}/10` : "—"}
              color="bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
            />
            <StatBlock
              icon={Zap}
              label="Energy"
              value={y?.napMinutes != null ? `${y.napMinutes}m nap` : "—"}
              color="bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400"
            />
            <StatBlock
              icon={Activity}
              label="Bed Time"
              value={y?.bedTime ?? "—"}
              color="bg-violet-100 text-violet-600 dark:bg-violet-950 dark:text-violet-400"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
