import { useState, useEffect, useRef, useCallback } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { useTasks, useQuickCapture } from '@/queries/tasks';
import { useHabits } from '@/queries/habits';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/toast';
import { useUIStore, todayStr } from '@/stores/ui';
import {
  Search,
  Home,
  Calendar,
  Activity,
  ShieldCheck,
  BookOpen,
  GraduationCap,
  Briefcase,
  DollarSign,
  Target,
  BarChart3,
  Plus,
  ArrowRight,
  FileText,
  Clock,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Navigation items ─────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: Home, label: 'Dashboard', href: '/', section: 'Today' },
  { icon: Calendar, label: 'Daily Planner', href: '/planner', section: 'Today' },
  { icon: Activity, label: 'Habits', href: '/life/habits', section: 'Life' },
  { icon: ShieldCheck, label: 'Daily Check-In', href: '/life/checkin', section: 'Life' },
  { icon: BookOpen, label: 'Diary', href: '/life/diary', section: 'Life' },
  { icon: GraduationCap, label: 'Schedule', href: '/college/schedule', section: 'College' },
  { icon: FileText, label: 'Assignments', href: '/college/assignments', section: 'College' },
  { icon: GraduationCap, label: 'Semester', href: '/college/semester', section: 'College' },
  { icon: Briefcase, label: 'Daily Standup', href: '/work/standup', section: 'Work' },
  { icon: Briefcase, label: 'Projects', href: '/work/projects', section: 'Work' },
  { icon: Briefcase, label: 'Clients', href: '/work/clients', section: 'Work' },
  { icon: Briefcase, label: 'Meetings', href: '/work/meetings', section: 'Work' },
  { icon: TrendingUp, label: 'Team Performance', href: '/work/performance', section: 'Work' },
  { icon: DollarSign, label: 'Transactions', href: '/finance', section: 'Finance' },
  { icon: Target, label: 'Goals', href: '/review/goals', section: 'Review' },
  { icon: BarChart3, label: 'Monthly Review', href: '/review/monthly', section: 'Review' },
  { icon: BarChart3, label: 'Statistics', href: '/review/stats', section: 'Review' },
];

// ─── Default export ───────────────────────────────────────────────────────────

export default function CommandPaletteApp() {
  return (
    <QueryProvider>
      <CommandPaletteContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function CommandPaletteContent() {
  const { commandPaletteOpen, closeCommandPalette } = useUIStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Fetch data for search
  const { data: tasks } = useTasks({});
  const { data: habits } = useHabits({ active: true });
  const captureMut = useQuickCapture();

  // Keyboard shortcut: Cmd/Ctrl+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (commandPaletteOpen) {
          closeCommandPalette();
        } else {
          useUIStore.getState().openCommandPalette();
        }
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        closeCommandPalette();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [commandPaletteOpen, closeCommandPalette]);

  // Focus input on open
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Search results; when typing, the first entry is always the quick-capture
  // action so "type a task, press Enter" works from anywhere — even when
  // nothing else matches.
  const searchResults = buildResults(query, tasks ?? [], habits ?? []);
  const trimmed = query.trim();
  const results: SearchResult[] =
    trimmed.length > 0
      ? [{ capture: true, icon: Plus, label: trimmed, section: 'Action' }, ...searchResults]
      : searchResults;

  const runCapture = useCallback(
    (title: string) => {
      captureMut.mutate(
        // Default to today so the task is immediately visible in the planner —
        // a dateless task would be invisible in the date-filtered views.
        { title, date: todayStr() },
        {
          onSuccess: () => {
            closeCommandPalette();
            toast.success(`Task added: "${title}"`);
          },
        },
      );
    },
    [captureMut, closeCommandPalette],
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const result = results[selectedIndex];
        if (!result) return;
        if (result.capture) {
          runCapture(result.label);
        } else if (result.href) {
          window.location.href = result.href;
        }
      }
    },
    [results, selectedIndex, runCapture],
  );

  // Scroll selected item into view
  useEffect(() => {
    const item = listRef.current?.children[selectedIndex] as HTMLElement;
    item?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!commandPaletteOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeCommandPalette}
      />

      {/* Palette */}
      <div className="fixed inset-x-4 top-[15%] mx-auto max-w-xl">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Search and quick capture"
          className="overflow-hidden rounded-xl border border-border bg-background shadow-2xl"
        >
          {/* Search Input */}
          <div className="flex items-center gap-3 border-b border-border px-4">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              onKeyDown={handleKeyDown}
              placeholder="Search or type a task to add it..."
              aria-label="Search or type a task to add it"
              className="border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div
            ref={listRef}
            role="listbox"
            aria-label="Results"
            className="max-h-[50vh] overflow-y-auto p-1.5"
          >
            {results.length === 0 ? (
              <div className="py-8 text-center text-sm text-muted-foreground">
                No results found.
              </div>
            ) : (
              results.map((result, i) => (
                <CommandItem
                  key={result.capture ? '__capture__' : `${result.section}-${result.label}-${i}`}
                  icon={
                    <result.icon
                      className={cn('h-4 w-4', result.capture && 'text-primary')}
                    />
                  }
                  label={result.capture ? `Add task: "${result.label}"` : result.label}
                  badge={result.capture ? 'Enter' : result.badge}
                  section={result.capture ? undefined : result.section}
                  selected={i === selectedIndex}
                  role="option"
                  ariaSelected={i === selectedIndex}
                  onClick={() => {
                    if (result.capture) {
                      runCapture(result.label);
                    } else if (result.href) {
                      window.location.href = result.href;
                    }
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Command Item ─────────────────────────────────────────────────────────────

interface CommandItemProps {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  section?: string;
  selected?: boolean;
  role?: string;
  ariaSelected?: boolean;
  onClick: () => void;
}

function CommandItem({
  icon,
  label,
  badge,
  section,
  selected,
  role,
  ariaSelected,
  onClick,
}: CommandItemProps) {
  return (
    <button
      role={role}
      aria-selected={ariaSelected}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors',
        selected ? 'bg-accent text-accent-foreground' : 'text-foreground hover:bg-muted',
      )}
    >
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="flex-1 truncate font-medium">{label}</span>
      {section && (
        <span className="shrink-0 text-[10px] text-muted-foreground">{section}</span>
      )}
      {badge && (
        <kbd className="shrink-0 rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
          {badge}
        </kbd>
      )}
    </button>
  );
}

// ─── Search Logic ─────────────────────────────────────────────────────────────

interface SearchResult {
  icon: typeof Home;
  label: string;
  href?: string;
  badge?: string;
  section: string;
  /** Quick-capture action row — creates a task from the typed query. */
  capture?: boolean;
}

function buildResults(
  query: string,
  tasks: any[],
  habits: any[],
): SearchResult[] {
  const q = query.toLowerCase().trim();
  const results: SearchResult[] = [];

  // Navigation results (always show when no query)
  if (!q) {
    // Show most-used navigation
    const navResults: SearchResult[] = [
      { icon: Home, label: 'Dashboard', href: '/', section: 'Nav', badge: 'Home' },
      { icon: Calendar, label: 'Daily Planner', href: '/planner', section: 'Nav' },
      { icon: Activity, label: 'Habits', href: '/life/habits', section: 'Nav' },
      { icon: ShieldCheck, label: 'Daily Check-In', href: '/life/checkin', section: 'Nav' },
      { icon: BookOpen, label: 'Diary', href: '/life/diary', section: 'Nav' },
    ];
    return navResults;
  }

  // Search navigation
  for (const nav of NAV_ITEMS) {
    if (nav.label.toLowerCase().includes(q)) {
      results.push({
        icon: nav.icon,
        label: nav.label,
        href: nav.href,
        section: nav.section,
      });
    }
  }

  // Search tasks
  for (const task of tasks) {
    if (task.title?.toLowerCase().includes(q) || task.description?.toLowerCase().includes(q)) {
      results.push({
        icon: Clock,
        label: task.title,
        href: `/planner`,
        badge: task.priority,
        section: 'Task',
      });
    }
  }

  // Search habits
  for (const habit of habits) {
    if (habit.name?.toLowerCase().includes(q)) {
      results.push({
        icon: Activity,
        label: habit.name,
        href: '/life/habits',
        badge: habit.category ?? undefined,
        section: 'Habit',
      });
    }
  }

  return results.slice(0, 10);
}
