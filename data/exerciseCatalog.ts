import { Exercise } from '../context/ExerciseContext';

// Maps main muscle group label → subgroup labels used in Exercise.muscle
export const MUSCLE_GROUPS: Record<string, string[]> = {
  'Chest':      ['Chest', 'Upper Chest', 'Lower Chest'],
  'Back':       ['Back', 'Lats', 'Upper Back', 'Lower Back'],
  'Shoulders':  ['Shoulders', 'Front Delts', 'Side Delts', 'Rear Delts'],
  'Arms':       ['Biceps', 'Triceps', 'Forearms'],
  'Legs':       ['Quads', 'Hamstrings', 'Glutes', 'Calves', 'Hip Adductors'],
  'Core':       ['Abs', 'Obliques', 'Core'],
  'Full Body':  ['Full Body'],
};

export const builtInExercises: Exercise[] = [
  // ── Upper Chest ────────────────────────────────────────────────────────────
  { id: 'incline-barbell-press',  name: 'Incline Barbell Press',        muscle: 'Upper Chest',   equipment: 'Barbell'    },
  { id: 'incline-db-press',       name: 'Incline Dumbbell Press',        muscle: 'Upper Chest',   equipment: 'Dumbbell'   },
  { id: 'incline-cable-fly',      name: 'Incline Cable Fly',             muscle: 'Upper Chest',   equipment: 'Cable'      },
  { id: 'landmine-press',         name: 'Landmine Press',                muscle: 'Upper Chest',   equipment: 'Barbell'    },
  { id: 'high-cable-fly',         name: 'High-to-Low Cable Fly',         muscle: 'Upper Chest',   equipment: 'Cable'      },
  { id: 'incline-smith-press',    name: 'Incline Smith Machine Press',   muscle: 'Upper Chest',   equipment: 'Machine'    },

  // ── Chest (mid) ────────────────────────────────────────────────────────────
  { id: 'bench-press',            name: 'Bench Press',                   muscle: 'Chest',         equipment: 'Barbell'    },
  { id: 'db-bench-press',         name: 'Dumbbell Bench Press',          muscle: 'Chest',         equipment: 'Dumbbell'   },
  { id: 'machine-chest-press',    name: 'Machine Chest Press',           muscle: 'Chest',         equipment: 'Machine'    },
  { id: 'cable-crossover',        name: 'Cable Crossover',               muscle: 'Chest',         equipment: 'Cable'      },
  { id: 'pec-deck-fly',           name: 'Pec Deck Fly',                  muscle: 'Chest',         equipment: 'Machine'    },
  { id: 'db-fly',                 name: 'Dumbbell Fly',                  muscle: 'Chest',         equipment: 'Dumbbell'   },
  { id: 'push-up',                name: 'Push-up',                       muscle: 'Chest',         equipment: 'Bodyweight' },
  { id: 'smith-bench-press',      name: 'Smith Machine Bench Press',     muscle: 'Chest',         equipment: 'Machine'    },

  // ── Lower Chest ────────────────────────────────────────────────────────────
  { id: 'decline-barbell-press',  name: 'Decline Barbell Press',         muscle: 'Lower Chest',   equipment: 'Barbell'    },
  { id: 'decline-db-press',       name: 'Decline Dumbbell Press',        muscle: 'Lower Chest',   equipment: 'Dumbbell'   },
  { id: 'low-cable-fly',          name: 'Low-to-High Cable Fly',         muscle: 'Lower Chest',   equipment: 'Cable'      },
  { id: 'chest-dip',              name: 'Chest Dip',                     muscle: 'Lower Chest',   equipment: 'Bodyweight' },

  // ── Lats ───────────────────────────────────────────────────────────────────
  { id: 'pull-up',                name: 'Pull-up',                       muscle: 'Lats',          equipment: 'Bodyweight' },
  { id: 'chin-up',                name: 'Chin-up',                       muscle: 'Lats',          equipment: 'Bodyweight' },
  { id: 'lat-pulldown',           name: 'Lat Pulldown',                  muscle: 'Lats',          equipment: 'Machine'    },
  { id: 'wide-grip-pulldown',     name: 'Wide-Grip Lat Pulldown',        muscle: 'Lats',          equipment: 'Machine'    },
  { id: 'close-grip-pulldown',    name: 'Close-Grip Lat Pulldown',       muscle: 'Lats',          equipment: 'Machine'    },
  { id: 'straight-arm-pulldown',  name: 'Straight-Arm Pulldown',         muscle: 'Lats',          equipment: 'Cable'      },
  { id: 'db-pullover',            name: 'Dumbbell Pullover',             muscle: 'Lats',          equipment: 'Dumbbell'   },
  { id: 'cable-pullover',         name: 'Cable Pullover',                muscle: 'Lats',          equipment: 'Cable'      },

  // ── Upper Back ─────────────────────────────────────────────────────────────
  { id: 'barbell-row',            name: 'Barbell Row',                   muscle: 'Upper Back',    equipment: 'Barbell'    },
  { id: 'db-row',                 name: 'Dumbbell Row',                  muscle: 'Upper Back',    equipment: 'Dumbbell'   },
  { id: 'seated-cable-row',       name: 'Seated Cable Row',              muscle: 'Upper Back',    equipment: 'Cable'      },
  { id: 't-bar-row',              name: 'T-Bar Row',                     muscle: 'Upper Back',    equipment: 'Barbell'    },
  { id: 'chest-supported-row',    name: 'Chest-Supported Row',           muscle: 'Upper Back',    equipment: 'Machine'    },
  { id: 'pendlay-row',            name: 'Pendlay Row',                   muscle: 'Upper Back',    equipment: 'Barbell'    },
  { id: 'meadows-row',            name: 'Meadows Row',                   muscle: 'Upper Back',    equipment: 'Barbell'    },
  { id: 'wide-cable-row',         name: 'Wide-Grip Cable Row',           muscle: 'Upper Back',    equipment: 'Cable'      },

  // ── Lower Back ─────────────────────────────────────────────────────────────
  { id: 'deadlift',               name: 'Deadlift',                      muscle: 'Lower Back',    equipment: 'Barbell'    },
  { id: 'hyperextension',         name: 'Hyperextension',                muscle: 'Lower Back',    equipment: 'Bodyweight' },
  { id: 'back-extension',         name: 'Back Extension',                muscle: 'Lower Back',    equipment: 'Machine'    },
  { id: 'good-morning',           name: 'Good Morning',                  muscle: 'Lower Back',    equipment: 'Barbell'    },
  { id: 'suitcase-deadlift',      name: 'Suitcase Deadlift',             muscle: 'Lower Back',    equipment: 'Dumbbell'   },
  { id: 'trap-bar-deadlift',      name: 'Trap Bar Deadlift',             muscle: 'Lower Back',    equipment: 'Barbell'    },

  // ── Front Delts ────────────────────────────────────────────────────────────
  { id: 'overhead-press',         name: 'Overhead Press',                muscle: 'Front Delts',   equipment: 'Barbell'    },
  { id: 'arnold-press',           name: 'Arnold Press',                  muscle: 'Front Delts',   equipment: 'Dumbbell'   },
  { id: 'db-overhead-press',      name: 'Dumbbell Overhead Press',       muscle: 'Front Delts',   equipment: 'Dumbbell'   },
  { id: 'db-front-raise',         name: 'Dumbbell Front Raise',          muscle: 'Front Delts',   equipment: 'Dumbbell'   },
  { id: 'cable-front-raise',      name: 'Cable Front Raise',             muscle: 'Front Delts',   equipment: 'Cable'      },
  { id: 'smith-ohp',              name: 'Smith Machine Press',           muscle: 'Front Delts',   equipment: 'Machine'    },
  { id: 'plate-front-raise',      name: 'Plate Front Raise',             muscle: 'Front Delts',   equipment: 'Barbell'    },

  // ── Side Delts ─────────────────────────────────────────────────────────────
  { id: 'db-lateral-raise',       name: 'Dumbbell Lateral Raise',        muscle: 'Side Delts',    equipment: 'Dumbbell'   },
  { id: 'cable-lateral-raise',    name: 'Cable Lateral Raise',           muscle: 'Side Delts',    equipment: 'Cable'      },
  { id: 'machine-lateral-raise',  name: 'Machine Lateral Raise',         muscle: 'Side Delts',    equipment: 'Machine'    },
  { id: 'upright-row',            name: 'Upright Row',                   muscle: 'Side Delts',    equipment: 'Barbell'    },
  { id: 'seated-db-lateral',      name: 'Seated Lateral Raise',          muscle: 'Side Delts',    equipment: 'Dumbbell'   },
  { id: 'leaning-lateral-raise',  name: 'Leaning Lateral Raise',         muscle: 'Side Delts',    equipment: 'Dumbbell'   },

  // ── Rear Delts ─────────────────────────────────────────────────────────────
  { id: 'face-pull',              name: 'Face Pull',                     muscle: 'Rear Delts',    equipment: 'Cable'      },
  { id: 'rear-delt-fly',          name: 'Rear Delt Fly',                 muscle: 'Rear Delts',    equipment: 'Dumbbell'   },
  { id: 'reverse-pec-deck',       name: 'Reverse Pec Deck',              muscle: 'Rear Delts',    equipment: 'Machine'    },
  { id: 'band-pull-apart',        name: 'Band Pull-Apart',               muscle: 'Rear Delts',    equipment: 'Band'       },
  { id: 'bent-over-rear-raise',   name: 'Bent-Over Rear Raise',          muscle: 'Rear Delts',    equipment: 'Dumbbell'   },
  { id: 'cable-rear-delt-fly',    name: 'Cable Rear Delt Fly',           muscle: 'Rear Delts',    equipment: 'Cable'      },

  // ── Biceps ─────────────────────────────────────────────────────────────────
  { id: 'barbell-curl',           name: 'Barbell Curl',                  muscle: 'Biceps',        equipment: 'Barbell'    },
  { id: 'db-curl',                name: 'Dumbbell Curl',                 muscle: 'Biceps',        equipment: 'Dumbbell'   },
  { id: 'hammer-curl',            name: 'Hammer Curl',                   muscle: 'Biceps',        equipment: 'Dumbbell'   },
  { id: 'preacher-curl',          name: 'Preacher Curl',                 muscle: 'Biceps',        equipment: 'Barbell'    },
  { id: 'incline-db-curl',        name: 'Incline Dumbbell Curl',         muscle: 'Biceps',        equipment: 'Dumbbell'   },
  { id: 'cable-curl',             name: 'Cable Curl',                    muscle: 'Biceps',        equipment: 'Cable'      },
  { id: 'concentration-curl',     name: 'Concentration Curl',            muscle: 'Biceps',        equipment: 'Dumbbell'   },
  { id: 'spider-curl',            name: 'Spider Curl',                   muscle: 'Biceps',        equipment: 'Dumbbell'   },
  { id: 'ez-bar-curl',            name: 'EZ-Bar Curl',                   muscle: 'Biceps',        equipment: 'EZ-Bar'     },
  { id: 'machine-curl',           name: 'Machine Curl',                  muscle: 'Biceps',        equipment: 'Machine'    },
  { id: 'reverse-curl',           name: 'Reverse Curl',                  muscle: 'Biceps',        equipment: 'Barbell'    },

  // ── Triceps ────────────────────────────────────────────────────────────────
  { id: 'tricep-pushdown',        name: 'Tricep Pushdown',               muscle: 'Triceps',       equipment: 'Cable'      },
  { id: 'overhead-tricep-ext',    name: 'Overhead Tricep Extension',     muscle: 'Triceps',       equipment: 'Cable'      },
  { id: 'skull-crusher',          name: 'Skull Crusher',                 muscle: 'Triceps',       equipment: 'Barbell'    },
  { id: 'close-grip-bench',       name: 'Close-Grip Bench Press',        muscle: 'Triceps',       equipment: 'Barbell'    },
  { id: 'db-tricep-kickback',     name: 'Dumbbell Kickback',             muscle: 'Triceps',       equipment: 'Dumbbell'   },
  { id: 'tricep-dip',             name: 'Tricep Dip',                    muscle: 'Triceps',       equipment: 'Bodyweight' },
  { id: 'overhead-db-ext',        name: 'Overhead DB Extension',         muscle: 'Triceps',       equipment: 'Dumbbell'   },
  { id: 'cable-overhead-ext',     name: 'Cable Overhead Extension',      muscle: 'Triceps',       equipment: 'Cable'      },
  { id: 'diamond-push-up',        name: 'Diamond Push-up',               muscle: 'Triceps',       equipment: 'Bodyweight' },
  { id: 'rope-pushdown',          name: 'Rope Pushdown',                 muscle: 'Triceps',       equipment: 'Cable'      },

  // ── Forearms ───────────────────────────────────────────────────────────────
  { id: 'wrist-curl',             name: 'Wrist Curl',                    muscle: 'Forearms',      equipment: 'Barbell'    },
  { id: 'reverse-wrist-curl',     name: 'Reverse Wrist Curl',            muscle: 'Forearms',      equipment: 'Barbell'    },
  { id: 'farmers-walk',           name: "Farmer's Walk",                 muscle: 'Forearms',      equipment: 'Dumbbell'   },
  { id: 'dead-hang',              name: 'Dead Hang',                     muscle: 'Forearms',      equipment: 'Bodyweight' },
  { id: 'plate-pinch',            name: 'Plate Pinch',                   muscle: 'Forearms',      equipment: 'Barbell'    },

  // ── Quads ──────────────────────────────────────────────────────────────────
  { id: 'back-squat',             name: 'Back Squat',                    muscle: 'Quads',         equipment: 'Barbell'    },
  { id: 'front-squat',            name: 'Front Squat',                   muscle: 'Quads',         equipment: 'Barbell'    },
  { id: 'leg-press',              name: 'Leg Press',                     muscle: 'Quads',         equipment: 'Machine'    },
  { id: 'leg-extension',          name: 'Leg Extension',                 muscle: 'Quads',         equipment: 'Machine'    },
  { id: 'hack-squat',             name: 'Hack Squat',                    muscle: 'Quads',         equipment: 'Machine'    },
  { id: 'bulgarian-split-squat',  name: 'Bulgarian Split Squat',         muscle: 'Quads',         equipment: 'Dumbbell'   },
  { id: 'walking-lunge',          name: 'Walking Lunge',                 muscle: 'Quads',         equipment: 'Dumbbell'   },
  { id: 'step-up',                name: 'Step-Up',                       muscle: 'Quads',         equipment: 'Dumbbell'   },
  { id: 'goblet-squat',           name: 'Goblet Squat',                  muscle: 'Quads',         equipment: 'Dumbbell'   },
  { id: 'sissy-squat',            name: 'Sissy Squat',                   muscle: 'Quads',         equipment: 'Bodyweight' },
  { id: 'smith-squat',            name: 'Smith Machine Squat',           muscle: 'Quads',         equipment: 'Machine'    },
  { id: 'box-squat',              name: 'Box Squat',                     muscle: 'Quads',         equipment: 'Barbell'    },

  // ── Hamstrings ─────────────────────────────────────────────────────────────
  { id: 'romanian-deadlift',      name: 'Romanian Deadlift',             muscle: 'Hamstrings',    equipment: 'Barbell'    },
  { id: 'leg-curl',               name: 'Lying Leg Curl',                muscle: 'Hamstrings',    equipment: 'Machine'    },
  { id: 'seated-leg-curl',        name: 'Seated Leg Curl',               muscle: 'Hamstrings',    equipment: 'Machine'    },
  { id: 'nordic-curl',            name: 'Nordic Curl',                   muscle: 'Hamstrings',    equipment: 'Bodyweight' },
  { id: 'stiff-leg-deadlift',     name: 'Stiff-Leg Deadlift',            muscle: 'Hamstrings',    equipment: 'Barbell'    },
  { id: 'glute-ham-raise',        name: 'Glute-Ham Raise',               muscle: 'Hamstrings',    equipment: 'Machine'    },
  { id: 'single-leg-rdl',         name: 'Single-Leg Romanian Deadlift',  muscle: 'Hamstrings',    equipment: 'Dumbbell'   },

  // ── Glutes ─────────────────────────────────────────────────────────────────
  { id: 'hip-thrust',             name: 'Barbell Hip Thrust',            muscle: 'Glutes',        equipment: 'Barbell'    },
  { id: 'glute-bridge',           name: 'Glute Bridge',                  muscle: 'Glutes',        equipment: 'Bodyweight' },
  { id: 'cable-kickback',         name: 'Cable Kickback',                muscle: 'Glutes',        equipment: 'Cable'      },
  { id: 'sumo-deadlift',          name: 'Sumo Deadlift',                 muscle: 'Glutes',        equipment: 'Barbell'    },
  { id: 'abductor-machine',       name: 'Hip Abductor Machine',          muscle: 'Glutes',        equipment: 'Machine'    },
  { id: 'single-leg-hip-thrust',  name: 'Single-Leg Hip Thrust',         muscle: 'Glutes',        equipment: 'Bodyweight' },
  { id: 'donkey-kick',            name: 'Donkey Kick',                   muscle: 'Glutes',        equipment: 'Bodyweight' },
  { id: 'lateral-band-walk',      name: 'Lateral Band Walk',             muscle: 'Glutes',        equipment: 'Band'       },

  // ── Calves ─────────────────────────────────────────────────────────────────
  { id: 'standing-calf-raise',    name: 'Standing Calf Raise',           muscle: 'Calves',        equipment: 'Machine'    },
  { id: 'seated-calf-raise',      name: 'Seated Calf Raise',             muscle: 'Calves',        equipment: 'Machine'    },
  { id: 'leg-press-calf-raise',   name: 'Leg Press Calf Raise',          muscle: 'Calves',        equipment: 'Machine'    },
  { id: 'single-leg-calf-raise',  name: 'Single-Leg Calf Raise',         muscle: 'Calves',        equipment: 'Bodyweight' },
  { id: 'jump-rope',              name: 'Jump Rope',                     muscle: 'Calves',        equipment: 'Bodyweight' },

  // ── Hip Adductors ──────────────────────────────────────────────────────────
  { id: 'adductor-machine',       name: 'Hip Adductor Machine',          muscle: 'Hip Adductors', equipment: 'Machine'    },
  { id: 'sumo-squat',             name: 'Sumo Squat',                    muscle: 'Hip Adductors', equipment: 'Dumbbell'   },
  { id: 'lateral-lunge',          name: 'Lateral Lunge',                 muscle: 'Hip Adductors', equipment: 'Bodyweight' },
  { id: 'cable-hip-adduction',    name: 'Cable Hip Adduction',           muscle: 'Hip Adductors', equipment: 'Cable'      },

  // ── Abs ────────────────────────────────────────────────────────────────────
  { id: 'crunch',                 name: 'Crunch',                        muscle: 'Abs',           equipment: 'Bodyweight' },
  { id: 'cable-crunch',           name: 'Cable Crunch',                  muscle: 'Abs',           equipment: 'Cable'      },
  { id: 'leg-raise',              name: 'Lying Leg Raise',               muscle: 'Abs',           equipment: 'Bodyweight' },
  { id: 'hanging-leg-raise',      name: 'Hanging Leg Raise',             muscle: 'Abs',           equipment: 'Bodyweight' },
  { id: 'ab-rollout',             name: 'Ab Wheel Rollout',              muscle: 'Abs',           equipment: 'Bodyweight' },
  { id: 'plank',                  name: 'Plank',                         muscle: 'Abs',           equipment: 'Bodyweight' },
  { id: 'dragon-flag',            name: 'Dragon Flag',                   muscle: 'Abs',           equipment: 'Bodyweight' },
  { id: 'decline-sit-up',         name: 'Decline Sit-up',               muscle: 'Abs',           equipment: 'Bodyweight' },
  { id: 'v-up',                   name: 'V-Up',                          muscle: 'Abs',           equipment: 'Bodyweight' },
  { id: 'machine-crunch',         name: 'Machine Crunch',                muscle: 'Abs',           equipment: 'Machine'    },

  // ── Obliques ───────────────────────────────────────────────────────────────
  { id: 'russian-twist',          name: 'Russian Twist',                 muscle: 'Obliques',      equipment: 'Bodyweight' },
  { id: 'side-plank',             name: 'Side Plank',                    muscle: 'Obliques',      equipment: 'Bodyweight' },
  { id: 'cable-woodchop',         name: 'Cable Woodchop',                muscle: 'Obliques',      equipment: 'Cable'      },
  { id: 'oblique-crunch',         name: 'Oblique Crunch',                muscle: 'Obliques',      equipment: 'Bodyweight' },
  { id: 'bicycle-crunch',         name: 'Bicycle Crunch',                muscle: 'Obliques',      equipment: 'Bodyweight' },
  { id: 'db-side-bend',           name: 'Dumbbell Side Bend',            muscle: 'Obliques',      equipment: 'Dumbbell'   },

  // ── Core (stability) ───────────────────────────────────────────────────────
  { id: 'dead-bug',               name: 'Dead Bug',                      muscle: 'Core',          equipment: 'Bodyweight' },
  { id: 'pallof-press',           name: 'Pallof Press',                  muscle: 'Core',          equipment: 'Cable'      },
  { id: 'hollow-hold',            name: 'Hollow Hold',                   muscle: 'Core',          equipment: 'Bodyweight' },
  { id: 'bird-dog',               name: 'Bird Dog',                      muscle: 'Core',          equipment: 'Bodyweight' },
  { id: 'suitcase-carry',         name: 'Suitcase Carry',                muscle: 'Core',          equipment: 'Dumbbell'   },

  // ── Full Body ──────────────────────────────────────────────────────────────
  { id: 'barbell-clean',          name: 'Barbell Clean',                 muscle: 'Full Body',     equipment: 'Barbell'    },
  { id: 'clean-and-jerk',         name: 'Clean and Jerk',                muscle: 'Full Body',     equipment: 'Barbell'    },
  { id: 'snatch',                 name: 'Snatch',                        muscle: 'Full Body',     equipment: 'Barbell'    },
  { id: 'thruster',               name: 'Thruster',                      muscle: 'Full Body',     equipment: 'Barbell'    },
  { id: 'kb-swing',               name: 'Kettlebell Swing',              muscle: 'Full Body',     equipment: 'Kettlebell' },
  { id: 'turkish-get-up',         name: 'Turkish Get-Up',                muscle: 'Full Body',     equipment: 'Kettlebell' },
  { id: 'burpee',                 name: 'Burpee',                        muscle: 'Full Body',     equipment: 'Bodyweight' },
  { id: 'man-maker',              name: 'Man Maker',                     muscle: 'Full Body',     equipment: 'Dumbbell'   },
];

function pick(...ids: string[]): Exercise[] {
  return ids
    .map((id) => builtInExercises.find((e) => e.id === id))
    .filter((e): e is Exercise => !!e);
}

export function getStarterTemplates() {
  const createdAt = new Date().toISOString();
  return [
    {
      id: 'starter-push',
      name: 'Push Day',
      notes: 'Chest, shoulders, and triceps focus.',
      exercises: pick('bench-press', 'incline-db-press', 'machine-chest-press', 'cable-lateral-raise', 'overhead-press', 'tricep-pushdown'),
      createdAt,
    },
    {
      id: 'starter-pull',
      name: 'Pull Day',
      notes: 'Back, rear delts, and biceps focus.',
      exercises: pick('barbell-row', 'lat-pulldown', 'seated-cable-row', 'face-pull', 'barbell-curl', 'hammer-curl'),
      createdAt,
    },
    {
      id: 'starter-legs',
      name: 'Leg Day',
      notes: 'Quads, hamstrings, and calves focus.',
      exercises: pick('back-squat', 'leg-press', 'romanian-deadlift', 'leg-curl', 'leg-extension', 'standing-calf-raise'),
      createdAt,
    },
    {
      id: 'starter-upper',
      name: 'Upper Day',
      notes: 'Full upper body session.',
      exercises: pick('bench-press', 'barbell-row', 'overhead-press', 'lat-pulldown', 'tricep-pushdown', 'barbell-curl'),
      createdAt,
    },
  ];
}
