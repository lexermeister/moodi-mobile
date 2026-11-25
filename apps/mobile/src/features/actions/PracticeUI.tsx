import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PracticeAttemptData } from './practiceTypes';
import { practiceSummary, practiceTimeLabel } from './practiceFlowDomain';

export function PracticeButton({ label, onPress, secondary = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled}
    onPress={onPress} style={[practiceStyles.button, secondary && practiceStyles.secondary, disabled && { opacity: 0.5 }]}>
    <Text style={[practiceStyles.buttonText, secondary && { color: '#F7F5FC' }]}>{label}</Text>
  </Pressable>;
}
export function PracticeSummary({ data, loggedAt }: { data: PracticeAttemptData; loggedAt?: string }) {
  const summary = practiceSummary(data);
  const period = loggedAt ? practiceTimeLabel(loggedAt) : null;
  return <View style={practiceStyles.overview}>
    <View style={practiceStyles.overviewHeader}>
      <Text style={practiceStyles.overviewDate}>{summary.date}</Text>
      {period ? <Text style={practiceStyles.periodBadge}>{period}</Text> : null}
    </View>
    <View style={practiceStyles.tensionPanel}>
      <Text accessibilityRole="header" style={practiceStyles.tensionTitle}>Tension before and after</Text>
      <View style={practiceStyles.tensionValues}>
        {[{ label: 'Before', value: data.tension_before }, { label: 'After', value: data.tension_after }].map(rating =>
          <View key={rating.label} accessible accessibilityLabel={`Tension ${rating.label.toLowerCase()}, ${rating.value === null ? 'not rated' : `${rating.value} out of 10`}`}
            style={practiceStyles.tensionValueCard}>
            <Text style={practiceStyles.hint}>{rating.label}</Text>
            {rating.value === null ? <Text style={practiceStyles.unrated}>Not rated</Text> :
              <Text style={practiceStyles.tensionScore}>{rating.value}<Text style={practiceStyles.tensionUnit}> /10</Text></Text>}
          </View>)}
      </View>
      <Text style={practiceStyles.scaleHint}>0 · Fully relaxed   /   10 · Extremely tense</Text>
      {data.before_rating_retrospective && data.tension_before !== null ? <Text style={practiceStyles.scaleHint}>Before rating recorded looking back.</Text> : null}
    </View>
    <View style={practiceStyles.overviewDetails}>
      <View style={practiceStyles.overviewRow}><Text style={practiceStyles.hint}>Outcome</Text><Text style={practiceStyles.detailValue}>{summary.outcome}</Text></View>
      <View style={practiceStyles.overviewRow}><Text style={practiceStyles.hint}>Duration</Text><Text style={practiceStyles.detailValue}>{summary.duration}</Text></View>
      {summary.timer ? <View style={practiceStyles.overviewRow}><Text style={practiceStyles.hint}>Timer elapsed</Text><Text style={practiceStyles.detailValue}>{summary.timer}</Text></View> : null}
    </View>
    {summary.notes ? <View style={practiceStyles.card}><Text style={practiceStyles.hint}>What you noticed</Text>
      <Text selectable style={practiceStyles.notesText}>{summary.notes}</Text></View> : null}
  </View>;
}
export const practiceStyles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingTop: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brand: { color: '#F7F5FC', fontSize: 14, fontWeight: '800' },
  content: { padding: 16, paddingTop: 4, gap: 14, paddingBottom: 24 },
  title: { color: '#F7F5FC', fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  body: { color: '#C7C2D0', fontSize: 15, lineHeight: 23 },
  answer: { color: '#F7F5FC', fontSize: 15, lineHeight: 23, fontWeight: '600' },
  card: { padding: 14, borderRadius: 16, gap: 12, backgroundColor: '#2E2B36', borderWidth: 1, borderColor: '#4A4655' },
  overview: { gap: 14 },
  overviewHeader: { gap: 8 },
  overviewDate: { color: '#F7F5FC', fontSize: 16, lineHeight: 23, fontWeight: '600' },
  periodBadge: { alignSelf: 'flex-start', color: '#DFD2FF', backgroundColor: '#403954',
    borderRadius: 7, overflow: 'hidden', paddingHorizontal: 9, paddingVertical: 4, fontSize: 12, fontWeight: '700' },
  tensionPanel: { backgroundColor: '#332D42', borderWidth: 1, borderColor: '#655780', borderRadius: 16, padding: 14, gap: 12 },
  tensionTitle: { color: '#F7F5FC', fontSize: 15, fontWeight: '700' },
  tensionValues: { flexDirection: 'row', gap: 10 },
  tensionValueCard: { flex: 1, backgroundColor: '#24222B', padding: 12, borderRadius: 12, gap: 5, justifyContent: 'center' },
  tensionScore: { color: '#DFD2FF', fontSize: 36, fontWeight: '800', fontVariant: ['tabular-nums'] },
  tensionUnit: { color: '#BEB5CF', fontSize: 14, fontWeight: '500' },
  unrated: { color: '#C7C2D0', fontSize: 15, paddingVertical: 10 },
  scaleHint: { color: '#C7C2D0', fontSize: 11, lineHeight: 16 },
  overviewDetails: { borderWidth: 1, borderColor: '#4A4655', borderRadius: 14, paddingHorizontal: 14 },
  overviewRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12, paddingVertical: 10 },
  detailValue: { flexShrink: 1, color: '#F7F5FC', fontSize: 13, fontWeight: '600', textAlign: 'right' },
  notesText: { color: '#F7F5FC', fontSize: 14, lineHeight: 21 },
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
