import { BodyMetricEntry } from '../context/BodyMetricsContext';
import { CompletedWorkout } from '../context/WorkoutContext';

// ─── Types ────────────────────────────────────────────────────────────────────

export type InsightSeverity = 'positive' | 'warning' | 'info';

export type Insight = {
  id: string;
  severity: InsightSeverity;
  title: string;
  message: string;
  basis: string;
};

export type StrengthLevel = 'beginner' | 'intermediate' | 'advanced' | 'elite';

export type StrengthBenchmark = {
  exerciseId: string;
  exerciseName: string;
  estimated1RM: number;
  ratio: number;
  level: StrengthLevel;
  nextLevelLabel: string;
  nextTargetRatio: number;
  nextTargetKg: number;
};

export type ChartPoint = { x: string; y: number };

// ─── Strength standards (bodyweight multiples) ────────────────────────────────
// Source: ExRx.net / Strength Level research / general S&C literature.
// These are estimates — not medical claims. Ranges vary by training age and genetics.

const STANDARDS: Record<string, Record<StrengthLevel, number>> = {
  'bench-press':       { beginner: 0.5,  intermediate: 0.75, advanced: 1.25, elite: 1.5  },
  'incline-db-press':  { beginner: 0.3,  intermediate: 0.5,  advanced: 0.8,  elite: 1.0  },
  'back-squat':        { beginner: 0.75, intermediate: 1.0,  advanced: 1.5,  elite: 2.0  },
  'romanian-deadlift': { beginner: 0.5,  intermediate: 0.75, advanced: 1.25, elite: 1.75 },
  'overhead-press':    { beginner: 0.35, intermediate: 0.5,  advanced: 0.75, elite: 1.0  },
  'barbell-row':       { beginner: 0.5,  intermediate: 0.75, advanced: 1.25, elite: 1.5  },
  'leg-press':         { beginner: 1.0,  intermediate: 1.5,  advanced: 2.0,  elite: 2.75 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Epley formula for estimated 1-rep max
function epley1RM(weight: number, reps: number): number {
  if (reps <= 1) return weight;
  return Math.round(weight * (1 + reps / 30));
}

function getStrengthLevel(ratio: number, std: Record<StrengthLevel, number>): StrengthLevel {
  if (ratio >= std.elite) return 'elite';
  if (ratio >= std.advanced) return 'advanced';
  if (ratio >= std.intermediate) return 'intermediate';
  return 'beginner';
}

function nextStrengthLevel(level: StrengthLevel): StrengthLevel {
  const map: Record<StrengthLevel, StrengthLevel> = {
    beginner: 'intermediate',
    intermediate: 'advanced',
    advanced: 'elite',
    elite: 'elite',
  };
  return map[level];
}

// Monday-anchored week start as YYYY-MM-DD
function weekStart(date: Date): string {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

function daysSince(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function getStartOfWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
  d.setHours(0, 0, 0, 0);
  return d;
}

type ExerciseSession = {
  date: string;
  name: string;
  maxWeight: number;
  maxReps: number;
  totalVolume: number;
};

// Build per-exercise history from all completed workouts (chronological, oldest first)
function buildExerciseHistory(workouts: CompletedWorkout[]): Map<string, ExerciseSession[]> {
  const map = new Map<string, ExerciseSession[]>();
  for (const workout of [...workouts].reverse()) {
    for (const ex of workout.exercises) {
      const done = ex.sets.filter((s) => s.done);
      const source = done.length > 0 ? done : ex.sets;
      const weights = source.map((s) => Number(s.weight)).filter((n) => n > 0 && Number.isFinite(n));
      if (weights.length === 0) continue;
      const reps = source.map((s) => Number(s.reps)).filter((n) => n > 0 && Number.isFinite(n));
      const vol = source.reduce((sum, s) => {
        const w = Number(s.weight);
        const r = Number(s.reps);
        return Number.isFinite(w) && Number.isFinite(r) ? sum + w * r : sum;
      }, 0);
      if (!map.has(ex.id)) map.set(ex.id, []);
      map.get(ex.id)!.push({
        date: workout.finishedAt,
        name: ex.name,
        maxWeight: Math.max(...weights),
        maxReps: reps.length > 0 ? Math.max(...reps) : 0,
        totalVolume: vol,
      });
    }
  }
  return map;
}

// ─── Insight generators ───────────────────────────────────────────────────────

function plateauInsights(history: Map<string, ExerciseSession[]>): Insight[] {
  const out: Insight[] = [];
  history.forEach((sessions, id) => {
    if (sessions.length < 3) return;
    const last3 = sessions.slice(-3);
    const weights = last3.map((s) => s.maxWeight);
    if (new Set(weights).size === 1) {
      out.push({
        id: `plateau-${id}`,
        severity: 'warning',
        title: `${last3[0].name} plateau`,
        message: `${last3[0].name} has been stuck at ${weights[0]}kg for 3 consecutive sessions. Push reps to the top of your range (10–12) before increasing load.`,
        basis: 'Progressive overload: when load stalls for 3+ sessions, rep-range optimisation should precede weight increases (Schoenfeld 2010).',
      });
    }
  });
  return out;
}

function progressiveOverloadInsights(history: Map<string, ExerciseSession[]>): Insight[] {
  const out: Insight[] = [];
  history.forEach((sessions, id) => {
    if (sessions.length < 2) return;
    const last = sessions[sessions.length - 1];
    const prev = sessions[sessions.length - 2];
    if (last.maxWeight > prev.maxWeight) {
      out.push({
        id: `overload-${id}`,
        severity: 'positive',
        title: `${last.name} progressing`,
        message: `${last.name} increased from ${prev.maxWeight}kg to ${last.maxWeight}kg. Positive progressive overload — keep it up.`,
        basis: 'Mechanical tension from progressive load increase is a primary driver of strength and muscle adaptation.',
      });
    }
  });
  return out;
}

function volumeTrendInsight(workouts: CompletedWorkout[]): Insight | null {
  const weekVol = new Map<string, number>();
  for (const w of workouts) {
    const wk = weekStart(new Date(w.finishedAt));
    let vol = 0;
    for (const ex of w.exercises) {
      const done = ex.sets.filter((s) => s.done);
      const source = done.length > 0 ? done : ex.sets;
      for (const s of source) {
        const wt = Number(s.weight);
        const r = Number(s.reps);
        if (Number.isFinite(wt) && Number.isFinite(r)) vol += wt * r;
      }
    }
    weekVol.set(wk, (weekVol.get(wk) ?? 0) + vol);
  }

  const weeks = Array.from(weekVol.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  if (weeks.length < 2) return null;
  const thisWeek = weeks[weeks.length - 1][1];
  const lastWeek = weeks[weeks.length - 2][1];
  if (lastWeek === 0) return null;

  const pct = Math.round(((thisWeek - lastWeek) / lastWeek) * 100);

  if (pct >= 5) {
    const tooMuch = pct > 20;
    return {
      id: 'volume-up',
      severity: tooMuch ? 'warning' : 'positive',
      title: tooMuch ? 'Volume spike — monitor recovery' : 'Volume increasing',
      message: tooMuch
        ? `Training volume jumped ${pct}% vs last week. Exceeding 20% weekly volume increases raises injury risk. Consider scaling back slightly.`
        : `Total training volume is up ${pct}% vs last week — within the recommended 5–20% progressive overload range.`,
      basis: 'Volume management: incremental 5–20% weekly increases optimise adaptation while limiting overuse injury (Schoenfeld 2010).',
    };
  }

  if (pct <= -20) {
    return {
      id: 'volume-down',
      severity: 'info',
      title: 'Volume dropped this week',
      message: `Training volume is down ${Math.abs(pct)}% vs last week. If intentional (deload), this supports recovery. Otherwise, consider fitting in another session.`,
      basis: 'Planned deloads every 4–8 weeks reduce accumulated fatigue and restore performance capacity.',
    };
  }

  return null;
}

function muscleNeglectInsights(workouts: CompletedWorkout[]): Insight[] {
  const muscleLastSeen = new Map<string, number>();
  for (const w of workouts) {
    const days = daysSince(w.finishedAt);
    for (const ex of w.exercises) {
      const current = muscleLastSeen.get(ex.muscle) ?? Infinity;
      if (days < current) muscleLastSeen.set(ex.muscle, days);
    }
  }
  const out: Insight[] = [];
  muscleLastSeen.forEach((days, muscle) => {
    if (days > 7) {
      out.push({
        id: `neglect-${muscle}`,
        severity: 'info',
        title: `${muscle} undertrained`,
        message: `${muscle} hasn't been trained in ${days} days. Training each muscle 2× per week is associated with superior hypertrophy compared to once per week.`,
        basis: 'Frequency meta-analysis (Ralston et al. 2017, Schoenfeld et al. 2016): 2×/week per muscle outperforms 1×/week for hypertrophy.',
      });
    }
  });
  return out;
}

function performanceDropInsights(history: Map<string, ExerciseSession[]>): Insight[] {
  const out: Insight[] = [];
  history.forEach((sessions, id) => {
    if (sessions.length < 3) return;
    const last3 = sessions.slice(-3);
    const sameWeight = new Set(last3.map((s) => s.maxWeight)).size === 1;
    const allDeclining = last3.every((s, i) => i === 0 || s.maxReps < last3[i - 1].maxReps);
    if (sameWeight && allDeclining) {
      out.push({
        id: `perf-drop-${id}`,
        severity: 'warning',
        title: `${last3[0].name} performance declining`,
        message: `${last3[0].name} reps have dropped across 3 consecutive sessions at ${last3[0].maxWeight}kg. Accumulated fatigue may be limiting output. Consider a deload or rest day.`,
        basis: 'Repeated performance decline at constant load is an overreaching signal. A 1-week deload at 40–50% volume restores capacity (Fry & Kraemer 1997).',
      });
    }
  });
  return out;
}

function frequencyInsight(workouts: CompletedWorkout[]): Insight | null {
  if (workouts.length < 5) return null;
  const startOfThisWeek = getStartOfWeek(new Date());
  const thisWeekCount = workouts.filter((w) => new Date(w.finishedAt) >= startOfThisWeek).length;

  const weekCounts = new Map<string, number>();
  for (const w of workouts) {
    const wk = weekStart(new Date(w.finishedAt));
    weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
  }
  const counts = Array.from(weekCounts.values());
  const avg = counts.reduce((a, b) => a + b, 0) / counts.length;

  if (thisWeekCount < avg - 1 && avg >= 3) {
    return {
      id: 'freq-low',
      severity: 'info',
      title: 'Frequency dropped this week',
      message: `You average ${avg.toFixed(1)} sessions/week but have only completed ${thisWeekCount} this week. Training frequency consistency is among the strongest predictors of long-term progress.`,
      basis: 'Consistency in training frequency is critical for adaptation (Kraemer & Ratamess 2004).',
    };
  }
  return null;
}

const MAX_INSIGHTS = 6;

// ─── Public API ───────────────────────────────────────────────────────────────

export function analyzeProgress(
  completedWorkouts: CompletedWorkout[],
  _latestBodyMetric: BodyMetricEntry | null
): Insight[] {
  if (completedWorkouts.length === 0) return [];

  const history = buildExerciseHistory(completedWorkouts);
  const insights: Insight[] = [];

  // Positive first → warnings → info
  insights.push(...progressiveOverloadInsights(history));
  const vol = volumeTrendInsight(completedWorkouts);
  if (vol && vol.severity === 'positive') insights.push(vol);
  insights.push(...plateauInsights(history));
  insights.push(...performanceDropInsights(history));
  if (vol && vol.severity !== 'positive') insights.push(vol);
  const freq = frequencyInsight(completedWorkouts);
  if (freq) insights.push(freq);
  insights.push(...muscleNeglectInsights(completedWorkouts));

  return insights.slice(0, MAX_INSIGHTS);
}

export function getStrengthBenchmarks(
  completedWorkouts: CompletedWorkout[],
  bodyweightKg: number
): StrengthBenchmark[] {
  const history = buildExerciseHistory(completedWorkouts);
  const out: StrengthBenchmark[] = [];

  history.forEach((sessions, id) => {
    const std = STANDARDS[id];
    if (!std) return;

    const best = sessions.reduce(
      (max, s) => {
        const rm = epley1RM(s.maxWeight, s.maxReps);
        return rm > max.rm ? { rm, name: s.name } : max;
      },
      { rm: 0, name: sessions[0].name }
    );
    if (best.rm === 0) return;

    const ratio = Math.round((best.rm / bodyweightKg) * 100) / 100;
    const level = getStrengthLevel(ratio, std);
    const next = nextStrengthLevel(level);
    const nextTargetRatio = std[next];
    const nextTargetKg = Math.round((nextTargetRatio * bodyweightKg) / 2.5) * 2.5;

    const levelLabels: Record<StrengthLevel, string> = {
      beginner: 'Intermediate',
      intermediate: 'Advanced',
      advanced: 'Elite',
      elite: 'Elite',
    };

    out.push({
      exerciseId: id,
      exerciseName: best.name,
      estimated1RM: best.rm,
      ratio,
      level,
      nextLevelLabel: levelLabels[level],
      nextTargetRatio,
      nextTargetKg,
    });
  });

  return out;
}

// ─── Chart data ───────────────────────────────────────────────────────────────

export function weeklyVolumeChartData(workouts: CompletedWorkout[]): ChartPoint[] {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const wk = weekStart(new Date(w.finishedAt));
    let vol = 0;
    for (const ex of w.exercises) {
      const done = ex.sets.filter((s) => s.done);
      const source = done.length > 0 ? done : ex.sets;
      for (const s of source) {
        const wt = Number(s.weight);
        const r = Number(s.reps);
        if (Number.isFinite(wt) && Number.isFinite(r)) vol += wt * r;
      }
    }
    map.set(wk, (map.get(wk) ?? 0) + vol);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([wk, vol]) => ({ x: wk.slice(5), y: Math.round(vol) }));
}

export function weeklyFrequencyChartData(workouts: CompletedWorkout[]): ChartPoint[] {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const wk = weekStart(new Date(w.finishedAt));
    map.set(wk, (map.get(wk) ?? 0) + 1);
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-8)
    .map(([wk, count]) => ({ x: wk.slice(5), y: count }));
}

export function bodyweightChartData(entries: BodyMetricEntry[]): ChartPoint[] {
  return [...entries]
    .filter((e) => e.weight !== null)
    .reverse()
    .slice(-12)
    .map((e) => ({
      x: new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      y: e.weight as number,
    }));
}

export function bodyFatChartData(entries: BodyMetricEntry[]): ChartPoint[] {
  return [...entries]
    .filter((e) => e.bodyFat !== null)
    .reverse()
    .slice(-12)
    .map((e) => ({
      x: new Date(e.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
      y: e.bodyFat as number,
    }));
}

export function exerciseStrengthChartData(
  workouts: CompletedWorkout[],
  exerciseId: string
): ChartPoint[] {
  const history = buildExerciseHistory(workouts);
  return (history.get(exerciseId) ?? []).slice(-10).map((s) => ({
    x: new Date(s.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    y: epley1RM(s.maxWeight, s.maxReps),
  }));
}

export function getTopExercisesByVolume(
  workouts: CompletedWorkout[],
  limit = 5
): Array<{ id: string; name: string }> {
  const history = buildExerciseHistory(workouts);
  return Array.from(history.entries())
    .map(([id, sessions]) => ({
      id,
      name: sessions[0].name,
      vol: sessions.reduce((s, e) => s + e.totalVolume, 0),
    }))
    .sort((a, b) => b.vol - a.vol)
    .slice(0, limit)
    .map(({ id, name }) => ({ id, name }));
}
