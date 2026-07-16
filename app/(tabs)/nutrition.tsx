import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
// expo-speech-recognition requires a custom build — stub it out for Expo Go
let ExpoSpeechRecognitionModule: {
  start: (opts: object) => void;
  stop: () => void;
  abort: () => void;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
} = { start: () => {}, stop: () => {}, abort: () => {}, requestPermissionsAsync: async () => ({ granted: false }) };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let useSpeechRecognitionEvent: (event: string, handler: (e: any) => void) => void = () => {};
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sr = require('expo-speech-recognition');
  ExpoSpeechRecognitionModule = sr.ExpoSpeechRecognitionModule;
  useSpeechRecognitionEvent = sr.useSpeechRecognitionEvent;
} catch { /* not available in Expo Go */ }
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Easing,
  InputAccessoryView,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import FeatureHint from '../../components/ui/FeatureHint';
import { useBodyMetrics } from '../../context/BodyMetricsContext';
import { DailyTargets, MealEntry, SavedFoodItem, useNutrition } from '../../context/NutritionContext';
import { useWorkout } from '../../context/WorkoutContext';
import { buildRollingUserState, summarizeForPrompt } from '../../utils/userState';
import { formatDayLabel, toDateKey } from '../../utils/dateHelpers';
import { markFeatureSeen } from '../../utils/featureHints';
import { FoodItem, FoodVisionError, FoodVisionResult, analyzeFoodPhoto, queryFoodText, recomputeTotals } from '../../utils/foodVision';
import { loadUserGeminiKey } from '../../utils/userApiKey';

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:           '#080A0F',
  surface:      '#0F1117',
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

const KBD_ID = 'nutrition-kbd';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pct(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, value / target);
}

function mealQualityScore(meal: MealEntry, targets: DailyTargets): number {
  if (meal.calories <= 0) return 0;

  // Protein density vs target ratio (protein kcal / total kcal)
  const tProteinRatio  = targets.calories > 0 ? (targets.protein * 4) / targets.calories : 0;
  const mProteinRatio  = (meal.protein * 4) / meal.calories;
  const proteinScore   = tProteinRatio > 0 ? Math.min(mProteinRatio / tProteinRatio, 1) : 0;

  // Fiber per 1000 kcal vs target
  const tFiberPer1k    = targets.calories > 0 ? (targets.fiber / targets.calories) * 1000 : 15;
  const mFiberPer1k    = (meal.fiber ?? 0) / (meal.calories / 1000);
  const fiberScore     = tFiberPer1k > 0 ? Math.min(mFiberPer1k / tFiberPer1k, 1) : 0;

  // Macro balance: how close the P/C/F split is to target split
  const tMacCal = targets.protein * 4 + targets.carbs * 4 + targets.fat * 9;
  const mMacCal = meal.protein   * 4 + meal.carbs   * 4 + meal.fat   * 9;
  let macroScore = 0;
  if (tMacCal > 0 && mMacCal > 0) {
    const deviation = (
      Math.abs((meal.protein * 4 / mMacCal) - (targets.protein * 4 / tMacCal)) +
      Math.abs((meal.carbs   * 4 / mMacCal) - (targets.carbs   * 4 / tMacCal)) +
      Math.abs((meal.fat     * 9 / mMacCal) - (targets.fat     * 9 / tMacCal))
    ) / 2;
    macroScore = Math.max(0, 1 - deviation);
  }

  return Math.round(proteinScore * 40 + fiberScore * 20 + macroScore * 40);
}

// ─── Chart constants ──────────────────────────────────────────────────────────

const RING_SIZE = 160;
const SCREEN_W  = Dimensions.get('window').width;
const CHART_PAD = 40; // left y-axis area
const CHART_W   = SCREEN_W - 40 - CHART_PAD; // 40 = card horizontal padding
const CHART_H   = 110;

// ─── Weekly Nutrition Chart ───────────────────────────────────────────────────

function WeeklyNutritionChart({
  data, target,
}: {
  data: { label: string; calories: number }[];
  target: number;
}) {
  if (!data.length) return null;
  const max      = Math.max(...data.map((d) => d.calories), target, 1);
  const targetY  = CHART_H - (target / max) * CHART_H;
  const barW     = (CHART_W / data.length) * 0.55;
  const barGap   = CHART_W / data.length;

  return (
    <View style={s.weekChartWrap}>
      {/* Y labels */}
      <View style={[s.weekYAxis, { height: CHART_H }]}>
        <Text style={s.weekYLbl}>{Math.round(max / 1000) > 0 ? `${(max / 1000).toFixed(1)}k` : String(Math.round(max))}</Text>
        <Text style={s.weekYLbl}>{target > 0 ? (target >= 1000 ? `${(target / 1000).toFixed(1)}k` : String(target)) : ''}</Text>
        <Text style={s.weekYLbl}>0</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Svg width={CHART_W} height={CHART_H + 20}>
          {/* Grid lines */}
          <Line x1={0} y1={0}        x2={CHART_W} y2={0}        stroke={C.border} strokeWidth={1} />
          <Line x1={0} y1={CHART_H / 2} x2={CHART_W} y2={CHART_H / 2} stroke={C.border} strokeWidth={1} />
          <Line x1={0} y1={CHART_H}  x2={CHART_W} y2={CHART_H}  stroke={C.border} strokeWidth={1} />
          {/* Target line */}
          {target > 0 && (
            <Line
              x1={0} y1={targetY} x2={CHART_W} y2={targetY}
              stroke={C.accentBorder} strokeWidth={1.5}
              strokeDasharray="4,3"
            />
          )}
          {/* Bars */}
          {data.map((d, i) => {
            const barH  = d.calories > 0 ? Math.max((d.calories / max) * CHART_H, 3) : 0;
            const x     = i * barGap + (barGap - barW) / 2;
            const over  = d.calories > target && target > 0;
            const color = d.calories === 0 ? C.border : over ? C.red : C.accent;
            return (
              <Rect
                key={i}
                x={x} y={CHART_H - barH}
                width={barW} height={barH}
                fill={color} rx={3}
              />
            );
          })}
          {/* X labels */}
          {data.map((d, i) => {
            const cx = i * barGap + barGap / 2;
            return (
              <Line key={`xl-${i}`} x1={cx} y1={CHART_H} x2={cx} y2={CHART_H + 4} stroke={C.border} strokeWidth={1} />
            );
          })}
        </Svg>
        {/* X-axis labels as RN Text (SVG text is hard to style) */}
        <View style={[s.weekXLabels, { width: CHART_W }]}>
          {data.map((d, i) => (
            <Text key={i} style={s.weekXLbl}>{d.label}</Text>
          ))}
        </View>
      </View>
    </View>
  );
}

// ─── AI Tip card ──────────────────────────────────────────────────────────────

function TipCard({ tip, loading, onRefresh }: { tip: string | null; loading: boolean; onRefresh: () => void }) {
  if (!tip && !loading) return null;
  return (
    <TouchableOpacity
      style={s.tipCard} activeOpacity={0.75} onPress={onRefresh} disabled={loading}
    >
      <View style={s.tipIconWrap}>
        {loading
          ? <ActivityIndicator size="small" color={C.accent} />
          : <Ionicons name="bulb-outline" size={18} color={C.accent} />}
      </View>
      <View style={{ flex: 1 }}>
        {loading
          ? <Text style={s.tipText}>Reading your week…</Text>
          : <Text style={s.tipText}>{tip}</Text>}
        {!loading && <Text style={s.tipRefresh}>Tap to refresh</Text>}
      </View>
    </TouchableOpacity>
  );
}

// ─── Compact Stats Card ───────────────────────────────────────────────────────

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const MINI_SIZE = 82;
const MINI_SW   = 7;
const MINI_R    = (MINI_SIZE - MINI_SW) / 2;
const MINI_CIRC = 2 * Math.PI * MINI_R;

function CompactStatsCard({
  consumed, target, maintenanceCal, protein, proteinTarget, carbs, carbsTarget, fat, fatTarget, onEdit,
}: {
  consumed: number; target: number; maintenanceCal: number | null;
  protein: number; proteinTarget: number;
  carbs: number; carbsTarget: number;
  fat: number; fatTarget: number;
  onEdit: () => void;
}) {
  const over      = consumed > target;
  const ratio     = target > 0 ? Math.min(consumed / target, 1) : 0;
  const remaining = target - consumed;

  const animVal = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(animVal, { toValue: ratio, duration: 650, useNativeDriver: false, easing: Easing.out(Easing.cubic) }).start();
  }, [ratio]);
  const offset = animVal.interpolate({ inputRange: [0, 1], outputRange: [MINI_CIRC, 0] });

  const macros = [
    { label: 'Protein', val: protein, t: proteinTarget, color: C.blue },
    { label: 'Carbs',   val: carbs,   t: carbsTarget,   color: C.amber },
    { label: 'Fat',     val: fat,     t: fatTarget,     color: C.purple },
  ];

  return (
    <TouchableOpacity style={s.statsCard} activeOpacity={0.85} onPress={onEdit}>
      <View style={s.statsTop}>
        <View style={s.statsLeft}>
          <View style={s.statsCalRow}>
            <Text style={[s.statsCalNum, over && { color: C.red }]}>{consumed}</Text>
            <Text style={s.statsCalSuffix}>kcal</Text>
          </View>
          <Text style={[s.statsRemain, { color: over ? C.red : remaining === 0 ? C.accent : C.textSub }]}>
            {over ? `${Math.abs(remaining)} over target` : remaining === 0 ? 'On target' : `${remaining} left`}
          </Text>
          {maintenanceCal != null && (
            <Text style={s.statsMaint}>maint. {maintenanceCal}</Text>
          )}
        </View>
        <Svg width={MINI_SIZE} height={MINI_SIZE}>
          <Circle cx={MINI_SIZE / 2} cy={MINI_SIZE / 2} r={MINI_R} fill="none" stroke={C.elevated} strokeWidth={MINI_SW} />
          <AnimatedCircle
            cx={MINI_SIZE / 2} cy={MINI_SIZE / 2} r={MINI_R}
            fill="none" stroke={over ? C.red : C.accent} strokeWidth={MINI_SW}
            strokeDasharray={String(MINI_CIRC)} strokeDashoffset={offset as unknown as number}
            strokeLinecap="round" rotation="-90" origin={`${MINI_SIZE / 2},${MINI_SIZE / 2}`}
          />
        </Svg>
      </View>

      <View style={s.macroBarRow}>
        {macros.map(({ label, val, t, color }) => (
          <View key={label} style={s.macroBar}>
            <View style={s.macroBarHead}>
              <Text style={[s.macroBarLbl, { color }]}>{label}</Text>
              <Text style={s.macroBarVal}>
                <Text style={val > t ? { color: C.red } : undefined}>{val}</Text>
                <Text style={s.macroBarMax}>/{t}g</Text>
              </Text>
            </View>
            <View style={s.macroBarTrack}>
              <View style={[s.macroBarFill, {
                width: `${Math.min(val / Math.max(t, 1), 1) * 100}%`,
                backgroundColor: val > t ? C.red : color,
              }]} />
            </View>
          </View>
        ))}
      </View>
      <Text style={s.statsEditHint}>Tap to edit targets</Text>
    </TouchableOpacity>
  );
}

// ─── Quality badge ────────────────────────────────────────────────────────────

function QualityBadge({ score }: { score: number }) {
  const color  = score >= 80 ? C.accent : score >= 50 ? C.amber : C.red;
  const bg     = score >= 80 ? C.accentDim : score >= 50 ? C.amberDim : C.redDim;
  const border = score >= 80 ? C.accentBorder : score >= 50 ? C.amberBorder : C.redBorder;
  return (
    <View style={[s.qualityBadge, { backgroundColor: bg, borderColor: border }]}>
      <Text style={[s.qualityBadgeNum, { color }]}>{score}</Text>
    </View>
  );
}

// ─── Confidence badge ─────────────────────────────────────────────────────────

function ConfidenceBadge({ level }: { level: 'low' | 'medium' | 'high' }) {
  const map = {
    high:   { bg: C.accentDim,  border: C.accentBorder,  color: C.accent, label: 'High confidence' },
    medium: { bg: C.amberDim,   border: C.amberBorder,   color: C.amber,  label: 'Medium confidence' },
    low:    { bg: C.redDim,     border: C.redBorder,     color: C.red,    label: 'Low confidence — refine portions below' },
  }[level];
  return (
    <View style={[s.badge, { backgroundColor: map.bg, borderColor: map.border }]}>
      <Text style={[s.badgeText, { color: map.color }]}>{map.label}</Text>
    </View>
  );
}

// ─── MealRow ──────────────────────────────────────────────────────────────────

function MealRow({ meal, onLongPress, score }: { meal: MealEntry; onLongPress: () => void; score?: number }) {
  const time = new Date(meal.loggedAt).toLocaleTimeString(undefined, {
    hour: 'numeric', minute: '2-digit',
  });
  const stripeColor = meal.source === 'barcode'
    ? C.accent
    : meal.confidence === 'high' ? C.accent
    : meal.confidence === 'medium' ? C.amber
    : C.red;

  return (
    <TouchableOpacity
      style={s.mealRow}
      activeOpacity={0.7}
      onLongPress={onLongPress}
      delayLongPress={400}
    >
      <View style={[s.mealStripe, { backgroundColor: stripeColor }]} />
      {meal.thumbnailBase64 && (
        <Image
          source={{ uri: `data:image/jpeg;base64,${meal.thumbnailBase64}` }}
          style={s.mealThumb}
          contentFit="cover"
        />
      )}
      <View style={s.mealRowContent}>
        <View style={s.mealRowLeft}>
          <Text style={s.mealName} numberOfLines={2}>{meal.description || 'Meal'}</Text>
          <Text style={s.mealMeta}>
            {time}
            {'  '}
            <Text style={{ color: C.blue }}>P {meal.protein}g</Text>{'  '}
            <Text style={{ color: C.amber }}>C {meal.carbs}g</Text>{'  '}
            <Text style={{ color: C.purple }}>F {meal.fat}g</Text>
          </Text>
          {(meal.fiber != null || meal.sodium != null) && (
            <Text style={s.mealMicroLine}>
              {meal.fiber != null ? `Fiber ${meal.fiber}g` : ''}
              {meal.fiber != null && meal.sodium != null ? '  ·  ' : ''}
              {meal.sodium != null ? `Sodium ${meal.sodium}mg` : ''}
            </Text>
          )}
        </View>
        <View style={s.mealRightCol}>
          <View style={s.mealCalBadge}>
            <Text style={s.mealCalBadgeText}>{meal.calories}</Text>
            <Text style={s.mealCalBadgeUnit}>kcal</Text>
          </View>
          {score !== undefined && <QualityBadge score={score} />}
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── MealActionSheet ──────────────────────────────────────────────────────────

function MealActionSheet({
  meal, onEdit, onDelete, onClose,
}: {
  meal: MealEntry | null;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  React.useEffect(() => {
    if (!meal) setConfirmDelete(false);
  }, [meal]);

  return (
    <Modal visible={!!meal} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.actionSheet}>
        <View style={s.handle} />
        <Text style={s.actionSheetMealName} numberOfLines={2}>
          {meal?.description || 'Meal'}
        </Text>
        <Text style={s.actionSheetMealMeta}>
          {meal?.calories} kcal · P {meal?.protein}g · C {meal?.carbs}g · F {meal?.fat}g
        </Text>

        <View style={s.actionSheetDivider} />

        {/* Edit */}
        <TouchableOpacity style={s.actionBtn} activeOpacity={0.75} onPress={onEdit}>
          <View style={[s.actionBtnIcon, { backgroundColor: C.blueDim, borderColor: C.blueBorder }]}>
            <Ionicons name="pencil-outline" size={18} color={C.blue} />
          </View>
          <Text style={s.actionBtnLabel}>Edit meal</Text>
          <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
        </TouchableOpacity>

        {/* Delete */}
        {!confirmDelete ? (
          <TouchableOpacity style={s.actionBtn} activeOpacity={0.75} onPress={() => setConfirmDelete(true)}>
            <View style={[s.actionBtnIcon, { backgroundColor: C.redDim, borderColor: C.redBorder }]}>
              <Ionicons name="trash-outline" size={18} color={C.red} />
            </View>
            <Text style={[s.actionBtnLabel, { color: C.red }]}>Delete meal</Text>
            <Ionicons name="chevron-forward" size={16} color={C.textMuted} />
          </TouchableOpacity>
        ) : (
          <View style={s.actionDeleteConfirm}>
            <Text style={s.actionDeleteConfirmText}>Are you sure?</Text>
            <View style={s.actionDeleteBtns}>
              <TouchableOpacity style={s.actionCancelBtn} activeOpacity={0.75} onPress={() => setConfirmDelete(false)}>
                <Text style={s.actionCancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={s.actionConfirmBtn} activeOpacity={0.75} onPress={onDelete}>
                <Ionicons name="trash-outline" size={14} color="#fff" />
                <Text style={s.actionConfirmBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Cancel */}
        <TouchableOpacity style={[s.actionBtn, { marginTop: 4 }]} activeOpacity={0.75} onPress={onClose}>
          <Text style={[s.actionBtnLabel, { color: C.textSub, textAlign: 'center', flex: 1 }]}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── DayGroup ─────────────────────────────────────────────────────────────────

function DayGroup({
  dateKey, dayMeals, onLongPress, targets,
}: {
  dateKey: string; dayMeals: MealEntry[]; onLongPress: (meal: MealEntry) => void; targets: DailyTargets;
}) {
  const [open, setOpen] = useState(false);
  const total = dayMeals.reduce((a, m) => a + m.calories, 0);
  return (
    <View style={s.dayGroup}>
      <TouchableOpacity style={s.dayGroupHeader} activeOpacity={0.7} onPress={() => setOpen((v) => !v)}>
        <Text style={s.dayGroupLabel}>{formatDayLabel(dateKey)}</Text>
        <View style={s.dayGroupRight}>
          <Text style={s.dayGroupTotal}>{total} kcal</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={C.textMuted} />
        </View>
      </TouchableOpacity>
      {open && dayMeals.map((m, i) => (
        <View key={m.id} style={[s.mealRowWrap, i < dayMeals.length - 1 && s.mealRowBorder]}>
          <MealRow meal={m} onLongPress={() => onLongPress(m)} score={mealQualityScore(m, targets)} />
        </View>
      ))}
    </View>
  );
}

// ─── TargetsSheet ─────────────────────────────────────────────────────────────

function TargetsSheet({
  visible, targets, onSave, onClose,
}: {
  visible: boolean;
  targets: DailyTargets;
  onSave: (t: DailyTargets) => void;
  onClose: () => void;
}) {
  const [cal,    setCal]    = useState(String(targets.calories));
  const [pro,    setPro]    = useState(String(targets.protein));
  const [carb,   setCarb]   = useState(String(targets.carbs));
  const [fat,    setFat]    = useState(String(targets.fat));
  const [fiber,  setFiber]  = useState(String(targets.fiber));
  const [sodium, setSodium] = useState(String(targets.sodium));

  const handleSave = () => {
    const c = parseInt(cal), p = parseInt(pro), cb = parseInt(carb),
          f = parseInt(fat), fi = parseInt(fiber), so = parseInt(sodium);
    if ([c, p, cb, f, fi, so].some((n) => !Number.isFinite(n) || n < 0)) return;
    onSave({ calories: c, protein: p, carbs: cb, fat: f, fiber: fi, sodium: so });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.sheetHdr}>
          <Text style={s.sheetTitle}>Daily Targets</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color={C.textSub} />
          </TouchableOpacity>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {([
            { label: 'Calories (kcal)', value: cal,    set: setCal    },
            { label: 'Protein (g)',     value: pro,    set: setPro    },
            { label: 'Carbs (g)',       value: carb,   set: setCarb   },
            { label: 'Fat (g)',         value: fat,    set: setFat    },
            { label: 'Fiber (g)',       value: fiber,  set: setFiber  },
            { label: 'Sodium (mg)',     value: sodium, set: setSodium },
          ] as const).map(({ label, value, set }) => (
            <View key={label} style={[s.sheetField, { marginBottom: 14 }]}>
              <Text style={s.sheetFieldLabel}>{label}</Text>
              <TextInput
                style={s.sheetInput}
                value={value}
                onChangeText={(t) => (set as (v: string) => void)(t)}
                keyboardType="decimal-pad"
                keyboardAppearance="dark"
                inputAccessoryViewID={KBD_ID}
                placeholderTextColor={C.textMuted}
              />
            </View>
          ))}
          <TouchableOpacity style={[s.sheetBtn, { marginTop: 4, marginBottom: 8 }]} activeOpacity={0.85} onPress={handleSave}>
            <Text style={s.sheetBtnText}>Save targets</Text>
          </TouchableOpacity>
        </ScrollView>
        <InputAccessoryView nativeID={KBD_ID}>
          <View style={s.kbdBar}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} activeOpacity={0.7}>
              <Text style={s.kbdDone}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── ReviewSheet ──────────────────────────────────────────────────────────────

function ReviewSheet({
  visible, loading, aiResult, error, imageUri, source, onSave, onClose,
}: {
  visible: boolean;
  loading: boolean;
  aiResult: FoodVisionResult | null;
  error: string | null;
  imageUri: string | null;
  source: 'photo' | 'barcode' | 'manual';
  onSave: (entry: Omit<MealEntry, 'id' | 'loggedAt'>) => void;
  onClose: () => void;
}) {
  const [desc,        setDesc]        = useState('');
  const [cal,         setCal]         = useState('');
  const [pro,         setPro]         = useState('');
  const [carb,        setCarb]        = useState('');
  const [fat,         setFat]         = useState('');
  const [fiber,       setFiber]       = useState('');
  const [sodium,      setSodium]      = useState('');
  const [sugar,       setSugar]       = useState('');
  const [items,        setItems]        = useState<FoodItem[]>([]);
  const [refineOpen,   setRefineOpen]   = useState(false);
  const [thumbnail,    setThumbnail]    = useState<string | null>(null);
  const [thumbLoading, setThumbLoading] = useState(false);
  const [voiceListening,    setVoiceListening]    = useState(false);
  const [voiceQuery,        setVoiceQuery]        = useState('');
  const [voiceLoading,      setVoiceLoading]      = useState(false);
  const [voiceError,        setVoiceError]        = useState<string | null>(null);
  const [descVoiceListening, setDescVoiceListening] = useState(false);
  const [descVoiceHintSeen,  setDescVoiceHintSeen]  = useState(true);
  const speechModeRef          = React.useRef<'add_item' | 'reanalyze' | null>(null);
  const latestDescTranscript   = React.useRef('');

  React.useEffect(() => {
    if (aiResult) {
      setDesc(aiResult.description);
      setCal(String(aiResult.calories));
      setPro(String(aiResult.protein_g));
      setCarb(String(aiResult.carbs_g));
      setFat(String(aiResult.fat_g));
      setFiber(String(aiResult.fiber_g));
      setSodium(String(aiResult.sodium_mg));
      setSugar(String(aiResult.sugar_g));
      setItems(aiResult.items);
      setRefineOpen(aiResult.confidence !== 'high');
    }
  }, [aiResult]);

  React.useEffect(() => {
    if (visible && source === 'photo') {
      AsyncStorage.getItem('gymbro_desc_voice_hint_seen').then((v) => {
        if (v === null) setDescVoiceHintSeen(false);
      });
    }
    if (!visible) {
      setDesc(''); setCal(''); setPro(''); setCarb(''); setFat('');
      setFiber(''); setSodium(''); setSugar(''); setItems([]); setRefineOpen(false);
      setThumbnail(null); setThumbLoading(false);
      ExpoSpeechRecognitionModule.abort();
      setVoiceListening(false);
      setVoiceQuery('');
      setVoiceLoading(false);
      setVoiceError(null);
      setDescVoiceListening(false);
      speechModeRef.current = null;
      latestDescTranscript.current = '';
    }
  }, [visible]);

  // Voice recognition events — handles both "add missed item" and "describe for re-analyze"
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript ?? '';
    if (speechModeRef.current === 'reanalyze') {
      setDesc(text);
      latestDescTranscript.current = text;
      if (event.isFinal) {
        setDescVoiceListening(false);
        speechModeRef.current = null;
        if (text.trim()) handleReanalyze(text.trim());
      }
    } else {
      setVoiceQuery(text);
      if (event.isFinal && text.trim()) {
        setVoiceListening(false);
        speechModeRef.current = null;
        addVoiceItems(text);
      }
    }
  });

  useSpeechRecognitionEvent('end', () => {
    setVoiceListening(false);
    setDescVoiceListening(false);
    speechModeRef.current = null;
  });

  // For photo meals, compress imageUri → thumbnail base64 for storage in history rows
  React.useEffect(() => {
    if (!imageUri || source !== 'photo') return;
    let cancelled = false;
    ImageManipulator.manipulateAsync(
      imageUri,
      [{ resize: { width: 200 } }],
      { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
    ).then((r) => {
      if (!cancelled) setThumbnail(r.base64 ?? null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [imageUri, source]);

  const pickPhotoForThumb = async (src: 'camera' | 'library') => {
    const permFn = src === 'camera'
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== 'granted') return;
    const result = src === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8 });
    if (result.canceled) return;
    setThumbLoading(true);
    try {
      const compressed = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 200 } }],
        { compress: 0.3, format: ImageManipulator.SaveFormat.JPEG, base64: true }
      );
      setThumbnail(compressed.base64 ?? null);
    } catch { /* non-critical */ }
    finally { setThumbLoading(false); }
  };

  const startVoice = async () => {
    if (voiceListening) {
      ExpoSpeechRecognitionModule.stop();
      setVoiceListening(false);
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setVoiceListening(true);
    setVoiceQuery('');
    setVoiceError(null);
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
  };

  const startDescVoice = async () => {
    if (descVoiceListening) {
      ExpoSpeechRecognitionModule.stop();
      setDescVoiceListening(false);
      speechModeRef.current = null;
      const hint = latestDescTranscript.current.trim();
      if (hint) handleReanalyze(hint);
      return;
    }
    const { granted } = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!granted) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDescVoiceListening(true);
    speechModeRef.current = 'reanalyze';
    latestDescTranscript.current = '';
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: false });
    if (!descVoiceHintSeen) {
      setDescVoiceHintSeen(true);
      AsyncStorage.setItem('gymbro_desc_voice_hint_seen', '1');
    }
  };

  const handleReanalyze = async (hintOverride?: string) => {
    if (!imageUri || source !== 'photo') return;
    setReanalyzeLoading(true);
    try {
      const hint = hintOverride ?? desc.trim();
      const result = await analyzeFoodPhoto(imageUri, hint || undefined);
      setDesc(result.description);
      setCal(String(result.calories));
      setPro(String(result.protein_g));
      setCarb(String(result.carbs_g));
      setFat(String(result.fat_g));
      setFiber(String(result.fiber_g));
      setSodium(String(result.sodium_mg));
      setSugar(String(result.sugar_g));
      setItems(result.items);
      setRefineOpen(result.confidence !== 'high');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err) {
      Alert.alert('Re-analysis failed', err instanceof FoodVisionError ? err.message : 'Please try again.');
    } finally {
      setReanalyzeLoading(false);
    }
  };

  const addVoiceItems = async (text: string) => {
    setVoiceLoading(true);
    setVoiceError(null);
    try {
      const existingList = items.length > 0
        ? items.map((it, i) => `${i}: ${it.name} (${it.estimated_g}g)`).join('\n')
        : 'none';

      const prompt =
        `You are helping update a meal log. Existing items:\n${existingList}\n\n` +
        `User said: "${text}"\n\n` +
        `For each food mentioned, check if it semantically matches an existing item above (same food, different wording is OK — e.g. "paneer" matches "Fresh Paneer", "sabzi" may refer to the vegetable dish already listed). ` +
        `Return ONLY valid JSON with no extra text:\n` +
        `{"updates":[{"index":0,"estimated_g":0}],"new_items":[{"name":"","estimated_g":0,"cal_per100g":0,"protein_per100g":0,"carbs_per100g":0,"fat_per100g":0,"fiber_per100g":0,"sodium_per100g":0}]}\n` +
        `IMPORTANT for "updates": estimated_g must be the NEW TOTAL grams after applying the user's change. ` +
        `If the user says "add 250 more" and the item currently shows 200g, return estimated_g: 450. ` +
        `If the user says "set to 250" or just "250g", return estimated_g: 250. ` +
        `"new_items": foods not in the existing list (include full nutritional values per 100g). ` +
        `Convert any units (tablespoons, cups, pieces, handful, etc.) to grams.`;

      let raw: string;
      try {
        raw = await queryFoodText(prompt);
      } catch {
        setVoiceError("Couldn't reach AI. Please try again.");
        return;
      }
      if (!raw) { setVoiceError("Couldn't parse that. Try saying it differently."); return; }

      const parsed = JSON.parse(raw);

      const merged = [...items];

      // Apply updates to existing items
      const rawUpdates: Array<{ index: unknown; estimated_g: unknown }> =
        Array.isArray(parsed.updates) ? parsed.updates : [];
      for (const u of rawUpdates) {
        const idx = Number(u.index);
        if (Number.isInteger(idx) && idx >= 0 && idx < merged.length) {
          merged[idx] = { ...merged[idx], estimated_g: Math.max(0, Math.round(Number(u.estimated_g) || 0)) };
        }
      }

      // Append genuinely new items
      const rawNew: Array<Record<string, unknown>> =
        Array.isArray(parsed.new_items) ? parsed.new_items : [];
      let anyNew = false;
      for (const it of rawNew) {
        merged.push({
          name:            typeof it.name === 'string' ? it.name : 'Food item',
          estimated_g:     Math.max(0, Math.round(Number(it.estimated_g)     || 0)),
          cal_per100g:     Math.max(0, Math.round(Number(it.cal_per100g)     || 0)),
          protein_per100g: Math.max(0, Math.round(Number(it.protein_per100g) || 0)),
          carbs_per100g:   Math.max(0, Math.round(Number(it.carbs_per100g)   || 0)),
          fat_per100g:     Math.max(0, Math.round(Number(it.fat_per100g)     || 0)),
          fiber_per100g:   Math.max(0, Number(it.fiber_per100g)              || 0),
          sodium_per100g:  Math.max(0, Number(it.sodium_per100g)             || 0),
        });
        anyNew = true;
      }

      if (merged.length === items.length && rawUpdates.length === 0 && !anyNew) {
        setVoiceError("Couldn't identify any food. Try again.");
        return;
      }

      setItems(merged);
      const totals = recomputeTotals(merged);
      setCal(String(totals.calories));
      setPro(String(totals.protein_g));
      setCarb(String(totals.carbs_g));
      setFat(String(totals.fat_g));
      if (anyNew) setRefineOpen(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {
      setVoiceError("Something went wrong. Please try again.");
    } finally {
      setVoiceLoading(false);
      setVoiceQuery('');
    }
  };

  const updateItemWeight = (index: number, gStr: string) => {
    const newItems = items.map((item, i) =>
      i === index ? { ...item, estimated_g: Math.max(0, parseFloat(gStr) || 0) } : item
    );
    setItems(newItems);
    const totals = recomputeTotals(newItems);
    setCal(String(totals.calories));
    setPro(String(totals.protein_g));
    setCarb(String(totals.carbs_g));
    setFat(String(totals.fat_g));
  };

  const updateItemName = (index: number, name: string) => {
    setItems((prev) => prev.map((item, i) => i === index ? { ...item, name } : item));
  };

  const [refetchingIndex,   setRefetchingIndex]   = useState<number | null>(null);
  const [reanalyzeLoading, setReanalyzeLoading] = useState(false);
  const nameBeforeEdit = React.useRef<string>('');

  const refetchItemNutrition = async (index: number, newName: string, oldName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || trimmed.toLowerCase() === oldName.trim().toLowerCase()) return;
    setRefetchingIndex(index);
    try {
      const prompt =
        `Return nutritional values per 100g for "${trimmed}" as ONLY valid JSON with no extra text:\n` +
        `{"cal_per100g":0,"protein_per100g":0,"carbs_per100g":0,"fat_per100g":0,"fiber_per100g":0,"sodium_per100g":0}`;
      const raw = await queryFoodText(prompt);
      const parsed = JSON.parse(raw);
      setItems((prev) => {
        const updated = prev.map((item, i) => i === index ? {
          ...item,
          name: trimmed,
          cal_per100g:     Math.max(0, Math.round(Number(parsed.cal_per100g)     || item.cal_per100g)),
          protein_per100g: Math.max(0, Math.round(Number(parsed.protein_per100g) || item.protein_per100g)),
          carbs_per100g:   Math.max(0, Math.round(Number(parsed.carbs_per100g)   || item.carbs_per100g)),
          fat_per100g:     Math.max(0, Math.round(Number(parsed.fat_per100g)     || item.fat_per100g)),
          fiber_per100g:   Math.max(0, Number(parsed.fiber_per100g)              || item.fiber_per100g),
          sodium_per100g:  Math.max(0, Number(parsed.sodium_per100g)             || item.sodium_per100g),
        } : item);
        const totals = recomputeTotals(updated);
        setCal(String(totals.calories));
        setPro(String(totals.protein_g));
        setCarb(String(totals.carbs_g));
        setFat(String(totals.fat_g));
        return updated;
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch { /* keep existing values silently */ }
    finally { setRefetchingIndex(null); }
  };

  const handleSave = () => {
    const c = parseInt(cal), p = parseFloat(pro), cb = parseFloat(carb), f = parseFloat(fat);
    if ([c, p, cb, f].some((n) => !Number.isFinite(n) || n < 0)) {
      Alert.alert('Invalid values', 'Please enter valid numbers.');
      return;
    }
    const savedItems: SavedFoodItem[] = items.map((it) => ({
      name: it.name,
      actual_g: it.estimated_g,
      cal_per100g: it.cal_per100g,
      protein_per100g: it.protein_per100g,
      carbs_per100g: it.carbs_per100g,
      fat_per100g: it.fat_per100g,
    }));
    onSave({
      description: desc.trim() || 'Meal',
      source,
      calories: c,
      protein: Math.round(p),
      carbs: Math.round(cb),
      fat: Math.round(f),
      fiber: parseFloat(fiber) || undefined,
      sodium: parseFloat(sodium) || undefined,
      sugar: parseFloat(sugar) || undefined,
      confidence: source === 'barcode' ? null : (aiResult?.confidence ?? 'low'),
      items: savedItems.length > 0 ? savedItems : undefined,
      thumbnailBase64: thumbnail ?? undefined,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={[s.sheet, s.reviewSheet]}>
        <View style={s.handle} />
        <View style={s.sheetHdr}>
          <Text style={s.sheetTitle}>Review & Save</Text>
          <TouchableOpacity onPress={onClose} style={s.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Thumbnail */}
          {imageUri && (
            <View style={s.thumbRow}>
              <Image source={{ uri: imageUri }} style={s.thumb} contentFit="cover" />
              {loading && (
                <View style={s.thumbLoadingOverlay}>
                  <ActivityIndicator size="small" color={C.accent} />
                </View>
              )}
            </View>
          )}

          {loading && (
            <View style={[s.reviewLoading, { marginBottom: 4 }]}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={s.reviewLoadingText}>Analyzing meal…</Text>
            </View>
          )}

          {error && (
            <View style={[s.reviewError, { marginBottom: 4 }]}>
              <Ionicons name="warning-outline" size={16} color={C.amber} />
              <Text style={s.reviewErrorText}>{error}</Text>
            </View>
          )}

          {aiResult && !loading && (
            <View style={[s.reviewConfidenceRow, { marginBottom: 8 }]}>
              <ConfidenceBadge level={aiResult.confidence} />
            </View>
          )}

          {/* Main fields */}
          <View style={s.sheetField}>
            <View style={s.descLabelRow}>
              <Text style={s.sheetFieldLabel}>Description</Text>
              {source === 'photo' && !loading && (
                <View style={s.descActionRow}>
                  <TouchableOpacity
                    style={[s.descVoiceBtn, descVoiceListening && s.descVoiceBtnActive]}
                    activeOpacity={0.75}
                    onPress={startDescVoice}
                    disabled={reanalyzeLoading}
                  >
                    <Ionicons
                      name={descVoiceListening ? 'mic' : 'mic-outline'}
                      size={13}
                      color={descVoiceListening ? '#fff' : C.textSub}
                    />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.reanalyzeBtn, reanalyzeLoading && s.reanalyzeBtnDisabled]}
                    activeOpacity={0.75}
                    onPress={() => handleReanalyze()}
                    disabled={reanalyzeLoading || descVoiceListening}
                  >
                    {reanalyzeLoading
                      ? <ActivityIndicator size="small" color={C.blue} />
                      : <Ionicons name="refresh-outline" size={13} color={C.blue} />}
                    <Text style={s.reanalyzeBtnText}>
                      {reanalyzeLoading ? 'Re-analyzing…' : 'Re-analyze'}
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
            <TextInput
              style={[s.sheetInput, s.descInput, descVoiceListening && s.descInputListening]}
              value={loading ? '' : desc}
              onChangeText={setDesc}
              placeholder={loading ? 'Analyzing meal…' : descVoiceListening ? 'Listening…' : 'e.g. Paneer bhurji with corn — edit to improve AI accuracy'}
              placeholderTextColor={loading ? C.textSub : descVoiceListening ? C.accent : C.textMuted}
              editable={!loading && !descVoiceListening}
              keyboardAppearance="dark"
              multiline
              scrollEnabled={false}
            />
            {source === 'photo' && !loading && !descVoiceHintSeen && (
              <View style={s.descVoiceHint}>
                <Ionicons name="mic-outline" size={13} color={C.accent} />
                <Text style={s.descVoiceHintText}>
                  Tap the mic to describe your meal by voice — the AI will use it to re-analyze
                </Text>
              </View>
            )}
            {descVoiceListening && (
              <Text style={s.descListeningNote}>Tap the mic again to stop and re-analyze</Text>
            )}
          </View>

          <View style={s.rowFields}>
            {([
              { label: 'Calories', unit: 'kcal', value: cal, set: setCal },
              { label: 'Protein',  unit: 'g',    value: pro, set: setPro },
              { label: 'Carbs',    unit: 'g',    value: carb, set: setCarb },
              { label: 'Fat',      unit: 'g',    value: fat,  set: setFat },
            ] as const).map(({ label, unit, value, set }) => (
              <View key={label} style={s.halfField}>
                <Text style={s.sheetFieldLabel}>{label} <Text style={s.unitHint}>({unit})</Text></Text>
                <TextInput
                  style={s.sheetInput}
                  value={loading ? '' : value}
                  onChangeText={(t) => (set as (v: string) => void)(t)}
                  placeholder={loading ? '—' : '0'}
                  placeholderTextColor={loading ? C.textSub : C.textMuted}
                  editable={!loading}
                  keyboardType="decimal-pad"
                  keyboardAppearance="dark"
                  inputAccessoryViewID={KBD_ID}
                />
              </View>
            ))}
          </View>

          {/* Micronutrients */}
          <View style={s.rowFields}>
            {([
              { label: 'Fiber',  unit: 'g',  value: fiber,  set: setFiber  },
              { label: 'Sodium', unit: 'mg', value: sodium, set: setSodium },
              { label: 'Sugar',  unit: 'g',  value: sugar,  set: setSugar  },
            ] as const).map(({ label, unit, value, set }) => (
              <View key={label} style={s.thirdField}>
                <Text style={s.sheetFieldLabel}>{label} <Text style={s.unitHint}>({unit})</Text></Text>
                <TextInput
                  style={s.sheetInput}
                  value={loading ? '' : value}
                  onChangeText={(t) => (set as (v: string) => void)(t)}
                  placeholder={loading ? '—' : '0'}
                  placeholderTextColor={loading ? C.textSub : C.textMuted}
                  editable={!loading}
                  keyboardType="decimal-pad"
                  keyboardAppearance="dark"
                  inputAccessoryViewID={KBD_ID}
                />
              </View>
            ))}
          </View>

          {/* Photo reference for barcode meals */}
          {source === 'barcode' && !loading && (
            <View style={s.photoRefSection}>
              <Text style={s.sheetFieldLabel}>Photo reference <Text style={s.unitHint}>(optional)</Text></Text>
              {thumbnail ? (
                <View style={s.photoRefPreviewWrap}>
                  <Image
                    source={{ uri: `data:image/jpeg;base64,${thumbnail}` }}
                    style={s.photoRefPreview}
                    contentFit="cover"
                  />
                  <TouchableOpacity style={s.photoRefRemove} onPress={() => setThumbnail(null)}>
                    <Ionicons name="close-circle" size={22} color={C.red} />
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={s.addPhotoRow}>
                  <TouchableOpacity
                    style={s.addPhotoBtn}
                    activeOpacity={0.8}
                    onPress={() => pickPhotoForThumb('camera')}
                    disabled={thumbLoading}
                  >
                    <Ionicons name="camera-outline" size={18} color={C.textSub} />
                    <Text style={s.addPhotoBtnText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={s.addPhotoBtn}
                    activeOpacity={0.8}
                    onPress={() => pickPhotoForThumb('library')}
                    disabled={thumbLoading}
                  >
                    <Ionicons name="images-outline" size={18} color={C.textSub} />
                    <Text style={s.addPhotoBtnText}>Library</Text>
                  </TouchableOpacity>
                  {thumbLoading && <ActivityIndicator size="small" color={C.accent} />}
                </View>
              )}
            </View>
          )}

          {/* Refine portions */}
          {!loading && items.length > 0 && (
            <View style={s.refineSection}>
              <TouchableOpacity
                style={s.refineHeader}
                activeOpacity={0.7}
                onPress={() => setRefineOpen((v) => !v)}
              >
                <Text style={s.refineSectionLabel}>Refine portions</Text>
                <Ionicons
                  name={refineOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={C.textMuted}
                />
              </TouchableOpacity>
              {refineOpen && items.map((item, i) => (
                <View key={i} style={s.refineRow}>
                  <View style={s.refineNameWrap}>
                    <TextInput
                      style={s.refineItemName}
                      value={item.name}
                      onChangeText={(t) => updateItemName(i, t)}
                      onFocus={() => { nameBeforeEdit.current = item.name; }}
                      onBlur={() => refetchItemNutrition(i, item.name, nameBeforeEdit.current)}
                      placeholder="Food name"
                      placeholderTextColor={C.textMuted}
                      keyboardAppearance="dark"
                      returnKeyType="done"
                      onSubmitEditing={() => Keyboard.dismiss()}
                    />
                    {refetchingIndex === i && (
                      <ActivityIndicator size="small" color={C.accent} style={{ marginLeft: 6 }} />
                    )}
                  </View>
                  <View style={s.refineWeightWrap}>
                    <TextInput
                      style={s.refineWeightInput}
                      value={String(item.estimated_g)}
                      onChangeText={(t) => updateItemWeight(i, t)}
                      keyboardType="decimal-pad"
                      keyboardAppearance="dark"
                      inputAccessoryViewID={KBD_ID}
                      selectTextOnFocus
                    />
                    <Text style={s.refineWeightUnit}>g</Text>
                  </View>
                </View>
              ))}
            </View>
          )}

          {/* Add missed item by voice */}
          {!loading && (
            <View style={s.voiceAddSection}>
              <TouchableOpacity
                style={[s.voiceAddBtn, voiceListening && s.voiceAddBtnActive]}
                activeOpacity={0.75}
                onPress={startVoice}
                disabled={voiceLoading}
              >
                {voiceLoading
                  ? <ActivityIndicator size="small" color={C.accent} />
                  : <Ionicons
                      name={voiceListening ? 'mic' : 'mic-outline'}
                      size={18}
                      color={voiceListening ? '#fff' : C.textSub}
                    />}
                <Text style={[s.voiceAddBtnText, voiceListening && { color: '#fff' }]}>
                  {voiceLoading ? 'Adding items…' : voiceListening ? 'Listening…' : 'Add missed item by voice'}
                </Text>
              </TouchableOpacity>
              {voiceListening && voiceQuery ? (
                <Text style={s.voiceTranscript}>{voiceQuery}</Text>
              ) : voiceError ? (
                <Text style={s.voiceErrorText}>{voiceError}</Text>
              ) : null}
            </View>
          )}

          <TouchableOpacity
            style={[s.sheetBtn, loading && s.sheetBtnDisabled, { marginTop: 16, marginBottom: 8 }]}
            activeOpacity={loading ? 1 : 0.85}
            onPress={loading ? undefined : handleSave}
          >
            <Text style={s.sheetBtnText}>{loading ? 'Waiting for analysis…' : 'Save meal'}</Text>
          </TouchableOpacity>
        </ScrollView>

        <InputAccessoryView nativeID={KBD_ID}>
          <View style={s.kbdBar}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} activeOpacity={0.7}>
              <Text style={s.kbdDone}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── BarcodeSheet ─────────────────────────────────────────────────────────────

function BarcodeSheet({
  visible, onResult, onClose,
}: {
  visible: boolean;
  onResult: (data: Omit<MealEntry, 'id' | 'loggedAt'>) => void;
  onClose: () => void;
}) {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanning,   setScanning]   = useState(true);
  const [fetching,   setFetching]   = useState(false);
  const [errorMsg,   setErrorMsg]   = useState<string | null>(null);
  const scanned = useRef(false);

  React.useEffect(() => {
    if (visible) { scanned.current = false; setScanning(true); setErrorMsg(null); }
  }, [visible]);

  const handleBarcode = async ({ data }: { data: string }) => {
    if (scanned.current || fetching) return;
    scanned.current = true;
    setScanning(false);
    setFetching(true);
    setErrorMsg(null);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

    try {
      const res = await fetch(
        `https://world.openfoodfacts.org/api/v2/product/${data}.json`
      );
      const json = await res.json();
      if (json.status !== 1 || !json.product) {
        setErrorMsg('Product not found. Try another barcode.');
        scanned.current = false;
        setScanning(true);
        return;
      }
      const p = json.product;
      const n = p.nutriments ?? {};
      const serving = parseFloat(p.serving_quantity) || 100;
      const calc = (per100: number) => Math.max(0, Math.round((per100 / 100) * serving));

      onResult({
        description: p.product_name || p.generic_name || 'Scanned product',
        source: 'barcode',
        calories: calc(n['energy-kcal_100g'] ?? 0),
        protein:  calc(n.proteins_100g      ?? 0),
        carbs:    calc(n.carbohydrates_100g  ?? 0),
        fat:      calc(n.fat_100g            ?? 0),
        fiber:    calc(n.fiber_100g          ?? 0) || undefined,
        sodium:   Math.max(0, Math.round((n.sodium_100g ?? 0) / 100 * serving * 1000)) || undefined,
        sugar:    calc(n.sugars_100g         ?? 0) || undefined,
        confidence: null,
      });
      onClose();
    } catch {
      setErrorMsg('Network error. Please try again.');
      scanned.current = false;
      setScanning(true);
    } finally {
      setFetching(false);
    }
  };

  if (!visible) return null;

  if (!permission?.granted) {
    return (
      <Modal visible={visible} animationType="slide">
        <View style={s.barcodePermission}>
          <Ionicons name="camera-outline" size={48} color={C.textSub} />
          <Text style={s.barcodePermText}>Camera access needed to scan barcodes</Text>
          <TouchableOpacity style={s.sheetBtn} activeOpacity={0.85} onPress={requestPermission}>
            <Text style={s.sheetBtnText}>Allow camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={{ marginTop: 16 }} onPress={onClose}>
            <Text style={{ color: C.textMuted, fontSize: 14 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    );
  }

  return (
    <Modal visible={visible} animationType="slide">
      <View style={s.barcodeContainer}>
        <CameraView
          style={StyleSheet.absoluteFill}
          facing="back"
          onBarcodeScanned={scanning ? handleBarcode : undefined}
          barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
        />
        {/* Dimmed overlay with viewfinder */}
        <View style={s.barcodeDim} pointerEvents="none">
          <View style={s.barcodeDimTop} />
          <View style={s.barcodeMidRow}>
            <View style={s.barcodeDimSide} />
            <View style={s.barcodeViewfinder}>
              <View style={[s.barcodeCorner, s.cornerTL]} />
              <View style={[s.barcodeCorner, s.cornerTR]} />
              <View style={[s.barcodeCorner, s.cornerBL]} />
              <View style={[s.barcodeCorner, s.cornerBR]} />
            </View>
            <View style={s.barcodeDimSide} />
          </View>
          <View style={s.barcodeDimBottom} />
        </View>

        {/* Status */}
        <View style={s.barcodeStatus}>
          {fetching ? (
            <View style={s.barcodeStatusPill}>
              <ActivityIndicator size="small" color={C.accent} />
              <Text style={s.barcodeStatusText}>Looking up product…</Text>
            </View>
          ) : errorMsg ? (
            <View style={[s.barcodeStatusPill, { borderColor: C.amberBorder, backgroundColor: C.amberDim }]}>
              <Ionicons name="warning-outline" size={14} color={C.amber} />
              <Text style={[s.barcodeStatusText, { color: C.amber }]}>{errorMsg}</Text>
            </View>
          ) : (
            <View style={s.barcodeStatusPill}>
              <Text style={s.barcodeStatusText}>Point at a barcode</Text>
            </View>
          )}
        </View>

        {/* Cancel */}
        <TouchableOpacity style={s.barcodeCancelBtn} activeOpacity={0.8} onPress={onClose}>
          <Ionicons name="close" size={22} color={C.text} />
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function NutritionScreen() {
  const { meals, targets, todaysMeals, todaysTotals, addMeal, deleteMeal, updateTargets } = useNutrition();
  const { latestEntry: bodyEntry, entries: bodyEntries } = useBodyMetrics();
  const { completedWorkouts } = useWorkout();

  const [showTargets,    setShowTargets]    = useState(false);
  const [showReview,     setShowReview]     = useState(false);
  const [reviewLoading,  setReviewLoading]  = useState(false);
  const [reviewResult,   setReviewResult]   = useState<FoodVisionResult | null>(null);
  const [reviewError,    setReviewError]    = useState<string | null>(null);
  const [reviewImageUri, setReviewImageUri] = useState<string | null>(null);
  const [reviewSource,   setReviewSource]   = useState<'photo' | 'barcode' | 'manual'>('photo');
  const [showBarcode,    setShowBarcode]    = useState(false);
  const [barcodeResult,  setBarcodeResult]  = useState<Omit<MealEntry, 'id' | 'loggedAt'> | null>(null);
  const [tipText,        setTipText]        = useState<string | null>(null);
  const [tipLoading,     setTipLoading]     = useState(false);
  const [actionMeal,     setActionMeal]     = useState<MealEntry | null>(null);
  const [editingMealId,  setEditingMealId]  = useState<string | null>(null);
  const [pendingLateNight, setPendingLateNight] = useState<{
    entry: Omit<MealEntry, 'id' | 'loggedAt'>;
    editingMealId: string | null;
  } | null>(null);
  const tipFetched = useRef(false);

  const fetchTip = async () => {
    // Tester's own key takes priority over the shared/dev env key.
    const geminiKey = (await loadUserGeminiKey()) || process.env.EXPO_PUBLIC_GOOGLE_AI_KEY;
    const openAIKey = process.env.EXPO_PUBLIC_OPENROUTER_KEY;
    if (!geminiKey && !openAIKey) return;
    setTipLoading(true);
    try {
      const rollingState = buildRollingUserState(
        meals,
        completedWorkouts,
        bodyEntries,
        targets.calories,
        targets.protein
      );

      const prompt =
        `You are a fitness + nutrition coach with access to this user's real data. ` +
        `Cross-reference food and training — don't just restate one number, connect them ` +
        `(e.g. low protein on training days, a stalled lift alongside a calorie deficit, ` +
        `dropped volume alongside rising bodyweight).\n\n` +
        `Today so far: ${todaysTotals.calories}/${targets.calories} kcal, ` +
        `${todaysTotals.protein}/${targets.protein}g protein, ` +
        `${todaysTotals.carbs}/${targets.carbs}g carbs, ${todaysTotals.fat}/${targets.fat}g fat.\n\n` +
        `${summarizeForPrompt(rollingState)}\n\n` +
        `Give ONE short actionable tip (max 2 sentences). Prioritize the weekly pattern over ` +
        `today's numbers alone if they tell a clearer story. Be specific, no generic advice. ` +
        `Return plain text only, no JSON.`;

      // Try Gemini first, fall back to OpenAI
      if (geminiKey) {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${geminiKey}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { maxOutputTokens: 120, temperature: 0.7, thinkingConfig: { thinkingBudget: 0 } },
            }),
          }
        );
        if (res.ok) {
          const json = await res.json();
          const parts: Array<{ text?: string; thought?: boolean }> =
            json.candidates?.[0]?.content?.parts ?? [];
          const tip = parts.find((p) => !p.thought)?.text?.trim();
          if (tip) { setTipText(tip); return; }
        } else {
          const errBody = await res.text().catch(() => '');
          console.warn('[Gemini tip]', res.status, errBody.slice(0, 300));
        }
      }
      if (openAIKey) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openAIKey}`,
            'HTTP-Referer': 'https://gymbro.app',
            'X-Title': 'GymBro',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.0-flash-exp:free',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 120,
            temperature: 0.7,
          }),
        });
        if (res.ok) {
          const json = await res.json();
          setTipText(json.choices?.[0]?.message?.content?.trim() ?? null);
        }
      }
    } catch {
      // silent fail — tip is optional
    } finally {
      setTipLoading(false);
    }
  };

  useEffect(() => {
    if (todaysMeals.length > 0 && !tipFetched.current) {
      tipFetched.current = true;
      fetchTip();
    }
  }, [todaysMeals.length]);

  const weeklyData = useMemo(() => {
    const DAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const key = toDateKey(d.toISOString());
      const cals = meals
        .filter((m) => toDateKey(m.loggedAt) === key)
        .reduce((sum, m) => sum + m.calories, 0);
      return { label: i === 6 ? 'Today' : DAY[d.getDay()], calories: cals };
    });
  }, [meals]);

  const maintenanceCal = useMemo(() => {
    if (!bodyEntry?.weight || !bodyEntry?.bodyFat) return null;
    const lbm = bodyEntry.weight * (1 - bodyEntry.bodyFat / 100);
    return Math.round((370 + 21.6 * lbm) * 1.55);
  }, [bodyEntry]);

  const pastDayGroups = useMemo(() => {
    const todayKey = toDateKey(new Date().toISOString());
    const groups = new Map<string, MealEntry[]>();
    for (const meal of meals) {
      const key = toDateKey(meal.loggedAt);
      if (key === todayKey) continue;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(meal);
    }
    return Array.from(groups.entries())
      .sort(([a], [b]) => b.localeCompare(a))
      .map(([dateKey, dayMeals]) => ({ dateKey, dayMeals }));
  }, [meals]);

  // Recent meals: last 5 unique descriptions
  const recentMeals = useMemo(() => {
    const seen = new Set<string>();
    const result: MealEntry[] = [];
    for (const m of meals) {
      const key = m.description.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      result.push(m);
      if (result.length >= 5) break;
    }
    return result;
  }, [meals]);

  const launchPicker = async (source: 'camera' | 'library') => {
    const permFn = source === 'camera'
      ? ImagePicker.requestCameraPermissionsAsync
      : ImagePicker.requestMediaLibraryPermissionsAsync;
    const { status } = await permFn();
    if (status !== 'granted') {
      Alert.alert('Permission required', `Please allow ${source === 'camera' ? 'camera' : 'photo library'} access in Settings.`);
      return;
    }
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 0.8, base64: false, allowsEditing: false })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: 'images', quality: 0.8, base64: false, allowsEditing: false });

    if (result.canceled) return;

    const uri = result.assets[0].uri;
    setReviewResult(null);
    setReviewError(null);
    setReviewImageUri(uri);
    setReviewSource('photo');
    setReviewLoading(true);
    setShowReview(true);

    try {
      const aiResult = await analyzeFoodPhoto(uri);
      setReviewResult(aiResult);
    } catch (err) {
      const msg = err instanceof FoodVisionError ? err.message : 'Analysis failed. Please try again.';
      setReviewError(msg);
    } finally {
      setReviewLoading(false);
    }
  };

  const handleBarcodeResult = (entry: Omit<MealEntry, 'id' | 'loggedAt'>) => {
    setBarcodeResult(entry);
    setReviewResult(null);
    setReviewError(null);
    setReviewImageUri(null);
    setReviewSource('barcode');
    setReviewLoading(false);
    setShowReview(true);
  };

  const handleRecentMeal = (meal: MealEntry) => {
    setReviewSource('manual');
    setReviewResult({
      description: meal.description,
      confidence: 'high',
      items: (meal.items ?? []).map((it) => ({
        name: it.name,
        estimated_g: it.actual_g,
        cal_per100g: it.cal_per100g,
        protein_per100g: it.protein_per100g,
        carbs_per100g: it.carbs_per100g,
        fat_per100g: it.fat_per100g,
        fiber_per100g: 0,
        sodium_per100g: 0,
      })),
      fiber_g:   meal.fiber   ?? 0,
      sodium_mg: meal.sodium  ?? 0,
      sugar_g:   meal.sugar   ?? 0,
      calories:  meal.calories,
      protein_g: meal.protein,
      carbs_g:   meal.carbs,
      fat_g:     meal.fat,
    });
    setReviewError(null);
    setReviewImageUri(null);
    setReviewLoading(false);
    setShowReview(true);
  };

  const handleEditMeal = (meal: MealEntry) => {
    setActionMeal(null);
    setEditingMealId(meal.id);
    handleRecentMeal(meal);
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.eyebrow}>Nutrition</Text>
          <Text style={s.title}>Today&apos;s intake</Text>
        </View>

        {/* Daily Totals Card */}
        <CompactStatsCard
          consumed={todaysTotals.calories}
          target={targets.calories}
          maintenanceCal={maintenanceCal}
          protein={todaysTotals.protein}
          proteinTarget={targets.protein}
          carbs={todaysTotals.carbs}
          carbsTarget={targets.carbs}
          fat={todaysTotals.fat}
          fatTarget={targets.fat}
          onEdit={() => setShowTargets(true)}
        />

        {/* Recent meals quick-log */}
        {recentMeals.length > 0 && (
          <View>
            <Text style={s.sectionLabel}>Recent</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.recentScroll}>
              {recentMeals.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={s.recentChip}
                  activeOpacity={0.75}
                  onPress={() => handleRecentMeal(m)}
                >
                  <Text style={s.recentChipText} numberOfLines={1}>{m.description}</Text>
                  <Text style={s.recentChipCal}>{m.calories} kcal</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Add Meal Buttons */}
        <FeatureHint
          id="nutrition-ai-logging"
          icon="sparkles-outline"
          title="AI-powered meal logging"
          body="Take a photo or scan a barcode and the AI estimates calories and macros for you. Add a free Gemini key in Profile if you haven't yet."
        />
        <View style={s.addCol}>
          <TouchableOpacity
            style={s.addBtnPrimary}
            activeOpacity={0.85}
            onPress={() => { launchPicker('camera'); markFeatureSeen('nutrition-ai-logging'); }}
          >
            <Ionicons name="camera-outline" size={22} color="#071109" />
            <Text style={s.addBtnPrimaryText}>Take Photo</Text>
          </TouchableOpacity>
          <View style={s.addRow}>
            <TouchableOpacity
              style={s.addBtnSecondary}
              activeOpacity={0.85}
              onPress={() => { setShowBarcode(true); markFeatureSeen('nutrition-ai-logging'); }}
            >
              <Ionicons name="barcode-outline" size={20} color={C.textSub} />
              <Text style={s.addBtnSecondaryText}>Scan Barcode</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={s.addBtnSecondary}
              activeOpacity={0.85}
              onPress={() => { launchPicker('library'); markFeatureSeen('nutrition-ai-logging'); }}
            >
              <Ionicons name="images-outline" size={20} color={C.textSub} />
              <Text style={s.addBtnSecondaryText}>Photo Library</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* AI Tip */}
        <TipCard tip={tipText} loading={tipLoading} onRefresh={fetchTip} />

        {/* Today's Meals */}
        <View>
          <Text style={s.sectionLabel}>Today</Text>
          {todaysMeals.length === 0 ? (
            <View style={s.emptyCard}>
              <Ionicons name="restaurant-outline" size={32} color={C.textMuted} />
              <Text style={s.emptyText}>No meals logged yet</Text>
              <Text style={s.emptySubText}>Take a photo or scan a barcode to log a meal</Text>
            </View>
          ) : (
            <View style={s.mealCard}>
              {todaysMeals.map((m, i) => (
                <View key={m.id} style={[s.mealRowWrap, i < todaysMeals.length - 1 && s.mealRowBorder]}>
                  <MealRow meal={m} onLongPress={() => setActionMeal(m)} score={mealQualityScore(m, targets)} />
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Past Days */}
        {pastDayGroups.length > 0 && (
          <View>
            <Text style={s.sectionLabel}>Past days</Text>
            {pastDayGroups.map(({ dateKey, dayMeals }) => (
              <DayGroup key={dateKey} dateKey={dateKey} dayMeals={dayMeals} onLongPress={(meal) => setActionMeal(meal)} targets={targets} />
            ))}
          </View>
        )}

        {/* Weekly Trend */}
        <View style={s.weekCard}>
          <View style={s.weekCardHdr}>
            <Text style={s.sectionLabel}>This week</Text>
            <Text style={s.weekAvg}>
              avg {Math.round(weeklyData.reduce((s, d) => s + d.calories, 0) / 7)} kcal/day
            </Text>
          </View>
          <WeeklyNutritionChart data={weeklyData} target={targets.calories} />
        </View>
      </ScrollView>

      {/* Modals */}
      <TargetsSheet
        visible={showTargets}
        targets={targets}
        onSave={updateTargets}
        onClose={() => setShowTargets(false)}
      />

      <ReviewSheet
        visible={showReview}
        loading={reviewLoading}
        source={reviewSource}
        aiResult={barcodeResult ? {
          description: barcodeResult.description,
          confidence: 'high',
          items: [],
          fiber_g: barcodeResult.fiber ?? 0,
          sodium_mg: barcodeResult.sodium ?? 0,
          sugar_g: barcodeResult.sugar ?? 0,
          calories: barcodeResult.calories,
          protein_g: barcodeResult.protein,
          carbs_g: barcodeResult.carbs,
          fat_g: barcodeResult.fat,
        } : reviewResult}
        error={reviewError}
        imageUri={reviewImageUri}
        onSave={(entry) => {
          const editingSnapshot = editingMealId;
          if (editingSnapshot) {
            deleteMeal(editingSnapshot);
            setEditingMealId(null);
          }
          setBarcodeResult(null);

          if (new Date().getHours() < 4) {
            setPendingLateNight({ entry, editingMealId: editingSnapshot });
            return;
          }

          addMeal(entry);
        }}
        onClose={() => {
          setShowReview(false);
          setReviewResult(null);
          setReviewError(null);
          setReviewImageUri(null);
          setBarcodeResult(null);
          setEditingMealId(null);
        }}
      />

      <BarcodeSheet
        visible={showBarcode}
        onResult={handleBarcodeResult}
        onClose={() => setShowBarcode(false)}
      />

      <MealActionSheet
        meal={actionMeal}
        onEdit={() => actionMeal && handleEditMeal(actionMeal)}
        onDelete={() => {
          if (actionMeal) {
            deleteMeal(actionMeal.id);
            setActionMeal(null);
          }
        }}
        onClose={() => setActionMeal(null)}
      />

      <Modal
        visible={pendingLateNight !== null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (pendingLateNight) {
            addMeal(pendingLateNight.entry);
            setPendingLateNight(null);
          }
        }}
      >
        <View style={s.lateNightBackdrop}>
          <View style={s.lateNightCard}>
            <Text style={s.lateNightEmoji}>🌙</Text>
            <Text style={s.lateNightTitle}>It&apos;s past midnight</Text>
            <Text style={s.lateNightBody}>
              Should this meal count toward yesterday or today?
            </Text>

            <TouchableOpacity
              style={s.lateNightPrimaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (!pendingLateNight) return;
                const y = new Date();
                y.setDate(y.getDate() - 1);
                y.setHours(23, 30, 0, 0);
                addMeal(pendingLateNight.entry, y.toISOString());
                setPendingLateNight(null);
              }}
            >
              <Text style={s.lateNightPrimaryBtnText}>Log to Yesterday</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={s.lateNightSecondaryBtn}
              activeOpacity={0.85}
              onPress={() => {
                if (!pendingLateNight) return;
                addMeal(pendingLateNight.entry);
                setPendingLateNight(null);
              }}
            >
              <Text style={s.lateNightSecondaryBtnText}>Log to Today</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const VIEWFINDER = 260;
const CORNER = 22;
const CORNER_THICKNESS = 3;

const s = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { padding: 20, paddingBottom: 48, gap: 20 },

  header:  { gap: 4 },
  eyebrow: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  title:   { color: C.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.5 },

  // AI Tip card
  tipCard: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 20, padding: 16,
  },
  tipIconWrap: {
    width: 34, height: 34, borderRadius: 17,
    backgroundColor: C.accentDim, alignItems: 'center', justifyContent: 'center',
  },
  tipText:    { color: C.text,     fontSize: 14, fontWeight: '600', lineHeight: 20 },
  tipRefresh: { color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 6 },

  // Weekly chart card
  weekCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingTop: 16, paddingBottom: 8, overflow: 'hidden',
  },
  weekCardHdr: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, marginBottom: 12,
  },
  weekAvg: { color: C.textMuted, fontSize: 12, fontWeight: '600' },
  weekChartWrap: { flexDirection: 'row', paddingHorizontal: 16 },
  weekYAxis: { width: CHART_PAD - 8, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 },
  weekYLbl:  { color: C.textMuted, fontSize: 9, lineHeight: 12 },
  weekXLabels: { flexDirection: 'row', marginTop: 4 },
  weekXLbl:  { flex: 1, color: C.textMuted, fontSize: 9, textAlign: 'center' },

  // Totals card (legacy — kept for style keys referenced elsewhere)
  totalsCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 24, padding: 20, gap: 16, alignItems: 'center',
  },
  macroRow:       { flexDirection: 'row', gap: 10, alignSelf: 'stretch' },
  totalsEditHint: { color: C.textMuted, fontSize: 11, fontWeight: '600', alignSelf: 'flex-end', marginTop: -8 },

  // Compact Stats Card
  statsCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 16, gap: 14,
  },
  statsTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  statsLeft: { flex: 1, gap: 3 },
  statsCalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  statsCalNum: { color: C.text, fontSize: 36, fontWeight: '900', letterSpacing: -1 },
  statsCalSuffix: { color: C.textMuted, fontSize: 14, fontWeight: '600' },
  statsRemain: { fontSize: 13, fontWeight: '700' },
  statsMaint: { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  statsEditHint: { color: C.textMuted, fontSize: 11, fontWeight: '600', alignSelf: 'flex-end', marginTop: -6 },
  macroBarRow: { gap: 8 },
  macroBar: { gap: 4 },
  macroBarHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  macroBarLbl: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  macroBarVal: { fontSize: 12, fontWeight: '700', color: C.text },
  macroBarMax: { color: C.textMuted, fontWeight: '500' },
  macroBarTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 3, overflow: 'hidden' },
  macroBarFill: { height: '100%', borderRadius: 3 },

  // Calorie ring
  ringWrap: { alignItems: 'center', justifyContent: 'center' },
  ringCenter: {
    position: 'absolute', alignItems: 'center', justifyContent: 'center',
    width: RING_SIZE, height: RING_SIZE,
  },
  ringCalNum:    { color: C.text,     fontSize: 42, fontWeight: '900', letterSpacing: -2 },
  ringOf:        { color: C.textMuted, fontSize: 13, fontWeight: '600', marginTop: -2 },
  ringLeft:      { fontSize: 13, fontWeight: '700', marginTop: 4 },
  ringMaintenance: { color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 3 },

  // MacroPill
  macroPill: {
    flex: 1, borderWidth: 1, borderRadius: 18,
    padding: 12, gap: 6,
  },
  macroPillLabel:    { fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6 },
  macroPillValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 1 },
  macroPillNum:      { color: C.text,     fontSize: 18, fontWeight: '900' },
  macroPillOf:       { color: C.textMuted, fontSize: 11, fontWeight: '600' },
  macroPillTrack:    { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  macroPillFill:     { height: '100%', borderRadius: 2 },

  // Micronutrient row
  microRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 4, marginTop: -4 },
  microItem: {},
  microLabel: { color: C.textMuted, fontSize: 11, fontWeight: '700' },
  microValue: { color: C.textSub,   fontSize: 11, fontWeight: '600' },
  microDot:   { color: C.border,    fontSize: 11 },

  // Recent chips
  recentScroll: { gap: 8, paddingRight: 4 },
  recentChip: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10, maxWidth: 160,
  },
  recentChipText: { color: C.text,     fontSize: 13, fontWeight: '700' },
  recentChipCal:  { color: C.textMuted, fontSize: 11, fontWeight: '600', marginTop: 2 },

  // Add meal buttons
  addCol: { gap: 10 },
  addBtnPrimary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 18, paddingVertical: 16,
  },
  addBtnPrimaryText: { color: '#071109', fontSize: 15, fontWeight: '900' },
  addRow: { flexDirection: 'row', gap: 10 },
  addBtnSecondary: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, paddingVertical: 14,
  },
  addBtnSecondaryText: { color: C.textSub, fontSize: 14, fontWeight: '700' },

  // Section
  sectionLabel: {
    color: C.textSub, fontSize: 12, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12,
  },

  // Empty state
  emptyCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 32, alignItems: 'center', gap: 8,
  },
  emptyText:    { color: C.textSub,   fontSize: 16, fontWeight: '700' },
  emptySubText: { color: C.textMuted, fontSize: 13 },

  // Meal card / rows
  mealCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, overflow: 'hidden',
  },
  mealRowWrap: {},
  mealRowBorder: { borderBottomWidth: 1, borderBottomColor: C.border },
  mealRow: { flexDirection: 'row', alignItems: 'stretch' },
  mealStripe: { width: 3 },
  mealRowContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 13, paddingHorizontal: 14 },
  mealRowLeft: { flex: 1 },
  mealName: { color: C.text, fontSize: 15, fontWeight: '700' },
  mealMeta: { color: C.textMuted, fontSize: 12, marginTop: 2 },
  mealMicroLine: { color: C.textMuted, fontSize: 11, marginTop: 2 },
  mealCalBadge: {
    backgroundColor: C.elevated, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6,
    alignItems: 'center',
  },
  mealCalBadgeText: { color: C.text,     fontSize: 14, fontWeight: '800' },
  mealCalBadgeUnit: { color: C.textMuted, fontSize: 10, fontWeight: '600' },

  // MealActionSheet
  actionSheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 40, gap: 8,
  },
  actionSheetMealName: { color: C.text, fontSize: 17, fontWeight: '800', marginTop: 4 },
  actionSheetMealMeta: { color: C.textMuted, fontSize: 13, fontWeight: '600' },
  actionSheetDivider: { height: 1, backgroundColor: C.border, marginVertical: 8 },
  actionBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 14, paddingHorizontal: 4,
  },
  actionBtnIcon: {
    width: 38, height: 38, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  actionBtnLabel: { flex: 1, color: C.text, fontSize: 15, fontWeight: '700' },
  actionDeleteConfirm: { gap: 10, paddingVertical: 8 },
  actionDeleteConfirmText: { color: C.text, fontSize: 15, fontWeight: '700' },
  actionDeleteBtns: { flexDirection: 'row', gap: 10 },
  actionCancelBtn: {
    flex: 1, alignItems: 'center', paddingVertical: 13,
    backgroundColor: C.elevated, borderRadius: 16, borderWidth: 1, borderColor: C.border,
  },
  actionCancelBtnText: { color: C.textSub, fontSize: 15, fontWeight: '700' },
  actionConfirmBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 13, backgroundColor: C.red, borderRadius: 16,
  },
  actionConfirmBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },

  // Day group
  dayGroup: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, overflow: 'hidden', marginBottom: 10,
  },
  dayGroupHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  dayGroupRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dayGroupLabel: { color: C.text,     fontSize: 14, fontWeight: '800' },
  dayGroupTotal: { color: C.textMuted, fontSize: 13, fontWeight: '600' },

  // Badge
  badge: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 12, fontWeight: '700' },

  // Sheet / Modal shared
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28,
    paddingHorizontal: 20, paddingBottom: 40, gap: 14,
    maxHeight: '92%',
  },
  reviewSheet: { maxHeight: '95%' },
  handle: {
    width: 36, height: 4, borderRadius: 2, backgroundColor: C.border,
    alignSelf: 'center', marginTop: 12,
  },
  sheetHdr: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  sheetTitle: { color: C.text, fontSize: 20, fontWeight: '900' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 10,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  sheetField:      { gap: 6 },
  sheetFieldLabel: { color: C.textSub, fontSize: 12, fontWeight: '700' },
  unitHint:        { color: C.textMuted, fontWeight: '500' },
  sheetInput: {
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, color: C.text, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
  },
  sheetBtn: {
    backgroundColor: C.accent, borderRadius: 18, paddingVertical: 16,
    alignItems: 'center',
  },
  sheetBtnDisabled: { backgroundColor: C.elevated },
  sheetBtnText: { color: '#071109', fontSize: 16, fontWeight: '900' },

  // Description field with Re-analyze + voice
  descLabelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  descActionRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  descInput: { minHeight: 44, textAlignVertical: 'top' },
  descInputListening: { borderColor: C.accentBorder, backgroundColor: C.accentDim },
  descVoiceBtn: {
    width: 28, height: 28, borderRadius: 9,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  descVoiceBtnActive: { backgroundColor: C.red, borderColor: C.redBorder },
  descVoiceHint: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 10, padding: 10, marginTop: 6,
  },
  descVoiceHintText: { flex: 1, color: C.accent, fontSize: 12, fontWeight: '600', lineHeight: 17 },
  descListeningNote: { color: C.textMuted, fontSize: 11, fontWeight: '600', fontStyle: 'italic', marginTop: 4, paddingHorizontal: 2 },
  reanalyzeBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.blueDim, borderWidth: 1, borderColor: C.blueBorder,
    borderRadius: 10, paddingHorizontal: 10, paddingVertical: 5,
  },
  reanalyzeBtnDisabled: { opacity: 0.5 },
  reanalyzeBtnText: { color: C.blue, fontSize: 12, fontWeight: '700' },

  // Row/grid fields in ReviewSheet
  rowFields: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 4 },
  halfField:  { width: '47%', gap: 6 },
  thirdField: { flex: 1, gap: 6, minWidth: 80 },

  // Thumbnail
  thumbRow: { alignItems: 'center', marginBottom: 8 },
  thumb: { width: 100, height: 100, borderRadius: 12 },
  thumbLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },

  // Review sheet extras
  reviewLoading: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 14, padding: 12,
  },
  reviewLoadingText: { color: C.accent, fontSize: 13, fontWeight: '700' },
  reviewError: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: C.amberDim, borderWidth: 1, borderColor: C.amberBorder,
    borderRadius: 14, padding: 12,
  },
  reviewErrorText: { flex: 1, color: C.amber, fontSize: 13, fontWeight: '600' },
  reviewConfidenceRow: {},

  // Refine portions
  refineSection: {
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.borderSub,
    borderRadius: 16, overflow: 'hidden', marginTop: 4,
  },
  refineHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 12,
  },
  refineSectionLabel: { color: C.textSub, fontSize: 13, fontWeight: '800' },
  refineRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 14, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
  },
  refineNameWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', marginRight: 12 },
  refineItemName: {
    flex: 1, color: C.text, fontSize: 14, fontWeight: '600',
    borderBottomWidth: 1, borderBottomColor: C.borderSub, paddingBottom: 2,
  },
  refineWeightWrap: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  refineWeightInput: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, color: C.text, paddingHorizontal: 10, paddingVertical: 8,
    fontSize: 14, fontWeight: '700', width: 72, textAlign: 'right',
  },
  refineWeightUnit: { color: C.textMuted, fontSize: 13, fontWeight: '600' },

  // Barcode scanner
  barcodeContainer: { flex: 1, backgroundColor: '#000' },
  barcodePermission: {
    flex: 1, backgroundColor: C.bg, alignItems: 'center', justifyContent: 'center',
    padding: 32, gap: 16,
  },
  barcodePermText: { color: C.textSub, fontSize: 16, textAlign: 'center', fontWeight: '600' },
  barcodeDim: { ...StyleSheet.absoluteFillObject },
  barcodeDimTop:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  barcodeDimBottom: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  barcodeMidRow: { flexDirection: 'row', height: VIEWFINDER },
  barcodeDimSide: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)' },
  barcodeViewfinder: { width: VIEWFINDER, height: VIEWFINDER },
  barcodeCorner: {
    position: 'absolute', width: CORNER, height: CORNER,
    borderColor: '#fff', borderRadius: 2,
  },
  cornerTL: { top: 0, left: 0, borderTopWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerTR: { top: 0, right: 0, borderTopWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  cornerBL: { bottom: 0, left: 0, borderBottomWidth: CORNER_THICKNESS, borderLeftWidth: CORNER_THICKNESS },
  cornerBR: { bottom: 0, right: 0, borderBottomWidth: CORNER_THICKNESS, borderRightWidth: CORNER_THICKNESS },
  barcodeStatus: {
    position: 'absolute', bottom: 120, left: 0, right: 0, alignItems: 'center',
  },
  barcodeStatusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(15,17,23,0.85)', borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10,
  },
  barcodeStatusText: { color: C.text, fontSize: 13, fontWeight: '600' },
  barcodeCancelBtn: {
    position: 'absolute', top: 56, right: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(15,17,23,0.8)', alignItems: 'center', justifyContent: 'center',
  },

  // Keyboard bar
  kbdBar: {
    backgroundColor: '#1C1E27', borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: 16, paddingVertical: 10, alignItems: 'flex-end',
  },
  kbdDone: { color: C.accent, fontSize: 16, fontWeight: '700' },

  // Quality badge
  qualityBadge: {
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, alignItems: 'center',
  },
  qualityBadgeNum: { fontSize: 12, fontWeight: '900' },

  // Meal thumbnail (in meal row history)
  mealThumb: { width: 48, height: 48, borderRadius: 6, margin: 8 },

  // Right column in meal row (calorie + quality badge stacked)
  mealRightCol: { alignItems: 'flex-end', gap: 5 },

  // Photo reference section (barcode flow)
  photoRefSection: { gap: 8, marginTop: 4 },
  photoRefPreviewWrap: { position: 'relative', alignSelf: 'flex-start' },
  photoRefPreview: { width: 80, height: 80, borderRadius: 10 },
  photoRefRemove: { position: 'absolute', top: -8, right: -8 },
  addPhotoRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  addPhotoBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, paddingVertical: 11,
  },
  addPhotoBtnText: { color: C.textSub, fontSize: 13, fontWeight: '700' },

  // Voice add missed item
  voiceAddSection: { gap: 6 },
  voiceAddBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingVertical: 13, paddingHorizontal: 16,
  },
  voiceAddBtnActive: { backgroundColor: C.red, borderColor: C.redBorder },
  voiceAddBtnText: { flex: 1, color: C.textSub, fontSize: 14, fontWeight: '700' },
  voiceTranscript: {
    color: C.textSub, fontSize: 12, fontWeight: '600', fontStyle: 'italic',
    paddingHorizontal: 4,
  },
  voiceErrorText: { color: C.red, fontSize: 12, fontWeight: '600', paddingHorizontal: 4 },

  lateNightBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  lateNightCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
    gap: 12,
  },
  lateNightEmoji: {
    fontSize: 36,
  },
  lateNightTitle: {
    color: C.text,
    fontSize: 21,
    fontWeight: '800',
    textAlign: 'center',
  },
  lateNightBody: {
    color: C.textSub,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 6,
    paddingHorizontal: 4,
  },
  lateNightPrimaryBtn: {
    width: '100%',
    backgroundColor: C.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  lateNightPrimaryBtnText: {
    color: '#07110A',
    fontSize: 14,
    fontWeight: '800',
  },
  lateNightSecondaryBtn: {
    width: '100%',
    backgroundColor: C.elevated,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  lateNightSecondaryBtnText: {
    color: C.text,
    fontSize: 14,
    fontWeight: '700',
  },
});
