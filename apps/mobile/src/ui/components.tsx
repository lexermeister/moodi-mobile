import type { PropsWithChildren } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from './theme';

export function Page({ children }: PropsWithChildren) {
  return <SafeAreaView style={styles.page} edges={['top', 'left', 'right']}>
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">{children}</ScrollView>
  </SafeAreaView>;
}
export function Card({ children }: PropsWithChildren) {
  return <View style={styles.card}>{children}</View>;
}
export function Button({ label, onPress, disabled = false, secondary = false }: {
  label: string; onPress: () => void; disabled?: boolean; secondary?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={({ pressed }) => [styles.button, secondary && styles.secondary, (pressed || disabled) && styles.dim]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryText]}>{label}</Text>
  </Pressable>;
}
export const typography = StyleSheet.create({
  title: { fontSize: 38, fontWeight: '800', letterSpacing: -1.4, color: theme.colors.ink },
  heading: { fontSize: 19, fontWeight: '700', color: theme.colors.ink },
  body: { fontSize: 15, lineHeight: 23, color: theme.colors.muted },
  error: { fontSize: 15, lineHeight: 23, color: theme.colors.error },
});
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: theme.colors.background },
  content: { padding: theme.spacing.large, paddingBottom: 112, gap: theme.spacing.large },
  card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.line,
    borderRadius: theme.radius.card, padding: theme.spacing.medium, gap: 12 },
  button: { minHeight: 48, borderRadius: theme.radius.button, backgroundColor: theme.colors.lavender,
    paddingHorizontal: 16, paddingVertical: 13, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: theme.colors.soft },
  buttonText: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  secondaryText: { color: theme.colors.accent },
  dim: { opacity: 0.5 },
});
