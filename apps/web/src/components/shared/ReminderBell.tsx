import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { useReminders, type Reminder } from '@/queries/settings';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Bell, Clock, AlertTriangle, CheckCircle, ChevronRight } from 'lucide-react';

// ─── Default export (mountable React island) ──────────────────────────────────

export default function ReminderBellMount() {
  return (
    <QueryProvider>
      <ReminderBell />
    </QueryProvider>
  );
}

// ─── Reminder Bell Component ──────────────────────────────────────────────────

function ReminderBell() {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const { data: reminders, isLoading } = useReminders();

  const overdueCount = reminders?.filter((r) => r.overdue && !r.completedAt).length ?? 0;
  const upcomingCount =
    reminders?.filter(
      (r) => !r.overdue && !r.completedAt && isUpcoming(r.scheduledAt),
    ).length ?? 0;
  const totalActive = overdueCount + upcomingCount;

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener('mousedown', handleClick);
      return () => document.removeEventListener('mousedown', handleClick);
    }
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) {
      document.addEventListener('keydown', handleKey);
      return () => document.removeEventListener('keydown', handleKey);
    }
  }, [open]);

  const handleToggle = useCallback(() => setOpen((o) => !o), []);

  // Split into overdue and upcoming
  const overdueItems = reminders?.filter((r) => r.overdue && !r.completedAt) ?? [];
  const upcomingItems =
    reminders?.filter(
      (r) => !r.overdue && !r.completedAt && isUpcoming(r.scheduledAt),
    ) ?? [];

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        onClick={handleToggle}
        className={cn(
          'relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground',
          open && 'bg-muted text-foreground',
        )}
        aria-label="Reminders"
      >
        <Bell className="h-4 w-4" />
        {totalActive > 0 && (
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-foreground',
              overdueCount > 0 ? 'bg-destructive' : 'bg-primary',
            )}
          >
            {totalActive > 9 ? '9+' : totalActive}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-background shadow-xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold text-foreground">Reminders</h3>
            {totalActive > 0 && (
              <Badge variant={overdueCount > 0 ? 'destructive' : 'secondary'}>
                {totalActive} active
              </Badge>
            )}
          </div>

          {/* Content */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading ? (
              <div className="space-y-2 p-3">
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
                <Skeleton className="h-12 w-full" />
              </div>
            ) : totalActive === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <CheckCircle className="h-8 w-8 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  All caught up! No pending reminders.
                </p>
              </div>
            ) : (
              <>
                {/* Overdue */}
                {overdueItems.length > 0 && (
                  <div>
                    <div className="bg-destructive/5 px-4 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-destructive">
                        Overdue
                      </p>
                    </div>
                    {overdueItems.map((r) => (
                      <ReminderItem key={r.id} reminder={r} onClose={() => setOpen(false)} />
                    ))}
                  </div>
                )}

                {/* Upcoming */}
                {upcomingItems.length > 0 && (
                  <div>
                    <div className="px-4 py-1.5">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Upcoming
                      </p>
                    </div>
                    {upcomingItems.map((r) => (
                      <ReminderItem key={r.id} reminder={r} onClose={() => setOpen(false)} />
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reminder Item ────────────────────────────────────────────────────────────

function ReminderItem({
  reminder,
  onClose,
}: {
  reminder: Reminder;
  onClose: () => void;
}) {
  const handleClick = useCallback(() => {
    onClose();
    if (reminder.href) {
      window.location.href = reminder.href;
    }
  }, [reminder, onClose]);

  return (
    <button
      onClick={handleClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-muted',
        reminder.overdue && 'bg-destructive/5',
      )}
    >
      <div className="shrink-0">
        {reminder.overdue ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{reminder.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatReminderTime(reminder.scheduledAt)}
          {reminder.type !== 'custom' && (
            <span className="ml-1.5 capitalize">· {reminder.type}</span>
          )}
        </p>
      </div>
      {reminder.href && (
        <ChevronRight className="h-3 w-3 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isUpcoming(isoDate: string): boolean {
  const d = new Date(isoDate);
  const now = new Date();
  const oneDayMs = 24 * 60 * 60 * 1000;
  return d.getTime() - now.getTime() < oneDayMs && d.getTime() > now.getTime();
}

function formatReminderTime(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHrs = Math.round(diffMs / 3_600_000);

  if (diffMs < 0) {
    const absMin = Math.abs(diffMin);
    if (absMin < 60) return `${absMin}m overdue`;
    if (absMin < 1440) return `${Math.abs(diffHrs)}h overdue`;
    return `${Math.abs(Math.round(absMin / 1440))}d overdue`;
  }

  if (diffMin < 60) return `in ${diffMin}m`;
  if (diffHrs < 24) return `in ${diffHrs}h`;
  return `in ${Math.round(diffMin / 1440)}d`;
}
