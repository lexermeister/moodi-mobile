import assert from 'node:assert/strict';
import test from 'node:test';
import { completedMoodTimeline } from '../src/features/journey/completedMoodTimeline.ts';

const session = (id, createdAt) => ({ id, createdAt });
const entry = (id, entry_time, status = 'confirmed', mood_value = 0) => ({ id, status, updated_at: entry_time,
  values: { entry_time, mood_value } });

test('places completed mood entries after, between, and before sessions by the recorded instant', () => {
  const sessions = [session('recent', '2026-11-16T14:00:00Z'), session('past', '2026-11-06T16:30:00Z')];
  const groups = completedMoodTimeline(sessions, [
    entry('after', '2026-11-16T15:00:00Z'),
    entry('same-time', '2026-11-16T14:00:00Z'),
    entry('between-later', '2026-11-15T20:00:00Z'),
    entry('between-earlier', '2026-11-07T09:00:00Z'),
    entry('before', '2026-11-05T09:00:00Z'),
    entry('draft', '2026-11-17T09:00:00Z', 'draft'),
    entry('unrated', '2026-11-17T09:00:00Z', 'confirmed', null),
  ]);
  assert.deepEqual(groups.map(group => group.map(row => row.id)), [
    ['after', 'same-time'], ['between-later', 'between-earlier'], ['before'],
  ]);
});

test('keeps completed mood entries visible when there are no saved sessions', () => {
  assert.deepEqual(completedMoodTimeline([], [entry('one', '2026-11-16T15:00:00Z')])[0].map(row => row.id), ['one']);
});
