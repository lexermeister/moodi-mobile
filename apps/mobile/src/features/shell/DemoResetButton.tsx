import { Alert } from '@/ui/alert';
import { useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { Platform, Pressable, StyleSheet, Text } from 'react-native';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { useMoodiPanel } from './MoodiPanel';
import { theme } from '@/ui/theme';

export function DemoResetButton() {
  const library = useSharedRecordingLibrary();
  const { moodSession, resetPanel } = useMoodiPanel();
  const [busy, setBusy] = useState(false);

  if (!__DEV__ && Platform.OS !== 'web') return null;

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
    <SymbolView name={{ ios: 'arrow.counterclockwise', android: 'refresh', web: 'refresh' }}
      size={15} tintColor={theme.colors.muted} />
    <Text style={styles.label}>{disabled ? 'Restarting…' : 'Restart demo'}</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: { minHeight: 40, justifyContent: 'center', alignItems: 'center', flexDirection: 'row', gap: 6,
    paddingHorizontal: 11, paddingVertical: 8, borderRadius: 10, borderWidth: 1,
    borderColor: theme.colors.line, backgroundColor: '#FCFBFE' },
  label: { color: theme.colors.muted, fontSize: 12, fontWeight: '700' },
  busy: { opacity: 0.5 },
});
