import { useState, useMemo } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useGoals,
  useCreateGoal,
  useUpdateGoal,
  type Goal,
  type GoalLevel,
} from '@/queries/goals';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Target,
  Plus,
  ChevronRight,
  ChevronDown,
  Trophy,
  Calendar,
  Flame,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const LEVEL_META: Record<
  GoalLevel,
  { label: string; color: string; bg: string; icon: string }
> = {
  annual: {
    label: 'Annual',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    icon: '🏆',
  },
  monthly: {
    label: 'Monthly',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    icon: '📅',
  },
  weekly: {
    label: 'Weekly',
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    icon: '⚡',
  },
};

const STATUS_BADGE: Record<string, { variant: 'default' | 'success' | 'warning' | 'secondary' }> = {
  active: { variant: 'success' },
  completed: { variant: 'default' },
  paused: { variant: 'warning' },
  abandoned: { variant: 'secondary' },
};

// ─── Demo data ────────────────────────────────────────────────────────────────

function generateDemoGoals(): Goal[] {
  return [
    // Annual
    {
      id: 'a1',
      title: 'Save $20,000',
      description: 'Build emergency fund to 6 months expenses',
      type: 'annual',
      periodStart: `${new Date().getFullYear()}-01-01`,
      periodEnd: `${new Date().getFullYear()}-12-31`,
      targetValue: 20000,
      currentValue: 8500,
      unit: 'dollars',
      status: 'in_progress',
      parentGoalId: null,
      linkedHabitId: null,
      createdAt: `${new Date().getFullYear()}-01-01`,
    },
    {
      id: 'a2',
      title: 'Ship 3 side projects',
      description: 'Launch and maintain 3 products',
      type: 'annual',
      periodStart: `${new Date().getFullYear()}-01-01`,
      periodEnd: `${new Date().getFullYear()}-12-31`,
      targetValue: 3,
      currentValue: 1,
      unit: 'projects',
      status: 'in_progress',
      parentGoalId: null,
      linkedHabitId: null,
      createdAt: `${new Date().getFullYear()}-01-01`,
    },
    // Monthly (children of a1)
    {
      id: 'm1',
      title: 'Save $1,667',
      description: 'Monthly savings target',
      type: 'monthly',
      periodStart: `${currentMonth()}-01`,
      periodEnd: `${currentMonth()}-28`,
      targetValue: 1667,
      currentValue: 1450,
      unit: 'dollars',
      status: 'in_progress',
      parentGoalId: 'a1',
      linkedHabitId: null,
      createdAt: `${currentMonth()}-01`,
    },
    {
      id: 'm2',
      title: 'Ship MVP of KaizenLife',
      description: 'Core features complete',
      type: 'monthly',
      periodStart: `${currentMonth()}-01`,
      periodEnd: `${currentMonth()}-30`,
      targetValue: 100,
      currentValue: 65,
      unit: 'percent',
      status: 'in_progress',
      parentGoalId: 'a2',
      linkedHabitId: null,
      createdAt: `${currentMonth()}-01`,
    },
    // Weekly (children of m1)
    {
      id: 'w1',
      title: 'Save $417',
      description: 'Weekly savings transfer',
      type: 'weekly',
      periodStart: currentMonth(),
      periodEnd: currentMonth(),
      targetValue: 417,
      currentValue: 417,
      unit: 'dollars',
      status: 'completed',
      parentGoalId: 'm1',
      linkedHabitId: null,
      createdAt: currentMonth(),
    },
    {
      id: 'w2',
      title: 'No impulse purchases',
      description: 'Stick to budget',
      type: 'weekly',
      periodStart: currentMonth(),
      periodEnd: currentMonth(),
      targetValue: 7,
      currentValue: 5,
      unit: 'days',
      status: 'in_progress',
      parentGoalId: 'm1',
      linkedHabitId: null,
      createdAt: currentMonth(),
    },
  ];
}

function buildHierarchy(goals: Goal[]): Goal[] {
  const map = new Map<string, Goal & { children: Goal[] }>();
  const roots: (Goal & { children: Goal[] })[] = [];

  for (const g of goals) {
    map.set(g.id, { ...g, children: [] });
  }
  for (const g of goals) {
    const node = map.get(g.id)!;
    if (g.parentGoalId && map.has(g.parentGoalId)) {
      map.get(g.parentGoalId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function GoalsApp() {
  return (
    <QueryProvider>
      <GoalsContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function GoalsContent() {
  const [formOpen, setFormOpen] = useState(false);
  const [formLevel, setFormLevel] = useState<GoalLevel>('annual');
  const [parentId, setParentId] = useState<string | undefined>();
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set(['a1', 'a2']));

  const { data: goals, isLoading } = useGoals();
  const createMut = useCreateGoal();
  const updateMut = useUpdateGoal();

  const goalList = goals ?? generateDemoGoals();
  const hierarchy = useMemo(() => buildHierarchy(goalList), [goalList]);

  // Stats
  const activeGoals = goalList.filter((g) => g.status === 'in_progress' || g.status === 'not_started');
  const completedGoals = goalList.filter((g) => g.status === 'completed');
  const overallProgress =
    activeGoals.length > 0
      ? Math.round(
          activeGoals.reduce(
            (sum, g) => sum + Math.min((g.currentValue / g.targetValue) * 100, 100),
            0,
          ) / activeGoals.length,
        )
      : 0;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openAddGoal = (level: GoalLevel, parent?: string) => {
    setFormLevel(level);
    setParentId(parent);
    setFormOpen(true);
  };

  const handleCreate = (data: {
    title: string;
    description: string;
    targetValue: number;
    unit: string;
  }) => {
    createMut.mutate(
      {
        ...data,
        type: formLevel,
        parentGoalId: parentId,
        periodStart: `${new Date().getFullYear()}-01-01`,
        periodEnd: `${new Date().getFullYear()}-12-31`,
      },
      { onSuccess: () => setFormOpen(false) },
    );
  };

  const handleProgress = (goal: Goal, newValue: number) => {
    updateMut.mutate({
      id: goal.id,
      data: {
        currentValue: newValue,
        status: newValue >= goal.targetValue ? 'completed' : 'in_progress',
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Goals</h1>
          <p className="text-sm text-muted-foreground">
            Annual → Monthly → Weekly hierarchy
          </p>
        </div>
        <Button onClick={() => openAddGoal('annual')} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Goal
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-50">
              <Target className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Active Goals</p>
              <p className="text-lg font-semibold">{activeGoals.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50">
              <Trophy className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Completed</p>
              <p className="text-lg font-semibold">{completedGoals.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50">
              <Flame className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Overall Progress</p>
              <p className="text-lg font-semibold">{overallProgress}%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Goal Hierarchy */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-5 w-48" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : hierarchy.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <p className="text-sm text-muted-foreground">
              No goals yet. Create your first annual goal to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {hierarchy.map((goal) => (
            <GoalNode
              key={goal.id}
              goal={goal}
              depth={0}
              expandedIds={expandedIds}
              onToggleExpand={toggleExpand}
              onAddChild={openAddGoal}
              onProgress={handleProgress}
            />
          ))}
        </div>
      )}

      {/* Create Goal Dialog */}
      <GoalFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        level={formLevel}
        onSave={handleCreate}
        isSaving={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}

// ─── Goal Node (recursive) ───────────────────────────────────────────────────

interface GoalNodeProps {
  goal: Goal & { children?: Goal[] };
  depth: number;
  expandedIds: Set<string>;
  onToggleExpand: (id: string) => void;
  onAddChild: (level: GoalLevel, parentId: string) => void;
  onProgress: (goal: Goal, value: number) => void;
}

function GoalNode({
  goal,
  depth,
  expandedIds,
  onToggleExpand,
  onAddChild,
  onProgress,
}: GoalNodeProps) {
  const meta = LEVEL_META[goal.type];
  const pct = Math.min(Math.round((goal.currentValue / goal.targetValue) * 100), 100);
  const hasChildren = goal.children && goal.children.length > 0;
  const isExpanded = expandedIds.has(goal.id);
  const isCompleted = goal.status === 'completed';

  const nextLevel: GoalLevel | null =
    goal.type === 'annual' ? 'monthly' : goal.type === 'monthly' ? 'weekly' : null;

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <Card
        className={cn(
          'transition-colors',
          isCompleted && 'border-emerald-200 bg-emerald-50/30',
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {/* Expand/Collapse */}
            {hasChildren ? (
              <button
                onClick={() => onToggleExpand(goal.id)}
                className="mt-0.5 rounded p-0.5 text-muted-foreground hover:bg-muted"
              >
                {isExpanded ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            ) : (
              <div className="w-6" />
            )}

            {/* Level Badge */}
            <span className="mt-0.5 text-base">{meta.icon}</span>

            {/* Content */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-sm font-medium',
                    isCompleted ? 'text-muted-foreground line-through' : 'text-foreground',
                  )}
                >
                  {goal.title}
                </span>
                <Badge variant={STATUS_BADGE[goal.status]?.variant ?? 'secondary'}>
                  {goal.status}
                </Badge>
                <Badge variant="outline" className={meta.color}>
                  {meta.label}
                </Badge>
              </div>

              {goal.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">{goal.description}</p>
              )}

              {/* Progress */}
              <div className="mt-2 flex items-center gap-3">
                <Progress value={goal.currentValue} max={goal.targetValue} className="h-2 flex-1" />
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {goal.currentValue}/{goal.targetValue} {goal.unit}
                </span>
                <span
                  className={cn(
                    'text-xs font-semibold tabular-nums',
                    pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-amber-600' : 'text-muted-foreground',
                  )}
                >
                  {pct}%
                </span>
              </div>

              {goal.periodEnd && (
                <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Due {goal.periodEnd}
                </div>
              )}
            </div>

            {/* Quick Progress Buttons */}
            {!isCompleted && (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() =>
                    onProgress(goal, Math.min(goal.currentValue + 1, goal.targetValue))
                  }
                >
                  +1
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div className="mt-2 space-y-2">
          {goal.children!.map((child) => (
            <GoalNode
              key={child.id}
              goal={child}
              depth={depth + 1}
              expandedIds={expandedIds}
              onToggleExpand={onToggleExpand}
              onAddChild={onAddChild}
              onProgress={onProgress}
            />
          ))}
          {/* Add child button */}
          {nextLevel && (
            <div style={{ marginLeft: (depth + 1) * 16 }}>
              <button
                onClick={() => onAddChild(nextLevel, goal.id)}
                className="flex w-full items-center gap-2 rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:bg-muted/50 hover:text-foreground"
              >
                <Plus className="h-3 w-3" />
                Add {LEVEL_META[nextLevel].label} Goal
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Goal Form Dialog ─────────────────────────────────────────────────────────

function GoalFormDialog({
  open,
  onOpenChange,
  level,
  onSave,
  isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level: GoalLevel;
  onSave: (data: {
    title: string;
    description: string;
    targetValue: number;
    unit: string;
  }) => void;
  isSaving: boolean;
}) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');

  const meta = LEVEL_META[level];

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setTargetValue('');
      setUnit('');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseInt(targetValue);
    if (!title.trim() || isNaN(target) || target <= 0 || !unit.trim()) return;
    onSave({
      title: title.trim(),
      description: description.trim(),
      targetValue: target,
      unit: unit.trim(),
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>{meta.icon}</span>
            New {meta.label} Goal
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="goal-title">Title</Label>
            <Input
              id="goal-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Save $20,000"
              autoFocus
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="goal-desc">Description</Label>
            <Textarea
              id="goal-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Why is this goal important?"
              rows={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="goal-target">Target Value</Label>
              <Input
                id="goal-target"
                type="number"
                min="1"
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                placeholder="100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="goal-unit">Unit</Label>
              <Input
                id="goal-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="e.g. dollars, books, hours"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving || !title.trim() || !targetValue || !unit.trim()}
            >
              {isSaving ? 'Creating...' : 'Create Goal'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
