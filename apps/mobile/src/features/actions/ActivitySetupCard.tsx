import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { getActivityCandidateResolution, reviewActivityCandidate } from './actionsApi';
import type { ActivityCandidate, ActivitySettings } from './activityTypes';

export type ActivityReviewState = 'loading' | 'needs_setup' | 'active' | 'not_added' | 'error';
type Props = { candidate: ActivityCandidate; recordingId?: string; draftId?: string;
  sourceVersion?: string; onStatusChange?: (state: ActivityReviewState) => void;
  onResolved?: () => void; onViewSource?: () => void };

const activityTitle = 'Do an enjoyable activity';
const agreementText = 'You agreed to make time for one thing you enjoy or find meaningful. You can decide what it is when you’re ready.';

export function ActivitySetupCard({ candidate, recordingId, draftId, sourceVersion,
  onStatusChange, onResolved, onViewSource }: Props) {
  const [status, setStatus] = useState<ActivityReviewState>(
    recordingId && draftId && sourceVersion ? 'loading' : 'error');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    recordingId && draftId && sourceVersion ? null : 'Refresh this session before reviewing the action.');
  const [retry, setRetry] = useState(0);
  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);
  useEffect(() => {
    if (!recordingId || !draftId || !sourceVersion) return;
    let active = true;
    void getActivityCandidateResolution(recordingId, candidate.id).then(result => {
      if (active) setStatus(result.status === 'activated' ? 'active' : result.status === 'rejected' ? 'not_added' : 'needs_setup');
    }).catch(cause => { if (active) { setError(cause instanceof Error ? cause.message : 'Could not load the action.'); setStatus('error'); } });
    return () => { active = false; };
  }, [recordingId, draftId, sourceVersion, candidate.id, retry]);

  async function submit(disposition: 'activate' | 'reject') {
    if (!recordingId || !draftId || !sourceVersion || busy) return;
    setBusy(true); setError(null);
    const settings: ActivitySettings | null = disposition === 'activate' ? {
      exact_task: candidate.exact_task, assignment_kind: candidate.assignment_kind,
      agreed_activity: candidate.agreed_activity, frequency: candidate.frequency,
      timing: candidate.timing, reference_period: candidate.reference_period,
      reminder_time: null, reminder_time_zone: null,
    } : null;
    try {
      const result = await reviewActivityCandidate({ recordingId, candidateId: candidate.id,
        draftId, sourceVersion, disposition, settings });
      setStatus(result.disposition === 'activated' ? 'active' : 'not_added');
      onResolved?.();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not review the action.'); }
    finally { setBusy(false); }
  }

  if (status === 'loading') return <ActivityIndicator accessibilityLabel="Loading activity action" />;
  return <View style={styles.card}>
    <Text accessibilityRole="header" style={styles.title}>{activityTitle}</Text>
    <Text style={styles.body}>Does this match what you agreed to?</Text>
    <View style={styles.agreement}>
      <Text style={styles.badge}>{status === 'active' ? 'Active' : status === 'not_added' ? 'Not added' : 'Agreed in session'}</Text>
      <Text style={styles.agreementText}>{agreementText}</Text>
      {onViewSource ? <Pressable accessibilityRole="button" onPress={onViewSource}>
        <Text style={styles.source}>View transcript · {candidate.source_ids.join(', ')}</Text>
      </Pressable> : <Text style={styles.source}>From transcript {candidate.source_ids.join(', ')}</Text>}
    </View>
    {status === 'needs_setup' ? <>
      <View style={styles.buttons}>
        <Pressable accessibilityRole="button" disabled={busy}
          onPress={() => void submit('activate')} style={styles.primary}>
          <Text style={styles.primaryText}>{busy ? 'Saving…' : 'Activate'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={busy} onPress={() => void submit('reject')} style={styles.secondary}>
          <Text style={styles.secondaryText}>Reject</Text>
        </Pressable>
      </View>
    </> : status === 'error' && recordingId && draftId && sourceVersion ? <Pressable accessibilityRole="button" onPress={() => { setStatus('loading'); setRetry(value => value + 1); }} style={styles.secondary}>
      <Text style={styles.secondaryText}>Retry</Text>
    </Pressable> : null}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 12 }, title: { color: '#fff', fontSize: 26, fontWeight: '800' },
  body: { color: '#CBC6D3', fontSize: 15 },
  agreement: { borderColor: '#504B5C', borderWidth: 1, borderRadius: 16, padding: 16, gap: 10, backgroundColor: '#2E2B36' },
  badge: { color: '#BFE8CB', fontSize: 12, fontWeight: '800' },
  agreementText: { color: '#fff', fontSize: 15, lineHeight: 22 },
  source: { color: '#C9B7FF', fontSize: 12, fontWeight: '700' },
  buttons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  primary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#C9B7FF' },
  primaryText: { color: '#272032', fontWeight: '800' },
  secondary: { minHeight: 48, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderColor: '#625C6C', borderWidth: 1 },
  secondaryText: { color: '#fff', fontWeight: '700' }, error: { color: '#FFB4AB', fontSize: 12 },
});
