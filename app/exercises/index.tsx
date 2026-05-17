import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React, { useRef, useMemo, useState } from 'react';
import {
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Exercise, useExercises } from '../../context/ExerciseContext';
import { MUSCLE_GROUPS, builtInExercises } from '../../data/exerciseCatalog';

const C = {
  bg: '#0A0B0F',
  surface: '#12141A',
  surfaceElevated: '#171A22',
  border: '#232734',
  textPrimary: '#F5F7FB',
  textSecondary: '#9AA3B2',
  textMuted: '#5A6478',
  accent: '#22C55E',
  accentSoft: 'rgba(34, 197, 94, 0.12)',
  danger: '#EF4444',
  dangerSoft: 'rgba(239, 68, 68, 0.12)',
};

const EQUIP: Record<string, { bg: string; text: string; label: string }> = {
  Barbell:         { bg: 'rgba(245,158,11,0.15)',  text: '#F59E0B', label: 'BB'  },
  Dumbbell:        { bg: 'rgba(59,130,246,0.15)',   text: '#3B82F6', label: 'DB'  },
  Cable:           { bg: 'rgba(168,85,247,0.15)',   text: '#A855F7', label: 'CBL' },
  Machine:         { bg: 'rgba(239,68,68,0.15)',    text: '#EF4444', label: 'MCH' },
  Bodyweight:      { bg: 'rgba(34,197,94,0.12)',    text: '#22C55E', label: 'BW'  },
  Band:            { bg: 'rgba(244,114,182,0.15)',  text: '#F472B6', label: 'BND' },
  Kettlebell:      { bg: 'rgba(249,115,22,0.15)',   text: '#F97316', label: 'KB'  },
  'EZ-Bar':        { bg: 'rgba(20,184,166,0.15)',   text: '#14B8A6', label: 'EZ'  },
  'Smith Machine': { bg: 'rgba(107,114,128,0.2)',   text: '#9CA3AF', label: 'SM'  },
};

const GROUP_TABS = ['All', 'Chest', 'Back', 'Shoulders', 'Arms', 'Legs', 'Core', 'Full Body', 'Custom'];

type ExItem = Exercise & { isCustom?: boolean };

export default function ExerciseLibraryScreen() {

  const { customExercises, deleteCustomExercise, addExerciseToTemplate, selectedTemplateExercises } =
    useExercises();

  const [query, setQuery] = useState('');
  const [activeGroup, setActiveGroup] = useState('All');
  const tabScrollRef = useRef<ScrollView>(null);
  const tabPositions = useRef<{ x: number; width: number }[]>([]);

  const isAdded = (id: string) => selectedTemplateExercises.some((e) => e.id === id);
  const totalSelected = selectedTemplateExercises.length;

  const handleDone = () => {
    router.back();
  };

  const sections = useMemo(() => {
    const q = query.toLowerCase().trim();
    const matches = (e: Exercise) =>
      !q ||
      e.name.toLowerCase().includes(q) ||
      e.muscle.toLowerCase().includes(q) ||
      e.equipment.toLowerCase().includes(q);

    let pool: ExItem[];

    if (activeGroup === 'Custom') {
      pool = customExercises.filter(matches).map((e) => ({ ...e, isCustom: true }));
    } else {
      const subgroups = activeGroup === 'All' ? null : MUSCLE_GROUPS[activeGroup];
      pool = builtInExercises.filter((e) => {
        if (subgroups && !subgroups.includes(e.muscle)) return false;
        return matches(e);
      });
      if (activeGroup === 'All') {
        const custom = customExercises
          .filter(matches)
          .map((e): ExItem => ({ ...e, isCustom: true }));
        pool = [...pool, ...custom];
      }
    }

    const groupMap = new Map<string, ExItem[]>();
    for (const ex of pool) {
      const key = ex.isCustom ? 'Custom' : ex.muscle;
      if (!groupMap.has(key)) groupMap.set(key, []);
      groupMap.get(key)!.push(ex);
    }

    return Array.from(groupMap.entries()).map(([title, data]) => ({ title, data }));
  }, [query, activeGroup, customExercises]);

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={handleDone} activeOpacity={0.8}>
          <Ionicons name="chevron-back" size={22} color={C.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Exercise Library</Text>
        <TouchableOpacity style={styles.doneBtn} onPress={handleDone} activeOpacity={0.8}>
          <Text style={styles.doneBtnText}>Done</Text>
          {totalSelected > 0 && (
            <View style={styles.doneBadge}>
              <Text style={styles.doneBadgeText}>{totalSelected}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.searchWrap}>
        <Ionicons name="search" size={15} color={C.textMuted} style={{ marginLeft: 12 }} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name, muscle, or equipment..."
          placeholderTextColor={C.textMuted}
          value={query}
          onChangeText={setQuery}
          clearButtonMode="while-editing"
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <View style={styles.tabsBar}>
        <ScrollView
          ref={tabScrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
        >
          {GROUP_TABS.map((tab, index) => (
            <TouchableOpacity
              key={tab}
              style={[styles.tab, activeGroup === tab && styles.tabActive]}
              onPress={() => {
                setActiveGroup(tab);
                const pos = tabPositions.current[index];
                if (pos) {
                  tabScrollRef.current?.scrollTo({
                    x: Math.max(0, pos.x - 16),
                    animated: true,
                  });
                }
              }}
              onLayout={(e) => {
                tabPositions.current[index] = {
                  x: e.nativeEvent.layout.x,
                  width: e.nativeEvent.layout.width,
                };
              }}
              activeOpacity={0.8}
            >
              <Text
                numberOfLines={1}
                style={[styles.tabText, activeGroup === tab && styles.tabTextActive]}
              >
                {tab}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      <SectionList<ExItem>
        sections={sections}
        keyExtractor={(item) => item.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        stickySectionHeadersEnabled
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <TouchableOpacity
            style={styles.createRow}
            onPress={() => router.push('/exercises/create')}
            activeOpacity={0.8}
          >
            <View style={styles.createIconWrap}>
              <Ionicons name="add" size={18} color={C.accent} />
            </View>
            <Text style={styles.createText}>Create custom exercise</Text>
            <Ionicons name="chevron-forward" size={15} color={C.textMuted} />
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Text style={styles.emptyText}>No exercises found</Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
            <View style={styles.sectionCount}>
              <Text style={styles.sectionCountText}>{section.data.length}</Text>
            </View>
          </View>
        )}
        renderItem={({ item }) => {
          const added = isAdded(item.id);
          const eq = EQUIP[item.equipment] ?? {
            bg: 'rgba(107,114,128,0.2)',
            text: '#9CA3AF',
            label: item.equipment.slice(0, 3).toUpperCase(),
          };
          return (
            <View style={styles.exRow}>
              <View style={[styles.equipBadge, { backgroundColor: eq.bg }]}>
                <Text style={[styles.equipLabel, { color: eq.text }]}>{eq.label}</Text>
              </View>
              <View style={styles.exInfo}>
                <Text style={styles.exName}>{item.name}</Text>
                <Text style={styles.exMuscle}>{item.muscle}</Text>
              </View>
              {item.isCustom && (
                <TouchableOpacity
                  style={styles.trashBtn}
                  onPress={() => deleteCustomExercise(item.id)}
                  activeOpacity={0.8}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 4 }}
                >
                  <Ionicons name="trash-outline" size={16} color={C.danger} />
                </TouchableOpacity>
              )}
              <TouchableOpacity
                style={added ? styles.addedBtn : styles.addBtn}
                onPress={() => !added && addExerciseToTemplate(item)}
                activeOpacity={added ? 1 : 0.8}
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 8 }}
              >
                <Text style={added ? styles.addedBtnText : styles.addBtnText}>
                  {added ? 'Added' : 'Add'}
                </Text>
              </TouchableOpacity>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: C.bg,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.accentSoft,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 9,
    gap: 6,
  },
  doneBtnText: {
    color: C.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  doneBadge: {
    backgroundColor: C.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  doneBadgeText: {
    color: '#000',
    fontSize: 11,
    fontWeight: '800',
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 14,
    paddingVertical: 12,
    paddingRight: 12,
  },
  tabsBar: {
    height: 50,
    marginBottom: 6,
  },
  tabsContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    height: 50,
  },
  tab: {
    flexShrink: 0,
    height: 36,
    paddingHorizontal: 16,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
    marginRight: 8,
  },
  tabActive: {
    backgroundColor: C.accentSoft,
    borderColor: C.accent,
  },
  tabText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  tabTextActive: {
    color: C.accent,
  },
  listContent: {
    paddingBottom: 40,
  },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: C.surfaceElevated,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 13,
    gap: 12,
  },
  createIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: C.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  createText: {
    flex: 1,
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: C.bg,
  },
  sectionHeaderText: {
    color: C.accent,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  sectionCount: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sectionCountText: {
    color: C.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  exRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
    backgroundColor: C.bg,
  },
  equipBadge: {
    width: 38,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  equipLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  exInfo: {
    flex: 1,
  },
  exName: {
    color: C.textPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  exMuscle: {
    color: C.textMuted,
    fontSize: 12,
  },
  trashBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: C.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: C.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  addBtnText: {
    color: C.accent,
    fontSize: 13,
    fontWeight: '700',
  },
  addedBtn: {
    backgroundColor: C.surfaceElevated,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: C.border,
  },
  addedBtnText: {
    color: C.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  emptyWrap: {
    paddingVertical: 60,
    alignItems: 'center',
  },
  emptyText: {
    color: C.textMuted,
    fontSize: 14,
  },
});
