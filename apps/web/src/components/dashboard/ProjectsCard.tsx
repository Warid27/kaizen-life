import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { FolderKanban } from "lucide-react";

interface Project {
  id: string;
  name: string;
  status: string;
  priority: string;
  progressPct: number;
  deadline: string | null;
}

interface ProjectsCardProps {
  projects: Project[] | undefined;
  isLoading: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  active: "text-emerald-600 dark:text-emerald-400",
  on_hold: "text-amber-600 dark:text-amber-400",
  completed: "text-muted-foreground",
  archived: "text-muted-foreground",
};

export function ProjectsCard({ projects, isLoading }: ProjectsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Active Projects</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <div key={i} className="space-y-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-3 w-8" />
              </div>
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const active = (projects ?? []).filter((p) => p.status !== "archived" && p.status !== "completed");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FolderKanban className="h-4 w-4 text-muted-foreground" />
          <span>Active Projects</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {active.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No active projects.
          </p>
        ) : (
          <ul className="space-y-3">
            {active.map((p) => {
              const statusColor = STATUS_COLORS[p.status] ?? "";
              return (
                <li key={p.id} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="truncate text-sm font-medium text-card-foreground">
                        {p.name}
                      </span>
                      <Badge variant="outline" className="shrink-0 text-[9px]">
                        {p.status.replace("_", " ")}
                      </Badge>
                    </div>
                    <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                      {p.progressPct}%
                    </span>
                  </div>
                  <Progress value={p.progressPct} className="h-1.5" />
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
