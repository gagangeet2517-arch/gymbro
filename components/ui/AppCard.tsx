import React, { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

type AppCardProps = {
  children: ReactNode;
};

const COLORS = {
  surface: '#12141A',
  border: '#232734',
};

export default function AppCard({ children }: AppCardProps) {
  return <View style={styles.card}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 18,
  },
});