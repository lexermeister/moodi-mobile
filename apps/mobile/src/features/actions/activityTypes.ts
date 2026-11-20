export type ActivityMention = { label: string; source_ids: string[] };

export type ActivityCandidate = {
  id: string;
  type: 'do_enjoyable_or_meaningful_activity';
  state: 'review_ready';
  actor: 'client';
  exact_task: string;
  assignment_kind: 'general' | 'specific';
  agreed_activity: string | null;
  activity_mentions: ActivityMention[];
  frequency: string | null;
  timing: string | null;
  reference_period: string | null;
  source_excerpt: string;
  source_ids: string[];
};

export type ActivitySettings = Pick<ActivityCandidate,
  'exact_task' | 'assignment_kind' | 'agreed_activity' | 'frequency' | 'timing' | 'reference_period'> & {
  reminder_time: string | null;
  reminder_time_zone: string | null;
};

export type ActivityAction = {
  id: string;
  type: 'do_enjoyable_or_meaningful_activity';
  state: 'active' | 'paused' | 'superseded';
  recording_id: string;
  transcript_version: string;
  candidate_id: string;
  source_ids: string[];
  source_excerpt: string;
  agreed_frequency: string | null;
  agreed_timing: string | null;
  agreed_reference_period: string | null;
  activity_mentions: ActivityMention[];
  settings: ActivitySettings;
  created_at: string;
  revision: number;
};

function object(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object';
}
function optionalText(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string');
}

export function isActivityCandidate(value: unknown): value is ActivityCandidate {
  return object(value) && typeof value.id === 'string' &&
    value.type === 'do_enjoyable_or_meaningful_activity' && value.state === 'review_ready' &&
    value.actor === 'client' && typeof value.exact_task === 'string' &&
    (value.assignment_kind === 'general' || value.assignment_kind === 'specific') &&
    optionalText(value.agreed_activity) &&
    (value.assignment_kind === 'specific' ? Boolean(value.agreed_activity) : value.agreed_activity === null) &&
    Array.isArray(value.activity_mentions) && value.activity_mentions.every(item =>
      object(item) && typeof item.label === 'string' && strings(item.source_ids)) &&
    optionalText(value.frequency) && optionalText(value.timing) && optionalText(value.reference_period) &&
    typeof value.source_excerpt === 'string' && strings(value.source_ids);
}

export function isActivityAction(value: unknown): value is ActivityAction {
  if (!object(value) || !object(value.settings)) return false;
  const settings = value.settings;
  return value.type === 'do_enjoyable_or_meaningful_activity' &&
    typeof value.id === 'string' && typeof value.recording_id === 'string' &&
    typeof value.candidate_id === 'string' && typeof value.transcript_version === 'string' &&
    ['active', 'paused', 'superseded'].includes(value.state as string) &&
    strings(value.source_ids) && typeof value.source_excerpt === 'string' &&
    optionalText(value.agreed_frequency) && optionalText(value.agreed_timing) &&
    optionalText(value.agreed_reference_period) &&
    Array.isArray(value.activity_mentions) && value.activity_mentions.every(item =>
      object(item) && typeof item.label === 'string' && strings(item.source_ids)) &&
    typeof value.created_at === 'string' && typeof value.revision === 'number' &&
    typeof settings.exact_task === 'string' &&
    (settings.assignment_kind === 'general' || settings.assignment_kind === 'specific') &&
    optionalText(settings.agreed_activity) && optionalText(settings.frequency) &&
    optionalText(settings.timing) && optionalText(settings.reference_period) &&
    optionalText(settings.reminder_time) && optionalText(settings.reminder_time_zone);
}
