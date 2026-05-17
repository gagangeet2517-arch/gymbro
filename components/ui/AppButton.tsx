import React from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

type AppButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
};

const COLORS = {
  accent: '#22C55E',
  surfaceElevated: '#171A22',
  textPrimary: '#F5F7FB',
};

export default function AppButton({
  title,
  onPress,
  variant = 'primary',
}: AppButtonProps) {
  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      style={[styles.button, variant === 'secondary' && styles.secondaryButton]}
    >
      <Text
        style={[
          styles.buttonText,
          variant === 'secondary' && styles.secondaryButtonText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: COLORS.accent,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButton: {
    backgroundColor: COLORS.surfaceElevated,
  },
  buttonText: {
    color: '#07110A',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: COLORS.textPrimary,
  },
});