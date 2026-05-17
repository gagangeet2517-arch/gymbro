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
  finishWorkout: () => void;
  discardWorkout: () => void;
};

const WorkoutContext = createContext<WorkoutContextType | null>(null);

type PersistedWorkoutState = {
  activeWorkout: ActiveWorkout | null;
  completedWorkouts: CompletedWorkout[];
};

function createEmptySet(): WorkoutSet {
  return {
    id: `${Date.now()}-${Math.random()}`,
    weight: '',
    reps: '',
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

function toNumber(value: string): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
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
      const previousExercise = latestCompletedForTemplate?.exercises.find(
        (item) => item.id === exercise.id
      );

      const hasPrefill = !!previousExercise && previousExercise.sets.length > 0;

      const prefilledSets = hasPrefill
        ? previousExercise.sets.map((set) => createPrefilledSet(set.weight, set.reps))
        : [createEmptySet()];

      return {
        id: exercise.id,
        name: exercise.name,
        muscle: exercise.muscle,
        equipment: exercise.equipment,
        sets: prefilledSets,
        prefilledFromLastWorkout: hasPrefill,
        lastWorkoutSummary: hasPrefill
          ? buildLastWorkoutSummary(previousExercise.sets)
          : null,
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

  const finishWorkout = () => {
    setActiveWorkout((prev) => {
      if (!prev) return prev;

      const completedWorkout: CompletedWorkout = {
        id: `${Date.now()}-${Math.random()}`,
        templateId: prev.templateId,
        templateName: prev.templateName,
        startedAt: prev.startedAt,
        finishedAt: new Date().toISOString(),
        exercises: prev.exercises,
      };

      setCompletedWorkouts((existing) => [completedWorkout, ...existing]);
      return null;
    });
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