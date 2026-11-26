export const WEB_SAMPLE_RATE = 16_000;
export const MAX_WEB_AUDIO_BYTES = 25 * 1024 * 1024;

// Mono PCM16 keeps browser audio inside the existing WAV transcription contract.
export function encodeWav(samples: Float32Array): ArrayBuffer {
  const size = 44 + samples.length * 2;
  if (!samples.length) throw new Error('The recording is empty.');
  if (size > MAX_WEB_AUDIO_BYTES) {
    throw new Error('This browser recording exceeds the 25 MB transcription limit. Record a shorter session.');
  }
  const buffer = new ArrayBuffer(size);
  const view = new DataView(buffer);
  const text = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(offset + i, value.charCodeAt(i));
  };
  text(0, 'RIFF');
  view.setUint32(4, size - 8, true);
  text(8, 'WAVE');
  text(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, WEB_SAMPLE_RATE, true);
  view.setUint32(28, WEB_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  text(36, 'data');
  view.setUint32(40, size - 44, true);
  for (let i = 0; i < samples.length; i++) {
    const sample = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(44 + i * 2, Math.round(sample * (sample < 0 ? 0x8000 : 0x7fff)), true);
  }
  return buffer;
}
