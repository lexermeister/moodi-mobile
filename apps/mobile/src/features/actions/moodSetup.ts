import type { MoodMeasurement, RecordRatingActionSettings, RecordRatingCandidate } from './actionTypes';

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
): RecordRatingActionSettings | null {
  if (!candidate.configuration || !candidate.frequency || !candidate.reference_period) return null;
  return {
    what_to_record: measurements,
    exact_task: candidate.exact_task,
    frequency: candidate.frequency,
    timing: candidate.timing,
    reference_period: candidate.reference_period,
    configuration: candidate.configuration,
    start_date: null,
    end_date: null,
    duration_kind: 'unscheduled',
    duration_days: null,
    preferred_check_in_time: null,
    preferred_time_zone: null,
    schedule_origin: 'moodi_default',
  };
}
