export type RatingMetric = 'mood' | 'motivation' | 'sleep_quality';
export type RatingConstruct = 'overall_day_mood' | 'daily_motivation' | 'sleep_quality';

export type RatingScaleDefinition = {
  id: string;
  construct: RatingConstruct;
  minimum: 0;
  maximum: 10;
  minimum_label: string;
  maximum_label: string;
  direction: 'low_to_high';
  version: string;
};

export type RecordRatingConfiguration = {
  input_kind: 'numeric_0_10' | 'label';
  context_enabled: boolean;
  scale: RatingScaleDefinition | null;
  scale_origin: 'session' | 'moodi_default' | null;
};

export type MoodMeasurement = 'mood' | 'energy' | 'sleep_quality' | 'motivation';
export type MoodCadence = 'daily' | 'weekdays' | 'weekly';

export type RecordRatingCandidate = {
  what_to_record?: MoodMeasurement[];
  id: string;
  type: 'record_mood';
  state: 'review_ready';
  actor: 'client';
  exact_task: string;
  source_excerpt: string;
  frequency: string | null;
  timing: string | null;
  reference_period: string | null;
  start_date: string | null;
  end_date: string | null;
  duration_days: 14;
  configuration: RecordRatingConfiguration | null;
  unknowns: string[];
  source_ids: string[];
};

// Keep older on-device session summaries readable without activating obsolete actions.
export type LegacyRatingCandidate = Omit<RecordRatingCandidate, 'type' | 'what_to_record'> & {
  type: 'record_rating';
  metric: RatingMetric;
};

export type RecordRatingActionSettings = {
  what_to_record: MoodMeasurement[];
  exact_task: string;
  frequency: string;
  timing: string | null;
  reference_period: string;
  start_date: string | null;
  end_date: string | null;
  duration_kind: 'fixed' | 'ongoing' | 'unscheduled';
  duration_days: number | null;
  preferred_check_in_time: string | null;
  preferred_time_zone: string | null;
  schedule_origin: 'moodi_default' | 'user_selected';
  cadence?: MoodCadence | null;
  weekly_weekday?: number | null;
  configuration: RecordRatingConfiguration;
};

export type RatingAction = {
  id: string;
  type: 'record_mood';
  state: 'active' | 'paused' | 'superseded';
  recording_id: string;
  transcript_version: string;
  candidate_id: string;
  source_ids: string[];
  source_excerpt: string;
  settings: RecordRatingActionSettings;
  created_at: string;
  revision: number;
};

export type RatingCandidateReviewDisposition = 'activated' | 'linked_existing' | 'rejected';

export type RatingCandidateReviewResult = {
  disposition: RatingCandidateReviewDisposition;
  action: RatingAction | null;
};

export type RatingCandidateResolutionStatus =
  | 'needs_setup'
  | 'already_active'
  | 'activated'
  | 'linked_existing'
  | 'rejected'
  | 'conflict';

export type RatingCandidateResolution = {
  recording_id: string;
  candidate_id: string;
  draft_id: string;
  source_version: string;
  status: RatingCandidateResolutionStatus;
  action: RatingAction | null;
  reason: 'incompatible_ongoing_action' | null;
};

export type RatingEntryValues = {
  energy_value?: number | null;
  sleep_quality_value?: number | null;
  motivation_value?: number | null;
  feelings?: ('Calm' | 'Tired' | 'Relieved' | 'Anxious')[];
  custom_feeling?: string | null;
  feeling_intensity?: number | null;
  current_step?: 'mood' | 'additional_ratings' | 'feelings' | 'intensity' | 'context' | 'thoughts' | 'actions_taken' | 'review';
  relevant_date: string;
  entry_time: string;
  timezone_offset_minutes: number;
  day_key: string;
  mood_value: number | null;
  mood_label: string | null;
  context: string | null;
  thoughts?: string | null;
  actions_taken?: string | null;
  scale_id: string | null;
};

export type RatingEntryRevision = {
  revision: number;
  values: RatingEntryValues;
  status: 'draft' | 'confirmed';
  changed_at: string;
};

export type RatingEntry = {
  id: string;
  action_id: string;
  status: 'draft' | 'confirmed';
  values: RatingEntryValues;
  revision: number;
  revision_history: RatingEntryRevision[];
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  confirmed_at: string | null;
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

export function isMoodMeasurements(value: unknown): value is MoodMeasurement[] {
  return Array.isArray(value) && value.includes('mood') &&
    new Set(value).size === value.length &&
    value.every(item => ['mood', 'energy', 'sleep_quality', 'motivation'].includes(item));
}

export function isRecordRatingConfiguration(value: unknown): value is RecordRatingConfiguration {
  if (!isObject(value)) return false;
  const scale = value.scale;
  return (
    (value.input_kind === 'numeric_0_10' || value.input_kind === 'label') &&
    typeof value.context_enabled === 'boolean' &&
    (value.scale_origin === 'session' ||
      value.scale_origin === 'moodi_default' ||
      value.scale_origin === null) &&
    (scale === null ||
      (isObject(scale) &&
        typeof scale.id === 'string' &&
        (scale.construct === 'overall_day_mood' ||
          scale.construct === 'daily_motivation' ||
          scale.construct === 'sleep_quality') &&
        scale.minimum === 0 &&
        scale.maximum === 10 &&
        typeof scale.minimum_label === 'string' &&
        typeof scale.maximum_label === 'string' &&
        scale.direction === 'low_to_high' &&
        typeof scale.version === 'string'))
  );
}

export function isRecordRatingCandidate(value: unknown): value is RecordRatingCandidate {
  if (!isObject(value)) return false;
  const configuration = value.configuration;
  const scale = isObject(configuration) && isObject(configuration.scale)
    ? configuration.scale
    : null;
  return (
    typeof value.id === 'string' &&
    value.type === 'record_mood' &&
    value.state === 'review_ready' &&
    value.actor === 'client' &&
    (value.what_to_record === undefined || isMoodMeasurements(value.what_to_record)) &&
    typeof value.exact_task === 'string' &&
    typeof value.source_excerpt === 'string' &&
    isNullableString(value.frequency) &&
    isNullableString(value.timing) &&
    isNullableString(value.reference_period) &&
    isNullableString(value.start_date) &&
    isNullableString(value.end_date) &&
    value.duration_days === 14 &&
    (configuration === null || isRecordRatingConfiguration(configuration)) &&
    (scale === null ||
      scale.construct === 'overall_day_mood') &&
    isStringArray(value.unknowns) &&
    isStringArray(value.source_ids)
  );
}

export function isLegacyRatingCandidate(value: unknown): value is LegacyRatingCandidate {
  if (!isObject(value) || value.type !== 'record_rating') return false;
  return ['mood', 'motivation', 'sleep_quality'].includes(value.metric as string) &&
    (value.configuration === null || isRecordRatingConfiguration(value.configuration)) &&
    isRecordRatingCandidate({ ...value, type: 'record_mood', configuration: null });
}

function isRatingActionSettings(value: unknown): value is RecordRatingActionSettings {
  if (!isObject(value)) return false;
  const durationIsValid =
    (value.duration_kind === 'fixed' &&
      typeof value.duration_days === 'number' &&
      Number.isInteger(value.duration_days) &&
      value.duration_days >= 1 &&
      value.duration_days <= 365) ||
    ((value.duration_kind === 'ongoing' || value.duration_kind === 'unscheduled') &&
      value.duration_days === null &&
      value.end_date === null);
  const preferredTimeIsValid =
    (value.preferred_check_in_time === null && value.preferred_time_zone === null) ||
    (typeof value.preferred_check_in_time === 'string' &&
      /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value.preferred_check_in_time) &&
      typeof value.preferred_time_zone === 'string');
  return (
    typeof value.exact_task === 'string' &&
    typeof value.frequency === 'string' &&
    isNullableString(value.timing) &&
    typeof value.reference_period === 'string' &&
    isNullableString(value.start_date) &&
    isNullableString(value.end_date) &&
    durationIsValid &&
    preferredTimeIsValid &&
    (value.cadence === undefined || value.cadence === null || ['daily', 'weekdays', 'weekly'].includes(value.cadence as string)) &&
    (value.weekly_weekday === undefined || value.weekly_weekday === null || (Number.isInteger(value.weekly_weekday) && Number(value.weekly_weekday) >= 0 && Number(value.weekly_weekday) <= 6)) &&
    (value.cadence === undefined || value.cadence === null ||
      (value.duration_kind !== 'unscheduled' && value.preferred_check_in_time !== null &&
        (value.cadence === 'weekly' ? Number.isInteger(value.weekly_weekday) : value.weekly_weekday == null))) &&
    (value.schedule_origin === 'moodi_default' || value.schedule_origin === 'user_selected') &&
    isRecordRatingConfiguration(value.configuration) &&
    isMoodMeasurements(value.what_to_record)
  );
}

export function isRatingAction(value: unknown): value is RatingAction {
  const settings = isObject(value) ? value.settings : null;
  const configuration = isObject(settings) ? settings.configuration : null;
  const scale = isObject(configuration) && isObject(configuration.scale)
    ? configuration.scale
    : null;
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    value.type === 'record_mood' &&
    ['active', 'paused', 'superseded'].includes(value.state as string) &&
    typeof value.recording_id === 'string' &&
    typeof value.transcript_version === 'string' &&
    typeof value.candidate_id === 'string' &&
    isStringArray(value.source_ids) &&
    typeof value.source_excerpt === 'string' &&
    isRatingActionSettings(settings) &&
    (scale === null ||
      scale.construct === 'overall_day_mood') &&
    typeof value.created_at === 'string' &&
    typeof value.revision === 'number'
  );
}

export function isRatingCandidateResolution(value: unknown): value is RatingCandidateResolution {
  if (!isObject(value)) return false;
  const status = value.status;
  const action = value.action;
  const actionRequired = [
    'already_active',
    'activated',
    'linked_existing',
    'conflict',
  ].includes(status as string);
  return (
    typeof value.recording_id === 'string' &&
    typeof value.candidate_id === 'string' &&
    typeof value.draft_id === 'string' &&
    typeof value.source_version === 'string' &&
    [
      'needs_setup',
      'already_active',
      'activated',
      'linked_existing',
      'rejected',
      'conflict',
    ].includes(status as string) &&
    (actionRequired ? isRatingAction(action) : action === null) &&
    (value.reason === null || value.reason === 'incompatible_ongoing_action')
  );
}

function isRatingEntryValues(value: unknown): value is RatingEntryValues {
  return (
    isObject(value) &&
    typeof value.relevant_date === 'string' &&
    typeof value.entry_time === 'string' &&
    typeof value.timezone_offset_minutes === 'number' &&
    typeof value.day_key === 'string' &&
    (value.mood_value === null || typeof value.mood_value === 'number') &&
    isNullableString(value.mood_label) &&
    isNullableString(value.context) &&
    (value.thoughts === undefined || isNullableString(value.thoughts)) &&
    (value.actions_taken === undefined || isNullableString(value.actions_taken)) &&
    isNullableString(value.scale_id)
  );
}

export function isRatingEntry(value: unknown): value is RatingEntry {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.action_id === 'string' &&
    (value.status === 'draft' || value.status === 'confirmed') &&
    isRatingEntryValues(value.values) &&
    typeof value.revision === 'number' &&
    Array.isArray(value.revision_history) &&
    isNullableString(value.idempotency_key) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    isNullableString(value.confirmed_at)
  );
}
