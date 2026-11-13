import type { RatingAction, RatingEntry } from './actionTypes';
import { dayKeyAtCapturedOffset } from './ratingDomain';

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKeyToTimestamp(dateKey: string) {
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

export function currentDayKey(now = new Date()) {
  return dayKeyAtCapturedOffset(now.toISOString(), -now.getTimezoneOffset());
}

function actionStartDate(action: RatingAction) {
  return action.settings.start_date ?? action.created_at.slice(0, 10);
}

function actionEndDate(action: RatingAction) {
  if (action.settings.duration_kind === 'ongoing') return null;
  const startDate = actionStartDate(action);
  return (
    action.settings.end_date ??
    new Date(
      dateKeyToTimestamp(startDate) + ((action.settings.duration_days ?? 1) - 1) * DAY_MS,
    )
      .toISOString()
      .slice(0, 10)
  );
}

export function getActionProgress(action: RatingAction, today = currentDayKey()) {
  const startDate = actionStartDate(action);
  const endDate = actionEndDate(action);
  const rawDay =
    Math.floor((dateKeyToTimestamp(today) - dateKeyToTimestamp(startDate)) / DAY_MS) + 1;
  const dayNumber =
    action.settings.duration_kind === 'ongoing'
      ? Math.max(1, rawDay)
      : Math.min(action.settings.duration_days ?? 1, Math.max(1, rawDay));
  return {
    completed: (endDate !== null && today > endDate) || action.state === 'superseded',
    dayNumber,
    endDate,
    startDate,
  };
}

export function getTodayEntry(entries: RatingEntry[], today = currentDayKey()) {
  return entries
    .filter((entry) => entry.values.day_key === today)
    .sort((left, right) => {
      if (left.status !== right.status) return left.status === 'confirmed' ? -1 : 1;
      return right.updated_at.localeCompare(left.updated_at);
    })[0];
}

export function formatActionDate(dateKey: string) {
  return new Intl.DateTimeFormat(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${dateKey}T00:00:00.000Z`));
}

export function formatActionDateRange(action: RatingAction) {
  const { startDate, endDate } = getActionProgress(action);
  if (endDate === null) return `Started ${formatActionDate(startDate)} · Ongoing`;
  return `${formatActionDate(startDate)} – ${formatActionDate(endDate)}`;
}
