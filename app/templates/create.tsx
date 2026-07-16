import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppButton from '../../components/ui/AppButton';
import AppCard from '../../components/ui/AppCard';
import { useExercises } from '../../context/ExerciseContext';
import { useTemplates } from '../../context/TemplateContext';

const COLORS = {
  bg: '#0A0B0F',
  textPrimary: '#F5F7FB',
  textSecondary: '#9AA3B2',
  surfaceElevated: '#171A22',
  border: '#232734',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
  accent: '#22C55E',
  accentSoft: 'rgba(34, 197, 94, 0.12)',
};

export default function CreateTemplateScreen() {
  const params = useLocalSearchParams<{
    editId?: string;
    fromExercises?: string;
    draftName?: string;
    draftNotes?: string;
    starterCopy?: string;
  }>();
  const editId = typeof params.editId === 'string' ? params.editId : undefined;
  const fromExercises =
    typeof params.fromExercises === 'string' && params.fromExercises === '1';
  const draftName =
    typeof params.draftName === 'string' ? decodeURIComponent(params.draftName) : '';
  const draftNotes =
    typeof params.draftNotes === 'string' ? decodeURIComponent(params.draftNotes) : '';
    const isStarterCopy =
  typeof params.starterCopy === 'string' && params.starterCopy === '1';

  const {
    selectedTemplateExercises,
    removeExerciseFromTemplate,
    moveExerciseUp,
    moveExerciseDown,
    clearTemplateExercises,
    setTemplateExercises,
  } = useExercises();

  const { templates, addTemplate, updateTemplate } = useTemplates();

  const existingTemplate = useMemo(
    () => templates.find((template) => template.id === editId),
    [templates, editId]
  );

  const [templateName, setTemplateName] = useState('');
  const [notes, setNotes] = useState('');
  const [isReorderMode, setIsReorderMode] = useState(false);
  const initializedRef = useRef(false);

  useEffect(() => {
  if (editId && existingTemplate) {
    if (!initializedRef.current && !fromExercises) {
      setTemplateName(existingTemplate.name);
      setNotes(existingTemplate.notes);
      setTemplateExercises(existingTemplate.exercises);
      initializedRef.current = true;
      return;
    }

    if (fromExercises && !initializedRef.current) {
      setTemplateName(draftName || existingTemplate.name);
      setNotes(draftNotes || existingTemplate.notes);
      initializedRef.current = true;
    }

    return;
  }

  if (!editId && isStarterCopy && !fromExercises) {
    if (!initializedRef.current) {
      setTemplateName(draftName || '');
      setNotes(draftNotes || '');
      initializedRef.current = true;
    }
    return;
  }

  if (!editId && fromExercises && !initializedRef.current) {
    setTemplateName(draftName || '');
    setNotes(draftNotes || '');
    initializedRef.current = true;
  }
}, [
  editId,
  existingTemplate,
  fromExercises,
  draftName,
  draftNotes,
  isStarterCopy,
  setTemplateExercises,
]);

  const handleSaveTemplate = () => {
    const payload = {
      name: templateName.trim() || 'Untitled Template',
      notes: notes.trim(),
      exercises: selectedTemplateExercises,
    };

    if (editId && existingTemplate && !isStarterCopy) {
      updateTemplate(editId, payload);
    } else {
      addTemplate(payload);
    }

    clearTemplateExercises();
    setTemplateName('');
    setNotes('');
    setIsReorderMode(false);
    initializedRef.current = false;
    router.replace('/(tabs)/explore');
  };

  const handleBack = () => {
    router.back();
  };

  const buildExercisesRoute = () => {
    const encodedName = encodeURIComponent(templateName);
    const encodedNotes = encodeURIComponent(notes);

    if (editId) {
      return `/exercises?editId=${editId}&draftName=${encodedName}&draftNotes=${encodedNotes}`;
    }

    return `/exercises?draftName=${encodedName}&draftNotes=${encodedNotes}`;
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.85}
          onPress={handleBack}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>
          {editId ? 'Edit workout template' : 'New workout template'}
        </Text>
        <Text style={styles.title}>
          {editId ? 'Edit template' : 'Create template'}
        </Text>

        <AppCard>
          <Text style={styles.label}>Workout name</Text>
          <TextInput
            placeholder="e.g. Push Day"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            value={templateName}
            onChangeText={setTemplateName}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />

          <Text style={[styles.label, styles.spacingTop]}>Notes</Text>
          <TextInput
            placeholder="Optional notes"
            placeholderTextColor={COLORS.textSecondary}
            style={[styles.input, styles.notesInput]}
            multiline
            value={notes}
            onChangeText={setNotes}
          />
        </AppCard>

        <View style={styles.selectedSection}>
          <View style={styles.selectedHeader}>
            <Text style={styles.selectedTitle}>Selected exercises</Text>

            {selectedTemplateExercises.length > 1 ? (
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

          {selectedTemplateExercises.length === 0 ? (
            <AppCard>
              <Text style={styles.emptyText}>
                No exercises added yet. Tap Add Exercises to choose some.
              </Text>
            </AppCard>
          ) : (
            selectedTemplateExercises.map((exercise, index) => (
              <AppCard key={exercise.id}>
                <View style={styles.selectedRow}>
                  <View style={styles.selectedInfo}>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.muscle} • {exercise.equipment}
                    </Text>
                  </View>

                  {isReorderMode ? (
                    <View style={styles.actionGroup}>
                      <TouchableOpacity
                        style={[
                          styles.orderPill,
                          index === 0 && styles.disabledPill,
                        ]}
                        activeOpacity={0.85}
                        disabled={index === 0}
                        onPress={() => moveExerciseUp(exercise.id)}
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
                          index === selectedTemplateExercises.length - 1 &&
                            styles.disabledPill,
                        ]}
                        activeOpacity={0.85}
                        disabled={index === selectedTemplateExercises.length - 1}
                        onPress={() => moveExerciseDown(exercise.id)}
                      >
                        <Text
                          style={[
                            styles.orderPillText,
                            index === selectedTemplateExercises.length - 1 &&
                              styles.disabledPillText,
                          ]}
                        >
                          ↓
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.removePill}
                      activeOpacity={0.85}
                      onPress={() => removeExerciseFromTemplate(exercise.id)}
                    >
                      <Text style={styles.removePillText}>Remove</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </AppCard>
            ))
          )}
        </View>

        <View style={styles.actions}>
          <AppButton
            title={editId ? 'Update Template' : 'Save Template'}
            onPress={handleSaveTemplate}
          />
          <View style={styles.buttonGap} />
          <AppButton
            title="Add Exercises"
            variant="secondary"
            onPress={() => router.push(buildExercisesRoute() as never)}
          />
        </View>
      </ScrollView>
      </KeyboardAvoidingView>
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
    paddingBottom: 140,
    gap: 16,
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
    marginBottom: 4,
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: COLORS.surfaceElevated,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 14,
    color: COLORS.textPrimary,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
  },
  notesInput: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  spacingTop: {
    marginTop: 18,
  },
  selectedSection: {
    gap: 12,
  },
  selectedHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  selectedTitle: {
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
  emptyText: {
    color: COLORS.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  selectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  selectedInfo: {
    flex: 1,
  },
  exerciseName: {
    color: COLORS.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    marginBottom: 4,
  },
  exerciseMeta: {
    color: COLORS.textSecondary,
    fontSize: 13,
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
  removePill: {
    backgroundColor: COLORS.dangerSoft,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
  },
  removePillText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '800',
  },
  actions: {
    marginTop: 8,
  },
  buttonGap: {
    height: 12,
  },
});