import React, { useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text } from 'react-native';

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
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (to: number) =>
    Animated.spring(scale, {
      toValue: to,
      useNativeDriver: true,
      speed: 40,
      bounciness: 6,
    }).start();

  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => animateTo(0.96)}
      onPressOut={() => animateTo(1)}
    >
      <Animated.View
        style={[
          styles.button,
          variant === 'secondary' && styles.secondaryButton,
          { transform: [{ scale }] },
        ]}
      >
        <Text
          style={[
            styles.buttonText,
            variant === 'secondary' && styles.secondaryButtonText,
          ]}
        >
          {title}
        </Text>
      </Animated.View>
    </Pressable>
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
