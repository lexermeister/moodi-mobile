import { AudioUploadError } from './audioUploadError';
import { prepareBrowserAudio } from './browserAudio';
import { browserAudioExtension } from './browserRecordingFormat';
import { MAX_WEB_AUDIO_BYTES } from './wavEncoding';

export async function uploadAudioFile(uri: string, url: string, signal: AbortSignal) {
  const local = await fetch(uri, { signal });
  if (!local.ok) throw new AudioUploadError('The local recording is missing.');
  const audio = await local.blob();
  if (!audio.size) throw new AudioUploadError('The local recording is empty.');
  const extension = browserAudioExtension(audio.type);
  const upload = extension === '.m4a' || extension === '.wav'
    ? audio : (await prepareBrowserAudio(audio)).audio;
  if (upload.size > MAX_WEB_AUDIO_BYTES) {
    throw new AudioUploadError('This recording exceeds the 25 MB transcription limit. Export it or record a shorter session.');
  }
  const body = new FormData();
  // Safari may label an audio-only MP4 blob as video/mp4. Normalize the upload MIME type.
  const file = new Blob([upload], { type: extension === '.m4a' ? 'audio/mp4' : 'audio/wav' });
  body.append('file', file, extension === '.m4a' ? 'recording.m4a' : 'recording.wav');
  const response = await fetch(url, { method: 'POST', body, signal });
  return { status: response.status, body: await response.text() };
}
