import { Linking } from 'react-native';
export { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
export { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
export const openRecordingSettings = Linking.openSettings;
