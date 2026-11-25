import assert from 'node:assert/strict';
import test from 'node:test';
import { practiceSettings, practiceTitle, parsePracticeMinutes, timerSeconds, practiceSummary, practiceDateLabel, practiceTimeLabel, practiceLogTime } from '../src/features/actions/practiceFlowDomain.ts';
import { reviewableActionCandidates } from '../src/features/journey/sessionReviewDomain.ts';
import { completedActionTimeline } from '../src/features/journey/completedActionTimeline.ts';

const candidate = { type: 'practise_relaxation_breathing', exact_task: 'Repeat the breathing exercise',
  technique: null, resource_url: null, duration_minutes: null, repetitions: null, limits: null,
  frequency: null, timing: null };

test('practice defaults to daily without a time or invented duration', () => {
  const settings = practiceSettings(candidate);
  assert.equal(settings.frequency, 'Every day');
  assert.equal(settings.reminder_time, null);
  assert.equal(settings.duration_minutes, null);
  assert.equal(practiceSettings({ ...candidate, frequency: 'Once a week', timing: 'after work' }).frequency, 'Once a week');
  assert.equal(practiceTitle(settings), 'Practice breathing');
  assert.equal(practiceTitle({ ...settings, exact_task: 'Repeat muscle relaxation' }), 'Practice relaxation');
});

test('practice minutes are optional and support short attempts', () => {
  assert.equal(parsePracticeMinutes(''), null);
  assert.equal(parsePracticeMinutes('0.5'), 0.5);
  assert.equal(parsePracticeMinutes('0'), 0);
  assert.equal(parsePracticeMinutes('-1'), undefined);
  assert.equal(parsePracticeMinutes('three'), undefined);
});

test('elapsed timer preserves paused time and handles background gaps', () => {
  assert.equal(timerSeconds(35, null, 100000), 35);
  assert.equal(timerSeconds(35, 10000, 45000), 70);
});

test('practice review preserves optional values and a real zero rating', () => {
  const summary = practiceSummary({ relevant_date: '2026-11-25', outcome: 'stopped_early',
    actual_minutes: null, tension_before: 0, tension_after: 7, notes: null, timer_used: true,
    timer_elapsed_seconds: 35 });
  assert.equal(summary.tensionBefore, '0/10');
  assert.equal(summary.tensionAfter, '7/10');
  assert.equal(summary.duration, 'Not recorded');
  assert.equal(summary.date, practiceDateLabel('2026-11-25'));
  assert.equal(summary.notes, null);
});

test('practice dates keep the recorded calendar day across time zones', () => {
  const previous = process.env.TZ;
  try {
    for (const timezone of ['America/Los_Angeles', 'Pacific/Auckland', 'Europe/Belgrade']) {
      process.env.TZ = timezone;
      assert.equal(practiceDateLabel('2026-11-26'), new Date(2026, 10, 26, 12).toLocaleDateString(undefined,
        { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }));
    }
  } finally {
    if (previous === undefined) delete process.env.TZ;
    else process.env.TZ = previous;
  }
});

test('practice time labels use the local logging time at each boundary', () => {
  for (const [hour, expected] of [[0, 'Before Sleep'], [4, 'Before Sleep'], [5, 'Morning'],
    [11, 'Morning'], [12, 'Midday'], [16, 'Midday'], [17, 'Evening'], [20, 'Evening'],
    [21, 'Before Sleep'], [23, 'Before Sleep']]) {
    assert.equal(practiceTimeLabel(new Date(2026, 10, 26, hour, 0).toISOString()), expected);
  }
  assert.equal(practiceTimeLabel('invalid'), null);
});

test('review keeps the original logging period after an amendment', () => {
  const original = '2026-11-26T09:00:00Z';
  assert.equal(practiceLogTime({ updated_at: '2026-11-27T22:00:00Z', history: [
    { status: 'draft', saved_at: '2026-11-26T08:55:00Z' },
    { status: 'confirmed', saved_at: original },
  ] }), original);
  assert.equal(practiceLogTime({ updated_at: original, history: [] }), original);
});

test('practice coexists with other actions in review and confirmed Journey history', () => {
  const insights = { result: { action_candidates: [
    { id: 'C1', type: 'record_mood' }, { id: 'C2', ...candidate },
    { id: 'C3', type: 'do_enjoyable_or_meaningful_activity' },
  ] } };
  assert.equal(reviewableActionCandidates(insights).length, 3);
  const attempts = [{ id: 'p1', status: 'confirmed', outcome: 'partly_completed', updated_at: '2026-11-25T12:00:00Z', history: [] },
    { id: 'p2', status: 'draft', outcome: null, updated_at: '2026-11-25T12:00:00Z', history: [] }];
  assert.deepEqual(completedActionTimeline([], [], [], attempts)[0].map(row => row.id), ['practice:p1']);
});

test('practice amendments stay in the original Journey period', () => {
  const attempt = { id: 'p1', status: 'confirmed', outcome: 'completed', updated_at: '2026-11-27T12:00:00Z',
    history: [{ status: 'draft', saved_at: '2026-11-23T12:00:00Z' },
      { status: 'confirmed', saved_at: '2026-11-24T12:00:00Z' }] };
  const groups = completedActionTimeline([{ createdAt: '2026-11-25T12:00:00Z' }], [], [], [attempt]);
  assert.deepEqual(groups.map(group => group.map(row => row.id)), [[], ['practice:p1']]);
});

test('queued practice drafts and confirmation serialize revisions and recover lost responses', async () => {
  const { newPracticeData, PracticeAttemptWriter } = await import('../src/features/actions/practiceFlowDomain.ts');
  let saved;
  let loseResponse = true;
  const revisions = [];
  const writer = new PracticeAttemptWriter({
    save: async (data, revision) => {
      revisions.push(revision);
      saved = { ...data, revision: revision + 1 };
      if (loseResponse) { loseResponse = false; throw new Error('Lost response'); }
      return saved;
    }, load: async () => saved,
  });
  const draft = newPracticeData();
  const [, confirmed] = await Promise.all([writer.write(draft), writer.write({ ...draft, status: 'confirmed', outcome: 'completed' })]);
  assert.deepEqual(revisions, [0, 1]);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.revision, 2);
});

test('practice retries never overwrite a conflicting saved outcome', async () => {
  const { newPracticeData, PracticeAttemptWriter } = await import('../src/features/actions/practiceFlowDomain.ts');
  const values = newPracticeData();
  const writer = new PracticeAttemptWriter({ save: async () => { throw new Error('Conflict'); },
    load: async () => ({ ...values, notes: 'Changed elsewhere', revision: 2 }) });
  await assert.rejects(writer.write(values), /Conflict/);
  await assert.rejects(writer.write({ ...values, notes: 'My correction' }), /changed/);
});
