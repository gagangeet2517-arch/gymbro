import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'gymbro_custom_exercises';

export type Exercise = {
  id: string;
  name: string;
  muscle: string;
  equipment: string;
  isCustom?: boolean;
};

type ExerciseContextType = {
  customExercises: Exercise[];
  selectedTemplateExercises: Exercise[];
  addCustomExercise: (exercise: Omit<Exercise, 'id'>) => void;
  deleteCustomExercise: (id: string) => void;
  addExerciseToTemplate: (exercise: Exercise) => void;
  removeExerciseFromTemplate: (id: string) => void;
  moveExerciseUp: (id: string) => void;
  moveExerciseDown: (id: string) => void;
  clearTemplateExercises: () => void;
  setTemplateExercises: (exercises: Exercise[]) => void;
};

const ExerciseContext = createContext<ExerciseContextType | null>(null);

export function ExerciseProvider({ children }: { children: ReactNode }) {
  const [customExercises, setCustomExercises] = useState<Exercise[]>([]);
  const [selectedTemplateExercises, setSelectedTemplateExercises] = useState<
    Exercise[]
  >([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadStoredState = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        if (!raw) {
          if (isMounted) setHasHydrated(true);
          return;
        }

        const parsed: Exercise[] = JSON.parse(raw);

        if (isMounted) {
          setCustomExercises(parsed ?? []);
          setHasHydrated(true);
        }
      } catch (error) {
        console.error('Failed to load custom exercises:', error);
        if (isMounted) setHasHydrated(true);
      }
    };

    loadStoredState();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;

    const persistState = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(customExercises));
      } catch (error) {
        console.error('Failed to save custom exercises:', error);
      }
    };

    persistState();
  }, [customExercises, hasHydrated]);

  const addCustomExercise = (exercise: Omit<Exercise, 'id'>) => {
    const newExercise: Exercise = {
      id: Date.now().toString(),
      ...exercise,
      isCustom: true,
    };

    setCustomExercises((prev) => [...prev, newExercise]);
  };

  const deleteCustomExercise = (id: string) => {
    setCustomExercises((prev) => prev.filter((exercise) => exercise.id !== id));
    setSelectedTemplateExercises((prev) =>
      prev.filter((exercise) => exercise.id !== id)
    );
  };

  const addExerciseToTemplate = (exercise: Exercise) => {
    setSelectedTemplateExercises((prev) => {
      const alreadyExists = prev.some((item) => item.id === exercise.id);
      if (alreadyExists) return prev;
      return [...prev, exercise];
    });
  };

  const removeExerciseFromTemplate = (id: string) => {
    setSelectedTemplateExercises((prev) =>
      prev.filter((exercise) => exercise.id !== id)
    );
  };

  const moveExerciseUp = (id: string) => {
    setSelectedTemplateExercises((prev) => {
      const index = prev.findIndex((exercise) => exercise.id === id);
      if (index <= 0) return prev;

      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  };

  const moveExerciseDown = (id: string) => {
    setSelectedTemplateExercises((prev) => {
      const index = prev.findIndex((exercise) => exercise.id === id);
      if (index === -1 || index >= prev.length - 1) return prev;

      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  };

  const clearTemplateExercises = () => {
    setSelectedTemplateExercises([]);
  };

  const setTemplateExercises = (exercises: Exercise[]) => {
    setSelectedTemplateExercises(exercises);
  };

  if (!hasHydrated) {
    return null;
  }

  return (
    <ExerciseContext.Provider
      value={{
        customExercises,
        selectedTemplateExercises,
        addCustomExercise,
        deleteCustomExercise,
        addExerciseToTemplate,
        removeExerciseFromTemplate,
        moveExerciseUp,
        moveExerciseDown,
        clearTemplateExercises,
        setTemplateExercises,
      }}
    >
      {children}
    </ExerciseContext.Provider>
  );
}

export function useExercises() {
  const context = useContext(ExerciseContext);

  if (!context) {
    throw new Error('useExercises must be used inside ExerciseProvider');
  }

  return context;
}