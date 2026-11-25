import type { PracticeAttemptData, PracticeCandidate, PracticeSettings } from './practiceTypes';

export function practiceSettings(candidate: PracticeCandidate): PracticeSettings {
  return { exact_task: candidate.exact_task, technique: candidate.technique, resource_url: candidate.resource_url,
    duration_minutes: candidate.duration_minutes, repetitions: candidate.repetitions, limits: candidate.limits,
    frequency: candidate.frequency ?? 'Every day', timing: candidate.timing, reminder_time: null, reminder_time_zone: null };
}
export function practiceTitle(settings: Pick<PracticeSettings, 'exact_task' | 'technique'>): string {
  return /breath/i.test(`${settings.exact_task} ${settings.technique ?? ''}`) ? 'Practice breathing' : 'Practice relaxation';
}
export function parsePracticeMinutes(text: string): number | null | undefined {
  if (!text.trim()) return null;
  if (!/^\d+(?:\.\d+)?$/.test(text.trim())) return undefined;
  const value = Number(text);
  return Number.isFinite(value) ? value : undefined;
}
export function timerSeconds(elapsed: number, startedAt: number | null, now: number): number {
  return elapsed + (startedAt === null ? 0 : Math.max(0, Math.floor((now - startedAt) / 1000)));
}
const labels = { completed: 'Completed', partly_completed: 'Partly completed', skipped: 'Skipped', stopped_early: 'Stopped early' };
export function practiceSummary(data: Pick<PracticeAttemptData, 'relevant_date' | 'outcome' | 'actual_minutes' |
  'tension_before' | 'tension_after' | 'notes' | 'timer_used' | 'timer_elapsed_seconds'>) {
  return [
    { label: 'Practice date', value: data.relevant_date },
    { label: 'Outcome', value: data.outcome ? labels[data.outcome] : 'Not reported' },
    { label: 'Practice duration', value: data.actual_minutes === null ? 'Not recorded' : `${data.actual_minutes} min` },
    { label: 'Tension before (looking back)', value: data.tension_before === null ? 'Not rated' : `${data.tension_before}/10` },
    { label: 'Tension after', value: data.tension_after === null ? 'Not rated' : `${data.tension_after}/10` },
    ...(data.notes?.trim() ? [{ label: 'Anything you noticed?', value: data.notes.trim() }] : []),
    ...(data.timer_used ? [{ label: 'Timer elapsed', value: `${Math.floor(data.timer_elapsed_seconds / 60)}m ${data.timer_elapsed_seconds % 60}s` }] : []),
  ];
}
export function newPracticeData(now = new Date()): PracticeAttemptData {
  const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { status: 'draft', relevant_date: date, outcome: null, actual_minutes: null,
    tension_before: null, tension_after: null, before_rating_retrospective: true, notes: null,
    timer_elapsed_seconds: 0, timer_used: false, timer_pause_count: 0, current_step: 'choice' };
}

export function cleanPracticeData(data: PracticeAttemptData): PracticeAttemptData {
  const fields = Object.keys(newPracticeData()) as (keyof PracticeAttemptData)[];
  return Object.fromEntries(fields.map(key => [key, data[key]])) as PracticeAttemptData;
}

// Keeps background draft saves and explicit confirmation in order, including lost responses.
export class PracticeAttemptWriter {
  private tail: Promise<unknown> = Promise.resolve();
  private revision: number;
  private uncertain: PracticeAttemptData | null = null;
  private api: {
    save: (data: PracticeAttemptData, revision: number) => Promise<import('./practiceTypes').PracticeAttempt>;
    load: () => Promise<import('./practiceTypes').PracticeAttempt | undefined>;
  };
  constructor(api: PracticeAttemptWriter['api'], revision = 0) { this.api = api; this.revision = revision; }
  write(values: PracticeAttemptData) {
    const data = cleanPracticeData(values);
    const matches = (entry: PracticeAttemptData, expected: PracticeAttemptData) =>
      JSON.stringify(cleanPracticeData(entry)) === JSON.stringify(expected);
    const work = async () => {
      if (this.uncertain) {
        const stored = await this.api.load();
        if (stored && matches(stored, this.uncertain)) this.revision = stored.revision;
        else if (stored && stored.revision !== this.revision) throw new Error('This practice changed. Reopen it before saving your correction.');
        this.uncertain = null;
      }
      try {
        const saved = await this.api.save(data, this.revision);
        this.revision = saved.revision; return saved;
      } catch (error) {
        this.uncertain = data;
        const stored = await this.api.load().catch(() => undefined);
        if (!stored || !matches(stored, data)) throw error;
        this.revision = stored.revision; this.uncertain = null; return stored;
      }
    };
    const result = this.tail.then(work, work);
    this.tail = result.catch(() => undefined);
    return result;
  }
}
