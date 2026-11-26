import { createContext, useContext, useSyncExternalStore, type PropsWithChildren } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';
import { useRecordingLibrary } from './useRecordingLibrary';

const RecordingLibraryContext = createContext<ReturnType<typeof useRecordingLibrary> | null>(null);
const subscribeToHydration = () => () => {};
const clientSnapshot = () => true;
const serverSnapshot = () => false;
export function RecordingLibraryProvider({ children }: PropsWithChildren) {
  const hydrated = useSyncExternalStore(subscribeToHydration, clientSnapshot, serverSnapshot);
  if (Platform.OS === 'web' && !hydrated) return <View style={{ flex: 1, justifyContent: 'center' }}>
    <ActivityIndicator accessibilityLabel="Loading Moodi" />
  </View>;
  return <ClientRecordingLibrary>{children}</ClientRecordingLibrary>;
}
function ClientRecordingLibrary({ children }: PropsWithChildren) {
  const library = useRecordingLibrary();
  return <RecordingLibraryContext.Provider value={library}>{children}</RecordingLibraryContext.Provider>;
}
export function useSharedRecordingLibrary() {
  const library = useContext(RecordingLibraryContext);
  if (!library) throw new Error('Recording library provider is missing');
  return library;
}
