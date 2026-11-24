import assert from 'node:assert/strict';
import test from 'node:test';
import { activityCandidates, recordMoodCandidates, reviewableActionCandidates, summaryReviewRequest } from '../src/features/journey/sessionReviewDomain.ts';

const insights = {
  draft_id: 'draft-1', source_version: 'source-1', result: { status: 'draft',
    action_candidates: [{ id: 'mood', type: 'record_mood' }, { id: 'other', type: 'record_rating' }],
    sections: [{ bullets: [{ item_id: 'a', text: 'First point' }, { item_id: 'b', text: 'Second point' }] }],
  },
};

test('the action review step shows only Record mood and keeps summary review separate', () => {
  assert.deepEqual(recordMoodCandidates(insights).map(candidate => candidate.id), ['mood']);
  assert.deepEqual(summaryReviewRequest(insights), {
    draft_id: 'draft-1', source_version: 'source-1',
    items: [
      { item_id: 'a', disposition: 'retained', displayed_text: 'First point' },
      { item_id: 'b', disposition: 'retained', displayed_text: 'Second point' },
    ],
  });
});

test('review includes activity candidates in transcript order', () => {
  const withActivity = { ...insights, result: { ...insights.result, action_candidates: [
    { id: 'activity', type: 'do_enjoyable_or_meaningful_activity' },
    ...insights.result.action_candidates,
  ] } };
  assert.deepEqual(reviewableActionCandidates(withActivity).map(candidate => candidate.id), ['activity', 'mood']);
});

test('review shows an activity only once when an older draft contains several variants', () => {
  const withDuplicates = { ...insights, result: { ...insights.result, action_candidates: [
    { id: 'first', type: 'do_enjoyable_or_meaningful_activity', frequency: 'daily' },
    { id: 'second', type: 'do_enjoyable_or_meaningful_activity', frequency: 'weekly' },
    ...insights.result.action_candidates,
    { id: 'third', type: 'do_enjoyable_or_meaningful_activity', timing: 'evening' },
  ] } };
  assert.deepEqual(activityCandidates(withDuplicates).map(candidate => candidate.id), ['first']);
  assert.deepEqual(reviewableActionCandidates(withDuplicates).map(candidate => candidate.id), ['first', 'mood']);
});

test('a limited or unidentifiable summary cannot be marked reviewed', () => {
  assert.equal(summaryReviewRequest({ ...insights, result: { ...insights.result, status: 'insufficient_source' } }), null);
  assert.equal(summaryReviewRequest({ ...insights, result: { ...insights.result, sections: [{ bullets: [{ text: 'No ID' }] }] } }), null);
  assert.equal(summaryReviewRequest({ ...insights, result: { ...insights.result, sections: [] } }), null);
});
