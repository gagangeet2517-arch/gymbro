import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  ReactNode,
  useContext,
  useEffect,
  useState,
} from 'react';
import { getStarterTemplates } from '../data/exerciseCatalog';
import { Exercise } from './ExerciseContext';

const STORAGE_KEY = 'gymbro_templates';

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
};

const TemplateContext = createContext<TemplateContextType | null>(null);

export function TemplateProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadTemplates = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);

        const starterTemplates: Template[] = getStarterTemplates().map((template) => ({
          ...template,
          isStarter: true,
        }));

        if (raw === null) {
          if (isMounted) {
            setTemplates(starterTemplates);
            setHasHydrated(true);
          }

          await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(starterTemplates));
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

        const fallbackTemplates: Template[] = getStarterTemplates().map((template) => ({
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
  }, []);

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