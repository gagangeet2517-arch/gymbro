import { Ionicons } from '@expo/vector-icons';
import React, { useRef, useState } from 'react';
import {
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const { width } = Dimensions.get('window');

const C = {
  bg: '#080A0F',
  text: '#F0F4FF',
  textSub: '#8892A4',
  accent: '#22C55E',
  border: '#1E2130',
  surface: '#0F1117',
};

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
};

const SLIDES: Slide[] = [
  {
    icon: 'barbell',
    color: '#22C55E',
    title: 'Welcome to gymbro',
    body: 'Your personal workout and nutrition tracker. Everything is stored on your device — no account needed.',
  },
  {
    icon: 'list',
    color: '#3B82F6',
    title: 'Train with templates',
    body: 'Start a workout from a template, log your sets, and gymbro pre-fills your weights and reps from last time so you can chase progress.',
  },
  {
    icon: 'camera',
    color: '#A855F7',
    title: 'Track food with AI',
    body: 'Snap a photo of your meal or just say what you ate — the AI estimates calories and macros. Add a free Gemini key in Profile to switch it on.',
  },
  {
    icon: 'stats-chart',
    color: '#F59E0B',
    title: 'See your progress',
    body: 'Charts track your strength, bodyweight, and body-fat trends over time so you can see what is working.',
  },
  {
    icon: 'flag',
    color: '#22C55E',
    title: 'Set goals & reminders',
    body: 'Pick a training goal, choose habit goals, and set daily or long-term reminders — all from your Profile on the Home tab.',
  },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = index === SLIDES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const next = () => {
    if (isLast) { onDone(); return; }
    scrollRef.current?.scrollTo({ x: (index + 1) * width, animated: true });
    setIndex(index + 1);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onDone} hitSlop={10} activeOpacity={0.7}>
            <Text style={styles.skip}>{isLast ? '' : 'Skip'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((s) => (
            <View key={s.title} style={[styles.slide, { width }]}>
              <View style={[styles.iconWrap, { backgroundColor: s.color + '1A', borderColor: s.color + '44' }]}>
                <Ionicons name={s.icon} size={56} color={s.color} />
              </View>
              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <View key={i} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={next}>
            <Text style={styles.ctaText}>{isLast ? 'Get started' : 'Next'}</Text>
            {!isLast && <Ionicons name="arrow-forward" size={16} color="#07110A" />}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { ...StyleSheet.absoluteFillObject, backgroundColor: C.bg, zIndex: 100 },
  safe: { flex: 1 },
  topBar: { height: 44, justifyContent: 'center', alignItems: 'flex-end', paddingHorizontal: 20 },
  skip: { color: C.textSub, fontSize: 15, fontWeight: '700' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 20 },
  iconWrap: {
    width: 120, height: 120, borderRadius: 32, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  title: { color: C.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  body: { color: C.textSub, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  footer: { paddingHorizontal: 24, paddingBottom: 12, gap: 20 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: C.border },
  dotActive: { backgroundColor: C.accent, width: 22 },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.accent, borderRadius: 16, paddingVertical: 16,
  },
  ctaText: { color: '#07110A', fontSize: 16, fontWeight: '800' },
});
