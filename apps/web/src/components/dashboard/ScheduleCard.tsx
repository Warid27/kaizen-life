import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task } from "@kaizenlife/shared";

interface ScheduleCardProps {
  tasks: Task[] | undefined;
  isLoading: boolean;
}

const STATUS_MAP: Record<string, { label: string; variant: "default" | "secondary" | "success" | "warning" | "destructive" }> = {
  todo: { label: "To do", variant: "secondary" },
  in_progress: { label: "Active", variant: "warning" },
  done: { label: "Done", variant: "success" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

function formatTime(time: string | null): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  const ampm = h >= 12 ? "PM" : "AM";
  const hour12 = h % 12 || 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${ampm}`;
}

export function ScheduleCard({ tasks, isLoading }: ScheduleCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Today's Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-14 shrink-0" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-4 w-12 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const sorted = [...(tasks ?? [])]
    .filter((t) => t.status !== "cancelled")
    .sort((a, b) => {
      if (!a.startTime) return 1;
      if (!b.startTime) return -1;
      return a.startTime.localeCompare(b.startTime);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Today's Schedule</CardTitle>
      </CardHeader>
      <CardContent>
        {sorted.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No tasks scheduled for today.
          </p>
        ) : (
          <ul className="space-y-1">
            {sorted.map((task) => {
              const status = STATUS_MAP[task.status] ?? STATUS_MAP.todo;
              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <span className="w-16 shrink-0 text-xs font-medium tabular-nums text-muted-foreground">
                    {formatTime(task.startTime)}
                  </span>
                  <span className="flex-1 truncate text-sm text-card-foreground">
                    {task.title}
                  </span>
                  <Badge variant={status.variant}>{status.label}</Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
