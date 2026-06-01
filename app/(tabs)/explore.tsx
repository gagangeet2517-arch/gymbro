import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useExercises } from '../../context/ExerciseContext';
import { Template, useTemplates } from '../../context/TemplateContext';
import { useUserProfile } from '../../context/UserProfileContext';
import { useWorkout } from '../../context/WorkoutContext';
import { GOAL_META } from '../../utils/nutritionGoals';
import { generateSuggestions, type Suggestion } from '../../utils/suggestions';

const COLORS = {
  bg: '#0A0B0F',
  surface: '#12141A',
  surfaceElevated: '#171A22',
  border: '#232734',
  textPrimary: '#F5F7FB',
  textSecondary: '#9AA3B2',
  accent: '#22C55E',
  accentSoft: 'rgba(34, 197, 94, 0.12)',
  blue: '#3B82F6',
  amber: '#F59E0B',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
};

type TemplateCard = {
  id: string;
  name: string;
  details: string;
  note: string;
  accent: string;
  originalTemplate: Template;
};

function formatStartedAt(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function WorkoutsScreen() {
  const {
    templates,
    deleteTemplate,
    moveTemplateUp,
    moveTemplateDown,
    refreshStartersForGoal,
  } = useTemplates();
  const { clearTemplateExercises, setTemplateExercises } = useExercises();
  const { startWorkoutFromTemplate, activeWorkout, completedWorkouts } = useWorkout();
  const { goal } = useUserProfile();

  const [templateToDeleteId, setTemplateToDeleteId] = useState<string | null>(null);
  const [isReorderMode, setIsReorderMode] = useState(false);
  const [suggestionsTarget, setSuggestionsTarget] = useState<Template | null>(null);
  const [showRefreshConfirm, setShowRefreshConfirm] = useState(false);

  const handleStartTemplate = (template: Template) => {
    const hasHistory = completedWorkouts.some((w) => w.templateId === template.id);
    if (hasHistory) {
      setSuggestionsTarget(template);
    } else {
      startWorkoutFromTemplate(template.id, template.name, template.exercises);
      router.push(`/workout/${template.id}`);
    }
  };

  const activeSuggestions: Suggestion[] = suggestionsTarget
    ? generateSuggestions(suggestionsTarget, completedWorkouts)
    : [];

  const templateCards: TemplateCard[] = templates.map((template, index) => ({
    id: template.id,
    name: template.name,
    details: `${template.exercises.length} exercises`,
    note:
      template.notes ||
      (template.isStarter ? 'Starter workout template' : 'Saved workout template'),
    accent: [COLORS.accent, COLORS.blue, COLORS.amber][index % 3],
    originalTemplate: template,
  }));

  const featuredTemplate = templates.length > 0 ? templates[0] : null;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.eyebrow}>Workout templates</Text>
            <Text style={styles.screenTitle}>Built for repeat use</Text>
          </View>

          <TouchableOpacity
            style={styles.addButton}
            activeOpacity={0.85}
            onPress={() => {
              clearTemplateExercises();
              router.push('/templates/create');
            }}
          >
            <Text style={styles.addButtonText}>＋</Text>
          </TouchableOpacity>
        </View>

        {activeWorkout ? (
          <View style={styles.resumeCard}>
            <Text style={styles.resumeLabel}>Workout in progress</Text>
            <Text style={styles.resumeTitle}>{activeWorkout.templateName}</Text>
            <Text style={styles.resumeText}>
              Started: {formatStartedAt(activeWorkout.startedAt)}
            </Text>
            <Text style={styles.resumeText}>
              {activeWorkout.exercises.length} exercises
            </Text>

            <TouchableOpacity
              style={styles.resumeButton}
              activeOpacity={0.85}
              onPress={() => router.push(`/workout/${activeWorkout.templateId}`)}
            >
              <Text style={styles.resumeButtonText}>Resume Workout</Text>
            </TouchableOpacity>
          </View>
        ) : null}

        <View style={styles.featureCard}>
          <Text style={styles.featureLabel}>Quick plan</Text>
          <Text style={styles.featureTitle}>
            {featuredTemplate ? featuredTemplate.name : 'Create your first template'}
          </Text>
          <Text style={styles.featureSubtext}>
            {featuredTemplate
              ? `${featuredTemplate.exercises.length} exercises • ${
                  featuredTemplate.notes || 'Ready to train'
                }`
              : 'Start by creating a custom workout template or use the starter ones already loaded into the app.'}
          </Text>

          <View style={styles.featureActions}>
            <TouchableOpacity
              style={styles.primaryButton}
              activeOpacity={0.85}
              onPress={() => {
                if (!featuredTemplate) {
                  clearTemplateExercises();
                  router.push('/templates/create');
                  return;
                }

                handleStartTemplate(featuredTemplate);
              }}
            >
              <Text style={styles.primaryButtonText}>
                {featuredTemplate ? `Start ${featuredTemplate.name}` : 'Create Template'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              activeOpacity={0.85}
              onPress={() => {
                clearTemplateExercises();
                router.push('/templates/create');
              }}
            >
              <Text style={styles.secondaryButtonText}>New Template</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.sectionHeaderRow}>
          <Text style={styles.sectionTitle}>Your workout splits</Text>

          {templateCards.length > 1 ? (
            <TouchableOpacity
              style={isReorderMode ? styles.doneReorderPill : styles.reorderPill}
              activeOpacity={0.85}
              onPress={() => setIsReorderMode((prev) => !prev)}
            >
              <Text
                style={
                  isReorderMode
                    ? styles.doneReorderPillText
                    : styles.reorderPillText
                }
              >
                {isReorderMode ? 'Done Reordering' : 'Reorder'}
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {goal && !isReorderMode ? (
          <TouchableOpacity
            style={styles.goalRefreshCard}
            activeOpacity={0.85}
            onPress={() => setShowRefreshConfirm(true)}
          >
            <View style={styles.goalRefreshTextWrap}>
              <Text style={styles.goalRefreshLabel}>
                Goal: {GOAL_META[goal].label}
              </Text>
              <Text style={styles.goalRefreshSubtext}>
                Refresh starter templates with sets and reps tuned for this goal.
              </Text>
            </View>
            <Text style={styles.goalRefreshAction}>Refresh</Text>
          </TouchableOpacity>
        ) : null}

        {templateCards.map((template, index) => {
          const sourceTemplate = template.originalTemplate;
          const isStarter = !!sourceTemplate.isStarter;

          return (
            <View key={template.id} style={styles.templateCard}>
              <View
                style={[styles.templateAccent, { backgroundColor: template.accent }]}
              />

              <View style={styles.templateContent}>
                <View style={styles.templateTopRow}>
                  <View>
                    <Text style={styles.templateName}>{template.name}</Text>
                    <Text style={styles.templateDetails}>{template.details}</Text>
                  </View>

                  {!isReorderMode ? (
                    <TouchableOpacity
                      style={styles.editPill}
                      activeOpacity={0.8}
                      onPress={() => {
                        setTemplateExercises(sourceTemplate.exercises);

                        if (isStarter) {
                          router.push(
                            `/templates/create?starterCopy=1&draftName=${encodeURIComponent(
                              sourceTemplate.name
                            )}&draftNotes=${encodeURIComponent(sourceTemplate.notes)}`
                          );
                        } else {
                          router.push(`/templates/create?editId=${sourceTemplate.id}`);
                        }
                      }}
                    >
                      <Text style={styles.editPillText}>
                        {isStarter ? 'Customize' : 'Edit'}
                      </Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={styles.actionGroup}>
                      <TouchableOpacity
                        style={[styles.orderPill, index === 0 && styles.disabledPill]}
                        activeOpacity={0.85}
                        disabled={index === 0}
                        onPress={() => moveTemplateUp(sourceTemplate.id)}
                      >
                        <Text
                          style={[
                            styles.orderPillText,
                            index === 0 && styles.disabledPillText,
                          ]}
                        >
                          ↑
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.orderPill,
                          index === templateCards.length - 1 && styles.disabledPill,
                        ]}
                        activeOpacity={0.85}
                        disabled={index === templateCards.length - 1}
                        onPress={() => moveTemplateDown(sourceTemplate.id)}
                      >
                        <Text
                          style={[
                            styles.orderPillText,
                            index === templateCards.length - 1 &&
                              styles.disabledPillText,
                          ]}
                        >
                          ↓
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                <Text style={styles.templateNote}>{template.note}</Text>

                {!isReorderMode ? (
                  <View style={styles.templateActions}>
                    {!isStarter ? (
                      <TouchableOpacity
                        style={styles.deletePill}
                        activeOpacity={0.85}
                        onPress={() => setTemplateToDeleteId(template.id)}
                      >
                        <Text style={styles.deletePillText}>Delete</Text>
                      </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                      style={styles.inlinePrimaryButton}
                      activeOpacity={0.85}
                      onPress={() => handleStartTemplate(sourceTemplate)}
                    >
                      <Text style={styles.inlinePrimaryButtonText}>Start</Text>
                    </TouchableOpacity>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}

        <View style={styles.smallCard}>
          <Text style={styles.smallCardLabel}>Custom exercise support</Text>
          <Text style={styles.smallCardTitle}>Add any exercise your gym uses</Text>
          <Text style={styles.smallCardText}>
            Starter templates stay available as a base, and customized versions save
            as your own templates.
          </Text>
        </View>
      </ScrollView>

      {/* Delete confirmation overlay */}
      {templateToDeleteId ? (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayEmoji}>🗑️</Text>

            <Text style={styles.overlayTitle}>Delete template?</Text>

            <Text style={styles.overlayText}>
              This saved template will be removed from your workouts list.
            </Text>

            <View style={styles.overlayActions}>
              <TouchableOpacity
                style={styles.overlaySecondaryButton}
                activeOpacity={0.85}
                onPress={() => setTemplateToDeleteId(null)}
              >
                <Text style={styles.overlaySecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.overlayDangerButton}
                activeOpacity={0.85}
                onPress={() => {
                  deleteTemplate(templateToDeleteId);
                  setTemplateToDeleteId(null);
                }}
              >
                <Text style={styles.overlayDangerButtonText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {/* Refresh starters confirmation */}
      {showRefreshConfirm && goal ? (
        <View style={styles.overlay}>
          <View style={styles.overlayCard}>
            <Text style={styles.overlayEmoji}>🔄</Text>
            <Text style={styles.overlayTitle}>Refresh starter templates?</Text>
            <Text style={styles.overlayText}>
              The Push, Pull, Leg, and Upper templates will be re-tuned for {GOAL_META[goal].label}.
              Your own custom templates won&apos;t be touched.
            </Text>
            <View style={styles.overlayActions}>
              <TouchableOpacity
                style={styles.overlaySecondaryButton}
                activeOpacity={0.85}
                onPress={() => setShowRefreshConfirm(false)}
              >
                <Text style={styles.overlaySecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.overlayCTAButton}
                activeOpacity={0.85}
                onPress={() => {
                  refreshStartersForGoal(goal);
                  setShowRefreshConfirm(false);
                }}
              >
                <Text style={styles.overlayCTAButtonText}>Refresh</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {/* Suggestions overlay */}
      {suggestionsTarget ? (
        <View style={styles.overlay}>
          <View style={styles.suggestionsCard}>
            <Text style={styles.overlayEmoji}>💡</Text>
            <Text style={styles.overlayTitle}>Today&apos;s game plan</Text>
            <Text style={styles.suggestionsSubtitle}>
              Based on your last {suggestionsTarget.name} session
            </Text>

            {activeSuggestions.length > 0 ? (
              <ScrollView
                style={styles.suggestionsList}
                showsVerticalScrollIndicator={false}
              >
                {activeSuggestions.map((suggestion) => (
                  <View key={suggestion.id} style={styles.suggestionItem}>
                    <Text style={styles.suggestionArrow}>›</Text>
                    <Text style={styles.suggestionText}>{suggestion.message}</Text>
                  </View>
                ))}
              </ScrollView>
            ) : (
              <Text style={styles.noSuggestionsText}>
                No specific tips yet — just beat last session.
              </Text>
            )}

            <View style={styles.prefillNote}>
              <Text style={styles.prefillNoteText}>
                Sets are pre-filled from your last session.
              </Text>
            </View>

            <View style={styles.overlayActions}>
              <TouchableOpacity
                style={styles.overlaySecondaryButton}
                activeOpacity={0.85}
                onPress={() => setSuggestionsTarget(null)}
              >
                <Text style={styles.overlaySecondaryButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.overlayCTAButton}
                activeOpacity={0.85}
                onPress={() => {
                  const t = suggestionsTarget;
                  setSuggestionsTarget(null);
                  startWorkoutFromTemplate(t.id, t.name, t.exercises);
                  router.push(`/workout/${t.id}`);
                }}
              >
                <Text style={styles.overlayCTAButtonText}>Start Workout</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.bg },
  container: { flex: 1, backgroundColor: COLORS.bg },
  contentContainer: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 32 },

  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 22,
  },
  eyebrow: { color: COLORS.textSecondary, fontSize: 13, marginBottom: 6 },
  screenTitle: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -0.5,
  },

  addButton: {
    width: 46,
    height: 46,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButtonText: {
    color: COLORS.textPrimary,
    fontSize: 24,
    lineHeight: 24,
  },

  resumeCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    marginBottom: 22,
  },
  resumeLabel: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '800',
    marginBottom: 8,
  },
  resumeTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 8,
  },
  resumeText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 4,
  },
  resumeButton: {
    marginTop: 14,
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  resumeButtonText: {
    color: '#07110A',
    fontSize: 14,
    fontWeight: '800',
  },

  featureCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 22,
    marginBottom: 22,
  },
  featureLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  featureTitle: {
    color: COLORS.textPrimary,
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  featureSubtext: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 18,
  },
  featureActions: {
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#07110A',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },

  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: COLORS.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },

  reorderPill: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  reorderPillText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  doneReorderPill: {
    backgroundColor: COLORS.accentSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  doneReorderPillText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
  },

  goalRefreshCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: COLORS.accentSoft,
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.25)',
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 14,
  },
  goalRefreshTextWrap: {
    flex: 1,
  },
  goalRefreshLabel: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
    marginBottom: 2,
  },
  goalRefreshSubtext: {
    color: COLORS.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  goalRefreshAction: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
  },

  templateCard: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 12,
  },
  templateAccent: { width: 5 },
  templateContent: { flex: 1, padding: 18 },
  templateTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  templateName: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 4,
  },
  templateDetails: {
    color: COLORS.textSecondary,
    fontSize: 13,
  },
  editPill: {
    backgroundColor: COLORS.surfaceElevated,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  editPillText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '700',
  },
  actionGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  orderPill: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
  },
  orderPillText: {
    color: COLORS.textPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  disabledPill: {
    opacity: 0.4,
  },
  disabledPillText: {
    color: COLORS.textSecondary,
  },
  templateNote: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 14,
  },
  templateActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  deletePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.dangerSoft,
  },
  deletePillText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  inlinePrimaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: COLORS.accentSoft,
  },
  inlinePrimaryButtonText: {
    color: COLORS.accent,
    fontSize: 13,
    fontWeight: '800',
  },

  smallCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
    marginTop: 10,
  },
  smallCardLabel: {
    color: COLORS.textSecondary,
    fontSize: 12,
    marginBottom: 8,
  },
  smallCardTitle: {
    color: COLORS.textPrimary,
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 8,
  },
  smallCardText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },

  overlay: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  overlayCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    padding: 24,
    alignItems: 'center',
  },
  overlayEmoji: {
    fontSize: 34,
    marginBottom: 12,
  },
  overlayTitle: {
    color: COLORS.textPrimary,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 10,
    textAlign: 'center',
  },
  overlayText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 22,
  },
  overlayActions: {
    width: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  overlaySecondaryButton: {
    flex: 1,
    backgroundColor: COLORS.surfaceElevated,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  overlaySecondaryButtonText: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  overlayDangerButton: {
    flex: 1,
    backgroundColor: COLORS.dangerSoft,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  overlayDangerButtonText: {
    color: COLORS.danger,
    fontSize: 14,
    fontWeight: '800',
  },

  // Suggestions overlay
  suggestionsCard: {
    width: '100%',
    maxWidth: 420,
    maxHeight: '82%',
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 18,
    alignItems: 'center',
  },
  suggestionsSubtitle: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  suggestionsList: {
    width: '100%',
    maxHeight: 220,
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  suggestionArrow: {
    color: COLORS.accent,
    fontSize: 18,
    fontWeight: '800',
    lineHeight: 20,
  },
  suggestionText: {
    flex: 1,
    color: COLORS.textPrimary,
    fontSize: 13,
    lineHeight: 19,
  },
  prefillNote: {
    width: '100%',
    backgroundColor: COLORS.accentSoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  prefillNoteText: {
    color: COLORS.accent,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  noSuggestionsText: {
    color: COLORS.textSecondary,
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 16,
  },
  overlayCTAButton: {
    flex: 1,
    backgroundColor: COLORS.accent,
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: 'center',
  },
  overlayCTAButtonText: {
    color: '#07110A',
    fontSize: 14,
    fontWeight: '800',
  },
});
