import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/ui/theme';
import { recordMoodCandidates } from '../journey/sessionReviewDomain';
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
  const count = recordMoodCandidates(recording.sessionInsights).length;
  const summaryReviewed = recording.sessionInsightsReview?.draft_id === recording.sessionInsights?.draft_id &&
    recording.sessionInsightsReview?.source_version === recording.sessionInsights?.source_version;
  const description = summaryReviewed ? `${count} ${count === 1 ? 'action' : 'actions'} to confirm` :
    count ? `Summary and ${count} ${count === 1 ? 'action' : 'actions'} to review` : 'Summary to review';
  return <Pressable accessibilityRole="button" accessibilityLabel={`Review session. ${description}`}
    onPress={() => router.push({ pathname: '/journey/session/[id]', params: { id: recording.id } })}
    style={({ pressed }) => [styles.row, pressed && styles.pressed]}>
    <View style={styles.icon}><Text style={styles.iconText}>▤</Text></View>
    <View style={styles.copy}><Text style={styles.title}>Review session</Text><Text style={styles.subtitle}>{description}</Text></View>
    <Text style={styles.arrow}>›</Text>
  </Pressable>;
}

const styles = StyleSheet.create({
  row: { minHeight: 58, padding: 10, borderWidth: 1, borderColor: theme.colors.line, borderRadius: 14,
    backgroundColor: theme.colors.surface, flexDirection: 'row', alignItems: 'center', gap: 10 },
  pressed: { opacity: 0.65 },
  icon: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#E5F4ED', alignItems: 'center', justifyContent: 'center' },
  iconText: { color: '#287453', fontSize: 20 },
  copy: { flex: 1, gap: 2 }, title: { color: theme.colors.ink, fontSize: 14, fontWeight: '700' },
  subtitle: { color: theme.colors.muted, fontSize: 12 }, arrow: { color: theme.colors.muted, fontSize: 24 },
  retry: { minHeight: 44, justifyContent: 'center' }, retryText: { color: theme.colors.accent, fontSize: 12 },
});
