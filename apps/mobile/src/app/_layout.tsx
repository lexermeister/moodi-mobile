import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RecordingLibraryProvider } from '@/features/recordings/RecordingLibraryProvider';
import { MoodiPanelProvider } from '@/features/shell/MoodiPanel';

export default function RootLayout() {
  return (
    <RecordingLibraryProvider><MoodiPanelProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="actions/[actionId]" />
      </Stack>
    </MoodiPanelProvider></RecordingLibraryProvider>
  );
}
