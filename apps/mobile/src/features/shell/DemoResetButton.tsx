import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text } from 'react-native';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { useMoodiPanel } from './MoodiPanel';
import { theme } from '@/ui/theme';

export function DemoResetButton() {
  const library = useSharedRecordingLibrary();
  const { moodSession, resetPanel } = useMoodiPanel();
  const [busy, setBusy] = useState(false);

  if (!__DEV__) return null;

  async function restart() {
    setBusy(true);
    try {
      await library.restartDemo();
      resetPanel();
      Alert.alert('Demo restarted', 'Sessions, actions, mood entries, and recordings have been cleared.');
    } catch (error) {
      Alert.alert('Could not restart demo', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmRestart() {
    if (moodSession) {
      Alert.alert('Finish your mood check-in first', 'Save and close it before restarting the demo.');
      return;
    }
    Alert.alert(
      'Restart demo?',
      'Permanently delete all sessions, actions, mood entries, and recordings from the demo backend and this device?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Restart demo', style: 'destructive', onPress: () => void restart() },
      ],
    );
  }

  const disabled = busy || library.isRestartingDemo;
  return <Pressable accessibilityRole="button" accessibilityLabel="Restart demo" disabled={disabled}
    onPress={confirmRestart} style={[styles.button, disabled && styles.busy]}>
    <Text style={styles.label}>{disabled ? 'Restarting…' : 'Restart demo'}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.line },
  label: { color: theme.colors.accent, fontSize: 12, fontWeight: '700' },
  busy: { opacity: 0.5 },
});
