import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { useFeatureHintState } from '../../utils/featureHints';

const C = {
  bg: 'rgba(34, 197, 94, 0.08)',
  border: 'rgba(34, 197, 94, 0.25)',
  iconBg: 'rgba(34, 197, 94, 0.15)',
  accent: '#22C55E',
  text: '#F5F7FB',
  textSub: '#9AA3B2',
};

/**
 * One-time inline explainer shown the first time a user encounters a feature.
 * Renders nothing once dismissed (via the close button) or marked seen
 * (via markFeatureSeen, typically called from the action it describes).
 */
export default function FeatureHint({
  id,
  icon = 'sparkles-outline',
  title,
  body,
  style,
}: {
  id: string;
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  style?: ViewStyle;
}) {
  const { ready, seen, dismiss } = useFeatureHintState(id);
  if (!ready || seen) return null;

  return (
    <View style={[styles.card, style]}>
      <View style={styles.iconBox}>
        <Ionicons name={icon} size={16} color={C.accent} />
      </View>
      <View style={styles.textWrap}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.body}>{body}</Text>
      </View>
      <TouchableOpacity onPress={dismiss} hitSlop={8} style={styles.closeBtn} activeOpacity={0.7}>
        <Ionicons name="close" size={14} color={C.textSub} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: C.bg,
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  iconBox: {
    width: 28,
    height: 28,
    borderRadius: 9,
    backgroundColor: C.iconBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  textWrap: { flex: 1 },
  title: { color: C.text, fontSize: 13, fontWeight: '800', marginBottom: 2 },
  body: { color: C.textSub, fontSize: 12, lineHeight: 17 },
  closeBtn: { padding: 2, marginTop: 1 },
});
