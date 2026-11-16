import { useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Page, typography } from '@/ui/components';
import { theme } from '@/ui/theme';
import { useState } from 'react';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { useMoodiPanel } from '../shell/MoodiPanel';
import { sessionDate, sessionStatus, sortedSessions } from './sessionPresentation';

function CompletedActions({ period, initiallyOpen = false }: { period: string; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={styles.actions}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
      onPress={() => setOpen(!open)} style={styles.actionsHeader}>
      <Text style={styles.disclosure}>{open ? '⌄' : '›'}</Text>
      <View style={styles.copy}><Text style={styles.actionsTitle}>Completed actions</Text>
        <Text style={styles.period}>{period}</Text></View>
    </Pressable>
    {open ? <Text style={styles.emptyActions}>Completed action history isn’t available yet.</Text> : null}
  </View>;
}

export function JourneyScreen() {
  const library = useSharedRecordingLibrary();
  const { setOpen } = useMoodiPanel();
  const router = useRouter();
  const sessions = sortedSessions(library.recordings);
  const shortDate = (index: number) => sessionDate(sessions[index]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return <Page>
    <Text style={typography.title}>Journey</Text>
    {library.isLoading ? <ActivityIndicator accessibilityLabel="Loading sessions" color={theme.colors.accent} /> : null}
    {library.error ? <Text accessibilityLiveRegion="polite" style={typography.error}>{library.error}</Text> : null}
    {!library.isLoading && !library.recordings.length ? <Card>
      <Text style={typography.heading}>Your journey starts here</Text>
      <Text style={typography.body}>Record a session with Moodi. Once saved, you can return to it here.</Text>
      <Button label="Record a session" onPress={() => setOpen(true)} />
    </Card> : null}
    <View style={styles.timeline}>
    {sessions.map((recording, index) => <View key={recording.id}>
      <CompletedActions
        initiallyOpen={index === 0}
        period={index === 0 ? `Since ${shortDate(0)}` : `${shortDate(index)} – ${shortDate(index - 1)}`}
      />
      <View style={styles.session}>
      <View style={[styles.dot, index === 0 && styles.activeDot]} />
      <Pressable accessibilityRole="button"
      accessibilityLabel={`${sessionDate(recording).toLocaleDateString(undefined, { dateStyle: 'long' })}, ${sessionStatus(recording)}`}
      onPress={() => router.push({ pathname: '/journey/session/[id]', params: { id: recording.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={[styles.iconBox, index === 0 && styles.recentIcon]}><Text style={styles.documentIcon}>▤</Text></View>
      <View style={styles.copy}><Text style={styles.date}>{sessionDate(recording).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(sessionDate(recording).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}) })}</Text>
        <Text style={styles.subtitle}><Text style={styles.sessionLabel}>{index === 0 ? 'Most recent session' : 'Past session'}</Text> · {new Date(recording.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
        {['Processing', 'Needs retry'].includes(sessionStatus(recording)) ? <Text style={styles.status}>{sessionStatus(recording)}</Text> : null}</View>
      <Text style={styles.arrow}>›</Text>
    </Pressable></View>
    </View>)}
    </View>
  </Page>;
}
const styles = StyleSheet.create({
  timeline: { marginLeft: 6, borderLeftWidth: 1, borderLeftColor: theme.colors.line },
  session: { paddingLeft: 12, position: 'relative' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, minHeight: 64 },
  copy: { flex: 1, gap: 3 },
  dot: { position: 'absolute', left: -6, top: 26, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#ACA0C7', backgroundColor: theme.colors.background },
  activeDot: { borderColor: theme.colors.accent, backgroundColor: theme.colors.accent },
  iconBox: { width: 34, height: 36, borderRadius: 10, backgroundColor: '#F0EFF4', alignItems: 'center', justifyContent: 'center' },
  recentIcon: { backgroundColor: '#E5F4ED' },
  documentIcon: { fontSize: 20, color: '#749083' },
  date: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  subtitle: { fontSize: 12, lineHeight: 18, color: theme.colors.muted },
  sessionLabel: { fontWeight: '600' },
  actions: { paddingLeft: 16, paddingVertical: 10 },
  actionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  actionsTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  period: { fontSize: 12, color: theme.colors.muted },
  disclosure: { fontSize: 22, color: theme.colors.muted, width: 14 },
  emptyActions: { marginLeft: 20, paddingVertical: 6, fontSize: 13, lineHeight: 20, color: theme.colors.muted },
  status: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' }, arrow: { fontSize: 28, color: theme.colors.muted },
});
