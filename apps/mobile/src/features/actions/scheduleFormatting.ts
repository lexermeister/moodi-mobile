import type { RecordMoodActionSettings } from './actionTypes';

export function formatClockTime(value: string) {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date(2000, 0, 1, hours, minutes);
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function sentenceCase(value: string) {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

export function formatActionCadence(settings: RecordMoodActionSettings) {
  if (settings.preferred_check_in_time) {
    return `Daily at ${formatClockTime(settings.preferred_check_in_time)}`;
  }
  return [sentenceCase(settings.frequency), sentenceCase(settings.timing ?? '')]
    .filter(Boolean)
    .join(' · ');
}

export function formatActionDuration(settings: RecordMoodActionSettings) {
  return settings.duration_kind === 'ongoing'
    ? 'Ongoing'
    : `${settings.duration_days ?? 1} days`;
}
