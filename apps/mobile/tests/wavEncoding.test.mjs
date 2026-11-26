import assert from 'node:assert/strict';
import test from 'node:test';
import { encodeWav, MAX_WEB_AUDIO_BYTES, WEB_SAMPLE_RATE } from '../src/features/recordings/wavEncoding.ts';

test('WAV header describes mono 16 kHz PCM16 with clamped signed samples', () => {
  const buffer = encodeWav(new Float32Array([-2, -1, 0, 1, 2]));
  const view = new DataView(buffer);
  assert.equal(new TextDecoder().decode(buffer.slice(0, 4)), 'RIFF');
  assert.equal(new TextDecoder().decode(buffer.slice(8, 12)), 'WAVE');
  assert.equal(view.getUint32(4, true), buffer.byteLength - 8);
  assert.equal(view.getUint16(20, true), 1);
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), WEB_SAMPLE_RATE);
  assert.equal(view.getUint16(34, true), 16);
  assert.equal(view.getUint32(40, true), 10);
  assert.deepEqual(Array.from({ length: 5 }, (_, i) => view.getInt16(44 + i * 2, true)),
    [-32768, -32768, 0, 32767, 32767]);
});

test('empty and oversized WAV recordings are rejected before allocation', () => {
  assert.throws(() => encodeWav(new Float32Array()), /empty/);
  assert.throws(() => encodeWav(new Float32Array(MAX_WEB_AUDIO_BYTES / 2)), /25 MB/);
});
