import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { getRatingCandidateResolution, reviewRatingCandidate } from './actionsApi';
import type { MoodMeasurement, RatingAction, RecordRatingCandidate } from './actionTypes';
import { measurementLabels, MOOD_MEASUREMENTS, moodSettingsFromCandidate, toggleMeasurement } from './moodSetup';

export type RecordMoodSessionState =
  | 'loading' | 'needs_setup' | 'active' | 'already_active' | 'linked_existing'
  | 'conflict' | 'not_added' | 'error';

type Props = {
  candidate: RecordRatingCandidate;
  recordingId?: string;
  draftId?: string;
  sourceVersion?: string;
  onSessionStateChange?: (status: RecordMoodSessionState) => void;
};

export function RecordMoodSetupCard(props: Props) {
  return <RecordMoodSetupForm key={`${props.recordingId}:${props.draftId}:${props.sourceVersion}:${props.candidate.id}`} {...props} />;
}

function RecordMoodSetupForm({ candidate, recordingId, draftId, sourceVersion, onSessionStateChange }: Props) {
  const hasSource = Boolean(recordingId && draftId && sourceVersion);
  const [measurements, setMeasurements] = useState<MoodMeasurement[]>(candidate.what_to_record ?? ['mood', 'energy']);
  const [status, setStatus] = useState<RecordMoodSessionState>(hasSource ? 'loading' : 'error');
  const [existing, setExisting] = useState<RatingAction | null>(null);
  const [error, setError] = useState<string | null>(hasSource ? null : 'Refresh this session summary before setting up the action.');
  const [busy, setBusy] = useState(false);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  useEffect(() => { onSessionStateChange?.(status); }, [status, onSessionStateChange]);
  useEffect(() => {
    let cancelled = false;
    if (!recordingId || !draftId || !sourceVersion) {
      return;
    }
    void getRatingCandidateResolution(recordingId, candidate.id).then(result => {
      if (cancelled) return;
      if (result.draft_id !== draftId || result.source_version !== sourceVersion) {
        throw new Error('The session summary changed. Reopen the session to review it.');
      }
      setExisting(result.action);
      setStatus(result.status === 'activated' ? 'active' : result.status === 'rejected' ? 'not_added' : result.status);
    }).catch(cause => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : 'Could not load this action.');
      setStatus('error');
    });
    return () => { cancelled = true; };
  }, [recordingId, candidate.id, draftId, sourceVersion, retry]);

  async function submit(disposition: 'activate' | 'reject') {
    if (submitting.current || !recordingId || !draftId || !sourceVersion) return;
    const settings = moodSettingsFromCandidate(candidate, measurements);
    if (disposition === 'activate' && !settings) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await reviewRatingCandidate({ recordingId, candidateId: candidate.id, draftId,
        sourceVersion, disposition, settings: disposition === 'activate' ? settings : null });
      setExisting(result.action);
      setStatus(result.disposition === 'rejected' ? 'not_added' : result.disposition === 'linked_existing' ? 'linked_existing' : 'active');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this action.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (status === 'loading') return <ActivityIndicator accessibilityLabel="Loading Record mood" />;
  const saved = status === 'active' || status === 'linked_existing';
  const rejected = status === 'not_added';
  const sameMeasurements = !existing || (existing.settings.what_to_record.length === measurements.length &&
    measurements.every(item => existing.settings.what_to_record.includes(item)));
  const canSave = status !== 'error' && sameMeasurements && Boolean(moodSettingsFromCandidate(candidate, measurements));

  return <View style={styles.card}>
    <Text style={styles.title}>Record mood</Text>
    {saved ? <>
      <Text style={styles.success}>{status === 'linked_existing' ? 'Using your existing action' : 'Action activated'}</Text>
      <Text style={styles.label}>What to record</Text>
      <Text style={styles.body}>{measurementLabels(existing?.settings.what_to_record ?? measurements)}</Text>
    </> : rejected ? <Text style={styles.body}>This action was not added.</Text> : <>
      <Text style={styles.body}>{candidate.exact_task}</Text>
      <Text style={styles.label}>What to record</Text>
      <Text style={styles.hint}>Mood and Energy are selected by default. Choose what you want to record.</Text>
      <View style={styles.choices}>
        {MOOD_MEASUREMENTS.map(item => {
          const checked = measurements.includes(item.id);
          return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityLabel={item.label}
            accessibilityState={{ checked, disabled: item.id === 'mood' || busy || status === 'error' }}
            disabled={item.id === 'mood' || busy || status === 'error'}
            onPress={() => setMeasurements(current => toggleMeasurement(current, item.id))}
            style={[styles.choice, checked && styles.selected]}>
            <Text style={[styles.choiceText, checked && styles.selectedText]}>{checked ? '✓ ' : ''}{item.label}{item.id === 'mood' ? ' · Required' : ''}</Text>
          </Pressable>;
        })}
      </View>
      {existing ? <View style={styles.source}>
        <Text style={styles.label}>Existing Record mood action</Text>
        <Text style={styles.body}>{measurementLabels(existing.settings.what_to_record)}</Text>
        <Text style={styles.hint}>{sameMeasurements
          ? 'Activation will link this session to the existing action if its tracking settings match.'
          : 'These measurements differ from your existing action. Select the same measurements to link this session. Your existing action will stay unchanged.'}</Text>
      </View> : null}
      <View style={styles.source}>
        <Text style={styles.label}>From this session</Text>
        <Text style={styles.body}>“{candidate.source_excerpt}”</Text>
      </View>
      {status !== 'error' ? <View style={styles.buttons}>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit('reject')} style={styles.secondary}>
          <Text style={styles.choiceText}>Not an action</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy || !canSave} onPress={() => void submit('activate')}
          style={[styles.primary, (busy || !canSave) && styles.disabled]}>
          <Text style={styles.selectedText}>{busy ? 'Saving…' : existing ? 'Use existing action' : 'Activate action'}</Text>
        </Pressable>
      </View> : null}
    </>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {status === 'error' && hasSource ? <Pressable accessibilityRole="button" onPress={() => {
      setStatus('loading');
      setError(null);
      setRetry(value => value + 1);
    }} style={styles.secondary}>
      <Text style={styles.choiceText}>Retry</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 12 }, title: { fontSize: 20, fontWeight: '700', color: '#1e2421' },
  label: { fontSize: 14, fontWeight: '600', color: '#1e2421' },
  body: { fontSize: 14, lineHeight: 21, color: '#1e2421' },
  hint: { fontSize: 13, lineHeight: 19, color: '#68716b' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#eee9df' },
  selected: { backgroundColor: '#ca3d28' }, choiceText: { color: '#1e2421', fontWeight: '600' },
  selectedText: { color: '#fff', fontWeight: '600' },
  source: { gap: 6, padding: 12, backgroundColor: '#f5f1e9', borderRadius: 12 },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { padding: 14, borderRadius: 12, backgroundColor: '#ca3d28' },
  secondary: { padding: 14, borderRadius: 12, backgroundColor: '#eee9df' },
  disabled: { opacity: 0.5 }, success: { color: '#23613a', fontWeight: '600' }, error: { color: '#9b2f20' },
});
