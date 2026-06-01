import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Exercise } from './ExerciseContext';

const STORAGE_KEY = 'gymbro_workouts';

export type WorkoutSet = {
  id: string;
  weight: string;
  reps: string;
  done: boolean;
};

export type LastWorkoutSummary = {
  setsLogged: number;
  maxWeight: number | null;
  bestReps: number | null;
};

export type ActiveWorkoutExercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  sets: WorkoutSet[];
  prefilledFromLastWorkout?: boolean;
  lastWorkoutSummary?: LastWorkoutSummary | null;
  targetSets?: number;
  targetReps?: string;
};

export type ActiveWorkout = {
  templateId: string;
  templateName: string;
  startedAt: string;
  exercises: ActiveWorkoutExercise[];
  prefillSourceFinishedAt?: string | null;
};

export type CompletedWorkout = {
  id: string;
  templateId: string;
  templateName: string;
  startedAt: string;
  finishedAt: string;
  exercises: ActiveWorkoutExercise[];
  durationMin?: number;
  totalVolume?: number;
  caloriesBurned?: number | null;
};

export type FinishExtras = {
  durationMin?: number;
  totalVolume?: number;
  caloriesBurned?: number | null;
};

type WorkoutContextType = {
  activeWorkout: ActiveWorkout | null;
  completedWorkouts: CompletedWorkout[];
  startWorkoutFromTemplate: (
    templateId: string,
    templateName: string,
    exercises: Exercise[]
  ) => void;
  addSetToExercise: (exerciseId: string) => void;
  removeSetFromExercise: (exerciseId: string, setId: string) => void;
  toggleSetDone: (exerciseId: string, setId: string) => void;
  updateSetField: (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps',
    value: string
  ) => void;
  addExerciseToActiveWorkout: (exercise: Exercise) => void;
  removeExerciseFromActiveWorkout: (exerciseId: string) => void;
  finishWorkout: (extras?: FinishExtras) => CompletedWorkout | null;
  discardWorkout: () => void;
};

const WorkoutContext = createContext<WorkoutContextType | null>(null);

type PersistedWorkoutState = {
  activeWorkout: ActiveWorkout | null;
  completedWorkouts: CompletedWorkout[];
};

function createEmptySet(repsPrefill?: string): WorkoutSet {
  return {
    id: `${Date.now()}-${Math.random()}`,
    weight: '',
    reps: repsPrefill ?? '',
    done: false,
  };
}

function createPrefilledSet(weight: string, reps: string): WorkoutSet {
  return {
    id: `${Date.now()}-${Math.random()}`,
    weight,
    reps,
    done: false,
  };
}

// Mid-range from "8-12" → "10". Returns trimmed string or '' for invalid input.
function midpointFromTargetReps(targetReps?: string): string {
  if (!targetReps) return '';
  const match = targetReps.match(/(\d+)\s*[-–]\s*(\d+)/);
  if (match) {
    const lo = Number(match[1]);
    const hi = Number(match[2]);
    if (Number.isFinite(lo) && Number.isFinite(hi)) {
      return String(Math.round((lo + hi) / 2));
    }
  }
  const single = targetReps.match(/^\s*(\d+)\s*$/);
  if (single) return single[1];
  return '';
}

function toNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

// Most recent logged sets for an exercise across ALL completed workouts,
// regardless of which template they came from. completedWorkouts is stored
// newest-first, so the first match is the latest. Returns null if never done.
function findLatestExerciseSets(
  completedWorkouts: CompletedWorkout[],
  exerciseId: string
): WorkoutSet[] | null {
  for (const workout of completedWorkouts) {
    const match = workout.exercises.find((item) => item.id === exerciseId);
    if (match && match.sets.length > 0) return match.sets;
  }
  return null;
}

function buildLastWorkoutSummary(sets: WorkoutSet[]): LastWorkoutSummary {
  const setsLogged = sets.length;

  const weights = sets
    .map((set) => toNumber(set.weight))
    .filter((value): value is number => value !== null);

  const reps = sets
    .map((set) => toNumber(set.reps))
    .filter((value): value is number => value !== null);

  return {
    setsLogged,
    maxWeight: weights.length > 0 ? Math.max(...weights) : null,
    bestReps: reps.length > 0 ? Math.max(...reps) : null,
  };
}

export function WorkoutProvider({ children }: { children: ReactNode }) {
  const [activeWorkout, setActiveWorkout] = useState<ActiveWorkout | null>(null);
  const [completedWorkouts, setCompletedWorkouts] = useState<CompletedWorkout[]>(
    []
  );
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadWorkouts = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (!raw) {
          if (isMounted) setHasHydrated(true);
          return;
        }

        const parsed: PersistedWorkoutState = JSON.parse(raw);

        if (isMounted) {
          setActiveWorkout(parsed.activeWorkout ?? null);
          setCompletedWorkouts(parsed.completedWorkouts ?? []);
          setHasHydrated(true);
        }
      } catch (error) {
        console.error('Failed to load workout state:', error);
        if (isMounted) setHasHydrated(true);
      }
    };

    loadWorkouts();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const persistWorkouts = async () => {
      try {
        const payload: PersistedWorkoutState = {
          activeWorkout,
          completedWorkouts,
        };
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
      } catch (error) {
        console.error('Failed to save workout state:', error);
      }
    };

    persistWorkouts();
  }, [activeWorkout, completedWorkouts, hasHydrated]);

  const startWorkoutFromTemplate = (
    templateId: string,
    templateName: string,
    exercises: Exercise[]
  ) => {
    const latestCompletedForTemplate = completedWorkouts.find(
      (workout) => workout.templateId === templateId
    );

    const mappedExercises: ActiveWorkoutExercise[] = exercises.map((exercise) => {
      const sameTemplateExercise = latestCompletedForTemplate?.exercises.find(
        (item) => item.id === exercise.id
      );

      // Prefer the same template's last run; otherwise fall back to the most
      // recent time this exercise was done in any other workout.
      const prefillSets =
        sameTemplateExercise && sameTemplateExercise.sets.length > 0
          ? sameTemplateExercise.sets
          : findLatestExerciseSets(completedWorkouts, exercise.id);
      const hasPrefill = !!prefillSets;

      let initialSets: WorkoutSet[];
      if (prefillSets) {
        initialSets = prefillSets.map((set) =>
          createPrefilledSet(set.weight, set.reps)
        );
      } else if (exercise.targetSets && exercise.targetSets > 0) {
        const repsPrefill = midpointFromTargetReps(exercise.targetReps);
        initialSets = Array.from({ length: exercise.targetSets }, () =>
          createEmptySet(repsPrefill)
        );
      } else {
        initialSets = [createEmptySet()];
      }

      return {
        id: exercise.id,
        name: exercise.name,
        muscle: exercise.muscle,
        equipment: exercise.equipment,
        sets: initialSets,
        prefilledFromLastWorkout: hasPrefill,
        lastWorkoutSummary: prefillSets
          ? buildLastWorkoutSummary(prefillSets)
          : null,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
      };
    });

    setActiveWorkout({
      templateId,
      templateName,
      startedAt: new Date().toISOString(),
      exercises: mappedExercises,
      prefillSourceFinishedAt: latestCompletedForTemplate?.finishedAt ?? null,
    });
  };

  const addSetToExercise = (exerciseId: string) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        exercises: prev.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? { ...exercise, sets: [...exercise.sets, createEmptySet()] }
            : exercise
        ),
      };
    });
  };

  const removeSetFromExercise = (exerciseId: string, setId: string) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        exercises: prev.exercises.map((exercise) => {
          if (exercise.id !== exerciseId) return exercise;
          if (exercise.sets.length <= 1) return exercise;

          return {
            ...exercise,
            sets: exercise.sets.filter((set) => set.id !== setId),
          };
        }),
      };
    });
  };

  const toggleSetDone = (exerciseId: string, setId: string) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        exercises: prev.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.id === setId ? { ...set, done: !set.done } : set
                ),
              }
            : exercise
        ),
      };
    });
  };

  const updateSetField = (
    exerciseId: string,
    setId: string,
    field: 'weight' | 'reps',
    value: string
  ) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;

      return {
        ...prev,
        exercises: prev.exercises.map((exercise) =>
          exercise.id === exerciseId
            ? {
                ...exercise,
                sets: exercise.sets.map((set) =>
                  set.id === setId ? { ...set, [field]: value } : set
                ),
              }
            : exercise
        ),
      };
    });
  };

  const addExerciseToActiveWorkout = (exercise: Exercise) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;
      if (prev.exercises.some((e) => e.id === exercise.id)) return prev;

      const sameTemplateMatch = completedWorkouts
        .find((w) => w.templateId === prev.templateId)
        ?.exercises.find((e) => e.id === exercise.id);

      // Same-template last run first, then the most recent time it was done anywhere.
      const prefillSets =
        sameTemplateMatch && sameTemplateMatch.sets.length > 0
          ? sameTemplateMatch.sets
          : findLatestExerciseSets(completedWorkouts, exercise.id);
      const hasPrefill = !!prefillSets;
      const initialSets: WorkoutSet[] = prefillSets
        ? prefillSets.map((s) => createPrefilledSet(s.weight, s.reps))
        : exercise.targetSets && exercise.targetSets > 0
        ? Array.from({ length: exercise.targetSets }, () =>
            createEmptySet(midpointFromTargetReps(exercise.targetReps))
          )
        : [createEmptySet()];

      const newExercise: ActiveWorkoutExercise = {
        id: exercise.id,
        name: exercise.name,
        muscle: exercise.muscle,
        equipment: exercise.equipment,
        sets: initialSets,
        prefilledFromLastWorkout: hasPrefill,
        lastWorkoutSummary: prefillSets
          ? buildLastWorkoutSummary(prefillSets)
          : null,
        targetSets: exercise.targetSets,
        targetReps: exercise.targetReps,
      };

      return { ...prev, exercises: [...prev.exercises, newExercise] };
    });
  };

  const removeExerciseFromActiveWorkout = (exerciseId: string) => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        exercises: prev.exercises.filter((e) => e.id !== exerciseId),
      };
    });
  };

  const finishWorkout = (extras?: FinishExtras): CompletedWorkout | null => {
    let saved: CompletedWorkout | null = null;
    setActiveWorkout((prev) => {
      if (!prev) return prev;

      const completedWorkout: CompletedWorkout = {
        id: `${Date.now()}-${Math.random()}`,
        templateId: prev.templateId,
        templateName: prev.templateName,
        startedAt: prev.startedAt,
        finishedAt: new Date().toISOString(),
        exercises: prev.exercises,
        durationMin: extras?.durationMin,
        totalVolume: extras?.totalVolume,
        caloriesBurned: extras?.caloriesBurned ?? null,
      };

      saved = completedWorkout;
      setCompletedWorkouts((existing) => [completedWorkout, ...existing]);
      return null;
    });
    return saved;
  };

  const discardWorkout = () => {
    setActiveWorkout(null);
  };

  return (
    <WorkoutContext.Provider
      value={{
        activeWorkout,
        completedWorkouts,
        startWorkoutFromTemplate,
        addSetToExercise,
        removeSetFromExercise,
        toggleSetDone,
        updateSetField,
        addExerciseToActiveWorkout,
        removeExerciseFromActiveWorkout,
        finishWorkout,
        discardWorkout,
      }}
    >
      {children}
    </WorkoutContext.Provider>
  );
}

export function useWorkout() {
  const context = useContext(WorkoutContext);

  if (!context) {
    throw new Error('useWorkout must be used inside WorkoutProvider');
  }

  return context;
}
