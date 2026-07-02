// Warm-up moves (dynamic, pre-lift) and cool-down stretches (static, post-lift)
// mapped to the muscle values used in exerciseCatalog. Research basis:
// - Dynamic general + specific warm-up improves performance and lowers injury
//   risk (Fradkin 2010; McGowan 2015).
// - Static stretching belongs AFTER training — done pre-lift it acutely
//   reduces strength (Behm & Chaouachi 2011).

export type MobilityMove = {
  id: string;
  name: string;
  seconds: number;
  /** Muscle values (from exerciseCatalog) this move prepares or stretches. */
  targets: string[];
};

// ── Always-first general ramp ─────────────────────────────────────────────────
export const GENERAL_WARMUP: MobilityMove[] = [
  { id: 'cardio-ramp', name: 'Light cardio — jumping jacks, bike, or rower', seconds: 150, targets: ['Full Body'] },
  { id: 'arm-circles', name: 'Arm circles, both directions', seconds: 40, targets: ['Chest', 'Upper Chest', 'Front Delts', 'Side Delts', 'Rear Delts', 'Shoulders'] },
];

// ── Muscle-specific dynamic warm-up moves ─────────────────────────────────────
export const WARMUP_MOVES: MobilityMove[] = [
  { id: 'pushup-ramp',      name: 'Easy push-ups × 10 (slow, full range)',      seconds: 45, targets: ['Chest', 'Upper Chest', 'Lower Chest', 'Front Delts', 'Triceps'] },
  { id: 'chest-swings',     name: 'Dynamic chest openers (arm swings across)',  seconds: 40, targets: ['Chest', 'Upper Chest', 'Lower Chest'] },
  { id: 'band-pullaparts',  name: 'Band pull-aparts (or prone Y-raises)',       seconds: 45, targets: ['Upper Back', 'Rear Delts', 'Shoulders'] },
  { id: 'scap-hangs',       name: 'Scapular pulls on the bar (or lat pulldown ramp)', seconds: 40, targets: ['Lats', 'Upper Back', 'Back'] },
  { id: 'cat-cow',          name: 'Cat–cow spine rolls',                        seconds: 45, targets: ['Lower Back', 'Core', 'Back'] },
  { id: 'bird-dog',         name: 'Bird-dogs, slow and controlled',             seconds: 45, targets: ['Lower Back', 'Core', 'Abs'] },
  { id: 'pass-throughs',    name: 'Shoulder pass-throughs (band or broomstick)', seconds: 45, targets: ['Front Delts', 'Side Delts', 'Rear Delts', 'Shoulders'] },
  { id: 'wall-slides',      name: 'Wall slides',                                seconds: 40, targets: ['Side Delts', 'Upper Back', 'Shoulders'] },
  { id: 'wrist-circles',    name: 'Wrist circles + light forearm rocks',        seconds: 30, targets: ['Forearms', 'Biceps'] },
  { id: 'curl-ramp',        name: 'Very light curl ramp × 15',                  seconds: 35, targets: ['Biceps', 'Forearms'] },
  { id: 'pushdown-ramp',    name: 'Very light pushdown ramp × 15',              seconds: 35, targets: ['Triceps'] },
  { id: 'bw-squats',        name: 'Bodyweight squats × 15',                     seconds: 50, targets: ['Quads', 'Glutes', 'Hip Adductors'] },
  { id: 'leg-swings',       name: 'Leg swings, front-to-back + side-to-side',   seconds: 45, targets: ['Hamstrings', 'Quads', 'Hip Adductors', 'Glutes'] },
  { id: 'walking-lunge-wu', name: 'Walking lunges, bodyweight × 10',            seconds: 45, targets: ['Quads', 'Glutes'] },
  { id: 'inchworms',        name: 'Inchworms (walkouts)',                       seconds: 50, targets: ['Hamstrings', 'Core', 'Full Body'] },
  { id: 'glute-bridges',    name: 'Glute bridges × 15',                         seconds: 45, targets: ['Glutes', 'Hamstrings', 'Lower Back'] },
  { id: 'hip-circles',      name: 'Hip circles, both directions',               seconds: 30, targets: ['Glutes', 'Hip Adductors'] },
  { id: 'ankle-calf-prep',  name: 'Ankle circles + bodyweight calf raises',     seconds: 40, targets: ['Calves'] },
  { id: 'side-lunges',      name: 'Side lunges (cossack style)',                seconds: 45, targets: ['Hip Adductors', 'Quads', 'Glutes'] },
  { id: 'torso-twists',     name: 'Standing torso twists',                      seconds: 30, targets: ['Obliques', 'Abs', 'Core'] },
  { id: 'dead-bugs',        name: 'Dead bugs, slow',                            seconds: 45, targets: ['Abs', 'Core'] },
];

// ── Static cool-down stretches (hold ~30s) ────────────────────────────────────
export const COOLDOWN_MOVES: MobilityMove[] = [
  { id: 'doorway-pec',      name: 'Doorway pec stretch, each side',             seconds: 60, targets: ['Chest', 'Upper Chest', 'Lower Chest', 'Front Delts'] },
  { id: 'childs-pose',      name: "Child's pose with side reach",               seconds: 50, targets: ['Lats', 'Lower Back', 'Back'] },
  { id: 'rack-lat-stretch', name: 'Lat stretch hanging on the rack, each side', seconds: 60, targets: ['Lats', 'Upper Back', 'Back'] },
  { id: 'knees-to-chest',   name: 'Knees-to-chest hold',                        seconds: 40, targets: ['Lower Back'] },
  { id: 'crossbody-delt',   name: 'Cross-body shoulder stretch, each side',     seconds: 60, targets: ['Side Delts', 'Rear Delts', 'Shoulders'] },
  { id: 'oh-triceps',       name: 'Overhead triceps stretch, each side',        seconds: 60, targets: ['Triceps'] },
  { id: 'wall-biceps',      name: 'Wall biceps + wrist flexor stretch',         seconds: 45, targets: ['Biceps', 'Forearms'] },
  { id: 'standing-quad',    name: 'Standing quad stretch, each side',           seconds: 60, targets: ['Quads'] },
  { id: 'ham-stretch',      name: 'Standing hamstring stretch, each side',      seconds: 60, targets: ['Hamstrings'] },
  { id: 'figure-four',      name: 'Figure-4 glute stretch, each side',          seconds: 60, targets: ['Glutes'] },
  { id: 'wall-calf',        name: 'Wall calf stretch, each side',               seconds: 50, targets: ['Calves'] },
  { id: 'butterfly',        name: 'Butterfly (adductor) stretch',               seconds: 45, targets: ['Hip Adductors'] },
  { id: 'cobra',            name: 'Cobra stretch',                              seconds: 40, targets: ['Abs', 'Obliques', 'Core'] },
];

// ── Plan generation ───────────────────────────────────────────────────────────
// Greedy set-cover: prefer moves that prepare the most muscles the session
// actually uses, stop at the time cap, and make sure every trained muscle is
// covered at least once when a move for it exists.

function buildPlan(
  pool: MobilityMove[],
  muscles: string[],
  capSeconds: number
): MobilityMove[] {
  const wanted = new Map<string, number>(); // muscle → frequency in session
  for (const m of muscles) wanted.set(m, (wanted.get(m) ?? 0) + 1);

  const plan: MobilityMove[] = [];
  const covered = new Set<string>();
  let total = 0;

  // Uncovered muscles weigh 10× so coverage comes first, but once everything
  // is covered we keep adding relevant moves until the time cap is reached.
  const score = (move: MobilityMove) =>
    move.targets.reduce((s, t) => {
      if (!wanted.has(t)) return s;
      return s + wanted.get(t)! * (covered.has(t) ? 1 : 10);
    }, 0);

  const remaining = [...pool];
  while (total < capSeconds) {
    remaining.sort((a, b) => score(b) - score(a));
    const best = remaining[0];
    if (!best || score(best) === 0) break;
    if (total + best.seconds > capSeconds && plan.length > 0) break;

    plan.push(best);
    total += best.seconds;
    for (const t of best.targets) covered.add(t);
    remaining.shift();
  }

  return plan;
}

export function generateWarmupPlan(
  muscles: string[],
  capSeconds = 600 // ~10 minutes including the general ramp
): MobilityMove[] {
  const generalSeconds = GENERAL_WARMUP.reduce((s, m) => s + m.seconds, 0);
  const specific = buildPlan(WARMUP_MOVES, muscles, capSeconds - generalSeconds);
  return [...GENERAL_WARMUP, ...specific];
}

export function generateCooldownPlan(
  muscles: string[],
  capSeconds = 330 // ~5 minutes of static holds
): MobilityMove[] {
  return buildPlan(COOLDOWN_MOVES, muscles, capSeconds);
}

export function planMinutes(plan: MobilityMove[]): number {
  return Math.round(plan.reduce((s, m) => s + m.seconds, 0) / 60);
}
