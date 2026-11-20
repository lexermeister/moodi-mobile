import type { RecordRatingCandidate } from '../actions/actionTypes';
import type { ActivityCandidate } from '../actions/activityTypes';
import type { SessionInsightsReviewRequest } from '../recordings/sessionInsightsReviewTypes';
import type { SessionInsightsResponse } from '../recordings/sessionInsightsTypes';

export function recordMoodCandidates(insights?: SessionInsightsResponse): RecordRatingCandidate[] {
  return (insights?.result.action_candidates ?? [])
    .filter((candidate): candidate is RecordRatingCandidate => candidate.type === 'record_mood');
}

export function activityCandidates(insights?: SessionInsightsResponse): ActivityCandidate[] {
  return (insights?.result.action_candidates ?? [])
    .filter((candidate): candidate is ActivityCandidate => candidate.type === 'do_enjoyable_or_meaningful_activity');
}

export function reviewableActionCandidates(insights?: SessionInsightsResponse) {
  return (insights?.result.action_candidates ?? [])
    .filter((candidate): candidate is RecordRatingCandidate | ActivityCandidate =>
      candidate.type === 'record_mood' || candidate.type === 'do_enjoyable_or_meaningful_activity');
}

export function summaryReviewRequest(insights?: SessionInsightsResponse): SessionInsightsReviewRequest | null {
  if (!insights?.draft_id || insights.result.status !== 'draft') return null;
  const bullets = insights.result.sections.flatMap(section => section.bullets);
  if (!bullets.length || bullets.some(bullet => !bullet.item_id)) return null;
  return {
    draft_id: insights.draft_id,
    source_version: insights.source_version,
    items: bullets.map(bullet => ({
      item_id: bullet.item_id!, disposition: 'retained', displayed_text: bullet.text,
    })),
  };
}
