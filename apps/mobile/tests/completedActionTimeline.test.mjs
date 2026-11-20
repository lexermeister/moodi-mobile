import assert from 'node:assert/strict';
import test from 'node:test';
import { activityAttemptTime, completedActionTimeline } from '../src/features/journey/completedActionTimeline.ts';

const session = (id, createdAt) => ({ id, createdAt });
const mood = (id, entry_time, status = 'confirmed', mood_value = 0) => ({ id, status, updated_at: entry_time,
  values: { entry_time, mood_value } });
const activity = (id, updated_at, outcome = 'completed', status = 'confirmed', history = []) => ({
  id, updated_at, status, outcome, history, selection: { label: 'Draw' },
});

test('places mood and activity check-ins together around sessions', () => {
  const sessions = [session('recent', '2026-11-16T14:00:00Z'), session('past', '2026-11-06T16:30:00Z')];
  const groups = completedActionTimeline(sessions, [
    mood('mood-after', '2026-11-16T15:00:00Z'),
    mood('mood-before', '2026-11-05T09:00:00Z'),
    mood('draft', '2026-11-17T09:00:00Z', 'draft'),
    mood('unrated', '2026-11-17T09:00:00Z', 'confirmed', null),
  ], [
    activity('completed', '2026-11-16T16:00:00Z'),
    activity('partial', '2026-11-15T20:00:00Z', 'partly_completed'),
    activity('skipped', '2026-11-07T09:00:00Z', 'skipped'),
    activity('draft', '2026-11-18T09:00:00Z', null, 'draft'),
  ]);
  assert.deepEqual(groups.map(group => group.map(row => row.id)), [
    ['activity:completed', 'mood:mood-after'], ['activity:partial', 'activity:skipped'], ['mood:mood-before'],
  ]);
});

test('an amendment keeps the original confirmation date in Journey', () => {
  const amended = activity('one', '2026-11-20T10:00:00Z', 'completed', 'confirmed', [
    { status: 'draft', saved_at: '2026-11-10T10:00:00Z' },
    { status: 'confirmed', saved_at: '2026-11-11T10:00:00Z' },
  ]);
  assert.equal(activityAttemptTime(amended), '2026-11-11T10:00:00Z');
  assert.deepEqual(completedActionTimeline([], [], [amended])[0].map(row => row.id), ['activity:one']);
});
