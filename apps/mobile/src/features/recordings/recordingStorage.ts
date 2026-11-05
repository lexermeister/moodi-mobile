import { Directory, File, FileMode, Paths } from 'expo-file-system';

import { isTranscriptTurn, type TranscriptTurn } from './transcriptionTypes';

export type RecordingMetadata = {
  id: string;
  fileName: string;
  createdAt: string;
  durationMs: number;
  sizeBytes: number;
  backendRecordingId?: string;
  processingStatus?: RecordingProcessingStatus;
  processingError?: string;
  transcript?: string;
  transcriptTurns?: TranscriptTurn[];
  transcriptionLanguages?: string[];
};

export type RecordingProcessingStatus =
  | 'local'
  | 'uploading'
  | 'transcribing'
  | 'completed'
  | 'failed';

const recordingsDirectory = new Directory(Paths.document, 'recordings');
const indexFile = new File(recordingsDirectory, 'index.json');

function ensureRecordingsDirectory() {
  recordingsDirectory.create({ idempotent: true, intermediates: true });
}

function isRecordingMetadata(value: unknown): value is RecordingMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<RecordingMetadata>;
  const processingStatuses: RecordingProcessingStatus[] = [
    'local',
    'uploading',
    'transcribing',
    'completed',
    'failed',
  ];

  return (
    typeof item.id === 'string' &&
    typeof item.fileName === 'string' &&
    item.fileName.endsWith('.m4a') &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    typeof item.durationMs === 'number' &&
    item.durationMs >= 0 &&
    typeof item.sizeBytes === 'number' &&
    item.sizeBytes > 0 &&
    (item.backendRecordingId === undefined || typeof item.backendRecordingId === 'string') &&
    (item.processingStatus === undefined || processingStatuses.includes(item.processingStatus)) &&
    (item.processingError === undefined || typeof item.processingError === 'string') &&
    (item.transcript === undefined || typeof item.transcript === 'string') &&
    (item.transcriptTurns === undefined ||
      (Array.isArray(item.transcriptTurns) && item.transcriptTurns.every(isTranscriptTurn))) &&
    (item.transcriptionLanguages === undefined ||
      (Array.isArray(item.transcriptionLanguages) &&
        item.transcriptionLanguages.every((language) => typeof language === 'string')))
  );
}

function createId(createdAt: Date) {
  const timestamp = createdAt.toISOString().replace(/[:.]/g, '-');
  const suffix = Math.random().toString(36).slice(2, 10);
  return `${timestamp}-${suffix}`;
}

function isVerifiedM4A(file: File) {
  if (!file.exists || file.size <= 0 || file.extension.toLowerCase() !== '.m4a') {
    return false;
  }

  const handle = file.open(FileMode.ReadOnly);
  try {
    const header = handle.readBytesSync(12);
    return (
      header.length >= 8 &&
      header[4] === 0x66 &&
      header[5] === 0x74 &&
      header[6] === 0x79 &&
      header[7] === 0x70
    );
  } finally {
    handle.close();
  }
}

async function writeIndex(recordings: RecordingMetadata[]) {
  ensureRecordingsDirectory();
  const temporaryIndex = new File(
    recordingsDirectory,
    `index-${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`,
  );
  let moved = false;

  try {
    temporaryIndex.create({ overwrite: true });
    await temporaryIndex.write(JSON.stringify(recordings, null, 2));
    await temporaryIndex.move(indexFile, { overwrite: true });
    moved = true;
  } finally {
    // File.move updates this object's URI to the destination, so only clean up
    // before a successful move or we would delete the completed index.
    if (!moved && temporaryIndex.exists) {
      temporaryIndex.delete();
    }
  }
}

export function getRecordingUri(recording: Pick<RecordingMetadata, 'fileName'>) {
  return new File(recordingsDirectory, recording.fileName).uri;
}

export async function loadRecordings(): Promise<RecordingMetadata[]> {
  ensureRecordingsDirectory();
  if (!indexFile.exists) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(await indexFile.text());
  } catch {
    await writeIndex([]);
    return [];
  }

  if (!Array.isArray(parsed)) {
    await writeIndex([]);
    return [];
  }

  const valid = parsed
    .filter(isRecordingMetadata)
    .filter((recording) => {
      const file = new File(recordingsDirectory, recording.fileName);
      return isVerifiedM4A(file);
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

  if (valid.length !== parsed.length) {
    await writeIndex(valid);
  }

  return valid;
}

export async function persistFinalizedRecording({
  sourceUri,
  createdAt,
  durationMs,
}: {
  sourceUri: string;
  createdAt: Date;
  durationMs: number;
}): Promise<RecordingMetadata> {
  ensureRecordingsDirectory();

  const source = new File(sourceUri);
  if (!isVerifiedM4A(source)) {
    throw new Error('The recording did not produce a valid M4A audio file.');
  }

  const id = createId(createdAt);
  const fileName = `${id}.m4a`;
  const destination = new File(recordingsDirectory, fileName);
  await source.copy(destination);

  if (!isVerifiedM4A(destination)) {
    if (destination.exists) {
      destination.delete();
    }
    throw new Error('The recording could not be verified after finalization.');
  }

  const recording: RecordingMetadata = {
    id,
    fileName,
    createdAt: createdAt.toISOString(),
    durationMs: Math.max(0, Math.round(durationMs)),
    sizeBytes: destination.size,
    processingStatus: 'local',
  };

  try {
    const existing = await loadRecordings();
    await writeIndex([recording, ...existing.filter((item) => item.id !== recording.id)]);
  } catch (error) {
    destination.delete();
    throw error;
  }

  if (source.uri !== destination.uri && source.exists) {
    source.delete();
  }

  if (__DEV__) {
    console.log(`[Moodi] Saved recording: ${destination.uri}`);
  }

  return recording;
}

export async function updatePersistedRecording(
  recording: RecordingMetadata,
): Promise<RecordingMetadata> {
  const existing = await loadRecordings();
  if (!existing.some((item) => item.id === recording.id)) {
    throw new Error('The local recording no longer exists.');
  }

  await writeIndex(existing.map((item) => (item.id === recording.id ? recording : item)));
  return recording;
}

export async function deletePersistedRecording(recording: RecordingMetadata) {
  const file = new File(recordingsDirectory, recording.fileName);
  if (file.exists) {
    file.delete();
  }

  const existing = await loadRecordings();
  await writeIndex(existing.filter((item) => item.id !== recording.id));
}
