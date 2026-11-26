import { AudioUploadError } from './audioUploadError';
import { File, UploadType } from 'expo-file-system';

export async function uploadAudioFile(uri: string, url: string, signal: AbortSignal) {
  const file = new File(uri);
  if (!file.exists || file.size <= 0) {
    throw new AudioUploadError('The local recording is missing or empty.');
  }
  return file.upload(url, {
    fieldName: 'file',
    httpMethod: 'POST',
    mimeType: 'audio/mp4',
    sessionType: 'foreground',
    signal,
    uploadType: UploadType.MULTIPART,
  });
}
