import { AudioUploadError } from './audioUploadError';
import { encodeWav, MAX_WEB_AUDIO_BYTES, WEB_SAMPLE_RATE } from './wavEncoding';

export async function prepareBrowserAudio(audio: Blob) {
  const encoded = await audio.arrayBuffer();
  if (!encoded.byteLength) throw new AudioUploadError('The recording is empty.');
  const context = new AudioContext();
  try {
    const decoded = await context.decodeAudioData(encoded).catch(() => {
      throw new AudioUploadError('This browser could not decode the recording. Export it and try another browser.');
    });
    const length = Math.ceil(decoded.duration * WEB_SAMPLE_RATE);
    if (!length || length * 2 + 44 > MAX_WEB_AUDIO_BYTES) {
      throw new AudioUploadError('This browser recording exceeds the 25 MB transcription limit. Record a shorter session.');
    }
    const offline = new OfflineAudioContext(1, length, WEB_SAMPLE_RATE);
    const source = offline.createBufferSource();
    source.buffer = decoded;
    source.connect(offline.destination);
    source.start();
    const rendered = await offline.startRendering();
    return {
      audio: new Blob([encodeWav(rendered.getChannelData(0))], { type: 'audio/wav' }),
      durationMs: Math.round(decoded.duration * 1000),
    };
  } finally {
    await context.close();
  }
}
