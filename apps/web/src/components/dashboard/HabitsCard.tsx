import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Habit {
  id: string;
  name: string;
  icon: string | null;
  category: string | null;
  targetCountPerPeriod: number;
  sortOrder: number;
  completedCount: number;
  targetCount: number;
}

interface HabitsCardProps {
  habits: Habit[] | undefined;
  isLoading: boolean;
  onToggleHabit?: (habitId: string) => void;
}

export function HabitsCard({ habits, isLoading, onToggleHabit }: HabitsCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Habits</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <Skeleton className="h-5 w-5 rounded" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-1.5 w-16 rounded-full" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const completed = (habits ?? []).filter((h) => h.completedCount >= h.targetCount).length;
  const total = habits?.length ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Habits</span>
          <span className="text-xs font-normal text-muted-foreground">
            {completed}/{total}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {total === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No habits configured yet.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {(habits ?? []).map((habit) => {
              const done = habit.completedCount >= habit.targetCount;
              return (
                <li
                  key={habit.id}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <button
                    type="button"
                    onClick={() => onToggleHabit?.(habit.id)}
                    className={cn(
                      "flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors",
                      done
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : "border-border hover:border-emerald-300"
                    )}
                    aria-label={`Mark "${habit.name}" as ${done ? "incomplete" : "complete"}`}
                  >
                    {done && <Check className="h-3 w-3" strokeWidth={3} />}
                  </button>
                  <span
                    className={cn(
                      "flex-1 truncate text-sm",
                      done ? "text-muted-foreground line-through" : "text-card-foreground"
                    )}
                  >
                    {habit.icon && <span className="mr-1">{habit.icon}</span>}
                    {habit.name}
                  </span>
                  {habit.targetCount > 1 && (
                    <Progress
                      value={habit.completedCount}
                      max={habit.targetCount}
                      className="h-1.5 w-16"
                    />
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
