import assert from 'node:assert/strict';
import test from 'node:test';
import { isMoodMeasurements, isRecordRatingCandidate, isLegacyRatingCandidate, isRatingAction, isRatingEntry } from '../src/features/actions/actionTypes.ts';
import { moodSettingsFromCandidate, toggleMeasurement } from '../src/features/actions/moodSetup.ts';

const candidate = {
  id: 'C1', type: 'record_mood', actor: 'client', state: 'review_ready',
  what_to_record: ['mood', 'energy', 'motivation'], exact_task: 'Record mood and motivation',
  source_excerpt: 'I will record them', source_ids: ['S1'], unknowns: [],
  frequency: 'as needed', timing: null, reference_period: 'whole day',
  start_date: null, end_date: null, duration_days: 14,
  configuration: { input_kind: 'numeric_0_10', context_enabled: true, scale_origin: 'moodi_default',
    scale: { id: 'overall-day-mood-0-10-v1', construct: 'overall_day_mood', minimum: 0,
      maximum: 10, minimum_label: 'worst', maximum_label: 'best', direction: 'low_to_high', version: '1' } },
};

test('accepts combined backend candidates and legacy mood candidates without selection', () => {
  assert.equal(isRecordRatingCandidate(candidate), true);
  const { what_to_record, ...legacy } = candidate;
  assert.equal(isRecordRatingCandidate(legacy), true);
  assert.equal(isRecordRatingCandidate({ ...candidate, type: 'record_rating' }), false);
  assert.equal(isLegacyRatingCandidate({ ...candidate, type: 'record_rating', metric: 'mood' }), true);
  assert.equal(isRecordRatingCandidate({ ...candidate, what_to_record: ['mood', 'stress'] }), false);
});

test('selection keeps Mood and toggles optional measurements without duplicates', () => {
  let selection = ['mood', 'energy'];
  selection = toggleMeasurement(selection, 'mood');
  assert.deepEqual(selection, ['mood', 'energy']);
  selection = toggleMeasurement(selection, 'energy');
  selection = toggleMeasurement(selection, 'motivation');
  assert.deepEqual(selection, ['mood', 'motivation']);
  assert.equal(isMoodMeasurements(selection), true);
  assert.equal(isMoodMeasurements(['energy']), false);
  assert.equal(isMoodMeasurements(['mood', 'mood']), false);
});

test('setup preserves reviewed measurements and creates no schedule or expiry', () => {
  const settings = moodSettingsFromCandidate(candidate, ['mood', 'motivation']);
  assert.deepEqual(settings.what_to_record, ['mood', 'motivation']);
  assert.equal(settings.duration_kind, 'unscheduled');
  for (const key of ['start_date', 'end_date', 'duration_days', 'preferred_check_in_time', 'preferred_time_zone']) {
    assert.equal(settings[key], null);
  }
  const action = { id: 'a1', type: 'record_mood', state: 'active', recording_id: 'r1',
    transcript_version: 'v1', candidate_id: 'C1', source_ids: ['S1'], source_excerpt: 'I will record them',
    settings, created_at: '2026-11-16T10:00:00Z', revision: 1 };
  assert.equal(isRatingAction(action), true);
  assert.equal(moodSettingsFromCandidate({ ...candidate, configuration: null }, ['mood']), null);
});

test('entry parser accepts backend mood values including zero', () => {
  const entry = { id: 'e1', action_id: 'a1', status: 'confirmed', revision: 1,
    revision_history: [], idempotency_key: 'confirm-e1', created_at: 'now', updated_at: 'now', confirmed_at: 'now',
    values: { relevant_date: '2026-11-16', entry_time: '2026-11-16T10:00:00Z', timezone_offset_minutes: 0,
      day_key: '2026-11-16', mood_value: 0, mood_label: null, context: null, scale_id: 'overall-day-mood-0-10-v1' } };
  assert.equal(isRatingEntry(entry), true);
  assert.equal(isRatingEntry({ ...entry, values: { ...entry.values, mood_value: undefined } }), false);
});
