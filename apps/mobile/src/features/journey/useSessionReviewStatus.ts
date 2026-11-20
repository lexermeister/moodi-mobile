import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { getActionReviewConfirmation, type ActionReviewConfirmation } from '../actions/actionsApi';
import type { RecordingMetadata } from '../recordings/recordingStorage';
import { isProcessing } from './sessionPresentation';
import { reviewableActionCandidates, summaryReviewRequest } from './sessionReviewDomain';

function needsReview(recording: RecordingMetadata | undefined, confirmation: ActionReviewConfirmation | null | undefined): boolean | null {
  if (!recording || isProcessing(recording) || recording.processingStatus === 'failed') return false;
  const insights = recording.sessionInsights;
  if (!summaryReviewRequest(insights)) return false;
  const summaryReviewed = recording.sessionInsightsReview?.draft_id === insights?.draft_id &&
    recording.sessionInsightsReview?.source_version === insights?.source_version;
  if (!summaryReviewed) return true;
  const candidateIds = reviewableActionCandidates(insights).map(candidate => candidate.id);
  if (!candidateIds.length) return false;
  if (confirmation === undefined) return null;
  return !confirmation || confirmation.draft_id !== insights?.draft_id ||
    confirmation.source_version !== insights?.source_version ||
    confirmation.candidate_ids.join('|') !== candidateIds.join('|');
}

export function useSessionReviewStatus(recording: RecordingMetadata | undefined) {
  const insights = recording?.sessionInsights;
  const summaryReviewed = recording?.sessionInsightsReview?.draft_id === insights?.draft_id &&
    recording?.sessionInsightsReview?.source_version === insights?.source_version;
  const needsConfirmation = Boolean(recording && summaryReviewed && reviewableActionCandidates(insights).length && summaryReviewRequest(insights));
  const recordingId = recording?.backendRecordingId;
  const key = `${recordingId ?? ''}:${insights?.draft_id ?? ''}:${insights?.source_version ?? ''}`;
  const [checked, setChecked] = useState<{ key: string; confirmation: ActionReviewConfirmation | null } | null>(null);
  const [retry, setRetry] = useState(0);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    void retry;
    if (!needsConfirmation || !recordingId) return;
    let active = true;
    setChecked(null);
    setFailedKey(null);
    void getActionReviewConfirmation(recordingId).then(confirmation => {
      if (active) setChecked({ key, confirmation });
    }).catch(() => { if (active) setFailedKey(key); });
    return () => { active = false; };
  }, [key, needsConfirmation, recordingId, retry]));

  const error = needsConfirmation && failedKey === key;
  const confirmation = checked?.key === key && !error ? checked.confirmation : undefined;
  return { needsReview: needsReview(recording, confirmation), error,
    retry: () => setRetry(value => value + 1) };
}
