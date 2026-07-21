import * as ImageManipulator from 'expo-image-manipulator';
import { loadUserGeminiKey } from './userApiKey';

// Resolve the Gemini keys to try, in priority order: the tester's own key first
// (so the shared/dev key isn't used), then the EXPO_PUBLIC env fallbacks.
async function resolveGeminiKeys(): Promise<string[]> {
  const userKey = await loadUserGeminiKey();
  const keys = [
    userKey,
    process.env.EXPO_PUBLIC_GOOGLE_AI_KEY,
    process.env.EXPO_PUBLIC_GOOGLE_AI_KEY_2,
    process.env.EXPO_PUBLIC_GOOGLE_AI_KEY_3,
  ].filter((k): k is string => !!k && k.trim().length > 0);
  // De-dupe in case the user pasted the same key that's already in env.
  return Array.from(new Set(keys));
}

export type FoodItem = {
  name: string;
  estimated_g: number;
  cal_per100g: number;
  protein_per100g: number;
  carbs_per100g: number;
  fat_per100g: number;
  fiber_per100g: number;
  sodium_per100g: number;
};

export type FoodVisionResult = {
  description: string;
  confidence: 'low' | 'medium' | 'high';
  items: FoodItem[];
  fiber_g: number;
  sodium_mg: number;
  sugar_g: number;
  // Computed from items
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
};

export type FoodVisionErrorCode = 'no_key' | 'network' | 'parse' | 'api_error' | 'timeout';

export class FoodVisionError extends Error {
  code: FoodVisionErrorCode;
  constructor(message: string, code: FoodVisionErrorCode) {
    super(message);
    this.code = code;
  }
}

async function compressFoodImage(uri: string): Promise<string> {
  const compressed = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 768 } }],
    { compress: 0.35, format: ImageManipulator.SaveFormat.JPEG, base64: true }
  );
  if (!compressed.base64) throw new Error('Could not prepare image for analysis.');
  return compressed.base64;
}

function computeTotals(items: FoodItem[]) {
  let calories = 0, protein_g = 0, carbs_g = 0, fat_g = 0;
  for (const item of items) {
    const g = item.estimated_g;
    calories  += (item.cal_per100g     / 100) * g;
    protein_g += (item.protein_per100g / 100) * g;
    carbs_g   += (item.carbs_per100g   / 100) * g;
    fat_g     += (item.fat_per100g     / 100) * g;
  }
  return {
    calories:  Math.max(0, Math.round(calories)),
    protein_g: Math.max(0, Math.round(protein_g)),
    carbs_g:   Math.max(0, Math.round(carbs_g)),
    fat_g:     Math.max(0, Math.round(fat_g)),
  };
}

// Shared JSON → FoodVisionResult parser used by both Gemini and OpenAI paths
function parseRawJSON(raw: string): FoodVisionResult {
  raw = raw.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();
  if (!raw.startsWith('{')) {
    const match = raw.match(/\{[\s\S]*\}/);
    raw = match ? match[0] : raw;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new FoodVisionError("Couldn't read AI response. Please try again.", 'parse');
  }

  const rawItems = Array.isArray(parsed.items) ? parsed.items : [];
  const items: FoodItem[] = rawItems.map((it: Record<string, unknown>) => ({
    name:             typeof it.name === 'string' ? it.name : 'Food item',
    estimated_g:      Math.max(0, Math.round(Number(it.estimated_g)      || 0)),
    cal_per100g:      Math.max(0, Math.round(Number(it.cal_per100g)      || 0)),
    protein_per100g:  Math.max(0, Math.round(Number(it.protein_per100g)  || 0)),
    carbs_per100g:    Math.max(0, Math.round(Number(it.carbs_per100g)    || 0)),
    fat_per100g:      Math.max(0, Math.round(Number(it.fat_per100g)      || 0)),
    fiber_per100g:    Math.max(0, Number(it.fiber_per100g)               || 0),
    sodium_per100g:   Math.max(0, Number(it.sodium_per100g)              || 0),
  }));

  if (items.length === 0) {
    throw new FoodVisionError("Couldn't identify any food items. Please try again.", 'parse');
  }

  return {
    description: typeof parsed.description === 'string' ? parsed.description : '',
    confidence: (['low', 'medium', 'high'] as const).includes(parsed.confidence as 'low')
      ? (parsed.confidence as 'low' | 'medium' | 'high')
      : 'low',
    items,
    fiber_g:   Math.max(0, Math.round(Number(parsed.fiber_g)   || 0)),
    sodium_mg: Math.max(0, Math.round(Number(parsed.sodium_mg) || 0)),
    sugar_g:   Math.max(0, Math.round(Number(parsed.sugar_g)   || 0)),
    ...computeTotals(items),
  };
}

const BASE_PROMPT =
  'Analyze this food photo for a fitness nutrition log. Return ONLY valid JSON with no extra text:\n' +
  '{"description":"","confidence":"low|medium|high","fiber_g":0,"sodium_mg":0,"sugar_g":0,' +
  '"items":[{"name":"","estimated_g":0,"cal_per100g":0,"protein_per100g":0,"carbs_per100g":0,' +
  '"fat_per100g":0,"fiber_per100g":0,"sodium_per100g":0}]}\n' +
  'List each distinct food/ingredient as a separate item. ' +
  'Use scale references visible in frame (fork, hand, plate ~26cm) to estimate weights. ' +
  'If no scale reference, use typical serving sizes. ' +
  'High confidence = food and portions clearly identifiable. ' +
  'Estimate fiber and sodium per item from typical food composition.';

function buildPrompt(hint?: string): string {
  if (!hint?.trim()) return BASE_PROMPT;
  return BASE_PROMPT + `\n\nUser hint: "${hint.trim()}" — use this to correct food identification if the photo is ambiguous.`;
}

const TEXT_BASE_PROMPT =
  'Analyze this food description for a fitness nutrition log. Return ONLY valid JSON with no extra text:\n' +
  '{"description":"","confidence":"low|medium|high","fiber_g":0,"sodium_mg":0,"sugar_g":0,' +
  '"items":[{"name":"","estimated_g":0,"cal_per100g":0,"protein_per100g":0,"carbs_per100g":0,' +
  '"fat_per100g":0,"fiber_per100g":0,"sodium_per100g":0}]}\n' +
  'List each distinct food/ingredient as a separate item. ' +
  'Use typical serving sizes and standard portion conventions to estimate weights when not specified. ' +
  'Convert any units mentioned (tablespoons, cups, pieces, slices, handful, etc.) to grams. ' +
  'High confidence = food and portions clearly and unambiguously described; low confidence = vague ' +
  'quantities or unfamiliar dishes needing a guess. ' +
  'Estimate fiber and sodium per item from typical food composition.';

function buildTextPrompt(description: string): string {
  return TEXT_BASE_PROMPT + `\n\nUser's meal: "${description.trim()}"`;
}

// ─── Gemini path ──────────────────────────────────────────────────────────────

// Shared POST + timeout/retry/error-detail handling for both the photo and
// text-only Gemini calls — they differ only in the `parts` sent.
async function postToGemini(parts: unknown[], key: string): Promise<Response> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: {
      maxOutputTokens: 1500,
      temperature: 0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  const doFetch = async (): Promise<Response> => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 35_000);
    try {
      return await fetch(url, { method: 'POST', signal: controller.signal, headers: { 'Content-Type': 'application/json' }, body });
    } catch (err: unknown) {
      const isAbort = err instanceof Error && err.name === 'AbortError';
      if (isAbort) throw new FoodVisionError('Food analysis is taking too long. Please try again.', 'timeout');
      throw new FoodVisionError('No internet connection.', 'network');
    } finally {
      clearTimeout(timer);
    }
  };

  // One retry on timeout — a single slow response (cold model, weak signal)
  // shouldn't immediately fail the whole request.
  let res: Response;
  try {
    res = await doFetch();
  } catch (err) {
    if (err instanceof FoodVisionError && err.code === 'timeout') {
      res = await doFetch();
    } else {
      throw err;
    }
  }
  if (res.status === 503 || res.status === 429) {
    await new Promise((r) => setTimeout(r, res.status === 429 ? 5000 : 2500));
    res = await doFetch();
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    let detail = '';
    try {
      detail = JSON.parse(errBody)?.error?.message ?? '';
    } catch {
      // ignore — body wasn't JSON
    }
    console.warn('[Gemini]', res.status, errBody.slice(0, 300));
    throw new FoodVisionError(
      detail ? `gemini:${res.status} — ${detail}` : `gemini:${res.status}`,
      'api_error'
    );
  }
  return res;
}

async function extractRawText(res: Response): Promise<string> {
  const json = await res.json();
  const parts: Array<{ text?: string; thought?: boolean }> =
    json.candidates?.[0]?.content?.parts ?? [];
  const textPart = parts.find((p) => !p.thought && p.text);
  const raw = textPart?.text?.trim() ?? '';
  if (!raw) throw new FoodVisionError("Couldn't read AI response. Please try again.", 'parse');
  return raw;
}

async function analyzeWithGemini(base64: string, key: string, hint?: string): Promise<FoodVisionResult> {
  const res = await postToGemini(
    [
      { inline_data: { mime_type: 'image/jpeg', data: base64 } },
      { text: buildPrompt(hint) },
    ],
    key
  );
  return parseRawJSON(await extractRawText(res));
}

async function analyzeTextWithGemini(description: string, key: string): Promise<FoodVisionResult> {
  const res = await postToGemini([{ text: buildTextPrompt(description) }], key);
  return parseRawJSON(await extractRawText(res));
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function analyzeFoodPhoto(imageUri: string, hint?: string): Promise<FoodVisionResult> {
  const keys = await resolveGeminiKeys();
  if (keys.length === 0) {
    throw new FoodVisionError('Add your Google Gemini API key in Profile to use AI features.', 'no_key');
  }

  const base64 = await compressFoodImage(imageUri);

  let lastApiError: FoodVisionError | null = null;
  for (const key of keys) {
    try {
      return await analyzeWithGemini(base64, key, hint);
    } catch (err) {
      // Only an API error is worth retrying with the next key; anything else
      // (network, timeout, parse) is surfaced to the user immediately.
      if (err instanceof FoodVisionError && err.code === 'api_error') {
        lastApiError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastApiError ?? new FoodVisionError(
    'All AI providers are busy right now. Please wait a moment and try again.',
    'api_error'
  );
}

// Same idea as analyzeFoodPhoto but with no image — just a plain-text
// description of what was eaten (e.g. "two slices of home-made bread with
// butter"), for logging a meal when there's no photo to snap.
export async function analyzeFoodText(description: string): Promise<FoodVisionResult> {
  if (!description.trim()) {
    throw new FoodVisionError('Describe what you ate first.', 'parse');
  }

  const keys = await resolveGeminiKeys();
  if (keys.length === 0) {
    throw new FoodVisionError('Add your Google Gemini API key in Profile to use AI features.', 'no_key');
  }

  let lastApiError: FoodVisionError | null = null;
  for (const key of keys) {
    try {
      return await analyzeTextWithGemini(description, key);
    } catch (err) {
      if (err instanceof FoodVisionError && err.code === 'api_error') {
        lastApiError = err;
        continue;
      }
      throw err;
    }
  }

  throw lastApiError ?? new FoodVisionError(
    'All AI providers are busy right now. Please wait a moment and try again.',
    'api_error'
  );
}

export function recomputeTotals(items: FoodItem[]): Pick<FoodVisionResult, 'calories' | 'protein_g' | 'carbs_g' | 'fat_g'> {
  return computeTotals(items);
}

// ─── Text-based query helper (used by voice item parsing in nutrition.tsx) ────

async function tryGeminiText(prompt: string, key: string): Promise<string | null> {
  const body = JSON.stringify({
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      maxOutputTokens: 800,
      temperature: 0,
      responseMimeType: 'application/json',
      thinkingConfig: { thinkingBudget: 0 },
    },
  });
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${key}`;
  let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  if (res.status === 503 || res.status === 429) {
    await new Promise((r) => setTimeout(r, res.status === 429 ? 5000 : 2500));
    res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  }
  if (!res.ok) {
    const errBody = await res.text().catch(() => '');
    console.warn('[Gemini text]', res.status, errBody.slice(0, 300));
    return null;
  }
  const json = await res.json();
  const parts: Array<{ text?: string; thought?: boolean }> =
    json.candidates?.[0]?.content?.parts ?? [];
  const raw = parts.find((p) => !p.thought && p.text)?.text?.trim() ?? '';
  return raw || null;
}


export async function queryFoodText(prompt: string): Promise<string> {
  const keys = await resolveGeminiKeys();
  if (keys.length === 0) {
    throw new Error('Add your Google Gemini API key in Profile to use AI features.');
  }

  for (const key of keys) {
    const result = await tryGeminiText(prompt, key);
    if (result) return result;
  }

  throw new Error('All AI providers are busy right now. Please try again.');
}
