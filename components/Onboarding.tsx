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
  surface: '#0F1117',
  border: '#1E2130',
  text: '#F0F4FF',
  textSub: '#8892A4',
  accent: '#22C55E',
};

type Slide = {
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  title: string;
  body: string;
  /** Where this feature lives, shown as a "Find it" badge. */
  tab?: { icon: keyof typeof Ionicons.glyphMap; label: string };
};

const SLIDES: Slide[] = [
  {
    icon: 'barbell',
    color: '#22C55E',
    title: 'Welcome to gymbro 👋',
    body: 'Track workouts, food, and progress — all in one place. Everything stays on your phone. No account, no sign-up.',
  },
  {
    icon: 'list',
    color: '#3B82F6',
    title: 'Start with a template',
    body: 'Pick a ready-made plan like Push Day and hit Start. gymbro remembers your weights and fills them in next time — just beat your last numbers.',
    tab: { icon: 'barbell-outline', label: 'Workouts tab' },
  },
  {
    icon: 'camera',
    color: '#A855F7',
    title: 'Log food with a photo',
    body: 'Snap your plate — the AI counts calories and protein for you. You can also speak your meal or scan a barcode.',
    tab: { icon: 'restaurant-outline', label: 'Nutrition tab' },
  },
  {
    icon: 'stats-chart',
    color: '#F59E0B',
    title: 'Watch yourself get stronger',
    body: 'Strength, bodyweight, and body-fat charts update automatically as you log. Your progress, visible at a glance.',
    tab: { icon: 'stats-chart-outline', label: 'Progress tab' },
  },
  {
    icon: 'rocket',
    color: '#22C55E',
    title: "You're all set!",
    body: 'Three quick things to do first:',
    tab: { icon: 'home-outline', label: 'Home tab → Profile' },
  },
];

const QUICK_START = [
  { icon: 'flag-outline' as const, text: 'Pick your training goal in Profile' },
  { icon: 'scale-outline' as const, text: 'Log your bodyweight in Progress' },
  { icon: 'play' as const, text: 'Start your first workout!' },
];

export default function Onboarding({ onDone }: { onDone: () => void }) {
  const [index, setIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const isLast = index === SLIDES.length - 1;

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.round(e.nativeEvent.contentOffset.x / width);
    if (i !== index) setIndex(i);
  };

  const goTo = (i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setIndex(i);
  };

  const next = () => {
    if (isLast) { onDone(); return; }
    goTo(index + 1);
  };

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Top bar: back on the left, skip on the right */}
        <View style={styles.topBar}>
          {index > 0 ? (
            <TouchableOpacity onPress={() => goTo(index - 1)} hitSlop={12} activeOpacity={0.7}>
              <Ionicons name="chevron-back" size={22} color={C.textSub} />
            </TouchableOpacity>
          ) : (
            <View style={{ width: 22 }} />
          )}
          {!isLast ? (
            <TouchableOpacity onPress={onDone} hitSlop={12} activeOpacity={0.7}>
              <Text style={styles.skip}>Skip</Text>
            </TouchableOpacity>
          ) : (
            <View style={{ width: 34 }} />
          )}
        </View>

        <ScrollView
          ref={scrollRef}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={onScroll}
          scrollEventThrottle={16}
        >
          {SLIDES.map((s, i) => (
            <View key={s.title} style={[styles.slide, { width }]}>
              <View style={[styles.iconWrap, { backgroundColor: s.color + '1A', borderColor: s.color + '44' }]}>
                <Ionicons name={s.icon} size={56} color={s.color} />
              </View>

              <Text style={styles.title}>{s.title}</Text>
              <Text style={styles.body}>{s.body}</Text>

              {/* Final slide: quick-start checklist */}
              {i === SLIDES.length - 1 && (
                <View style={styles.checklist}>
                  {QUICK_START.map((q, qi) => (
                    <View key={q.text} style={styles.checkRow}>
                      <View style={styles.checkNum}>
                        <Text style={styles.checkNumText}>{qi + 1}</Text>
                      </View>
                      <Ionicons name={q.icon} size={16} color={C.accent} />
                      <Text style={styles.checkText}>{q.text}</Text>
                    </View>
                  ))}
                </View>
              )}

              {/* "Find it" badge pointing at the right tab */}
              {s.tab && (
                <View style={styles.tabBadge}>
                  <Ionicons name={s.tab.icon} size={14} color={C.textSub} />
                  <Text style={styles.tabBadgeText}>Find it: {s.tab.label}</Text>
                </View>
              )}

              {/* Swipe hint, first slide only */}
              {i === 0 && (
                <View style={styles.swipeHint}>
                  <Text style={styles.swipeHintText}>Swipe to explore</Text>
                  <Ionicons name="arrow-forward" size={14} color={C.textSub} />
                </View>
              )}
            </View>
          ))}
        </ScrollView>

        <View style={styles.footer}>
          <View style={styles.dots}>
            {SLIDES.map((_, i) => (
              <TouchableOpacity key={i} onPress={() => goTo(i)} hitSlop={8}>
                <View style={[styles.dot, i === index && styles.dotActive]} />
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity style={styles.cta} activeOpacity={0.85} onPress={next}>
            <Text style={styles.ctaText}>{isLast ? "Let's go 💪" : 'Next'}</Text>
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
  topBar: {
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  skip: { color: C.textSub, fontSize: 15, fontWeight: '700' },
  slide: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 36, gap: 18 },
  iconWrap: {
    width: 120, height: 120, borderRadius: 32, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', marginBottom: 6,
  },
  title: { color: C.text, fontSize: 26, fontWeight: '900', textAlign: 'center' },
  body: { color: C.textSub, fontSize: 15, lineHeight: 23, textAlign: 'center' },
  checklist: {
    alignSelf: 'stretch',
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 16,
    padding: 14,
    gap: 12,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  checkNum: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(34,197,94,0.15)',
    alignItems: 'center', justifyContent: 'center',
  },
  checkNumText: { color: C.accent, fontSize: 12, fontWeight: '800' },
  checkText: { color: C.text, fontSize: 14, fontWeight: '600', flex: 1 },
  tabBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    borderRadius: 999, paddingHorizontal: 12, paddingVertical: 7,
  },
  tabBadgeText: { color: C.textSub, fontSize: 12, fontWeight: '700' },
  swipeHint: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  swipeHintText: { color: C.textSub, fontSize: 13, fontWeight: '600' },
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
