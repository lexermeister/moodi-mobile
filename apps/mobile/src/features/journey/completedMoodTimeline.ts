import type { RatingEntry } from '../actions/actionTypes';
import type { RecordingMetadata } from '../recordings/recordingStorage';

export function completedMoodTimeline(sessions: RecordingMetadata[], entries: RatingEntry[]) {
  const groups: RatingEntry[][] = Array.from({ length: sessions.length + 1 }, () => []);
  const confirmed = entries.filter(entry => entry.status === 'confirmed' && entry.values.mood_value !== null)
    .sort((left, right) => Date.parse(right.values.entry_time) - Date.parse(left.values.entry_time) ||
      right.updated_at.localeCompare(left.updated_at));
  for (const entry of confirmed) {
    const instant = Date.parse(entry.values.entry_time);
    const index = sessions.findIndex(session => instant >= Date.parse(session.createdAt));
    groups[index < 0 ? sessions.length : index].push(entry);
  }
  return groups;
}
