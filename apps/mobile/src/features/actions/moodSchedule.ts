import type { RatingAction, RatingEntry } from './actionTypes';

const weekdayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function localDayKey(instant: Date) {
  return `${instant.getFullYear()}-${String(instant.getMonth() + 1).padStart(2, '0')}-${String(instant.getDate()).padStart(2, '0')}`;
}

function actionEndDate(action: RatingAction) {
  if (action.settings.duration_kind !== 'fixed') return null;
  if (action.settings.end_date) return action.settings.end_date;
  const start = action.settings.start_date ?? action.created_at.slice(0, 10);
  return new Date(Date.parse(`${start}T00:00:00Z`) + ((action.settings.duration_days ?? 1) - 1) * 86_400_000).toISOString().slice(0, 10);
}

export function dayInZone(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long',
  }).formatToParts(instant);
  const value = (name: string) => parts.find(part => part.type === name)?.value ?? '';
  return { key: `${value('year')}-${value('month')}-${value('day')}`, weekday: weekdayNames.indexOf(value('weekday')) };
}

export function isMoodActionDue(action: RatingAction, now = new Date()) {
  const zone = action.settings.preferred_time_zone;
  const day = zone ? dayInZone(now, zone) : { key: localDayKey(now), weekday: (now.getDay() + 6) % 7 };
  const end = actionEndDate(action);
  if (action.state === 'superseded' || (end !== null && day.key > end) ||
      (action.settings.start_date && day.key < action.settings.start_date)) return false;
  if (action.settings.cadence === 'weekdays') return day.weekday < 5;
  if (action.settings.cadence === 'weekly') return day.weekday === action.settings.weekly_weekday;
  return true;
}

export function hasConfirmedMoodForToday(action: RatingAction, entries: RatingEntry[], now = new Date()) {
  const zone = action.settings.preferred_time_zone;
  const today = zone ? dayInZone(now, zone).key : localDayKey(now);
  return entries.some(entry => entry.status === 'confirmed' &&
    (zone ? dayInZone(new Date(entry.values.entry_time), zone).key : entry.values.day_key) === today);
}
