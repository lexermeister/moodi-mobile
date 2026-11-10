import type { InsightSection } from './sessionInsightsTypes';

export type ReviewDisposition = 'retained' | 'edited' | 'removed';
export type ReviewProvenance = 'source_backed' | 'client_edited';

export type InsightReviewItemRequest = {
  item_id: string;
  disposition: ReviewDisposition;
  displayed_text: string | null;
};

export type SessionInsightsReviewRequest = {
  draft_id: string;
  source_version: string;
  items: InsightReviewItemRequest[];
};

export type ReviewedInsightItem = InsightReviewItemRequest & {
  original_text: string;
  provenance: ReviewProvenance;
};

export type ReviewedInsightSection = {
  key: InsightSection['key'];
  heading: string;
  items: ReviewedInsightItem[];
};

export type SessionInsightsReviewResponse = {
  recording_id: string;
  draft_id: string;
  source_version: string;
  status: 'reviewed';
  reviewed_at: string;
  sections: ReviewedInsightSection[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function isReviewedItem(value: unknown): value is ReviewedInsightItem {
  if (!isObject(value)) return false;
  return (
    typeof value.item_id === 'string' &&
    ['retained', 'edited', 'removed'].includes(value.disposition as string) &&
    isNullableString(value.displayed_text) &&
    typeof value.original_text === 'string' &&
    ['source_backed', 'client_edited'].includes(value.provenance as string)
  );
}

function isReviewedSection(value: unknown): value is ReviewedInsightSection {
  if (!isObject(value)) return false;
  const sectionKeys = [
    'today_focus',
    'key_takeaways',
    'explored_practised',
    'agreements',
    'additional_topics',
    'next_time',
  ];
  return (
    typeof value.key === 'string' &&
    sectionKeys.includes(value.key) &&
    typeof value.heading === 'string' &&
    Array.isArray(value.items) &&
    value.items.every(isReviewedItem)
  );
}

export function isSessionInsightsReviewResponse(
  value: unknown,
): value is SessionInsightsReviewResponse {
  if (!isObject(value)) return false;
  return (
    typeof value.recording_id === 'string' &&
    typeof value.draft_id === 'string' &&
    typeof value.source_version === 'string' &&
    value.status === 'reviewed' &&
    typeof value.reviewed_at === 'string' &&
    Array.isArray(value.sections) &&
    value.sections.every(isReviewedSection)
  );
}
