import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  InputAccessoryView,
  Keyboard,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import GuidedWorkout from '../../components/GuidedWorkout';
import FeatureHint from '../../components/ui/FeatureHint';
import PressableScale from '../../components/ui/PressableScale';
import VoiceSetButton from '../../components/VoiceSetButton';
import { markFeatureSeen } from '../../utils/featureHints';
import { ParsedSet } from '../../utils/voiceSetParser';
import { useBodyMetrics } from '../../context/BodyMetricsContext';
import { Exercise, useExercises } from '../../context/ExerciseContext';
import { useWorkout } from '../../context/WorkoutContext';
import { builtInExercises, MUSCLE_GROUPS } from '../../data/exerciseCatalog';
import {
  generateCooldownPlan,
  generateWarmupPlan,
  MobilityMove,
  planMinutes,
} from '../../data/mobilityCatalog';
import {
  durationMinFrom,
  estimateCaloriesBurned,
  setsCompletedFromExercises,
  totalVolumeFromExercises,
} from '../../utils/calorieBurn';

const KBD_ID = 'workout-kbd';

const COLORS = {
  bg: '#0A0B0F',
  surface: '#12141A',
  surfaceElevated: '#171A22',
  border: '#232734',
  textPrimary: '#F5F7FB',
  textSecondary: '#9AA3B2',
  textMuted: '#5A6478',
  accent: '#22C55E',
  accentSoft: 'rgba(34, 197, 94, 0.12)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

type OverlayType = 'leave' | 'finish' | null;

type FinishSummary = {
  caloriesBurned: number | null;
  totalVolume: number;
  durationMin: number;
  setsCompleted: number;
};

function formatLastWorkoutSummary(
  summary?: {
    setsLogged: number;
    maxWeight: number | null;
    bestReps: number | null;
  } | null
) {
  if (!summary) return '';

  const parts: string[] = [`${summary.setsLogged} sets`];

  if (summary.maxWeight !== null) {
    parts.push(`${summary.maxWeight} kg max`);
  }

  if (summary.bestReps !== null) {
    parts.push(`${summary.bestReps} reps best`);
  }

  return `Last workout: ${parts.join(' • ')}`;
}

function formatPrefillDate(dateString?: string | null) {
  if (!dateString) return '';
  const date = new Date(dateString);

  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
  });
}

const GROUP_TABS = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body', 'Custom'];

function ExercisePickerModal({
  visible,
  onClose,
  onPick,
  existingIds,
}: {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  existingIds: Set<string>;
}) {
  const { customExercises } = useExercises();
  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');

  const results = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matches = (e: Exercise) =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.muscle.toLowerCase().includes(q) ||
      e.equipment.toLowerCase().includes(q);

    let pool: Exercise[];
    if (activeGroup === 'Custom') {
      pool = customExercises.filter(matches);
    } else {
      const subgroups = activeGroup === 'All' ? null : MUSCLE_GROUPS[activeGroup];
      pool = builtInExercises.filter((e) => {
        if (subgroups && !subgroups.includes(e.muscle)) return false;
        return matches(e);
      });
      if (activeGroup === 'All') {
        pool = [...pool, ...customExercises.filter(matches)];
      }
    }
    return pool;
  }, [query, activeGroup, customExercises]);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.pickerSafe}>
        <View style={styles.pickerHeader}>
          <Text style={styles.pickerTitle}>Add Exercise</Text>
          <TouchableOpacity style={styles.pickerCloseBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.pickerCloseBtnText}>Close</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.pickerSearchWrap}>
          <Ionicons name="search" size={15} color={COLORS.textMuted} style={{ marginLeft: 12 }} />
          <TextInput
            style={styles.pickerSearchInput}
            placeholder="Search exercises..."
            placeholderTextColor={COLORS.textMuted}
            value={query}
            onChangeText={setQuery}
            clearButtonMode="while-editing"
            autoCorrect={false}
            autoCapitalize="none"
          />
        </View>

        <View style={styles.pickerTabsWrap}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerTabsContent}>
            {GROUP_TABS.map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.pickerTab, activeGroup === tab && styles.pickerTabActive]}
                onPress={() => setActiveGroup(tab)}
                activeOpacity={0.8}
              >
                <Text style={[styles.pickerTabText, activeGroup === tab && styles.pickerTabTextActive]}>
                  {tab}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        <FlatList
          data={results}
          keyExtractor={(item) => item.id}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <View style={styles.pickerEmpty}>
              <Text style={styles.pickerEmptyText}>No exercises found</Text>
            </View>
          }
          renderItem={({ item }) => {
            const alreadyIn = existingIds.has(item.id);
            return (
              <View style={styles.pickerRow}>
                <View style={styles.pickerRowInfo}>
                  <Text style={styles.pickerRowName}>{item.name}</Text>
                  <Text style={styles.pickerRowMeta}>
                    {item.muscle} • {item.equipment}
                  </Text>
                </View>
                <TouchableOpacity
                  style={alreadyIn ? styles.pickerAddedBtn : styles.pickerAddBtn}
                  onPress={() => {
                    if (alreadyIn) return;
                    onPick(item);
                  }}
                  activeOpacity={alreadyIn ? 1 : 0.8}
                >
                  <Text style={alreadyIn ? styles.pickerAddedBtnText : styles.pickerAddBtnText}>
                    {alreadyIn ? 'Added' : 'Add'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      </SafeAreaView>
    </Modal>
  );
}

// Collapsible warm-up / cool-down checklist card. Rows are checkable so the
// lifter can tick moves off as they go; state is session-local on purpose.
function MobilityCard({
  emoji,
  title,
  plan,
}: {
  emoji: string;
  title: string;
  plan: MobilityMove[];
}) {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState<Set<string>>(new Set());

  if (plan.length === 0) return null;

  const toggle = (id: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const doneCount = plan.filter((m) => done.has(m.id)).length;

  return (
    <View style={styles.mobilityCard}>
      <TouchableOpacity
        style={styles.mobilityHeader}
        activeOpacity={0.8}
        onPress={() => {
          setOpen((v) => !v);
          markFeatureSeen('mobility-plan');
        }}
      >
        <Text style={styles.mobilityEmoji}>{emoji}</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.mobilityTitle}>{title}</Text>
          <Text style={styles.mobilityMeta}>
            ~{planMinutes(plan)} min · {doneCount}/{plan.length} done
          </Text>
        </View>
        <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={16} color={COLORS.textSecondary} />
      </TouchableOpacity>

      {open &&
        plan.map((move) => {
          const checked = done.has(move.id);
          return (
            <TouchableOpacity
              key={move.id}
              style={styles.mobilityRow}
              activeOpacity={0.7}
              onPress={() => toggle(move.id)}
            >
              <Ionicons
                name={checked ? 'checkmark-circle' : 'ellipse-outline'}
                size={20}
                color={checked ? COLORS.accent : COLORS.textMuted}
              />
              <Text style={[styles.mobilityRowText, checked && styles.mobilityRowDone]}>
                {move.name}
              </Text>
              <Text style={styles.mobilityRowTime}>
                {move.seconds >= 60 ? `${Math.round(move.seconds / 60)}m` : `${move.seconds}s`}
              </Text>
            </TouchableOpacity>
          );
        })}
    </View>
  );
}

export default function ActiveWorkoutScreen() {
  const {
    activeWorkout,
    addSetToExercise,
    removeSetFromExercise,
    toggleSetDone,
    updateSetField,
    addExerciseToActiveWorkout,
    removeExerciseFromActiveWorkout,
    finishWorkout,
    discardWorkout,
  } = useWorkout();
  const { latestEntry: bodyEntry } = useBodyMetrics();

  const [overlayType, setOverlayType] = useState<OverlayType>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState<string | null>(null);
  const [finishSummary, setFinishSummary] = useState<FinishSummary | null>(null);
  const [guidedOpen, setGuidedOpen] = useState(false);
  const [voiceNote, setVoiceNote] = useState<{ exerciseId: string; msg: string } | null>(null);

  // Warm-up / cool-down plans derived from the session's muscles. Keyed on a
  // joined string so the memo survives re-renders of the exercises array.
  const muscleKey = activeWorkout?.exercises.map((e) => e.muscle).join('|') ?? '';
  const warmupPlan = useMemo(
    () => generateWarmupPlan(muscleKey ? muscleKey.split('|') : []),
    [muscleKey]
  );
  const cooldownPlan = useMemo(
    () => generateCooldownPlan(muscleKey ? muscleKey.split('|') : []),
    [muscleKey]
  );

  if (!activeWorkout) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.emptyWrap}>
          <Text style={styles.emptyTitle}>No active workout</Text>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => router.replace('/(tabs)/explore')}
          >
            <Text style={styles.primaryButtonText}>Go to Workouts</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const hasAnyPrefill = activeWorkout.exercises.some(
    (exercise) => exercise.prefilledFromLastWorkout
  );

  const existingIds = new Set(activeWorkout.exercises.map((e) => e.id));

  const closeOverlay = () => setOverlayType(null);

  const confirmDiscard = () => {
    discardWorkout();
    setOverlayType(null);
    router.replace('/(tabs)/explore');
  };

  const handlePauseWorkout = () => {
    setOverlayType(null);
    router.replace('/(tabs)/explore');
  };

  const confirmFinish = () => {
    const exercises = activeWorkout.exercises;
    const durationMin = durationMinFrom(activeWorkout.startedAt);
    const totalVolume = totalVolumeFromExercises(exercises);
    const setsCompleted = setsCompletedFromExercises(exercises);
    const caloriesBurned = estimateCaloriesBurned({
      weightKg: bodyEntry?.weight ?? null,
      bodyFatPct: bodyEntry?.bodyFat ?? null,
      durationMin,
      totalVolumeKg: totalVolume,
    });

    finishWorkout({ durationMin, totalVolume, caloriesBurned });
    setOverlayType(null);
    setFinishSummary({ caloriesBurned, totalVolume, durationMin, setsCompleted });
  };

  const closeFinishSummary = () => {
    setFinishSummary(null);
    router.replace('/(tabs)/explore');
  };

  const isLeaveOverlay = overlayType === 'leave';
  const prefillDateLabel = formatPrefillDate(activeWorkout.prefillSourceFinishedAt);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screenWrap}>
        <KeyboardAwareScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={overlayType === null && finishSummary === null && pendingRemoveId === null}
          bottomOffset={20}
        >
          <View style={styles.headerRow}>
            <TouchableOpacity
              style={styles.iconButton}
              activeOpacity={0.85}
              onPress={() => setOverlayType('leave')}
            >
              <Text style={styles.iconButtonText}>←</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.finishButton}
              activeOpacity={0.85}
              onPress={() => setOverlayType('finish')}
            >
              <Text style={styles.finishButtonText}>Finish Workout</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.eyebrow}>Active workout</Text>
          <Text style={styles.title}>{activeWorkout.templateName}</Text>

          {hasAnyPrefill ? (
            <View style={styles.prefillBanner}>
              <Text style={styles.prefillBannerText}>
                {prefillDateLabel
                  ? `Weights and reps pre-filled from your most recent workout on ${prefillDateLabel}.`
                  : 'Weights and reps pre-filled from your most recent workout.'}
              </Text>
            </View>
          ) : null}

          <FeatureHint
            id="guided-mode"
            icon="play-circle-outline"
            title="New: Guided mode"
            body="Follow your workout one set at a time with a built-in rest timer between sets. Tap Guide me to try it."
          />

          <FeatureHint
            id="voice-logging"
            icon="mic-outline"
            title="New: log sets by voice"
            body='Tap the mic on any exercise and say your set, e.g. "sixty by eight" — it fills in the weight and reps for you.'
          />

          <View style={[styles.timerCard, styles.timerCardRow]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.timerLabel}>Workout in progress</Text>
              <Text style={styles.timerValue}>Live session</Text>
            </View>
            <PressableScale
              style={styles.guideBtn}
              onPress={() => {
                setGuidedOpen(true);
                markFeatureSeen('guided-mode');
              }}
            >
              <Ionicons name="play" size={15} color="#07110A" />
              <Text style={styles.guideBtnText}>Guide me</Text>
            </PressableScale>
          </View>

          <MobilityCard emoji="🔥" title="Warm-up first" plan={warmupPlan} />

          {activeWorkout.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseHeaderText}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>
                    {exercise.muscle} • {exercise.equipment}
                    {exercise.targetSets && exercise.targetReps
                      ? ` • Target: ${exercise.targetSets}×${exercise.targetReps}`
                      : ''}
                  </Text>
                  {voiceNote?.exerciseId === exercise.id ? (
                    <Text style={styles.voiceNoteText}>{voiceNote.msg}</Text>
                  ) : null}
                  {exercise.prefilledFromLastWorkout &&
                  exercise.lastWorkoutSummary ? (
                    <Text style={styles.lastWorkoutText}>
                      {formatLastWorkoutSummary(exercise.lastWorkoutSummary)}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.exerciseHeaderActions}>
                  <VoiceSetButton
                    size={32}
                    onStatus={(msg) =>
                      setVoiceNote(msg ? { exerciseId: exercise.id, msg } : null)
                    }
                    onSet={(parsed: ParsedSet) => {
                      const target = exercise.sets.find((s) => !s.done);
                      if (!target) {
                        setVoiceNote({ exerciseId: exercise.id, msg: 'All sets already done — add a set first' });
                        return;
                      }
                      if (parsed.weight != null) {
                        updateSetField(exercise.id, target.id, 'weight', String(parsed.weight));
                      }
                      updateSetField(exercise.id, target.id, 'reps', String(parsed.reps));
                      toggleSetDone(exercise.id, target.id);
                    }}
                  />
                  <TouchableOpacity
                    style={styles.removeExerciseBtn}
                    activeOpacity={0.8}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    onPress={() => setPendingRemoveId(exercise.id)}
                  >
                    <Ionicons name="close" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                </View>
              </View>

              {exercise.sets.map((set, index) => (
                <View
                  key={set.id}
                  style={[styles.setRow, set.done && styles.setRowDone]}
                >
                  <Text style={styles.setNumber}>{index + 1}</Text>

                  <TextInput
                    placeholder="kg"
                    placeholderTextColor={COLORS.textSecondary}
                    style={styles.setInput}
                    value={set.weight}
                    onChangeText={(value) =>
                      updateSetField(exercise.id, set.id, 'weight', value)
                    }
                    keyboardType="decimal-pad"
                    keyboardAppearance="dark"
                    inputAccessoryViewID={KBD_ID}
                  />

                  <TextInput
                    placeholder="reps"
                    placeholderTextColor={COLORS.textSecondary}
                    style={styles.setInput}
                    value={set.reps}
                    onChangeText={(value) =>
                      updateSetField(exercise.id, set.id, 'reps', value)
                    }
                    keyboardType="decimal-pad"
                    keyboardAppearance="dark"
                    inputAccessoryViewID={KBD_ID}
                  />

                  <TouchableOpacity
                    style={[styles.doneButton, set.done && styles.doneButtonActive]}
                    activeOpacity={0.85}
                    onPress={() => toggleSetDone(exercise.id, set.id)}
                  >
                    <Text
                      style={[
                        styles.doneButtonText,
                        set.done && styles.doneButtonTextActive,
                      ]}
                    >
                      {set.done ? '✓' : 'Done'}
                    </Text>
                  </TouchableOpacity>

                  {index > 0 ? (
                    <TouchableOpacity
                      style={styles.removeSetButton}
                      activeOpacity={0.85}
                      onPress={() => removeSetFromExercise(exercise.id, set.id)}
                    >
                      <Text style={styles.removeSetButtonText}>−</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.removeSetPlaceholder} />
                  )}
                </View>
              ))}

              <TouchableOpacity
                style={styles.addSetButton}
                activeOpacity={0.85}
                onPress={() => addSetToExercise(exercise.id)}
              >
                <Text style={styles.addSetButtonText}>+ Add Set</Text>
              </TouchableOpacity>
            </View>
          ))}

          <FeatureHint
            id="add-exercise-midworkout"
            icon="add-circle-outline"
            title="Adjust on the fly"
            body="Missing an exercise the gym doesn't have equipment for, or want to add one? Tap Add Exercise to change today's session without editing the template."
          />

          <PressableScale
            style={styles.addExerciseButton}
            onPress={() => {
              setPickerOpen(true);
              markFeatureSeen('add-exercise-midworkout');
            }}
          >
            <Ionicons name="add-circle-outline" size={18} color={COLORS.accent} />
            <Text style={styles.addExerciseButtonText}>Add Exercise</Text>
          </PressableScale>

          <MobilityCard emoji="🧊" title="Cool-down stretches" plan={cooldownPlan} />
        </KeyboardAwareScrollView>

        {overlayType !== null ? (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayEmoji}>
                {isLeaveOverlay ? '🏋️' : '😄'}
              </Text>

              <Text style={styles.overlayTitle}>
                {isLeaveOverlay ? 'Leave workout screen?' : 'Finish workout?'}
              </Text>

              <Text style={styles.overlayText}>
                {isLeaveOverlay
                  ? 'You can keep training, pause this workout to resume later, or discard it completely.'
                  : 'Nice work. Do you want to finish and close this workout session?'}
              </Text>

              {isLeaveOverlay ? (
                <View style={styles.leaveActionsStack}>
                  <TouchableOpacity
                    style={styles.overlaySecondaryButton}
                    activeOpacity={0.85}
                    onPress={closeOverlay}
                  >
                    <Text style={styles.overlaySecondaryButtonText}>
                      Keep Training
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.overlayPrimaryButton}
                    activeOpacity={0.85}
                    onPress={handlePauseWorkout}
                  >
                    <Text style={styles.overlayPrimaryButtonText}>
                      Pause Workout
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.overlayDangerButton}
                    activeOpacity={0.85}
                    onPress={confirmDiscard}
                  >
                    <Text style={styles.overlayDangerButtonText}>Discard</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <View style={styles.overlayActions}>
                  <TouchableOpacity
                    style={styles.overlaySecondaryButtonHalf}
                    activeOpacity={0.85}
                    onPress={closeOverlay}
                  >
                    <Text style={styles.overlaySecondaryButtonText}>
                      Keep Going
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.overlayPrimaryButtonHalf}
                    activeOpacity={0.85}
                    onPress={confirmFinish}
                  >
                    <Text style={styles.overlayPrimaryButtonText}>Finish</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </View>
        ) : null}

        {pendingRemoveId !== null ? (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayEmoji}>✕</Text>
              <Text style={styles.overlayTitle}>Remove exercise?</Text>
              <Text style={styles.overlayText}>
                This will remove it from the current session only. Your template stays intact.
              </Text>
              <View style={styles.overlayActions}>
                <TouchableOpacity
                  style={styles.overlaySecondaryButtonHalf}
                  activeOpacity={0.85}
                  onPress={() => setPendingRemoveId(null)}
                >
                  <Text style={styles.overlaySecondaryButtonText}>Keep</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.overlayDangerButtonHalf}
                  activeOpacity={0.85}
                  onPress={() => {
                    removeExerciseFromActiveWorkout(pendingRemoveId);
                    setPendingRemoveId(null);
                  }}
                >
                  <Text style={styles.overlayDangerButtonText}>Remove</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        ) : null}

        {finishSummary ? (
          <View style={styles.overlay}>
            <View style={styles.overlayCard}>
              <Text style={styles.overlayEmoji}>🔥</Text>
              <Text style={styles.overlayTitle}>Workout complete</Text>

              <View style={styles.statsGrid}>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>
                    {finishSummary.caloriesBurned != null ? finishSummary.caloriesBurned : '—'}
                  </Text>
                  <Text style={styles.statLabel}>kcal burned</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{finishSummary.durationMin}</Text>
                  <Text style={styles.statLabel}>minutes</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>
                    {Math.round(finishSummary.totalVolume)}
                  </Text>
                  <Text style={styles.statLabel}>kg volume</Text>
                </View>
                <View style={styles.statTile}>
                  <Text style={styles.statValue}>{finishSummary.setsCompleted}</Text>
                  <Text style={styles.statLabel}>sets done</Text>
                </View>
              </View>

              {finishSummary.caloriesBurned == null ? (
                <Text style={styles.statsHint}>
                  Add your weight and body fat % under Progress to see calories burned.
                </Text>
              ) : null}

              <TouchableOpacity
                style={styles.overlayPrimaryButton}
                activeOpacity={0.85}
                onPress={closeFinishSummary}
              >
                <Text style={styles.overlayPrimaryButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : null}

        <ExercisePickerModal
          visible={pickerOpen}
          onClose={() => setPickerOpen(false)}
          existingIds={existingIds}
          onPick={(exercise) => {
            addExerciseToActiveWorkout(exercise);
            setPickerOpen(false);
          }}
        />

        <GuidedWorkout
          visible={guidedOpen}
          onClose={() => setGuidedOpen(false)}
          onFinishRequested={() => {
            setGuidedOpen(false);
            setOverlayType('finish');
          }}
        />
      </View>
        <InputAccessoryView nativeID={KBD_ID}>
          <View style={styles.kbdBar}>
            <TouchableOpacity onPress={() => Keyboard.dismiss()} activeOpacity={0.7}>
              <Text style={styles.kbdDone}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  screenWrap: {
    flex: 1,
    position: 'relative',
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 120,
    gap: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  iconButton: {
    width: 56,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButtonText: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: -1,
  },
  finishButton: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  finishButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  eyebrow: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
  },
  prefillBanner: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.18)',
  },
  prefillBannerText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '600',
    lineHeight: 18,
  },
  timerCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 18,
  },
  timerLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  timerValue: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  exerciseCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  exerciseHeaderText: {
    flex: 1,
  },
  timerCardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  guideBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.accent,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  guideBtnText: {
    color: '#07110A',
    fontSize: 13,
    fontWeight: '800',
  },
  mobilityCard: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
    gap: 10,
  },
  mobilityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mobilityEmoji: { fontSize: 20 },
  mobilityTitle: {
    color: COLORS.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  mobilityMeta: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 1,
  },
  mobilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 4,
  },
  mobilityRowText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
    lineHeight: 18,
  },
  mobilityRowDone: {
    color: COLORS.textMuted,
    textDecorationLine: 'line-through',
  },
  mobilityRowTime: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  exerciseHeaderActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  voiceNoteText: {
    color: COLORS.accent,
    fontSize: 12,
    marginTop: 4,
  },
  removeExerciseBtn: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: COLORS.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exerciseName: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  exerciseMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginTop: 2,
  },
  lastWorkoutText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginTop: 8,
    lineHeight: 17,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    padding: 10,
  },
  setRowDone: {
    backgroundColor: COLORS.accentSoft,
  },
  setNumber: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    width: 20,
  },
  setInput: {
    flex: 1,
    backgroundColor: COLORS.bg,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 12,
    color: COLORS.textPrimary,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  doneButton: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  doneButtonActive: {
    backgroundColor: COLORS.accent,
  },
  doneButtonText: {
    color: COLORS.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  doneButtonTextActive: {
    color: '#07110A',
  },
  removeSetButton: {
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  removeSetButtonText: {
    color: COLORS.danger,
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 16,
  },
  removeSetPlaceholder: {
    width: 40,
  },
  addSetButton: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
  },
  addSetButtonText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  addExerciseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    borderRadius: 16,
    paddingVertical: 14,
  },
  addExerciseButtonText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '800',
  },
  emptyWrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  primaryButton: {
    backgroundColor: COLORS.accent,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 16,
  },
  primaryButtonText: {
    color: '#07110A',
    fontWeight: '800',
    fontSize: 14,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 360,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  overlayEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  overlayTitle: {
    color: COLORS.textPrimary,
    fontSize: 21,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
  },
  overlayText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  overlayActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  leaveActionsStack: {
    width: '100%',
    gap: 10,
  },
  overlaySecondaryButton: {
    width: '100%',
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  overlaySecondaryButtonHalf: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlaySecondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  overlayPrimaryButton: {
    width: '100%',
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  overlayPrimaryButtonHalf: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayPrimaryButtonText: {
    color: '#07110A',
    fontSize: 14,
    fontWeight: '800',
  },
  overlayDangerButton: {
    width: '100%',
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
  },
  overlayDangerButtonHalf: {
    flex: 1,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 16,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  overlayDangerButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
  },
  statsGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  statTile: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  statValue: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  statLabel: {
    color: COLORS.textSecondary,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  statsHint: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 14,
    paddingHorizontal: 8,
  },
  pickerSafe: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
  },
  pickerTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  pickerCloseBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pickerCloseBtnText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerSearchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  pickerSearchInput: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 14,
    paddingVertical: 12,
    paddingRight: 12,
  },
  pickerTabsWrap: {
    height: 46,
    marginBottom: 6,
  },
  pickerTabsContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    height: 46,
  },
  pickerTab: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginRight: 8,
  },
  pickerTabActive: {
    backgroundColor: COLORS.accentSoft,
    borderColor: COLORS.accent,
  },
  pickerTabText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  pickerTabTextActive: {
    color: COLORS.accent,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  pickerRowInfo: {
    flex: 1,
  },
  pickerRowName: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  pickerRowMeta: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  pickerAddBtn: {
    backgroundColor: COLORS.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pickerAddBtnText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerAddedBtn: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerAddedBtnText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  pickerEmpty: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  pickerEmptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  kbdBar: {
    backgroundColor: '#1C1E27',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-end',
  },
  kbdDone: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
  },
});
