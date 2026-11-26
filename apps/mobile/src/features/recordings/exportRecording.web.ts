import { getRecordingUri, type RecordingMetadata } from './recordingStorage';

export async function exportRecording(recording: RecordingMetadata) {
  const link = document.createElement('a');
  link.href = getRecordingUri(recording);
  link.download = recording.fileName;
  document.body.append(link);
  link.click();
  link.remove();
}
