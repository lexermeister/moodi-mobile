import assert from 'node:assert/strict';
import test from 'node:test';
import { activityAgreementText, activityChoices, formatElapsed, newActivityAttemptId, parseOptionalMinutes } from '../src/features/actions/activityFlowDomain.ts';

const general = {
  settings: { assignment_kind: 'general', agreed_activity: null },
  source_ids: ['S1'],
  activity_mentions: [
    { label: 'Call a friend', source_ids: ['S2'] },
    { label: 'Call a friend', source_ids: ['S3'] },
    { label: 'Draw', source_ids: ['S4'] },
  ],
};

test('session ideas come first and duplicate labels are removed', () => {
  const choices = activityChoices(general, [
    { id: 'call', label: 'Call a friend', source: 'moodi_prototype_v1' },
    { id: 'album', label: 'Listen to an album', source: 'moodi_prototype_v1' },
  ]);
  assert.deepEqual(choices.map(item => [item.origin, item.label]), [
    ['session_mention', 'Call a friend'],
    ['session_mention', 'Draw'],
    ['predefined', 'Listen to an album'],
  ]);
  assert.deepEqual(choices[0].source_ids, ['S2']);
});

test('a specific agreement is the only choice', () => {
  const choices = activityChoices({ ...general, settings: {
    assignment_kind: 'specific', agreed_activity: 'Call a friend',
  } }, [{ id: 'album', label: 'Listen to an album', source: 'moodi_prototype_v1' }]);
  assert.deepEqual(choices, [{ origin: 'agreed', label: 'Call a friend',
    suggestion_id: null, source_ids: ['S1'] }]);
});

test('general agreement copy matches the review and check-in dialog', () => {
  assert.equal(activityAgreementText({ assignment_kind: 'general', agreed_activity: null,
    exact_task: 'Do something enjoyable', frequency: 'this week', reference_period: null }),
  'You agreed to make time for one thing you enjoy or find meaningful this week. You can decide what it is when you’re ready.');
});

test('duration and timer helpers keep optional time distinct from completion', () => {
  assert.equal(parseOptionalMinutes(''), null);
  assert.equal(parseOptionalMinutes('15'), 15);
  assert.equal(parseOptionalMinutes('0'), undefined);
  assert.equal(parseOptionalMinutes('15 minutes'), undefined);
  assert.equal(formatElapsed(75), '01:15');
  assert.match(newActivityAttemptId(), /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});
