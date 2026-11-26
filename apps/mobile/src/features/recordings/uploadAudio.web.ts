import { validateBrowserAudio } from './browserAudio.ts';

export async function uploadAudio(uri: string, url: string, signal: AbortSignal) {
  const local = await fetch(uri, { signal });
  if (!local.ok) throw new Error('The local recording is unavailable.');
  const audio = await local.blob();
  const extension = await validateBrowserAudio(audio);
  if (audio.size > 25 * 1024 * 1024) {
    throw new Error('This recording exceeds the 25 MB transcription limit. Please use a shorter recording.');
  }
  const form = new FormData();
  // MediaRecorder can label an audio-only MP4 as video/mp4; the M4A API expects audio/mp4.
  const upload = extension === 'm4a' ? new Blob([audio], { type: 'audio/mp4' }) : audio;
  form.append('file', upload, `recording.${extension}`);
  const response = await fetch(url, { method: 'POST', body: form, signal });
  return { status: response.status, body: await response.text() };
}
