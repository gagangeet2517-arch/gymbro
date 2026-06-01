import AsyncStorage from '@react-native-async-storage/async-storage';

// Lets a tester supply their OWN Google Gemini key so the shared/dev key in
// .env.local isn't consumed during the testing period. The user key, when set,
// always takes priority over the EXPO_PUBLIC_GOOGLE_AI_KEY* env fallbacks.

const STORAGE_KEY = 'gymbro_user_gemini_key';

let cachedKey: string | null = null;
let hydrated = false;

/** Reads the stored key, hydrating the in-memory cache on first call. */
export async function loadUserGeminiKey(): Promise<string | null> {
  if (hydrated) return cachedKey;
  try {
    cachedKey = (await AsyncStorage.getItem(STORAGE_KEY)) || null;
  } catch {
    cachedKey = null;
  }
  hydrated = true;
  return cachedKey;
}

/** Synchronous read of the cached key (null until loadUserGeminiKey has run). */
export function getUserGeminiKeySync(): string | null {
  return cachedKey;
}

/** Saves (or, when blank, clears) the user's Gemini key and updates the cache. */
export async function setUserGeminiKey(key: string): Promise<void> {
  const trimmed = key.trim();
  cachedKey = trimmed || null;
  hydrated = true;
  if (trimmed) {
    await AsyncStorage.setItem(STORAGE_KEY, trimmed);
  } else {
    await AsyncStorage.removeItem(STORAGE_KEY);
  }
}
