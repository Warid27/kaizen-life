import { useEffect, useRef, useState } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import {
  useMonthlyReview,
  useUpsertReview,
  type MonthlyReview,
} from '@/queries/review';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  FileText,
  Save,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Target,
  BookOpen,
  ArrowRight,
  AlertCircle,
  Check,
} from 'lucide-react';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 1);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
}

function prevMonth(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(parseInt(y), parseInt(m) - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-');
  const d = new Date(parseInt(y), parseInt(m), 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface ReviewFormState {
  biggestAchievement: string;
  biggestLesson: string;
  nextMonthPriorities: string;
}

const EMPTY_FORM: ReviewFormState = {
  biggestAchievement: '',
  biggestLesson: '',
  nextMonthPriorities: '',
};

/**
 * BL21/BL22: never fabricate content. Parse the server-provided auto summary
 * JSON safely; on any surprise shape show the raw text or a neutral message.
 */
function describeAutoSummary(raw: string | null): string | null {
  if (raw == null || raw === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed === 'string') return parsed;
    if (parsed && typeof parsed === 'object') {
      const obj = parsed as Record<string, unknown>;
      for (const key of ['summary', 'text', 'content']) {
        const v = obj[key];
        if (typeof v === 'string' && v.trim()) return v;
      }
      return JSON.stringify(parsed, null, 2);
    }
    return String(parsed);
  } catch {
    return raw; // not JSON — show as plain text
  }
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function ReviewApp() {
  return (
    <QueryProvider>
      <ReviewContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function ReviewContent() {
  const [month, setMonth] = useState(currentMonth());

  const { data: review, isPending } = useMonthlyReview(month);
  const upsertMut = useUpsertReview();

  // Editable fields — synced from the server record when its identity changes.
  const [form, setForm] = useState<ReviewFormState>(EMPTY_FORM);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  const syncKeyRef = useRef('');
  useEffect(() => {
    const key = `${month}:${review?.id ?? 'none'}:${review?.updatedAt ?? 0}`;
    if (syncKeyRef.current === key) return;
    syncKeyRef.current = key;
    if (review) {
      setForm({
        biggestAchievement: review.biggestAchievement ?? '',
        biggestLesson: review.biggestLesson ?? '',
        nextMonthPriorities: review.nextMonthPriorities ?? '',
      });
    } else {
      // No review for this month yet — start a blank create form.
      setForm(EMPTY_FORM);
    }
  }, [month, review]);

  const handleSave = () => {
    setSaveError(null);
    upsertMut.mutate(
      { month, data: form },
      {
        onSuccess: () => {
          setJustSaved(true);
          setTimeout(() => setJustSaved(false), 2000);
        },
        onError: (err) => {
          setSaveError(
            err instanceof Error && err.message
              ? err.message
              : 'Failed to save review. Please try again.',
          );
        },
      },
    );
  };

  const navigateMonth = (dir: 'prev' | 'next') => {
    setSaveError(null);
    setJustSaved(false);
    setMonth(dir === 'prev' ? prevMonth(month) : nextMonth(month));
  };

  const autoSummary = describeAutoSummary(review?.autoSummaryJson ?? null);

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Monthly Review</h1>
          <p className="text-sm text-muted-foreground">
            Reflect, learn, and plan ahead
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigateMonth('prev')}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="min-w-[140px] text-center text-sm font-medium">
            {monthLabel(month)}
          </span>
          <Button variant="ghost" size="sm" onClick={() => navigateMonth('next')}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Auto-Drafted Summary */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-Drafted Summary
            {review && (
              <Badge variant="secondary" className="ml-1 text-[10px]">
                AI
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isPending ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : autoSummary ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/80">
              {autoSummary}
            </p>
          ) : (
            <p className="text-sm leading-relaxed text-muted-foreground">
              No auto-generated summary for this month yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Empty state — honest: nothing exists yet, offer to create (BL21/BL22) */}
      {!isPending && !review && (
        <div className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4">
          <FileText className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div>
            <p className="text-sm font-medium text-foreground">
              No review for this month yet
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Fill in the sections below and save to create your review for{' '}
              {monthLabel(month)}.
            </p>
          </div>
        </div>
      )}

      {/* Input Sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Biggest Achievement */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-emerald-600" />
              Biggest Achievement
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.biggestAchievement}
              onChange={(e) =>
                setForm({ ...form, biggestAchievement: e.target.value })
              }
              placeholder="What did you accomplish this month? What are you most proud of?"
              rows={5}
            />
          </CardContent>
        </Card>

        {/* Biggest Lesson */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-blue-600" />
              Biggest Lesson
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={form.biggestLesson}
              onChange={(e) => setForm({ ...form, biggestLesson: e.target.value })}
              placeholder="What did you learn? What would you do differently?"
              rows={5}
            />
          </CardContent>
        </Card>
      </div>

      {/* Next Month Priorities */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <ArrowRight className="h-4 w-4 text-violet-600" />
            Next Month's Priorities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={form.nextMonthPriorities}
            onChange={(e) => setForm({ ...form, nextMonthPriorities: e.target.value })}
            placeholder="What are your top priorities for next month? List them out..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Feedback */}
      {(saveError || justSaved) && (
        <div
          className={
            saveError
              ? 'flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive'
              : 'flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm text-emerald-700'
          }
          role={saveError ? 'alert' : 'status'}
        >
          {saveError ? (
            <>
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </>
          ) : (
            <>
              <Check className="h-4 w-4 shrink-0" />
              Review saved.
            </>
          )}
        </div>
      )}

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsertMut.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {upsertMut.isPending ? 'Saving...' : review ? 'Update Review' : 'Create Review'}
        </Button>
      </div>
    </div>
  );
}
