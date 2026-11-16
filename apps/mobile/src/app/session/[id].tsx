import { Redirect, useLocalSearchParams } from 'expo-router';

export default function LegacySessionRedirect() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <Redirect href={{ pathname: '/journey/session/[id]', params: { id } }} />;
}
