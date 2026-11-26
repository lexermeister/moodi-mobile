import type { RecordingMetadata } from './recordingMetadata';

type StoredRecording = { metadata: RecordingMetadata; audio: Blob };
const DATABASE = 'moodi-recordings';
const STORE = 'recordings';

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('Browser storage is unavailable. Allow site storage and try again.'));
  }
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(STORE, { keyPath: 'metadata.id' });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('Saved recordings could not be opened.'));
  });
}

async function transaction<T>(
  mode: IDBTransactionMode,
  operation: (store: IDBObjectStore, result: (value: T) => void) => void,
): Promise<T> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    // Success is reported only after the entire transaction commits, including audio.
    const tx = database.transaction(STORE, mode);
    let value: T;
    tx.oncomplete = () => { database.close(); resolve(value); };
    tx.onabort = () => {
      database.close();
      reject(new Error(tx.error?.name === 'QuotaExceededError'
        ? 'Browser storage is full. Export or remove older recordings and try again.'
        : 'The recording could not be saved or loaded. Please try again.'));
    };
    try {
      operation(tx.objectStore(STORE), result => { value = result; });
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}

export function readBrowserRecordings(): Promise<StoredRecording[]> {
  return transaction('readonly', (store, result) => {
    const request = store.getAll();
    request.onsuccess = () => result(request.result);
  });
}

export function saveBrowserRecording(metadata: RecordingMetadata, audio: Blob): Promise<void> {
  return transaction('readwrite', store => { store.add({ metadata, audio }); });
}

export function updateBrowserRecording(metadata: RecordingMetadata): Promise<void> {
  let missing = false;
  return transaction<void>('readwrite', store => {
    const request = store.get(metadata.id);
    request.onsuccess = () => {
      const saved: StoredRecording | undefined = request.result;
      if (!saved) { missing = true; return; }
      store.put({ ...saved, metadata });
    };
  }).then(() => {
    if (missing) throw new Error('The local recording no longer exists.');
  });
}

export function removeBrowserRecording(id: string): Promise<void> {
  return transaction('readwrite', store => { store.delete(id); });
}

export function clearBrowserRecordings(): Promise<void> {
  return transaction('readwrite', store => { store.clear(); });
}
