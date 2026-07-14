import { MaterialTopTabBarProps } from '@react-navigation/material-top-tabs';
import { BlurView } from 'expo-blur';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const CAP_H = 60;
const BUBBLE = 50;
const MARGIN_H = 16;

const SPRING = { stiffness: 260, damping: 24, mass: 0.9 };
// Underdamped (low damping) -> overshoots then settles: the icon's bounce.
const SPRING_KICK = { stiffness: 420, damping: 12, mass: 0.6 };

const C = {
  bg: '#080A0F',
  cap: '#12141C',
  border: '#232734',
  bubbleTint: 'rgba(34,197,94,0.45)',
  bubbleRim: 'rgba(255,255,255,0.35)',
  active: '#F3FFF6',
  inactive: '#5A6478',
};

export default function LiquidTabBar({ state, descriptors, navigation }: MaterialTopTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  // While dragging the dock, icons preview the slot under the finger without
  // actually navigating — navigation happens on release.
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const count = state.routes.length;
  const slot = barWidth / Math.max(count, 1);

  const bubbleX = useSharedValue(0);
  const kickY = useSharedValue(0);
  const kickScale = useSharedValue(1);
  const dragging = useSharedValue(false);

  // Bubble follows the active tab on every settle of state.index — tap OR
  // page-swipe both flow through here.
  useEffect(() => {
    if (barWidth === 0) return;
    if (!dragging.value) {
      bubbleX.value = withSpring(centerOf(state.index), SPRING);
      kickY.value = -8;
      kickY.value = withSpring(0, SPRING_KICK);
      kickScale.value = 1.2;
      kickScale.value = withSpring(1, SPRING_KICK);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, barWidth]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBarWidth(w);
    bubbleX.value = (w / count) * state.index + (w / count) / 2;
  };

  const goToIndex = (i: number) => {
    setPreviewIndex(null);
    const route = state.routes[i];
    const focused = state.index === i;
    const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
    if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
  };

  // --- Dock-drag: press the bar and slide the bubble like a slider --------
  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .onStart(() => {
      dragging.value = true;
    })
    .onUpdate((e) => {
      const x = Math.max(BUBBLE / 2, Math.min(barWidth - BUBBLE / 2, e.x));
      bubbleX.value = x;
      const i = Math.max(0, Math.min(count - 1, Math.round((x - slot / 2) / slot)));
      runOnJS(setPreviewIndex)(i);
    })
    .onEnd(() => {
      const i = Math.max(0, Math.min(count - 1, Math.round((bubbleX.value - slot / 2) / slot)));
      dragging.value = false;
      // Everything here runs on the UI thread — inline the center math and
      // the icon kick rather than calling helpers, so no non-worklet crosses.
      bubbleX.value = withSpring(slot * i + slot / 2, SPRING);
      kickY.value = -8;
      kickY.value = withSpring(0, SPRING_KICK);
      kickScale.value = 1.2;
      kickScale.value = withSpring(1, SPRING_KICK);
      runOnJS(goToIndex)(i);
    });

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: bubbleX.value - BUBBLE / 2 }],
  }));

  const kickStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: kickY.value }, { scale: kickScale.value }],
  }));

  const displayIndex = previewIndex != null ? previewIndex : state.index;

  return (
    <View
      style={{
        backgroundColor: C.bg,
        paddingHorizontal: MARGIN_H,
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom, 12),
      }}
    >
      <GestureDetector gesture={pan}>
        <View
          onLayout={onLayout}
          style={{
            height: CAP_H,
            borderRadius: CAP_H / 2,
            backgroundColor: C.cap,
            borderWidth: 0.5,
            borderColor: C.border,
            overflow: 'hidden',
          }}
        >
          {/* Translucent crystal-green glass bubble — persistent, slides to
              the active tab whether by tap, page-swipe, or dock-drag. */}
          {barWidth > 0 && (
            <Animated.View pointerEvents="none" style={[styles.bubble, bubbleStyle]}>
              <BlurView intensity={40} tint="light" style={StyleSheet.absoluteFill} />
              <View
                style={[
                  StyleSheet.absoluteFill,
                  { backgroundColor: C.bubbleTint, borderRadius: BUBBLE / 2, borderWidth: 0.75, borderColor: C.bubbleRim },
                ]}
              />
            </Animated.View>
          )}

          {/* Every icon always renders in its own slot — the bubble is a
              decorative layer behind them, so a slot can never go blank
              even if the bubble is momentarily mispositioned. */}
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {state.routes.map((route, index) => {
              const { options } = descriptors[route.key];
              const focused = state.index === index;
              const isActive = index === displayIndex;
              return (
                <Pressable
                  key={route.key}
                  onPress={() => goToIndex(index)}
                  accessibilityRole="button"
                  accessibilityState={focused ? { selected: true } : {}}
                  accessibilityLabel={String(options.title ?? route.name)}
                  style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: CAP_H }}
                >
                  <Animated.View style={isActive ? kickStyle : undefined}>
                    {options.tabBarIcon?.({ focused: isActive, color: isActive ? C.active : C.inactive })}
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>
        </View>
      </GestureDetector>
    </View>
  );

  function centerOf(i: number) {
    return slot * i + slot / 2;
  }
}

const styles = StyleSheet.create({
  bubble: {
    position: 'absolute',
    top: (CAP_H - BUBBLE) / 2,
    left: 0,
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    overflow: 'hidden',
  },
});
