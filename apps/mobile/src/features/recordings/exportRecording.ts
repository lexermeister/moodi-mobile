import * as Sharing from 'expo-sharing';
import { getRecordingUri, type RecordingMetadata } from './recordingStorage';

export async function exportRecording(recording: RecordingMetadata) {
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(getRecordingUri(recording), {
    dialogTitle: 'Export Moodi recording', mimeType: 'audio/mp4', UTI: 'public.mpeg-4-audio',
  });
}
