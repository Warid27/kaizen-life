import { useState, useMemo } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useSemesters,
  useCourses,
  useAssignments,
  useSemesterEvents,
  useCourseSchedules,
  useCreateCourse,
  useUpdateCourse,
  useDeleteCourse,
  useCreateAssignment,
  useUpdateAssignment,
  useDeleteAssignment,
  useCreateSemester,
  useUpdateSemester,
  useDeleteSemester,
  useCreateSemesterEvent,
  useDeleteSemesterEvent,
} from '@/queries/college';
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
import {
  Plus,
  Pencil,
  Trash2,
  Clock,
  BookOpen,
  GraduationCap,
  CalendarDays,
  AlertTriangle,
  CheckCircle2,
  Circle,
  FileText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Course, CourseSchedule, Assignment, Semester, SemesterEvent } from '@/queries/college';

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_COLORS = [
  'bg-rose-500', 'bg-amber-500', 'bg-emerald-500', 'bg-sky-500',
  'bg-violet-500', 'bg-pink-500', 'bg-teal-500',
];

const COURSE_COLORS = [
  '#ef4444', '#f59e0b', '#22c55e', '#3b82f6', '#8b5cf6',
  '#ec4899', '#14b8a6', '#f97316', '#6366f1',
];

const PRIORITY_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'warning' | 'success'> = {
  low: 'secondary',
  medium: 'default',
  high: 'warning',
  urgent: 'destructive',
};

const STATUS_BADGE: Record<string, 'default' | 'secondary' | 'destructive' | 'success' | 'outline'> = {
  not_started: 'outline',
  in_progress: 'default',
  submitted: 'success',
  graded: 'secondary',
};

const EVENT_TYPE_ICON: Record<string, string> = {
  midterm: '📝',
  final: '🎓',
  deadline: '⏰',
  other: '📌',
};

// ─── Default export ───────────────────────────────────────────────────────────

export default function CollegeApp({ page = 'schedule' }: { page?: string }) {
  return (
    <QueryProvider>
      <CollegeContent page={page} />
    </QueryProvider>
  );
}

// ─── Main content router ──────────────────────────────────────────────────────

function CollegeContent({ page }: { page: string }) {
  switch (page) {
    case 'assignments':
      return <AssignmentsView />;
    case 'semester':
      return <SemesterView />;
    case 'schedule':
    default:
      return <ScheduleView />;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SCHEDULE VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function ScheduleView() {
  const [semesterFilter, setSemesterFilter] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedDay, setSelectedDay] = useState<number>(new Date().getDay());

  const { data: semesters } = useSemesters();
  const { data: courses, isLoading: coursesLoading } = useCourses(
    semesterFilter ? { semesterId: semesterFilter } : undefined,
  );
  const createCourseMut = useCreateCourse();
  const updateCourseMut = useUpdateCourse();
  const deleteCourseMut = useDeleteCourse();

  const activeSemester = semesters?.[0]; // Most recent semester

  // Filter courses by selected day
  const dayCourses = useMemo(() => {
    if (!courses) return [];
    // We'll show all courses but indicate their schedule days
    return courses;
  }, [courses]);

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this course and all its schedules?')) {
      deleteCourseMut.mutate(id);
    }
  };

  const handleSave = (data: { name: string; code: string; lecturer: string; room: string; color: string; semesterId: string }) => {
    if (editingCourse) {
      updateCourseMut.mutate(
        { id: editingCourse.id, data },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createCourseMut.mutate(
        { ...data, semesterId: data.semesterId || activeSemester?.id || '' },
        { onSuccess: () => setFormOpen(false) },
      );
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Schedule</h1>
          <p className="text-sm text-muted-foreground">
            {activeSemester ? activeSemester.name : 'No active semester'}
          </p>
        </div>
        <Button onClick={() => { setEditingCourse(null); setFormOpen(true); }} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          Add Course
        </Button>
      </div>

      {/* Day tabs */}
      <div className="flex gap-1 overflow-x-auto">
        {DAYS.map((day, i) => (
          <button
            key={day}
            onClick={() => setSelectedDay(i)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap',
              selectedDay === i
                ? 'bg-primary text-primary-foreground'
                : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
            )}
          >
            {day}
          </button>
        ))}
      </div>

      {/* Weekly Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            Weekly Schedule — {DAYS[selectedDay]}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {coursesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-16" />
                  <Skeleton className="h-10 flex-1 rounded-lg" />
                </div>
              ))}
            </div>
          ) : (
            <ScheduleTimeline day={selectedDay} courses={dayCourses} />
          )}
        </CardContent>
      </Card>

      {/* Course List */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">All Courses</h2>
        {coursesLoading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))
        ) : (courses ?? []).length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <BookOpen className="mb-2 h-8 w-8 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                No courses yet. Add your first course to start building your schedule.
              </p>
            </CardContent>
          </Card>
        ) : (
          (courses ?? []).map((course) => (
            <CourseCard
              key={course.id}
              course={course}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))
        )}
      </div>

      {/* Course Form Dialog */}
      <CourseFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        course={editingCourse}
        semesters={semesters ?? []}
        onSave={handleSave}
        isSaving={createCourseMut.isPending || updateCourseMut.isPending}
      />
    </div>
  );
}

// ─── Schedule Timeline ────────────────────────────────────────────────────────

function ScheduleTimeline({ day, courses }: { day: number; courses: Course[] }) {
  // For now, show courses grouped by color indicator
  // In a full implementation, this would fetch schedules per course and render a time grid
  const hours = Array.from({ length: 14 }, (_, i) => i + 7); // 7am-8pm

  return (
    <div className="space-y-0">
      {courses.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">
          No courses scheduled for {DAYS[day]}.
        </p>
      ) : (
        <div className="space-y-1">
          {hours.map((hour) => {
            const hourStr = `${String(hour).padStart(2, '0')}:00`;
            return (
              <div key={hour} className="flex items-center gap-3">
                <span className="w-10 shrink-0 text-right text-[10px] text-muted-foreground">
                  {hourStr}
                </span>
                <div className="h-px flex-1 bg-border/50" />
              </div>
            );
          })}
          {/* Overlay course blocks - simplified representation */}
          <div className="mt-2 flex flex-wrap gap-2">
            {courses.map((course) => (
              <div
                key={course.id}
                className="flex items-center gap-2 rounded-lg border px-3 py-2"
                style={{ borderLeftColor: course.color ?? '#6366f1', borderLeftWidth: 3 }}
              >
                <span className="text-xs font-medium text-foreground">{course.name}</span>
                {course.code && (
                  <Badge variant="secondary" className="text-[9px]">{course.code}</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Course Card ──────────────────────────────────────────────────────────────

function CourseCard({
  course,
  onEdit,
  onDelete,
}: {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (id: string) => void;
}) {
  const { data: schedules } = useCourseSchedules(course.id);

  const scheduleText = (schedules ?? [])
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map((s) => `${DAYS[s.dayOfWeek]} ${s.startTime}–${s.endTime}`)
    .join(', ');

  return (
    <Card className="group transition-colors hover:border-border/80">
      <CardContent className="flex items-center gap-4 p-4">
        {/* Color indicator */}
        <div
          className="h-3 w-3 shrink-0 rounded-full"
          style={{ backgroundColor: course.color ?? '#6366f1' }}
        />
        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-foreground truncate">{course.name}</span>
            {course.code && (
              <Badge variant="secondary" className="text-[9px]">{course.code}</Badge>
            )}
          </div>
          <div className="mt-0.5 flex items-center gap-3 text-[10px] text-muted-foreground">
            {course.lecturer && <span>{course.lecturer}</span>}
            {course.room && <span>Room {course.room}</span>}
            {scheduleText && <span className="truncate">{scheduleText}</span>}
          </div>
        </div>
        {/* Actions */}
        <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          <button
            onClick={() => onEdit(course)}
            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => onDelete(course.id)}
            className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Course Form Dialog ───────────────────────────────────────────────────────

interface CourseFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
  semesters: Semester[];
  onSave: (data: { name: string; code: string; lecturer: string; room: string; color: string; semesterId: string }) => void;
  isSaving: boolean;
}

function CourseFormDialog({ open, onOpenChange, course, semesters, onSave, isSaving }: CourseFormDialogProps) {
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [lecturer, setLecturer] = useState('');
  const [room, setRoom] = useState('');
  const [color, setColor] = useState(COURSE_COLORS[0]);
  const [semesterId, setSemesterId] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setName(course?.name ?? '');
      setCode(course?.code ?? '');
      setLecturer(course?.lecturer ?? '');
      setRoom(course?.room ?? '');
      setColor(course?.color ?? COURSE_COLORS[0]);
      setSemesterId(course?.semesterId ?? semesters[0]?.id ?? '');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !semesterId) return;
    onSave({ name: name.trim(), code, lecturer, room, color, semesterId });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>{course ? 'Edit Course' : 'New Course'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="course-name">Course Name *</Label>
            <Input
              id="course-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Linear Algebra"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="course-code">Code</Label>
              <Input
                id="course-code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. MATH201"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-semester">Semester *</Label>
              <Select
                id="course-semester"
                value={semesterId}
                onChange={(e) => setSemesterId(e.target.value)}
              >
                <option value="">Select...</option>
                {semesters.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="course-lecturer">Lecturer</Label>
              <Input
                id="course-lecturer"
                value={lecturer}
                onChange={(e) => setLecturer(e.target.value)}
                placeholder="e.g. Dr. Smith"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="course-room">Room</Label>
              <Input
                id="course-room"
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                placeholder="e.g. B-301"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex gap-2">
              {COURSE_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition-all',
                    color === c ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving || !name.trim() || !semesterId}>
              {isSaving ? 'Saving...' : course ? 'Save Changes' : 'Add Course'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ASSIGNMENTS VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function AssignmentsView() {
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [courseFilter, setCourseFilter] = useState<string>('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);

  const { data: courses } = useCourses();
  const { data: assignments, isLoading } = useAssignments(
    statusFilter ? { status: statusFilter, ...(courseFilter ? { courseId: courseFilter } : {}) } :
    courseFilter ? { courseId: courseFilter } : undefined,
  );
  const createMut = useCreateAssignment();
  const updateMut = useUpdateAssignment();
  const deleteMut = useDeleteAssignment();

  const today = new Date().toISOString().split('T')[0];

  const stats = useMemo(() => {
    const all = assignments ?? [];
    const overdue = all.filter((a) => a.status !== 'submitted' && a.status !== 'graded' && a.dueDate < today).length;
    const dueSoon = all.filter((a) => a.status !== 'submitted' && a.status !== 'graded' && a.dueDate >= today && a.dueDate <= today + 7).length;
    const completed = all.filter((a) => a.status === 'submitted' || a.status === 'graded').length;
    return { total: all.length, overdue, dueSoon, completed };
  }, [assignments, today]);

  const handleEdit = (a: Assignment) => {
    setEditingAssignment(a);
    setFormOpen(true);
  };

  const handleDelete = (id: string) => {
    if (confirm('Delete this assignment?')) {
      deleteMut.mutate(id);
    }
  };

  const handleSave = (data: { courseId: string; title: string; description: string; dueDate: string; priority: string; status: string }) => {
    if (editingAssignment) {
      updateMut.mutate(
        { id: editingAssignment.id, data },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createMut.mutate(
        { ...data },
        { onSuccess: () => setFormOpen(false) },
      );
    }
  };

  const handleStatusToggle = (assignment: Assignment) => {
    const nextStatus = assignment.status === 'not_started' ? 'in_progress'
      : assignment.status === 'in_progress' ? 'submitted'
      : assignment.status;
    if (nextStatus !== assignment.status) {
      updateMut.mutate({ id: assignment.id, data: { status: nextStatus } });
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Assignments</h1>
          <p className="text-sm text-muted-foreground">
            {stats.total} total · {stats.overdue} overdue · {stats.dueSoon} due soon
          </p>
        </div>
        <Button onClick={() => { setEditingAssignment(null); setFormOpen(true); }} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          New Assignment
        </Button>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'Overdue', value: stats.overdue, color: 'text-destructive' },
          { label: 'Due Soon', value: stats.dueSoon, color: 'text-amber-600' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-600' },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-3 text-center">
              <div className={cn('text-xl font-bold', stat.color)}>{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <Select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Status</option>
          <option value="not_started">Not Started</option>
          <option value="in_progress">In Progress</option>
          <option value="submitted">Submitted</option>
          <option value="graded">Graded</option>
        </Select>
        <Select value={courseFilter} onChange={(e) => setCourseFilter(e.target.value)}>
          <option value="">All Courses</option>
          {(courses ?? []).map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
      </div>

      {/* Assignment List */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="flex items-center gap-4 p-4">
                <Skeleton className="h-4 w-4 rounded" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-4 w-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (assignments ?? []).length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="mb-2 h-8 w-8 text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">
              No assignments yet. Add your first assignment to start tracking.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {(assignments ?? []).map((assignment) => {
            const isOverdue = assignment.status !== 'submitted' && assignment.status !== 'graded' && assignment.dueDate < today;
            const course = (courses ?? []).find((c) => c.id === assignment.courseId);
            const daysUntilDue = Math.ceil((new Date(assignment.dueDate).getTime() - Date.now()) / 86400000);

            return (
              <Card
                key={assignment.id}
                className={cn(
                  'group transition-colors hover:border-border/80',
                  isOverdue && 'border-destructive/30 bg-destructive/5',
                )}
              >
                <CardContent className="flex items-center gap-4 p-4">
                  {/* Status toggle */}
                  <button
                    onClick={() => handleStatusToggle(assignment)}
                    className="shrink-0"
                  >
                    {assignment.status === 'submitted' || assignment.status === 'graded' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Circle className="h-4 w-4 text-muted-foreground hover:text-emerald-500" />
                    )}
                  </button>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        'text-sm font-medium truncate',
                        (assignment.status === 'submitted' || assignment.status === 'graded')
                          ? 'text-muted-foreground line-through' : 'text-foreground',
                      )}>
                        {assignment.title}
                      </span>
                      {isOverdue && <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                    </div>
                    <div className="mt-0.5 flex items-center gap-2">
                      {course && (
                        <Badge variant="secondary" className="text-[9px]">{course.name}</Badge>
                      )}
                      <span className={cn(
                        'text-[10px]',
                        isOverdue ? 'text-destructive font-medium' : 'text-muted-foreground',
                      )}>
                        {isOverdue
                          ? `${Math.abs(daysUntilDue)}d overdue`
                          : daysUntilDue === 0
                            ? 'Due today'
                            : `Due in ${daysUntilDue}d`}
                      </span>
                    </div>
                  </div>

                  {/* Badges */}
                  <div className="flex items-center gap-2">
                    <Badge variant={PRIORITY_BADGE[assignment.priority]} className="text-[9px]">
                      {assignment.priority}
                    </Badge>
                    <Badge variant={STATUS_BADGE[assignment.status]} className="text-[9px]">
                      {assignment.status.replace('_', ' ')}
                    </Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      onClick={() => handleEdit(assignment)}
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(assignment.id)}
                      className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assignment Form Dialog */}
      <AssignmentFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        assignment={editingAssignment}
        courses={courses ?? []}
        onSave={handleSave}
        isSaving={createMut.isPending || updateMut.isPending}
      />
    </div>
  );
}

// ─── Assignment Form Dialog ───────────────────────────────────────────────────

interface AssignmentFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  assignment: Assignment | null;
  courses: Course[];
  onSave: (data: { courseId: string; title: string; description: string; dueDate: string; priority: string; status: string }) => void;
  isSaving: boolean;
}

function AssignmentFormDialog({ open, onOpenChange, assignment, courses, onSave, isSaving }: AssignmentFormDialogProps) {
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [status, setStatus] = useState('not_started');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setCourseId(assignment?.courseId ?? courses[0]?.id ?? '');
      setTitle(assignment?.title ?? '');
      setDescription(assignment?.description ?? '');
      setDueDate(assignment?.dueDate ?? '');
      setPriority(assignment?.priority ?? 'medium');
      setStatus(assignment?.status ?? 'not_started');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !courseId || !dueDate) return;
    onSave({ courseId, title: title.trim(), description, dueDate, priority, status });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>{assignment ? 'Edit Assignment' : 'New Assignment'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="a-title">Title *</Label>
            <Input
              id="a-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Problem Set 3"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-course">Course *</Label>
              <Select id="a-course" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
                <option value="">Select...</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-due">Due Date *</Label>
              <Input
                id="a-due"
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="a-desc">Description</Label>
            <Textarea
              id="a-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description..."
              rows={3}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="a-priority">Priority</Label>
              <Select id="a-priority" value={priority} onChange={(e) => setPriority(e.target.value)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="a-status">Status</Label>
              <Select id="a-status" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="not_started">Not Started</option>
                <option value="in_progress">In Progress</option>
                <option value="submitted">Submitted</option>
                <option value="graded">Graded</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !title.trim() || !courseId || !dueDate}>
              {isSaving ? 'Saving...' : assignment ? 'Save Changes' : 'Create Assignment'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEMESTER VIEW
// ═══════════════════════════════════════════════════════════════════════════════

function SemesterView() {
  const [formOpen, setFormOpen] = useState(false);
  const [eventFormOpen, setEventFormOpen] = useState(false);
  const [editingSemester, setEditingSemester] = useState<Semester | null>(null);
  const [selectedSemesterId, setSelectedSemesterId] = useState<string>('');

  const { data: semesters, isLoading: semestersLoading } = useSemesters();
  const activeSemester = selectedSemesterId
    ? (semesters ?? []).find((s) => s.id === selectedSemesterId)
    : semesters?.[0];

  const { data: events } = useSemesterEvents(activeSemester?.id ?? '');
  const { data: courses } = useCourses(activeSemester?.id ? { semesterId: activeSemester.id } : undefined);
  const { data: assignments } = useAssignments();

  const createSemesterMut = useCreateSemester();
  const updateSemesterMut = useUpdateSemester();
  const deleteSemesterMut = useDeleteSemester();
  const createEventMut = useCreateSemesterEvent();
  const deleteEventMut = useDeleteSemesterEvent();

  // Semester progress
  const semesterProgress = useMemo(() => {
    if (!activeSemester) return null;
    const start = new Date(activeSemester.startDate).getTime();
    const end = new Date(activeSemester.endDate).getTime();
    const now = Date.now();
    const total = end - start;
    const elapsed = now - start;
    const pct = Math.max(0, Math.min(100, Math.round((elapsed / total) * 100)));
    const daysLeft = Math.max(0, Math.ceil((end - now) / 86400000));
    return { pct, daysLeft };
  }, [activeSemester]);

  // Course stats for this semester
  const courseStats = useMemo(() => {
    const semesterCourses = (courses ?? []);
    const semesterCourseIds = new Set(semesterCourses.map((c) => c.id));
    const semesterAssignments = (assignments ?? []).filter((a) => semesterCourseIds.has(a.courseId));
    const total = semesterAssignments.length;
    const completed = semesterAssignments.filter((a) => a.status === 'submitted' || a.status === 'graded').length;
    const overdue = semesterAssignments.filter((a) => {
      const today = new Date().toISOString().split('T')[0];
      return a.status !== 'submitted' && a.status !== 'graded' && a.dueDate < today;
    }).length;
    return { courseCount: semesterCourses.length, total, completed, overdue };
  }, [courses, assignments]);

  const handleSaveSemester = (data: { name: string; startDate: string; endDate: string }) => {
    if (editingSemester) {
      updateSemesterMut.mutate(
        { id: editingSemester.id, data },
        { onSuccess: () => setFormOpen(false) },
      );
    } else {
      createSemesterMut.mutate(data, { onSuccess: () => setFormOpen(false) });
    }
  };

  const handleAddEvent = (data: { title: string; date: string; type: string }) => {
    if (!activeSemester) return;
    createEventMut.mutate(
      { semesterId: activeSemester.id, data },
      { onSuccess: () => setEventFormOpen(false) },
    );
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Semester</h1>
          <p className="text-sm text-muted-foreground">
            {activeSemester ? activeSemester.name : 'No semesters yet'}
          </p>
        </div>
        <div className="flex gap-2">
          {activeSemester && (
            <Button onClick={() => setEventFormOpen(true)} size="sm" variant="outline">
              <CalendarDays className="mr-1.5 h-4 w-4" />
              Add Event
            </Button>
          )}
          <Button onClick={() => { setEditingSemester(null); setFormOpen(true); }} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            {activeSemester ? 'New Semester' : 'Create Semester'}
          </Button>
        </div>
      </div>

      {/* Semester selector */}
      {semestersLoading ? (
        <Skeleton className="h-10 w-64" />
      ) : (semesters ?? []).length > 0 ? (
        <div className="flex gap-2 flex-wrap">
          {(semesters ?? []).map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedSemesterId(s.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors',
                (selectedSemesterId || semesters?.[0]?.id) === s.id
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground hover:bg-secondary/80',
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {activeSemester && (
        <>
          {/* Progress Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-muted-foreground" />
                  Semester Progress
                </span>
                {semesterProgress && (
                  <span className="text-xs font-normal text-muted-foreground">
                    {semesterProgress.daysLeft} days remaining
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Progress value={semesterProgress?.pct ?? 0} max={100} className="h-2" />
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
                <span>{activeSemester.startDate}</span>
                <span>{semesterProgress?.pct ?? 0}%</span>
                <span>{activeSemester.endDate}</span>
              </div>
            </CardContent>
          </Card>

          {/* Course Stats */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Courses', value: courseStats.courseCount, color: 'text-foreground' },
              { label: 'Assignments', value: courseStats.total, color: 'text-foreground' },
              { label: 'Completed', value: courseStats.completed, color: 'text-emerald-600' },
              { label: 'Overdue', value: courseStats.overdue, color: 'text-destructive' },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="p-3 text-center">
                  <div className={cn('text-xl font-bold', stat.color)}>{stat.value}</div>
                  <div className="text-[10px] text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Semester Events */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                Key Dates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(events ?? []).length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">
                  No events yet. Add midterms, finals, or deadlines.
                </p>
              ) : (
                <div className="space-y-2">
                  {(events ?? []).map((event) => (
                    <div
                      key={event.id}
                      className="flex items-center gap-3 rounded-lg border border-border px-3 py-2.5"
                    >
                      <span className="text-base">{EVENT_TYPE_ICON[event.type] ?? '📌'}</span>
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-medium text-foreground">{event.title}</span>
                        <div className="text-[10px] text-muted-foreground">{event.date}</div>
                      </div>
                      <Badge variant="secondary" className="text-[9px]">{event.type}</Badge>
                      <button
                        onClick={() => deleteEventMut.mutate(event.id)}
                        className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Semester list with actions */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">All Semesters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {(semesters ?? []).map((s) => (
                  <div
                    key={s.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2.5',
                      s.id === activeSemester?.id ? 'border-primary/30 bg-primary/5' : 'border-border',
                    )}
                  >
                    <div>
                      <span className="text-sm font-medium text-foreground">{s.name}</span>
                      <div className="text-[10px] text-muted-foreground">
                        {s.startDate} — {s.endDate}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => { setEditingSemester(s); setFormOpen(true); }}
                        className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete semester "${s.name}"?`)) deleteSemesterMut.mutate(s.id);
                        }}
                        className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Semester Form Dialog */}
      <SemesterFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        semester={editingSemester}
        onSave={handleSaveSemester}
        isSaving={createSemesterMut.isPending || updateSemesterMut.isPending}
      />

      {/* Semester Event Form Dialog */}
      <SemesterEventFormDialog
        open={eventFormOpen}
        onOpenChange={setEventFormOpen}
        onSave={handleAddEvent}
        isSaving={createEventMut.isPending}
      />
    </div>
  );
}

// ─── Semester Form Dialog ─────────────────────────────────────────────────────

interface SemesterFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  semester: Semester | null;
  onSave: (data: { name: string; startDate: string; endDate: string }) => void;
  isSaving: boolean;
}

function SemesterFormDialog({ open, onOpenChange, semester, onSave, isSaving }: SemesterFormDialogProps) {
  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setName(semester?.name ?? '');
      setStartDate(semester?.startDate ?? '');
      setEndDate(semester?.endDate ?? '');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !startDate || !endDate) return;
    onSave({ name: name.trim(), startDate, endDate });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>{semester ? 'Edit Semester' : 'New Semester'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="sem-name">Semester Name *</Label>
            <Input
              id="sem-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Fall 2025"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sem-start">Start Date *</Label>
              <Input
                id="sem-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="sem-end">End Date *</Label>
              <Input
                id="sem-end"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !name.trim() || !startDate || !endDate}>
              {isSaving ? 'Saving...' : semester ? 'Save Changes' : 'Create Semester'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Semester Event Form Dialog ───────────────────────────────────────────────

interface SemesterEventFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (data: { title: string; date: string; type: string }) => void;
  isSaving: boolean;
}

function SemesterEventFormDialog({ open, onOpenChange, onSave, isSaving }: SemesterEventFormDialogProps) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [type, setType] = useState('deadline');

  const handleOpen = (isOpen: boolean) => {
    if (isOpen) {
      setTitle('');
      setDate('');
      setType('deadline');
    }
    onOpenChange(isOpen);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date) return;
    onSave({ title: title.trim(), date, type });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent onClose={() => handleOpen(false)}>
        <DialogHeader>
          <DialogTitle>Add Semester Event</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ev-title">Title *</Label>
            <Input
              id="ev-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Midterm Exam"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ev-date">Date *</Label>
              <Input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ev-type">Type</Label>
              <Select id="ev-type" value={type} onChange={(e) => setType(e.target.value)}>
                <option value="midterm">Midterm</option>
                <option value="final">Final</option>
                <option value="deadline">Deadline</option>
                <option value="other">Other</option>
              </Select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={() => handleOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={isSaving || !title.trim() || !date}>
              {isSaving ? 'Saving...' : 'Add Event'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
