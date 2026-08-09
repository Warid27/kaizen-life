import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Task } from "@kaizenlife/shared";

interface PrioritiesCardProps {
  tasks: Task[] | undefined;
  isLoading: boolean;
}

const PRIORITY_LABELS: Record<string, { label: string; dot: string }> = {
  urgent: { label: "Urgent", dot: "bg-red-500" },
  high: { label: "High", dot: "bg-orange-500" },
};

export function PrioritiesCard({ tasks, isLoading }: PrioritiesCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Priorities</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-2 w-2 rounded-full" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const priorities = (tasks ?? [])
    .filter((t) => (t.priority === "urgent" || t.priority === "high") && t.status !== "done" && t.status !== "cancelled")
    .sort((a, b) => {
      if (a.priority === "urgent" && b.priority !== "urgent") return -1;
      if (a.priority !== "urgent" && b.priority === "urgent") return 1;
      return 0;
    })
    .slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Priorities</CardTitle>
      </CardHeader>
      <CardContent>
        {priorities.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No high-priority tasks today.
          </p>
        ) : (
          <ul className="space-y-1">
            {priorities.map((task) => {
              const p = PRIORITY_LABELS[task.priority] ?? PRIORITY_LABELS.high;
              return (
                <li
                  key={task.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <span className={`h-2 w-2 shrink-0 rounded-full ${p.dot}`} />
                  <span className="flex-1 truncate text-sm text-card-foreground">
                    {task.title}
                  </span>
                  <Badge variant={task.priority === "urgent" ? "destructive" : "warning"}>
                    {p.label}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
