import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PracticeAttemptData } from './practiceTypes';
import { practiceSummary } from './practiceFlowDomain';

export function PracticeButton({ label, onPress, secondary = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[practiceStyles.button, secondary && practiceStyles.secondary, disabled && { opacity: 0.5 }]}>
    <Text style={[practiceStyles.buttonText, secondary && { color: '#F7F5FC' }]}>{label}</Text>
  </Pressable>;
}
export function PracticeSummary({ data }: { data: PracticeAttemptData }) {
  return <View style={practiceStyles.card}>{practiceSummary(data).map(row => <View key={row.label} style={{ gap: 4 }}>
    <Text style={practiceStyles.hint}>{row.label}</Text><Text style={practiceStyles.answer}>{row.value}</Text>
  </View>)}</View>;
}
export const practiceStyles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#F7F5FC', fontSize: 14, fontWeight: '800' },
  content: { padding: 16, paddingTop: 4, gap: 14, paddingBottom: 24 },
  title: { color: '#F7F5FC', fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  body: { color: '#C7C2D0', fontSize: 15, lineHeight: 23 },
  answer: { color: '#F7F5FC', fontSize: 15, lineHeight: 23, fontWeight: '600' },
  card: { padding: 14, borderRadius: 16, gap: 12, backgroundColor: '#2E2B36', borderWidth: 1, borderColor: '#4A4655' },
  historySection: { gap: 6 },
  historyTitle: { color: '#F7F5FC', fontSize: 13, fontWeight: '700' },
  history: { borderRadius: 12, backgroundColor: '#2E2B36', borderWidth: 1, borderColor: '#4A4655', overflow: 'hidden' },
  historyRow: { minHeight: 44, paddingHorizontal: 12, paddingVertical: 8,
    flexDirection: 'row', alignItems: 'center', gap: 10 },
  historyDivider: { borderTopWidth: 1, borderTopColor: '#4A4655' },
  historyText: { flex: 1, color: '#C7C2D0', fontSize: 13, lineHeight: 18 },
  hint: { color: '#C7C2D0', fontSize: 13, lineHeight: 19 },
  badge: { color: '#ACE3C8', fontSize: 12, fontWeight: '800', alignSelf: 'flex-start', backgroundColor: '#29463B', padding: 6, borderRadius: 7 },
  link: { color: '#C9B7FF', fontSize: 14, fontWeight: '700' },
  button: { minHeight: 48, padding: 13, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: '#C9B7FF' },
  buttonText: { color: '#272032', fontSize: 15, fontWeight: '800' },
  secondary: { borderWidth: 1, borderColor: '#55505F', backgroundColor: 'transparent' },
  input: { color: '#F7F5FC', fontSize: 15, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#55505F', minHeight: 48 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#55515F', borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  chosen: { backgroundColor: '#403954', borderColor: '#C9B7FF' },
  choiceText: { color: '#FAF9FF', fontSize: 13, fontWeight: '700' },
  timer: { color: '#C9B7FF', fontSize: 52, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  error: { color: '#FFB4AB', fontSize: 13, lineHeight: 19 },
});
