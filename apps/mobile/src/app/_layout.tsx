import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { RecordingLibraryProvider } from '@/features/recordings/RecordingLibraryProvider';
import { MoodiPanelProvider } from '@/features/shell/MoodiPanel';
import { AppFrame } from '@/ui/AppFrame';

export default function RootLayout() {
  return (
    <AppFrame><RecordingLibraryProvider><MoodiPanelProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="actions/[actionId]" />
      </Stack>
    </MoodiPanelProvider></RecordingLibraryProvider></AppFrame>
  );
}
