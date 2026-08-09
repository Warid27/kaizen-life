import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface Finance {
  month: { start: string; end: string };
  incomeCents: number;
  expenseCents: number;
  netCents: number;
  transactionCount: number;
}

interface FinanceCardProps {
  finance: Finance | undefined;
  isLoading: boolean;
}

function centsToCurrency(cents: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(cents / 100);
}

function monthLabel(start: string): string {
  const d = new Date(start);
  return d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function FinanceCard({ finance, isLoading }: FinanceCardProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Finance</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  const net = finance?.netCents ?? 0;
  const isPositive = net >= 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Finance</span>
          {finance && (
            <span className="text-xs font-normal text-muted-foreground">
              {monthLabel(finance.month.start)}
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!finance || finance.transactionCount === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">
            No transactions this month.
          </p>
        ) : (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Income</span>
              <span className="text-sm font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                +{centsToCurrency(finance.incomeCents)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Expenses</span>
              <span className="text-sm font-medium tabular-nums text-destructive">
                -{centsToCurrency(finance.expenseCents)}
              </span>
            </div>
            <div className="my-1 h-px bg-border" />
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">Net</span>
              <div className="flex items-center gap-1.5">
                {isPositive ? (
                  <TrendingUp className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : net < 0 ? (
                  <TrendingDown className="h-3.5 w-3.5 text-destructive" />
                ) : (
                  <Minus className="h-3.5 w-3.5 text-muted-foreground" />
                )}
                <span
                  className={cn(
                    "text-sm font-semibold tabular-nums",
                    isPositive
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                  )}
                >
                  {isPositive ? "+" : ""}
                  {centsToCurrency(net)}
                </span>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
