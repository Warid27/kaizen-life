import { useState } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useHabits,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useLogHabit,
  useUndoHabitLog,
  useHabitStats,
  type HabitWithToday,
} from '@/queries/habits';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Check,
  Plus,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import type { Habit } from '@kaizenlife/shared';

type HabitCategory = NonNullable<Habit['category']>;
type HabitFrequency = Habit['frequency'];

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: HabitCategory | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'health', label: 'Health' },
  { value: 'self-care', label: 'Self-Care' },
  { value: 'mindfulness', label: 'Mindfulness' },
];

const ICON_OPTIONS = ['📖', '🏃', '💧', '🧘', '✍️', '🎯', '💪', '🌅', '🙏', '🎵', '🥗', '😴'];

const FREQUENCY_OPTIONS: { value: HabitFrequency; label: string }[] = [
  { value: 'daily', label: 'Daily' },
  { value: 'weekly_n', label: 'Weekly (N times)' },
  { value: 'custom_days', label: 'Custom Days' },
];

// ─── Default export (island entry) ────────────────────────────────────────────

export default function HabitsApp() {
  return (
    <QueryProvider>
      <HabitsContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function HabitsContent() {
  const { selectedDate } = useUIStore();
  const [filter, setFilter] = useState<HabitCategory | ''>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [deletingHabit, setDeletingHabit] = useState<Habit | null>(null);

  const { data: habits, isLoading } = useHabits(
    filter ? { category: filter, active: true } : { active: true },
  );

  const createMut = useCreateHabit();
  const updateMut = useUpdateHabit();
  const deleteMut = useDeleteHabit();
  const logMut = useLogHabit();
  const undoMut = useUndoHabitLog();

  const handleToggle = (habit: HabitWithToday) => {
    if (habit.completedToday) {
      undoMut.mutate({ habitId: habit.id, date: selectedDate });
    } else {
      logMut.mutate({
        habitId: habit.id,
        data: { date: selectedDate, increment: 1 },
      });
    }
  };

  const handleCreate = () => {
    setEditingHabit(null);
    setFormOpen(true);
  };

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setFormOpen(true);
  };

  const handleDeleteRequest = (habit: Habit) => {
    setDeletingHabit(habit);
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => {
        setDeletingHabit(null);
        toast.success('Habit deleted');
      },
      onError: () => setDeletingHabit(null),
    });
  };

  const handleSave = (data: {
    name: string;
    icon: string | null;
    category: HabitCategory | null;
    frequency: HabitFrequency;
  }) => {
    if (editingHabit) {
      updateMut.mutate(
        { id: editingHabit.id, data },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Habit updated');
          },
        },
      );
    } else {
      createMut.mutate(
        {
          ...data,
          userId: '',
          active: true,
          sortOrder: 0,
          targetCountPerPeriod: 1,
        },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Habit created');
          },
        },
      );
    }
  };

  const completed = (habits ?? []).filter((h) => h.completedToday).length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Habits</h1>
          <p className="text-sm text-muted-foreground">
            {completed}/{habits?.length ?? 0} completed today
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Habit
        </Button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.value}
            onClick={() => setFilter(cat.value as HabitCategory | '')}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              filter === cat.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Habit List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
                <Skeleton className="h-5 w-5 rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (habits ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center gap-3 py-12">
            <p className="text-sm text-muted-foreground">
              No habits yet. Create your first habit to start tracking.
            </p>
            <Button onClick={handleCreate} size="sm" variant="outline">
              <Plus className="mr-1.5 h-4 w-4" />
              Create your first habit
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(habits ?? []).map((habit) => (
            <HabitItem
              key={habit.id}
              habit={habit}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDeleteRequest}
              isToggling={logMut.isPending || undoMut.isPending}
            />
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <HabitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        habit={editingHabit}
        onSave={handleSave}
        isSaving={createMut.isPending || updateMut.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deletingHabit !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingHabit(null);
        }}
        title="Delete this habit?"
        description={
          deletingHabit
            ? `"${deletingHabit.name}" and its history will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => deletingHabit && handleDelete(deletingHabit.id)}
      />
    </div>
  );
}

// ─── Habit Item ───────────────────────────────────────────────────────────────

interface HabitItemProps {
  habit: HabitWithToday;
  onToggle: (habit: HabitWithToday) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (habit: Habit) => void;
  isToggling: boolean;
}

function HabitItem({ habit, onToggle, onEdit, onDelete, isToggling }: HabitItemProps) {
  const [expanded, setExpanded] = useState(false);
  const done = habit.completedToday;

  return (
    <Card className="group transition-colors hover:border-border/80">
      <CardContent className="flex items-center gap-4 p-4">
        {/* Toggle — click checks in OR undoes today's log (BL6) */}
        <button
          type="button"
          onClick={() => onToggle(habit)}
          disabled={isToggling}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all',
            done
              ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
              : 'border-border hover:border-emerald-300 hover:bg-emerald-50 dark:hover:border-emerald-700 dark:hover:bg-emerald-950',
          )}
          aria-label={`Mark "${habit.name}" as ${done ? 'incomplete' : 'complete'}`}
        >
          {done && <Check className="h-4 w-4" strokeWidth={3} />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            {habit.icon && <span className="text-base">{habit.icon}</span>}
            <span
              className={cn(
                'text-sm font-medium truncate',
                done ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {habit.name}
            </span>
          </div>
          <div className="mt-0.5 flex items-center gap-3">
            {habit.category && (
              <Badge variant="secondary" className="text-[10px]">
                {habit.category}
              </Badge>
            )}
            <span className="text-[10px] text-muted-foreground">{habit.frequency}</span>
            {habit.scheduledToday ? (
              <Badge
                variant="outline"
                className="border-emerald-300 px-1.5 py-0 text-[9px] text-emerald-700"
              >
                today
              </Badge>
            ) : (
              <span className="text-[10px] text-muted-foreground/60">rest day</span>
            )}
          </div>
        </div>

        {/* Progress toward today's target */}
        <div className="flex items-center gap-3">
          {habit.progress && habit.progress.targetCount > 1 && (
            <Progress
              value={habit.progress.completedCount}
              max={habit.progress.targetCount}
              className="h-1.5 w-16"
            />
          )}
        </div>

        {/* Actions — always visible on touch devices (no hover available there) */}
        <div className="flex gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
          <button
            onClick={() => setExpanded((prev) => !prev)}
            aria-label={`${expanded ? 'Hide' : 'Show'} stats for "${habit.name}"`}
            aria-expanded={expanded}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {expanded ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
          <button
            onClick={() => onEdit(habit)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={`Edit habit: ${habit.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(habit)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            aria-label={`Delete habit: ${habit.name}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>

      {/* Lazy per-habit stats — fetched only when the row is expanded */}
      {expanded && <HabitStatsPanel habitId={habit.id} />}
    </Card>
  );
}

// ─── Per-habit Stats Panel (lazy useHabitStats) ──────────────────────────────

function HabitStatsPanel({ habitId }: { habitId: string }) {
  const { data: stats, isLoading, isError } = useHabitStats(habitId);

  if (isLoading) {
    return (
      <div className="border-t border-border px-4 py-3">
        <Skeleton className="h-4 w-full" />
      </div>
    );
  }

  if (isError || !stats) {
    return (
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">Couldn't load stats.</p>
      </div>
    );
  }

  if (stats.totalScheduledDays === 0) {
    return (
      <div className="border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          No stats yet — this habit hasn't had any scheduled days.
        </p>
      </div>
    );
  }

  const cells: { label: string; value: string }[] = [
    {
      label: 'Completion rate',
      value: `${Math.min(100, Math.max(0, Math.round(stats.completionRate * 100)))}%`,
    },
    { label: 'Current streak', value: `${stats.currentStreak}d` },
    { label: 'Longest streak', value: `${stats.longestStreak}d` },
    { label: 'Total completions', value: `${stats.totalCompletions}` },
  ];

  return (
    <div className="grid grid-cols-2 gap-3 border-t border-border px-4 py-3 sm:grid-cols-4">
      {cells.map((cell) => (
        <div key={cell.label}>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {cell.label}
          </p>
          <p className="text-sm font-semibold text-foreground">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Habit Form Dialog ────────────────────────────────────────────────────────

interface HabitFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  habit: Habit | null;
  onSave: (data: {
    name: string;
    icon: string | null;
    category: HabitCategory | null;
    frequency: HabitFrequency;
  }) => void;
  isSaving: boolean;
}

function HabitFormDialog({ open, onOpenChange, habit, onSave, isSaving }: HabitFormDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [category, setCategory] = useState<HabitCategory | null>(null);
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');

  // Reset form when opening
  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setName(habit?.name ?? '');
      setIcon(habit?.icon ?? null);
      setCategory((habit?.category as HabitCategory) ?? null);
      setFrequency(habit?.frequency ?? 'daily');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), icon, category, frequency });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>{habit ? 'Edit Habit' : 'New Habit'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-name">Name</Label>
            <Input
              id="habit-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Read 30 minutes"
              autoFocus
            />
          </div>

          {/* Icon */}
          <div className="space-y-1.5">
            <Label>Icon</Label>
            <div className="flex flex-wrap gap-2">
              {ICON_OPTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => setIcon(emoji === icon ? null : emoji)}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-lg border text-base transition-all',
                    icon === emoji
                      ? 'border-primary bg-primary/10 shadow-sm'
                      : 'border-border hover:border-primary/30',
                  )}
                >
                  {emoji}
                </button>
              ))}
            </div>
          </div>

          {/* Category */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-category">Category</Label>
            <Select
              id="habit-category"
              value={category ?? ''}
              onChange={(e) => setCategory((e.target.value as HabitCategory) || null)}
            >
              <option value="">None</option>
              {CATEGORIES.filter((c) => c.value !== '').map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {cat.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Frequency */}
          <div className="space-y-1.5">
            <Label htmlFor="habit-frequency">Frequency</Label>
            <Select
              id="habit-frequency"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as HabitFrequency)}
            >
              {FREQUENCY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? 'Saving...' : habit ? 'Save Changes' : 'Create Habit'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
