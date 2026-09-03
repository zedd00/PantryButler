import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface LoadingStateProps {
  text?: string;
}

export default function LoadingState({ text }: LoadingStateProps) {
  return (
    <SafeAreaView style={styles.center}>
      <ActivityIndicator size="large" color={colors.primary} />
      {text ? <Text style={styles.text}>{text}</Text> : null}
    </SafeAreaView>
  );
}

export function Spinner({ color = colors.primary, size = 'large' }: { color?: string; size?: number | 'small' | 'large' }) {
  return <ActivityIndicator color={color} size={size} />;
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    padding: spacing.lg,
  },
  text: {
    fontSize: 14,
    color: colors.textMuted,
    marginTop: spacing.md,
    textAlign: 'center',
  },
});
