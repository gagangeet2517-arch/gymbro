import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useReducer } from 'react';

// One-time contextual hints ("New: Guided mode") tracked per feature id.
// A single AsyncStorage key holds the set of dismissed/used ids so every
// hint costs one entry, not one storage key.

const STORAGE_KEY = 'gymbro_feature_hints_seen';

let cache: Set<string> | null = null;
let hydrating: Promise<Set<string>> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function loadSeenIds(): Promise<Set<string>> {
  if (cache) return cache;
  if (!hydrating) {
    hydrating = AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        cache = new Set(raw ? (JSON.parse(raw) as string[]) : []);
        return cache;
      })
      .catch(() => {
        cache = new Set();
        return cache;
      });
  }
  return hydrating;
}

function persist() {
  if (!cache) return;
  AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(cache))).catch(() => {});
}

/** Mark a hint permanently seen — call this from the action it describes. */
export function markFeatureSeen(id: string): void {
  loadSeenIds().then((ids) => {
    if (ids.has(id)) return;
    ids.add(id);
    persist();
    notify();
  });
}

/** Hook backing <FeatureHint>: whether the hint is ready to render and dismissed. */
export function useFeatureHintState(id: string): { ready: boolean; seen: boolean; dismiss: () => void } {
  const [, forceRerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    let mounted = true;
    loadSeenIds().then(() => {
      if (mounted) forceRerender();
    });
    const listener = () => forceRerender();
    listeners.add(listener);
    return () => {
      mounted = false;
      listeners.delete(listener);
    };
  }, [id]);

  return {
    ready: cache !== null,
    seen: cache?.has(id) ?? false,
    dismiss: () => markFeatureSeen(id),
  };
}
