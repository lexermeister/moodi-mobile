import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/ui/theme';
import type { ActivityAttempt } from '../actions/activityTypes';
import { outcomeLabels } from '../actions/activityFlowDomain';

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.row}><Text style={styles.label}>{label}</Text>
    <Text style={styles.value}>{value}</Text></View>;
}

export function ActivityAttemptDetail({ attempt, occurredAt, onClose }: {
  attempt: ActivityAttempt; occurredAt: string; onClose: () => void;
}) {
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <View style={styles.sheet}>
        <Text style={styles.brand}>Moodi</Text>
        <Text accessibilityRole="header" style={styles.title}>Activity check-in</Text>
        <Text style={styles.subtitle}>{new Date(occurredAt).toLocaleString(undefined,
          { dateStyle: 'medium', timeStyle: 'short' })}</Text>
        <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator>
          <View style={styles.card}>
            <DetailRow label="Activity" value={attempt.selection.label} />
            <DetailRow label="Outcome" value={attempt.outcome ? outcomeLabels[attempt.outcome] : 'Not reported'} />
            {attempt.planned_minutes !== null ? <DetailRow label="Planned time" value={`${attempt.planned_minutes} min`} /> : null}
            {attempt.actual_minutes !== null ? <DetailRow label="Time spent" value={`${attempt.actual_minutes} min`} /> : null}
            {attempt.how_it_went?.trim() ? <DetailRow label="How it went" value={attempt.how_it_went.trim()} /> : null}
            {attempt.feelings_after?.trim() ? <DetailRow label="Felt afterward" value={attempt.feelings_after.trim()} /> : null}
          </View>
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Done viewing activity check-in"
          onPress={onClose} style={styles.done}><Text style={styles.doneText}>Done ✓</Text></Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#16131B99' },
  sheet: { alignSelf: 'center', width: '100%', maxWidth: 420, maxHeight: '92%', minHeight: 320,
    backgroundColor: theme.colors.panel, borderRadius: 22, padding: 16, gap: 12 },
  brand: { fontSize: 13, fontWeight: '800', color: theme.colors.panelText },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.7, color: theme.colors.panelText },
  subtitle: { color: theme.colors.panelMuted, fontSize: 14 },
  scroll: { paddingBottom: 4 },
  card: { paddingHorizontal: 14, borderRadius: 16, borderWidth: 1, borderColor: '#4A4655',
    backgroundColor: '#2E2B36' },
  row: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#514D5A', paddingVertical: 12 },
  label: { flex: 1, color: '#C7C2D0', fontSize: 13 },
  value: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  done: { borderRadius: 11, minHeight: 48, backgroundColor: '#C9B7FF', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#272032', fontWeight: '800', fontSize: 15 },
});
