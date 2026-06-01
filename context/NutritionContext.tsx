import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { toDateKey } from '../utils/dateHelpers';

export type SavedFoodItem = {
  name: string;
  actual_g: number;
  cal_per100g: number;
  protein_per100g: number;
  carbs_per100g: number;
  fat_per100g: number;
};

export type MealEntry = {
  id: string;
  loggedAt: string;
  description: string;
  source: 'photo' | 'barcode' | 'manual';
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sodium?: number;
  sugar?: number;
  confidence: 'low' | 'medium' | 'high' | null;
  items?: SavedFoodItem[];
  thumbnailBase64?: string;
};

export type DailyTargets = {
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sodium: number;
};

const DEFAULT_TARGETS: DailyTargets = {
  calories: 2000,
  protein: 150,
  carbs: 200,
  fat: 65,
  fiber: 30,
  sodium: 2300,
};

const MEALS_KEY   = 'gymbro_nutrition_meals';
const TARGETS_KEY = 'gymbro_nutrition_targets';

type Totals = {
  calories: number; protein: number; carbs: number; fat: number;
  fiber: number; sodium: number; sugar: number;
};

type NutritionContextType = {
  meals: MealEntry[];
  targets: DailyTargets;
  todaysMeals: MealEntry[];
  todaysTotals: Totals;
  addMeal: (entry: Omit<MealEntry, 'id' | 'loggedAt'>, loggedAt?: string) => void;
  deleteMeal: (id: string) => void;
  updateTargets: (t: DailyTargets) => void;
};

const NutritionContext = createContext<NutritionContextType | null>(null);

export function NutritionProvider({ children }: { children: React.ReactNode }) {
  const [meals, setMeals] = useState<MealEntry[]>([]);
  const [targets, setTargets] = useState<DailyTargets>(DEFAULT_TARGETS);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(MEALS_KEY),
      AsyncStorage.getItem(TARGETS_KEY),
    ]).then(([rawMeals, rawTargets]) => {
      if (rawMeals) setMeals(JSON.parse(rawMeals));
      if (rawTargets) {
        const saved = JSON.parse(rawTargets);
        setTargets({ ...DEFAULT_TARGETS, ...saved });
      }
      setHasHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    AsyncStorage.setItem(MEALS_KEY, JSON.stringify(meals));
  }, [meals, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) return;
    AsyncStorage.setItem(TARGETS_KEY, JSON.stringify(targets));
  }, [targets, hasHydrated]);

  const todayKey = toDateKey(new Date().toISOString());

  const todaysMeals = useMemo(
    () => meals.filter((m) => toDateKey(m.loggedAt) === todayKey),
    [meals, todayKey]
  );

  const todaysTotals = useMemo(
    () => todaysMeals.reduce<Totals>(
      (acc, m) => ({
        calories: acc.calories + m.calories,
        protein:  acc.protein  + m.protein,
        carbs:    acc.carbs    + m.carbs,
        fat:      acc.fat      + m.fat,
        fiber:    acc.fiber    + (m.fiber   ?? 0),
        sodium:   acc.sodium   + (m.sodium  ?? 0),
        sugar:    acc.sugar    + (m.sugar   ?? 0),
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sodium: 0, sugar: 0 }
    ),
    [todaysMeals]
  );

  const addMeal = (entry: Omit<MealEntry, 'id' | 'loggedAt'>, loggedAt?: string) => {
    const newMeal: MealEntry = {
      ...entry,
      id: `${Date.now()}-${Math.random()}`,
      loggedAt: loggedAt ?? new Date().toISOString(),
    };
    setMeals((prev) => [newMeal, ...prev]);
  };

  const deleteMeal = (id: string) => setMeals((prev) => prev.filter((m) => m.id !== id));

  const updateTargets = (t: DailyTargets) => setTargets(t);

  return (
    <NutritionContext.Provider
      value={{ meals, targets, todaysMeals, todaysTotals, addMeal, deleteMeal, updateTargets }}
    >
      {children}
    </NutritionContext.Provider>
  );
}

export function useNutrition(): NutritionContextType {
  const ctx = useContext(NutritionContext);
  if (!ctx) throw new Error('useNutrition must be used within NutritionProvider');
  return ctx;
}
