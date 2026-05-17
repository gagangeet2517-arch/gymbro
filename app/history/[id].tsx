import { router, useLocalSearchParams } from 'expo-router';
import React from 'react';
import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppCard from '../../components/ui/AppCard';
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
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

export default function HistoryDetailScreen() {
  const params = useLocalSearchParams<{ id?: string }>();
  const workoutId = typeof params.id === 'string' ? params.id : '';

  const { completedWorkouts } = useWorkout();

  const workout = completedWorkouts.find((item) => item.id === workoutId);

  if (!workout) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.missingWrap}>
          <Text style={styles.missingTitle}>Workout not found</Text>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>History detail</Text>
        <Text style={styles.title}>{workout.templateName}</Text>

        <AppCard>
          <Text style={styles.infoLabel}>Finished</Text>
          <Text style={styles.infoValue}>{formatDate(workout.finishedAt)}</Text>
          <Text style={[styles.infoLabel, styles.infoSpacing]}>Exercises</Text>
          <Text style={styles.infoValue}>{workout.exercises.length}</Text>
        </AppCard>

        {workout.exercises.map((exercise) => (
          <AppCard key={exercise.id}>
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Text style={styles.exerciseMeta}>
              {exercise.muscle} • {exercise.equipment}
            </Text>

            <View style={styles.setsWrap}>
              {exercise.sets.map((set, index) => (
                <View
                  key={set.id}
                  style={[styles.setRow, set.done && styles.setRowDone]}
                >
                  <Text style={styles.setNumber}>Set {index + 1}</Text>

                  <View style={styles.setStat}>
                    <Text style={styles.setStatLabel}>Weight</Text>
                    <Text style={styles.setStatValue}>
                      {set.weight ? `${set.weight} kg` : '—'}
                    </Text>
                  </View>

                  <View style={styles.setStat}>
                    <Text style={styles.setStatLabel}>Reps</Text>
                    <Text style={styles.setStatValue}>
                      {set.reps || '—'}
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.statusPill,
                      set.done ? styles.statusPillDone : styles.statusPillPending,
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusPillText,
                        set.done
                          ? styles.statusPillTextDone
                          : styles.statusPillTextPending,
                      ]}
                    >
                      {set.done ? 'Done' : 'Pending'}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </AppCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 32,
    gap: 12,
  },
  backButton: {
    width: 48,
    height: 44,
    alignSelf: 'flex-start',
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    color: COLORS.textPrimary,
    fontSize: 22,
    fontWeight: '700',
    lineHeight: 22,
    marginTop: -1,
  },
  eyebrow: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 4,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 6,
  },
  infoValue: {
    color: COLORS.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  infoSpacing: {
    marginTop: 14,
  },
  exerciseName: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  exerciseMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 12,
  },
  setsWrap: {
    gap: 10,
  },
  setRow: {
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    padding: 12,
    gap: 10,
  },
  setRowDone: {
    backgroundColor: COLORS.accentSoft,
  },
  setNumber: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '800',
  },
  setStat: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  setStatLabel: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  setStatValue: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  statusPill: {
    alignSelf: 'flex-start',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginTop: 2,
  },
  statusPillDone: {
    backgroundColor: COLORS.accent,
  },
  statusPillPending: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  statusPillText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusPillTextDone: {
    color: '#07110A',
  },
  statusPillTextPending: {
    color: COLORS.textPrimary,
  },
  missingWrap: {
    flex: 1,
    backgroundColor: COLORS.bg,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    gap: 16,
  },
  missingTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
});