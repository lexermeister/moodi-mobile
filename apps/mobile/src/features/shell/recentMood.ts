import type { RatingEntry } from '../actions/actionTypes';

export function recentMoodDays(entries: RatingEntry[], today = new Date()) {
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 6 + index, 12);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    const entry = entries.filter(item => item.status === 'confirmed' && item.values.day_key === key &&
      item.values.mood_value !== null && item.values.mood_value >= 0 && item.values.mood_value <= 10 &&
      item.values.scale_id === 'overall-day-mood-0-10-v1')
      .sort((a, b) => Date.parse(b.values.entry_time) - Date.parse(a.values.entry_time) || Date.parse(b.updated_at) - Date.parse(a.updated_at))[0];
    return { key, date, value: entry?.values.mood_value ?? null };
  });
}
