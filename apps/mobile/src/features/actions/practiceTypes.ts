import type { ActivityOutcome } from './activityTypes';

export type PracticeSettings = {
  exact_task: string; technique: string | null; resource_url: string | null;
  duration_minutes: number | null; repetitions: string | null; limits: string | null;
  frequency: string; timing: string | null; reminder_time: null; reminder_time_zone: null;
};
export type PracticeCandidate = Omit<PracticeSettings, 'frequency' | 'reminder_time' | 'reminder_time_zone'> & {
  id: string; type: 'practise_relaxation_breathing'; state: 'review_ready'; actor: 'client';
  frequency: string | null; source_excerpt: string; source_ids: string[];
};
export type PracticeAction = {
  id: string; type: 'practise_relaxation_breathing'; state: 'active' | 'paused' | 'superseded';
  recording_id: string; transcript_version: string; candidate_id: string;
  source_ids: string[]; source_excerpt: string; settings: PracticeSettings; created_at: string; revision: number;
};
export type PracticeStep = 'choice' | 'timer' | 'outcome' | 'tension' | 'notes' | 'review';
export type PracticeAttemptData = {
  status: 'draft' | 'confirmed'; relevant_date: string; outcome: ActivityOutcome | null;
  actual_minutes: number | null; tension_before: number | null; tension_after: number | null;
  before_rating_retrospective: boolean; notes: string | null; timer_elapsed_seconds: number;
  timer_used: boolean; timer_pause_count: number; current_step: PracticeStep;
};
export type PracticeAttempt = PracticeAttemptData & {
  id: string; action_id: string; action_revision: number; revision: number;
  created_at: string; updated_at: string;
  history: (PracticeAttemptData & { revision: number; saved_at: string })[];
};
const object = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object';
const optionalText = (v: unknown) => v === null || typeof v === 'string';
const strings = (v: unknown) => Array.isArray(v) && v.every(x => typeof x === 'string');
const minutes = (v: unknown) => v === null || (typeof v === 'number' && Number.isFinite(v) && v >= 0);
const rating = (v: unknown) => v === null || (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 10);
function assignment(v: Record<string, unknown>) {
  return typeof v.exact_task === 'string' && optionalText(v.technique) && optionalText(v.resource_url) &&
    minutes(v.duration_minutes) && optionalText(v.repetitions) && optionalText(v.limits) && optionalText(v.timing);
}
export function isPracticeCandidate(v: unknown): v is PracticeCandidate {
  return object(v) && v.type === 'practise_relaxation_breathing' && typeof v.id === 'string' &&
    v.state === 'review_ready' && v.actor === 'client' && assignment(v) && optionalText(v.frequency) &&
    typeof v.source_excerpt === 'string' && strings(v.source_ids);
}
export function isPracticeAction(v: unknown): v is PracticeAction {
  return object(v) && v.type === 'practise_relaxation_breathing' && typeof v.id === 'string' &&
    ['active', 'paused', 'superseded'].includes(v.state as string) && object(v.settings) && assignment(v.settings) &&
    typeof v.settings.frequency === 'string' && v.settings.reminder_time === null && v.settings.reminder_time_zone === null &&
    typeof v.recording_id === 'string' && typeof v.transcript_version === 'string' && typeof v.candidate_id === 'string' &&
    strings(v.source_ids) && typeof v.source_excerpt === 'string' && typeof v.created_at === 'string' && typeof v.revision === 'number';
}
export function isPracticeAttempt(v: unknown): v is PracticeAttempt {
  return object(v) && typeof v.id === 'string' && typeof v.action_id === 'string' &&
    typeof v.revision === 'number' && typeof v.action_revision === 'number' &&
    (v.status === 'draft' || v.status === 'confirmed') && typeof v.relevant_date === 'string' &&
    (v.outcome === null || ['completed', 'partly_completed', 'skipped', 'stopped_early'].includes(v.outcome as string)) &&
    (v.status !== 'confirmed' || v.outcome !== null) && minutes(v.actual_minutes) &&
    rating(v.tension_before) && rating(v.tension_after) && optionalText(v.notes) &&
    typeof v.before_rating_retrospective === 'boolean' && typeof v.timer_elapsed_seconds === 'number' &&
    typeof v.timer_used === 'boolean' && typeof v.timer_pause_count === 'number' &&
    ['choice', 'timer', 'outcome', 'tension', 'notes', 'review'].includes(v.current_step as string) &&
    typeof v.created_at === 'string' && typeof v.updated_at === 'string' && Array.isArray(v.history);
}
