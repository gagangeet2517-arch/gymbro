import { router } from 'expo-router';
import React, { useState } from 'react';
import {
    Keyboard,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import { SafeAreaView } from 'react-native-safe-area-context';
import AppCard from '../../components/ui/AppCard';
import { useExercises } from '../../context/ExerciseContext';

const COLORS = {
  bg: '#0A0B0F',
  textPrimary: '#F5F7FB',
  textSecondary: '#9AA3B2',
  surfaceElevated: '#171A22',
  border: '#232734',
  accent: '#22C55E',
};

export default function CreateCustomExerciseScreen() {
  const { addCustomExercise } = useExercises();

  const [name, setName] = useState('');
  const [muscle, setMuscle] = useState('');
  const [equipment, setEquipment] = useState('');
  const [notes, setNotes] = useState('');

  const handleSave = () => {
    addCustomExercise({
      name: name.trim() || 'Custom Exercise',
      muscle: muscle.trim() || 'Unknown Muscle',
      equipment: equipment.trim() || 'Unknown Equipment',
    });

    router.replace('/exercises');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAwareScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        bottomOffset={20}
      >
        <TouchableOpacity
          style={styles.backButton}
          activeOpacity={0.85}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        <Text style={styles.eyebrow}>Custom exercise</Text>
        <Text style={styles.title}>Create exercise</Text>

        <AppCard>
          <Text style={styles.label}>Exercise name</Text>
          <TextInput
            placeholder="e.g. Incline Smith Press"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            value={name}
            onChangeText={setName}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />

          <Text style={[styles.label, styles.spacingTop]}>Primary muscle group</Text>
          <TextInput
            placeholder="e.g. Chest"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            value={muscle}
            onChangeText={setMuscle}
            returnKeyType="done"
            onSubmitEditing={() => Keyboard.dismiss()}
          />

          <Text style={[styles.label, styles.spacingTop]}>Equipment</Text>
          <TextInput
            placeholder="e.g. Smith Machine"
            placeholderTextColor={COLORS.textSecondary}
            style={styles.input}
            value={equipment}
            onChangeText={setEquipment}
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

        <View style={styles.actions}>
          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleSave}
            activeOpacity={0.85}
          >
            <Text style={styles.saveButtonText}>Save Custom Exercise</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
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
    padding: 20,
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
    marginBottom: 8,
  },
  title: {
    color: COLORS.textPrimary,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 20,
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
  actions: {
    marginTop: 20,
  },
  saveButton: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#07110A',
    fontSize: 14,
    fontWeight: '800',
  },
});