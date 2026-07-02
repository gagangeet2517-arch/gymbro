// Deterministic parser for spoken set phrases like "eighty for eight",
// "82.5 for 6", "12 reps at 40", "bodyweight ten". No AI involved — the
// transcript comes from on-device speech recognition and only two numbers
// need extracting.

export type ParsedSet = {
  /** null = bodyweight / no external load */
  weight: number | null;
  reps: number;
};

const ONES: Record<string, number> = {
  zero: 0, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7,
  eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12, thirteen: 13,
  fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17, eighteen: 18,
  nineteen: 19,
};
const TENS: Record<string, number> = {
  twenty: 20, thirty: 30, forty: 40, fifty: 50, sixty: 60, seventy: 70,
  eighty: 80, ninety: 90,
};

// "eighty five" → "85", "one hundred" → "100", "eighty five point five" → "85.5"
function wordsToDigits(text: string): string {
  const tokens = text.toLowerCase().split(/\s+/);
  const out: string[] = [];
  let acc: number | null = null;

  const flush = () => {
    if (acc !== null) out.push(String(acc));
    acc = null;
  };

  for (const tok of tokens) {
    if (tok in TENS) {
      flush();
      acc = TENS[tok];
    } else if (tok in ONES) {
      if (acc !== null && acc % 10 === 0 && acc >= 20 && ONES[tok] < 10) {
        acc += ONES[tok];
      } else {
        flush();
        acc = ONES[tok];
      }
    } else if (tok === 'hundred') {
      acc = (acc ?? 1) * 100;
    } else if (tok === 'point') {
      flush();
      out.push('point');
    } else {
      flush();
      out.push(tok);
    }
  }
  flush();

  // stitch "85 point 5" → "85.5"
  return out
    .join(' ')
    .replace(/(\d+)\s+point\s+(\d+)/g, '$1.$2');
}

const REPS_MAX = 50;
const WEIGHT_MAX = 500;

function sane(weight: number | null, reps: number): ParsedSet | null {
  if (!Number.isFinite(reps) || reps < 1 || reps > REPS_MAX || !Number.isInteger(reps)) return null;
  if (weight !== null && (!Number.isFinite(weight) || weight <= 0 || weight > WEIGHT_MAX)) return null;
  return { weight, reps };
}

export function parseSetPhrase(transcript: string): ParsedSet | null {
  const text = wordsToDigits(transcript).toLowerCase();

  // "bodyweight (for) 10" / "bodyweight 10 reps"
  let m = text.match(/body\s*weight\s*(?:for\s*)?(\d+)/);
  if (m) return sane(null, Number(m[1]));

  // "80 for 8", "82.5 kg for 6", "80 by 8", "80 x 8", "80 times 8"
  m = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)?\s*(?:for|by|x|times)\s*(\d+)\b/);
  if (m) return sane(Number(m[1]), Number(m[2]));

  // "12 reps at 40", "8 reps with 60 kg"
  m = text.match(/(\d+)\s*reps?\s*(?:at|with|on)\s*(\d+(?:\.\d+)?)/);
  if (m) return sane(Number(m[2]), Number(m[1]));

  // "60 kg 8 reps"
  m = text.match(/(\d+(?:\.\d+)?)\s*(?:kg|kilos?|kgs)\s*(\d+)\s*reps?/);
  if (m) return sane(Number(m[1]), Number(m[2]));

  // Fallback: exactly two numbers anywhere → larger is the weight.
  const nums = text.match(/\d+(?:\.\d+)?/g);
  if (nums && nums.length === 2) {
    const a = Number(nums[0]);
    const b = Number(nums[1]);
    const weight = Math.max(a, b);
    const reps = Math.min(a, b);
    if (weight !== reps) return sane(weight, Math.round(reps));
  }

  return null;
}
