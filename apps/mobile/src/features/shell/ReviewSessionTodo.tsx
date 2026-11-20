import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { theme } from '@/ui/theme';
import { TodoRow } from '@/ui/TodoRow';
import { reviewableActionCandidates } from '../journey/sessionReviewDomain';
import { useSessionReviewStatus } from '../journey/useSessionReviewStatus';
import { sortedSessions } from '../journey/sessionPresentation';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';

export function ReviewSessionTodo() {
  const router = useRouter();
  const library = useSharedRecordingLibrary();
  const recording = sortedSessions(library.recordings)[0];
  const { needsReview, error, retry } = useSessionReviewStatus(recording);
  if (error) return <Pressable accessibilityRole="button" onPress={retry} style={styles.retry}>
    <Text style={styles.retryText}>Couldn’t check session review. Tap to retry.</Text>
  </Pressable>;
  if (!recording || needsReview !== true) return null;
  const count = reviewableActionCandidates(recording.sessionInsights).length;
  const summaryReviewed = recording.sessionInsightsReview?.draft_id === recording.sessionInsights?.draft_id &&
    recording.sessionInsightsReview?.source_version === recording.sessionInsights?.source_version;
  const description = summaryReviewed ? `${count} ${count === 1 ? 'action' : 'actions'} to confirm` :
    count ? `Summary and ${count} ${count === 1 ? 'action' : 'actions'} to review` : 'Summary to review';
  return <TodoRow kind="session" title="Review session" subtitle={description}
    onPress={() => router.push({ pathname: '/journey/session/[id]', params: { id: recording.id } })} />;
}

const styles = StyleSheet.create({
  retry: { minHeight: 44, justifyContent: 'center' }, retryText: { color: theme.colors.accent, fontSize: 12 },
});
