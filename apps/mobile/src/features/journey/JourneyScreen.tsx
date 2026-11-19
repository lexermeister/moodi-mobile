import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Page, typography } from '@/ui/components';
import { theme } from '@/ui/theme';
import { MoodiWave } from '@/ui/MoodiWave';
import { useCallback, useState } from 'react';
import { listRatingActions, listRatingEntries } from '../actions/actionsApi';
import type { RatingEntry } from '../actions/actionTypes';
import { MoodEntryDetail } from '../actions/MoodEntriesSection';
import { entryTimeLabel } from '../actions/moodEntryPresentation';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { useMoodiPanel } from '../shell/MoodiPanel';
import { completedMoodTimeline } from './completedMoodTimeline';
import { sessionDate, sessionStatus, sortedSessions } from './sessionPresentation';
import { useSessionReviewStatus } from './useSessionReviewStatus';

function CompletedActions({ period, entries, onSelect, initiallyOpen = false }: {
  period: string; entries: RatingEntry[]; onSelect: (entry: RatingEntry) => void; initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={styles.actions}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
      onPress={() => setOpen(!open)} style={styles.actionsHeader}>
      <Text style={styles.disclosure}>{open ? '⌄' : '›'}</Text>
      <View style={styles.copy}><Text style={styles.actionsTitle}>Completed actions</Text>
        <Text style={styles.period}>{period}</Text></View>
      <Text style={styles.count}>{entries.length}</Text>
    </Pressable>
    {open ? entries.length ? entries.map(entry => <Pressable key={entry.id} accessibilityRole="button"
      accessibilityLabel={`Mood check-in, ${entry.values.mood_value} out of 10, ${entryTimeLabel(entry)}`}
      onPress={() => onSelect(entry)} style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}>
      <View style={styles.moodIcon}><MoodiWave color={theme.colors.accent} width={20} /></View>
      <View style={styles.copy}><Text style={styles.actionName}>Mood check-in</Text>
        <Text style={styles.period}>{entryTimeLabel(entry)}</Text></View>
      <Text style={styles.actionScore}>{entry.values.mood_value}<Text style={styles.actionOutOf}>/10</Text></Text>
    </Pressable>) : <Text style={styles.emptyActions}>No completed actions in this period.</Text> : null}
  </View>;
}

export function JourneyScreen() {
  const library = useSharedRecordingLibrary();
  const { setOpen, entryVersion } = useMoodiPanel();
  const router = useRouter();
  const [entries, setEntries] = useState<RatingEntry[]>([]);
  const [selected, setSelected] = useState<RatingEntry | null>(null);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    void retry;
    void entryVersion;
    let active = true;
    setActionsLoading(true);
    setEntries([]);
    const load = async () => {
      try {
        const actions = await listRatingActions();
        const rows = await Promise.all(actions.map(action => listRatingEntries(action.id)));
        if (active) { setEntries(rows.flat()); setActionsError(null); }
      } catch (cause) {
        if (active) setActionsError(cause instanceof Error ? cause.message : 'Could not load completed actions.');
      } finally { if (active) setActionsLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [retry, entryVersion]));
  const sessions = sortedSessions(library.recordings);
  const { needsReview, error: reviewError } = useSessionReviewStatus(sessions[0]);
  const groups = completedMoodTimeline(sessions, entries);
  const shortDate = (index: number) => sessionDate(sessions[index]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return <Page>
    <Text style={typography.title}>Journey</Text>
    {library.isLoading ? <ActivityIndicator accessibilityLabel="Loading sessions" color={theme.colors.accent} /> : null}
    {actionsLoading ? <ActivityIndicator accessibilityLabel="Loading completed actions" color={theme.colors.accent} /> : null}
    {actionsError ? <Card><Text style={typography.error}>{actionsError}</Text><Button secondary label="Retry completed actions" onPress={() => setRetry(value => value + 1)} /></Card> : null}
    {library.error ? <Text accessibilityLiveRegion="polite" style={typography.error}>{library.error}</Text> : null}
    {!library.isLoading && !library.recordings.length && !groups[0].length ? <Card>
      <Text style={typography.heading}>Your journey starts here</Text>
      <Text style={typography.body}>Record a session with Moodi. Once saved, you can return to it here.</Text>
      <Button label="Record a session" onPress={() => setOpen(true)} />
    </Card> : null}
    <View style={styles.timeline}>
    {sessions.map((recording, index) => {
      const status = index === 0 && reviewError ? 'Review status unavailable' :
        index === 0 && needsReview === true ? 'Needs review' :
        index === 0 && needsReview === null ? 'Checking review status' : sessionStatus(recording);
      return <View key={recording.id}>
      {!actionsLoading && !actionsError ? <CompletedActions
        initiallyOpen={index === 0}
        period={index === 0 ? `Since ${shortDate(0)}` : `${shortDate(index)} – ${shortDate(index - 1)}`}
        entries={groups[index]} onSelect={setSelected}
      /> : null}
      <View style={styles.session}>
      <View style={[styles.dot, index === 0 && styles.activeDot]} />
      <Pressable accessibilityRole="button"
      accessibilityLabel={`${sessionDate(recording).toLocaleDateString(undefined, { dateStyle: 'long' })}, ${status}`}
      onPress={() => router.push({ pathname: '/journey/session/[id]', params: { id: recording.id } })}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}>
      <View style={[styles.iconBox, index === 0 && styles.recentIcon]}>
        <SymbolView name={{ ios: 'doc.text', android: 'description', web: 'description' }} size={22}
          tintColor={index === 0 ? '#287453' : '#706D7B'} />
      </View>
      <View style={styles.copy}><Text style={styles.date}>{sessionDate(recording).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', ...(sessionDate(recording).getFullYear() !== new Date().getFullYear() ? { year: 'numeric' as const } : {}) })}</Text>
        <Text style={styles.subtitle}><Text style={styles.sessionLabel}>{index === 0 ? 'Most recent session' : 'Past session'}</Text> · {new Date(recording.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}</Text>
        {['Processing', 'Needs retry', 'Needs review', 'Checking review status', 'Review status unavailable'].includes(status) ? <Text style={styles.status}>{status}</Text> : null}</View>
      <Text style={styles.arrow}>›</Text>
    </Pressable></View>
    </View>; })}
    {!actionsLoading && !actionsError && groups[sessions.length].length ? <CompletedActions
      period={sessions.length ? `Before ${shortDate(sessions.length - 1)}` : 'Your mood history'}
      entries={groups[sessions.length]} onSelect={setSelected} initiallyOpen={!sessions.length}
    /> : null}
    </View>
    {selected ? <MoodEntryDetail entry={selected} onClose={() => setSelected(null)} /> : null}
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
  date: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  subtitle: { fontSize: 12, lineHeight: 18, color: theme.colors.muted },
  sessionLabel: { fontWeight: '600' },
  actions: { paddingLeft: 16, paddingVertical: 10 },
  actionsHeader: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44 },
  actionsTitle: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  period: { fontSize: 12, color: theme.colors.muted },
  disclosure: { fontSize: 22, color: theme.colors.muted, width: 14 },
  emptyActions: { marginLeft: 20, paddingVertical: 6, fontSize: 13, lineHeight: 20, color: theme.colors.muted },
  count: { minWidth: 24, textAlign: 'center', color: theme.colors.muted, backgroundColor: '#F0EFF4', borderRadius: 12, overflow: 'hidden', fontSize: 12, fontWeight: '700', padding: 3 },
  actionRow: { marginLeft: 18, marginTop: 4, padding: 8, borderRadius: 11, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: '#F8F7FB', flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 46 },
  moodIcon: { width: 30, height: 30, borderRadius: 8, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center' },
  actionName: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  actionScore: { color: theme.colors.accent, fontSize: 14, fontWeight: '800' }, actionOutOf: { fontSize: 11, fontWeight: '500' },
  status: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' }, arrow: { fontSize: 28, color: theme.colors.muted },
});
