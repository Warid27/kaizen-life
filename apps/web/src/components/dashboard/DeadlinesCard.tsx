import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock } from "lucide-react";

interface Deadline {
  id: string;
  title: string;
  date: string | null;
  priority: string;
  status: string;
  type: string;
}

interface DeadlinesCardProps {
  deadlines: Deadline[] | undefined;
  isLoading: boolean;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const target = new Date(dateStr);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "No date";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const TYPE_LABELS: Record<string, string> = {
  task: "Task",
  assignment: "Assignment",
  exam: "Exam",
  project: "Project",
  other: "Other",
};

export function DeadlinesCard({ deadlines, isLoading }: DeadlinesCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Upcoming Deadlines</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const items = (deadlines ?? [])
    .filter((d) => {
      const days = daysUntil(d.date);
      return days !== null && days >= 0 && days <= 7 && d.status !== "done" && d.status !== "cancelled";
    })
    .sort((a, b) => {
      const da = daysUntil(a.date) ?? 999;
      const db = daysUntil(b.date) ?? 999;
      return da - db;
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming Deadlines</CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No deadlines in the next 7 days.
          </p>
        ) : (
          <ul className="space-y-1">
            {items.map((d) => {
              const days = daysUntil(d.date);
              const isToday = days === 0;
              const isTomorrow = days === 1;
              const label = isToday ? "Today" : isTomorrow ? "Tomorrow" : `${days}d`;
              return (
                <li
                  key={d.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <Clock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate text-sm text-card-foreground">
                    {d.title}
                  </span>
                  <Badge
                    variant={isToday ? "destructive" : isTomorrow ? "warning" : "secondary"}
                  >
                    {label}
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
