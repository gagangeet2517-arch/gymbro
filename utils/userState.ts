import { BodyMetricEntry } from '../context/BodyMetricsContext';
import { MealEntry } from '../context/NutritionContext';
import { CompletedWorkout } from '../context/WorkoutContext';
import { analyzeProgress, Insight } from './analytics';
import { toDateKey } from './dateHelpers';

const WINDOW_DAYS = 7;

export type DayFoodTotals = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

export type RollingUserState = {
  windowDays: number;
  daysWithMealsLogged: number;
  daysWithWorkout: number;

  avgCaloriesAll: number | null;
  avgProteinAll: number | null;
  avgProteinTrainingDays: number | null;
  avgProteinRestDays: number | null;

  totalVolume7d: number;
  workoutCount7d: number;
  avgSessionMinutes: number | null;

  bodyweightStart: number | null;
  bodyweightLatest: number | null;
  bodyweightDeltaKg: number | null;

  targetCalories: number;
  targetProtein: number;
  avgCalorieDeficitVsTarget: number | null; // positive = under target (deficit), negative = over

  // Deterministic cross-reference flags — computed locally so the LLM
  // narrates real findings instead of inventing plausible-sounding ones.
  flags: string[];

  // Pre-computed training insights (plateau/overload/volume/frequency),
  // reused verbatim so the coach can reference them instead of re-deriving.
  trainingInsights: Insight[];
};

function volumeOf(workout: CompletedWorkout): number {
  if (typeof workout.totalVolume === 'number') return workout.totalVolume;
  // Older records predate the totalVolume field — compute from sets.
  let total = 0;
  for (const ex of workout.exercises) {
    for (const set of ex.sets) {
      if (!set.done) continue;
      const w = Number(set.weight);
      const r = Number(set.reps);
      if (Number.isFinite(w) && Number.isFinite(r)) total += w * r;
    }
  }
  return total;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((s, n) => s + n, 0) / values.length;
}

/**
 * Builds a rolling 7-day snapshot of nutrition, training, and bodyweight,
 * plus deterministic cross-reference flags. This is the object sent as
 * context with AI feedback calls, and the local rule engine is the source
 * of truth for "what happened" — the LLM's job is only to phrase it.
 */
export function buildRollingUserState(
  meals: MealEntry[],
  workouts: CompletedWorkout[],
  bodyEntries: BodyMetricEntry[],
  targetCalories: number,
  targetProtein: number
): RollingUserState {
  const recentMeals = meals.filter((m) => daysAgo(m.loggedAt) < WINDOW_DAYS);
  const recentWorkouts = workouts.filter((w) => daysAgo(w.finishedAt) < WINDOW_DAYS);
  const recentBody = bodyEntries.filter((e) => daysAgo(e.date) < WINDOW_DAYS);

  const mealsByDay = new Map<string, DayFoodTotals>();
  for (const m of recentMeals) {
    const key = toDateKey(m.loggedAt);
    const cur = mealsByDay.get(key) ?? { calories: 0, protein: 0, carbs: 0, fat: 0 };
    cur.calories += m.calories;
    cur.protein += m.protein;
    cur.carbs += m.carbs;
    cur.fat += m.fat;
    mealsByDay.set(key, cur);
  }

  const trainingDayKeys = new Set(recentWorkouts.map((w) => toDateKey(w.finishedAt)));

  const allDayTotals = Array.from(mealsByDay.values());
  const trainingDayTotals = Array.from(mealsByDay.entries())
    .filter(([k]) => trainingDayKeys.has(k))
    .map(([, v]) => v);
  const restDayTotals = Array.from(mealsByDay.entries())
    .filter(([k]) => !trainingDayKeys.has(k))
    .map(([, v]) => v);

  const avgCaloriesAll = avg(allDayTotals.map((d) => d.calories));
  const avgProteinAll = avg(allDayTotals.map((d) => d.protein));
  const avgProteinTrainingDays = avg(trainingDayTotals.map((d) => d.protein));
  const avgProteinRestDays = avg(restDayTotals.map((d) => d.protein));

  const totalVolume7d = recentWorkouts.reduce((s, w) => s + volumeOf(w), 0);
  const avgSessionMinutes = avg(
    recentWorkouts.map((w) => w.durationMin).filter((n): n is number => typeof n === 'number')
  );

  const bodySorted = [...recentBody].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
  );
  const bodyWeighted = bodySorted.filter((e) => e.weight !== null);
  const bodyweightStart = bodyWeighted[0]?.weight ?? null;
  const bodyweightLatest = bodyWeighted[bodyWeighted.length - 1]?.weight ?? null;
  const bodyweightDeltaKg =
    bodyweightStart !== null && bodyweightLatest !== null
      ? Math.round((bodyweightLatest - bodyweightStart) * 10) / 10
      : null;

  const avgCalorieDeficitVsTarget =
    avgCaloriesAll !== null ? Math.round(targetCalories - avgCaloriesAll) : null;

  // Full history, not just the 7-day window — plateau/frequency detection
  // needs multiple past sessions per exercise, which can span more than a week.
  const trainingInsights = analyzeProgress(workouts, null);

  // ── Deterministic cross-reference flags ─────────────────────────────────
  const flags: string[] = [];

  if (
    avgProteinTrainingDays !== null &&
    avgProteinTrainingDays < targetProtein * 0.85 &&
    trainingDayTotals.length > 0
  ) {
    flags.push(
      `Protein on training days is averaging ${Math.round(avgProteinTrainingDays)}g, below the ${Math.round(targetProtein * 0.85)}g (85% of target) threshold — recovery may be under-fueled.`
    );
  }

  if (
    avgProteinRestDays !== null &&
    avgProteinTrainingDays !== null &&
    avgProteinRestDays > avgProteinTrainingDays + 15
  ) {
    flags.push(
      `Protein is notably lower on training days (${Math.round(avgProteinTrainingDays)}g) than rest days (${Math.round(avgProteinRestDays)}g) — usually the opposite is better for recovery.`
    );
  }

  const stalledOrDeclining = trainingInsights.filter(
    (i) => i.id.startsWith('plateau-') || i.id.startsWith('perf-drop-')
  );
  if (stalledOrDeclining.length > 0 && avgCalorieDeficitVsTarget !== null && avgCalorieDeficitVsTarget > 300) {
    flags.push(
      `${stalledOrDeclining.length} lift(s) are stalled or declining while running a ${avgCalorieDeficitVsTarget} kcal/day average deficit — the deficit may be too aggressive to support strength progress right now.`
    );
  }

  const volumeDrop = trainingInsights.find((i) => i.id === 'volume-down');
  if (volumeDrop && bodyweightDeltaKg !== null && bodyweightDeltaKg > 0.3) {
    flags.push(
      `Training volume dropped this week while bodyweight is up ${bodyweightDeltaKg}kg over the period — check whether this is a planned deload or under-recovery creeping in.`
    );
  }

  if (recentWorkouts.length >= 3 && mealsByDay.size > 0) {
    const loggedTrainingDays = trainingDayTotals.length;
    if (loggedTrainingDays < recentWorkouts.length * 0.5) {
      flags.push(
        `Meals are only logged for ${loggedTrainingDays} of ${recentWorkouts.length} training days this week — nutrition feedback is working from partial data.`
      );
    }
  }

  return {
    windowDays: WINDOW_DAYS,
    daysWithMealsLogged: mealsByDay.size,
    daysWithWorkout: trainingDayKeys.size,
    avgCaloriesAll,
    avgProteinAll,
    avgProteinTrainingDays,
    avgProteinRestDays,
    totalVolume7d: Math.round(totalVolume7d),
    workoutCount7d: recentWorkouts.length,
    avgSessionMinutes,
    bodyweightStart,
    bodyweightLatest,
    bodyweightDeltaKg,
    targetCalories,
    targetProtein,
    avgCalorieDeficitVsTarget,
    flags,
    trainingInsights,
  };
}

/** Compact plain-text rendering of the state for a Gemini prompt — kept short to bound tokens. */
export function summarizeForPrompt(state: RollingUserState): string {
  const lines: string[] = [];
  lines.push(
    `Last ${state.windowDays} days: ${state.daysWithMealsLogged} day(s) with meals logged, ${state.workoutCount7d} workout(s).`
  );
  if (state.avgCaloriesAll !== null) {
    lines.push(
      `Avg intake: ${Math.round(state.avgCaloriesAll)} kcal/day (target ${state.targetCalories}), ${Math.round(state.avgProteinAll ?? 0)}g protein/day (target ${state.targetProtein}g).`
    );
  }
  if (state.avgProteinTrainingDays !== null || state.avgProteinRestDays !== null) {
    lines.push(
      `Protein — training days: ${state.avgProteinTrainingDays !== null ? Math.round(state.avgProteinTrainingDays) + 'g' : 'no data'}, rest days: ${state.avgProteinRestDays !== null ? Math.round(state.avgProteinRestDays) + 'g' : 'no data'}.`
    );
  }
  lines.push(`Training volume this week: ${state.totalVolume7d}kg total across ${state.workoutCount7d} sessions.`);
  if (state.bodyweightDeltaKg !== null) {
    lines.push(`Bodyweight change over window: ${state.bodyweightDeltaKg > 0 ? '+' : ''}${state.bodyweightDeltaKg}kg.`);
  }
  if (state.flags.length > 0) {
    lines.push('Flags detected by the app (state these plainly, do not contradict them):');
    for (const f of state.flags) lines.push(`- ${f}`);
  }
  return lines.join('\n');
}
