export type MoodScaleDefinition = {
  id: string;
  construct: 'overall_day_mood';
  minimum: 0;
  maximum: 10;
  minimum_label: string;
  maximum_label: string;
  direction: 'low_to_high';
  version: string;
};

export type RecordMoodConfiguration = {
  input_kind: 'numeric_0_10' | 'label';
  context_enabled: boolean;
  scale: MoodScaleDefinition | null;
  scale_origin: 'session' | 'moodi_default' | null;
};

export type RecordMoodCandidate = {
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
  configuration: RecordMoodConfiguration | null;
  unknowns: string[];
  source_ids: string[];
};

export type RecordMoodActionSettings = {
  exact_task: string;
  frequency: string;
  timing: string | null;
  reference_period: string;
  start_date: string | null;
  end_date: string | null;
  duration_days: 14;
  configuration: RecordMoodConfiguration;
};

export type MoodAction = {
  id: string;
  type: 'record_mood';
  state: 'active' | 'paused' | 'superseded';
  recording_id: string;
  transcript_version: string;
  candidate_id: string;
  source_ids: string[];
  source_excerpt: string;
  settings: RecordMoodActionSettings;
  created_at: string;
  revision: number;
};

export type MoodEntryValues = {
  relevant_date: string;
  entry_time: string;
  timezone_offset_minutes: number;
  day_key: string;
  mood_value: number | null;
  mood_label: string | null;
  context: string | null;
  scale_id: string | null;
};

export type MoodEntryRevision = {
  revision: number;
  values: MoodEntryValues;
  status: 'draft' | 'confirmed';
  changed_at: string;
};

export type MoodEntry = {
  id: string;
  action_id: string;
  status: 'draft' | 'confirmed';
  values: MoodEntryValues;
  revision: number;
  revision_history: MoodEntryRevision[];
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

export function isRecordMoodConfiguration(value: unknown): value is RecordMoodConfiguration {
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
        scale.construct === 'overall_day_mood' &&
        scale.minimum === 0 &&
        scale.maximum === 10 &&
        typeof scale.minimum_label === 'string' &&
        typeof scale.maximum_label === 'string' &&
        scale.direction === 'low_to_high' &&
        typeof scale.version === 'string'))
  );
}

export function isRecordMoodCandidate(value: unknown): value is RecordMoodCandidate {
  if (!isObject(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.type === 'record_mood' &&
    value.state === 'review_ready' &&
    value.actor === 'client' &&
    typeof value.exact_task === 'string' &&
    typeof value.source_excerpt === 'string' &&
    isNullableString(value.frequency) &&
    isNullableString(value.timing) &&
    isNullableString(value.reference_period) &&
    isNullableString(value.start_date) &&
    isNullableString(value.end_date) &&
    value.duration_days === 14 &&
    (value.configuration === null || isRecordMoodConfiguration(value.configuration)) &&
    isStringArray(value.unknowns) &&
    isStringArray(value.source_ids)
  );
}

function isMoodActionSettings(value: unknown): value is RecordMoodActionSettings {
  return (
    isObject(value) &&
    typeof value.exact_task === 'string' &&
    typeof value.frequency === 'string' &&
    isNullableString(value.timing) &&
    typeof value.reference_period === 'string' &&
    isNullableString(value.start_date) &&
    isNullableString(value.end_date) &&
    value.duration_days === 14 &&
    isRecordMoodConfiguration(value.configuration)
  );
}

export function isMoodAction(value: unknown): value is MoodAction {
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
    isMoodActionSettings(value.settings) &&
    typeof value.created_at === 'string' &&
    typeof value.revision === 'number'
  );
}

function isMoodEntryValues(value: unknown): value is MoodEntryValues {
  return (
    isObject(value) &&
    typeof value.relevant_date === 'string' &&
    typeof value.entry_time === 'string' &&
    typeof value.timezone_offset_minutes === 'number' &&
    typeof value.day_key === 'string' &&
    (value.mood_value === null || typeof value.mood_value === 'number') &&
    isNullableString(value.mood_label) &&
    isNullableString(value.context) &&
    isNullableString(value.scale_id)
  );
}

export function isMoodEntry(value: unknown): value is MoodEntry {
  return (
    isObject(value) &&
    typeof value.id === 'string' &&
    typeof value.action_id === 'string' &&
    (value.status === 'draft' || value.status === 'confirmed') &&
    isMoodEntryValues(value.values) &&
    typeof value.revision === 'number' &&
    Array.isArray(value.revision_history) &&
    isNullableString(value.idempotency_key) &&
    typeof value.created_at === 'string' &&
    typeof value.updated_at === 'string' &&
    isNullableString(value.confirmed_at)
  );
}
