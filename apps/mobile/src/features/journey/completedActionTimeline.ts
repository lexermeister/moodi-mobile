import type { RatingEntry } from '../actions/actionTypes';
import type { ActivityAttempt } from '../actions/activityTypes';
import type { RecordingMetadata } from '../recordings/recordingStorage';

export type JourneyActionEntry =
  | { kind: 'mood'; id: string; occurredAt: string; entry: RatingEntry }
  | { kind: 'activity'; id: string; occurredAt: string; attempt: ActivityAttempt };

export function activityAttemptTime(attempt: ActivityAttempt): string {
  const firstConfirmed = attempt.history.find(version => {
    if (!version || typeof version !== 'object') return false;
    const saved = version as { status?: unknown; saved_at?: unknown };
    return saved.status === 'confirmed' && typeof saved.saved_at === 'string';
  }) as { saved_at: string } | undefined;
  return firstConfirmed?.saved_at ?? attempt.updated_at;
}

export function completedActionTimeline(sessions: RecordingMetadata[], moodEntries: RatingEntry[],
  activityAttempts: ActivityAttempt[]): JourneyActionEntry[][] {
  const groups: JourneyActionEntry[][] = Array.from({ length: sessions.length + 1 }, () => []);
  const mood: JourneyActionEntry[] = moodEntries
    .filter(entry => entry.status === 'confirmed' && entry.values.mood_value !== null)
    .map(entry => ({ kind: 'mood', id: `mood:${entry.id}`, occurredAt: entry.values.entry_time, entry }));
  const activities: JourneyActionEntry[] = activityAttempts
    .filter(attempt => attempt.status === 'confirmed' && attempt.outcome !== null)
    .map(attempt => ({ kind: 'activity', id: `activity:${attempt.id}`,
      occurredAt: activityAttemptTime(attempt), attempt }));
  const confirmed = [...mood, ...activities].sort((left, right) =>
    Date.parse(right.occurredAt) - Date.parse(left.occurredAt) || right.id.localeCompare(left.id));
  for (const entry of confirmed) {
    const instant = Date.parse(entry.occurredAt);
    const index = sessions.findIndex(session => instant >= Date.parse(session.createdAt));
    groups[index < 0 ? sessions.length : index].push(entry);
  }
  return groups;
}
