import type { RecordRatingActionSettings } from './actionTypes';
import { WEEKDAYS } from './moodSetup';

export function formatClockTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function sentenceCase(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export function formatActionCadence(settings: RecordRatingActionSettings) {
  if (settings.duration_kind === 'unscheduled') return 'Record when you want to';
  if (settings.preferred_check_in_time) {
    const frequency = settings.cadence === 'weekdays' ? 'Weekdays' : settings.cadence === 'weekly'
      ? `Weekly on ${WEEKDAYS[settings.weekly_weekday ?? 0]}` : 'Daily';
    return `${frequency} at ${formatClockTime(settings.preferred_check_in_time)}`;
  }
  return [sentenceCase(settings.frequency), sentenceCase(settings.timing ?? '')]
    .filter(Boolean)
    .join(' · ');
}

export function formatActionDuration(settings: RecordRatingActionSettings) {
  if (settings.duration_kind === 'unscheduled') return 'No end date';
  return settings.duration_kind === 'ongoing'
    ? 'Ongoing'
    : `${settings.duration_days ?? 1} days`;
}
