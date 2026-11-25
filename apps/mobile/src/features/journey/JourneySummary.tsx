import { PracticeSetupCard } from '../actions/PracticeSetupCard';
import { practiceTitle } from '../actions/practiceFlowDomain';
import { PracticeIcon } from '@/ui/PracticeIcon';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { MoodiWave } from '@/ui/MoodiWave';
import { measurementLabels } from '../actions/moodSetup';
import { getPracticeCandidateResolution, confirmActionReviews, getActionReviewConfirmation, getActivityCandidateResolution, getRatingCandidateResolution, type ActionReviewConfirmation } from '../actions/actionsApi';
import { ActivitySetupCard, type ActivityReviewState } from '../actions/ActivitySetupCard';
import { RecordMoodSetupCard, type RecordMoodSessionState } from '../actions/RecordMoodSetupCard';
import type { RecordingMetadata } from '../recordings/recordingStorage';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { isProcessing, sessionDate, sessionProcessingMessage } from './sessionPresentation';
import { activityCandidates, reviewableActionCandidates, summaryReviewRequest } from './sessionReviewDomain';

type Step = 'review' | 'mood' | 'activity' | 'practice';

export function JourneySummary({ recording, onClose, onViewSource, initialActivityCandidateId }: { recording: RecordingMetadata; onClose: () => void; onViewSource?: () => void; initialActivityCandidateId?: string }) {
  const initialActivity = recording.sessionInsights?.result.action_candidates.some(candidate =>
    candidate.id === initialActivityCandidateId && candidate.type === 'do_enjoyable_or_meaningful_activity')
    ? activityCandidates(recording.sessionInsights)[0]?.id : undefined;
  const [step, setStep] = useState<Step>(initialActivity ? 'activity' : 'review');
  const [selectedId, setSelectedId] = useState<string | null>(initialActivity ?? null);
  const [actionStates, setActionStates] = useState<Record<string, RecordMoodSessionState | ActivityReviewState>>({});
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [loadedActionDraftId, setLoadedActionDraftId] = useState<string | null>(null);
  const [actionConfirmation, setActionConfirmation] = useState<ActionReviewConfirmation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const library = useSharedRecordingLibrary();
  const insights = recording.sessionInsights;
  const processing = recording.processingStatus === 'local' || isProcessing(recording);
  const processingFailed = recording.processingStatus === 'failed';
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
  const candidates = useMemo(() => reviewableActionCandidates(insights), [insights]);
  const intro = !insights ? 'Your session summary will appear here when it’s ready.'
    : candidates.length ? `Take a look at the summary. I pulled out ${candidates.length === 1 ? 'one action' : `${candidates.length} actions`} you agreed to try.`
      : 'Take a look at the summary. Review what we discussed.';
  const selected = candidates.find(candidate => candidate.id === selectedId);
  const reviewRequest = summaryReviewRequest(insights);
  const candidateKey = candidates.map(candidate => candidate.id).join('|');
  const legacyCandidateKey = insights?.result.action_candidates.map(candidate => candidate.id).join('|');
  const actionKey = (candidateId: string) => `${insights?.draft_id ?? 'no-draft'}:${candidateId}`;
  const loadingActions = Boolean(insights?.draft_id && loadedActionDraftId !== insights.draft_id);
  const confirmed = Boolean(actionConfirmation && actionConfirmation.draft_id === insights?.draft_id &&
    actionConfirmation.source_version === insights?.source_version &&
    [candidateKey, legacyCandidateKey].includes(actionConfirmation.candidate_ids.join('|')));
  const canConfirm = Boolean(review && recording.backendRecordingId && insights?.draft_id && insights?.source_version &&
    candidates.length > 0 && !loadingActions && !confirming && !confirmed &&
    candidates.every(candidate => ['active', 'linked_existing', 'not_added'].includes(actionStates[actionKey(candidate.id)])));
  const actionLabel = (candidateId: string) => {
    const state = actionStates[actionKey(candidateId)];
    if (state === 'not_added') return 'Rejected';
    if (confirmed) return 'Confirmed';
    return state === 'active' || state === 'linked_existing' ? 'Active' : 'Review';
  };

  useEffect(() => {
    const recordingId = recording.backendRecordingId;
    if (!recordingId || !insights?.draft_id) return;
    let cancelled = false;
    const currentCandidates = reviewableActionCandidates(insights);
    void Promise.all([
      getActionReviewConfirmation(recordingId),
      ...currentCandidates.map(candidate => candidate.type === 'record_mood'
        ? getRatingCandidateResolution(recordingId, candidate.id)
        : candidate.type === 'practise_relaxation_breathing' ? getPracticeCandidateResolution(recordingId, candidate.id)
        : getActivityCandidateResolution(recordingId, candidate.id)),
    ]).then(([confirmation, ...resolutions]) => {
      if (cancelled) return;
      setActionConfirmation(confirmation as ActionReviewConfirmation | null);
      setActionStates(current => {
        const next: Record<string, RecordMoodSessionState | ActivityReviewState> = {};
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
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not confirm these actions.');
    } finally { setConfirming(false); }
  }

  return <View style={styles.panel}>
    <Text style={styles.brand}>Moodi</Text>
    {step === 'review' && (processing || processingFailed) ? <View accessibilityLiveRegion="polite"
      style={[styles.statusCard, processingFailed && styles.failedStatusCard]}>
      {processing ? <ActivityIndicator accessibilityLabel="Processing session" color="#C9B7FF" size="small" /> : null}
      <View style={styles.statusCopy}>
        <Text style={styles.statusTitle}>{processingFailed ? 'Session processing stopped' : 'Preparing your session'}</Text>
        <Text style={styles.statusText}>{sessionProcessingMessage(recording)}</Text>
      </View>
      {processingFailed ? <Pressable accessibilityRole="button" accessibilityLabel="Retry session processing"
        disabled={library.isRecording || library.isBusy} onPress={() => library.generateInsights(recording)}
        style={[styles.retryButton, (library.isRecording || library.isBusy) && styles.disabled]}>
        <Text style={styles.retryText}>Retry</Text>
      </Pressable> : null}
    </View> : null}
    {step !== 'review' ? <Pressable accessibilityRole="button" onPress={() => setStep('review')} style={styles.back}>
      <Text style={styles.backText}>‹  Back</Text>
    </Pressable> : null}
    <ScrollView key={step} nestedScrollEnabled style={styles.scroll} contentContainerStyle={styles.content}>
      {step === 'review' ? <>
        <Text accessibilityRole="header" style={styles.title}>Here’s what I heard</Text>
        <Text style={styles.intro}>{intro}</Text>
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
        {insights ? <>
          <Pressable accessibilityRole="button" disabled={!reviewRequest || saving || Boolean(review)} onPress={() => void markReviewed()}
            style={[styles.secondaryButton, (!reviewRequest || saving || review) && styles.disabled]}>
            <Text style={styles.secondaryText}>{review ? 'Reviewed ✓' : saving ? 'Saving…' : 'Mark as reviewed ✓'}</Text>
          </Pressable>
          <Text accessibilityRole="header" style={styles.sectionTitle}>Actions to review</Text>
          <Text style={styles.body}>Open each action to check the plan, then activate or reject it.</Text>
          {insights.result.review_flags.some(flag => flag.code === 'missing_action_detail' &&
            flag.detail.startsWith('An activity action was omitted')) ?
            <Text accessibilityRole="alert" style={styles.body}>
              One possible activity action could not be linked to the transcript. Check the transcript if you expected it here.
            </Text> : null}
          {candidates.length ? candidates.map(candidate => <Pressable key={candidate.id} accessibilityRole="button"
            accessibilityLabel={`${candidate.type === 'record_mood' ? 'Record mood' : candidate.type === 'practise_relaxation_breathing' ? practiceTitle(candidate) : 'Do an enjoyable activity'}, ${actionLabel(candidate.id)}`}
            onPress={() => { setSelectedId(candidate.id); setStep(candidate.type === 'record_mood' ? 'mood' : candidate.type === 'practise_relaxation_breathing' ? 'practice' : 'activity'); }} style={styles.actionRow}>
            <View style={[styles.actionIcon, candidate.type === 'do_enjoyable_or_meaningful_activity' && styles.activityIcon]}>
              {candidate.type === 'record_mood' ? <MoodiWave width={20} /> : candidate.type === 'practise_relaxation_breathing' ? <PracticeIcon /> :
                <SymbolView name={{ ios: 'heart', android: 'favorite', web: 'favorite' }} size={22} tintColor="#7B4D73" />}
            </View>
            <View style={styles.actionCopy}><Text style={styles.actionName}>{candidate.type === 'record_mood' ? 'Record mood' : candidate.type === 'practise_relaxation_breathing' ? practiceTitle(candidate) : 'Do an enjoyable activity'}</Text>
              {candidate.type === 'record_mood' ? <Text style={styles.actionDetail}>
                {[candidate.frequency, candidate.timing, measurementLabels(candidate.what_to_record ?? ['mood'])].filter(Boolean).join(' · ')}
              </Text> : null}</View>
            <Text style={styles.reviewLink}>{actionLabel(candidate.id)} ›</Text>
          </Pressable>) : <Text style={styles.body}>No agreed action was identified in this session.</Text>}
          {confirmed ? <Text style={styles.success}>Action reviews confirmed ✓</Text> : null}
        </> : null}
      </> : selected?.type === 'record_mood' ? <RecordMoodSetupCard key={`${insights?.draft_id}:${selected.id}`} candidate={selected}
        recordingId={recording.backendRecordingId} draftId={insights?.draft_id} sourceVersion={insights?.source_version}
        onSessionStateChange={status => setActionStates(current => current[actionKey(selected.id)] === status ? current : { ...current, [actionKey(selected.id)]: status })}
        onResolved={() => { setSelectedId(null); setStep('review'); }} /> : selected?.type === 'practise_relaxation_breathing' ?
        <PracticeSetupCard key={`${insights?.draft_id}:${selected.id}`} candidate={selected}
          recordingId={recording.backendRecordingId} draftId={insights?.draft_id} sourceVersion={insights?.source_version}
          onViewSource={onViewSource}
          onStatusChange={status => setActionStates(current => current[actionKey(selected.id)] === status ? current : { ...current, [actionKey(selected.id)]: status })}
          onResolved={() => { setSelectedId(null); setStep('review'); }} /> : selected?.type === 'do_enjoyable_or_meaningful_activity' ?
        <ActivitySetupCard key={`${insights?.draft_id}:${selected.id}`} candidate={selected}
          recordingId={recording.backendRecordingId} draftId={insights?.draft_id} sourceVersion={insights?.source_version}
          onViewSource={onViewSource}
          onStatusChange={status => setActionStates(current => current[actionKey(selected.id)] === status ? current : { ...current, [actionKey(selected.id)]: status })}
          onResolved={() => { setSelectedId(null); setStep('review'); }} /> : null}
    </ScrollView>
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {step === 'review' && review && (canConfirm || confirmed || !candidates.length) ? <View style={styles.footer}>
      <Pressable accessibilityRole="button" disabled={confirming}
        onPress={() => confirmed || !candidates.length ? onClose() : void confirmActions()}
        style={[styles.primaryButton, confirming && styles.disabled]}>
        <Text style={styles.primaryText}>{confirming ? 'Confirming…' : confirmed || !candidates.length ? 'Done' : 'Confirm'}</Text>
      </Pressable>
    </View> : null}
  </View>;
}

const styles = StyleSheet.create({
  panel: { height: 430, borderRadius: 22, padding: 16, gap: 12, backgroundColor: '#24222B' },
  brand: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  statusCard: { minHeight: 62, borderRadius: 12, borderWidth: 1, borderColor: '#655A86',
    backgroundColor: '#383249', flexDirection: 'row', alignItems: 'center', gap: 12, padding: 11 },
  failedStatusCard: { borderColor: '#84575D', backgroundColor: '#3D3039' },
  statusCopy: { flex: 1, gap: 3 },
  statusTitle: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  statusText: { color: '#D4D0DD', fontSize: 12, lineHeight: 17 },
  retryButton: { minHeight: 36, borderRadius: 9, backgroundColor: '#C9B7FF', paddingHorizontal: 12,
    alignItems: 'center', justifyContent: 'center' },
  retryText: { color: '#272032', fontSize: 12, fontWeight: '800' },
  scroll: { flex: 1 },
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
  activityIcon: { backgroundColor: '#F6E9F1', borderRadius: 9 },
  actionCopy: { flex: 1, gap: 3 }, actionName: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  actionDetail: { color: '#C7C2D0', fontSize: 12 }, reviewLink: { color: '#C9B7FF', fontSize: 12, fontWeight: '700' },
});
