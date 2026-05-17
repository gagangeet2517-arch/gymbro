import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const KBD_ID = 'workout-kbd';
import { useWorkout } from '../../context/WorkoutContext';

const COLORS = {
  bg: '#0A0B0F',
  surface: '#12141A',
  surfaceElevated: '#171A22',
  border: '#232734',
  textPrimary: '#F5F7FB',
  textSecondary: '#9AA3B2',
  accent: '#22C55E',
  accentSoft: 'rgba(34, 197, 94, 0.12)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  overlay: 'rgba(0, 0, 0, 0.55)',
};

type OverlayType = 'leave' | 'finish' | null;

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

export default function ActiveWorkoutScreen() {
  const {
    activeWorkout,
    addSetToExercise,
    removeSetFromExercise,
    toggleSetDone,
    updateSetField,
    finishWorkout,
    discardWorkout,
  } = useWorkout();

  const [overlayType, setOverlayType] = useState<OverlayType>(null);

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
    finishWorkout();
    setOverlayType(null);
    router.replace('/(tabs)/explore');
  };

  const isLeaveOverlay = overlayType === 'leave';
  const prefillDateLabel = formatPrefillDate(activeWorkout.prefillSourceFinishedAt);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.screenWrap}>
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          scrollEnabled={overlayType === null}
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

          <View style={styles.timerCard}>
            <Text style={styles.timerLabel}>Workout in progress</Text>
            <Text style={styles.timerValue}>Live session</Text>
          </View>

          {activeWorkout.exercises.map((exercise) => (
            <View key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <View style={styles.exerciseHeaderText}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <Text style={styles.exerciseMeta}>
                    {exercise.muscle} • {exercise.equipment}
                  </Text>
                  {exercise.prefilledFromLastWorkout &&
                  exercise.lastWorkoutSummary ? (
                    <Text style={styles.lastWorkoutText}>
                      {formatLastWorkoutSummary(exercise.lastWorkoutSummary)}
                    </Text>
                  ) : null}
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
        </ScrollView>

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
  overlayDangerButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '700',
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