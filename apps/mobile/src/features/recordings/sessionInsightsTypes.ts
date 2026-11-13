import {
  isRecordRatingCandidate,
  type RecordRatingCandidate,
} from '../actions/actionTypes';

export type InsightVariant = 'P01' | 'P02' | 'P03';

export type InsightFact = {
  id: string;
  kind:
    | 'topic'
    | 'client_report'
    | 'therapist_statement'
    | 'practice'
    | 'response'
    | 'goal'
    | 'decision'
    | 'open_question'
    | 'prior_record';
  text: string;
  source_ids: string[];
};

export type InsightBullet = {
  item_id?: string;
  text: string;
  fact_ids: string[];
  candidate_ids: string[];
  module:
    | 'practice_details'
    | 'progress_and_barriers'
    | 'ideas_not_agreed'
    | 'details_to_clarify'
    | 'coverage'
    | null;
};

export type InsightSection = {
  key:
    | 'today_focus'
    | 'key_takeaways'
    | 'explored_practised'
    | 'agreements'
    | 'additional_topics'
    | 'next_time';
  heading: string;
  bullets: InsightBullet[];
};

export type InsightReviewFlag = {
  code:
    | 'source_gap'
    | 'unclear_speaker'
    | 'ambiguous_agreement'
    | 'missing_action_detail'
    | 'conflicting_source'
    | 'unsupported_session_type'
    | 'safety_sensitive_content';
  detail: string;
  source_ids: string[];
  candidate_ids: string[];
};

export type SessionInsightsResult = {
  session_id: string;
  source_version: string;
  status: 'draft' | 'insufficient_source';
  coverage_note: string | null;
  primary_variant: InsightVariant | null;
  secondary_variant: InsightVariant | null;
  selection_note: string | null;
  facts: InsightFact[];
  action_candidates: RecordRatingCandidate[];
  sections: InsightSection[];
  review_flags: InsightReviewFlag[];
};

export type SessionInsightsResponse = {
  recording_id: string;
  draft_id?: string;
  source_version: string;
  prompt_version: string;
  model: string;
  generated_at: string;
  result: SessionInsightsResult;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isFact(value: unknown): value is InsightFact {
  if (!isObject(value)) return false;
  const kinds = [
    'topic',
    'client_report',
    'therapist_statement',
    'practice',
    'response',
    'goal',
    'decision',
    'open_question',
    'prior_record',
  ];
  return (
    typeof value.id === 'string' &&
    typeof value.kind === 'string' &&
    kinds.includes(value.kind) &&
    typeof value.text === 'string' &&
    isStringArray(value.source_ids)
  );
}

function isBullet(value: unknown): value is InsightBullet {
  if (!isObject(value)) return false;
  const modules = [
    'practice_details',
    'progress_and_barriers',
    'ideas_not_agreed',
    'details_to_clarify',
    'coverage',
  ];
  return (
    (value.item_id === undefined || typeof value.item_id === 'string') &&
    typeof value.text === 'string' &&
    isStringArray(value.fact_ids) &&
    isStringArray(value.candidate_ids) &&
    (value.module === null || (typeof value.module === 'string' && modules.includes(value.module)))
  );
}

function isSection(value: unknown): value is InsightSection {
  if (!isObject(value)) return false;
  const keys = [
    'today_focus',
    'key_takeaways',
    'explored_practised',
    'agreements',
    'additional_topics',
    'next_time',
  ];
  return (
    typeof value.key === 'string' &&
    keys.includes(value.key) &&
    typeof value.heading === 'string' &&
    Array.isArray(value.bullets) &&
    value.bullets.every(isBullet)
  );
}

function isReviewFlag(value: unknown): value is InsightReviewFlag {
  if (!isObject(value)) return false;
  const codes = [
    'source_gap',
    'unclear_speaker',
    'ambiguous_agreement',
    'missing_action_detail',
    'conflicting_source',
    'unsupported_session_type',
    'safety_sensitive_content',
  ];
  return (
    typeof value.code === 'string' &&
    codes.includes(value.code) &&
    typeof value.detail === 'string' &&
    isStringArray(value.source_ids) &&
    isStringArray(value.candidate_ids)
  );
}

function isResult(value: unknown): value is SessionInsightsResult {
  if (!isObject(value)) return false;
  const variants = ['P01', 'P02', 'P03'];
  return (
    typeof value.session_id === 'string' &&
    typeof value.source_version === 'string' &&
    (value.status === 'draft' || value.status === 'insufficient_source') &&
    isNullableString(value.coverage_note) &&
    (value.primary_variant === null || variants.includes(value.primary_variant as string)) &&
    (value.secondary_variant === null || variants.includes(value.secondary_variant as string)) &&
    isNullableString(value.selection_note) &&
    Array.isArray(value.facts) &&
    value.facts.every(isFact) &&
    Array.isArray(value.action_candidates) &&
    value.action_candidates.every(isRecordRatingCandidate) &&
    Array.isArray(value.sections) &&
    value.sections.every(isSection) &&
    Array.isArray(value.review_flags) &&
    value.review_flags.every(isReviewFlag)
  );
}

export function isSessionInsightsResponse(value: unknown): value is SessionInsightsResponse {
  if (!isObject(value)) return false;
  return (
    typeof value.recording_id === 'string' &&
    (value.draft_id === undefined || typeof value.draft_id === 'string') &&
    typeof value.source_version === 'string' &&
    typeof value.prompt_version === 'string' &&
    typeof value.model === 'string' &&
    typeof value.generated_at === 'string' &&
    isResult(value.result)
  );
}
