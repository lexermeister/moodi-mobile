import { isSessionInsightsResponse } from './sessionInsightsTypes';
import { isRecordingMetadata, type RecordingMetadata } from './recordingMetadata';
import {
  readBrowserRecordings, saveBrowserRecording, updateBrowserRecording,
  removeBrowserRecording, clearBrowserRecordings,
} from './browserRecordingDatabase';
import { browserAudioExtension } from './browserRecordingFormat';

export type { RecordingMetadata, RecordingFailedStage, RecordingProcessingStatus } from './recordingMetadata';

const recordingUrls = new Map<string, string>();

function rememberAudio(fileName: string, audio: Blob) {
  if (!recordingUrls.has(fileName)) recordingUrls.set(fileName, URL.createObjectURL(audio));
}

function releaseAudio(fileName: string) {
  const uri = recordingUrls.get(fileName);
  if (uri) URL.revokeObjectURL(uri);
  recordingUrls.delete(fileName);
}

export function getRecordingUri(recording: Pick<RecordingMetadata, 'fileName'>) {
  const uri = recordingUrls.get(recording.fileName);
  if (!uri) throw new Error('The local recording is missing. Reload Moodi and try again.');
  return uri;
}

export async function loadRecordings(): Promise<RecordingMetadata[]> {
  const saved = await readBrowserRecordings();
  const recordings: RecordingMetadata[] = [];
  for (const item of saved) {
    if (!isRecordingMetadata(item.metadata, ['.wav', '.m4a', '.webm', '.ogg']) || !(item.audio instanceof Blob) || !item.audio.size) {
      continue;
    }
    let recording: RecordingMetadata = item.metadata as RecordingMetadata;
    if (recording.sessionInsights !== undefined && !isSessionInsightsResponse(recording.sessionInsights)) {
      const { sessionInsights: _staleInsights, sessionInsightsReview: _staleReview, ...current } = recording;
      recording = { ...current, processingStatus: current.transcript ? 'ready_for_insights' : 'local' };
      await updateBrowserRecording(recording);
    } else if (recording.processingStatus === 'completed' && !recording.sessionInsights && recording.transcript) {
      recording = { ...recording, processingStatus: 'ready_for_insights' };
      await updateBrowserRecording(recording);
    }
    rememberAudio(recording.fileName, item.audio);
    recordings.push(recording);
  }
  return recordings.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}

export async function persistFinalizedRecording({ sourceUri, createdAt, durationMs }: {
  sourceUri: string; createdAt: Date; durationMs: number;
}): Promise<RecordingMetadata> {
  const response = await fetch(sourceUri);
  if (!response.ok) throw new Error('The recording audio could not be read.');
  const audio = await response.blob();
  if (!audio.size) throw new Error('The recording is empty.');
  const extension = browserAudioExtension(audio.type);
  const id = crypto.randomUUID();
  const recording: RecordingMetadata = {
    id, fileName: `${id}${extension}`, createdAt: createdAt.toISOString(),
    sessionDate: `${createdAt.getFullYear()}-${`${createdAt.getMonth() + 1}`.padStart(2, '0')}-${`${createdAt.getDate()}`.padStart(2, '0')}`,
    durationMs: Math.max(0, Math.round(durationMs)), sizeBytes: audio.size, processingStatus: 'local',
  };
  await saveBrowserRecording(recording, audio);
  rememberAudio(recording.fileName, audio);
  if (sourceUri.startsWith('blob:')) URL.revokeObjectURL(sourceUri);
  return recording;
}

export async function updatePersistedRecording(recording: RecordingMetadata): Promise<RecordingMetadata> {
  await updateBrowserRecording(recording);
  return recording;
}

export async function deletePersistedRecording(recording: RecordingMetadata) {
  await removeBrowserRecording(recording.id);
  releaseAudio(recording.fileName);
}

export async function clearPersistedRecordings() {
  await clearBrowserRecordings();
  for (const fileName of recordingUrls.keys()) releaseAudio(fileName);
}
