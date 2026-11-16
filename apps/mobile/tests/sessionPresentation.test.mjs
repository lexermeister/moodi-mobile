import assert from 'node:assert/strict';
import test from 'node:test';
import { isProcessing, sessionDate, sessionProcessingMessage, sessionStatus, sortedSessions } from '../src/features/journey/sessionPresentation.ts';
const recording = (id, overrides = {}) => ({ id, createdAt: '2026-11-13T15:00:00Z', durationMs: 60000, sizeBytes: 100, fileName: `${id}.m4a`, ...overrides });
test('sorts by session calendar day, breaks ties by capture time, and preserves the library order', () => {
  const records = [recording('older', { sessionDate: '2026-11-01' }), recording('later'), recording('earlier', { createdAt: '2026-11-13T12:00:00Z' })];
  assert.deepEqual(sortedSessions(records).map(r => r.id), ['later', 'earlier', 'older']);
  assert.equal(records[0].id, 'older');
  assert.equal(sessionDate(records[0]).getDate(), 1);
});
test('does not present a stale review as reviewed and gives failure precedence', () => {
  const item = recording('review', { sessionInsights: { draft_id: 'current', source_version: 'v2', result: { status: 'draft' } }, sessionInsightsReview: { draft_id: 'old', source_version: 'v1' } });
  assert.equal(sessionStatus(item), 'Ready to review');
  item.sessionInsightsReview = { draft_id: 'current', source_version: 'v2' };
  assert.equal(sessionStatus(item), 'Reviewed');
  assert.equal(sessionStatus({ ...item, processingStatus: 'failed' }), 'Needs retry');
  assert.equal(sessionStatus({ ...item, processingStatus: 'transcribing' }), 'Processing');
});
test('handles legacy local sessions and insufficient source without implying a complete summary', () => {
  assert.equal(sessionStatus(recording('legacy')), 'Saved');
  assert.equal(sessionStatus(recording('partial', { sessionInsights: { result: { status: 'insufficient_source' } } })), 'Limited summary');
});
test('describes each automatic processing stage and treats the transcript handoff as busy', () => {
  assert.equal(sessionProcessingMessage(recording('saved')), 'Saving your recording…');
  assert.equal(sessionProcessingMessage(recording('upload', { processingStatus: 'uploading' })), 'Uploading your recording…');
  assert.equal(sessionProcessingMessage(recording('transcript', { processingStatus: 'transcribing' })), 'Preparing the transcript…');
  assert.equal(sessionProcessingMessage(recording('summary', { processingStatus: 'generating_insights' })), 'Generating the session summary…');
  assert.equal(isProcessing(recording('handoff', { processingStatus: 'ready_for_insights' })), true);
  assert.equal(sessionProcessingMessage(recording('failure', { processingStatus: 'failed', processingError: 'Network unavailable' })), 'Network unavailable');
  assert.equal(sessionProcessingMessage(recording('ready', { processingStatus: 'completed' })), null);
});
