import { useState, useMemo } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useProjects,
  useCreateProject,
  useUpdateProject,
  useDeleteProject,
  useClients,
  useCreateClient,
  useUpdateClient,
  useDeleteClient,
  useFollowups,
  useCreateFollowup,
  useUpdateFollowup,
  useStandups,
  useCreateStandup,
  useUpdateStandup,
  useDeleteStandup,
  useTeamMembers,
  useCreateTeamMember,
  useMeetings,
  useCreateMeeting,
  useUpdateMeeting,
  useDeleteMeeting,
  useActionItems,
  useCreateActionItem,
  useUpdateActionItem,
} from '@/queries/work';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { toast } from '@/components/ui/toast';
import {
  Plus,
  Pencil,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Clock,
  Users,
  FolderKanban,
  MessageSquare,
  Target,
  TrendingUp,
  AlertCircle,
  Phone,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore } from '@/stores/ui';
import type {
  Project,
  Client,
  ClientFollowup,
  Standup,
  Meeting,
  MeetingActionItem,
  TeamMember,
} from '@kaizenlife/shared';

// ─── Constants ────────────────────────────────────────────────────────────────

const PROJECT_STATUS_LABEL: Record<string, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On Hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

const PROJECT_STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'warning' | 'outline'> = {
  planning: 'outline',
  active: 'default',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'secondary',
};

const PROJECT_PRIORITY_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'warning'> = {
  low: 'secondary',
  medium: 'default',
  high: 'warning',
  urgent: 'destructive',
};

const STANDUP_STATUS_BADGE: Record<string, 'success' | 'warning' | 'destructive'> = {
  on_track: 'success',
  at_risk: 'warning',
  blocked: 'destructive',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDayString(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayString() {
  return toDayString(0);
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function WorkApp({ page = 'standup' }: { page?: string }) {
  return (
    <QueryProvider>
      <WorkContent page={page} />
    </QueryProvider>
  );
}

// ─── Main content router ──────────────────────────────────────────────────────

function WorkContent({ page }: { page: string }) {
  switch (page) {
    case 'projects':
      return <ProjectsView />;
    case 'clients':
      return <ClientsView />;
    case 'meetings':
      return <MeetingsView />;
    case 'performance':
      return <PerformanceView />;
    case 'standup':
    default:
      return <StandupView />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// STANDUP VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function StandupView() {
  const { selectedDate } = useUIStore();
  const [formOpen, setFormOpen] = useState(false);
  const [teamFormOpen, setTeamFormOpen] = useState(false);
  const [deletingStandup, setDeletingStandup] = useState<Standup | null>(null);

  const { data: standups, isLoading } = useStandups({ date: selectedDate });
  const { data: teamMembers } = useTeamMembers();
  const createStandupMut = useCreateStandup();
  const updateStandupMut = useUpdateStandup();
  const deleteStandupMut = useDeleteStandup();
  const createTeamMemberMut = useCreateTeamMember();

  const today = todayString();
  const isToday = selectedDate === today;

  const handleStatusChange = (standup: Standup, status: string) => {
    updateStandupMut.mutate({ id: standup.id, data: { status: status as any } });
  };

  const handleDelete = (id: string) => {
    deleteStandupMut.mutate(id, {
      onSuccess: () => {
        setDeletingStandup(null);
        toast.success('Standup entry deleted');
      },
      onError: () => setDeletingStandup(null),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Daily Standup</h1>
          <p className="text-sm text-muted-foreground">
            {selectedDate} · {(standups ?? []).length} entries
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setTeamFormOpen(true)} size="sm" variant="outline">
            <Users className="mr-1.5 h-4 w-4" />
            Add Member
          </Button>
          <Button onClick={() => setFormOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Standup
          </Button>
        </div>
      </div>

      {/* Standup entries */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <Skeleton className="h-6 w-6 rounded-full" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-16 rounded-full" />
                </div>
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (standups ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              {isToday ? 'No standups for today yet. Log your first standup!' : 'No standups for this date.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(standups ?? []).map((standup) => {
            const member = (teamMembers ?? []).find((m) => m.id === standup.teamMemberId);
            return (
              <StandupCard
                key={standup.id}
                standup={standup}
                member={member}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
              />
            );
          })}
        </div>
      )}

      {/* Standup Form Dialog */}
      <StandupFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        teamMembers={teamMembers ?? []}
        onSave={(data) =>
          createStandupMut.mutate(data, {
            onSuccess: () => {
              setFormOpen(false);
              toast.success('Standup logged');
            },
          })
        }
        isSaving={createStandupMut.isPending}
      />

      {/* Team Member Form Dialog */}
      <TeamMemberFormDialog
        open={teamFormOpen}
        onOpenChange={setTeamFormOpen}
        onSave={(data) =>
          createTeamMemberMut.mutate(
            { ...data, userId: '' },
            {
              onSuccess: () => {
                setTeamFormOpen(false);
                toast.success('Team member added');
              },
            },
          )
        }
        isSaving={createTeamMemberMut.isPending}
      />

      {/* Delete Standup Confirmation */}
      <ConfirmDialog
        open={deletingStandup !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingStandup(null);
        }}
        title="Delete this standup entry?"
        confirmLabel="Delete"
        loading={deleteStandupMut.isPending}
        onConfirm={() => deletingStandup && handleDelete(deletingStandup.id)}
      />
    </div>
  );
}

// ─── Standup Card ─────────────────────────────────────────────────────────────

function StandupCard({
  standup,
  member,
  onStatusChange,
  onDelete,
}: {
  standup: Standup;
  member?: TeamMember;
  onStatusChange: (s: Standup, status: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="group transition-colors hover:border-border/80">
      <CardContent className="p-4 space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
              {member?.name?.charAt(0) ?? '?'}
            </div>
            <div>
              <span className="text-sm font-medium text-foreground">{member?.name ?? 'Unknown'}</span>
              {member?.role && (
                <span className="ml-2 text-[10px] text-muted-foreground">{member.role}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={standup.status}
              onChange={(e) => onStatusChange(standup, e.target.value)}
              className="h-7 w-28 text-[10px]"
            >
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="blocked">Blocked</option>
            </Select>
            <button
              onClick={() => onDelete(standup.id)}
              className="rounded p-1 text-muted-foreground opacity-100 transition-opacity hover:bg-destructive/10 hover:text-destructive [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
              aria-label="Delete standup entry"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="grid gap-2 text-xs">
          {standup.currentTask && (
            <div>
              <span className="font-semibold text-muted-foreground">Current Task: </span>
              <span className="text-foreground">{standup.currentTask}</span>
            </div>
          )}
          {standup.todayTarget && (
            <div>
              <span className="font-semibold text-muted-foreground">Today's Target: </span>
              <span className="text-foreground">{standup.todayTarget}</span>
            </div>
          )}
          {standup.actualResult && (
            <div>
              <span className="font-semibold text-muted-foreground">Actual Result: </span>
              <span className="text-foreground">{standup.actualResult}</span>
            </div>
          )}
          {standup.blocker && (
            <div className="flex items-start gap-1.5 rounded-md bg-destructive/5 px-2 py-1.5">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0 text-destructive" />
              <div>
                <span className="font-semibold text-destructive">Blocker: </span>
                <span className="text-foreground">{standup.blocker}</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Standup Form Dialog ──────────────────────────────────────────────────────

interface StandupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teamMembers: TeamMember[];
  onSave: (data: any) => void;
  isSaving: boolean;
}

function StandupFormDialog({ open, onOpenChange, teamMembers, onSave, isSaving }: StandupFormDialogProps) {
  const [teamMemberId, setTeamMemberId] = useState('');
  const [currentTask, setCurrentTask] = useState('');
  const [todayTarget, setTodayTarget] = useState('');
  const [actualResult, setActualResult] = useState('');
  const [blocker, setBlocker] = useState('');
  const [status, setStatus] = useState('on_track');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTeamMemberId(teamMembers[0]?.id ?? '');
      setCurrentTask('');
      setTodayTarget('');
      setActualResult('');
      setBlocker('');
      setStatus('on_track');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamMemberId) return;
    onSave({
      teamMemberId,
      date: todayString(),
      currentTask: currentTask || null,
      todayTarget: todayTarget || null,
      actualResult: actualResult || null,
      blocker: blocker || null,
      status,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>New Standup Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="su-member">Team Member *</Label>
            <Select id="su-member" value={teamMemberId} onChange={(e) => setTeamMemberId(e.target.value)}>
              <option value="">Select member...</option>
              {teamMembers.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-current">Current Task</Label>
            <Input
              id="su-current"
              value={currentTask}
              onChange={(e) => setCurrentTask(e.target.value)}
              placeholder="What are you working on?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-target">Today's Target</Label>
            <Input
              id="su-target"
              value={todayTarget}
              onChange={(e) => setTodayTarget(e.target.value)}
              placeholder="What will you accomplish today?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-result">Actual Result</Label>
            <Input
              id="su-result"
              value={actualResult}
              onChange={(e) => setActualResult(e.target.value)}
              placeholder="What did you achieve?"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-blocker">Blocker</Label>
            <Input
              id="su-blocker"
              value={blocker}
              onChange={(e) => setBlocker(e.target.value)}
              placeholder="Any blockers? (optional)"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="su-status">Status</Label>
            <Select id="su-status" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="on_track">On Track</option>
              <option value="at_risk">At Risk</option>
              <option value="blocked">Blocked</option>
            </Select>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !teamMemberId}>
              {isSaving ? 'Saving...' : 'Submit Standup'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Team Member Form Dialog ──────────────────────────────────────────────────

function TeamMemberFormDialog({
  open, onOpenChange, onSave, isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { name: string; role?: string; active: boolean }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) { setName(''); setRole(''); }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), role: role || undefined, active: true });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>Add Team Member</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="tm-name">Name *</Label>
            <Input id="tm-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Alice" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tm-role">Role</Label>
            <Input id="tm-role" value={role} onChange={(e) => setRole(e.target.value)} placeholder="e.g. Frontend Dev" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? 'Saving...' : 'Add Member'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROJECTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function ProjectsView() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProject, setDeletingProject] = useState<Project | null>(null);

  const { data: projects, isLoading } = useProjects(
    statusFilter ? { status: statusFilter } : undefined,
  );
  const { data: clients } = useClients();
  const createMut = useCreateProject();
  const updateMut = useUpdateProject();
  const deleteMut = useDeleteProject();

  const stats = useMemo(() => {
    const all = projects ?? [];
    return {
      total: all.length,
      active: all.filter((p) => p.status === 'active').length,
      completed: all.filter((p) => p.status === 'completed').length,
      overdue: all.filter((p) => p.deadline && p.status !== 'completed' && p.status !== 'cancelled' && daysUntil(p.deadline)! < 0).length,
    };
  }, [projects]);

  const handleEdit = (p: Project) => {
    setEditingProject(p);
    setFormOpen(true);
  };

  const handleSave = (data: any) => {
    if (editingProject) {
      updateMut.mutate(
        { id: editingProject.id, data },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Project updated');
          },
        },
      );
    } else {
      createMut.mutate(data, {
        onSuccess: () => {
          setFormOpen(false);
          toast.success('Project created');
        },
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMut.mutate(id, {
      onSuccess: () => {
        setDeletingProject(null);
        toast.success('Project deleted');
      },
      onError: () => setDeletingProject(null),
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} total · {stats.active} active · {stats.overdue} overdue
          </p>
        </div>
        <Button onClick={() => { setEditingProject(null); setFormOpen(true); }} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Project
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Active', value: stats.active, color: 'text-primary' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
          { label: 'Overdue', value: stats.overdue, color: 'text-destructive' },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3 text-center">
              <div className={cn('text-xl font-bold', s.color)}>{s.value}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {['', 'planning', 'active', 'on_hold', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              statusFilter === s
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
          >
            {s ? PROJECT_STATUS_LABEL[s] : 'All'}
          </button>
        ))}
      </div>

      {/* Project list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-2 w-full rounded-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (projects ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FolderKanban className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No projects yet. Create your first project.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(projects ?? []).map((project) => {
            const client = (clients ?? []).find((c) => c.id === project.clientId);
            const dleft = daysUntil(project.deadline);
            const isOverdue = dleft !== null && dleft < 0 && project.status !== 'completed' && project.status !== 'cancelled';

            return (
              <Card
                key={project.id}
                className={cn(
                  'group transition-colors hover:border-border/80',
                  isOverdue && 'border-destructive/30 bg-destructive/5',
                )}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{project.name}</span>
                      {isOverdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive" />}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={PROJECT_STATUS_BADGE[project.status]} className="text-[9px]">
                        {PROJECT_STATUS_LABEL[project.status]}
                      </Badge>
                      <Badge variant={PROJECT_PRIORITY_BADGE[project.priority]} className="text-[9px]">
                        {project.priority}
                      </Badge>
                      <div className="flex gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                        <button
                          onClick={() => handleEdit(project)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Edit project: ${project.name}`}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingProject(project)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                          aria-label={`Delete project: ${project.name}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                  {project.description && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{project.description}</p>
                  )}
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    {client && <span>Client: {client.name}</span>}
                    {project.pic && <span>PIC: {project.pic}</span>}
                    {project.deadline && (
                      <span className={cn(isOverdue && 'text-destructive font-medium')}>
                        Deadline: {project.deadline} {isOverdue ? `(${Math.abs(dleft!)}d overdue)` : dleft !== null && dleft >= 0 ? `(${dleft}d left)` : ''}
                      </span>
                    )}
                  </div>
                  <Progress value={project.progressPct} max={100} className="h-1.5" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ProjectFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editingProject}
        clients={clients ?? []}
        onSave={handleSave}
        isSaving={createMut.isPending || updateMut.isPending}
      />

      {/* Delete Project Confirmation */}
      <ConfirmDialog
        open={deletingProject !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingProject(null);
        }}
        title="Delete this project?"
        description={
          deletingProject
            ? `"${deletingProject.name}" will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleteMut.isPending}
        onConfirm={() => deletingProject && handleDelete(deletingProject.id)}
      />
    </div>
  );
}

// ─── Project Form Dialog ──────────────────────────────────────────────────────

function ProjectFormDialog({
  open, onOpenChange, project, clients, onSave, isSaving,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: Project | null;
  clients: Client[];
  onSave: (data: any) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [clientId, setClientId] = useState('');
  const [status, setStatus] = useState('planning');
  const [priority, setPriority] = useState('medium');
  const [deadline, setDeadline] = useState('');
  const [progressPct, setProgressPct] = useState(0);
  const [pic, setPic] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setName(project?.name ?? '');
      setDescription(project?.description ?? '');
      setClientId(project?.clientId ?? '');
      setStatus(project?.status ?? 'planning');
      setPriority(project?.priority ?? 'medium');
      setDeadline(project?.deadline ?? '');
      setProgressPct(project?.progressPct ?? 0);
      setPic(project?.pic ?? '');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      description: description || null,
      clientId: clientId || null,
      status,
      priority,
      deadline: deadline || null,
      progressPct,
      pic: pic || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>{project ? 'Edit Project' : 'New Project'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="p-name">Project Name *</Label>
            <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Website Redesign" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-desc">Description</Label>
            <Textarea id="p-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Brief project description..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-client">Client</Label>
              <Select id="p-client" value={clientId} onChange={(e) => setClientId(e.target.value)}>
                <option value="">None</option>
                {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-pic">Person in Charge</Label>
              <Input id="p-pic" value={pic} onChange={(e) => setPic(e.target.value)} placeholder="e.g. Alice" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="p-status">Status</Label>
              <Select id="p-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="planning">Planning</option>
                <option value="active">Active</option>
                <option value="on_hold">On Hold</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-priority">Priority</Label>
              <Select id="p-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="p-deadline">Deadline</Label>
              <Input id="p-deadline" type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="p-progress">Progress ({progressPct}%)</Label>
            <input
              id="p-progress"
              type="range"
              min={0}
              max={100}
              value={progressPct}
              onChange={(e) => setProgressPct(Number(e.target.value))}
              className="w-full"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? 'Saving...' : project ? 'Save Changes' : 'Create Project'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// CLIENTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function ClientsView() {
  const [formOpen, setFormOpen] = useState(false);
  const [followupFormOpen, setFollowupFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [deletingClient, setDeletingClient] = useState<Client | null>(null);
  const [selectedClientId, setSelectedClientId] = useState<string>('');

  const { data: clients, isLoading } = useClients();
  const { data: followups } = useFollowups();
  const createClientMut = useCreateClient();
  const updateClientMut = useUpdateClient();
  const deleteClientMut = useDeleteClient();
  const createFollowupMut = useCreateFollowup();
  const updateFollowupMut = useUpdateFollowup();

  // Build client → followup map with overdue detection
  const clientFollowupMap = useMemo(() => {
    const map = new Map<string, { pending: number; overdue: number; latest: ClientFollowup | null }>();
    const today = todayString();

    for (const fu of followups ?? []) {
      const existing = map.get(fu.clientId) ?? { pending: 0, overdue: 0, latest: null };
      if (fu.status === 'pending') {
        existing.pending++;
        if (fu.nextFollowupDate && fu.nextFollowupDate < today) {
          existing.overdue++;
        }
      }
      if (!existing.latest || fu.createdAt > existing.latest.createdAt) {
        existing.latest = fu;
      }
      map.set(fu.clientId, existing);
    }
    return map;
  }, [followups]);

  const handleEdit = (c: Client) => {
    setEditingClient(c);
    setFormOpen(true);
  };

  const handleSaveClient = (data: { name: string; company: string; contactInfo: string; notes: string }) => {
    if (editingClient) {
      updateClientMut.mutate(
        { id: editingClient.id, data },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Client updated');
          },
        },
      );
    } else {
      createClientMut.mutate(
        { ...data, userId: '' },
        {
          onSuccess: () => {
            setFormOpen(false);
            toast.success('Client added');
          },
        },
      );
    }
  };

  const handleSaveFollowup = (data: any) => {
    createFollowupMut.mutate(data, {
      onSuccess: () => {
        setFollowupFormOpen(false);
        toast.success('Follow-up added');
      },
    });
  };

  const handleDeleteClient = (id: string) => {
    deleteClientMut.mutate(id, {
      onSuccess: () => {
        setDeletingClient(null);
        toast.success('Client deleted');
      },
      onError: () => setDeletingClient(null),
    });
  };

  const handleCompleteFollowup = (followup: ClientFollowup) => {
    updateFollowupMut.mutate({
      id: followup.id,
      data: { status: 'done', lastContactDate: todayString() },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground">
            {(clients ?? []).length} clients · {
              Array.from(clientFollowupMap.values()).reduce((sum, m) => sum + m.overdue, 0)
            } overdue follow-ups
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => { setFollowupFormOpen(true); }} size="sm" variant="outline">
            <Phone className="mr-1.5 h-4 w-4" />
            Add Follow-up
          </Button>
          <Button onClick={() => { setEditingClient(null); setFormOpen(true); }} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Client
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (clients ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No clients yet. Add your first client.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(clients ?? []).map((client) => {
            const fu = clientFollowupMap.get(client.id);
            const isOverdue = (fu?.overdue ?? 0) > 0;

            return (
              <Card
                key={client.id}
                className={cn(
                  'group transition-colors hover:border-border/80',
                  isOverdue && 'border-destructive/30 bg-destructive/5',
                )}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground">{client.name}</span>
                      {isOverdue && (
                        <Badge variant="destructive" className="text-[9px]">
                          <AlertTriangle className="mr-0.5 h-2.5 w-2.5" />
                          {fu!.overdue} overdue follow-up{fu!.overdue > 1 ? 's' : ''}
                        </Badge>
                      )}
                      {client.company && (
                        <Badge variant="secondary" className="text-[9px]">{client.company}</Badge>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                      <button
                        onClick={() => handleEdit(client)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={`Edit client: ${client.name}`}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingClient(client)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label={`Delete client: ${client.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {client.contactInfo && (
                    <p className="text-xs text-muted-foreground">{client.contactInfo}</p>
                  )}
                  {client.notes && (
                    <p className="text-xs text-muted-foreground line-clamp-2 italic">{client.notes}</p>
                  )}
                  {/* Pending follow-ups */}
                  {(fu?.pending ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {(followups ?? [])
                        .filter((f) => f.clientId === client.id && f.status === 'pending')
                        .slice(0, 3)
                        .map((f) => {
                          const dleft = daysUntil(f.nextFollowupDate);
                          const overdue = dleft !== null && dleft < 0;
                          return (
                            <div
                              key={f.id}
                              className={cn(
                                'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px]',
                                overdue ? 'border-destructive/30 bg-destructive/5' : 'border-border',
                              )}
                            >
                              {overdue ? (
                                <AlertTriangle className="h-2.5 w-2.5 text-destructive" />
                              ) : (
                                <Clock className="h-2.5 w-2.5 text-muted-foreground" />
                              )}
                              <span className={cn(overdue ? 'text-destructive' : 'text-muted-foreground')}>
                                Follow-up: {f.nextFollowupDate ?? 'No date'}
                              </span>
                              <button
                                onClick={() => handleCompleteFollowup(f)}
                                className="ml-1 rounded hover:bg-muted"
                                title="Mark as done"
                              >
                                <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                              </button>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <ClientFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        client={editingClient}
        onSave={handleSaveClient}
        isSaving={createClientMut.isPending || updateClientMut.isPending}
      />

      <FollowupFormDialog
        open={followupFormOpen}
        onOpenChange={setFollowupFormOpen}
        clients={clients ?? []}
        onSave={handleSaveFollowup}
        isSaving={createFollowupMut.isPending}
      />

      {/* Delete Client Confirmation */}
      <ConfirmDialog
        open={deletingClient !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingClient(null);
        }}
        title="Delete this client?"
        description={
          deletingClient
            ? `"${deletingClient.name}" and their follow-ups will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleteClientMut.isPending}
        onConfirm={() => deletingClient && handleDeleteClient(deletingClient.id)}
      />
    </div>
  );
}

// ─── Client Form Dialog ───────────────────────────────────────────────────────

function ClientFormDialog({
  open, onOpenChange, client, onSave, isSaving,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; client: Client | null;
  onSave: (d: { name: string; company: string; contactInfo: string; notes: string }) => void;
  isSaving: boolean;
}) {
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [contactInfo, setContactInfo] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setName(client?.name ?? '');
      setCompany(client?.company ?? '');
      setContactInfo(client?.contactInfo ?? '');
      setNotes(client?.notes ?? '');
    }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>{client ? 'Edit Client' : 'New Client'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (!name.trim()) return; onSave({ name: name.trim(), company, contactInfo, notes }); }} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Acme Corp" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Company</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="e.g. Acme Inc." />
          </div>
          <div className="space-y-1.5">
            <Label>Contact Info</Label>
            <Input value={contactInfo} onChange={(e) => setContactInfo(e.target.value)} placeholder="e.g. alice@acme.com" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Additional notes..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !name.trim()}>
              {isSaving ? 'Saving...' : client ? 'Save Changes' : 'Add Client'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Follow-up Form Dialog ────────────────────────────────────────────────────

function FollowupFormDialog({
  open, onOpenChange, clients, onSave, isSaving,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; clients: Client[];
  onSave: (d: any) => void; isSaving: boolean;
}) {
  const [clientId, setClientId] = useState('');
  const [nextFollowupDate, setNextFollowupDate] = useState('');
  const [notes, setNotes] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) { setClientId(''); setNextFollowupDate(''); setNotes(''); }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>Add Follow-up</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (!clientId) return; onSave({ clientId, nextFollowupDate: nextFollowupDate || null, notes: notes || null, status: 'pending' }); }} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Client *</Label>
            <Select value={clientId} onChange={(e) => setClientId(e.target.value)}>
              <option value="">Select client...</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Next Follow-up Date</Label>
            <Input type="date" value={nextFollowupDate} onChange={(e) => setNextFollowupDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Follow-up notes..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !clientId}>{isSaving ? 'Saving...' : 'Add Follow-up'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MEETINGS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function MeetingsView() {
  const [formOpen, setFormOpen] = useState(false);
  const [actionItemFormOpen, setActionItemFormOpen] = useState(false);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [deletingMeeting, setDeletingMeeting] = useState<Meeting | null>(null);

  const { data: meetings, isLoading } = useMeetings();
  const { data: projects } = useProjects();
  const { data: actionItems } = useActionItems();
  const createMeetingMut = useCreateMeeting();
  const updateMeetingMut = useUpdateMeeting();
  const deleteMeetingMut = useDeleteMeeting();
  const createActionItemMut = useCreateActionItem();
  const updateActionItemMut = useUpdateActionItem();

  const handleSaveMeeting = (data: any) => {
    createMeetingMut.mutate(data, {
      onSuccess: () => {
        setFormOpen(false);
        toast.success('Meeting added');
      },
    });
  };

  const handleSaveActionItem = (data: any) => {
    createActionItemMut.mutate(data, {
      onSuccess: () => {
        setActionItemFormOpen(false);
        toast.success('Action item added');
      },
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Meetings</h1>
          <p className="text-sm text-muted-foreground">
            {(meetings ?? []).length} meetings · {(actionItems ?? []).filter((a) => a.status === 'open').length} open action items
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setActionItemFormOpen(true)} size="sm" variant="outline">
            <Plus className="mr-1.5 h-4 w-4" />
            Action Item
          </Button>
          <Button onClick={() => setFormOpen(true)} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            New Meeting
          </Button>
        </div>
      </div>

      {/* Meeting list */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-3 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (meetings ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <MessageSquare className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No meetings yet. Log your first meeting.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {(meetings ?? []).map((meeting) => {
            const project = (projects ?? []).find((p) => p.id === meeting.projectId);
            const meetingItems = (actionItems ?? []).filter((a) => a.meetingId === meeting.id);
            const isOpen = selectedMeetingId === meeting.id;
            const openCount = meetingItems.filter((a) => a.status === 'open').length;

            return (
              <Card key={meeting.id} className="group transition-colors hover:border-border/80">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-foreground">{meeting.date}</span>
                      {project && <Badge variant="secondary" className="text-[9px]">{project.name}</Badge>}
                      {openCount > 0 && (
                        <Badge variant="warning" className="text-[9px]">{openCount} open</Badge>
                      )}
                    </div>
                    <div className="flex gap-1 opacity-100 transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100">
                      <button
                        onClick={() => setSelectedMeetingId(isOpen ? null : meeting.id)}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                        aria-label={isOpen ? 'Hide meeting details' : 'Show meeting details'}
                        aria-expanded={isOpen}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingMeeting(meeting)}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        aria-label="Delete meeting"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {meeting.agenda && (
                    <div className="text-xs text-muted-foreground">
                      <span className="font-semibold">Agenda: </span>{meeting.agenda}
                    </div>
                  )}
                  {meeting.decisions && (
                    <div className="rounded-md bg-muted/50 px-3 py-2 text-xs">
                      <span className="font-semibold text-foreground">Decisions: </span>
                      <span className="text-muted-foreground">{meeting.decisions}</span>
                    </div>
                  )}
                  {/* Action items for this meeting */}
                  {meetingItems.length > 0 && (
                    <div className="space-y-1.5">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Action Items
                      </span>
                      {meetingItems.map((item) => (
                        <div
                          key={item.id}
                          className={cn(
                            'flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                            item.status === 'done' ? 'border-border/50 bg-muted/30' : 'border-border',
                          )}
                        >
                          <button
                            onClick={() => updateActionItemMut.mutate({
                              id: item.id,
                              data: { status: item.status === 'open' ? 'done' : 'open' },
                            })}
                          >
                            {item.status === 'done' ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                            )}
                          </button>
                          <span className={cn(
                            'flex-1',
                            item.status === 'done' ? 'text-muted-foreground line-through' : 'text-foreground',
                          )}>
                            {item.description}
                          </span>
                          {item.pic && <Badge variant="secondary" className="text-[9px]">{item.pic}</Badge>}
                          {item.deadline && (
                            <span className="text-[10px] text-muted-foreground">Due: {item.deadline}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <MeetingFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        projects={projects ?? []}
        onSave={handleSaveMeeting}
        isSaving={createMeetingMut.isPending}
      />

      <ActionItemFormDialog
        open={actionItemFormOpen}
        onOpenChange={setActionItemFormOpen}
        meetings={meetings ?? []}
        onSave={handleSaveActionItem}
        isSaving={createActionItemMut.isPending}
      />

      {/* Delete Meeting Confirmation */}
      <ConfirmDialog
        open={deletingMeeting !== null}
        onOpenChange={(open) => {
          if (!open) setDeletingMeeting(null);
        }}
        title="Delete this meeting?"
        description={
          deletingMeeting
            ? `The meeting on ${deletingMeeting.date} and its action items will be permanently removed.`
            : undefined
        }
        confirmLabel="Delete"
        loading={deleteMeetingMut.isPending}
        onConfirm={() => {
          if (deletingMeeting) {
            deleteMeetingMut.mutate(deletingMeeting.id, {
              onSuccess: () => {
                setDeletingMeeting(null);
                toast.success('Meeting deleted');
              },
              onError: () => setDeletingMeeting(null),
            });
          }
        }}
      />
    </div>
  );
}

// ─── Meeting Form Dialog ──────────────────────────────────────────────────────

function MeetingFormDialog({
  open, onOpenChange, projects, onSave, isSaving,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; projects: Project[];
  onSave: (d: any) => void; isSaving: boolean;
}) {
  const [date, setDate] = useState(todayString());
  const [projectId, setProjectId] = useState('');
  const [agenda, setAgenda] = useState('');
  const [decisions, setDecisions] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) { setDate(todayString()); setProjectId(''); setAgenda(''); setDecisions(''); }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>New Meeting</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); onSave({ date, projectId: projectId || null, agenda: agenda || null, decisions: decisions || null }); }} className="mt-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Date *</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Project</Label>
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
                <option value="">None</option>
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Agenda</Label>
            <Textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={3} placeholder="Meeting agenda..." />
          </div>
          <div className="space-y-1.5">
            <Label>Decisions</Label>
            <Textarea value={decisions} onChange={(e) => setDecisions(e.target.value)} rows={3} placeholder="Key decisions made..." />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving}>{isSaving ? 'Saving...' : 'Create Meeting'}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Action Item Form Dialog ──────────────────────────────────────────────────

function ActionItemFormDialog({
  open, onOpenChange, meetings, onSave, isSaving,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; meetings: Meeting[];
  onSave: (d: any) => void; isSaving: boolean;
}) {
  const [meetingId, setMeetingId] = useState('');
  const [description, setDescription] = useState('');
  const [pic, setPic] = useState('');
  const [deadline, setDeadline] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) { setMeetingId(''); setDescription(''); setPic(''); setDeadline(''); }
    onOpenChange(isOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>New Action Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={(e) => { e.preventDefault(); if (!description.trim() || !meetingId) return; onSave({ meetingId, description: description.trim(), pic: pic || null, deadline: deadline || null }); }} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label>Meeting *</Label>
            <Select value={meetingId} onChange={(e) => setMeetingId(e.target.value)}>
              <option value="">Select meeting...</option>
              {meetings.map((m) => <option key={m.id} value={m.id}>{m.date}{m.projectId ? ` — Project` : ''}</option>)}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Description *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What needs to be done?" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Person in Charge</Label>
              <Input value={pic} onChange={(e) => setPic(e.target.value)} placeholder="e.g. Alice" />
            </div>
            <div className="space-y-1.5">
              <Label>Deadline</Label>
              <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !description.trim() || !meetingId}>
              {isSaving ? 'Saving...' : 'Add Action Item'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PERFORMANCE VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function PerformanceView() {
  const { data: standups } = useStandups({});
  const { data: projects } = useProjects();
  const { data: teamMembers } = useTeamMembers();
  const { data: actionItems } = useActionItems();

  const last30Days = toDayString(30);
  const last7Days = toDayString(7);

  const stats = useMemo(() => {
    const recentStandups = (standups ?? []).filter((s) => s.date >= last30Days);
    const recent7 = (standups ?? []).filter((s) => s.date >= last7Days);

    // Per-member stats
    const memberStats = (teamMembers ?? []).map((member) => {
      const memberStandups = recentStandups.filter((s) => s.teamMemberId === member.id);
      const member7 = recent7.filter((s) => s.teamMemberId === member.id);
      const blocked = member7.filter((s) => s.status === 'blocked').length;
      const atRisk = member7.filter((s) => s.status === 'at_risk').length;
      const onTrack = member7.filter((s) => s.status === 'on_track').length;
      const total = member7.length;
      const healthScore = total > 0 ? Math.round(((onTrack) / total) * 100) : 0;

      return {
        member,
        totalStandups: memberStandups.length,
        recentStandups: member7.length,
        onTrack,
        atRisk,
        blocked,
        healthScore,
      };
    });

    // Project stats
    const projectStats = {
      total: (projects ?? []).length,
      active: (projects ?? []).filter((p) => p.status === 'active').length,
      completed: (projects ?? []).filter((p) => p.status === 'completed').length,
      avgProgress: (projects ?? []).length > 0
        ? Math.round((projects ?? []).reduce((sum, p) => sum + p.progressPct, 0) / (projects ?? []).length)
        : 0,
      overdue: (projects ?? []).filter((p) => p.deadline && p.status !== 'completed' && p.status !== 'cancelled' && daysUntil(p.deadline)! < 0).length,
    };

    // Action item stats
    const actionItemStats = {
      total: (actionItems ?? []).length,
      open: (actionItems ?? []).filter((a) => a.status === 'open').length,
      done: (actionItems ?? []).filter((a) => a.status === 'done').length,
    };

    return { memberStats, projectStats, actionItemStats };
  }, [standups, projects, teamMembers, actionItems, last30Days, last7Days]);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Team Performance</h1>
        <p className="text-sm text-muted-foreground">Last 7-day summary · {stats.memberStats.length} team members</p>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Team Members', value: stats.memberStats.length, color: 'text-foreground', icon: Users },
          { label: 'Active Projects', value: stats.projectStats.active, color: 'text-primary', icon: FolderKanban },
          { label: 'Open Actions', value: stats.actionItemStats.open, color: 'text-amber-600', icon: Target },
          { label: 'Avg Progress', value: `${stats.projectStats.avgProgress}%`, color: 'text-emerald-600', icon: TrendingUp },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <stat.icon className="mx-auto mb-1 h-4 w-4 text-muted-foreground" />
              <div className={cn('text-xl font-bold', stat.color)}>{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Member performance */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Users className="h-4 w-4 text-muted-foreground" />
            Member Performance (Last 7 Days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {stats.memberStats.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              No team members yet. Add members to start tracking performance.
            </p>
          ) : (
            <div className="space-y-4">
              {stats.memberStats
                .sort((a, b) => a.healthScore - b.healthScore) // Worst first
                .map(({ member, totalStandups, onTrack, atRisk, blocked, healthScore }) => (
                  <div key={member.id} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground">
                          {member.name.charAt(0)}
                        </div>
                        <div>
                          <span className="text-sm font-medium text-foreground">{member.name}</span>
                          {member.role && (
                            <span className="ml-2 text-[10px] text-muted-foreground">{member.role}</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-xs font-medium',
                          healthScore >= 70 ? 'text-emerald-600' : healthScore >= 40 ? 'text-amber-600' : 'text-destructive',
                        )}>
                          {healthScore}% health
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-4 text-[10px] text-muted-foreground pl-10">
                      <span>{totalStandups} standups</span>
                      <span className="text-emerald-600">{onTrack} on track</span>
                      {atRisk > 0 && <span className="text-amber-600">{atRisk} at risk</span>}
                      {blocked > 0 && <span className="text-destructive">{blocked} blocked</span>}
                    </div>
                    <Progress
                      value={healthScore}
                      max={100}
                      className={cn(
                        'h-1.5 ml-10',
                        healthScore >= 70 ? '[&>div]:bg-emerald-500' : healthScore >= 40 ? '[&>div]:bg-amber-500' : '[&>div]:bg-destructive',
                      )}
                    />
                  </div>
                ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Project Health */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <FolderKanban className="h-4 w-4 text-muted-foreground" />
            Project Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(projects ?? [])
              .filter((p) => p.status !== 'cancelled' && p.status !== 'completed')
              .sort((a, b) => a.progressPct - b.progressPct)
              .map((project) => {
                const dleft = daysUntil(project.deadline);
                const isOverdue = dleft !== null && dleft < 0;
                return (
                  <div key={project.id} className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground truncate">{project.name}</span>
                        {isOverdue && <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={PROJECT_STATUS_BADGE[project.status]} className="text-[9px]">
                          {PROJECT_STATUS_LABEL[project.status]}
                        </Badge>
                        <Badge variant={PROJECT_PRIORITY_BADGE[project.priority]} className="text-[9px]">
                          {project.priority}
                        </Badge>
                        {project.deadline && (
                          <span className={cn('text-[10px]', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                            {isOverdue ? `${Math.abs(dleft!)}d overdue` : `${dleft}d left`}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="w-32 shrink-0">
                      <div className="flex items-center justify-between text-[10px] mb-1">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{project.progressPct}%</span>
                      </div>
                      <Progress value={project.progressPct} max={100} className="h-1.5" />
                    </div>
                  </div>
                );
              })}
            {(projects ?? []).filter((p) => p.status !== 'cancelled' && p.status !== 'completed').length === 0 && (
              <p className="py-4 text-center text-xs text-muted-foreground">No active projects.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Items Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Target className="h-4 w-4 text-muted-foreground" />
            Action Items Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Open Items</h3>
              {(actionItems ?? []).filter((a) => a.status === 'open').slice(0, 5).map((item) => {
                const dleft = daysUntil(item.deadline);
                const isOverdue = dleft !== null && dleft < 0;
                return (
                  <div key={item.id} className={cn('flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs', isOverdue && 'border-destructive/30 bg-destructive/5')}>
                    <Circle className="h-3 w-3 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{item.description}</span>
                    {item.pic && <Badge variant="secondary" className="text-[9px] shrink-0">{item.pic}</Badge>}
                    {item.deadline && (
                      <span className={cn('text-[10px] shrink-0', isOverdue ? 'text-destructive' : 'text-muted-foreground')}>
                        {item.deadline}
                      </span>
                    )}
                  </div>
                );
              })}
              {stats.actionItemStats.open === 0 && (
                <p className="py-2 text-xs text-muted-foreground">No open action items.</p>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground">Completion Rate</h3>
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-emerald-600">
                    {stats.actionItemStats.total > 0
                      ? Math.round((stats.actionItemStats.done / stats.actionItemStats.total) * 100)
                      : 0}%
                  </div>
                  <div className="text-[10px] text-muted-foreground">Completed</div>
                </div>
                <div className="flex-1">
                  <Progress
                    value={stats.actionItemStats.done}
                    max={stats.actionItemStats.total || 1}
                    className="h-3"
                  />
                  <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
                    <span>{stats.actionItemStats.done} done</span>
                    <span>{stats.actionItemStats.open} open</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
