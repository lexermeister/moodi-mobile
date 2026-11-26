import { PermissionStatus, type PermissionResponse } from 'expo';
import { requestRecordingPermissionsAsync } from 'expo-audio';
import * as KeepAwake from 'expo-keep-awake';
import { Alert } from '@/ui/alert';

export { requestRecordingPermissionsAsync };

// Query only: Safari must not prompt for microphone access while loading the library.
export async function getRecordingPermissionsAsync(): Promise<PermissionResponse> {
  let state: PermissionState = 'prompt';
  try {
    state = (await navigator.permissions.query({ name: 'microphone' as PermissionName })).state;
  } catch { /* Some browsers cannot query microphone permission. Ask on Record instead. */ }
  return {
    status: state === 'granted' ? PermissionStatus.GRANTED
      : state === 'denied' ? PermissionStatus.DENIED : PermissionStatus.UNDETERMINED,
    granted: state === 'granted', canAskAgain: state !== 'denied', expires: 'never',
  };
}

export async function activateKeepAwakeAsync(tag: string) {
  if (await KeepAwake.isAvailableAsync()) {
    // Recording can proceed when the browser declines a screen wake lock.
    await KeepAwake.activateKeepAwakeAsync(tag).catch(() => undefined);
  }
}

export async function deactivateKeepAwake(tag: string) {
  await KeepAwake.deactivateKeepAwake(tag).catch(() => undefined);
}

export async function openRecordingSettings() {
  Alert.alert('Microphone permission',
    'Open this site’s permissions in your browser’s address bar, allow microphone access, then try recording again.');
}
