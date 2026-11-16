import assert from 'node:assert/strict';
import test from 'node:test';
import { recentMoodDays } from '../src/features/shell/recentMood.ts';

const entry = (day, value, overrides = {}) => ({
  status: 'confirmed', updated_at: `${day}T20:00:00Z`,
  values: { day_key: day, entry_time: `${day}T20:00:00Z`, mood_value: value, scale_id: 'overall-day-mood-0-10-v1' },
  ...overrides,
});
test('seven local calendar days cross month boundaries and retain missing days', () => {
  const days = recentMoodDays([], new Date(2026, 10, 3));
  assert.equal(days[0].key, '2026-10-28');
  assert.equal(days[6].key, '2026-11-03');
  assert.ok(days.every(day => day.value === null));
});
test('uses the latest confirmed compatible rating, preserves zero, excludes drafts', () => {
  const older = entry('2026-11-03', 2);
  older.values.entry_time = '2026-11-03T10:00:00Z';
  const draft = entry('2026-11-03', 9, { status: 'draft' });
  const incompatible = entry('2026-11-03', 8);
  incompatible.values.scale_id = 'motivation-0-10-v1';
  const days = recentMoodDays([older, entry('2026-11-03', 0), draft, incompatible], new Date(2026, 10, 3));
  assert.equal(days[6].value, 0);
  assert.equal(days[5].value, null);
});
