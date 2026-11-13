import type { RatingMetric } from './actionTypes';

type RatingMetricPresentation = {
  accessibilityLabel: string;
  checkInTitle: string;
  entryFallback: string;
  historyTitle: string;
  question: string;
  savedMessage: string;
};

export const RATING_METRICS: Record<RatingMetric, RatingMetricPresentation> = {
  mood: {
    accessibilityLabel: 'Mood rating',
    checkInTitle: 'Mood check-in',
    entryFallback: 'Mood recorded',
    historyTitle: 'Mood history',
    question: 'How was your overall mood today?',
    savedMessage: 'Mood saved for today.',
  },
  motivation: {
    accessibilityLabel: 'Motivation rating',
    checkInTitle: 'Motivation check-in',
    entryFallback: 'Motivation recorded',
    historyTitle: 'Motivation history',
    question: 'How motivated did you feel today?',
    savedMessage: 'Motivation saved for today.',
  },
  sleep_quality: {
    accessibilityLabel: 'Sleep quality rating',
    checkInTitle: 'Sleep quality check-in',
    entryFallback: 'Sleep quality recorded',
    historyTitle: 'Sleep quality history',
    question: "How would you rate last night's sleep?",
    savedMessage: 'Sleep quality saved.',
  },
};

export function getRatingMetricPresentation(metric: RatingMetric) {
  return RATING_METRICS[metric];
}
