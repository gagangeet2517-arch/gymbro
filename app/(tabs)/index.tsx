import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Clipboard from 'expo-clipboard';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  InputAccessoryView,
  Keyboard,
  Linking,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  UIManager,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import FeatureHint from '../../components/ui/FeatureHint';
import PressableScale from '../../components/ui/PressableScale';
import { useBodyMetrics } from '../../context/BodyMetricsContext';
import { useNutrition } from '../../context/NutritionContext';
import { Template, useTemplates } from '../../context/TemplateContext';
import {
  LifestyleGoal,
  ReminderConfig,
  ReminderInterval,
  UserGoal,
  useUserProfile,
} from '../../context/UserProfileContext';
import {
  ActiveWorkoutExercise,
  type CompletedWorkout,
  useWorkout,
} from '../../context/WorkoutContext';
import { MUSCLE_GROUPS } from '../../data/exerciseCatalog';
import {
  GOAL_META,
  computeGoalTargets,
  computeMaintenanceCal,
} from '../../utils/nutritionGoals';
import { markFeatureSeen } from '../../utils/featureHints';
import { syncReminders } from '../../utils/reminders';
import { loadUserGeminiKey, setUserGeminiKey } from '../../utils/userApiKey';

// Build reverse map: muscle subgroup → main group label (e.g. 'Quads' → 'Legs')
const MUSCLE_TO_GROUP: Map<string, string> = (() => {
  const m = new Map<string, string>();
  for (const [group, subs] of Object.entries(MUSCLE_GROUPS)) {
    for (const sub of subs) m.set(sub, group);
  }
  return m;
})();

function groupOf(muscle: string): string {
  return MUSCLE_TO_GROUP.get(muscle) ?? muscle;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:           '#080A0F',
  surface:      '#0F1117',
  surfaceAlt:   '#13151D',
  elevated:     '#161820',
  border:       '#1E2130',
  borderSub:    '#252838',
  text:         '#F0F4FF',
  textSub:      '#8892A4',
  textMuted:    '#515B6C',
  accent:       '#22C55E',
  accentDim:    'rgba(34,197,94,0.12)',
  accentBorder: 'rgba(34,197,94,0.30)',
  blue:         '#3B82F6',
  blueDim:      'rgba(59,130,246,0.12)',
  blueBorder:   'rgba(59,130,246,0.30)',
  amber:        '#F59E0B',
  amberDim:     'rgba(245,158,11,0.12)',
  amberBorder:  'rgba(245,158,11,0.30)',
  red:          '#EF4444',
  redDim:       'rgba(239,68,68,0.12)',
  redBorder:    'rgba(239,68,68,0.30)',
  purple:       '#A855F7',
  purpleDim:    'rgba(168,85,247,0.12)',
  purpleBorder: 'rgba(168,85,247,0.30)',
} as const;

// Enable smooth expand/collapse on Android.
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LIFESTYLE_META: Record<
  LifestyleGoal,
  { label: string; icon: keyof typeof Ionicons.glyphMap; desc: string; color: string }
> = {
  hydration:   { label: 'Hydration',   icon: 'water-outline', desc: 'Drink enough water each day',     color: '#3B82F6' },
  steps:       { label: 'Daily steps', icon: 'walk-outline',  desc: 'Hit a daily step target',         color: '#22C55E' },
  sleep:       { label: 'Sleep',       icon: 'moon-outline',  desc: 'Keep a consistent sleep schedule', color: '#A855F7' },
  consistency: { label: 'Consistency', icon: 'flame-outline', desc: 'Train regularly every week',       color: '#F59E0B' },
};

const INTERVAL_LABEL: Record<ReminderInterval, string> = {
  daily: 'Daily', weekly: 'Weekly', monthly: 'Monthly',
};

function fmtTime(hour: number, minute: number): string {
  const h = ((hour + 11) % 12) + 1;
  const ampm = hour < 12 ? 'AM' : 'PM';
  return `${h}:${String(minute).padStart(2, '0')} ${ampm}`;
}

// Collapsible section header used for the profile "dropdowns".
function DropdownHeader({
  label, value, open, onPress,
}: { label: string; value: string; open: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity style={ps.ddHeader} activeOpacity={0.8} onPress={onPress}>
      <View style={{ flex: 1 }}>
        <Text style={ps.ddLabel}>{label}</Text>
        <Text style={ps.ddValue} numberOfLines={1}>{value}</Text>
      </View>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={C.textSub} />
    </TouchableOpacity>
  );
}

// Small ± stepper for the hour/minute of a reminder time.
function TimeStepper({
  hour, minute, onChange,
}: { hour: number; minute: number; onChange: (h: number, m: number) => void }) {
  const bump = (field: 'h' | 'm', dir: 1 | -1) => {
    if (field === 'h') onChange((hour + dir + 24) % 24, minute);
    else onChange(hour, (minute + dir * 5 + 60) % 60);
  };
  return (
    <View style={ps.timeRow}>
      <View style={ps.timeUnit}>
        <TouchableOpacity style={ps.timeBtn} onPress={() => bump('h', 1)} activeOpacity={0.7}>
          <Ionicons name="chevron-up" size={14} color={C.textSub} />
        </TouchableOpacity>
        <Text style={ps.timeVal}>{String(((hour + 11) % 12) + 1).padStart(2, '0')}</Text>
        <TouchableOpacity style={ps.timeBtn} onPress={() => bump('h', -1)} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={14} color={C.textSub} />
        </TouchableOpacity>
      </View>
      <Text style={ps.timeColon}>:</Text>
      <View style={ps.timeUnit}>
        <TouchableOpacity style={ps.timeBtn} onPress={() => bump('m', 1)} activeOpacity={0.7}>
          <Ionicons name="chevron-up" size={14} color={C.textSub} />
        </TouchableOpacity>
        <Text style={ps.timeVal}>{String(minute).padStart(2, '0')}</Text>
        <TouchableOpacity style={ps.timeBtn} onPress={() => bump('m', -1)} activeOpacity={0.7}>
          <Ionicons name="chevron-down" size={14} color={C.textSub} />
        </TouchableOpacity>
      </View>
      <Text style={ps.timeAmPm}>{hour < 12 ? 'AM' : 'PM'}</Text>
    </View>
  );
}

// One reminder configuration row: enable switch + time + optional interval.
function ReminderRow({
  title, subtitle, config, onChange, showInterval,
}: {
  title: string;
  subtitle: string;
  config: ReminderConfig;
  onChange: (c: ReminderConfig) => void;
  showInterval: boolean;
}) {
  return (
    <View style={ps.remCard}>
      <View style={ps.remTopRow}>
        <View style={{ flex: 1 }}>
          <Text style={ps.remTitle}>{title}</Text>
          <Text style={ps.remSub}>
            {config.enabled
              ? `${showInterval ? INTERVAL_LABEL[config.interval] + ' · ' : ''}${fmtTime(config.hour, config.minute)}`
              : subtitle}
          </Text>
        </View>
        <Switch
          value={config.enabled}
          onValueChange={(v) => onChange({ ...config, enabled: v })}
          trackColor={{ false: C.border, true: C.accent }}
          thumbColor="#fff"
        />
      </View>

      {config.enabled && (
        <View style={ps.remBody}>
          <TimeStepper
            hour={config.hour}
            minute={config.minute}
            onChange={(h, m) => onChange({ ...config, hour: h, minute: m })}
          />
          {showInterval && (
            <View style={ps.segRow}>
              {(['daily', 'weekly', 'monthly'] as ReminderInterval[]).map((iv) => {
                const on = config.interval === iv;
                return (
                  <TouchableOpacity
                    key={iv}
                    style={[ps.segBtn, on && ps.segBtnOn]}
                    activeOpacity={0.8}
                    onPress={() => onChange({ ...config, interval: iv })}
                  >
                    <Text style={[ps.segText, on && ps.segTextOn]}>{INTERVAL_LABEL[iv]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          <View>
            <Text style={ps.remFieldLbl}>{showInterval ? 'Your goal' : 'Reminder message'}</Text>
            <TextInput
              style={ps.remInput}
              value={config.message ?? ''}
              onChangeText={(t) => onChange({ ...config, message: t })}
              placeholder={showInterval ? 'e.g. Lose 5 kg by August 1st' : 'e.g. Hit 180g protein today'}
              placeholderTextColor={C.textMuted}
              keyboardAppearance="dark"
              returnKeyType="done"
              maxLength={120}
              inputAccessoryViewID={PROFILE_KBD_ID}
            />
            <Text style={ps.remHint}>
              {(config.message ?? '').trim()
                ? 'This text shows in the notification.'
                : 'Leave blank to use the default reminder text.'}
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Movement classification ──────────────────────────────────────────────────

const PUSH = new Set([
  'Chest', 'Upper Chest', 'Lower Chest',
  'Front Delts', 'Side Delts', 'Shoulders',
  'Triceps',
]);
const PULL = new Set([
  'Back', 'Lats', 'Upper Back', 'Lower Back',
  'Rear Delts', 'Biceps', 'Forearms',
]);
const LEGS = new Set([
  'Quads', 'Hamstrings', 'Glutes', 'Calves', 'Hip Adductors',
]);

type Pattern = 'Push' | 'Pull' | 'Legs' | 'Mixed';

function classifyMuscles(muscles: string[]): Pattern {
  const counts = { Push: 0, Pull: 0, Legs: 0 };
  for (const m of muscles) {
    if (PUSH.has(m)) counts.Push++;
    else if (PULL.has(m)) counts.Pull++;
    else if (LEGS.has(m)) counts.Legs++;
  }
  const total = counts.Push + counts.Pull + counts.Legs;
  if (total === 0) return 'Mixed';
  const sorted = (Object.entries(counts) as [Pattern, number][]).sort((a, b) => b[1] - a[1]);
  return sorted[0][1] / total >= 0.55 ? sorted[0][0] : 'Mixed';
}

function classifyTemplate(t: Template): Pattern {
  return classifyMuscles(t.exercises.map((e) => e.muscle));
}

function classifyWorkout(w: CompletedWorkout): Pattern {
  return classifyMuscles(w.exercises.map((e) => e.muscle));
}

function nextOrder(last: Pattern): Pattern[] {
  switch (last) {
    case 'Push':  return ['Pull', 'Legs', 'Mixed', 'Push'];
    case 'Pull':  return ['Legs', 'Push', 'Mixed', 'Pull'];
    case 'Legs':  return ['Push', 'Pull', 'Mixed', 'Legs'];
    default:      return ['Push', 'Pull', 'Legs', 'Mixed'];
  }
}

// Thresholds (per discussion)
const NEGLECT_WARNING = 5;   // days
const NEGLECT_OVERDUE = 7;   // days
const RECOVERY_HOURS  = 48;

type Suggestion = {
  template: Template;
  pattern: Pattern;
  reasonText: string;
  warning: 'recovery' | 'no-variety' | null;
  buildPattern: Pattern | null; // suggest building a missing pattern template
};

function muscleLastSeenDays(workouts: CompletedWorkout[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const d = daysAgo(w.finishedAt);
    for (const ex of w.exercises) {
      if (!ex.muscle) continue;
      const cur = map.get(ex.muscle);
      if (cur === undefined || d < cur) map.set(ex.muscle, d);
    }
  }
  return map;
}

function muscleLastSeenHours(workouts: CompletedWorkout[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const w of workouts) {
    const h = (Date.now() - new Date(w.finishedAt).getTime()) / 3_600_000;
    for (const ex of w.exercises) {
      if (!ex.muscle) continue;
      const cur = map.get(ex.muscle);
      if (cur === undefined || h < cur) map.set(ex.muscle, h);
    }
  }
  return map;
}

type ScoredCandidate = {
  template: Template;
  pattern: Pattern;
  score: number;
  neglectDays: number;
  neglectMuscle: string | null;
  neglectIsNever: boolean;
  pplMatch: boolean;
  recoveryViolated: boolean;
  isSameAsLast: boolean;
  isHardBlocked: boolean;
};

function scoreTemplate(
  template: Template,
  workouts: CompletedWorkout[],
  daysMap: Map<string, number>,
  hoursMap: Map<string, number>,
  lastPattern: Pattern | null
): ScoredCandidate {
  const pattern = classifyTemplate(template);
  const last = workouts[0] ?? null;
  const muscles = template.exercises.map((e) => e.muscle).filter(Boolean);
  const isSameAsLast = !!last && last.templateId === template.id;
  const hoursSinceLast = last
    ? (Date.now() - new Date(last.finishedAt).getTime()) / 3_600_000
    : Infinity;
  const isHardBlocked = isSameAsLast && hoursSinceLast < RECOVERY_HOURS;

  // Neglect signal: prioritize never-trained > most days untrained.
  let neglectDays = -1;
  let neglectMuscle: string | null = null;
  let neglectIsNever = false;
  for (const m of muscles) {
    const d = daysMap.get(m);
    if (d === undefined) {
      // Never trained — only count as neglect if user has any history at all
      if (workouts.length > 0 && !neglectIsNever) {
        neglectIsNever = true;
        neglectMuscle = m;
        neglectDays = 0;
      }
    } else if (!neglectIsNever && d > neglectDays) {
      neglectDays = d;
      neglectMuscle = m;
    }
  }

  // Roll up to group name when all this template's muscles in that group share the state
  if (neglectMuscle) {
    const g = groupOf(neglectMuscle);
    const groupMuscles = muscles.filter((m) => groupOf(m) === g);
    if (groupMuscles.length > 1) {
      if (neglectIsNever && groupMuscles.every((m) => !daysMap.has(m))) {
        neglectMuscle = g;
      } else if (
        !neglectIsNever &&
        groupMuscles.every((m) => (daysMap.get(m) ?? -1) >= NEGLECT_OVERDUE)
      ) {
        neglectMuscle = g;
      }
    }
  }

  // Recovery violation: any primary muscle hit within 48h
  let recoveryViolated = false;
  for (const m of muscles) {
    const h = hoursMap.get(m);
    if (h !== undefined && h < RECOVERY_HOURS) {
      recoveryViolated = true;
      break;
    }
  }

  // PPL preference match
  let pplMatch = false;
  if (lastPattern && pattern !== 'Mixed') {
    pplMatch = nextOrder(lastPattern)[0] === pattern;
  }

  let score = 0;
  if (isHardBlocked) {
    score = -1000;
  } else {
    if (neglectIsNever)                      score += 35;
    else if (neglectDays >= NEGLECT_OVERDUE) score += 25;
    else if (neglectDays >= NEGLECT_WARNING) score += 15;

    if (pplMatch) score += 12;

    if (!recoveryViolated) score += 8;
    else                   score -= 8;

    if (lastPattern && pattern === lastPattern && pattern !== 'Mixed') score -= 5;
    if (isSameAsLast) score -= 3;

    if (pattern === 'Mixed') score -= 2; // Option B: deprioritize Mixed slightly
  }

  return {
    template, pattern, score,
    neglectDays, neglectMuscle, neglectIsNever,
    pplMatch, recoveryViolated, isSameAsLast, isHardBlocked,
  };
}

function suggestNext(
  workouts: CompletedWorkout[],
  templates: Template[]
): Suggestion | null {
  if (templates.length === 0) return null;

  // No history: pick a focused template to start
  if (workouts.length === 0) {
    const focused = templates.find((t) => classifyTemplate(t) !== 'Mixed') ?? templates[0];
    return {
      template: focused,
      pattern: classifyTemplate(focused),
      reasonText: 'Kick off your first session.',
      warning: null,
      buildPattern: null,
    };
  }

  const daysMap  = muscleLastSeenDays(workouts);
  const hoursMap = muscleLastSeenHours(workouts);
  const last = workouts[0];
  const lastPattern = classifyWorkout(last);

  const scored = templates
    .map((t) => scoreTemplate(t, workouts, daysMap, hoursMap, lastPattern))
    .sort((a, b) => b.score - a.score);

  let top = scored[0];

  // Wildcard exception: if every focused template is bad (all negative),
  // promote a Mixed template as the safe fallback.
  const focusedScores = scored.filter((s) => s.pattern !== 'Mixed');
  const allFocusedBad = focusedScores.length > 0 && focusedScores.every((s) => s.score < 0);
  if (allFocusedBad) {
    const bestMixed = scored.find((s) => s.pattern === 'Mixed' && !s.isHardBlocked);
    if (bestMixed) top = bestMixed;
  }

  // Reason text — derived from why this template won
  let reasonText: string;
  if (top.neglectIsNever && top.neglectMuscle) {
    reasonText = `${top.neglectMuscle} hasn't been trained yet — start here.`;
  } else if (top.neglectDays >= NEGLECT_OVERDUE && top.neglectMuscle) {
    reasonText = `${top.neglectMuscle} hasn't been hit in ${top.neglectDays} days — this fixes that.`;
  } else if (top.neglectDays >= NEGLECT_WARNING && top.neglectMuscle) {
    reasonText = `${top.neglectMuscle} is getting stale (${top.neglectDays}d) — good to refresh.`;
  } else if (top.pplMatch) {
    reasonText = `Last was ${lastPattern} — ${top.pattern} lets those muscles recover.`;
  } else if (!top.recoveryViolated) {
    reasonText = 'All target muscles are fully recovered.';
  } else if (top.isHardBlocked || top.recoveryViolated) {
    reasonText = 'Some muscles still recovering — keep volume light today.';
  } else {
    reasonText = 'Get back to it.';
  }

  // Warning banner
  let warning: Suggestion['warning'] = null;
  if (top.recoveryViolated) {
    warning = 'recovery';
  } else {
    const focusedPatterns = new Set(
      templates.map((t) => classifyTemplate(t)).filter((p) => p !== 'Mixed')
    );
    if (focusedPatterns.size <= 1) warning = 'no-variety';
  }

  // Suggest building a missing pattern template
  let buildPattern: Pattern | null = null;
  const havePatterns = new Set(
    templates.map((t) => classifyTemplate(t)).filter((p): p is Pattern => p !== 'Mixed')
  );
  const allFocused: Pattern[] = ['Push', 'Pull', 'Legs'];
  const missing = allFocused.filter((p) => !havePatterns.has(p));
  if (missing.length > 0) {
    if (lastPattern && lastPattern !== 'Mixed') {
      const ordered = nextOrder(lastPattern);
      for (const p of ordered) {
        if (missing.includes(p)) {
          buildPattern = p;
          break;
        }
      }
    } else {
      buildPattern = missing[0];
    }
  }

  return {
    template: top.template,
    pattern: top.pattern,
    reasonText,
    warning,
    buildPattern,
  };
}

function findNeglectAlert(
  workouts: CompletedWorkout[],
  excludeMuscles: Set<string>,
  addressableMuscles: Set<string>
): { muscle: string; days: number; never: boolean } | null {
  if (workouts.length === 0) return null;
  const daysMap = muscleLastSeenDays(workouts);

  // Bucket addressable muscles by their main group
  const byGroup = new Map<string, string[]>();
  for (const m of addressableMuscles) {
    if (excludeMuscles.has(m)) continue;
    const g = groupOf(m);
    if (!byGroup.has(g)) byGroup.set(g, []);
    byGroup.get(g)!.push(m);
  }

  // 1. Group where ALL addressable muscles are never trained
  for (const [group, ms] of byGroup) {
    if (ms.every((m) => !daysMap.has(m))) {
      return { muscle: group, days: 0, never: true };
    }
  }

  // 2. Group where ALL addressable muscles are overdue
  let bestGroupOverdue: { group: string; days: number } | null = null;
  for (const [group, ms] of byGroup) {
    const ds = ms.map((m) => daysMap.get(m));
    if (ds.some((d) => d === undefined)) continue;
    if ((ds as number[]).every((d) => d >= NEGLECT_OVERDUE)) {
      const minDays = Math.min(...(ds as number[]));
      if (!bestGroupOverdue || minDays > bestGroupOverdue.days) {
        bestGroupOverdue = { group, days: minDays };
      }
    }
  }
  if (bestGroupOverdue) {
    return { muscle: bestGroupOverdue.group, days: bestGroupOverdue.days, never: false };
  }

  // 3. Specific never-trained muscle (mixed group)
  for (const [, ms] of byGroup) {
    for (const m of ms) {
      if (!daysMap.has(m)) return { muscle: m, days: 0, never: true };
    }
  }

  // 4. Specific overdue muscle
  let worst: { muscle: string; days: number } | null = null;
  for (const [, ms] of byGroup) {
    for (const m of ms) {
      const d = daysMap.get(m);
      if (d !== undefined && d >= NEGLECT_OVERDUE && (!worst || d > worst.days)) {
        worst = { muscle: m, days: d };
      }
    }
  }
  if (worst) return { ...worst, never: false };

  return null;
}

// ─── Date / stat helpers ──────────────────────────────────────────────────────

function startOfWeekMonday(now = new Date()): Date {
  const d = new Date(now);
  const dow = d.getDay();
  const offset = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + offset);
  d.setHours(0, 0, 0, 0);
  return d;
}

function daysAgo(iso: string): number {
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
}

function relDate(iso: string): string {
  const d = daysAgo(iso);
  if (d === 0) return 'today';
  if (d === 1) return 'yesterday';
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function calcStreak(workouts: CompletedWorkout[]): number {
  if (!workouts.length) return 0;
  const days = new Set(workouts.map((w) => new Date(w.finishedAt).toDateString()));
  let count = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    if (days.has(d.toDateString())) count++;
    else if (i > 0) break;
  }
  return count;
}

function workoutsThisWeek(workouts: CompletedWorkout[]): number {
  const start = startOfWeekMonday();
  return workouts.filter((w) => new Date(w.finishedAt) >= start).length;
}

function workoutsLastWeek(workouts: CompletedWorkout[]): number {
  const startThis = startOfWeekMonday();
  const startPrev = new Date(startThis);
  startPrev.setDate(startPrev.getDate() - 7);
  return workouts.filter((w) => {
    const d = new Date(w.finishedAt);
    return d >= startPrev && d < startThis;
  }).length;
}

function topLift(workout: CompletedWorkout): { name: string; weight: number; reps: number } | null {
  let best: { name: string; weight: number; reps: number } | null = null;
  for (const ex of workout.exercises) {
    const sets = ex.sets.filter((s) => s.done);
    const src = sets.length ? sets : ex.sets;
    for (const s of src) {
      const w = Number(s.weight);
      const r = Number(s.reps);
      if (!Number.isFinite(w) || w <= 0) continue;
      if (!best || w > best.weight) {
        best = { name: ex.name, weight: w, reps: Number.isFinite(r) ? r : 0 };
      }
    }
  }
  return best;
}

function totalSetsCompleted(workout: CompletedWorkout): number {
  let n = 0;
  for (const ex of workout.exercises) for (const s of ex.sets) if (s.done) n++;
  return n;
}

// ─── Coach insight selection ──────────────────────────────────────────────────

type Insight = {
  icon: keyof typeof Ionicons.glyphMap;
  tint: 'accent' | 'amber' | 'blue' | 'purple' | 'red';
  title: string;
  body: string;
};

function maxWeightIn(ex: ActiveWorkoutExercise): number {
  let max = 0;
  for (const s of ex.sets) {
    if (!s.done) continue;
    const w = Number(s.weight);
    if (Number.isFinite(w) && w > max) max = w;
  }
  return max;
}

function findRecentPR(workouts: CompletedWorkout[]): { name: string; weight: number } | null {
  if (workouts.length < 2) return null;
  const [latest, ...rest] = workouts;

  const historicalMax = new Map<string, number>();
  for (const w of rest) {
    for (const ex of w.exercises) {
      const m = maxWeightIn(ex);
      const cur = historicalMax.get(ex.id) ?? 0;
      if (m > cur) historicalMax.set(ex.id, m);
    }
  }

  let best: { name: string; weight: number; delta: number } | null = null;
  for (const ex of latest.exercises) {
    const m = maxWeightIn(ex);
    if (m <= 0) continue;
    const prior = historicalMax.get(ex.id) ?? 0;
    if (prior === 0 || m <= prior) continue;
    const delta = m - prior;
    if (!best || delta > best.delta) best = { name: ex.name, weight: m, delta };
  }
  return best ? { name: best.name, weight: best.weight } : null;
}

function findNeglectedMuscle(workouts: CompletedWorkout[]): { muscle: string; days: number } | null {
  if (workouts.length === 0) return null;
  const lastSeen = new Map<string, number>();
  for (const w of workouts) {
    const d = daysAgo(w.finishedAt);
    for (const ex of w.exercises) {
      if (!ex.muscle) continue;
      const cur = lastSeen.get(ex.muscle);
      if (cur === undefined || d < cur) lastSeen.set(ex.muscle, d);
    }
  }
  let worst: { muscle: string; days: number } | null = null;
  for (const [m, d] of lastSeen) {
    if (d >= 7 && (!worst || d > worst.days)) worst = { muscle: m, days: d };
  }
  return worst;
}

function selectInsight(
  workouts: CompletedWorkout[],
  templates: Template[],
  streak: number,
  bodyEntries: { date: string; weight: number | null }[]
): Insight {
  // 1. Recent PR
  const pr = findRecentPR(workouts);
  if (pr && daysAgo(workouts[0].finishedAt) <= 3) {
    return {
      icon: 'trophy',
      tint: 'amber',
      title: `New PR · ${pr.name}`,
      body: `You hit ${pr.weight}kg — your heaviest yet. Lock it in.`,
    };
  }

  // 2. Active streak
  if (streak >= 3) {
    return {
      icon: 'flame',
      tint: 'amber',
      title: `${streak}-day streak`,
      body: 'Momentum is your strongest tool. Don\'t let the chain break.',
    };
  }

  // 3. Neglected muscle
  const neglected = findNeglectedMuscle(workouts);
  if (neglected) {
    return {
      icon: 'alert-circle',
      tint: 'red',
      title: `${neglected.muscle} is overdue`,
      body: `${neglected.days} days since you trained ${neglected.muscle.toLowerCase()}. Bring it back this week.`,
    };
  }

  // 4. Weekly momentum up
  const thisW = workoutsThisWeek(workouts);
  const lastW = workoutsLastWeek(workouts);
  if (thisW >= 3 && thisW > lastW) {
    return {
      icon: 'trending-up',
      tint: 'accent',
      title: `${thisW} sessions this week`,
      body: `You\'re ahead of last week\'s ${lastW}. Volume is climbing — keep the discipline.`,
    };
  }

  // 5. Bodyweight trend
  const weights = bodyEntries
    .filter((e) => typeof e.weight === 'number')
    .map((e) => ({ date: e.date, w: e.weight as number }));
  if (weights.length >= 3) {
    const span = daysAgo(weights[weights.length - 1].date);
    if (span >= 14) {
      const delta = weights[0].w - weights[weights.length - 1].w;
      const abs = Math.abs(delta);
      if (abs >= 0.5) {
        return {
          icon: delta < 0 ? 'arrow-down' : 'arrow-up',
          tint: 'blue',
          title: `${delta < 0 ? 'Down' : 'Up'} ${abs.toFixed(1)}kg`,
          body: `Tracked across ${span} days. Stay consistent with the protocol.`,
        };
      }
    }
  }

  // 6. First workout prompt
  if (workouts.length === 0 && templates.length > 0) {
    return {
      icon: 'rocket',
      tint: 'purple',
      title: 'Time for session #1',
      body: 'Pick a template, hit one set. The first rep is the hardest.',
    };
  }

  // 7. No templates yet
  if (templates.length === 0) {
    return {
      icon: 'sparkles',
      tint: 'purple',
      title: 'Build your first template',
      body: 'Custom workouts make tracking effortless. Head to Workouts to start.',
    };
  }

  // 8. Default
  return {
    icon: 'fitness',
    tint: 'accent',
    title: 'Stay consistent',
    body: 'Small wins compound. Show up today and the rest takes care of itself.',
  };
}

// ─── Greeting ─────────────────────────────────────────────────────────────────

const DAY_QUOTES = [
  'Rest is part of the work.',          // Sun
  'New week. New strength.',            // Mon
  'Consistency beats motivation.',      // Tue
  'Halfway. Stay relentless.',          // Wed
  'Strong choices compound.',           // Thu
  'Finish the week stronger.',          // Fri
  'Show up. Lift hard.',                // Sat
];

function getGreeting(): { time: string; quote: string } {
  const now = new Date();
  const h = now.getHours();
  const time = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  return { time, quote: DAY_QUOTES[now.getDay()] };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const PROFILE_KBD_ID = 'profile-kbd';

function Header({
  streak, onProfile, onMigrate,
}: {
  streak: number; onProfile: () => void; onMigrate: () => void;
}) {
  const { time, quote } = useMemo(getGreeting, []);
  return (
    <View style={s.header}>
      <View style={{ flex: 1 }}>
        <Text style={s.greeting}>{time}</Text>
        <Text style={s.title}>Train with intent</Text>
        <Text style={s.subQuote}>{quote}</Text>
      </View>
      <View style={s.headerRight}>
        <TouchableOpacity style={s.profileBtn} activeOpacity={0.8} onPress={onProfile} onLongPress={onMigrate}>
          <Ionicons name="person-circle-outline" size={22} color={C.textSub} />
        </TouchableOpacity>
        {streak > 0 && (
          <View style={s.streakBadge}>
            <Text style={s.streakEmoji}>🔥</Text>
            <Text style={s.streakNum}>{streak}</Text>
            <Text style={s.streakLbl}>day{streak !== 1 ? 's' : ''}</Text>
          </View>
        )}
      </View>
    </View>
  );
}

function HeroActive({
  workout,
  onResume,
}: {
  workout: NonNullable<ReturnType<typeof useWorkout>['activeWorkout']>;
  onResume: () => void;
}) {
  const startedAt = new Date(workout.startedAt);
  const startedTime = startedAt.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
  const totalSets = workout.exercises.reduce((n, e) => n + e.sets.length, 0);

  return (
    <View style={[s.hero, s.heroActive]}>
      <View style={s.heroTop}>
        <View style={s.livePill}>
          <View style={s.liveDot} />
          <Text style={s.livePillText}>LIVE</Text>
        </View>
        <Text style={s.heroTopMeta}>Started {startedTime}</Text>
      </View>
      <Text style={s.heroEyebrow}>Workout in progress</Text>
      <Text style={s.heroName}>{workout.templateName}</Text>
      <View style={s.heroStatRow}>
        <View style={s.heroStat}>
          <Text style={s.heroStatNum}>{workout.exercises.length}</Text>
          <Text style={s.heroStatLbl}>exercises</Text>
        </View>
        <View style={s.heroDiv} />
        <View style={s.heroStat}>
          <Text style={s.heroStatNum}>{totalSets}</Text>
          <Text style={s.heroStatLbl}>sets loaded</Text>
        </View>
      </View>
      <TouchableOpacity style={s.heroCta} activeOpacity={0.85} onPress={onResume}>
        <Ionicons name="play" size={17} color="#071109" />
        <Text style={s.heroCtaText}>Resume workout</Text>
      </TouchableOpacity>
    </View>
  );
}

function HeroSuggested({
  suggestion,
  lastWorkout,
  onStart,
}: {
  suggestion: Suggestion;
  lastWorkout: CompletedWorkout | null;
  onStart: () => void;
}) {
  const { template, pattern, reasonText, warning, buildPattern } = suggestion;
  return (
    <View style={s.hero}>
      {warning === 'recovery' && (
        <View style={s.warnBanner}>
          <Ionicons name="warning-outline" size={15} color={C.amber} />
          <Text style={s.warnBannerText}>
            Some muscles still in recovery — go light or take a rest day.
          </Text>
        </View>
      )}
      {warning === 'no-variety' && (
        <View style={s.warnBanner}>
          <Ionicons name="information-circle-outline" size={15} color={C.amber} />
          <Text style={s.warnBannerText}>
            Limited template variety — consider building another pattern.
          </Text>
        </View>
      )}

      <View style={s.heroTop}>
        <View style={[s.patternPill, patternStyle(pattern).pill]}>
          <Text style={[s.patternPillText, patternStyle(pattern).text]}>
            {pattern.toUpperCase()}
          </Text>
        </View>
        {lastWorkout && (
          <Text style={s.heroTopMeta}>Last trained {relDate(lastWorkout.finishedAt)}</Text>
        )}
      </View>
      <Text style={s.heroEyebrow}>Ready to train</Text>
      <Text style={s.heroName}>{template.name}</Text>
      <Text style={s.heroReason}>{reasonText}</Text>
      <View style={s.heroStatRow}>
        <View style={s.heroStat}>
          <Text style={s.heroStatNum}>{template.exercises.length}</Text>
          <Text style={s.heroStatLbl}>exercises</Text>
        </View>
        <View style={s.heroDiv} />
        <View style={s.heroStat}>
          <Text style={s.heroStatNum}>{pattern}</Text>
          <Text style={s.heroStatLbl}>focus</Text>
        </View>
      </View>
      <TouchableOpacity style={s.heroCta} activeOpacity={0.85} onPress={onStart}>
        <Ionicons name="barbell-outline" size={17} color="#071109" />
        <Text style={s.heroCtaText}>Start workout</Text>
      </TouchableOpacity>

      {buildPattern && (
        <TouchableOpacity
          style={s.buildCta}
          activeOpacity={0.7}
          onPress={() => router.push('/(tabs)/explore')}
        >
          <Ionicons name="add-circle-outline" size={15} color={C.textSub} />
          <Text style={s.buildCtaText}>
            Build a {buildPattern} template for better rotation
          </Text>
          <Ionicons name="chevron-forward" size={14} color={C.textMuted} />
        </TouchableOpacity>
      )}
    </View>
  );
}

function NeglectAlert({ muscle, days, never }: { muscle: string; days: number; never: boolean }) {
  return (
    <View style={s.neglectCard}>
      <View style={s.neglectIcon}>
        <Ionicons name="time-outline" size={18} color={C.red} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={s.neglectTitle}>{muscle} {never ? 'untrained' : 'overdue'}</Text>
        <Text style={s.neglectMeta}>
          {never ? 'Never trained yet' : `Not trained in ${days} days`}
        </Text>
      </View>
    </View>
  );
}

function HeroEmpty() {
  return (
    <View style={s.hero}>
      <Text style={s.heroEyebrow}>Welcome to gymbro</Text>
      <Text style={s.heroName}>Build your first{'\n'}template</Text>
      <Text style={s.heroReason}>Templates make tracking effortless. Set up your routine once.</Text>
      <TouchableOpacity
        style={s.heroCta}
        activeOpacity={0.85}
        onPress={() => router.push('/(tabs)/explore')}
      >
        <Ionicons name="add" size={17} color="#071109" />
        <Text style={s.heroCtaText}>Browse templates</Text>
      </TouchableOpacity>
    </View>
  );
}

function patternStyle(p: Pattern) {
  if (p === 'Push')
    return { pill: { backgroundColor: C.blueDim, borderColor: C.blueBorder }, text: { color: C.blue } };
  if (p === 'Pull')
    return { pill: { backgroundColor: C.purpleDim, borderColor: C.purpleBorder }, text: { color: C.purple } };
  if (p === 'Legs')
    return { pill: { backgroundColor: C.amberDim, borderColor: C.amberBorder }, text: { color: C.amber } };
  return { pill: { backgroundColor: C.accentDim, borderColor: C.accentBorder }, text: { color: C.accent } };
}

function StatGrid({
  thisWeek,
  total,
  weight,
  bodyFat,
}: {
  thisWeek: number;
  total: number;
  weight: number | null;
  bodyFat: number | null;
}) {
  return (
    <View>
      <Text style={s.sectionLabel}>Today&apos;s snapshot</Text>
      <View style={s.statGrid}>
        <View style={s.statCard}>
          <Ionicons name="calendar-outline" size={16} color={C.accent} />
          <Text style={s.statNum}>{thisWeek}</Text>
          <Text style={s.statLbl}>this week</Text>
        </View>
        <View style={s.statCard}>
          <Ionicons name="trophy-outline" size={16} color={C.amber} />
          <Text style={s.statNum}>{total}</Text>
          <Text style={s.statLbl}>total sessions</Text>
        </View>
        <TouchableOpacity
          style={s.statCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/progress')}
        >
          <Ionicons name="scale-outline" size={16} color={C.blue} />
          <Text style={s.statNum}>{weight !== null ? `${weight}` : '—'}</Text>
          <Text style={s.statLbl}>{weight !== null ? 'kg bodyweight' : 'log bodyweight'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={s.statCard}
          activeOpacity={0.8}
          onPress={() => router.push('/(tabs)/progress')}
        >
          <Ionicons name="body-outline" size={16} color={C.purple} />
          <Text style={s.statNum}>{bodyFat !== null ? `${bodyFat}%` : '—'}</Text>
          <Text style={s.statLbl}>{bodyFat !== null ? 'body fat' : 'log body fat'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function CoachInsight({ insight }: { insight: Insight }) {
  const colors = {
    accent: { fg: C.accent, bg: C.accentDim, border: C.accentBorder },
    amber:  { fg: C.amber,  bg: C.amberDim,  border: C.amberBorder  },
    blue:   { fg: C.blue,   bg: C.blueDim,   border: C.blueBorder   },
    purple: { fg: C.purple, bg: C.purpleDim, border: C.purpleBorder },
    red:    { fg: C.red,    bg: C.redDim,    border: C.redBorder    },
  }[insight.tint];

  return (
    <View>
      <Text style={s.sectionLabel}>Coach insight</Text>
      <View style={[s.insight, { borderColor: colors.border }]}>
        <View style={[s.insightIcon, { backgroundColor: colors.bg, borderColor: colors.border }]}>
          <Ionicons name={insight.icon} size={20} color={colors.fg} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.insightTitle, { color: colors.fg }]}>{insight.title}</Text>
          <Text style={s.insightBody}>{insight.body}</Text>
        </View>
      </View>
    </View>
  );
}

const WEEK_DOW = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

function WeekStrip({ workouts }: { workouts: CompletedWorkout[] }) {
  const now = new Date();
  const monday = startOfWeekMonday(now);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  const workoutDates = useMemo(() => {
    const set = new Set<string>();
    for (const w of workouts) set.add(new Date(w.finishedAt).toDateString());
    return set;
  }, [workouts]);

  const todayStr = now.toDateString();
  const count = days.filter((d) => workoutDates.has(d.toDateString())).length;

  return (
    <View>
      <View style={s.sectionHdr}>
        <Text style={s.sectionLabel}>This week</Text>
        <Text style={s.sectionLink}>{count} workout{count !== 1 ? 's' : ''}</Text>
      </View>
      <View style={s.weekCard}>
        <View style={s.weekRow}>
          {days.map((d, i) => {
            const isToday = d.toDateString() === todayStr;
            const hasWorkout = workoutDates.has(d.toDateString());
            const isFuture = d > now;
            return (
              <View key={i} style={s.weekDay}>
                <Text style={[s.weekDowLbl, isToday && s.weekDowLblToday]}>
                  {WEEK_DOW[i]}
                </Text>
                <View style={[
                  s.weekCircle,
                  hasWorkout && s.weekCircleActive,
                  isToday && !hasWorkout && s.weekCircleToday,
                  isFuture && !hasWorkout && s.weekCircleFuture,
                ]}>
                  <Text style={[
                    s.weekDateNum,
                    hasWorkout && s.weekDateNumActive,
                    isToday && !hasWorkout && s.weekDateNumToday,
                    isFuture && s.weekDateNumFuture,
                  ]}>
                    {d.getDate()}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function RecentActivity({ workouts }: { workouts: CompletedWorkout[] }) {
  if (workouts.length === 0) return null;
  return (
    <View>
      <View style={s.sectionHdr}>
        <Text style={s.sectionLabel}>Recent activity</Text>
        <TouchableOpacity onPress={() => router.push('/(tabs)/history')} activeOpacity={0.7}>
          <Text style={s.sectionLink}>View all →</Text>
        </TouchableOpacity>
      </View>
      <View style={s.activityCard}>
        {workouts.map((w, i) => {
          const lift = topLift(w);
          const sets = totalSetsCompleted(w);
          return (
            <TouchableOpacity
              key={w.id}
              style={[s.activityRow, i < workouts.length - 1 && s.activityRowBorder]}
              activeOpacity={0.7}
              onPress={() => router.push(`/history/${w.id}`)}
            >
              <View style={s.activityDot} />
              <View style={{ flex: 1 }}>
                <Text style={s.activityName} numberOfLines={1}>{w.templateName}</Text>
                <Text style={s.activityMeta}>
                  {relDate(w.finishedAt)} · {sets} set{sets !== 1 ? 's' : ''}
                  {lift ? ` · top ${lift.weight}kg` : ''}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ─── Country data ─────────────────────────────────────────────────────────────

type Country = { flag: string; name: string; code: string };

const COUNTRIES: Country[] = [
  { flag: '🇦🇫', name: 'Afghanistan',       code: '+93'  },
  { flag: '🇩🇿', name: 'Algeria',           code: '+213' },
  { flag: '🇦🇷', name: 'Argentina',         code: '+54'  },
  { flag: '🇦🇺', name: 'Australia',         code: '+61'  },
  { flag: '🇦🇹', name: 'Austria',           code: '+43'  },
  { flag: '🇧🇩', name: 'Bangladesh',        code: '+880' },
  { flag: '🇧🇪', name: 'Belgium',           code: '+32'  },
  { flag: '🇧🇷', name: 'Brazil',            code: '+55'  },
  { flag: '🇨🇦', name: 'Canada',            code: '+1'   },
  { flag: '🇨🇱', name: 'Chile',             code: '+56'  },
  { flag: '🇨🇳', name: 'China',             code: '+86'  },
  { flag: '🇨🇴', name: 'Colombia',          code: '+57'  },
  { flag: '🇨🇿', name: 'Czech Republic',    code: '+420' },
  { flag: '🇩🇰', name: 'Denmark',           code: '+45'  },
  { flag: '🇪🇬', name: 'Egypt',             code: '+20'  },
  { flag: '🇫🇮', name: 'Finland',           code: '+358' },
  { flag: '🇫🇷', name: 'France',            code: '+33'  },
  { flag: '🇩🇪', name: 'Germany',           code: '+49'  },
  { flag: '🇬🇭', name: 'Ghana',             code: '+233' },
  { flag: '🇬🇷', name: 'Greece',            code: '+30'  },
  { flag: '🇭🇰', name: 'Hong Kong',         code: '+852' },
  { flag: '🇭🇺', name: 'Hungary',           code: '+36'  },
  { flag: '🇮🇳', name: 'India',             code: '+91'  },
  { flag: '🇮🇩', name: 'Indonesia',         code: '+62'  },
  { flag: '🇮🇷', name: 'Iran',              code: '+98'  },
  { flag: '🇮🇶', name: 'Iraq',              code: '+964' },
  { flag: '🇮🇱', name: 'Israel',            code: '+972' },
  { flag: '🇮🇹', name: 'Italy',             code: '+39'  },
  { flag: '🇯🇵', name: 'Japan',             code: '+81'  },
  { flag: '🇯🇴', name: 'Jordan',            code: '+962' },
  { flag: '🇰🇪', name: 'Kenya',             code: '+254' },
  { flag: '🇰🇷', name: 'South Korea',       code: '+82'  },
  { flag: '🇲🇾', name: 'Malaysia',          code: '+60'  },
  { flag: '🇲🇽', name: 'Mexico',            code: '+52'  },
  { flag: '🇲🇦', name: 'Morocco',           code: '+212' },
  { flag: '🇳🇱', name: 'Netherlands',       code: '+31'  },
  { flag: '🇳🇿', name: 'New Zealand',       code: '+64'  },
  { flag: '🇳🇬', name: 'Nigeria',           code: '+234' },
  { flag: '🇳🇴', name: 'Norway',            code: '+47'  },
  { flag: '🇵🇰', name: 'Pakistan',          code: '+92'  },
  { flag: '🇵🇭', name: 'Philippines',       code: '+63'  },
  { flag: '🇵🇱', name: 'Poland',            code: '+48'  },
  { flag: '🇵🇹', name: 'Portugal',          code: '+351' },
  { flag: '🇷🇴', name: 'Romania',           code: '+40'  },
  { flag: '🇷🇺', name: 'Russia',            code: '+7'   },
  { flag: '🇸🇦', name: 'Saudi Arabia',      code: '+966' },
  { flag: '🇸🇬', name: 'Singapore',         code: '+65'  },
  { flag: '🇿🇦', name: 'South Africa',      code: '+27'  },
  { flag: '🇪🇸', name: 'Spain',             code: '+34'  },
  { flag: '🇸🇪', name: 'Sweden',            code: '+46'  },
  { flag: '🇨🇭', name: 'Switzerland',       code: '+41'  },
  { flag: '🇹🇼', name: 'Taiwan',            code: '+886' },
  { flag: '🇹🇭', name: 'Thailand',          code: '+66'  },
  { flag: '🇹🇷', name: 'Turkey',            code: '+90'  },
  { flag: '🇺🇦', name: 'Ukraine',           code: '+380' },
  { flag: '🇦🇪', name: 'United Arab Emirates', code: '+971' },
  { flag: '🇬🇧', name: 'United Kingdom',    code: '+44'  },
  { flag: '🇺🇸', name: 'United States',     code: '+1'   },
  { flag: '🇻🇳', name: 'Vietnam',           code: '+84'  },
];

// ─── Country Picker Modal ─────────────────────────────────────────────────────

function CountryPickerModal({
  visible, selected, onSelect, onClose,
}: {
  visible: boolean; selected: string;
  onSelect: (c: Country) => void; onClose: () => void;
}) {
  const [query, setQuery] = useState('');
  const filtered = query.trim()
    ? COUNTRIES.filter(
        (c) =>
          c.name.toLowerCase().includes(query.toLowerCase()) ||
          c.code.includes(query)
      )
    : COUNTRIES;

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={ps.backdrop} onPress={onClose} />
      <View style={[ps.sheet, { maxHeight: '85%' }]}>
        <View style={ps.handle} />
        <View style={ps.hdr}>
          <Text style={ps.title}>Country code</Text>
          <TouchableOpacity onPress={onClose} style={ps.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color={C.textSub} />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={ps.countrySearch}>
          <Ionicons name="search-outline" size={16} color={C.textMuted} />
          <TextInput
            style={ps.countrySearchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search country or code…"
            placeholderTextColor={C.textMuted}
            keyboardAppearance="dark"
            clearButtonMode="while-editing"
            autoFocus
          />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {filtered.map((c) => (
            <TouchableOpacity
              key={`${c.name}-${c.code}`}
              style={[ps.countryRow, selected === c.code && c.name === COUNTRIES.find((x) => x.code === selected)?.name && ps.countryRowSelected]}
              activeOpacity={0.75}
              onPress={() => { onSelect(c); onClose(); }}
            >
              <Text style={ps.countryFlag}>{c.flag}</Text>
              <Text style={ps.countryName}>{c.name}</Text>
              <Text style={ps.countryCode}>{c.code}</Text>
              {selected === c.code && (
                <Ionicons name="checkmark" size={15} color={C.accent} />
              )}
            </TouchableOpacity>
          ))}
          {filtered.length === 0 && (
            <Text style={ps.countryEmpty}>No countries found</Text>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ─── Profile Sheet ────────────────────────────────────────────────────────────

function ProfileSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { latestEntry }   = useBodyMetrics();
  const { updateTargets } = useNutrition();
  const { profile, updateProfile } = useUserProfile();

  const [nameStr,      setNameStr]      = useState('');
  const [phoneStr,     setPhoneStr]     = useState('');
  const [countryCode,  setCountryCode]  = useState('+1');
  const [selectedGoal, setSelectedGoal] = useState<UserGoal | null>(null);
  const [showCountry,  setShowCountry]  = useState(false);
  const [saveFlash,    setSaveFlash]    = useState(false);
  const [geminiKeyStr, setGeminiKeyStr] = useState('');
  const [showKey,      setShowKey]      = useState(false);
  const [goalOpen,     setGoalOpen]     = useState(false);
  const [otherOpen,    setOtherOpen]    = useState(false);
  const [lifestyle,    setLifestyle]    = useState<LifestyleGoal[]>([]);
  const [dailyRem,     setDailyRem]     = useState<ReminderConfig>(profile.dailyReminder);
  const [longRem,      setLongRem]      = useState<ReminderConfig>(profile.longTermReminder);

  // Pre-fill on open; intentionally only fires on visibility change so in-progress edits aren't clobbered
  React.useEffect(() => {
    if (visible) {
      setNameStr(profile.name);
      setPhoneStr(profile.phone);
      setCountryCode(profile.countryCode);
      setSelectedGoal(profile.goal);
      setSaveFlash(false);
      setShowKey(false);
      setGoalOpen(false);
      setOtherOpen(false);
      setLifestyle(profile.lifestyleGoals);
      setDailyRem(profile.dailyReminder);
      setLongRem(profile.longTermReminder);
      loadUserGeminiKey().then((k) => setGeminiKeyStr(k ?? ''));
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleSection = (setter: React.Dispatch<React.SetStateAction<boolean>>) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setter((v) => !v);
  };

  const toggleLifestyle = (g: LifestyleGoal) =>
    setLifestyle((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));

  const weight = latestEntry?.weight ?? null;
  const bf     = latestEntry?.bodyFat ?? null;
  const maintenanceCal = weight && bf ? computeMaintenanceCal(weight, bf) : null;
  const preview = selectedGoal && weight
    ? computeGoalTargets(selectedGoal, weight, bf)
    : null;

  const handleSave = async () => {
    Keyboard.dismiss();
    updateProfile({
      name: nameStr.trim(),
      phone: phoneStr.trim(),
      countryCode,
      goal: selectedGoal,
      lifestyleGoals: lifestyle,
      dailyReminder: dailyRem,
      longTermReminder: longRem,
    });
    if (selectedGoal && preview) {
      updateTargets(preview);
    }
    await syncReminders(dailyRem, longRem);
    await setUserGeminiKey(geminiKeyStr);
    setSaveFlash(true);
    setTimeout(() => { setSaveFlash(false); onClose(); }, 1200);
  };

  const GOALS: UserGoal[] = ['fat_loss', 'lean_bulk', 'maintenance', 'recomp'];

  const selectedCountry = COUNTRIES.find((c) => c.code === countryCode) ?? COUNTRIES[57];

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={ps.backdrop} onPress={onClose} />
      <View style={ps.sheet}>
        <View style={ps.handle} />

        {/* Header */}
        <View style={ps.hdr}>
          <Text style={ps.title}>Your Profile</Text>
          <TouchableOpacity onPress={onClose} style={ps.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={20}
        >

          {/* ── Personal info ── */}
          <Text style={ps.sectionLabel}>Personal info</Text>
          <View style={ps.infoCard}>
            {/* Name */}
            <View style={ps.infoField}>
              <Text style={ps.fieldLbl}>Name</Text>
              <TextInput
                style={ps.input}
                value={nameStr}
                onChangeText={setNameStr}
                placeholder="Your name"
                placeholderTextColor={C.textMuted}
                keyboardAppearance="dark"
                returnKeyType="done"
                onSubmitEditing={() => Keyboard.dismiss()}
                inputAccessoryViewID={PROFILE_KBD_ID}
              />
            </View>

            {/* Phone row */}
            <View style={ps.infoField}>
              <Text style={ps.fieldLbl}>Phone number</Text>
              <View style={ps.phoneRow}>
                {/* Country code button */}
                <TouchableOpacity
                  style={ps.codeBtn}
                  activeOpacity={0.8}
                  onPress={() => setShowCountry(true)}
                >
                  <Text style={ps.codeBtnFlag}>{selectedCountry.flag}</Text>
                  <Text style={ps.codeBtnCode}>{countryCode}</Text>
                  <Ionicons name="chevron-down" size={13} color={C.textMuted} />
                </TouchableOpacity>
                {/* Phone input */}
                <TextInput
                  style={[ps.input, { flex: 1 }]}
                  value={phoneStr}
                  onChangeText={setPhoneStr}
                  placeholder="Phone number"
                  placeholderTextColor={C.textMuted}
                  keyboardType="phone-pad"
                  keyboardAppearance="dark"
                  inputAccessoryViewID={PROFILE_KBD_ID}
                />
              </View>
            </View>
          </View>

          {/* ── Goals ── */}
          <Text style={[ps.sectionLabel, { marginTop: 20 }]}>Goals</Text>

          <FeatureHint
            id="goal-dropdown"
            icon="flag-outline"
            title="Set a training goal"
            body="Fat loss, lean bulk, maintenance, or recomp — it tunes your starter templates' sets/reps and computes nutrition targets automatically."
          />

          {/* Training goal dropdown */}
          <DropdownHeader
            label="Training goal"
            value={selectedGoal ? GOAL_META[selectedGoal].label : 'Not set — tap to choose'}
            open={goalOpen}
            onPress={() => {
              toggleSection(setGoalOpen);
              markFeatureSeen('goal-dropdown');
            }}
          />
          {goalOpen && (
            <View style={[ps.goalGrid, { marginTop: 10 }]}>
              {GOALS.map((g) => {
                const meta     = GOAL_META[g];
                const selected = selectedGoal === g;
                return (
                  <TouchableOpacity
                    key={g}
                    style={[ps.goalCard, selected && ps.goalCardSelected]}
                    activeOpacity={0.8}
                    onPress={() => { setSelectedGoal(g); toggleSection(setGoalOpen); }}
                  >
                    <View style={ps.goalCardTop}>
                      <Text style={[ps.goalLabel, selected && { color: C.accent }]}>{meta.label}</Text>
                      <View style={[ps.goalTag, { backgroundColor: meta.tagColor + '22', borderColor: meta.tagColor + '55' }]}>
                        <Text style={[ps.goalTagText, { color: meta.tagColor }]}>{meta.tag}</Text>
                      </View>
                    </View>
                    <Text style={ps.goalDesc}>{meta.description}</Text>
                    {selected && (
                      <View style={ps.goalCheck}>
                        <Ionicons name="checkmark-circle" size={16} color={C.accent} />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* ── Target preview (uses body metrics from Progress tab) ── */}
          {preview ? (
            <View style={ps.previewCard}>
              <View style={ps.previewHdr}>
                <Text style={ps.previewTitle}>Computed targets</Text>
                {maintenanceCal != null
                  ? <Text style={ps.previewMaint}>Maint. {maintenanceCal} kcal</Text>
                  : <Text style={ps.previewMaintMuted}>Log BF% in Progress for maintenance est.</Text>}
              </View>
              <View style={ps.previewGrid}>
                {([
                  { label: 'Calories', value: `${preview.calories}`, unit: 'kcal', color: C.accent  },
                  { label: 'Protein',  value: `${preview.protein}`,  unit: 'g',    color: C.blue    },
                  { label: 'Carbs',    value: `${preview.carbs}`,    unit: 'g',    color: C.amber   },
                  { label: 'Fat',      value: `${preview.fat}`,      unit: 'g',    color: C.purple  },
                  { label: 'Fiber',    value: `${preview.fiber}`,    unit: 'g',    color: C.textSub },
                  { label: 'Sodium',   value: `${preview.sodium}`,   unit: 'mg',   color: C.textSub },
                ] as const).map(({ label, value, unit, color }) => (
                  <View key={label} style={ps.previewCell}>
                    <Text style={[ps.previewValue, { color }]}>{value}<Text style={ps.previewUnit}>{unit}</Text></Text>
                    <Text style={ps.previewLabel}>{label}</Text>
                  </View>
                ))}
              </View>
              {!bf && (
                <Text style={ps.previewFootnote}>
                  * Protein uses total bodyweight. Log body fat % in Progress for LBM-based targets.
                </Text>
              )}
            </View>
          ) : selectedGoal && !weight ? (
            <View style={ps.noWeightCard}>
              <Ionicons name="scale-outline" size={16} color={C.amber} />
              <Text style={ps.noWeightText}>
                Log your bodyweight in the Progress tab to see computed targets for this goal.
              </Text>
            </View>
          ) : null}

          {/* Other goals dropdown — lifestyle goals + reminders */}
          <FeatureHint
            id="other-goals-reminders"
            icon="notifications-outline"
            title="Habits & reminders"
            body="Track hydration, steps, sleep, or consistency, and set a daily or long-term reminder with your own message — it'll show up as a notification."
          />
          <View style={{ marginTop: 10 }}>
            <DropdownHeader
              label="Other goals"
              value={
                (lifestyle.length ? `${lifestyle.length} habit${lifestyle.length > 1 ? 's' : ''}` : 'No habits') +
                ` · ${[dailyRem.enabled && 'daily', longRem.enabled && 'long-term'].filter(Boolean).join(' + ') || 'no reminders'}`
              }
              open={otherOpen}
              onPress={() => {
                toggleSection(setOtherOpen);
                markFeatureSeen('other-goals-reminders');
              }}
            />
          </View>
          {otherOpen && (
            <View style={ps.otherWrap}>
              {/* Lifestyle habit goals */}
              <Text style={ps.otherSubLabel}>Habit goals</Text>
              <View style={ps.lifeGrid}>
                {(Object.keys(LIFESTYLE_META) as LifestyleGoal[]).map((g) => {
                  const meta = LIFESTYLE_META[g];
                  const on = lifestyle.includes(g);
                  return (
                    <TouchableOpacity
                      key={g}
                      style={[ps.lifeChip, on && { borderColor: meta.color + '88', backgroundColor: meta.color + '1A' }]}
                      activeOpacity={0.8}
                      onPress={() => toggleLifestyle(g)}
                    >
                      <Ionicons name={meta.icon} size={16} color={on ? meta.color : C.textSub} />
                      <View style={{ flex: 1 }}>
                        <Text style={[ps.lifeLabel, on && { color: C.text }]}>{meta.label}</Text>
                        <Text style={ps.lifeDesc}>{meta.desc}</Text>
                      </View>
                      {on && <Ionicons name="checkmark-circle" size={16} color={meta.color} />}
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Daily reminder */}
              <ReminderRow
                title="Daily reminder"
                subtitle="A nudge to log your day, every day"
                config={dailyRem}
                onChange={setDailyRem}
                showInterval={false}
              />

              {/* Long-term goal reminder */}
              <ReminderRow
                title="Long-term goal reminder"
                subtitle="Check in on your bigger goal"
                config={longRem}
                onChange={setLongRem}
                showInterval
              />
            </View>
          )}

          {/* ── AI / Gemini API key ── */}
          <Text style={[ps.sectionLabel, { marginTop: 20 }]}>AI features · Gemini key</Text>
          <View style={ps.infoCard}>
            <Text style={ps.keyBlurb}>
              Photo scan, voice logging and the nutrition coach run on Google Gemini.
              Paste your own free key so the app uses your quota, not the shared one.
            </Text>
            <View style={ps.infoField}>
              <Text style={ps.fieldLbl}>API key</Text>
              <View style={ps.keyRow}>
                <TextInput
                  style={[ps.input, { flex: 1 }]}
                  value={geminiKeyStr}
                  onChangeText={setGeminiKeyStr}
                  placeholder="AIza…  (leave blank to use shared key)"
                  placeholderTextColor={C.textMuted}
                  secureTextEntry={!showKey}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardAppearance="dark"
                  inputAccessoryViewID={PROFILE_KBD_ID}
                />
                <TouchableOpacity
                  style={ps.keyToggle}
                  activeOpacity={0.8}
                  onPress={() => setShowKey((v) => !v)}
                >
                  <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={C.textSub} />
                </TouchableOpacity>
              </View>
            </View>
            <TouchableOpacity
              style={ps.keyLinkRow}
              activeOpacity={0.7}
              onPress={() => Linking.openURL('https://aistudio.google.com/apikey')}
            >
              <Ionicons name="open-outline" size={14} color={C.accent} />
              <Text style={ps.keyLink}>Get a free key at aistudio.google.com</Text>
            </TouchableOpacity>
            <Text style={ps.keyStatus}>
              {geminiKeyStr.trim()
                ? '✓ Using your key'
                : 'Using the shared key (limited during testing)'}
            </Text>
          </View>

          {/* ── Save button ── */}
          <PressableScale
            style={[ps.applyBtn, saveFlash && ps.applyBtnFlash, { marginTop: 20, marginBottom: 8 }]}
            onPress={handleSave}
          >
            {saveFlash
              ? <><Ionicons name="checkmark" size={16} color="#071109" /><Text style={ps.applyBtnText}>Saved</Text></>
              : <Text style={ps.applyBtnText}>Save profile</Text>}
          </PressableScale>

        </KeyboardAwareScrollView>

        {Platform.OS === 'ios' && (
          <InputAccessoryView nativeID={PROFILE_KBD_ID}>
            <View style={ps.kbdBar}>
              <TouchableOpacity onPress={() => Keyboard.dismiss()} activeOpacity={0.7}>
                <Text style={ps.kbdDone}>Done</Text>
              </TouchableOpacity>
            </View>
          </InputAccessoryView>
        )}
      </View>

      <CountryPickerModal
        visible={showCountry}
        selected={countryCode}
        onSelect={(c) => setCountryCode(c.code)}
        onClose={() => setShowCountry(false)}
      />
    </Modal>
  );
}

// ─── Migrate Sheet ────────────────────────────────────────────────────────────

function MigrateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const [status,    setStatus]    = useState<string | null>(null);
  const [busy,      setBusy]      = useState(false);
  const [exportTxt, setExportTxt] = useState('');
  const [importTxt, setImportTxt] = useState('');

  const handleExport = async () => {
    setBusy(true);
    setStatus(null);
    try {
      const keys = await AsyncStorage.getAllKeys();
      const pairs = await AsyncStorage.multiGet(keys as string[]);
      const data: Record<string, string> = {};
      for (const [k, v] of pairs) if (v !== null) data[k] = v;
      const json = JSON.stringify(data);
      setExportTxt(json);
      await Clipboard.setStringAsync(json);
      setStatus(`✓ ${keys.length} keys exported — copy the text below and paste it in the custom build.`);
    } catch {
      setStatus('Export failed. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async () => {
    if (!importTxt.trim()) { setStatus('Paste your exported data in the box above first.'); return; }
    setBusy(true);
    setStatus(null);
    try {
      const data: Record<string, string> = JSON.parse(importTxt.trim());
      const pairs = Object.entries(data) as [string, string][];
      await AsyncStorage.multiSet(pairs);
      setStatus(`✓ Imported ${pairs.length} keys — close the app fully and reopen it.`);
    } catch {
      setStatus('Import failed — make sure you pasted the full export text.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={ps.backdrop} onPress={onClose} />
      <View style={[ps.sheet, { maxHeight: '90%' }]}>
        <View style={ps.handle} />
        <View style={ps.hdr}>
          <Text style={ps.title}>Migrate Data</Text>
          <TouchableOpacity onPress={onClose} style={ps.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color={C.textSub} />
          </TouchableOpacity>
        </View>
        <KeyboardAwareScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          bottomOffset={20}
        >
          <View style={{ gap: 14, paddingBottom: 40 }}>

            {/* ── Export (Expo Go) ── */}
            <Text style={ps.sectionLabel}>Step 1 — in Expo Go</Text>
            <TouchableOpacity
              style={[ps.applyBtn, busy && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={handleExport}
              disabled={busy}
            >
              <Ionicons name="copy-outline" size={16} color="#071109" />
              <Text style={ps.applyBtnText}>Export my data</Text>
            </TouchableOpacity>
            {exportTxt !== '' && (
              <TextInput
                style={[ps.input, { height: 80, fontSize: 11, color: C.textMuted }]}
                value={exportTxt}
                multiline
                selectTextOnFocus
                editable={false}
              />
            )}

            {/* ── Import (custom build) ── */}
            <Text style={[ps.sectionLabel, { marginTop: 8 }]}>Step 2 — in custom build</Text>
            <Text style={{ color: C.textSub, fontSize: 12, lineHeight: 18, marginTop: -8 }}>
              Paste the exported text below then tap Import.
            </Text>
            <TextInput
              style={[ps.input, { height: 80, fontSize: 11 }]}
              value={importTxt}
              onChangeText={setImportTxt}
              multiline
              placeholder="Paste export text here…"
              placeholderTextColor={C.textMuted}
              keyboardAppearance="dark"
            />
            <TouchableOpacity
              style={[ps.applyBtn, { backgroundColor: C.blue }, busy && { opacity: 0.5 }]}
              activeOpacity={0.85}
              onPress={handleImport}
              disabled={busy}
            >
              <Ionicons name="download-outline" size={16} color="#fff" />
              <Text style={[ps.applyBtnText, { color: '#fff' }]}>Import data</Text>
            </TouchableOpacity>

            {status && (
              <Text style={{ color: C.accent, fontSize: 13, fontWeight: '600', lineHeight: 18 }}>
                {status}
              </Text>
            )}
          </View>
        </KeyboardAwareScrollView>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const { activeWorkout, completedWorkouts, startWorkoutFromTemplate } = useWorkout();
  const { templates } = useTemplates();
  const { latestEntry, entries } = useBodyMetrics();
  const { goal } = useUserProfile();

  const [showProfile, setShowProfile] = useState(false);
  const [showMigrate, setShowMigrate] = useState(false);

  const streak = useMemo(() => calcStreak(completedWorkouts), [completedWorkouts]);
  const thisWeek = useMemo(() => workoutsThisWeek(completedWorkouts), [completedWorkouts]);
  const suggestion = useMemo(
    () => (activeWorkout ? null : suggestNext(completedWorkouts, templates)),
    [activeWorkout, completedWorkouts, templates]
  );
  const neglectAlert = useMemo(() => {
    if (activeWorkout || !suggestion) return null;
    const covered = new Set(suggestion.template.exercises.map((e) => e.muscle));
    const addressable = new Set<string>();
    for (const t of templates) {
      for (const ex of t.exercises) {
        if (ex.muscle) addressable.add(ex.muscle);
      }
    }
    return findNeglectAlert(completedWorkouts, covered, addressable);
  }, [activeWorkout, suggestion, completedWorkouts, templates]);
  const insight = useMemo(
    () => selectInsight(completedWorkouts, templates, streak, entries),
    [completedWorkouts, templates, streak, entries]
  );

  const showNudgeDot = goal != null && !latestEntry?.bodyFat;

  const handleStartSuggested = () => {
    if (!suggestion) return;
    startWorkoutFromTemplate(
      suggestion.template.id,
      suggestion.template.name,
      suggestion.template.exercises
    );
    router.push(`/workout/${suggestion.template.id}`);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
      >
        <Header streak={streak} onProfile={() => setShowProfile(true)} onMigrate={() => setShowMigrate(true)} />

        {activeWorkout ? (
          <HeroActive
            workout={activeWorkout}
            onResume={() => router.push(`/workout/${activeWorkout.templateId}`)}
          />
        ) : suggestion ? (
          <HeroSuggested
            suggestion={suggestion}
            lastWorkout={completedWorkouts[0] ?? null}
            onStart={handleStartSuggested}
          />
        ) : (
          <HeroEmpty />
        )}

        {neglectAlert && (
          <NeglectAlert
            muscle={neglectAlert.muscle}
            days={neglectAlert.days}
            never={neglectAlert.never}
          />
        )}

        <StatGrid
          thisWeek={thisWeek}
          total={completedWorkouts.length}
          weight={latestEntry?.weight ?? null}
          bodyFat={latestEntry?.bodyFat ?? null}
        />

        {/* BF% nudge — shown when a goal is set but body fat % is not logged */}
        {showNudgeDot && (
          <TouchableOpacity style={s.bfNudge} activeOpacity={0.8} onPress={() => router.push('/(tabs)/progress')}>
            <Ionicons name="information-circle-outline" size={16} color={C.amber} />
            <Text style={s.bfNudgeText}>
              Log body fat % for accurate {GOAL_META[goal!].label} targets
            </Text>
            <Text style={s.bfNudgeLink}>Progress →</Text>
          </TouchableOpacity>
        )}

        <WeekStrip workouts={completedWorkouts} />

        <CoachInsight insight={insight} />

        <RecentActivity workouts={completedWorkouts.slice(0, 3)} />
      </ScrollView>

      <ProfileSheet visible={showProfile} onClose={() => setShowProfile(false)} />
      <MigrateSheet visible={showMigrate} onClose={() => setShowMigrate(false)} />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 20 },

  // Header
  header:    { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  greeting:  { color: C.textSub, fontSize: 13, marginBottom: 6 },
  title:     { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },
  subQuote:  { color: C.textMuted, fontSize: 13, marginTop: 6, fontStyle: 'italic' },
  headerRight: { alignItems: 'flex-end', gap: 8 },
  profileBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  profileNudgeDot: {
    position: 'absolute', top: -1, right: -1,
    width: 10, height: 10, borderRadius: 5,
    backgroundColor: C.amber, borderWidth: 2, borderColor: C.bg,
  },
  streakBadge: {
    backgroundColor: C.amberDim, borderWidth: 1, borderColor: C.amberBorder,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center',
  },
  streakEmoji: { fontSize: 16, marginBottom: 1 },
  streakNum:   { color: C.amber, fontSize: 20, fontWeight: '900', lineHeight: 23 },
  streakLbl:   { color: C.amber, fontSize: 10, fontWeight: '700' },

  // BF% nudge banner
  bfNudge: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.amberDim, borderWidth: 1, borderColor: C.amberBorder,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 10,
  },
  bfNudgeText: { flex: 1, color: C.amber, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  bfNudgeLink: { color: C.amber, fontSize: 12, fontWeight: '800' },

  // Hero
  hero: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 28, padding: 24, gap: 8,
  },
  heroActive: { borderColor: C.accentBorder, backgroundColor: '#0C1410' },
  heroTop: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 4,
  },
  heroTopMeta: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  heroEyebrow: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  heroName: {
    color: C.text, fontSize: 30, fontWeight: '900', lineHeight: 35,
    letterSpacing: -0.6, marginTop: 2,
  },
  heroReason: { color: C.textSub, fontSize: 14, lineHeight: 20, marginTop: 4 },

  livePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  liveDot:      { width: 7, height: 7, borderRadius: 3.5, backgroundColor: C.accent },
  livePillText: { color: C.accent, fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  patternPill: {
    borderWidth: 1, borderRadius: 20,
    paddingHorizontal: 11, paddingVertical: 5,
  },
  patternPillText: { fontSize: 11, fontWeight: '900', letterSpacing: 0.5 },

  heroStatRow: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    backgroundColor: C.elevated, borderRadius: 16,
    paddingHorizontal: 18, paddingVertical: 14, marginTop: 14,
  },
  heroStat:    { flex: 1 },
  heroStatNum: { color: C.text, fontSize: 22, fontWeight: '900' },
  heroStatLbl: { color: C.textMuted, fontSize: 12, fontWeight: '600', marginTop: 2 },
  heroDiv:     { width: 1, height: 30, backgroundColor: C.border },

  heroCta: {
    backgroundColor: C.accent, borderRadius: 18, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 14,
  },
  heroCtaText: { color: '#071109', fontSize: 16, fontWeight: '900' },

  warnBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.amberDim, borderWidth: 1, borderColor: C.amberBorder,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 4,
  },
  warnBannerText: { flex: 1, color: C.amber, fontSize: 12, fontWeight: '700', lineHeight: 16 },

  buildCta: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    paddingVertical: 10, marginTop: 4,
  },
  buildCtaText: { flex: 1, color: C.textSub, fontSize: 12, fontWeight: '600' },

  neglectCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.redBorder,
    borderRadius: 18, padding: 16,
  },
  neglectIcon: {
    width: 38, height: 38, borderRadius: 12,
    backgroundColor: C.redDim, borderWidth: 1, borderColor: C.redBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  neglectTitle: { color: C.red, fontSize: 14, fontWeight: '800' },
  neglectMeta:  { color: C.textSub, fontSize: 12, marginTop: 2 },

  // Sections
  sectionHdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionLabel: {
    color: C.textSub, fontSize: 12, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },
  sectionLink: {
    color: C.accent, fontSize: 12, fontWeight: '700', marginBottom: 12,
  },

  // Stat grid
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  statCard: {
    width: '48%',
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, padding: 16, gap: 6,
  },
  statNum: { color: C.text, fontSize: 24, fontWeight: '900' },
  statLbl: { color: C.textMuted, fontSize: 12, fontWeight: '600' },

  // Insight
  insight: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.surface, borderWidth: 1,
    borderRadius: 20, padding: 18,
  },
  insightIcon: {
    width: 44, height: 44, borderRadius: 14, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  insightTitle: { fontSize: 14, fontWeight: '800', marginBottom: 3 },
  insightBody:  { color: C.textSub, fontSize: 13, lineHeight: 18 },

  // Week strip
  weekCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingVertical: 20, paddingHorizontal: 16,
  },
  weekRow:   { flexDirection: 'row', justifyContent: 'space-between' },
  weekDay:   { flex: 1, alignItems: 'center', gap: 10 },
  weekDowLbl:      { color: C.textMuted, fontSize: 12, fontWeight: '700' },
  weekDowLblToday: { color: C.accent },
  weekCircle: {
    width: 36, height: 36, borderRadius: 18,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1.5, borderColor: C.border,
  },
  weekCircleActive: { backgroundColor: C.accent, borderColor: C.accent },
  weekCircleToday:  { borderColor: C.accent },
  weekCircleFuture: { borderColor: C.borderSub },
  weekDateNum:       { color: C.textSub, fontSize: 13, fontWeight: '700' },
  weekDateNumActive: { color: '#071109', fontWeight: '900' },
  weekDateNumToday:  { color: C.accent, fontWeight: '800' },
  weekDateNumFuture: { color: C.textMuted },

  // Activity
  activityCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 18,
  },
  activityRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14,
  },
  activityRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  activityDot: {
    width: 8, height: 8, borderRadius: 4, backgroundColor: C.accent,
  },
  activityName: { color: C.text, fontSize: 15, fontWeight: '700' },
  activityMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },
});

// ─── Profile Sheet Styles ─────────────────────────────────────────────────────

const ps = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0F1117', borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: '#1E2130',
    paddingHorizontal: 20, paddingBottom: 40, maxHeight: '95%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: '#1E2130',
    alignSelf: 'center', marginTop: 12, marginBottom: 4,
  },
  hdr: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 14,
  },
  title:   { color: C.text,    fontSize: 20, fontWeight: '900' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },

  sectionLabel: {
    color: C.textSub, fontSize: 11, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10,
  },

  // Personal info card
  infoCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 16, gap: 14,
  },
  infoField: { gap: 6 },
  fieldLbl: { color: C.textSub, fontSize: 11, fontWeight: '700' },
  input: {
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, color: C.text, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15,
  },

  // AI / Gemini key section
  keyBlurb: { color: C.textSub, fontSize: 12, lineHeight: 18 },
  keyRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  keyToggle: {
    width: 42, height: 42, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
  },
  keyLinkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  keyLink: { color: C.accent, fontSize: 12, fontWeight: '700' },
  keyStatus: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  phoneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  codeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 12, paddingVertical: 11,
  },
  codeBtnFlag: { fontSize: 18 },
  codeBtnCode: { color: C.text, fontSize: 14, fontWeight: '700' },

  // Country picker
  countrySearch: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12, marginBottom: 12,
  },
  countrySearchInput: { flex: 1, color: C.text, fontSize: 14 },
  countryRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 4, paddingVertical: 13,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  countryRowSelected: { backgroundColor: C.accentDim },
  countryFlag: { fontSize: 22 },
  countryName: { flex: 1, color: C.text, fontSize: 14, fontWeight: '600' },
  countryCode: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  countryEmpty: { color: C.textMuted, fontSize: 14, textAlign: 'center', paddingVertical: 24 },

  // No weight nudge
  noWeightCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.amberDim, borderWidth: 1, borderColor: C.amberBorder,
    borderRadius: 16, padding: 14, marginTop: 16,
  },
  noWeightText: { flex: 1, color: C.amber, fontSize: 12, fontWeight: '600', lineHeight: 17 },

  // Goal grid
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  goalCard: {
    width: '47.5%', backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, padding: 14, gap: 6, position: 'relative',
  },
  goalCardSelected: { borderColor: C.accentBorder, backgroundColor: C.accentDim },
  goalCardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  goalLabel: { color: C.text, fontSize: 14, fontWeight: '800', flex: 1 },
  goalTag: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3,
  },
  goalTagText: { fontSize: 10, fontWeight: '800' },
  goalDesc: { color: C.textMuted, fontSize: 11, lineHeight: 16 },
  goalCheck: { position: 'absolute', top: 10, right: 10 },

  // Dropdown header (collapsible section)
  ddHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 12,
  },
  ddLabel: { color: C.text, fontSize: 14, fontWeight: '800' },
  ddValue: { color: C.textSub, fontSize: 12, marginTop: 2 },

  // Other goals
  otherWrap: { marginTop: 10, gap: 12 },
  otherSubLabel: { color: C.textSub, fontSize: 12, fontWeight: '700', marginBottom: -2 },
  lifeGrid: { gap: 8 },
  lifeChip: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingHorizontal: 13, paddingVertical: 11,
  },
  lifeLabel: { color: C.textSub, fontSize: 13, fontWeight: '800' },
  lifeDesc: { color: C.textMuted, fontSize: 11, marginTop: 1 },

  // Reminder card
  remCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, gap: 12,
  },
  remTopRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  remTitle: { color: C.text, fontSize: 14, fontWeight: '800' },
  remSub: { color: C.textSub, fontSize: 12, marginTop: 2 },
  remBody: { gap: 12 },
  remFieldLbl: { color: C.textSub, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  remInput: {
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, color: C.text, paddingHorizontal: 13, paddingVertical: 10, fontSize: 14,
  },
  remHint: { color: C.textMuted, fontSize: 11, marginTop: 5 },
  timeRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  timeUnit: { alignItems: 'center', gap: 4 },
  timeBtn: {
    width: 40, height: 26, borderRadius: 8, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
  },
  timeVal: { color: C.text, fontSize: 20, fontWeight: '800', fontVariant: ['tabular-nums'] },
  timeColon: { color: C.text, fontSize: 20, fontWeight: '800', marginTop: -2 },
  timeAmPm: { color: C.textSub, fontSize: 13, fontWeight: '800', marginLeft: 4 },
  segRow: { flexDirection: 'row', gap: 8 },
  segBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 10,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
  },
  segBtnOn: { backgroundColor: C.accentDim, borderColor: C.accentBorder },
  segText: { color: C.textSub, fontSize: 12, fontWeight: '700' },
  segTextOn: { color: C.accent },

  // Preview
  previewCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 16, gap: 12, marginTop: 16,
  },
  previewHdr: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  previewTitle: { color: C.text,     fontSize: 14, fontWeight: '800' },
  previewMaint: { color: C.accent,   fontSize: 12, fontWeight: '700' },
  previewMaintMuted: { color: C.textMuted, fontSize: 12 },
  previewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 0 },
  previewCell: {
    width: '33.33%', alignItems: 'center', paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  previewValue: { fontSize: 18, fontWeight: '900' },
  previewUnit:  { fontSize: 11, fontWeight: '600' },
  previewLabel: { color: C.textMuted, fontSize: 10, fontWeight: '700', marginTop: 2, textTransform: 'uppercase' },
  previewFootnote: { color: C.textMuted, fontSize: 11, fontStyle: 'italic', lineHeight: 16 },

  // Apply button
  applyBtn: {
    backgroundColor: C.accent, borderRadius: 18, paddingVertical: 16,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
  },
  applyBtnDisabled: { backgroundColor: C.elevated },
  applyBtnFlash:    { backgroundColor: '#16A34A' },
  applyBtnText: { color: '#071109', fontSize: 15, fontWeight: '900' },

  // Keyboard bar
  kbdBar: {
    backgroundColor: '#1C1E27', borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-end',
  },
  kbdDone: { color: C.accent, fontSize: 16, fontWeight: '700' },
});
