import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getStarterTemplates, StarterGoal } from '../data/exerciseCatalog';
import { Exercise } from './ExerciseContext';
import { useUserProfile } from './UserProfileContext';

const STORAGE_KEY = 'gymbro_templates';
// Which goal the current starters were built for; drives the refresh prompt.
const STARTERS_GOAL_KEY = 'gymbro_templates_goal';

export type Template = {
  id: string;
  name: string;
  notes: string;
  exercises: Exercise[];
  createdAt: string;
  isStarter?: boolean;
};

type TemplateContextType = {
  templates: Template[];
  addTemplate: (template: Omit<Template, 'id' | 'createdAt'>) => void;
  updateTemplate: (
    id: string,
    updates: Omit<Template, 'id' | 'createdAt'>
  ) => void;
  deleteTemplate: (id: string) => void;
  moveTemplateUp: (id: string) => void;
  moveTemplateDown: (id: string) => void;
  refreshStartersForGoal: (goal: StarterGoal | null) => void;
  /** The goal the current starter templates were last built for. */
  startersGoal: StarterGoal | null;
};

const TemplateContext = createContext<TemplateContextType | null>(null);

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);
  const [startersGoal, setStartersGoal] = useState<StarterGoal | null>(null);
  const { goal } = useUserProfile();

  useEffect(() => {
    let isMounted = true;

    const loadTemplates = async () => {
      try {
        const [raw, rawGoal] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(STARTERS_GOAL_KEY),
        ]);
        if (isMounted && rawGoal) setStartersGoal(rawGoal as StarterGoal);

        const starterTemplates: Template[] = getStarterTemplates(goal).map((template) => ({
          ...template,
          isStarter: true,
        }));

        if (raw === null) {
          if (isMounted) {
            setTemplates(starterTemplates);
            setStartersGoal(goal);
            setHasHydrated(true);
          }

          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(starterTemplates));
          if (goal) await AsyncStorage.setItem(STARTERS_GOAL_KEY, goal);
          return;
        }

        const parsed: Template[] = JSON.parse(raw) ?? [];
        const existingIds = new Set(parsed.map((template) => template.id));

        const missingStarterTemplates = starterTemplates.filter(
          (template) => !existingIds.has(template.id)
        );

        const mergedTemplates = [...parsed, ...missingStarterTemplates];

        if (isMounted) {
          setTemplates(mergedTemplates);
          setHasHydrated(true);
        }

        if (missingStarterTemplates.length > 0) {
          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(mergedTemplates));
        }
      } catch (error) {
        console.error('Failed to load templates:', error);

        const fallbackTemplates: Template[] = getStarterTemplates(goal).map((template) => ({
          ...template,
          isStarter: true,
        }));

        if (isMounted) {
          setTemplates(fallbackTemplates);
          setHasHydrated(true);
        }
      }
    };

    loadTemplates();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshStartersForGoal = (nextGoal: StarterGoal | null) => {
    const fresh = getStarterTemplates(nextGoal).map((t) => ({ ...t, isStarter: true }));
    const freshById = new Map(fresh.map((t) => [t.id, t]));
    setTemplates((prev) => {
      const customs = prev.filter((t) => !freshById.has(t.id));
      return [...fresh, ...customs];
    });
    setStartersGoal(nextGoal);
    if (nextGoal) {
      AsyncStorage.setItem(STARTERS_GOAL_KEY, nextGoal).catch(() => {});
    } else {
      AsyncStorage.removeItem(STARTERS_GOAL_KEY).catch(() => {});
    }
  };

  useEffect(() => {
    if (!hasHydrated) return;

    const persistTemplates = async () => {
      try {
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
      } catch (error) {
        console.error('Failed to save templates:', error);
      }
    };

    persistTemplates();
  }, [templates, hasHydrated]);

  const addTemplate = (template: Omit<Template, 'id' | 'createdAt'>) => {
    const newTemplate: Template = {
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      ...template,
      isStarter: false,
    };

    setTemplates((prev) => [newTemplate, ...prev]);
  };

  const updateTemplate = (
    id: string,
    updates: Omit<Template, 'id' | 'createdAt'>
  ) => {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === id
          ? { ...template, ...updates, isStarter: false }
          : template
      )
    );
  };

  const deleteTemplate = (id: string) => {
    setTemplates((prev) => prev.filter((template) => template.id !== id));
  };

  const moveTemplateUp = (id: string) => {
    setTemplates((prev) => {
      const index = prev.findIndex((template) => template.id === id);
      if (index <= 0) return prev;

      const updated = [...prev];
      [updated[index - 1], updated[index]] = [updated[index], updated[index - 1]];
      return updated;
    });
  };

  const moveTemplateDown = (id: string) => {
    setTemplates((prev) => {
      const index = prev.findIndex((template) => template.id === id);
      if (index === -1 || index >= prev.length - 1) return prev;

      const updated = [...prev];
      [updated[index], updated[index + 1]] = [updated[index + 1], updated[index]];
      return updated;
    });
  };

  if (!hasHydrated) {
    return null;
  }

  return (
    <TemplateContext.Provider
      value={{
        templates,
        addTemplate,
        updateTemplate,
        deleteTemplate,
        moveTemplateUp,
        moveTemplateDown,
        refreshStartersForGoal,
        startersGoal,
      }}
    >
      {children}
    </TemplateContext.Provider>
  );
}

export function useTemplates() {
  const context = useContext(TemplateContext);

  if (!context) {
    throw new Error('useTemplates must be used inside TemplateProvider');
  }

  return context;
}