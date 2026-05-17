import { DailyTargets } from '../context/NutritionContext';

export type UserGoal = 'fat_loss' | 'lean_bulk' | 'maintenance' | 'recomp';

export const GOAL_META: Record<UserGoal, {
  label: string;
  tag: string;
  description: string;
  calDelta: number;
  tagColor: string;
}> = {
  fat_loss:    {
    label: 'Fat Loss',
    tag: '−400 kcal',
    description: 'Caloric deficit · high protein to preserve muscle while losing fat',
    calDelta: -400,
    tagColor: '#EF4444',
  },
  lean_bulk:   {
    label: 'Lean Bulk',
    tag: '+300 kcal',
    description: 'Controlled surplus · build muscle with minimal fat gain',
    calDelta: 300,
    tagColor: '#22C55E',
  },
  maintenance: {
    label: 'Maintenance',
    tag: 'TDEE',
    description: 'Match your daily burn · balanced macros for body recomposition',
    calDelta: 0,
    tagColor: '#3B82F6',
  },
  recomp:      {
    label: 'Recomposition',
    tag: 'TDEE',
    description: 'Very high protein · simultaneously lose fat and gain muscle',
    calDelta: 0,
    tagColor: '#A855F7',
  },
};

// Katch-McArdle BMR × 1.55 moderate activity. Returns null when bodyFat is unavailable.
export function computeMaintenanceCal(weight: number, bodyFat: number | null): number | null {
  if (!bodyFat) return null;
  const lbm = weight * (1 - bodyFat / 100);
  return Math.round((370 + 21.6 * lbm) * 1.55);
}

// Estimate maintenance without body fat using a simple weight-based formula.
function estimateMaintenanceCal(weight: number): number {
  return Math.round(weight * 46.5); // ≈ 30 kcal/kg × 1.55 activity multiplier
}

export function computeGoalTargets(
  goal: UserGoal,
  weight: number,
  bodyFat: number | null,
): DailyTargets {
  const maint = computeMaintenanceCal(weight, bodyFat) ?? estimateMaintenanceCal(weight);
  // Use LBM for protein when body fat is available; body weight otherwise
  const proteinBase = bodyFat != null ? weight * (1 - bodyFat / 100) : weight;

  const { calDelta } = GOAL_META[goal];
  const proteinMult: Record<UserGoal, number> = {
    fat_loss: 2.2, lean_bulk: 1.8, maintenance: 1.6, recomp: 2.4,
  };
  const fatMult: Record<UserGoal, number> = {
    fat_loss: 0.8, lean_bulk: 1.0, maintenance: 0.9, recomp: 0.9,
  };

  const calories = Math.max(1200, maint + calDelta);
  const protein  = Math.round(proteinMult[goal] * proteinBase);
  const fat      = Math.round(fatMult[goal] * weight);
  const carbs    = Math.max(0, Math.round((calories - protein * 4 - fat * 9) / 4));

  return { calories, protein, carbs, fat, fiber: 30, sodium: 2300 };
}
