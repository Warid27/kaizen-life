import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

interface Followup {
  id: string;
  clientId: string;
  clientName: string;
  lastContactDate: string | null;
  nextFollowupDate: string | null;
  notes: string | null;
}

interface FollowupsCardProps {
  followups: Followup[] | undefined;
  isLoading: boolean;
}

function daysOverdue(dateStr: string | null): number {
  if (!dateStr) return 0;
  const target = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function FollowupsCard({ followups, isLoading }: FollowupsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Overdue Follow-ups</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-3 flex-1" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const count = followups?.length ?? 0;

  return (
    <Card className={count > 0 ? "border-destructive/30" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span>Overdue Follow-ups</span>
          {count > 0 && (
            <Badge variant="destructive" className="ml-auto">
              {count}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {count === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            All follow-ups are current.
          </p>
        ) : (
          <ul className="space-y-1">
            {followups!.map((f) => {
              const overdue = daysOverdue(f.nextFollowupDate);
              return (
                <li
                  key={f.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-destructive/5"
                >
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />
                  <span className="flex-1 truncate text-sm font-medium text-card-foreground">
                    {f.clientName}
                  </span>
                  <span className="shrink-0 text-xs text-destructive">
                    {overdue > 0 ? `${overdue}d overdue` : formatDate(f.nextFollowupDate)}
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
