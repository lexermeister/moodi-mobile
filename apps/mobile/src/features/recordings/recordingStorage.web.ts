import type { RecordingMetadata } from './recordingStorage';
import { validateBrowserAudio } from './browserAudio.ts';

export type { RecordingFailedStage, RecordingMetadata, RecordingProcessingStatus } from './recordingStorage';

type StoredRecording = { id: string; metadata: RecordingMetadata; audio: Blob };
const urls = new Map<string, string>();
let databasePromise: Promise<IDBDatabase> | undefined;

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('This browser cannot store recordings. Use a browser with IndexedDB enabled.'));
  }
  databasePromise ??= new Promise((resolve, reject) => {
    const operation = indexedDB.open('moodi-recordings', 1);
    operation.onupgradeneeded = () => operation.result.createObjectStore('recordings', { keyPath: 'id' });
    operation.onsuccess = () => resolve(operation.result);
    operation.onerror = () => { databasePromise = undefined; reject(operation.error); };
  });
  return databasePromise;
}

async function request<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('recordings', mode);
    const operation = work(transaction.objectStore('recordings'));
    let result: T;
    operation.onsuccess = () => { result = operation.result; };
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error ?? operation.error);
    transaction.onabort = () => reject(transaction.error ?? new Error('Recording storage was interrupted.'));
  });
}

function cacheAudio(recording: StoredRecording) {
  const name = recording.metadata.fileName;
  if (!urls.has(name)) urls.set(name, URL.createObjectURL(recording.audio));
}

export function getRecordingUri(recording: Pick<RecordingMetadata, 'fileName'>): string {
  const uri = urls.get(recording.fileName);
  if (!uri) throw new Error('The local recording is unavailable. Reload the recording library.');
  return uri;
}

export async function loadRecordings(): Promise<RecordingMetadata[]> {
  const recordings = await request<StoredRecording[]>('readonly', store => store.getAll());
  recordings.forEach(cacheAudio);
  return recordings.map(item => item.metadata).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function persistFinalizedRecording({ sourceUri, createdAt, durationMs }: {
  sourceUri: string; createdAt: Date; durationMs: number;
}): Promise<RecordingMetadata> {
  const response = await fetch(sourceUri);
  if (!response.ok) throw new Error('The browser recording could not be read.');
  const audio = await response.blob();
  const extension = await validateBrowserAudio(audio);
  const id = crypto.randomUUID();
  const year = createdAt.getFullYear();
  const month = String(createdAt.getMonth() + 1).padStart(2, '0');
  const day = String(createdAt.getDate()).padStart(2, '0');
  const metadata: RecordingMetadata = {
    id, fileName: `${id}.${extension}`, createdAt: createdAt.toISOString(),
    sessionDate: `${year}-${month}-${day}`, durationMs: Math.max(0, Math.round(durationMs)),
    sizeBytes: audio.size, processingStatus: 'local',
  };
  const saved: StoredRecording = { id, metadata, audio };
  await request('readwrite', store => store.add(saved));
  cacheAudio(saved);
  if (sourceUri.startsWith('blob:')) URL.revokeObjectURL(sourceUri);
  return metadata;
}

export async function updatePersistedRecording(recording: RecordingMetadata): Promise<RecordingMetadata> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction('recordings', 'readwrite');
    const store = transaction.objectStore('recordings');
    const operation = store.get(recording.id);
    let missing = false;
    operation.onsuccess = () => {
      const existing = operation.result as StoredRecording | undefined;
      if (!existing) { missing = true; transaction.abort(); return; }
      store.put({ ...existing, metadata: recording });
    };
    transaction.oncomplete = () => resolve(recording);
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(missing
      ? new Error('The local recording no longer exists.')
      : transaction.error ?? new Error('The recording update was interrupted.'));
  });
}

export async function deletePersistedRecording(recording: RecordingMetadata) {
  await request('readwrite', store => store.delete(recording.id));
  const uri = urls.get(recording.fileName);
  if (uri) URL.revokeObjectURL(uri);
  urls.delete(recording.fileName);
}

export async function clearPersistedRecordings() {
  await request('readwrite', store => store.clear());
  urls.forEach(uri => URL.revokeObjectURL(uri));
  urls.clear();
}
