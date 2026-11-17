import assert from 'node:assert/strict';
import test from 'node:test';
import { isMoodMeasurements, isRecordRatingCandidate, isLegacyRatingCandidate, isRatingAction, isRatingEntry } from '../src/features/actions/actionTypes.ts';
import { initialReminderTime, moodSettingsFromCandidate, toggleMeasurement } from '../src/features/actions/moodSetup.ts';
import { hasConfirmedMoodForToday, isMoodActionDue } from '../src/features/actions/moodSchedule.ts';

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

test('review defaults to 8 PM while keeping an exact time heard in the session', () => {
  assert.equal(initialReminderTime(null), '20:00');
  assert.equal(initialReminderTime('around eight in the evening'), '20:00');
  assert.equal(initialReminderTime('9:30 PM'), '21:30');
});

test('setup saves reviewed measurements and exact weekly schedule without expiry', () => {
  const schedule = { cadence: 'weekly', time: '20:00', weeklyWeekday: 1, timeZone: 'Europe/Belgrade' };
  const settings = moodSettingsFromCandidate(candidate, ['mood', 'motivation'], schedule);
  assert.deepEqual(settings.what_to_record, ['mood', 'motivation']);
  assert.equal(settings.duration_kind, 'ongoing');
  for (const key of ['start_date', 'end_date', 'duration_days']) {
    assert.equal(settings[key], null);
  }
  assert.equal(settings.cadence, 'weekly');
  assert.equal(settings.weekly_weekday, 1);
  assert.equal(settings.preferred_check_in_time, '20:00');
  assert.equal(settings.preferred_time_zone, 'Europe/Belgrade');
  const action = { id: 'a1', type: 'record_mood', state: 'active', recording_id: 'r1',
    transcript_version: 'v1', candidate_id: 'C1', source_ids: ['S1'], source_excerpt: 'I will record them',
    settings, created_at: '2026-11-16T10:00:00Z', revision: 1 };
  assert.equal(isRatingAction(action), true);
  assert.equal(moodSettingsFromCandidate({ ...candidate, configuration: null }, ['mood'], schedule), null);
  assert.equal(moodSettingsFromCandidate(candidate, ['mood'], { ...schedule, time: '8 pm' }), null);
  assert.equal(moodSettingsFromCandidate(candidate, ['mood'], { ...schedule, weeklyWeekday: null }), null);
  assert.equal(isMoodActionDue(action, new Date('2026-11-17T12:00:00Z')), true);
  assert.equal(isMoodActionDue(action, new Date('2026-11-18T12:00:00Z')), false);
  const entry = { status: 'confirmed', values: { entry_time: '2026-11-17T23:30:00Z', day_key: '2026-11-17' } };
  assert.equal(hasConfirmedMoodForToday(action, [entry], new Date('2026-11-18T07:00:00Z')), true);
  assert.equal(hasConfirmedMoodForToday(action, [entry], new Date('2026-11-19T07:00:00Z')), false);
});

test('entry parser accepts backend mood values including zero', () => {
  const entry = { id: 'e1', action_id: 'a1', status: 'confirmed', revision: 1,
    revision_history: [], idempotency_key: 'confirm-e1', created_at: 'now', updated_at: 'now', confirmed_at: 'now',
    values: { relevant_date: '2026-11-16', entry_time: '2026-11-16T10:00:00Z', timezone_offset_minutes: 0,
      day_key: '2026-11-16', mood_value: 0, mood_label: null, context: null, scale_id: 'overall-day-mood-0-10-v1' } };
  assert.equal(isRatingEntry(entry), true);
  assert.equal(isRatingEntry({ ...entry, values: { ...entry.values, mood_value: undefined } }), false);
});
