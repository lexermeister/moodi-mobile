import type { ActivityAction, ActivityOutcome, ActivitySelection, ActivitySuggestion } from './activityTypes';

export function activityAgreementText(agreement: Pick<ActivityAction['settings'],
  'assignment_kind' | 'agreed_activity' | 'frequency' | 'reference_period' | 'exact_task'>): string {
  if (agreement.assignment_kind === 'specific') {
    return `You agreed to ${agreement.agreed_activity}${agreement.frequency ? ` · ${agreement.frequency}` : ''}.`;
  }
  if (agreement.reference_period?.toLowerCase().includes('this week') ||
    agreement.frequency?.toLowerCase().includes('this week')) {
    return 'You agreed to make time for one thing you enjoy or find meaningful this week. You can decide what it is when you’re ready.';
  }
  return `You agreed to ${agreement.exact_task}. You can decide what it is when you’re ready.`;
}

export const outcomeLabels: Record<ActivityOutcome, string> = {
  completed: 'Completed',
  partly_completed: 'Partly completed',
  skipped: 'Skipped',
  stopped_early: 'Stopped early',
};

export function activityChoices(action: ActivityAction, suggestions: ActivitySuggestion[]): ActivitySelection[] {
  if (action.settings.assignment_kind === 'specific' && action.settings.agreed_activity) {
    return [{ origin: 'agreed', label: action.settings.agreed_activity,
      suggestion_id: null, source_ids: action.source_ids }];
  }
  const seen = new Set<string>();
  const choices: ActivitySelection[] = [];
  for (const mention of action.activity_mentions) {
    const key = mention.label.trim().toLocaleLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    choices.push({ origin: 'session_mention', label: mention.label,
      suggestion_id: null, source_ids: mention.source_ids });
  }
  for (const suggestion of suggestions) {
    const key = suggestion.label.trim().toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    choices.push({ origin: 'predefined', label: suggestion.label,
      suggestion_id: suggestion.id, source_ids: [] });
  }
  return choices;
}

export function newActivityAttemptId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, character => {
    const value = Math.floor(Math.random() * 16);
    return (character === 'x' ? value : (value & 3) | 8).toString(16);
  });
}

export function parseOptionalMinutes(value: string): number | null | undefined {
  if (!value.trim()) return null;
  if (!/^\d+$/.test(value.trim())) return undefined;
  const minutes = Number(value.trim());
  return Number.isInteger(minutes) && minutes >= 1 && minutes <= 1440 ? minutes : undefined;
}

export function formatElapsed(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${String(minutes).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}
