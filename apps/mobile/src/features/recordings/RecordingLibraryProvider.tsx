import { createContext, useContext, type PropsWithChildren } from 'react';
import { useRecordingLibrary } from './useRecordingLibrary';

const RecordingLibraryContext = createContext<ReturnType<typeof useRecordingLibrary> | null>(null);
export function RecordingLibraryProvider({ children }: PropsWithChildren) {
  const library = useRecordingLibrary();
  return <RecordingLibraryContext.Provider value={library}>{children}</RecordingLibraryContext.Provider>;
}
export function useSharedRecordingLibrary() {
  const library = useContext(RecordingLibraryContext);
  if (!library) throw new Error('Recording library provider is missing');
  return library;
}
