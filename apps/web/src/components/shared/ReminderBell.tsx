import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { useReminders, type ReminderItem } from '@/queries/settings';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Bell, Clock, AlertTriangle, CheckCircle } from 'lucide-react';

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

  // /api/reminders returns only active items, pre-sorted urgent-first.
  const items = reminders ?? [];
  const totalActive = items.length;
  const hasUrgent = items.some((r) => r.priority === 'urgent');

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
              hasUrgent ? 'bg-destructive' : 'bg-primary',
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
              <Badge variant={hasUrgent ? 'destructive' : 'secondary'}>
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
              items.map((r) => (
                <ReminderItemRow
                  key={`${r.type}:${r.title}:${r.date}`}
                  reminder={r}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reminder Item Row ────────────────────────────────────────────────────────

function ReminderItemRow({ reminder }: { reminder: ReminderItem }) {
  return (
    <div
      className={cn(
        'flex w-full items-start gap-3 px-4 py-2.5',
        reminder.priority === 'urgent' && 'bg-destructive/5',
      )}
    >
      <div className="shrink-0 pt-0.5">
        {reminder.priority === 'urgent' ? (
          <AlertTriangle className="h-4 w-4 text-destructive" />
        ) : (
          <Clock className="h-4 w-4 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-medium text-foreground">{reminder.title}</p>
        <p className="truncate text-xs text-muted-foreground">
          {reminder.detail}
          <span className="ml-1.5 capitalize">· {reminder.type}</span>
        </p>
      </div>
    </div>
  );
}
