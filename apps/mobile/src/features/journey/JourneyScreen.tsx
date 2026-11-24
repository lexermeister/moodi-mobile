import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Page, typography } from '@/ui/components';
import { theme } from '@/ui/theme';
import { MoodiWave } from '@/ui/MoodiWave';
import { useCallback, useState } from 'react';
import { listActivityActions, listActivityAttempts, listRatingActions, listRatingEntries } from '../actions/actionsApi';
import type { RatingEntry } from '../actions/actionTypes';
import type { ActivityAttempt } from '../actions/activityTypes';
import { outcomeLabels } from '../actions/activityFlowDomain';
import { MoodEntryDetail } from '../actions/MoodEntriesSection';
import { entryTimeLabel } from '../actions/moodEntryPresentation';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { useMoodiPanel } from '../shell/MoodiPanel';
import { ActivityAttemptDetail } from './ActivityAttemptDetail';
import { completedActionTimeline, type JourneyActionEntry } from './completedActionTimeline';
import { sessionDate, sessionStatus, sortedSessions } from './sessionPresentation';
import { useSessionReviewStatus } from './useSessionReviewStatus';

function RecordedActions({ period, entries, onSelect, initiallyOpen = false }: {
  period: string; entries: JourneyActionEntry[]; onSelect: (entry: JourneyActionEntry) => void; initiallyOpen?: boolean;
}) {
  const [open, setOpen] = useState(initiallyOpen);
  return <View style={styles.actions}>
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }}
      onPress={() => setOpen(!open)} style={styles.actionsHeader}>
      <Text style={styles.disclosure}>{open ? '⌄' : '›'}</Text>
      <View style={styles.copy}><Text style={styles.actionsTitle}>Recorded actions</Text>
        <Text style={styles.period}>{period}</Text></View>
      <Text style={styles.count}>{entries.length}</Text>
    </Pressable>
    {open ? entries.length ? entries.map(item => item.kind === 'mood' ? <Pressable key={item.id} accessibilityRole="button"
      accessibilityLabel={`Mood check-in, ${item.entry.values.mood_value} out of 10, ${entryTimeLabel(item.entry)}`}
      onPress={() => onSelect(item)} style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}>
      <View style={styles.moodIcon}><MoodiWave color={theme.colors.accent} width={20} /></View>
      <View style={styles.copy}><Text style={styles.actionName}>Mood check-in</Text>
        <Text style={styles.period}>{entryTimeLabel(item.entry)}</Text></View>
      <Text style={styles.actionScore}>{item.entry.values.mood_value}<Text style={styles.actionOutOf}>/10</Text></Text>
    </Pressable> : <Pressable key={item.id} accessibilityRole="button"
      accessibilityLabel={`Do an enjoyable activity, ${outcomeLabels[item.attempt.outcome!]}, ${new Date(item.occurredAt).toLocaleString()}`}
      onPress={() => onSelect(item)} style={({ pressed }) => [styles.actionRow, pressed && { opacity: 0.6 }]}>
      <View style={styles.activityIcon}><SymbolView name={{ ios: 'heart', android: 'favorite', web: 'favorite' }}
        size={22} tintColor="#7B4D73" /></View>
      <View style={styles.copy}><Text style={styles.actionName}>Do an enjoyable activity</Text>
        <Text style={styles.period}>{new Date(item.occurredAt).toLocaleString(undefined, {
          month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
        })}</Text></View>
    </Pressable>) : <Text style={styles.emptyActions}>No recorded actions in this period.</Text> : null}
  </View>;
}

export function JourneyScreen() {
  const library = useSharedRecordingLibrary();
  const { setOpen, entryVersion } = useMoodiPanel();
  const router = useRouter();
  const [entries, setEntries] = useState<RatingEntry[]>([]);
  const [activityAttempts, setActivityAttempts] = useState<ActivityAttempt[]>([]);
  const [selected, setSelected] = useState<JourneyActionEntry | null>(null);
  const [actionsLoading, setActionsLoading] = useState(true);
  const [actionsError, setActionsError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    void retry;
    void entryVersion;
    let active = true;
    setActionsLoading(true);
    setEntries([]);
    setActivityAttempts([]);
    const load = async () => {
      try {
        const [ratingActionsResult, activityActionsResult] = await Promise.allSettled([
          listRatingActions(), listActivityActions(),
        ]);
        const ratingActions = ratingActionsResult.status === 'fulfilled' ? ratingActionsResult.value : [];
        const activityActions = activityActionsResult.status === 'fulfilled' ? activityActionsResult.value : [];
        const [ratingRows, activityRows] = await Promise.all([
          Promise.allSettled(ratingActions.map(action => listRatingEntries(action.id))),
          Promise.allSettled(activityActions.map(action => listActivityAttempts(action.id))),
        ]);
        if (active) {
          setEntries(ratingRows.flatMap(result => result.status === 'fulfilled' ? result.value : []));
          setActivityAttempts(activityRows.flatMap(result => result.status === 'fulfilled' ? result.value : []));
          const failed = ratingActionsResult.status === 'rejected' || activityActionsResult.status === 'rejected' ||
            ratingRows.some(result => result.status === 'rejected') || activityRows.some(result => result.status === 'rejected');
          setActionsError(failed ? 'Some recorded actions could not be loaded. Try again to see the full history.' : null);
        }
      } catch (cause) {
        if (active) setActionsError(cause instanceof Error ? cause.message : 'Could not load recorded actions.');
      } finally { if (active) setActionsLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [retry, entryVersion]));
  const sessions = sortedSessions(library.recordings);
  const { needsReview, error: reviewError } = useSessionReviewStatus(sessions[0]);
  const groups = completedActionTimeline(sessions, entries, activityAttempts);
  const shortDate = (index: number) => sessionDate(sessions[index]).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return <Page>
    <Text style={typography.title}>Journey</Text>
    {library.isLoading ? <ActivityIndicator accessibilityLabel="Loading sessions" color={theme.colors.accent} /> : null}
    {actionsLoading ? <ActivityIndicator accessibilityLabel="Loading recorded actions" color={theme.colors.accent} /> : null}
    {actionsError ? <Card><Text style={typography.error}>{actionsError}</Text><Button secondary label="Retry recorded actions" onPress={() => setRetry(value => value + 1)} /></Card> : null}
    {library.error ? <Text accessibilityLiveRegion="polite" style={typography.error}>{library.error}</Text> : null}
    {!library.isLoading && !actionsLoading && !actionsError && !library.recordings.length && !groups[0].length ? <Card>
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
      {!actionsLoading && (!actionsError || groups[index].length > 0) ? <RecordedActions
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
    {!actionsLoading && groups[sessions.length].length ? <RecordedActions
      period={sessions.length ? `Before ${shortDate(sessions.length - 1)}` : 'Your action history'}
      entries={groups[sessions.length]} onSelect={setSelected} initiallyOpen={!sessions.length}
    /> : null}
    </View>
    {selected?.kind === 'mood' ? <MoodEntryDetail entry={selected.entry} onClose={() => setSelected(null)} /> : null}
    {selected?.kind === 'activity' ? <ActivityAttemptDetail attempt={selected.attempt}
      occurredAt={selected.occurredAt} onClose={() => setSelected(null)} /> : null}
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
  activityIcon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#F6E9F1', alignItems: 'center', justifyContent: 'center' },
  actionName: { color: theme.colors.ink, fontSize: 13, fontWeight: '700' },
  actionScore: { color: theme.colors.accent, fontSize: 14, fontWeight: '800' }, actionOutOf: { fontSize: 11, fontWeight: '500' },
  status: { color: theme.colors.accent, fontSize: 13, fontWeight: '600' }, arrow: { fontSize: 28, color: theme.colors.muted },
});
