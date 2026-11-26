import { Alert } from 'react-native';

export function confirmRecordingDeletion(onConfirm: () => void) {
  Alert.alert('Delete recording?', 'This removes the audio and saved session details from this device.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Delete', style: 'destructive', onPress: onConfirm },
  ]);
}
