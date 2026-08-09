import { useState } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useHabits,
  useCreateHabit,
  useUpdateHabit,
  useDeleteHabit,
  useLogHabit,
} from '@/queries/habits';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
  Flame,
  Pencil,
  Trash2,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui';
import type { Habit, HabitCategory } from '@kaizenlife/shared';

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: HabitCategory | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'spiritual', label: 'Spiritual' },
  { value: 'health', label: 'Health' },
  { value: 'self-care', label: 'Self-Care' },
  { value: 'mindfulness', label: 'Mindfulness' },
];

const ICON_OPTIONS = ['📖', '🏃', '💧', '🧘', '✍️', '🎯', '💪', '🌅', '🙏', '🎵', '🥗', '😴'];

const FREQUENCY_OPTIONS = [
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

  const { data: habits, isLoading } = useHabits(
    filter ? { category: filter, active: true } : { active: true },
  );

  const createMut = useCreateHabit();
  const updateMut = useUpdateHabit();
  const deleteMut = useDeleteHabit();
  const logMut = useLogHabit();

  const handleToggle = (habitId: string) => {
    logMut.mutate({
      habitId,
      data: { date: selectedDate, increment: 1 },
    });
  };

  const handleCreate = () => {
    setEditingHabit(null);
    setFormOpen(true);
  };

  const handleEdit = (habit: Habit) => {
    setEditingHabit(habit);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this habit?')) {
      deleteMut.mutate(id);
    }
  };

  const handleSave = (data: {
    name: string;
    icon: string | null;
    category: HabitCategory | null;
    frequency: string;
  }) => {
    if (editingHabit) {
      updateMut.mutate(
        { id: editingHabit.id, data },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createMut.mutate(
        {
          ...data,
          userId: '',
          active: true,
          sortOrder: 0,
          targetCountPerPeriod: 1,
        } as any,
        { onSuccess: () => setFormOpen(false) },
      );
    }
  };

  const completed = (habits ?? []).filter(
    (h) => (h as any).completedCount >= (h as any).targetCount,
  ).length;

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
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              No habits yet. Create your first habit to start tracking.
            </p>
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
              onDelete={handleDelete}
              isToggling={logMut.isPending}
            />
          ))}
        </div>
      )}

      {/* Monthly Completion Chart */}
      {(habits ?? []).length > 0 && (
        <MonthlyChart habits={habits ?? []} />
      )}

      {/* Create/Edit Dialog */}
      <HabitFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        habit={editingHabit}
        onSave={handleSave}
        isSaving={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}

// ─── Habit Item ───────────────────────────────────────────────────────────────

interface HabitItemProps {
  habit: Habit & { completedCount?: number; targetCount?: number; currentStreak?: number };
  onToggle: (id: string) => void;
  onEdit: (habit: Habit) => void;
  onDelete: (id: string) => void;
  isToggling: boolean;
}

function HabitItem({ habit, onToggle, onEdit, onDelete, isToggling }: HabitItemProps) {
  const done = (habit as any).completedCount >= (habit as any).targetCount;
  const streak = (habit as any).currentStreak ?? 0;

  return (
    <Card className="group transition-colors hover:border-border/80">
      <CardContent className="flex items-center gap-4 p-4">
        {/* Toggle */}
        <button
          type="button"
          onClick={() => onToggle(habit.id)}
          disabled={isToggling}
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border-2 transition-all',
            done
              ? 'border-emerald-500 bg-emerald-500 text-white shadow-sm'
              : 'border-border hover:border-emerald-300 hover:bg-emerald-50',
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
          </div>
        </div>

        {/* Streak + Progress */}
        <div className="flex items-center gap-3">
          {streak > 0 && (
            <div className="flex items-center gap-1 text-amber-600">
              <Flame className="h-3.5 w-3.5" />
              <span className="text-xs font-semibold">{streak}</span>
            </div>
          )}
          {(habit as any).targetCount > 1 && (
            <Progress
              value={(habit as any).completedCount ?? 0}
              max={(habit as any).targetCount}
              className="h-1.5 w-16"
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onEdit(habit)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(habit.id)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Monthly Completion Chart ─────────────────────────────────────────────────

function MonthlyChart({ habits }: { habits: Habit[] }) {
  const daysInMonth = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0,
  ).getDate();

  const today = new Date().getDate();
  const maxPossible = habits.length;

  // Simulated data: generate random completion counts per day for the chart
  // In real app, this would come from API stats
  const dailyRates = Array.from({ length: today }, (_, i) => {
    const dayNum = i + 1;
    // Deterministic pseudo-random based on day
    const seed = (dayNum * 7 + habits.length * 3) % 10;
    return Math.min(maxPossible, Math.floor((seed / 10) * maxPossible) + Math.floor(maxPossible * 0.4));
  });

  const avgRate = dailyRates.length
    ? Math.round((dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length / maxPossible) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Monthly Completion
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {avgRate}% avg
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex items-end gap-[3px]" style={{ height: 80 }}>
          {dailyRates.map((count, i) => {
            const height = maxPossible > 0 ? (count / maxPossible) * 100 : 0;
            return (
              <div
                key={i}
                className="flex-1 rounded-t bg-primary/20 transition-colors hover:bg-primary/40"
                style={{ height: `${Math.max(height, 4)}%` }}
                title={`Day ${i + 1}: ${count}/${maxPossible}`}
              />
            );
          })}
        </div>
        <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
          <span>1</span>
          <span>{Math.floor(today / 2)}</span>
          <span>{today}</span>
        </div>
      </CardContent>
    </Card>
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
    frequency: string;
  }) => void;
  isSaving: boolean;
}

function HabitFormDialog({ open, onOpenChange, habit, onSave, isSaving }: HabitFormDialogProps) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<string | null>(null);
  const [category, setCategory] = useState<HabitCategory | null>(null);
  const [frequency, setFrequency] = useState('daily');

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
              onChange={(e) => setFrequency(e.target.value)}
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
