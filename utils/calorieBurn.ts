import { ActiveWorkoutExercise } from '../context/WorkoutContext';

export type CalorieBurnInput = {
  weightKg: number | null;
  bodyFatPct: number | null;
  durationMin: number;
  totalVolumeKg: number;
};

export type CalorieBurnResult = {
  calories: number;
  totalVolumeKg: number;
  durationMin: number;
  setsCompleted: number;
};

const STRENGTH_MET = 5.0;
const VOLUME_BONUS_KCAL_PER_KG = 0.005;

// Estimate kcal burned. MET-based on body weight (or LBM-scaled when BF% is known) plus a
// small bonus from total volume so that a heavier, harder session reads higher than a light one
// of the same duration. Returns at least 1 kcal for any non-zero duration.
export function estimateCaloriesBurned(input: CalorieBurnInput): number | null {
  const { weightKg, bodyFatPct, durationMin, totalVolumeKg } = input;
  if (!weightKg || weightKg <= 0 || durationMin <= 0) return null;

  const referenceMass =
    bodyFatPct != null && bodyFatPct > 0
      ? weightKg * (1 - bodyFatPct / 100) * 1.3
      : weightKg;

  const baseKcal = (STRENGTH_MET * referenceMass * durationMin) / 60;
  const volumeKcal = Math.max(0, totalVolumeKg) * VOLUME_BONUS_KCAL_PER_KG;

  return Math.max(1, Math.round(baseKcal + volumeKcal));
}

export function totalVolumeFromExercises(exercises: ActiveWorkoutExercise[]): number {
  let total = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (!set.done) continue;
      const weight = Number(set.weight);
      const reps = Number(set.reps);
      if (Number.isFinite(weight) && Number.isFinite(reps) && weight > 0 && reps > 0) {
        total += weight * reps;
      }
    }
  }
  return total;
}

export function setsCompletedFromExercises(exercises: ActiveWorkoutExercise[]): number {
  let count = 0;
  for (const exercise of exercises) {
    for (const set of exercise.sets) {
      if (set.done) count += 1;
    }
  }
  return count;
}

export function durationMinFrom(startedAt: string, finishedAtIso?: string): number {
  const start = new Date(startedAt).getTime();
  const end = finishedAtIso ? new Date(finishedAtIso).getTime() : Date.now();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return 0;
  return Math.round((end - start) / 60000);
}
