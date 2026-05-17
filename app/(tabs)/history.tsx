import React from 'react';
import { router } from 'expo-router';
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
  textPrimary: '#F5F7FB',
  textSecondary: '#9AA3B2',
  border: '#232734',
  surfaceElevated: '#171A22',
};

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString();
}

export default function HistoryScreen() {
  const { completedWorkouts } = useWorkout();

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.eyebrow}>Workout history</Text>
        <Text style={styles.title}>Past sessions</Text>

        {completedWorkouts.length === 0 ? (
          <AppCard>
            <Text style={styles.emptyTitle}>No completed workouts yet</Text>
            <Text style={styles.emptyText}>
              Finish a workout session to see it appear here.
            </Text>
          </AppCard>
        ) : (
          completedWorkouts.map((workout) => (
            <TouchableOpacity
              key={workout.id}
              activeOpacity={0.9}
              onPress={() => router.push(`/history/${workout.id}`)}
            >
              <AppCard>
                <View style={styles.cardTopRow}>
                  <View style={styles.cardInfo}>
                    <Text style={styles.workoutName}>{workout.templateName}</Text>
                    <Text style={styles.workoutMeta}>
                      {workout.exercises.length} exercises
                    </Text>
                  </View>

                  <View style={styles.viewPill}>
                    <Text style={styles.viewPillText}>View</Text>
                  </View>
                </View>

                <Text style={styles.dateText}>
                  Finished: {formatDate(workout.finishedAt)}
                </Text>
              </AppCard>
            </TouchableOpacity>
          ))
        )}
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
  emptyTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 8,
  },
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cardInfo: {
    flex: 1,
  },
  workoutName: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginBottom: 4,
  },
  workoutMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
    marginBottom: 10,
  },
  dateText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  viewPill: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  viewPillText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
});