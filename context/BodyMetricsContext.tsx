import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useState } from 'react';

const STORAGE_KEY = 'gymbro_body_metrics';

export type BodyMetricEntry = {
  id: string;
  date: string;
  weight: number | null;
  bodyFat: number | null;
};

type BodyMetricsContextType = {
  entries: BodyMetricEntry[];
  addEntry: (weight: number | null, bodyFat: number | null) => void;
  latestEntry: BodyMetricEntry | null;
};

const BodyMetricsContext = createContext<BodyMetricsContextType | null>(null);

export function BodyMetricsProvider({ children }: { children: ReactNode }) {
  const [entries, setEntries] = useState<BodyMetricEntry[]>([]);
  const [hasHydrated, setHasHydrated] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw && isMounted) setEntries(JSON.parse(raw));
      } catch {}
      if (isMounted) setHasHydrated(true);
    };
    load();
    return () => { isMounted = false; };
  }, []);

  useEffect(() => {
    if (!hasHydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries)).catch(() => {});
  }, [entries, hasHydrated]);

  const addEntry = (weight: number | null, bodyFat: number | null) => {
    setEntries((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        date: new Date().toISOString(),
        weight,
        bodyFat,
      },
      ...prev,
    ]);
  };

  if (!hasHydrated) return null;

  return (
    <BodyMetricsContext.Provider value={{ entries, addEntry, latestEntry: entries[0] ?? null }}>
      {children}
    </BodyMetricsContext.Provider>
  );
}

export function useBodyMetrics() {
  const ctx = useContext(BodyMetricsContext);
  if (!ctx) throw new Error('useBodyMetrics must be used inside BodyMetricsProvider');
  return ctx;
}
