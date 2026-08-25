import { useState, useCallback, useRef } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { useTasks, useCreateTask, useUpdateTask, useDeleteTask } from '@/queries/tasks';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import {
  Plus,
  GripVertical,
  Pencil,
  Trash2,
  Calendar,
  Clock,
  CheckCircle2,
  Circle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui';
import type { Task, CreateTask, TaskPriority, TaskStatus } from '@kaizenlife/shared';

// ─── Constants ────────────────────────────────────────────────────────────────

const HOURS = Array.from({ length: 18 }, (_, i) => i + 5); // 5 AM to 10 PM

const PRIORITY_CONFIG: Record<TaskPriority, { color: string; label: string }> = {
  low: {
    color:
      'bg-sky-100 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-900',
    label: 'Low',
  },
  medium: {
    color:
      'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-900',
    label: 'Medium',
  },
  high: {
    color:
      'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-900',
    label: 'High',
  },
  urgent: {
    color:
      'bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-900',
    label: 'Urgent',
  },
};

const STATUS_ICONS: Record<TaskStatus, typeof Circle> = {
  todo: Circle,
  in_progress: Clock,
  done: CheckCircle2,
  cancelled: AlertCircle,
};

// ─── Default export (island entry) ────────────────────────────────────────────

export default function PlannerApp() {
  return (
    <QueryProvider>
      <PlannerContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function PlannerContent() {
  const { selectedDate, setSelectedDate } = useUIStore();
  const [formOpen, setFormOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [deletingTask, setDeletingTask] = useState<Task | null>(null);

  const { data: tasks, isLoading } = useTasks({ date: selectedDate });

  const createMut = useCreateTask();
  const updateMut = useUpdateTask();
  const deleteMut = useDeleteTask();

  // ── Date navigation ───────────────────────────────────────────────────────

  const navigateDate = (offset: number) => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + offset);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const goToToday = () => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    setSelectedDate(`${yyyy}-${mm}-${dd}`);
  };

  const isToday = selectedDate === (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  })();

  const dateLabel = new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  // ── Task actions ──────────────────────────────────────────────────────────

  const handleCreate = () => {
    setEditingTask(null);
    setFormOpen(true);
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setFormOpen(true);
  };

  const handleDeleteRequest = (task: Task) => {
    setDeletingTask(task);
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => {
        setDeletingTask(null);
        toast.success('Task deleted');
      },
      onError: () => setDeletingTask(null),
    });
  };

  const handleStatusToggle = (task: Task) => {
    const nextStatus: Record<TaskStatus, TaskStatus> = {
      todo: 'in_progress',
      in_progress: 'done',
      done: 'todo',
      cancelled: 'todo',
    };
    updateMut.mutate({ id: task.id, data: { status: nextStatus[task.status] } });
  };

  const handleSave = (data: CreateTask) => {
    if (editingTask) {
      updateMut.mutate(
        { id: editingTask.id, data },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Task updated');
          },
        },
      );
    } else {
      createMut.mutate(data, {
        onSuccess: () => {
          setFormOpen(false);
          toast.success('Task created');
        },
      });
    }
  };

  // ── Drag and drop (state-based rescheduling) ──────────────────────────────

  const handleDragStart = useCallback((task: Task) => {
    setDraggedTask(task);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggedTask(null);
  }, []);

  const handleDrop = useCallback(
    (targetHour: number) => {
      if (!draggedTask) return;
      const newStart = `${String(targetHour).padStart(2, '0')}:00`;
      const newEnd = `${String(Math.min(targetHour + 1, 23)).padStart(2, '0')}:00`;
      updateMut.mutate({
        id: draggedTask.id,
        data: { startTime: newStart, endTime: newEnd },
      });
      setDraggedTask(null);
    },
    [draggedTask, updateMut],
  );

  // ── Group tasks by hour ───────────────────────────────────────────────────

  const tasksByHour = new Map<number, Task[]>();
  for (const task of tasks ?? []) {
    if (task.startTime) {
      const hour = parseInt(task.startTime.split(':')[0], 10);
      if (!tasksByHour.has(hour)) tasksByHour.set(hour, []);
      tasksByHour.get(hour)!.push(task);
    }
  }

  // Tasks without time
  const untimedTasks = (tasks ?? []).filter((t) => !t.startTime);

  const completedCount = (tasks ?? []).filter((t) => t.status === 'done').length;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Daily Planner
          </h1>
          <p className="text-sm text-muted-foreground">
            {completedCount}/{tasks?.length ?? 0} tasks completed
          </p>
        </div>
        <Button onClick={handleCreate} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Task
        </Button>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigateDate(-1)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{dateLabel}</span>
        </div>
        <button
          onClick={() => navigateDate(1)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
        {!isToday && (
          <button
            onClick={goToToday}
            className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary hover:bg-primary/20"
          >
            Today
          </button>
        )}
      </div>

      {/* Time Grid */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-3">
              <Skeleton className="h-8 w-14 shrink-0" />
              <Skeleton className="h-8 flex-1" />
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y divide-border">
              {HOURS.map((hour) => {
                const hourTasks = tasksByHour.get(hour) ?? [];
                const isDropTarget = draggedTask !== null;

                return (
                  <div
                    key={hour}
                    className={cn(
                      'flex min-h-[48px] transition-colors',
                      isDropTarget && 'hover:bg-primary/5',
                    )}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.add('bg-primary/10');
                    }}
                    onDragLeave={(e) => {
                      e.currentTarget.classList.remove('bg-primary/10');
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.currentTarget.classList.remove('bg-primary/10');
                      handleDrop(hour);
                    }}
                  >
                    {/* Time label */}
                    <div className="flex w-16 shrink-0 items-start justify-end px-3 pt-1.5 text-xs text-muted-foreground">
                      {hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`}
                    </div>

                    {/* Tasks */}
                    <div className="flex-1 py-1 pr-3">
                      {hourTasks.map((task) => (
                        <PlannerTask
                          key={task.id}
                          task={task}
                          onEdit={handleEdit}
                          onDelete={handleDeleteRequest}
                          onStatusToggle={handleStatusToggle}
                          onDragStart={handleDragStart}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Untimed Tasks */}
      {untimedTasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-xs text-muted-foreground">Unscheduled</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {untimedTasks.map((task) => (
              <PlannerTask
                key={task.id}
                task={task}
                onEdit={handleEdit}
                onDelete={handleDeleteRequest}
                onStatusToggle={handleStatusToggle}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
              />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <TaskFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        task={editingTask}
        defaultDate={selectedDate}
        onSave={handleSave}
        isSaving={createMut.isPending || updateMut.isPending}
      />

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={deletingTask !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingTask(null);
        }}
        title="Delete this task?"
        description={deletingTask ? `"${deletingTask.title}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => deletingTask && handleDelete(deletingTask.id)}
      />
    </div>
  );
}

// ─── Planner Task Item ────────────────────────────────────────────────────────

interface PlannerTaskProps {
  task: Task;
  onEdit: (task: Task) => void;
  onDelete: (task: Task) => void;
  onStatusToggle: (task: Task) => void;
  onDragStart: (task: Task) => void;
  onDragEnd: () => void;
}

function PlannerTask({
  task,
  onEdit,
  onDelete,
  onStatusToggle,
  onDragStart,
  onDragEnd,
}: PlannerTaskProps) {
  const StatusIcon = STATUS_ICONS[task.status];
  const priority = PRIORITY_CONFIG[task.priority];
  const done = task.status === 'done';

  return (
    <div
      draggable
      onDragStart={() => onDragStart(task)}
      onDragEnd={onDragEnd}
      className={cn(
        'group mb-1 flex items-center gap-2 rounded-md border border-transparent px-2 py-1.5 transition-all hover:border-border hover:shadow-sm',
        done && 'opacity-50',
      )}
    >
      {/* Drag handle */}
      <GripVertical className="h-3.5 w-3.5 shrink-0 cursor-grab text-muted-foreground/40 group-hover:text-muted-foreground" />

      {/* Status toggle */}
      <button
        onClick={() => onStatusToggle(task)}
        className="shrink-0"
        aria-label={`Toggle status: ${task.status}`}
      >
        <StatusIcon
          className={cn(
            'h-4 w-4',
            done ? 'text-emerald-500' : 'text-muted-foreground',
          )}
        />
      </button>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => onEdit(task)}
            className="min-w-0 flex-1 text-left"
            aria-label={`Edit task: ${task.title}`}
          >
            <span
              className={cn(
                'block truncate text-sm font-medium',
                done ? 'text-muted-foreground line-through' : 'text-foreground',
              )}
            >
              {task.title}
            </span>
          </button>
          <span
            className={cn(
              'shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-medium',
              priority.color,
            )}
          >
            {priority.label}
          </span>
        </div>
        {task.description && (
          <p className="truncate text-xs text-muted-foreground">{task.description}</p>
        )}
        {task.startTime && task.endTime && (
          <span className="text-[10px] text-muted-foreground">
            {task.startTime} – {task.endTime}
          </span>
        )}
      </div>

      {/* Actions — always visible on touch devices (no hover available there) */}
      <div className="flex gap-0.5 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
        <button
          onClick={() => onEdit(task)}
          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={`Edit task: ${task.title}`}
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={() => onDelete(task)}
          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          aria-label={`Delete task: ${task.title}`}
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Task Form Dialog ─────────────────────────────────────────────────────────

interface TaskFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  defaultDate: string;
  onSave: (data: CreateTask) => void;
  isSaving: boolean;
}

function TaskFormDialog({
  open,
  onOpenChange,
  task,
  defaultDate,
  onSave,
  isSaving,
}: TaskFormDialogProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTitle(task?.title ?? '');
      setDescription(task?.description ?? '');
      setDate(task?.date ?? defaultDate);
      setStartTime(task?.startTime ?? '');
      setEndTime(task?.endTime ?? '');
      setPriority(task?.priority ?? 'medium');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      userId: '',
      title: title.trim(),
      description: description.trim() || null,
      date: date || null,
      startTime: startTime || null,
      endTime: endTime || null,
      estimatedDurationMin: null,
      priority,
      status: task?.status ?? 'todo',
      projectId: null,
      courseId: null,
      tags: null,
    } as CreateTask);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>{task ? 'Edit Task' : 'New Task'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label htmlFor="task-title">Title</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Description</Label>
            <Textarea
              id="task-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={3}
            />
          </div>

          {/* Date + Time row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="task-date">Date</Label>
              <Input
                id="task-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-start">Start</Label>
              <Input
                id="task-start"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="task-end">End</Label>
              <Input
                id="task-end"
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-1.5">
            <Label htmlFor="task-priority">Priority</Label>
            <Select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </Select>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !title.trim()}>
              {isSaving ? 'Saving...' : task ? 'Save Changes' : 'Create Task'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
