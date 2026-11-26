import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import test from 'node:test';
import { uploadAudio } from '../src/features/recordings/uploadAudio.web.ts';

test('browser upload sends its real WebM container as multipart file data', async () => {
  let received = '';
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = Buffer.concat(chunks).toString('latin1');
    response.writeHead(201, { 'Content-Type': 'application/json' });
    response.end('{"status":"saved"}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const uri = URL.createObjectURL(new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3, 0, 1])], { type: 'audio/webm' }));
  try {
    const result = await uploadAudio(uri, `http://127.0.0.1:${server.address().port}/recordings`, new AbortController().signal);
    assert.equal(result.status, 201);
    assert.equal(result.body, '{"status":"saved"}');
    assert.match(received, /name="file"; filename="recording.webm"/);
    assert.match(received, /Content-Type: audio\/webm/);
    assert.equal(received.includes('recording.m4a'), false);
  } finally {
    URL.revokeObjectURL(uri);
    await new Promise(resolve => server.close(resolve));
  }
});

test('oversized audio is rejected before an upload starts', async () => {
  const uri = URL.createObjectURL(new Blob([
    new Uint8Array([0x1a, 0x45, 0xdf, 0xa3]), new Uint8Array(25 * 1024 * 1024),
  ], { type: 'audio/webm' }));
  try {
    await assert.rejects(uploadAudio(uri, 'http://127.0.0.1:1/recordings', new AbortController().signal), /25 MB/);
  } finally { URL.revokeObjectURL(uri); }
});

test('MP4 browser audio uses the audio MIME required by the backend M4A endpoint', async () => {
  let received;
  const server = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    received = Buffer.concat(chunks);
    response.writeHead(201, { 'Content-Type': 'application/json' });
    response.end('{"status":"saved"}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const audio = new Uint8Array([0, 0, 0, 24, 102, 116, 121, 112, 77, 52, 65, 32]);
  const uri = URL.createObjectURL(new Blob([audio], { type: 'video/mp4' }));
  try {
    const result = await uploadAudio(uri, `http://127.0.0.1:${server.address().port}/recordings`, new AbortController().signal);
    assert.equal(result.status, 201);
    assert.match(received.toString('latin1'), /filename="recording.m4a"/);
    assert.match(received.toString('latin1'), /Content-Type: audio\/mp4/);
    assert.equal(received.includes(Buffer.from(audio)), true);
  } finally {
    URL.revokeObjectURL(uri);
    await new Promise(resolve => server.close(resolve));
  }
});
