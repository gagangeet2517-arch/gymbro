import React, { useRef } from 'react';
import { Animated, Pressable, PressableProps, ViewStyle } from 'react-native';

type Props = PressableProps & {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  /** How far to scale down on press (default 0.96). */
  scaleTo?: number;
};

/**
 * Drop-in replacement for TouchableOpacity that adds a subtle spring scale on
 * press for a more tactile, polished feel. Use for primary call-to-action buttons.
 */
export default function PressableScale({
  children,
  style,
  scaleTo = 0.96,
  ...rest
}: Props) {
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
      {...rest}
      onPressIn={(e) => { animateTo(scaleTo); rest.onPressIn?.(e); }}
      onPressOut={(e) => { animateTo(1); rest.onPressOut?.(e); }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
