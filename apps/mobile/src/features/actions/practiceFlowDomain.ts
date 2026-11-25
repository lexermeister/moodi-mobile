import type { PracticeAttempt, PracticeAttemptData, PracticeCandidate, PracticeSettings } from './practiceTypes';

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
export function practiceDateLabel(date: string): string {
  return new Date(`${date}T12:00:00`).toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  });
}
export function practiceTimeLabel(timestamp: string): string | null {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return null;
  const hour = date.getHours();
  if (hour >= 5 && hour < 12) return 'Morning';
  if (hour >= 12 && hour < 17) return 'Midday';
  if (hour >= 17 && hour < 21) return 'Evening';
  return 'Before Sleep';
}
export function practiceLogTime(attempt: Pick<PracticeAttempt, 'history' | 'updated_at'>): string {
  return attempt.history.find(version => version.status === 'confirmed')?.saved_at ?? attempt.updated_at;
}
export function practiceSummary(data: Pick<PracticeAttemptData, 'relevant_date' | 'outcome' | 'actual_minutes' |
  'tension_before' | 'tension_after' | 'notes' | 'timer_used' | 'timer_elapsed_seconds'>) {
  return {
    date: practiceDateLabel(data.relevant_date),
    outcome: data.outcome ? labels[data.outcome] : 'Not reported',
    duration: data.actual_minutes === null ? 'Not recorded' : `${data.actual_minutes} min`,
    tensionBefore: data.tension_before === null ? 'Not rated' : `${data.tension_before}/10`,
    tensionAfter: data.tension_after === null ? 'Not rated' : `${data.tension_after}/10`,
    notes: data.notes?.trim() || null,
    timer: data.timer_used ? `${Math.floor(data.timer_elapsed_seconds / 60)}m ${data.timer_elapsed_seconds % 60}s` : null,
  };
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
