import { Template } from '../context/TemplateContext';
import { CompletedWorkout } from '../context/WorkoutContext';

export type Suggestion = {
  id: string;
  message: string;
};

function avg(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, n) => sum + n, 0) / values.length;
}

function parseSets(sets: { weight: string; reps: string; done: boolean }[]) {
  const doneSets = sets.filter((s) => s.done);
  const source = doneSets.length > 0 ? doneSets : sets;
  const weights = source
    .map((s) => Number(s.weight))
    .filter((n) => Number.isFinite(n) && n > 0);
  const reps = source
    .map((s) => Number(s.reps))
    .filter((n) => Number.isFinite(n) && n > 0);
  return { avgWeight: avg(weights), avgReps: avg(reps) };
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

    const last = parseSets(lastEx.sets);
    if (last.avgWeight === null || last.avgReps === null) continue;

    const weight = Math.round(last.avgWeight * 10) / 10;
    const reps = Math.round(last.avgReps);

    const prevEx = prevRun?.exercises.find((e) => e.id === exercise.id) ?? null;
    const prev = prevEx ? parseSets(prevEx.sets) : null;

    if (prev !== null && prev.avgReps !== null) {
      const prevReps = Math.round(prev.avgReps);
      if (reps <= prevReps - 2) {
        suggestions.push({
          id: `rep-drop-${exercise.id}`,
          message: `Your ${exercise.name} reps dropped (${prevReps}→${reps} reps). Keep ${weight}kg today.`,
        });
        continue;
      }
    }

    if (reps >= 10) {
      const next = Math.round((weight + 2.5) * 10) / 10;
      suggestions.push({
        id: `increase-${exercise.id}`,
        message: `You hit ${reps} reps at ${weight}kg last time. Try ${next}kg today.`,
      });
    } else {
      suggestions.push({
        id: `match-${exercise.id}`,
        message: `You lifted ${weight}kg for ${reps} reps last time. Try to match or beat it.`,
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
