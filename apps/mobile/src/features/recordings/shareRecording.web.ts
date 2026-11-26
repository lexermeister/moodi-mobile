import { downloadFile } from '@/lib/downloadFile';
import { getRecordingUri, type RecordingMetadata } from './recordingStorage';

export async function exportRecording(recording: RecordingMetadata) {
  downloadFile(getRecordingUri(recording), recording.fileName);
}
