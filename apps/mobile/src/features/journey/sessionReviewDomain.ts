import type { PracticeCandidate } from '../actions/practiceTypes';
import type { RecordRatingCandidate } from '../actions/actionTypes';
import type { ActivityCandidate } from '../actions/activityTypes';
import type { SessionInsightsReviewRequest } from '../recordings/sessionInsightsReviewTypes';
import type { SessionInsightsResponse } from '../recordings/sessionInsightsTypes';

export function recordMoodCandidates(insights?: SessionInsightsResponse): RecordRatingCandidate[] {
  return (insights?.result.action_candidates ?? [])
    .filter((candidate): candidate is RecordRatingCandidate => candidate.type === 'record_mood');
}

export function activityCandidates(insights?: SessionInsightsResponse): ActivityCandidate[] {
  const first = (insights?.result.action_candidates ?? [])
    .find((candidate): candidate is ActivityCandidate => candidate.type === 'do_enjoyable_or_meaningful_activity');
  return first ? [first] : [];
}

export function reviewableActionCandidates(insights?: SessionInsightsResponse) {
  let hasActivity = false;
  return (insights?.result.action_candidates ?? [])
    .filter((candidate): candidate is RecordRatingCandidate | ActivityCandidate | PracticeCandidate => {
      if (candidate.type === 'record_mood' || candidate.type === 'practise_relaxation_breathing') return true;
      if (candidate.type !== 'do_enjoyable_or_meaningful_activity' || hasActivity) return false;
      hasActivity = true;
      return true;
    });
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
