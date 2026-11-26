import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { registerHooks } from 'node:module';
import { afterEach, test } from 'node:test';
import 'fake-indexeddb/auto';

// Node does not resolve Metro's extensionless TypeScript imports by itself.
registerHooks({ resolve(specifier, context, next) {
  if (specifier.startsWith('.') && context.parentURL) {
    const candidate = new URL(`${specifier}.ts`, context.parentURL);
    if (existsSync(candidate)) return next(candidate.href, context);
  }
  return next(specifier, context);
} });

const storage = await import('../src/features/recordings/recordingStorage.web.ts');
const database = await import('../src/features/recordings/browserRecordingDatabase.ts');
const { encodeWav } = await import('../src/features/recordings/wavEncoding.ts');
const { uploadAudioFile } = await import('../src/features/recordings/uploadAudioFile.web.ts');
const createdAt = new Date('2026-11-26T10:00:00Z');

async function saveAudio(type = 'audio/wav') {
  const uri = URL.createObjectURL(new Blob([encodeWav(new Float32Array([0, 0.5, -0.5]))], { type }));
  try { return await storage.persistFinalizedRecording({ sourceUri: uri, createdAt, durationMs: 1234 }); }
  finally { URL.revokeObjectURL(uri); }
}

afterEach(async () => { await storage.clearPersistedRecordings(); });

test('audio and metadata survive reopening the library and editing metadata', async () => {
  const recording = await saveAudio();
  const original = await (await fetch(storage.getRecordingUri(recording))).arrayBuffer();
  await storage.updatePersistedRecording({ ...recording, transcript: 'synthetic test transcript' });
  // A fresh module models reload: blob URLs must be recreated from IndexedDB.
  const reloaded = await import('../src/features/recordings/recordingStorage.web.ts?reload');
  const [saved] = await reloaded.loadRecordings();
  assert.equal(saved.transcript, 'synthetic test transcript');
  assert.equal(saved.durationMs, 1234);
  assert.deepEqual(await (await fetch(reloaded.getRecordingUri(saved))).arrayBuffer(), original);
  await reloaded.clearPersistedRecordings();
});

test('simultaneous recording saves do not overwrite each other', async () => {
  const saved = await Promise.all([saveAudio(), saveAudio()]);
  assert.equal(new Set(saved.map(item => item.id)).size, 2);
  assert.equal((await storage.loadRecordings()).length, 2);
});

test('a failed write rejects and preserves the committed recording', async () => {
  const recording = await saveAudio();
  await assert.rejects(database.saveBrowserRecording(recording, new Blob(['replacement'])));
  const [saved] = await database.readBrowserRecordings();
  assert.equal(saved.audio.size, recording.sizeBytes);
  assert.equal((await storage.loadRecordings()).length, 1);
});

test('updating a deleted recording cannot resurrect it', async () => {
  const recording = await saveAudio();
  await storage.deletePersistedRecording(recording);
  await assert.rejects(storage.updatePersistedRecording(recording), /no longer exists/);
  assert.deepEqual(await storage.loadRecordings(), []);
  assert.throws(() => storage.getRecordingUri(recording), /missing/);
});

test('compressed browser audio is preserved locally for playback and export', async () => {
  const recording = await saveAudio('audio/webm;codecs=opus');
  assert.ok(recording.fileName.endsWith('.webm'));
  const [saved] = await storage.loadRecordings();
  assert.equal(saved.id, recording.id);
  assert.equal((await (await fetch(storage.getRecordingUri(saved))).blob()).type, 'audio/webm;codecs=opus');
});

test('empty or unknown audio cannot create a saved recording', async () => {
  const uri = URL.createObjectURL(new Blob([]));
  try {
    await assert.rejects(storage.persistFinalizedRecording({ sourceUri: uri, createdAt, durationMs: 0 }), /empty/);
  } finally { URL.revokeObjectURL(uri); }
  await assert.rejects(saveAudio('text/plain'), /unsupported/);
  assert.deepEqual(await storage.loadRecordings(), []);
});

test('browser uploads use real multipart WAV bytes and propagate the abort signal', async () => {
  const recording = await saveAudio();
  const originalFetch = globalThis.fetch;
  const signal = new AbortController().signal;
  globalThis.fetch = async (url, options) => {
    if (url !== 'https://api.example/recordings') return originalFetch(url, options);
    assert.equal(options.signal, signal);
    assert.equal(options.method, 'POST');
    assert.equal(options.headers, undefined); // The browser must supply the multipart boundary.
    const file = options.body.get('file');
    assert.equal(file.name, 'recording.wav');
    assert.equal(file.type, 'audio/wav');
    assert.equal(file.size, recording.sizeBytes);
    return Response.json({ status: 'saved' }, { status: 201 });
  };
  try {
    assert.deepEqual(await uploadAudioFile(storage.getRecordingUri(recording), 'https://api.example/recordings', signal),
      { status: 201, body: '{"status":"saved"}' });
  } finally { globalThis.fetch = originalFetch; }
});

test('clearing the library removes both audio and metadata', async () => {
  const recording = await saveAudio();
  await storage.clearPersistedRecordings();
  assert.deepEqual(await database.readBrowserRecordings(), []);
  assert.throws(() => storage.getRecordingUri(recording), /missing/);
});

test('audio-only MP4 uploads normalize the MIME type accepted by the backend', async () => {
  const recording = await saveAudio('video/mp4');
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, options) => {
    if (url !== 'https://api.example/recordings') return originalFetch(url, options);
    const file = options.body.get('file');
    assert.equal(file.type, 'audio/mp4');
    assert.equal(file.name, 'recording.m4a');
    return new Response('', { status: 201 });
  };
  try {
    await uploadAudioFile(storage.getRecordingUri(recording), 'https://api.example/recordings', new AbortController().signal);
  } finally { globalThis.fetch = originalFetch; }
});
