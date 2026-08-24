import { useState, useEffect, useMemo } from 'react';
import { QueryProvider } from '@/lib/query-provider';
import { useCheckins, useUpsertCheckin } from '@/queries/checkin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Moon,
  Sun,
  CloudMoon,
  Brain,
  Zap,
  Wind,
  Save,
  ArrowLeft,
  ArrowRight,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUIStore, todayStr, shiftDays } from '@/stores/ui';
import type { Checkin, UpsertCheckin } from '@kaizenlife/shared';

// ─── Default export ───────────────────────────────────────────────────────────

export default function CheckinApp() {
  return (
    <QueryProvider>
      <CheckinContent />
    </QueryProvider>
  );
}

// ─── Main content ─────────────────────────────────────────────────────────────

function CheckinContent() {
  const { selectedDate, setSelectedDate } = useUIStore();
  const [bedTime, setBedTime] = useState('');
  const [wakeTime, setWakeTime] = useState('');
  const [napMinutes, setNapMinutes] = useState('');
  const [sleepQuality, setSleepQuality] = useState<number | null>(null);
  const [mood, setMood] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [stress, setStress] = useState<number | null>(null);
  const [note, setNote] = useState('');

  // Fetch current day's check-in + 7 days for rolling averages.
  // BL3: the window must never invert — browsing deep into the past anchors
  // the range on the selected date so entries stay visible.
  const today = todayStr();
  const historyFrom = selectedDate <= today ? shiftDays(selectedDate, -6) : shiftDays(today, -6);
  const historyTo = selectedDate > today ? selectedDate : today;

  const { data: checkins, isLoading } = useCheckins({
    from: historyFrom,
    to: historyTo,
  });

  const upsertMut = useUpsertCheckin();

  // Current day's check-in
  const currentCheckin = useMemo(
    () => checkins?.find((c) => c.date === selectedDate) ?? null,
    [checkins, selectedDate],
  );

  // Populate form when data loads
  useEffect(() => {
    if (currentCheckin) {
      setBedTime(currentCheckin.bedTime ?? '');
      setWakeTime(currentCheckin.wakeTime ?? '');
      setNapMinutes(currentCheckin.napMinutes?.toString() ?? '');
      setSleepQuality(currentCheckin.sleepQuality ?? null);
      setMood(currentCheckin.mood ?? null);
      setEnergy(currentCheckin.energy ?? null);
      setStress(currentCheckin.stress ?? null);
      setNote(currentCheckin.note ?? '');
    } else {
      setBedTime('');
      setWakeTime('');
      setNapMinutes('');
      setSleepQuality(null);
      setMood(null);
      setEnergy(null);
      setStress(null);
      setNote('');
    }
  }, [currentCheckin?.id]);

  // 7-day rolling averages
  const rollingAvg = useMemo(() => {
    const recent = checkins ?? [];
    if (recent.length === 0) return null;

    const avg = (field: keyof Checkin) => {
      const vals = recent
        .map((c) => c[field])
        .filter((v): v is number => typeof v === 'number');
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    };

    return {
      sleepQuality: Math.round(avg('sleepQuality') * 10) / 10,
      mood: Math.round(avg('mood') * 10) / 10,
      energy: Math.round(avg('energy') * 10) / 10,
      stress: Math.round(avg('stress') * 10) / 10,
      days: recent.length,
    };
  }, [checkins]);

  // Date navigation
  const navigateDate = (offset: number) => {
    setSelectedDate(shiftDays(selectedDate, offset));
  };

  const handleSave = () => {
    const data: UpsertCheckin = {
      bedTime: bedTime || null,
      wakeTime: wakeTime || null,
      napMinutes: napMinutes ? parseInt(napMinutes, 10) : undefined,
      sleepQuality: sleepQuality,
      mood: mood,
      energy: energy,
      stress: stress,
      note: note || null,
    };
    upsertMut.mutate({ date: selectedDate, data });
  };

  const isSaved = currentCheckin !== null;

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Daily Check-In
          </h1>
          <p className="text-sm text-muted-foreground">
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
        <span className="text-sm font-medium text-foreground">Select Date</span>
        <button
          onClick={() => navigateDate(1)}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-3 h-4 w-32" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <>
          {/* Form */}
          <div className="space-y-4">
            {/* Sleep Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Moon className="h-4 w-4 text-indigo-500" />
                  Sleep
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="bed-time" className="flex items-center gap-1.5">
                      <CloudMoon className="h-3 w-3 text-indigo-400" />
                      Bed Time
                    </Label>
                    <Input
                      id="bed-time"
                      type="time"
                      value={bedTime}
                      onChange={(e) => setBedTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="wake-time" className="flex items-center gap-1.5">
                      <Sun className="h-3 w-3 text-amber-500" />
                      Wake Time
                    </Label>
                    <Input
                      id="wake-time"
                      type="time"
                      value={wakeTime}
                      onChange={(e) => setWakeTime(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="nap">Nap (minutes)</Label>
                    <Input
                      id="nap"
                      type="number"
                      min={0}
                      value={napMinutes}
                      onChange={(e) => setNapMinutes(e.target.value)}
                      placeholder="0"
                    />
                  </div>
                </div>

                {/* Sleep Quality */}
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5">
                    <Moon className="h-3 w-3 text-indigo-400" />
                    Sleep Quality
                  </Label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((v) => (
                      <button
                        key={v}
                        onClick={() => setSleepQuality(v)}
                        className={cn(
                          'h-9 w-9 rounded-lg border text-sm font-medium transition-all',
                          sleepQuality === v
                            ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                            : 'border-border hover:border-indigo-300 hover:bg-indigo-50',
                        )}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Wellness Section */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <Brain className="h-4 w-4 text-violet-500" />
                  Wellness
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <RatingSlider
                  label="Mood"
                  icon={<Brain className="h-3.5 w-3.5 text-violet-400" />}
                  value={mood}
                  onChange={setMood}
                  min={1}
                  max={10}
                  lowLabel="Low"
                  highLabel="Great"
                />
                <RatingSlider
                  label="Energy"
                  icon={<Zap className="h-3.5 w-3.5 text-amber-400" />}
                  value={energy}
                  onChange={setEnergy}
                  min={1}
                  max={10}
                  lowLabel="Drained"
                  highLabel="Electric"
                />
                <RatingSlider
                  label="Stress"
                  icon={<Wind className="h-3.5 w-3.5 text-rose-400" />}
                  value={stress}
                  onChange={setStress}
                  min={1}
                  max={10}
                  lowLabel="Calm"
                  highLabel="Overwhelmed"
                  invert
                />
              </CardContent>
            </Card>

            {/* Note */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Note</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="How are you feeling today?"
                  rows={3}
                />
              </CardContent>
            </Card>

            {/* Save */}
            <div className="flex justify-end">
              <Button onClick={handleSave} disabled={upsertMut.isPending}>
                <Save className="mr-1.5 h-4 w-4" />
                {upsertMut.isPending
                  ? 'Saving...'
                  : isSaved
                    ? 'Update Check-In'
                    : 'Save Check-In'}
              </Button>
            </div>
          </div>

          {/* 7-Day Rolling Averages */}
          {rollingAvg && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-sm">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  7-Day Rolling Averages
                  <span className="text-xs font-normal text-muted-foreground">
                    ({rollingAvg.days} days)
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  <AvgStat label="Sleep Quality" value={rollingAvg.sleepQuality} max={5} color="indigo" />
                  <AvgStat label="Mood" value={rollingAvg.mood} max={10} color="violet" />
                  <AvgStat label="Energy" value={rollingAvg.energy} max={10} color="amber" />
                  <AvgStat label="Stress" value={rollingAvg.stress} max={10} color="rose" />
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Rating Slider ────────────────────────────────────────────────────────────

interface RatingSliderProps {
  label: string;
  icon: React.ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  min: number;
  max: number;
  lowLabel: string;
  highLabel: string;
  invert?: boolean;
}

function RatingSlider({
  label,
  icon,
  value,
  onChange,
  min,
  max,
  lowLabel,
  highLabel,
  invert,
}: RatingSliderProps) {
  const range = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  const getColor = (v: number) => {
    const ratio = (v - min) / (max - min);
    if (invert) {
      if (ratio < 0.3) return 'border-emerald-500 bg-emerald-500 text-white';
      if (ratio < 0.6) return 'border-amber-500 bg-amber-500 text-white';
      return 'border-red-500 bg-red-500 text-white';
    }
    if (ratio < 0.3) return 'border-red-500 bg-red-500 text-white';
    if (ratio < 0.6) return 'border-amber-500 bg-amber-500 text-white';
    return 'border-emerald-500 bg-emerald-500 text-white';
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1.5">
          {icon}
          {label}
        </Label>
        {value !== null && (
          <span className="text-sm font-semibold text-foreground">
            {value}/{max}
          </span>
        )}
      </div>
      <div className="flex gap-1.5">
        {range.map((v) => (
          <button
            key={v}
            onClick={() => onChange(v === value ? null : v)}
            className={cn(
              'h-8 flex-1 rounded-md border text-xs font-medium transition-all',
              value === v
                ? getColor(v)
                : 'border-border hover:border-primary/30 hover:bg-muted',
            )}
          >
            {v}
          </button>
        ))}
      </div>
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{lowLabel}</span>
        <span>{highLabel}</span>
      </div>
    </div>
  );
}

// ─── Avg Stat Card ────────────────────────────────────────────────────────────

interface AvgStatProps {
  label: string;
  value: number;
  max: number;
  color: string;
}

function AvgStat({ label, value, max, color }: AvgStatProps) {
  const pct = (value / max) * 100;
  const colorMap: Record<string, string> = {
    indigo: 'bg-indigo-500',
    violet: 'bg-violet-500',
    amber: 'bg-amber-500',
    rose: 'bg-rose-500',
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">{label}</span>
        <span className="text-sm font-semibold text-foreground">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', colorMap[color] ?? 'bg-primary')}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
