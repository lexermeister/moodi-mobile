import type { MoodMeasurement, RatingEntry, RatingEntryValues } from './actionTypes';

export type MoodStep = NonNullable<RatingEntryValues['current_step']>;
export const FEELINGS = ['Calm', 'Tired', 'Relieved', 'Anxious'] as const;
export const MEASUREMENTS = [
  { id: 'energy', field: 'energy_value', label: 'Energy' },
  { id: 'sleep_quality', field: 'sleep_quality_value', label: 'Sleep quality' },
  { id: 'motivation', field: 'motivation_value', label: 'Motivation' },
] as const;

export function cleanMoodValues(values: RatingEntryValues): RatingEntryValues {
  const custom = values.custom_feeling?.trim() || null;
  return { ...values, custom_feeling: custom, context: values.context?.trim() || null,
    thoughts: values.thoughts?.trim() || null, actions_taken: values.actions_taken?.trim() || null,
    feeling_intensity: values.feelings?.length || custom ? values.feeling_intensity ?? null : null };
}

export function moodSteps(measurements: MoodMeasurement[], values: RatingEntryValues): MoodStep[] {
  return ['mood', ...(measurements.some(value => value !== 'mood') ? ['additional_ratings' as const] : []),
    'feelings', ...(values.feelings?.length || values.custom_feeling?.trim() ? ['intensity' as const] : []),
    'context', 'thoughts', 'actions_taken', 'review'];
}

export function latestMoodDraft(entries: RatingEntry[]) {
  return entries.filter(entry => entry.status === 'draft')
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
}

export function skipMoodStep(values: RatingEntryValues, step: MoodStep): RatingEntryValues {
  if (step === 'additional_ratings') return { ...values, energy_value: null, sleep_quality_value: null, motivation_value: null };
  if (step === 'feelings') return { ...values, feelings: [], custom_feeling: null, feeling_intensity: null };
  if (step === 'intensity') return { ...values, feeling_intensity: null };
  if (step === 'context') return { ...values, context: null };
  if (step === 'thoughts') return { ...values, thoughts: null };
  if (step === 'actions_taken') return { ...values, actions_taken: null };
  return values;
}

// Serializes autosaves and reconciles a response lost after a successful write.
// Confirmation waits for every queued draft and reuses the same entry ID on retry.
export class MoodDraftWriter {
  private tail: Promise<unknown> = Promise.resolve();
  private revision: number | null;
  private saved: string | null;
  private api: {
    save: (values: RatingEntryValues, revision: number | null) => Promise<RatingEntry>;
    confirm: (values: RatingEntryValues, revision: number | null) => Promise<RatingEntry>;
    load: () => Promise<RatingEntry | undefined>;
  };
  constructor(api: MoodDraftWriter['api'], entry?: RatingEntry) {
    this.api = api;
    this.revision = entry?.revision ?? null;
    this.saved = entry ? JSON.stringify(cleanMoodValues(entry.values)) : null;
  }
  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const result = this.tail.then(work, work);
    this.tail = result.catch(() => undefined);
    return result;
  }
  save(values: RatingEntryValues) {
    const clean = cleanMoodValues(values);
    return this.enqueue(async () => {
      if (this.saved === JSON.stringify(clean)) return;
      let entry: RatingEntry;
      try { entry = await this.api.save(clean, this.revision); }
      catch (error) {
        const stored = await this.api.load().catch(() => undefined);
        // Compare only the submitted fields: the server may add defaults.
        if (!stored || stored.status !== 'draft' || !Object.entries(clean).every(([key, value]) =>
          JSON.stringify(stored.values[key as keyof RatingEntryValues]) === JSON.stringify(value))) throw error;
        entry = stored;
      }
      this.revision = entry.revision;
      this.saved = JSON.stringify(clean);
    });
  }
  confirm(values: RatingEntryValues) {
    return this.enqueue(() => this.api.confirm(cleanMoodValues(values), this.revision));
  }
}
