import type { RatingEntry } from './actionTypes';

export function confirmedMoodEntries(entries: RatingEntry[], dayKey: string) {
  return entries.filter(entry => entry.status === 'confirmed' && entry.values.day_key === dayKey &&
    entry.values.mood_value !== null)
    .sort((left, right) => Date.parse(right.values.entry_time) - Date.parse(left.values.entry_time) ||
      right.updated_at.localeCompare(left.updated_at));
}

export function entryFeeling(entry: RatingEntry) {
  return [...entry.values.feelings ?? [], entry.values.custom_feeling?.trim()].filter(Boolean).join(', ');
}

export function capturedEntryDate(entry: RatingEntry) {
  return new Date(Date.parse(entry.values.entry_time) + entry.values.timezone_offset_minutes * 60_000);
}

export function entryTimeLabel(entry: RatingEntry) {
  return capturedEntryDate(entry).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
  });
}

export function entryOffsetLabel(entry: RatingEntry) {
  const offset = entry.values.timezone_offset_minutes;
  const sign = offset >= 0 ? '+' : '−';
  return `UTC${sign}${String(Math.floor(Math.abs(offset) / 60)).padStart(2, '0')}:${String(Math.abs(offset) % 60).padStart(2, '0')}`;
}
