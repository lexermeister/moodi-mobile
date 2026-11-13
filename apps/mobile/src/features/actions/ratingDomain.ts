export const SCORE_MIN = 0;
export const SCORE_MAX = 10;
export const TIMEZONE_OFFSET_MIN_MINUTES = -840;
export const TIMEZONE_OFFSET_MAX_MINUTES = 840;
export const RATING_CONTEXT_MAX_LENGTH = 2_000;

export function parseRatingScore(value: number): number {
  if (!Number.isInteger(value) || value < SCORE_MIN || value > SCORE_MAX) {
    throw new Error('Rating must be a whole number from 0 to 10.');
  }
  return value;
}

export function parseTimezoneOffsetMinutes(value: number): number {
  if (
    !Number.isInteger(value) ||
    value < TIMEZONE_OFFSET_MIN_MINUTES ||
    value > TIMEZONE_OFFSET_MAX_MINUTES
  ) {
    throw new Error('Captured timezone offset is invalid.');
  }
  return value;
}

export function dayKeyAtCapturedOffset(
  occurredAt: string,
  timezoneOffsetMinutes: number,
): string {
  const offset = parseTimezoneOffsetMinutes(timezoneOffsetMinutes);
  const timestamp = Date.parse(occurredAt);
  if (!Number.isFinite(timestamp)) {
    throw new Error('Entry time is invalid.');
  }
  return new Date(timestamp + offset * 60_000).toISOString().slice(0, 10);
}

export function normalizeRatingContext(value: string): string | null {
  const normalized = value.trim();
  if (!normalized) return null;
  if (normalized.length > RATING_CONTEXT_MAX_LENGTH) {
    throw new Error('Context must be 2,000 characters or fewer.');
  }
  return normalized;
}

export function createUuid(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (character) => {
    const random = Math.floor(Math.random() * 16);
    const value = character === 'x' ? random : (random & 0x3) | 0x8;
    return value.toString(16);
  });
}
