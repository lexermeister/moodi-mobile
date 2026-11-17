import type { MoodCadence, MoodMeasurement, RecordRatingActionSettings, RecordRatingCandidate } from './actionTypes';

export const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] as const;
export const EXACT_TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

export function suggestedCadence(frequency: string | null): MoodCadence {
  const value = frequency?.toLowerCase() ?? '';
  if (/weekdays|monday to friday|monday through friday/.test(value)) return 'weekdays';
  if (/weekly|once a week|each week/.test(value)) return 'weekly';
  return 'daily';
}

export function suggestedExactTime(timing: string | null): string {
  const match = timing?.match(/\b(1[0-2]|0?[1-9]):([0-5]\d)\s*(am|pm)\b/i);
  if (!match) return '';
  const hours = Number(match[1]) % 12 + (match[3].toLowerCase() === 'pm' ? 12 : 0);
  return `${String(hours).padStart(2, '0')}:${match[2]}`;
}

export function initialReminderTime(timing: string | null): string {
  return suggestedExactTime(timing) || '20:00';
}

export type MoodSchedule = { cadence: MoodCadence; time: string; weeklyWeekday: number | null; timeZone: string };

export const MOOD_MEASUREMENTS: { id: MoodMeasurement; label: string }[] = [
  { id: 'mood', label: 'Mood' },
  { id: 'energy', label: 'Energy' },
  { id: 'sleep_quality', label: 'Sleep quality' },
  { id: 'motivation', label: 'Motivation' },
];

export function measurementLabels(measurements: MoodMeasurement[]) {
  return MOOD_MEASUREMENTS.filter(item => measurements.includes(item.id)).map(item => item.label).join(', ');
}

export function toggleMeasurement(current: MoodMeasurement[], measurement: MoodMeasurement) {
  if (measurement === 'mood') return current;
  return MOOD_MEASUREMENTS.map(item => item.id).filter(id =>
    id === measurement ? !current.includes(id) : current.includes(id));
}

export function moodSettingsFromCandidate(
  candidate: RecordRatingCandidate,
  measurements: MoodMeasurement[],
  schedule: MoodSchedule,
): RecordRatingActionSettings | null {
  if (!candidate.configuration || !candidate.frequency || !candidate.reference_period || !EXACT_TIME.test(schedule.time) ||
    !schedule.timeZone || (schedule.cadence === 'weekly' && schedule.weeklyWeekday === null)) return null;
  return {
    what_to_record: measurements,
    exact_task: candidate.exact_task,
    frequency: candidate.frequency,
    timing: candidate.timing,
    reference_period: candidate.reference_period,
    configuration: candidate.configuration,
    start_date: null,
    end_date: null,
    duration_kind: 'ongoing',
    duration_days: null,
    preferred_check_in_time: schedule.time,
    preferred_time_zone: schedule.timeZone,
    schedule_origin: 'user_selected',
    cadence: schedule.cadence,
    weekly_weekday: schedule.cadence === 'weekly' ? schedule.weeklyWeekday : null,
  };
}
