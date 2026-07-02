import { Template } from '../context/TemplateContext';
import { CompletedWorkout } from '../context/WorkoutContext';

export type Suggestion = {
  id: string;
  message: string;
};

// Typical loading increments by equipment. Suggested weights are snapped to
// this grid so the app never proposes a weight that doesn't exist in a gym
// (no "try 26.25kg"). Anything unknown falls back to 2.5kg plates.
const WEIGHT_STEP: Record<string, number> = {
  Barbell: 2.5,
  'EZ-Bar': 2.5,
  'Smith Machine': 2.5,
  Dumbbell: 2.5,
  Cable: 2.5,
  Machine: 5,
  Kettlebell: 4,
};

// Equipment that progresses by reps, not load.
const REP_BASED = new Set(['Bodyweight', 'Band']);

// Big lower-body barbell lifts tolerate larger jumps (NSCA: ~2.5kg upper,
// ~5kg lower body).
const LOWER_BODY = new Set(['Quads', 'Hamstrings', 'Glutes', 'Lower Back', 'Hip Adductors']);

function stepFor(equipment: string, muscle: string): number | null {
  if (REP_BASED.has(equipment)) return null;
  const base = WEIGHT_STEP[equipment] ?? 2.5;
  if (equipment === 'Barbell' && LOWER_BODY.has(muscle)) return 5;
  return base;
}

function fmtKg(w: number): string {
  return `${Number.isInteger(w) ? w : parseFloat(w.toFixed(2))}kg`;
}

// Next real, loadable weight above the current one.
function nextWeight(current: number, step: number): number {
  let next = Math.round((current + step) / step) * step;
  if (next <= current) next += step;
  return next;
}

type SetLike = { weight: string; reps: string; done: boolean };

type TopSet = { weight: number; reps: number };

// The heaviest set actually performed (done sets preferred). This is a weight
// the lifter demonstrably has access to — unlike an average.
function topSetOf(sets: SetLike[]): TopSet | null {
  const done = sets.filter((s) => s.done);
  const source = done.length > 0 ? done : sets;

  let best: TopSet | null = null;
  for (const s of source) {
    const w = Number(s.weight);
    if (!Number.isFinite(w) || w <= 0) continue;
    const r = Number(s.reps);
    const reps = Number.isFinite(r) && r > 0 ? r : 0;
    if (!best || w > best.weight || (w === best.weight && reps > best.reps)) {
      best = { weight: w, reps };
    }
  }
  return best;
}

// Best rep count for bodyweight-style movements.
function bestRepsOf(sets: SetLike[]): number | null {
  const done = sets.filter((s) => s.done);
  const source = done.length > 0 ? done : sets;
  const reps = source
    .map((s) => Number(s.reps))
    .filter((n) => Number.isFinite(n) && n > 0);
  return reps.length > 0 ? Math.max(...reps) : null;
}

function daysSince(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 86_400_000);
}

export function generateSuggestions(
  template: Template,
  completedWorkouts: CompletedWorkout[]
): Suggestion[] {
  const suggestions: Suggestion[] = [];
  const runs = completedWorkouts.filter((w) => w.templateId === template.id);
  const lastRun = runs[0] ?? null;
  const prevRun = runs[1] ?? null;

  for (const exercise of template.exercises) {
    if (!lastRun) break;

    const lastEx = lastRun.exercises.find((e) => e.id === exercise.id);
    if (!lastEx || lastEx.sets.length === 0) continue;

    const step = stepFor(exercise.equipment, exercise.muscle);

    // Rep-based movements (bodyweight, bands): progress by adding reps.
    if (step === null) {
      const best = bestRepsOf(lastEx.sets);
      if (best !== null) {
        suggestions.push({
          id: `reps-${exercise.id}`,
          message: `${exercise.name}: you got ${best} reps last time. Aim for ${best + 1} today.`,
        });
      }
      continue;
    }

    const top = topSetOf(lastEx.sets);
    if (!top) continue;

    // Reps fell noticeably at the same top weight vs the run before → rebuild first.
    const prevEx = prevRun?.exercises.find((e) => e.id === exercise.id) ?? null;
    const prevTop = prevEx ? topSetOf(prevEx.sets) : null;
    if (
      prevTop &&
      prevTop.weight === top.weight &&
      top.reps > 0 &&
      top.reps <= prevTop.reps - 2
    ) {
      suggestions.push({
        id: `rep-drop-${exercise.id}`,
        message: `${exercise.name}: reps dropped (${prevTop.reps}→${top.reps}) at ${fmtKg(top.weight)}. Stay at ${fmtKg(top.weight)} and build the reps back up.`,
      });
      continue;
    }

    if (top.reps >= 10) {
      // NSCA "2-for-2": earn the load increase by hitting the top of the rep
      // range in two consecutive sessions at the same weight. If the previous
      // session was at this weight but below the top, ask for one confirmation
      // session before loading up.
      const confirmed =
        !prevTop || prevTop.weight !== top.weight || prevTop.reps >= 10;

      if (confirmed) {
        const next = nextWeight(top.weight, step);
        suggestions.push({
          id: `increase-${exercise.id}`,
          message: `${exercise.name}: ${fmtKg(top.weight)} × ${top.reps} last time — you've earned it, load ${fmtKg(next)} today.`,
        });
      } else {
        suggestions.push({
          id: `confirm-${exercise.id}`,
          message: `${exercise.name}: strong session at ${fmtKg(top.weight)} × ${top.reps}. Repeat it once more to lock it in, then move up.`,
        });
      }
    } else if (top.reps > 0) {
      // Inside the range → same weight, chase one more rep (double progression).
      suggestions.push({
        id: `match-${exercise.id}`,
        message: `${exercise.name}: ${fmtKg(top.weight)} × ${top.reps} last time. Same weight, go for ${top.reps + 1}.`,
      });
    } else {
      suggestions.push({
        id: `match-${exercise.id}`,
        message: `${exercise.name}: you worked at ${fmtKg(top.weight)} last time. Match it and log your reps.`,
      });
    }
  }

  // Skipped muscle groups: in this template but not trained in the past 7 days
  const templateMuscles = new Set(template.exercises.map((e) => e.muscle));
  const recentMuscles = new Set(
    completedWorkouts
      .filter((w) => daysSince(w.finishedAt) <= 7)
      .flatMap((w) => w.exercises.map((e) => e.muscle))
  );

  for (const muscle of templateMuscles) {
    if (!recentMuscles.has(muscle)) {
      suggestions.push({
        id: `skipped-${muscle}`,
        message: `You haven't trained ${muscle} in over a week. Good timing — this session covers it.`,
      });
    }
  }

  return suggestions;
}
