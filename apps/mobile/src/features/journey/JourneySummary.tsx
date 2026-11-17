import { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { MoodiWave } from '@/ui/MoodiWave';
import { measurementLabels } from '../actions/moodSetup';
import { confirmActionReviews, getActionReviewConfirmation, getRatingCandidateResolution, type ActionReviewConfirmation } from '../actions/actionsApi';
import { RecordMoodSetupCard, type RecordMoodSessionState } from '../actions/RecordMoodSetupCard';
import type { RecordingMetadata } from '../recordings/recordingStorage';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { sessionDate } from './sessionPresentation';
import { recordMoodCandidates, summaryReviewRequest } from './sessionReviewDomain';

type Step = 'summary' | 'actions' | 'mood';

export function JourneySummary({ recording }: { recording: RecordingMetadata }) {
  const [step, setStep] = useState<Step>('summary');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionStates, setActionStates] = useState<Record<string, RecordMoodSessionState>>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadedActionDraftId, setLoadedActionDraftId] = useState<string | null>(null);
  const [actionConfirmation, setActionConfirmation] = useState<ActionReviewConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const library = useSharedRecordingLibrary();
  const insights = recording.sessionInsights;
  const review = recording.sessionInsightsReview?.draft_id === insights?.draft_id &&
    recording.sessionInsightsReview?.source_version === insights?.source_version
    ? recording.sessionInsightsReview : undefined;
  const sections = review ? review.sections.map(section => ({
    key: section.key, heading: section.heading,
    bullets: section.items.filter(item => item.disposition !== 'removed' && item.displayed_text)
      .map(item => item.displayed_text!),
  })) : insights?.result.sections.map(section => ({
    key: section.key, heading: section.heading, bullets: section.bullets.map(item => item.text),
  })) ?? [];
  const candidates = useMemo(() => recordMoodCandidates(insights), [insights]);
  const selected = candidates.find(candidate => candidate.id === selectedId);
  const reviewRequest = summaryReviewRequest(insights);
  const candidateKey = candidates.map(candidate => candidate.id).join('|');
  const actionKey = (candidateId: string) => `${insights?.draft_id ?? 'no-draft'}:${candidateId}`;
  const loadingActions = Boolean(insights?.draft_id && loadedActionDraftId !== insights.draft_id);
  const confirmed = Boolean(actionConfirmation && actionConfirmation.draft_id === insights?.draft_id &&
    actionConfirmation.source_version === insights?.source_version &&
    actionConfirmation.candidate_ids.join('|') === candidateKey);
  const canConfirm = Boolean(recording.backendRecordingId && insights?.draft_id && insights?.source_version &&
    candidates.length > 0 && !loadingActions && !confirming && !confirmed &&
    candidates.every(candidate => ['active', 'linked_existing'].includes(actionStates[actionKey(candidate.id)])));

  useEffect(() => {
    const recordingId = recording.backendRecordingId;
    if (!recordingId || !insights?.draft_id) return;
    let cancelled = false;
    const currentCandidates = recordMoodCandidates(insights);
    void Promise.all([
      getActionReviewConfirmation(recordingId),
      ...currentCandidates.map(candidate => getRatingCandidateResolution(recordingId, candidate.id)),
    ]).then(([confirmation, ...resolutions]) => {
      if (cancelled) return;
      setActionConfirmation(confirmation as ActionReviewConfirmation | null);
      setActionStates(current => {
        const next: Record<string, RecordMoodSessionState> = {};
        currentCandidates.forEach((candidate, index) => {
          const status = resolutions[index].status;
          const key = `${insights.draft_id}:${candidate.id}`;
          next[key] = current[key] === 'active' || current[key] === 'linked_existing'
            ? current[key] : status === 'activated' ? 'active' : status === 'rejected' ? 'not_added' : status;
        });
        return next;
      });
    }).catch(cause => {
      if (!cancelled) {
        setActionStates({});
        setActionConfirmation(null);
        setError(cause instanceof Error ? cause.message : 'Could not load action reviews.');
      }
    }).finally(() => { if (!cancelled) setLoadedActionDraftId(insights.draft_id ?? null); });
    return () => { cancelled = true; };
  }, [recording.backendRecordingId, insights]);

  async function markReviewed() {
    if (!reviewRequest || saving || review) return;
    setSaving(true);
    setError(null);
    try {
      await library.saveInsightsReview(recording, reviewRequest);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not mark the summary as reviewed.');
    } finally { setSaving(false); }
  }

  async function confirmActions() {
    const recordingId = recording.backendRecordingId;
    if (!canConfirm || !recordingId || !insights?.draft_id) return;
    setConfirming(true);
    setError(null);
    try {
      setActionConfirmation(await confirmActionReviews(recordingId, insights.draft_id, insights.source_version));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not confirm these actions.');
    } finally { setConfirming(false); }
  }

  return <View style={styles.panel}>
    <Text style={styles.brand}>Moodi</Text>
    {step !== 'summary' ? <Pressable accessibilityRole="button" onPress={() => setStep(step === 'mood' ? 'actions' : 'summary')} style={styles.back}>
      <Text style={styles.backText}>‹  Back</Text>
    </Pressable> : null}
    <ScrollView nestedScrollEnabled contentContainerStyle={styles.content}>
      {step === 'summary' ? <>
        <Text accessibilityRole="header" style={styles.title}>Here’s what I heard</Text>
        <Text style={styles.intro}>Take a look at the summary. {candidates.length ? `I pulled out ${candidates.length === 1 ? 'one action' : `${candidates.length} actions`} you agreed to try.` : 'Review what we discussed.'}</Text>
        <View style={styles.summaryCard}>
          <View style={styles.cardHeader}><Text style={styles.cardLabel}>SESSION SUMMARY · {sessionDate(recording).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</Text>
            {insights ? <Text style={styles.badge}>{review ? 'Reviewed' : insights.result.status === 'insufficient_source' ? 'Limited' : 'Draft'}</Text> : null}</View>
          {insights?.result.coverage_note ? <Text style={styles.coverage}>{insights.result.coverage_note}</Text> : null}
          {!insights ? <Text style={styles.body}>Your session summary is being prepared.</Text> :
            insights.result.status === 'insufficient_source' ? <Text style={styles.body}>There wasn’t enough recorded information for a reliable summary.</Text> :
            sections.some(section => section.bullets.length) ? sections.filter(section => section.bullets.length).map(section => <View key={section.key} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.heading}</Text>
              {section.bullets.map((bullet, index) => <View key={index} style={styles.bullet}><Text style={styles.bulletMark}>•</Text><Text selectable style={styles.bulletText}>{bullet}</Text></View>)}
            </View>) : <Text style={styles.body}>No summary points are available.</Text>}
        </View>
      </> : step === 'actions' ? <>
        <Text accessibilityRole="header" style={styles.sectionTitle}>Actions to review</Text>
        <Text style={styles.body}>Open each action to check the plan and activate it when you’re ready.</Text>
        {candidates.length ? candidates.map(candidate => <Pressable key={candidate.id} accessibilityRole="button"
          accessibilityLabel="Review Record mood" onPress={() => { setSelectedId(candidate.id); setStep('mood'); }} style={styles.actionRow}>
          <View style={styles.actionIcon}><MoodiWave width={20} /></View>
          <View style={styles.actionCopy}><Text style={styles.actionName}>Record mood</Text>
            <Text style={styles.actionDetail}>{[candidate.frequency, candidate.timing, measurementLabels(candidate.what_to_record ?? ['mood'])].filter(Boolean).join(' · ')}</Text></View>
          <Text style={styles.reviewLink}>{confirmed ? 'Confirmed' : actionStates[actionKey(candidate.id)] === 'active' || actionStates[actionKey(candidate.id)] === 'linked_existing' ? 'Active' : 'Review'} ›</Text>
        </Pressable>) : <Text style={styles.body}>No Record mood action was identified in this session.</Text>}
        {confirmed ? <Text style={styles.success}>Actions confirmed ✓</Text> : null}
      </> : selected ? <RecordMoodSetupCard key={`${insights?.draft_id}:${selected.id}`} candidate={selected}
        recordingId={recording.backendRecordingId} draftId={insights?.draft_id} sourceVersion={insights?.source_version}
        onSessionStateChange={status => setActionStates(current => current[actionKey(selected.id)] === status ? current : { ...current, [actionKey(selected.id)]: status })}
        onActivated={() => { setSelectedId(null); setStep('actions'); }} /> : null}
    </ScrollView>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {step === 'summary' ? <View style={styles.footer}>
      <Pressable accessibilityRole="button" disabled={!reviewRequest || saving || Boolean(review)} onPress={() => void markReviewed()} style={[styles.secondaryButton, (!reviewRequest || saving || review) && styles.disabled]}>
        <Text style={styles.secondaryText}>{review ? 'Reviewed ✓' : saving ? 'Saving…' : 'Mark as reviewed ✓'}</Text>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => setStep('actions')} style={styles.primaryButton}>
        <Text style={styles.primaryText}>Review actions  →</Text>
      </Pressable>
    </View> : step === 'actions' ? <View style={styles.footer}>
      <Pressable accessibilityRole="button" onPress={() => setStep('summary')} style={styles.secondaryButton}><Text style={styles.secondaryText}>Back to summary</Text></Pressable>
      <Pressable accessibilityRole="button" disabled={!canConfirm} onPress={() => void confirmActions()}
        style={[styles.primaryButton, !canConfirm && styles.disabled]}>
        <Text style={styles.primaryText}>{confirmed ? 'Confirmed ✓' : confirming ? 'Confirming…' : 'Confirm'}</Text>
      </Pressable>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { height: 430, borderRadius: 22, padding: 16, gap: 12, backgroundColor: '#24222B' },
  brand: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  back: { minHeight: 35, justifyContent: 'center' }, backText: { color: '#C9B7FF', fontSize: 13, fontWeight: '700' },
  content: { gap: 14, paddingBottom: 8 }, title: { color: '#FFFFFF', fontSize: 26, fontWeight: '800', letterSpacing: -0.7 },
  intro: { color: '#D4D0DD', fontSize: 14, lineHeight: 22 }, body: { color: '#D4D0DD', fontSize: 14, lineHeight: 22 },
  summaryCard: { borderWidth: 1, borderColor: '#4A4655', borderRadius: 15, padding: 14, gap: 14, backgroundColor: '#2E2B36' },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 }, cardLabel: { flex: 1, color: '#FFFFFF', fontSize: 11, fontWeight: '800', letterSpacing: 0.3 },
  badge: { color: '#C9B7FF', backgroundColor: '#403954', padding: 5, borderRadius: 6, overflow: 'hidden', fontSize: 11, fontWeight: '700' },
  coverage: { borderLeftWidth: 2, borderLeftColor: '#A990EF', paddingLeft: 10, color: '#D4D0DD', fontSize: 13, lineHeight: 19 },
  section: { borderTopWidth: 1, borderTopColor: '#514D5A', paddingTop: 12, gap: 8 },
  sectionTitle: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' },
  bullet: { flexDirection: 'row', gap: 9 }, bulletMark: { color: '#C9B7FF', fontSize: 17 }, bulletText: { color: '#FFFFFF', flex: 1, fontSize: 13, lineHeight: 20 },
  footer: { flexDirection: 'row', gap: 9 }, secondaryButton: { minHeight: 48, borderWidth: 1, borderColor: '#55515F', borderRadius: 11, padding: 10, justifyContent: 'center', alignItems: 'center' },
  secondaryText: { color: '#FFFFFF', fontSize: 12, fontWeight: '700' }, primaryButton: { flex: 1, minHeight: 48, backgroundColor: '#C9B7FF', borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  primaryText: { color: '#272032', fontSize: 13, fontWeight: '800' }, disabled: { opacity: 0.5 }, error: { color: '#FFB4AB', fontSize: 13 },
  success: { color: '#BFE8CB', fontSize: 13, fontWeight: '700' },
  actionRow: { borderWidth: 1, borderColor: '#4A4655', backgroundColor: '#2E2B36', borderRadius: 11, padding: 10, flexDirection: 'row', gap: 9, alignItems: 'center', minHeight: 64 },
  actionIcon: { width: 34, height: 34, borderRadius: 8, backgroundColor: '#403954', justifyContent: 'center', alignItems: 'center' },
  actionCopy: { flex: 1, gap: 3 }, actionName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  actionDetail: { color: '#C7C2D0', fontSize: 12 }, reviewLink: { color: '#C9B7FF', fontSize: 12, fontWeight: '700' },
});
