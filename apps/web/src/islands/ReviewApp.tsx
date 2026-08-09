import { useState, useMemo } from 'react';
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
  Star,
  Zap,
  Heart,
} from 'lucide-react';
import { cn } from '@/lib/utils';

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

// ─── Demo data ────────────────────────────────────────────────────────────────

function generateDemoReview(month: string): MonthlyReview {
  return {
    id: `review-${month}`,
    month,
    autoSummary:
      'This month you completed 78% of habits, maintained a consistent sleep schedule averaging 7.2 hours, and made progress on 2 of 3 active projects. Financially, you saved $1,200 against your target of $1,667.',
    achievements:
      '• Shipped v1.0 of the finance module\n• Maintained 21-day meditation streak\n• Reduced daily screen time by 45 minutes',
    lessons:
      '• Week 3 energy dip correlates with skipping morning exercise\n• Meal prepping on Sundays saves ~$200/month\n• Need better time-blocking for deep work sessions',
    nextPriorities:
      '• Complete goals review UI module\n• Start running program (3x/week)\n• Review and optimize subscription spending',
    mood: 4,
    energy: 3,
    satisfaction: 4,
    createdAt: `${month}-01T00:00:00Z`,
    updatedAt: `${month}-15T00:00:00Z`,
  };
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

  const { data: review, isLoading } = useMonthlyReview(month);
  const upsertMut = useUpsertReview();

  const reviewData = review ?? generateDemoReview(month);

  // Editable fields
  const [achievements, setAchievements] = useState<string | null>(null);
  const [lessons, setLessons] = useState<string | null>(null);
  const [nextPriorities, setNextPriorities] = useState<string | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [satisfaction, setSatisfaction] = useState<number | null>(null);

  // Initialize form on data load
  useMemo(() => {
    if (reviewData) {
      setAchievements(reviewData.achievements ?? '');
      setLessons(reviewData.lessons ?? '');
      setNextPriorities(reviewData.nextPriorities ?? '');
      setMood(reviewData.mood ?? null);
      setEnergy(reviewData.energy ?? null);
      setSatisfaction(reviewData.satisfaction ?? null);
    }
  }, [reviewData.id]);

  const handleSave = () => {
    upsertMut.mutate({
      month,
      data: {
        achievements: achievements ?? undefined,
        lessons: lessons ?? undefined,
        nextPriorities: nextPriorities ?? undefined,
        mood: mood ?? undefined,
        energy: energy ?? undefined,
        satisfaction: satisfaction ?? undefined,
      },
    });
  };

  const navigateMonth = (dir: 'prev' | 'next') => {
    setMonth(dir === 'prev' ? prevMonth(month) : nextMonth(month));
  };

  const moodEmojis = ['😔', '😐', '🙂', '😊', '🤩'];
  const energyEmojis = ['😴', '🥱', '😊', '💪', '⚡'];
  const satisfactionEmojis = ['😞', '😐', '🙂', '😊', '🥳'];

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

      {/* Mood / Energy / Satisfaction */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <RatingCard
          label="Mood"
          icons={moodEmojis}
          value={mood}
          onChange={setMood}
          icon={<Star className="h-4 w-4 text-amber-500" />}
        />
        <RatingCard
          label="Energy"
          icons={energyEmojis}
          value={energy}
          onChange={setEnergy}
          icon={<Zap className="h-4 w-4 text-blue-500" />}
        />
        <RatingCard
          label="Satisfaction"
          icons={satisfactionEmojis}
          value={satisfaction}
          onChange={setSatisfaction}
          icon={<Heart className="h-4 w-4 text-rose-500" />}
        />
      </div>

      {/* Auto-Drafted Summary */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <Sparkles className="h-4 w-4 text-primary" />
            Auto-Drafted Summary
            <Badge variant="secondary" className="ml-1 text-[10px]">
              AI
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ) : (
            <p className="text-sm leading-relaxed text-foreground/80">
              {reviewData.autoSummary ?? 'No summary available yet. Complete your review to generate one.'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Input Sections */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Achievements */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <Target className="h-4 w-4 text-emerald-600" />
              Achievements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={achievements ?? ''}
              onChange={(e) => setAchievements(e.target.value)}
              placeholder="What did you accomplish this month? What are you proud of?"
              rows={5}
            />
          </CardContent>
        </Card>

        {/* Lessons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <BookOpen className="h-4 w-4 text-blue-600" />
              Lessons Learned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Textarea
              value={lessons ?? ''}
              onChange={(e) => setLessons(e.target.value)}
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
            value={nextPriorities ?? ''}
            onChange={(e) => setNextPriorities(e.target.value)}
            placeholder="What are your top priorities for next month? List them out..."
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Save Button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={upsertMut.isPending}>
          <Save className="mr-1.5 h-4 w-4" />
          {upsertMut.isPending ? 'Saving...' : 'Save Review'}
        </Button>
      </div>
    </div>
  );
}

// ─── Rating Card ──────────────────────────────────────────────────────────────

function RatingCard({
  label,
  icons,
  value,
  onChange,
  icon,
}: {
  label: string;
  icons: string[];
  value: number | null;
  onChange: (v: number) => void;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="mb-2 flex items-center gap-2">
          {icon}
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <div className="flex gap-1.5">
          {icons.map((emoji, i) => (
            <button
              key={i}
              onClick={() => onChange(i + 1)}
              className={cn(
                'flex h-9 w-9 items-center justify-center rounded-lg border text-lg transition-all',
                value === i + 1
                  ? 'border-primary bg-primary/10 shadow-sm scale-110'
                  : 'border-border hover:border-primary/30 hover:bg-muted/50',
              )}
              title={`${label}: ${i + 1}/5`}
            >
              {emoji}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
