import assert from 'node:assert/strict';
import test from 'node:test';
import { cleanMoodValues, latestMoodDraft, moodSteps, MoodDraftWriter, skipMoodStep } from '../src/features/actions/moodWizardDomain.ts';

const values = { relevant_date: '2026-11-16', entry_time: '2026-11-16T12:00:00Z', timezone_offset_minutes: 0,
  day_key: '2026-11-16', mood_value: 0, mood_label: null, context: null, scale_id: 'overall-day-mood-0-10-v1', current_step: 'review' };

test('only selected questions appear and intensity depends on a supplied feeling', () => {
  assert.deepEqual(moodSteps(['mood'], values), ['mood', 'feelings', 'context', 'review']);
  assert.deepEqual(moodSteps(['mood', 'energy'], { ...values, custom_feeling: ' hopeful ' }),
    ['mood', 'additional_ratings', 'feelings', 'intensity', 'context', 'review']);
  assert.equal(moodSteps(['mood'], { ...values, custom_feeling: '  ' }).includes('intensity'), false);
});

test('skipping feelings clears dependent intensity, preserves zero mood and other answers', () => {
  const skipped = skipMoodStep({ ...values, energy_value: 0, feelings: ['Calm'], feeling_intensity: 0 }, 'feelings');
  assert.equal(skipped.feeling_intensity, null);
  assert.deepEqual(skipped.feelings, []);
  assert.equal(skipped.energy_value, 0);
  assert.equal(skipped.mood_value, 0);
  assert.equal(cleanMoodValues({ ...values, custom_feeling: ' ', feeling_intensity: 7 }).feeling_intensity, null);
});

test('resume finds latest unfinished entry even when a newer confirmed entry exists', () => {
  const draft = { id: 'draft', status: 'draft', updated_at: '2026-11-15' };
  assert.equal(latestMoodDraft([draft, { id: 'confirmed', status: 'confirmed', updated_at: '2026-11-16' }]).id, 'draft');
});

test('autosaves serialize revisions and confirmation waits for all answers', async () => {
  const calls = [];
  let revision = 0;
  const writer = new MoodDraftWriter({
    save: async (v, expected) => {
      assert.equal(expected, revision || null);
      await new Promise(resolve => setTimeout(resolve, 5));
      calls.push(v.mood_value);
      return { values: v, revision: ++revision, status: 'draft' };
    },
    confirm: async (v, expected) => { assert.equal(expected, 2); calls.push('confirmed'); return { values: v }; },
    load: async () => undefined,
  });
  await Promise.all([writer.save(values), writer.save({ ...values, mood_value: 8 }), writer.confirm({ ...values, mood_value: 8 })]);
  assert.deepEqual(calls, [0, 8, 'confirmed']);
});

test('lost draft response reconciles persisted answer before next save', async () => {
  let stored;
  let calls = 0;
  const writer = new MoodDraftWriter({
    save: async (v, expected) => {
      if (++calls === 1) { stored = { status: 'draft', values: v, revision: 1 }; throw new Error('Network response lost'); }
      assert.equal(expected, 1);
      return { status: 'draft', values: v, revision: 2 };
    }, load: async () => stored, confirm: async () => undefined,
  });
  await writer.save(values);
  await writer.save({ ...values, mood_value: 4 });
});

test('conflicting saved answers are not overwritten during recovery; failed saves can retry', async () => {
  let fail = true;
  const writer = new MoodDraftWriter({
    save: async v => { if (fail) throw new Error('Conflict'); return { values: v, revision: 1 }; },
    load: async () => ({ status: 'draft', values: { ...values, mood_value: 9 }, revision: 5 }),
    confirm: async () => undefined,
  });
  await assert.rejects(writer.save(values), /Conflict/);
  fail = false;
  await writer.save(values);
});
