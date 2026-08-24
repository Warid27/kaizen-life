import { useState, useMemo, useEffect } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { useDiaryEntries, useUpsertDiaryEntry } from '@/queries/diary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Heart,
  Lightbulb,
  Target,
  BookOpen,
  Search,
  Save,
  ArrowLeft,
  ArrowRight,
  Calendar,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, todayStr, shiftDays } from '@/stores/ui';
import type { DiaryEntry, UpsertDiaryEntry } from '@kaizenlife/shared';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

// ─── Default export ───────────────────────────────────────────────────────────

export default function DiaryApp() {
  return (
    <QueryProvider>
      <DiaryContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function DiaryContent() {
  const { selectedDate, setSelectedDate } = useUIStore();
  const [gratefulFor, setGratefulFor] = useState('');
  const [lessonLearned, setLessonLearned] = useState('');
  const [tomorrowFocus, setTomorrowFocus] = useState('');
  const [freeText, setFreeText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedEntry, setExpandedEntry] = useState<string | null>(null);

  // Fetch 90 days of entries for history
  const { data: entries, isLoading } = useDiaryEntries({
    from: shiftDays(todayStr(), -90),
  });

  const upsertMut = useUpsertDiaryEntry();

  // Current day's entry
  const currentEntry = useMemo(
    () => entries?.find((e) => e.date === selectedDate) ?? null,
    [entries, selectedDate],
  );

  // Populate form
  useEffect(() => {
    if (currentEntry) {
      setGratefulFor(currentEntry.gratefulFor ?? '');
      setLessonLearned(currentEntry.lessonLearned ?? '');
      setTomorrowFocus(currentEntry.tomorrowFocus ?? '');
      setFreeText(currentEntry.freeText ?? '');
    } else {
      setGratefulFor('');
      setLessonLearned('');
      setTomorrowFocus('');
      setFreeText('');
    }
  }, [currentEntry?.id]);

  // Search-filtered history (chronological, newest first)
  const history = useMemo(() => {
    if (!entries) return [];
    let filtered = [...entries].sort((a, b) => b.date.localeCompare(a.date));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          (e.gratefulFor ?? '').toLowerCase().includes(q) ||
          (e.lessonLearned ?? '').toLowerCase().includes(q) ||
          (e.tomorrowFocus ?? '').toLowerCase().includes(q) ||
          (e.freeText ?? '').toLowerCase().includes(q),
      );
    }
    return filtered;
  }, [entries, searchQuery]);

  // Date navigation
  const navigateDate = (offset: number) => {
    setSelectedDate(shiftDays(selectedDate, offset));
  };

  const handleSave = () => {
    const data: UpsertDiaryEntry = {
      gratefulFor: gratefulFor || null,
      lessonLearned: lessonLearned || null,
      tomorrowFocus: tomorrowFocus || null,
      freeText: freeText || null,
    };
    upsertMut.mutate({ date: selectedDate, data });
  };

  const isSaved = currentEntry !== null;
  const hasContent = gratefulFor || lessonLearned || tomorrowFocus || freeText;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Diary</h1>
          <p className="text-sm text-muted-foreground">
            {history.length} entries ·{' '}
            {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </div>

      {/* Date Navigation */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigateDate(-1)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <Calendar className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium text-foreground">
          {formatDate(selectedDate)}
        </span>
        <button
          onClick={() => navigateDate(1)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {/* Journal Form */}
      <div className="space-y-4">
        {/* Prompt 1: Grateful For */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Heart className="h-4 w-4 text-rose-500" />
              I'm grateful for...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={gratefulFor}
              onChange={(e) => setGratefulFor(e.target.value)}
              placeholder="What are you grateful for today?"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Prompt 2: Lesson Learned */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              Today I learned...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={lessonLearned}
              onChange={(e) => setLessonLearned(e.target.value)}
              placeholder="What lesson did you learn today?"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Prompt 3: Tomorrow's Focus */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-emerald-500" />
              Tomorrow I will focus on...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={tomorrowFocus}
              onChange={(e) => setTomorrowFocus(e.target.value)}
              placeholder="What's your main focus for tomorrow?"
              rows={3}
            />
          </CardContent>
        </Card>

        {/* Free Text */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              Free Journal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Write anything else on your mind..."
              rows={5}
            />
          </CardContent>
        </Card>

        {/* Save */}
        <div className="flex justify-end">
          <Button onClick={handleSave} disabled={upsertMut.isPending || !hasContent}>
            <Save className="mr-1.5 h-4 w-4" />
            {upsertMut.isPending
              ? 'Saving...'
              : isSaved
                ? 'Update Entry'
                : 'Save Entry'}
          </Button>
        </div>
      </div>

      {/* History */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Journal History</CardTitle>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search entries..."
                className="h-8 w-48 pl-8 text-xs"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-full" />
                </div>
              ))}
            </div>
          ) : history.length === 0 ? (
            <p className="py-4 text-center text-xs text-muted-foreground">
              {searchQuery ? 'No entries match your search.' : 'No diary entries yet.'}
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((entry) => {
                const isExpanded = expandedEntry === entry.date;
                const hasAnyField =
                  entry.gratefulFor || entry.lessonLearned || entry.tomorrowFocus || entry.freeText;

                return (
                  <div
                    key={entry.date}
                    className="rounded-lg border border-border transition-colors hover:bg-muted/30"
                  >
                    <button
                      onClick={() =>
                        setExpandedEntry(isExpanded ? null : entry.date)
                      }
                      className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-foreground">
                          {formatDate(entry.date)}
                        </span>
                        <div className="flex gap-1">
                          {entry.gratefulFor && (
                            <Badge variant="secondary" className="text-[9px]">
                              <Heart className="mr-0.5 h-2.5 w-2.5" />
                              Grateful
                            </Badge>
                          )}
                          {entry.lessonLearned && (
                            <Badge variant="secondary" className="text-[9px]">
                              <Lightbulb className="mr-0.5 h-2.5 w-2.5" />
                              Learned
                            </Badge>
                          )}
                          {entry.tomorrowFocus && (
                            <Badge variant="secondary" className="text-[9px]">
                              <Target className="mr-0.5 h-2.5 w-2.5" />
                              Focus
                            </Badge>
                          )}
                          {entry.freeText && (
                            <Badge variant="secondary" className="text-[9px]">
                              <BookOpen className="mr-0.5 h-2.5 w-2.5" />
                              Free
                            </Badge>
                          )}
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    {isExpanded && (
                      <div className="space-y-3 border-t border-border px-3 py-3">
                        {entry.gratefulFor && (
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">
                              Grateful For
                            </span>
                            <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">
                              {entry.gratefulFor}
                            </p>
                          </div>
                        )}
                        {entry.lessonLearned && (
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-500">
                              Lesson Learned
                            </span>
                            <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">
                              {entry.lessonLearned}
                            </p>
                          </div>
                        )}
                        {entry.tomorrowFocus && (
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500">
                              Tomorrow's Focus
                            </span>
                            <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">
                              {entry.tomorrowFocus}
                            </p>
                          </div>
                        )}
                        {entry.freeText && (
                          <div>
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              Free Journal
                            </span>
                            <p className="mt-0.5 text-sm text-foreground whitespace-pre-wrap">
                              {entry.freeText}
                            </p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
