import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import React, { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, View } from 'react-native';
import Animated, {
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const AnimatedPath = Animated.createAnimatedComponent(Path);

const BAR_H = 64;
const BUBBLE = 48;
const NOTCH_R = 28;

const C = {
  bar: '#0A0B0F',
  border: '#232734',
  bubble: '#22C55E',
  onBubble: '#07110A',
};

// Bottom bar outline with a smooth cutout ("notch") centered at cx, sized to
// (width, height). The dip is a symmetric cubic bump either side of cx.
function barPath(width: number, height: number, cx: number): string {
  const r = NOTCH_R;
  const dip = height * 0.62;
  const x0 = Math.max(0, cx - r);
  const x1 = Math.min(width, cx + r);
  return `M0,${height} L0,10 Q0,0 10,0
          L${x0 - 12},0 Q${x0},0 ${x0},10
          C${x0},${dip} ${cx - 18},${dip + 6} ${cx},${dip + 6}
          C${cx + 18},${dip + 6} ${x1},${dip} ${x1},10
          Q${x1},0 ${x1 + 12},0
          L${width - 10},0 Q${width},0 ${width},10
          L${width},${height} Z`;
}

export default function LiquidTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const [barWidth, setBarWidth] = useState(0);
  const notchX = useSharedValue(0);
  const count = state.routes.length;
  const slot = barWidth / Math.max(count, 1);

  const centerOf = (i: number) => slot * i + slot / 2;

  useEffect(() => {
    if (barWidth === 0) return;
    notchX.value = withSpring(centerOf(state.index), { damping: 16, stiffness: 180 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.index, barWidth]);

  const onLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    setBarWidth(w);
    notchX.value = (w / count) * state.index + (w / count) / 2;
  };

  const pathProps = useAnimatedProps(() => ({
    d: barPath(barWidth || 1, BAR_H, notchX.value),
  }));

  const bubbleStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: notchX.value - BUBBLE / 2 }],
  }));

  const activeDescriptor = descriptors[state.routes[state.index].key];
  const activeIcon = activeDescriptor.options.tabBarIcon?.({
    focused: true,
    color: C.onBubble,
    size: 22,
  });

  return (
    <View style={{ backgroundColor: C.bar }}>
      <View style={{ height: BAR_H }} onLayout={onLayout}>
        {barWidth > 0 && (
          <Svg width={barWidth} height={BAR_H} style={{ position: 'absolute' }}>
            <AnimatedPath animatedProps={pathProps} fill={C.bar} stroke={C.border} strokeWidth={1} />
          </Svg>
        )}

        {barWidth > 0 && (
          <Animated.View
            style={[
              {
                position: 'absolute',
                top: -BUBBLE / 2 - 2,
                width: BUBBLE,
                height: BUBBLE,
                borderRadius: BUBBLE / 2,
                backgroundColor: C.bubble,
                alignItems: 'center',
                justifyContent: 'center',
              },
              bubbleStyle,
            ]}
          >
            {activeIcon}
          </Animated.View>
        )}

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
          {state.routes.map((route, index) => {
            const { options } = descriptors[route.key];
            const focused = state.index === index;

            const onPress = () => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                accessibilityRole="button"
                accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={String(options.title ?? route.name)}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', height: BAR_H }}
              >
                {!focused &&
                  options.tabBarIcon?.({ focused: false, color: '#5A6478', size: 22 })}
              </Pressable>
            );
          })}
        </View>
      </View>
      <View style={{ height: insets.bottom, backgroundColor: C.bar }} />
    </View>
  );
}
