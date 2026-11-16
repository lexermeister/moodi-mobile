import assert from 'node:assert/strict';
import test from 'node:test';
import { confirmedMoodEntries, entryFeeling, entryOffsetLabel, entryTimeLabel } from '../src/features/actions/moodEntryPresentation.ts';

const entry = (id, day, status, score, time) => ({ id, status, updated_at: time,
  values: { day_key: day, mood_value: score, entry_time: time, timezone_offset_minutes: 60 } });

test('today includes confirmed zero ratings, excludes drafts and previous days, and sorts newest first', () => {
  const rows = [entry('draft', '2026-11-16', 'draft', 8, '2026-11-16T22:00:00Z'),
    entry('earlier', '2026-11-16', 'confirmed', 0, '2026-11-16T09:00:00Z'),
    entry('yesterday', '2026-11-15', 'confirmed', 7, '2026-11-15T22:00:00Z'),
    entry('later', '2026-11-16', 'confirmed', 4, '2026-11-16T13:00:00Z')];
  assert.deepEqual(confirmedMoodEntries(rows, '2026-11-16').map(row => row.id), ['later', 'earlier']);
});

test('entry details use the captured offset and combine selected and custom feelings', () => {
  const row = entry('late', '2026-11-17', 'confirmed', 4, '2026-11-16T23:30:00Z');
  row.values.feelings = ['Calm'];
  row.values.custom_feeling = ' Hopeful ';
  assert.match(entryTimeLabel(row), /Nov 17, 2026/);
  assert.equal(entryOffsetLabel(row), 'UTC+01:00');
  assert.equal(entryFeeling(row), 'Calm, Hopeful');
});
