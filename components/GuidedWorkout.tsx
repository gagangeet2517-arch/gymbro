import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  Vibration,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useWorkout } from '../context/WorkoutContext';

const C = {
  bg: '#0A0B0F',
  surface: '#12141A',
  elevated: '#171A22',
  border: '#232734',
  text: '#F5F7FB',
  textSub: '#9AA3B2',
  textMuted: '#5A6478',
  accent: '#22C55E',
  accentSoft: 'rgba(34, 197, 94, 0.12)',
  amber: '#F59E0B',
};

const REST_SECONDS = 90;

// Real loading increments so Adjust never lands on an impossible weight.
const WEIGHT_STEP: Record<string, number> = {
  Barbell: 2.5,
  'EZ-Bar': 2.5,
  'Smith Machine': 2.5,
  Dumbbell: 2.5,
  Cable: 2.5,
  Machine: 5,
  Kettlebell: 4,
};

type QueueItem = { exerciseId: string; setId: string };

export default function GuidedWorkout({
  visible,
  onClose,
  onFinishRequested,
}: {
  visible: boolean;
  onClose: () => void;
  /** Called when every queued set is done and the user taps Finish. */
  onFinishRequested: () => void;
}) {
  const { activeWorkout, toggleSetDone, updateSetField } = useWorkout();

  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [pos, setPos] = useState(0);
  const [resting, setResting] = useState(false);
  const [restLeft, setRestLeft] = useState(REST_SECONDS);
  const [adjusting, setAdjusting] = useState(false);

  // Snapshot the not-yet-done sets, in order, each time the guide opens.
  useEffect(() => {
    if (!visible || !activeWorkout) return;
    const q: QueueItem[] = [];
    for (const ex of activeWorkout.exercises) {
      for (const s of ex.sets) {
        if (!s.done) q.push({ exerciseId: ex.id, setId: s.id });
      }
    }
    setQueue(q);
    setPos(0);
    setResting(false);
    setAdjusting(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Rest countdown → buzz → next card.
  useEffect(() => {
    if (!resting) return;
    if (restLeft <= 0) {
      Vibration.vibrate(600);
      setResting(false);
      setPos((p) => p + 1);
      return;
    }
    const t = setTimeout(() => setRestLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [resting, restLeft]);

  if (!activeWorkout) return null;

  // Resolve the current queue item against live workout state; skip anything
  // that was removed or completed outside the guide.
  let current: {
    exerciseId: string;
    exerciseName: string;
    equipment: string;
    setId: string;
    setNumber: number;
    setCount: number;
    weight: string;
    reps: string;
    lastSummary: string | null;
  } | null = null;

  let cursor = pos;
  while (cursor < queue.length && !current) {
    const item = queue[cursor];
    const ex = activeWorkout.exercises.find((e) => e.id === item.exerciseId);
    const set = ex?.sets.find((s) => s.id === item.setId);
    if (ex && set && !set.done) {
      const summary =
        ex.prefilledFromLastWorkout && ex.lastWorkoutSummary
          ? `last time: best ${ex.lastWorkoutSummary.maxWeight ?? '—'}kg × ${ex.lastWorkoutSummary.bestReps ?? '—'}`
          : null;
      current = {
        exerciseId: ex.id,
        exerciseName: ex.name,
        equipment: ex.equipment,
        setId: set.id,
        setNumber: ex.sets.findIndex((s) => s.id === set.id) + 1,
        setCount: ex.sets.length,
        weight: set.weight,
        reps: set.reps,
        lastSummary: summary,
      };
    } else {
      cursor += 1;
    }
  }
  if (cursor !== pos && !resting) {
    // Fast-forward past stale items without an extra render loop.
    setTimeout(() => setPos(cursor), 0);
  }

  const total = queue.length;
  const finished = !current && !resting;

  const markDone = () => {
    if (!current) return;
    toggleSetDone(current.exerciseId, current.setId);
    setAdjusting(false);
    const isLast = cursor >= queue.length - 1;
    if (isLast) {
      setPos(cursor + 1);
    } else {
      setRestLeft(REST_SECONDS);
      setResting(true);
    }
  };

  const skipSet = () => {
    setAdjusting(false);
    setResting(false);
    setPos(cursor + 1);
  };

  const skipRest = () => {
    setResting(false);
    setPos((p) => p + 1);
  };

  const bump = (field: 'weight' | 'reps', dir: 1 | -1) => {
    if (!current) return;
    const step = field === 'weight' ? (WEIGHT_STEP[current.equipment] ?? 2.5) : 1;
    const now = Number(field === 'weight' ? current.weight : current.reps) || 0;
    const next = Math.max(0, now + dir * step);
    updateSetField(
      current.exerciseId,
      current.setId,
      field,
      String(Number.isInteger(next) ? next : parseFloat(next.toFixed(2)))
    );
  };

  const mmss = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={10} activeOpacity={0.7}>
            <Ionicons name="chevron-down" size={24} color={C.textSub} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{activeWorkout.templateName}</Text>
          <Text style={styles.headerProgress}>
            {Math.min(cursor + 1, total)}/{total}
          </Text>
        </View>

        {/* Progress bar */}
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${total > 0 ? Math.min((cursor / total) * 100, 100) : 0}%` },
            ]}
          />
        </View>

        {resting ? (
          /* ── Rest screen ── */
          <View style={styles.center}>
            <Text style={styles.restLabel}>Rest</Text>
            <Text style={styles.restClock}>{mmss(restLeft)}</Text>
            <Text style={styles.restHint}>Buzzes when it&apos;s time to lift</Text>
            <View style={styles.restActions}>
              <TouchableOpacity style={styles.restBtn} activeOpacity={0.8} onPress={() => setRestLeft((l) => l + 30)}>
                <Text style={styles.restBtnText}>+30s</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.restBtnPrimary} activeOpacity={0.85} onPress={skipRest}>
                <Text style={styles.restBtnPrimaryText}>I&apos;m ready</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : finished ? (
          /* ── All sets done ── */
          <View style={styles.center}>
            <Text style={styles.doneEmoji}>🎉</Text>
            <Text style={styles.doneTitle}>All sets done</Text>
            <Text style={styles.doneSub}>Cool-down stretches are on the workout screen.</Text>
            <TouchableOpacity style={styles.finishBtn} activeOpacity={0.85} onPress={onFinishRequested}>
              <Text style={styles.finishBtnText}>Finish workout</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} activeOpacity={0.7} style={{ marginTop: 14 }}>
              <Text style={styles.backLink}>Back to the list</Text>
            </TouchableOpacity>
          </View>
        ) : current ? (
          /* ── Set card ── */
          <View style={styles.center}>
            <Text style={styles.setLabel}>
              Set {current.setNumber} of {current.setCount}
            </Text>
            <Text style={styles.exerciseName}>{current.exerciseName}</Text>

            <View style={styles.targetRow}>
              <Text style={styles.targetValue}>
                {current.weight ? `${current.weight} kg` : '— kg'}
              </Text>
              <Text style={styles.targetTimes}>×</Text>
              <Text style={styles.targetValue}>
                {current.reps ? `${current.reps}` : '—'}
              </Text>
            </View>
            {current.lastSummary ? (
              <Text style={styles.lastTime}>{current.lastSummary}</Text>
            ) : null}

            {adjusting ? (
              <View style={styles.adjustWrap}>
                {(['weight', 'reps'] as const).map((field) => (
                  <View key={field} style={styles.adjustRow}>
                    <Text style={styles.adjustLabel}>{field === 'weight' ? 'Weight' : 'Reps'}</Text>
                    <TouchableOpacity style={styles.adjustBtn} activeOpacity={0.8} onPress={() => bump(field, -1)}>
                      <Ionicons name="remove" size={18} color={C.text} />
                    </TouchableOpacity>
                    <Text style={styles.adjustValue}>
                      {field === 'weight' ? current!.weight || '0' : current!.reps || '0'}
                    </Text>
                    <TouchableOpacity style={styles.adjustBtn} activeOpacity={0.8} onPress={() => bump(field, 1)}>
                      <Ionicons name="add" size={18} color={C.text} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            ) : null}

            <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={markDone}>
              <Ionicons name="checkmark" size={26} color="#07110A" />
              <Text style={styles.doneBtnText}>Done — start rest</Text>
            </TouchableOpacity>

            <View style={styles.secondaryRow}>
              <TouchableOpacity onPress={() => setAdjusting((v) => !v)} activeOpacity={0.7} hitSlop={8}>
                <Text style={styles.secondaryText}>{adjusting ? 'Hide adjust' : 'Adjust'}</Text>
              </TouchableOpacity>
              <Text style={styles.secondaryDot}>·</Text>
              <TouchableOpacity onPress={skipSet} activeOpacity={0.7} hitSlop={8}>
                <Text style={styles.secondaryText}>Skip set</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  headerTitle: { color: C.text, fontSize: 15, fontWeight: '800', flex: 1, textAlign: 'center' },
  headerProgress: { color: C.textSub, fontSize: 13, fontWeight: '700', minWidth: 40, textAlign: 'right' },
  progressTrack: {
    height: 4,
    backgroundColor: C.border,
    borderRadius: 2,
    marginHorizontal: 20,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressFill: { height: 4, backgroundColor: C.accent, borderRadius: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },

  setLabel: { color: C.textSub, fontSize: 13, fontWeight: '700', marginBottom: 6 },
  exerciseName: { color: C.text, fontSize: 26, fontWeight: '900', textAlign: 'center', marginBottom: 18 },
  targetRow: { flexDirection: 'row', alignItems: 'baseline', gap: 10 },
  targetValue: { color: C.text, fontSize: 44, fontWeight: '900', fontVariant: ['tabular-nums'] },
  targetTimes: { color: C.textMuted, fontSize: 28, fontWeight: '800' },
  lastTime: { color: C.textSub, fontSize: 13, marginTop: 8 },

  adjustWrap: {
    marginTop: 18,
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    alignSelf: 'stretch',
  },
  adjustRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  adjustLabel: { color: C.textSub, fontSize: 13, fontWeight: '700', width: 60 },
  adjustBtn: {
    width: 40,
    height: 36,
    borderRadius: 10,
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adjustValue: {
    color: C.text,
    fontSize: 18,
    fontWeight: '800',
    flex: 1,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },

  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: C.accent,
    borderRadius: 20,
    paddingVertical: 20,
    alignSelf: 'stretch',
    marginTop: 28,
  },
  doneBtnText: { color: '#07110A', fontSize: 17, fontWeight: '900' },
  secondaryRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 16 },
  secondaryText: { color: C.textSub, fontSize: 14, fontWeight: '700' },
  secondaryDot: { color: C.textMuted, fontSize: 14 },

  restLabel: { color: C.amber, fontSize: 15, fontWeight: '800', marginBottom: 4 },
  restClock: { color: C.text, fontSize: 72, fontWeight: '900', fontVariant: ['tabular-nums'] },
  restHint: { color: C.textMuted, fontSize: 13, marginTop: 4 },
  restActions: { flexDirection: 'row', gap: 12, marginTop: 26 },
  restBtn: {
    backgroundColor: C.elevated,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  restBtnText: { color: C.text, fontSize: 14, fontWeight: '800' },
  restBtnPrimary: {
    backgroundColor: C.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.35)',
    borderRadius: 14,
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  restBtnPrimaryText: { color: C.accent, fontSize: 14, fontWeight: '800' },

  doneEmoji: { fontSize: 44, marginBottom: 8 },
  doneTitle: { color: C.text, fontSize: 24, fontWeight: '900' },
  doneSub: { color: C.textSub, fontSize: 14, marginTop: 6, textAlign: 'center' },
  finishBtn: {
    backgroundColor: C.accent,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginTop: 24,
  },
  finishBtnText: { color: '#07110A', fontSize: 16, fontWeight: '900' },
  backLink: { color: C.textSub, fontSize: 14, fontWeight: '700' },
});
