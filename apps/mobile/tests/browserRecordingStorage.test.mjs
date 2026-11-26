import 'fake-indexeddb/auto';
import assert from 'node:assert/strict';
import test from 'node:test';
import { clearPersistedRecordings, deletePersistedRecording, getRecordingUri, loadRecordings,
  persistFinalizedRecording, updatePersistedRecording } from '../src/features/recordings/recordingStorage.web.ts';

function browserAudio() {
  return new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4])], { type: 'audio/webm;codecs=opus' });
}
async function save(blob = browserAudio()) {
  const sourceUri = URL.createObjectURL(blob);
  try { return await persistFinalizedRecording({ sourceUri, createdAt: new Date('2026-11-26T10:00:00Z'), durationMs: 2500 }); }
  finally { URL.revokeObjectURL(sourceUri); }
}

test('browser audio retains its real container and bytes across loading', async () => {
  await clearPersistedRecordings();
  const recording = await save();
  assert.match(recording.fileName, /\.webm$/);
  const loaded = await loadRecordings();
  assert.equal(loaded.length, 1);
  assert.equal(loaded[0].durationMs, 2500);
  assert.equal(loaded[0].processingStatus, 'local');
  assert.deepEqual(new Uint8Array(await (await fetch(getRecordingUri(loaded[0]))).arrayBuffer()),
    new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 1, 2, 3, 4]));
});

test('concurrent browser saves and processing updates retain both recordings', async () => {
  await clearPersistedRecordings();
  const [a, b] = await Promise.all([save(), save()]);
  await Promise.all([
    updatePersistedRecording({ ...a, processingStatus: 'transcribing', backendRecordingId: 'server-a' }),
    updatePersistedRecording({ ...b, processingStatus: 'failed', processingError: 'Offline' }),
  ]);
  const loaded = await loadRecordings();
  assert.equal(loaded.length, 2);
  assert.equal(loaded.find(item => item.id === a.id).backendRecordingId, 'server-a');
  assert.equal(loaded.find(item => item.id === b.id).processingError, 'Offline');
  await deletePersistedRecording(a);
  assert.deepEqual((await loadRecordings()).map(item => item.id), [b.id]);
  await assert.rejects(updatePersistedRecording(a), /no longer exists/);
});

test('invalid or empty browser recordings never enter the saved library', async () => {
  await clearPersistedRecordings();
  await assert.rejects(save(new Blob([], { type: 'audio/webm' })), /empty/);
  await assert.rejects(save(new Blob(['text'], { type: 'text/plain' })), /supported/);
  await assert.rejects(save(new Blob(['not audio'], { type: 'audio/webm' })), /valid/);
  assert.deepEqual(await loadRecordings(), []);
});
