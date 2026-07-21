import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState } from 'react';
import {
  Dimensions,
  InputAccessoryView,
  Keyboard,
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
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Circle, Line, Polygon, Polyline, Svg } from 'react-native-svg';
import { useBodyMetrics } from '../../context/BodyMetricsContext';
import { useNutrition } from '../../context/NutritionContext';
import { useWorkout } from '../../context/WorkoutContext';
import { toDateKey } from '../../utils/dateHelpers';
import {
  analyzeProgress,
  bodyFatChartData,
  bodyweightChartData,
  exerciseStrengthChartData,
  getStrengthBenchmarks,
  getTopExercisesByVolume,
  type ChartPoint,
  type Insight,
  type StrengthBenchmark,
  weeklyVolumeChartData,
} from '../../utils/analytics';

const SCREEN_WIDTH = Dimensions.get('window').width;
const Y_AXIS_W = 38;
const CHART_INNER = SCREEN_WIDTH - 72;
const CHART_SVG_W = CHART_INNER - Y_AXIS_W;
const LINE_H = 120;
const KBD_ID = 'progress-log-kbd';

function fmtY(v: number, unit: string): string {
  if (Math.abs(v) >= 1000) return `${Math.round(v / 1000)}k${unit}`;
  return `${Math.round(v)}${unit}`;
}

// ─── Design tokens ────────────────────────────────────────────────────────────

const C = {
  bg:              '#080A0F',
  surface:         '#0F1117',
  elevated:        '#161820',
  card:            '#13151C',
  border:          '#1E2130',
  borderSub:       '#252838',
  text:            '#F0F4FF',
  textSub:         '#8892A4',
  textMuted:       '#515B6C',
  accent:          '#22C55E',
  accentDim:       'rgba(34,197,94,0.12)',
  accentBorder:    'rgba(34,197,94,0.30)',
  blue:            '#3B82F6',
  blueDim:         'rgba(59,130,246,0.12)',
  blueBorder:      'rgba(59,130,246,0.30)',
  amber:           '#F59E0B',
  amberDim:        'rgba(245,158,11,0.12)',
  amberBorder:     'rgba(245,158,11,0.30)',
  purple:          '#A855F7',
  purpleDim:       'rgba(168,85,247,0.12)',
  purpleBorder:    'rgba(168,85,247,0.30)',
  red:             '#EF4444',
  redDim:          'rgba(239,68,68,0.12)',
} as const;

const SEV = {
  positive: { bg: C.accentDim,  border: C.accentBorder,  text: C.accent  },
  warning:  { bg: C.amberDim,   border: C.amberBorder,   text: C.amber   },
  info:     { bg: C.blueDim,    border: C.blueBorder,    text: C.blue    },
} as const;

const LEVEL_COLOR: Record<string, string> = {
  beginner:     C.textSub,
  intermediate: C.blue,
  advanced:     C.amber,
  elite:        C.accent,
};

// ─── US Navy body-fat formula (measurements in cm) ────────────────────────────

function navyBF(
  gender: 'male' | 'female',
  height: number,
  waist: number,
  neck: number,
  hip: number,
): number {
  const v =
    gender === 'male'
      ? 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(height)) - 450
      : 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.22100 * Math.log10(height)) - 450;
  return Math.round(v * 10) / 10;
}

function bfCategory(bf: number, g: 'male' | 'female'): string {
  const ranges =
    g === 'male'
      ? [[6, 'Essential fat'], [14, 'Athletic'], [18, 'Fitness'], [25, 'Average'], [100, 'Above average']]
      : [[14, 'Essential fat'], [21, 'Athletic'], [25, 'Fitness'], [32, 'Average'], [100, 'Above average']];
  for (const [limit, label] of ranges as [number, string][]) {
    if (bf < limit) return label;
  }
  return 'Above average';
}

// ─── Chart primitives ─────────────────────────────────────────────────────────

function LineChart({ data, color, yUnit = '', fill = false }: { data: ChartPoint[]; color: string; yUnit?: string; fill?: boolean }) {
  if (data.length < 2) return null;
  const w = CHART_SVG_W, h = LINE_H, pad = 8;
  const ys = data.map((d) => d.y);
  const min = Math.min(...ys), max = Math.max(...ys);
  const range = max - min || 1;
  const midVal = (min + max) / 2;

  const toY = (v: number) => h - pad - ((v - min) / range) * (h - pad * 2);
  const yTop = toY(max), yMid = toY(midVal), yBot = toY(min);

  const pts = data.map((d, i) => ({
    x: pad + (i / (data.length - 1)) * (w - pad * 2),
    y: toY(d.y),
  }));

  // Pick x-axis labels: all if ≤ 6 points, otherwise first + evenly-spaced + last
  const xIndices: number[] = data.length <= 6
    ? data.map((_, i) => i)
    : [0, Math.floor((data.length - 1) / 2), data.length - 1];

  return (
    <View style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {/* Y-axis labels */}
        <View style={{ width: Y_AXIS_W, height: h, justifyContent: 'space-between', alignItems: 'flex-end', paddingRight: 6 }}>
          <Text style={{ color: C.textMuted, fontSize: 9, lineHeight: 12 }}>{fmtY(max, yUnit)}</Text>
          <Text style={{ color: C.textMuted, fontSize: 9, lineHeight: 12 }}>{fmtY(midVal, yUnit)}</Text>
          <Text style={{ color: C.textMuted, fontSize: 9, lineHeight: 12 }}>{fmtY(min, yUnit)}</Text>
        </View>
        {/* SVG chart */}
        <Svg width={w} height={h}>
          {/* Grid lines */}
          <Line x1={0} y1={yTop}  x2={w} y2={yTop}  stroke={C.border} strokeWidth="1" />
          <Line x1={0} y1={yMid}  x2={w} y2={yMid}  stroke={C.border} strokeWidth="1" />
          <Line x1={0} y1={yBot}  x2={w} y2={yBot}  stroke={C.border} strokeWidth="1" />
          {/* Filled area under the line */}
          {fill ? (
            <Polygon
              points={`${pts[0].x},${yBot} ${pts.map((p) => `${p.x},${p.y}`).join(' ')} ${pts[pts.length - 1].x},${yBot}`}
              fill={color}
              fillOpacity={0.15}
            />
          ) : null}
          {/* Line + dots */}
          <Polyline
            points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
            fill="none"
            stroke={color}
            strokeWidth="2"
          />
          {pts.map((p, i) => <Circle key={i} cx={p.x} cy={p.y} r="4" fill={color} />)}
        </Svg>
      </View>
      {/* X-axis labels */}
      <View style={{ flexDirection: 'row', marginLeft: Y_AXIS_W, marginTop: 6 }}>
        {xIndices.map((idx, pos) => {
          const isFirst = pos === 0;
          const isLast  = pos === xIndices.length - 1;
          const pct = idx / (data.length - 1);
          return (
            <Text
              key={idx}
              style={{
                position: 'absolute',
                left: `${pct * 100}%` as any,
                color: C.textMuted,
                fontSize: 9,
                transform: [{ translateX: isFirst ? 0 : isLast ? -28 : -14 }],
              }}
            >
              {data[idx].x}
            </Text>
          );
        })}
      </View>
      <View style={{ height: 14 }} />
    </View>
  );
}

// ─── Body fat calculator modal ────────────────────────────────────────────────

const ms = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.72)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: C.card,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    borderTopWidth: 1, borderColor: C.border,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 44,
  },
  handle: {
    width: 36, height: 4, backgroundColor: C.borderSub,
    borderRadius: 2, alignSelf: 'center', marginBottom: 20,
  },
  hdr: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'flex-start', marginBottom: 20,
  },
  title:    { color: C.text,    fontSize: 20, fontWeight: '800' },
  subtitle: { color: C.textSub, fontSize: 12, marginTop: 2 },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: C.elevated,
    alignItems: 'center', justifyContent: 'center',
  },

  genderRow:     { flexDirection: 'row', gap: 10, marginBottom: 20 },
  genderBtn:     {
    flex: 1, paddingVertical: 10, borderRadius: 14,
    backgroundColor: C.elevated,
    borderWidth: 1, borderColor: C.border, alignItems: 'center',
  },
  genderActive:     { backgroundColor: C.accentDim, borderColor: C.accentBorder },
  genderText:       { color: C.textSub, fontSize: 14, fontWeight: '700' },
  genderTextActive: { color: C.accent },

  grid:       { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 12 },
  field:      { width: '47%' },
  fieldLabel: { color: C.textSub, fontSize: 12, fontWeight: '600', marginBottom: 6 },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.elevated,
    borderWidth: 1, borderColor: C.border, borderRadius: 14, paddingHorizontal: 12,
  },
  input:    { flex: 1, color: C.text, fontSize: 15, paddingVertical: 10 },
  unit:     { color: C.textMuted, fontSize: 12, marginLeft: 4 },

  err: { color: C.red, fontSize: 12, lineHeight: 17, marginBottom: 10 },

  resultCard: {
    backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 16, padding: 16,
    flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 16,
  },
  resultLabel:    { color: C.accent,  fontSize: 12, fontWeight: '700', marginBottom: 2 },
  resultCategory: { color: C.textSub, fontSize: 13 },
  resultValue:    { color: C.text,    fontSize: 42, fontWeight: '900' },

  actions:      { flexDirection: 'row', gap: 10 },
  calcBtn:      {
    flex: 1, backgroundColor: C.elevated,
    borderWidth: 1, borderColor: C.border,
    borderRadius: 16, paddingVertical: 14, alignItems: 'center',
  },
  calcBtnText:  { color: C.text, fontSize: 15, fontWeight: '800' },
  applyBtn:     {
    flex: 1, backgroundColor: C.accent,
    borderRadius: 16, paddingVertical: 14,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
  },
  applyBtnText: { color: '#071109', fontSize: 15, fontWeight: '900' },
});

function BFCalcModal({
  visible,
  onClose,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (v: number) => void;
}) {
  const [gender, setGender] = useState<'male' | 'female'>('male');
  const [height, setHeight] = useState('');
  const [waist,  setWaist]  = useState('');
  const [neck,   setNeck]   = useState('');
  const [hip,    setHip]    = useState('');
  const [result, setResult] = useState<number | null>(null);
  const [err,    setErr]    = useState('');

  const reset = () => {
    setGender('male');
    setHeight(''); setWaist(''); setNeck(''); setHip('');
    setResult(null); setErr('');
  };

  const handleClose = () => { reset(); onClose(); };

  const calculate = () => {
    Keyboard.dismiss();
    const h = parseFloat(height), w = parseFloat(waist),
          n = parseFloat(neck),   hp = parseFloat(hip);
    if (!Number.isFinite(h) || !Number.isFinite(w) || !Number.isFinite(n)) {
      return setErr('Height, waist and neck are required.');
    }
    if (gender === 'female' && !Number.isFinite(hp)) {
      return setErr('Hip measurement is required for female calculation.');
    }
    if (w <= n) return setErr('Waist must be larger than neck.');
    const bf = navyBF(gender, h, w, n, hp);
    if (!Number.isFinite(bf) || bf <= 2 || bf >= 65) {
      return setErr('Result out of range — check your measurements.');
    }
    setErr(''); setResult(bf);
  };

  const fields = [
    { label: 'Height',            value: height, set: setHeight, hint: '175' },
    { label: 'Waist (at navel)',  value: waist,  set: setWaist,  hint: '82'  },
    { label: 'Neck',              value: neck,   set: setNeck,   hint: '38'  },
    ...(gender === 'female' ? [{ label: 'Hip (widest)', value: hip, set: setHip, hint: '98' }] : []),
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent presentationStyle="overFullScreen">
      <Pressable style={ms.backdrop} onPress={handleClose} />
      <KeyboardAwareScrollView
        style={ms.sheet}
        bottomOffset={20}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={ms.handle} />

        <View style={ms.hdr}>
          <View>
            <Text style={ms.title}>Body Fat Calculator</Text>
            <Text style={ms.subtitle}>US Navy Method · measurements in cm</Text>
          </View>
          <TouchableOpacity onPress={handleClose} style={ms.closeBtn} activeOpacity={0.8}>
            <Ionicons name="close" size={18} color={C.textSub} />
          </TouchableOpacity>
        </View>

        <View style={ms.genderRow}>
          {(['male', 'female'] as const).map((g) => (
            <TouchableOpacity
              key={g}
              style={[ms.genderBtn, gender === g && ms.genderActive]}
              onPress={() => { setGender(g); setResult(null); setErr(''); }}
              activeOpacity={0.85}
            >
              <Text style={[ms.genderText, gender === g && ms.genderTextActive]}>
                {g === 'male' ? '♂  Male' : '♀  Female'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={ms.grid}>
          {fields.map(({ label, value, set, hint }) => (
            <View key={label} style={ms.field}>
              <Text style={ms.fieldLabel}>{label}</Text>
              <View style={ms.inputRow}>
                <TextInput
                  style={ms.input}
                  value={value}
                  onChangeText={(t) => { set(t); setResult(null); setErr(''); }}
                  placeholder={hint}
                  placeholderTextColor={C.textMuted}
                  keyboardType="numbers-and-punctuation"
                  keyboardAppearance="dark"
                  returnKeyType="done"
                  onSubmitEditing={() => Keyboard.dismiss()}
                />
                <Text style={ms.unit}>cm</Text>
              </View>
            </View>
          ))}
        </View>

        {err ? <Text style={ms.err}>{err}</Text> : null}

        {result != null && (
          <View style={ms.resultCard}>
            <View style={{ flex: 1 }}>
              <Text style={ms.resultLabel}>Estimated Body Fat</Text>
              <Text style={ms.resultCategory}>{bfCategory(result, gender)}</Text>
            </View>
            <Text style={ms.resultValue}>{result}%</Text>
          </View>
        )}

        <View style={ms.actions}>
          <TouchableOpacity onPress={calculate} style={ms.calcBtn} activeOpacity={0.85}>
            <Text style={ms.calcBtnText}>Calculate</Text>
          </TouchableOpacity>
          {result != null && (
            <TouchableOpacity
              onPress={() => { onApply(result as number); handleClose(); }}
              style={ms.applyBtn}
              activeOpacity={0.85}
            >
              <Ionicons name="checkmark" size={16} color="#071109" />
              <Text style={ms.applyBtnText}>Use {result}%</Text>
            </TouchableOpacity>
          )}
        </View>
      </KeyboardAwareScrollView>
    </Modal>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const st = StyleSheet.create({
  insightCard: { borderRadius: 16, borderWidth: 1, padding: 14, gap: 6 },
  insightRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  insightIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  insightTitle: { flex: 1, fontSize: 14, fontWeight: '800' },
  insightMsg:   { color: C.text, fontSize: 13, lineHeight: 20 },
  basisBox: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 6,
    borderTopWidth: 1, paddingTop: 10, marginTop: 2,
  },
  basisText: { flex: 1, color: C.textSub, fontSize: 11, lineHeight: 16, fontStyle: 'italic' },

  benchCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 18, padding: 16, gap: 10,
  },
  benchRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  benchName:  { color: C.text,    fontSize: 16, fontWeight: '800', marginBottom: 4 },
  benchSub:   { color: C.textSub, fontSize: 12 },
  levelPill:  { borderRadius: 10, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6 },
  levelText:  { fontSize: 12, fontWeight: '800' },
  barTrack:   { height: 6, backgroundColor: C.elevated, borderRadius: 3, overflow: 'hidden' },
  barFill:    { height: 6, borderRadius: 3 },
  benchTarget: { color: C.textSub, fontSize: 12, lineHeight: 17 },
});

function InsightCard({ insight }: { insight: Insight }) {
  const [open, setOpen] = useState(false);
  const col = SEV[insight.severity];
  const iconName =
    insight.severity === 'positive' ? 'trending-up-outline' as const :
    insight.severity === 'warning'  ? 'warning-outline'     as const :
                                      'information-circle-outline' as const;
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={() => setOpen((v) => !v)}
      style={[st.insightCard, { backgroundColor: col.bg, borderColor: col.border }]}
    >
      <View style={st.insightRow}>
        <View style={[st.insightIcon, { backgroundColor: col.text + '22' }]}>
          <Ionicons name={iconName} size={14} color={col.text} />
        </View>
        <Text style={[st.insightTitle, { color: col.text }]} numberOfLines={1}>
          {insight.title}
        </Text>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={13} color={col.text} />
      </View>
      <Text style={st.insightMsg}>{insight.message}</Text>
      {open && (
        <View style={[st.basisBox, { borderTopColor: col.text + '25' }]}>
          <Ionicons name="library-outline" size={11} color={C.textMuted} />
          <Text style={st.basisText}>{insight.basis}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

function BenchmarkCard({ b, bodyweight }: { b: StrengthBenchmark; bodyweight: number }) {
  const lc = LEVEL_COLOR[b.level];
  const pct = Math.min(Math.round((b.ratio / b.nextTargetRatio) * 100), 100);
  return (
    <View style={st.benchCard}>
      <View style={st.benchRow}>
        <View style={{ flex: 1 }}>
          <Text style={st.benchName}>{b.exerciseName}</Text>
          <Text style={st.benchSub}>
            Est. 1RM{' '}
            <Text style={{ color: C.text, fontWeight: '700' }}>{b.estimated1RM}kg</Text>
            {'  ·  '}
            <Text style={{ color: lc, fontWeight: '700' }}>{b.ratio}×</Text>
            {' BW'}
          </Text>
        </View>
        <View style={[st.levelPill, { backgroundColor: lc + '20', borderColor: lc + '44' }]}>
          <Text style={[st.levelText, { color: lc }]}>
            {b.level[0].toUpperCase() + b.level.slice(1)}
          </Text>
        </View>
      </View>
      <View style={st.barTrack}>
        <View style={[st.barFill, { width: `${pct}%`, backgroundColor: lc }]} />
      </View>
      <Text style={st.benchTarget}>
        {b.level !== 'elite'
          ? `→ ${b.nextLevelLabel} at ${b.nextTargetRatio}× BW — target ${b.nextTargetKg}kg (${bodyweight}kg BW)`
          : '🏆 Elite level reached'}
      </Text>
    </View>
  );
}

// ─── Nutrition adherence card ─────────────────────────────────────────────────

const na = StyleSheet.create({
  card: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 18, gap: 14,
  },
  hdr:     { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hdrIcon: { width: 28, height: 28, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  title:   { color: C.text,    fontSize: 15, fontWeight: '800' },
  sub:     { color: C.textSub, fontSize: 12, marginTop: 1 },
  barRow:  { gap: 5 },
  barTop:  { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  barLabel: { color: C.textSub, fontSize: 13, fontWeight: '600' },
  barPct:   { fontSize: 14, fontWeight: '800' },
  track:   { height: 8, backgroundColor: C.elevated, borderRadius: 4, overflow: 'hidden' },
  fill:    { height: '100%' as any, borderRadius: 4 },
  barSub:  { color: C.textMuted, fontSize: 11 },
});

function NutritionAdherenceCard() {
  const { meals, targets } = useNutrition();

  const adherence = useMemo(() => {
    let proteinHit = 0, calsInRange = 0, daysWithData = 0;
    for (let i = 0; i < 14; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = toDateKey(d.toISOString());
      const dayMeals = meals.filter((m) => toDateKey(m.loggedAt) === key);
      if (!dayMeals.length) continue;
      daysWithData++;
      const totalPro = dayMeals.reduce((s, m) => s + m.protein, 0);
      const totalCal = dayMeals.reduce((s, m) => s + m.calories, 0);
      if (totalPro >= targets.protein) proteinHit++;
      if (totalCal >= targets.calories * 0.8 && totalCal <= targets.calories * 1.05) calsInRange++;
    }
    return { proteinHit, calsInRange, daysWithData };
  }, [meals, targets]);

  if (adherence.daysWithData < 3) return null;

  const { proteinHit, calsInRange, daysWithData } = adherence;
  const proteinPct = Math.round((proteinHit / daysWithData) * 100);
  const calsPct    = Math.round((calsInRange / daysWithData) * 100);

  const bars = [
    { label: 'Protein target hit',    pct: proteinPct, hit: proteinHit, color: C.blue   },
    { label: 'Calories in range',     pct: calsPct,    hit: calsInRange, color: C.accent },
  ];

  return (
    <View style={na.card}>
      <View style={na.hdr}>
        <View style={[na.hdrIcon, { backgroundColor: C.blueDim }]}>
          <Ionicons name="nutrition-outline" size={14} color={C.blue} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={na.title}>Nutrition adherence</Text>
          <Text style={na.sub}>{daysWithData} logged days · past 2 weeks</Text>
        </View>
      </View>
      {bars.map(({ label, pct, hit, color }) => (
        <View key={label} style={na.barRow}>
          <View style={na.barTop}>
            <Text style={na.barLabel}>{label}</Text>
            <Text style={[na.barPct, { color }]}>{pct}%</Text>
          </View>
          <View style={na.track}>
            <View style={[na.fill, { width: `${pct}%` as any, backgroundColor: color }]} />
          </View>
          <Text style={na.barSub}>{hit}/{daysWithData} days</Text>
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

function weekStart(d: Date): Date {
  const dt = new Date(d), day = dt.getDay();
  dt.setDate(dt.getDate() - (day === 0 ? 6 : day - 1));
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function fmtVol(v: number): string {
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1000)      return `${(v / 1000).toFixed(0)}k`;
  return String(Math.round(v));
}

export default function ProgressScreen() {
  const { completedWorkouts } = useWorkout();
  const { entries, addEntry, latestEntry } = useBodyMetrics();

  const [weightInput,    setWeightInput]    = useState('');
  const [bodyFatInput,   setBodyFatInput]   = useState('');
  const [activeExId,     setActiveExId]     = useState<string | null>(null);
  const [savedFlash,     setSavedFlash]     = useState(false);
  const [showBFCalc,     setShowBFCalc]     = useState(false);

  const insights      = analyzeProgress(completedWorkouts, latestEntry);
  const topExercises  = getTopExercisesByVolume(completedWorkouts);
  const resolvedExId  = activeExId ?? topExercises[0]?.id ?? null;
  const bodyweight    = latestEntry?.weight ?? null;
  const benchmarks    = bodyweight ? getStrengthBenchmarks(completedWorkouts, bodyweight) : [];

  const volumeData   = weeklyVolumeChartData(completedWorkouts);
  const bwData       = bodyweightChartData(entries);
  const bfData       = bodyFatChartData(entries);
  const strengthData = resolvedExId ? exerciseStrengthChartData(completedWorkouts, resolvedExId) : [];

  const thisWeekCount = completedWorkouts.filter(
    (w) => new Date(w.finishedAt) >= weekStart(new Date()),
  ).length;

  const totalVolume = completedWorkouts.reduce((sum, w) => {
    for (const ex of w.exercises) {
      const done = ex.sets.filter((s) => s.done);
      const src  = done.length ? done : ex.sets;
      for (const s of src) {
        const wt = Number(s.weight), r = Number(s.reps);
        if (Number.isFinite(wt) && Number.isFinite(r)) sum += wt * r;
      }
    }
    return sum;
  }, 0);

  const streak = useMemo(() => {
    if (!completedWorkouts.length) return 0;
    const days = new Set(completedWorkouts.map((w) => new Date(w.finishedAt).toDateString()));
    let count = 0;
    const today = new Date();
    for (let i = 0; i < 365; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (days.has(d.toDateString())) count++;
      else if (i > 0) break;
    }
    return count;
  }, [completedWorkouts]);

  const handleSave = () => {
    const w  = parseFloat(weightInput);
    const bf = parseFloat(bodyFatInput);
    if (!Number.isFinite(w) && !Number.isFinite(bf)) return;
    Keyboard.dismiss();
    addEntry(Number.isFinite(w) ? w : null, Number.isFinite(bf) ? bf : null);
    setWeightInput(''); setBodyFatInput('');
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1500);
  };

  const statCards = [
    { icon: 'barbell-outline'  as const, color: C.accent, bg: C.accentDim, value: String(completedWorkouts.length), label: 'Workouts'       },
    { icon: 'today-outline'    as const, color: C.blue,   bg: C.blueDim,   value: String(thisWeekCount),            label: 'This week'      },
    { icon: 'analytics-outline'as const, color: C.amber,  bg: C.amberDim,  value: fmtVol(totalVolume),              label: 'Total vol (kg)' },
    { icon: 'scale-outline'    as const, color: C.purple, bg: C.purpleDim, value: bodyweight != null ? `${bodyweight}` : '—', label: 'Bodyweight' },
  ];

  return (
    <SafeAreaView style={s.safeArea}>
      <KeyboardAwareScrollView
        style={s.scroll}
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="on-drag"
        bottomOffset={20}
      >
        {/* ── Header ── */}
        <View style={s.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={s.eyebrow}>Progress overview</Text>
            <Text style={s.title}>Your training snapshot</Text>
          </View>
          {streak > 1 && (
            <View style={s.streakBadge}>
              <Text style={s.streakEmoji}>🔥</Text>
              <Text style={s.streakNum}>{streak}</Text>
              <Text style={s.streakLbl}>day{streak !== 1 ? 's' : ''}</Text>
            </View>
          )}
        </View>

        {/* ── Stats grid ── */}
        <View style={s.grid}>
          {statCards.map(({ icon, color, bg, value, label }) => (
            <View key={label} style={s.gridItem}>
              <View style={s.statCard}>
                <View style={[s.iconBox, { backgroundColor: bg }]}>
                  <Ionicons name={icon} size={18} color={color} />
                </View>
                <Text style={[s.statValue, { color }]}>{value}</Text>
                <Text style={s.statLabel}>{label}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Log today ── */}
        <View style={s.logCard}>
          <View style={s.logHdr}>
            <View style={[s.logHdrIcon, { backgroundColor: C.accentDim }]}>
              <Ionicons name="pencil" size={14} color={C.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={s.logTitle}>Log today</Text>
              {latestEntry ? (
                <Text style={s.logLast}>
                  Last:{' '}
                  {[
                    latestEntry.weight   != null && `${latestEntry.weight}kg`,
                    latestEntry.bodyFat  != null && `${latestEntry.bodyFat}% BF`,
                  ].filter(Boolean).join(' · ')}{' · '}
                  {new Date(latestEntry.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              ) : null}
            </View>
          </View>

          <View style={s.logFields}>
            <View style={s.logField}>
              <Text style={s.logFieldLbl}>Bodyweight (kg)</Text>
              <TextInput
                style={s.logInput}
                value={weightInput}
                onChangeText={setWeightInput}
                placeholder={latestEntry?.weight != null ? String(latestEntry.weight) : '70.0'}
                placeholderTextColor={C.textMuted}
                keyboardType="decimal-pad"
                keyboardAppearance="dark"
                inputAccessoryViewID={KBD_ID}
              />
            </View>
            <View style={s.logField}>
              <View style={s.bfLabelRow}>
                <Text style={s.logFieldLbl}>Body fat (%)</Text>
                <TouchableOpacity onPress={() => setShowBFCalc(true)} activeOpacity={0.8}>
                  <Text style={s.calcLink}>Calculate →</Text>
                </TouchableOpacity>
              </View>
              <TextInput
                style={s.logInput}
                value={bodyFatInput}
                onChangeText={setBodyFatInput}
                placeholder={latestEntry?.bodyFat != null ? String(latestEntry.bodyFat) : '18.0'}
                placeholderTextColor={C.textMuted}
                keyboardType="decimal-pad"
                keyboardAppearance="dark"
                inputAccessoryViewID={KBD_ID}
              />
            </View>
          </View>

          <TouchableOpacity
            style={[s.saveBtn, savedFlash && s.saveBtnFlash]}
            activeOpacity={0.85}
            onPress={handleSave}
          >
            {savedFlash ? (
              <>
                <Ionicons name="checkmark" size={16} color="#071109" />
                <Text style={s.saveBtnText}>Saved</Text>
              </>
            ) : (
              <Text style={s.saveBtnText}>Save entry</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* ── Insights ── */}
        {insights.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>Training insights</Text>
            <Text style={s.sectionSub}>Tap any card to see the research behind it.</Text>
            {insights.map((i) => <InsightCard key={i.id} insight={i} />)}
          </>
        ) : completedWorkouts.length > 0 ? (
          <View style={s.infoCard}>
            <Text style={s.infoText}>Keep logging sessions — insights appear after a few workouts.</Text>
          </View>
        ) : null}

        {/* ── Nutrition adherence ── */}
        <NutritionAdherenceCard />

        {/* ── Strength benchmarks ── */}
        {bodyweight != null && benchmarks.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>Strength benchmarks</Text>
            <Text style={s.sectionSub}>
              Est. 1RM relative to {bodyweight}kg bodyweight. Based on general S&C research.
            </Text>
            {benchmarks.map((b) => (
              <BenchmarkCard key={b.exerciseId} b={b} bodyweight={bodyweight} />
            ))}
          </>
        ) : bodyweight == null && completedWorkouts.length > 0 ? (
          <View style={s.nudgeCard}>
            <Ionicons name="scale-outline" size={16} color={C.accent} />
            <Text style={s.nudgeText}>Log your bodyweight above to unlock strength benchmarks.</Text>
          </View>
        ) : null}

        {/* ── Charts ── */}
        {completedWorkouts.length > 0 ? (
          <>
            <Text style={s.sectionTitle}>Charts</Text>

            <View style={s.chartCard}>
              <Text style={s.chartTitle}>Weekly volume (kg × reps)</Text>
              {volumeData.length >= 2
                ? <LineChart data={volumeData} color={C.accent} yUnit="" fill />
                : <Text style={s.chartEmpty}>Train across multiple weeks to see volume trends.</Text>}
            </View>

            {topExercises.length > 0 && (
              <View style={s.chartCard}>
                <Text style={s.chartTitle}>Estimated 1RM progression</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={{ marginBottom: 8 }}
                  contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}
                >
                  {topExercises.map((ex) => (
                    <TouchableOpacity
                      key={ex.id}
                      onPress={() => setActiveExId(ex.id)}
                      style={[s.pill, resolvedExId === ex.id && s.pillActive]}
                    >
                      <Text style={[s.pillText, resolvedExId === ex.id && s.pillTextActive]}>
                        {ex.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
                {strengthData.length >= 2
                  ? <LineChart data={strengthData} color={C.amber} yUnit="kg" />
                  : <Text style={s.chartEmpty}>Complete 2+ sessions with this exercise to see progression.</Text>}
              </View>
            )}

            {bwData.length >= 2 && (
              <View style={s.chartCard}>
                <Text style={s.chartTitle}>Bodyweight over time (kg)</Text>
                <LineChart data={bwData} color={C.purple} yUnit="kg" />
              </View>
            )}

            {bfData.length >= 2 && (
              <View style={s.chartCard}>
                <Text style={s.chartTitle}>Body fat % over time</Text>
                <LineChart data={bfData} color={C.blue} yUnit="%" />
              </View>
            )}
          </>
        ) : (
          <View style={s.emptyCard}>
            <View style={[s.emptyIconBox, { backgroundColor: C.accentDim }]}>
              <Ionicons name="barbell-outline" size={28} color={C.accent} />
            </View>
            <Text style={s.emptyTitle}>No workout data yet</Text>
            <Text style={s.emptyText}>
              Complete your first session to start seeing insights and charts here.
            </Text>
          </View>
        )}
      </KeyboardAwareScrollView>

      {/* iOS keyboard accessory — replaces the default gray Done toolbar */}
      {Platform.OS === 'ios' && (
        <InputAccessoryView nativeID={KBD_ID}>
          <View style={s.kbdBar}>
            <TouchableOpacity onPress={Keyboard.dismiss} style={s.kbdDoneBtn} activeOpacity={0.8}>
              <Text style={s.kbdDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      )}

      <BFCalcModal
        visible={showBFCalc}
        onClose={() => setShowBFCalc(false)}
        onApply={(bf) => setBodyFatInput(String(bf))}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: C.bg },
  scroll:   { flex: 1, backgroundColor: C.bg },
  content:  { padding: 20, paddingBottom: 48, gap: 12 },

  // Header
  headerRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 },
  eyebrow:     { color: C.textSub, fontSize: 13, marginBottom: 4 },
  title:       { color: C.text, fontSize: 26, fontWeight: '800', lineHeight: 32 },
  streakBadge: {
    backgroundColor: C.amberDim, borderWidth: 1, borderColor: C.amberBorder,
    borderRadius: 18, paddingHorizontal: 14, paddingVertical: 10, alignItems: 'center',
  },
  streakEmoji: { fontSize: 18, marginBottom: 1 },
  streakNum:   { color: C.amber, fontSize: 22, fontWeight: '900', lineHeight: 25 },
  streakLbl:   { color: C.amber, fontSize: 11, fontWeight: '600' },

  // Stats
  grid:      { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridItem:  { width: '50%', paddingHorizontal: 6, marginBottom: 12 },
  statCard:  {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, padding: 16,
  },
  iconBox:   { alignSelf: 'flex-start', borderRadius: 12, padding: 8, marginBottom: 12 },
  statValue: { fontSize: 28, fontWeight: '900', marginBottom: 4 },
  statLabel: { color: C.textSub, fontSize: 12, lineHeight: 17 },

  // Log card
  logCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 22, padding: 18,
  },
  logHdr:     { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 16 },
  logHdrIcon: { borderRadius: 12, padding: 8, marginTop: 2 },
  logTitle:   { color: C.text,    fontSize: 16, fontWeight: '800', marginBottom: 2 },
  logLast:    { color: C.textSub, fontSize: 12, lineHeight: 17 },
  logFields:  { flexDirection: 'row', gap: 12, marginBottom: 14 },
  logField:   { flex: 1 },
  logFieldLbl: { color: C.textSub, fontSize: 11, fontWeight: '600', marginBottom: 6 },
  bfLabelRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 6,
  },
  logInput: {
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 14, color: C.text, paddingHorizontal: 13, paddingVertical: 11, fontSize: 15,
  },
  calcLink:    { color: C.accent, fontSize: 11, fontWeight: '700' },
  saveBtn: {
    backgroundColor: C.accent, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    flexDirection: 'row', gap: 6,
  },
  saveBtnFlash: { backgroundColor: '#16A34A' },
  saveBtnText:  { color: '#071109', fontSize: 14, fontWeight: '900' },

  // Keyboard accessory
  kbdBar: {
    backgroundColor: C.surface, borderTopWidth: 1, borderColor: C.border,
    paddingHorizontal: 16, paddingVertical: 8,
    flexDirection: 'row', justifyContent: 'flex-end',
  },
  kbdDoneBtn: {
    backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 10, paddingHorizontal: 16, paddingVertical: 7,
  },
  kbdDoneText: { color: C.accent, fontSize: 14, fontWeight: '800' },

  // Section headers
  sectionTitle: { color: C.text, fontSize: 18, fontWeight: '800', marginTop: 8, marginBottom: 2 },
  sectionSub:   { color: C.textSub, fontSize: 13, lineHeight: 18, marginBottom: 8 },

  // Info / nudge
  infoCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 16, padding: 16,
  },
  infoText: { color: C.textSub, fontSize: 13, lineHeight: 19 },
  nudgeCard: {
    backgroundColor: C.accentDim, borderWidth: 1, borderColor: C.accentBorder,
    borderRadius: 16, padding: 14,
    flexDirection: 'row', alignItems: 'center', gap: 10,
  },
  nudgeText: { flex: 1, color: C.accent, fontSize: 13, lineHeight: 19, fontWeight: '600' },

  // Chart cards
  chartCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 20, paddingTop: 18, overflow: 'hidden',
  },
  chartTitle: {
    color: C.text, fontSize: 14, fontWeight: '800', marginBottom: 12, paddingHorizontal: 18,
  },
  chartEmpty: {
    color: C.textSub, fontSize: 12, lineHeight: 18,
    textAlign: 'center', paddingHorizontal: 24, paddingBottom: 20,
  },

  // Exercise picker pills
  pill:         {
    backgroundColor: C.elevated, borderWidth: 1, borderColor: C.border,
    borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8,
  },
  pillActive:   { backgroundColor: C.amberDim, borderColor: C.amberBorder },
  pillText:     { color: C.textSub, fontSize: 12, fontWeight: '700' },
  pillTextActive: { color: C.amber },

  // Empty state
  emptyCard: {
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 22, padding: 28, alignItems: 'center', gap: 12,
  },
  emptyIconBox: { borderRadius: 20, padding: 16 },
  emptyTitle:   { color: C.text,    fontSize: 18, fontWeight: '800' },
  emptyText:    { color: C.textSub, fontSize: 14, lineHeight: 21, textAlign: 'center' },
});
