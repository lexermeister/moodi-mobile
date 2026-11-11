import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listMoodActions, listMoodEntries } from './actionsApi';
import {
  formatActionDateRange,
  getActionProgress,
  getTodayEntry,
} from './actionStatus';
import type { MoodAction, MoodEntry } from './actionTypes';
import { formatActionCadence } from './scheduleFormatting';

type ActionOverview = {
  action: MoodAction;
  entries: MoodEntry[];
};

function messageFrom(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Actions could not be loaded.';
}

function ActionCard({ overview }: { overview: ActionOverview }) {
  const router = useRouter();
  const progress = getActionProgress(overview.action);
  const todayEntry = getTodayEntry(overview.entries);
  const callToAction = progress.completed
    ? 'View history'
    : todayEntry?.status === 'confirmed'
      ? 'View today’s entry'
      : todayEntry?.status === 'draft'
        ? 'Resume draft'
        : 'Record mood';
  const todayStatus = progress.completed
    ? `${overview.entries.filter((entry) => entry.status === 'confirmed').length} recorded`
    : todayEntry?.status === 'confirmed'
      ? 'Today recorded'
      : todayEntry?.status === 'draft'
        ? 'Draft saved for today'
        : 'Today not recorded yet';

  return (
    <View style={styles.card}>
      <View style={styles.cardTitleRow}>
        <Text style={styles.cardTitle}>Record mood</Text>
        <Text style={[styles.badge, progress.completed && styles.completedBadge]}>
          {progress.completed ? 'COMPLETED' : 'ACTIVE'}
        </Text>
      </View>
      <Text style={styles.task}>{overview.action.settings.exact_task}</Text>
      <Text style={styles.schedule}>
        {formatActionCadence(overview.action.settings)}
      </Text>
      <Text style={styles.dateRange}>{formatActionDateRange(overview.action)}</Text>
      <View style={styles.progressRow}>
        <Text style={styles.progressText}>
          {progress.completed
            ? overview.action.settings.duration_kind === 'ongoing'
              ? 'Action ended'
              : `${overview.action.settings.duration_days}-day action complete`
            : overview.action.settings.duration_kind === 'ongoing'
              ? `Day ${progress.dayNumber} · Ongoing`
              : `Day ${progress.dayNumber} of ${overview.action.settings.duration_days}`}
        </Text>
        <Text style={styles.todayStatus}>{todayStatus}</Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/actions/[actionId]',
            params: { actionId: overview.action.id },
          })
        }
        style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
        <Text style={styles.primaryButtonText}>{callToAction}</Text>
      </Pressable>
    </View>
  );
}

export function ActionsScreen() {
  const router = useRouter();
  const [overviews, setOverviews] = useState<ActionOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const actions = await listMoodActions();
      const loaded = await Promise.all(
        actions.map(async (action) => ({
          action,
          entries: await listMoodEntries(action.id),
        })),
      );
      setOverviews(loaded);
    } catch (loadError) {
      setError(messageFrom(loadError));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const active = overviews.filter(({ action }) => !getActionProgress(action).completed);
  const completed = overviews.filter(({ action }) => getActionProgress(action).completed);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            onRefresh={() => void load(true)}
            refreshing={refreshing}
            tintColor={colors.accentDark}
          />
        }>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MOODI</Text>
          <Text style={styles.title}>Actions</Text>
          <Text style={styles.subtitle}>
            Tasks agreed in your sessions, ready when it is time to do them.
          </Text>
        </View>

        {loading ? (
          <ActivityIndicator color={colors.accentDark} style={styles.loading} />
        ) : error ? (
          <View style={styles.messageCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void load()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
              <Text style={styles.retryText}>Try again</Text>
            </Pressable>
          </View>
        ) : overviews.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No Actions yet</Text>
            <Text style={styles.emptyBody}>
              When you and your therapist agree on a task, review it in Session insights. Once
              activated, it will appear here.
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.navigate('/sessions')}
              style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
              <Text style={styles.secondaryButtonText}>Go to Sessions</Text>
            </Pressable>
          </View>
        ) : (
          <>
            {active.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Active</Text>
                {active.map((overview) => (
                  <ActionCard key={overview.action.id} overview={overview} />
                ))}
              </View>
            ) : null}
            {completed.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Completed</Text>
                {completed.map((overview) => (
                  <ActionCard key={overview.action.id} overview={overview} />
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = {
  background: '#fbf8f2',
  ink: '#1e2421',
  muted: '#68716b',
  accentDark: '#ca3d28',
  line: '#e5ded2',
};

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { gap: 24, paddingBottom: 36, paddingHorizontal: 18, paddingTop: 18 },
  header: { gap: 6 },
  eyebrow: { color: colors.accentDark, fontSize: 12, fontWeight: '900', letterSpacing: 2 },
  title: { color: colors.ink, fontSize: 32, fontWeight: '900' },
  subtitle: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  loading: { marginTop: 60 },
  section: { gap: 12 },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  card: {
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  cardTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  cardTitle: { color: colors.ink, flex: 1, fontSize: 17, fontWeight: '900' },
  badge: {
    backgroundColor: '#dcefe1',
    borderRadius: 7,
    color: '#23613a',
    fontSize: 10,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  completedBadge: { backgroundColor: '#e8e2d8', color: colors.muted },
  task: { color: colors.ink, fontSize: 14, fontWeight: '700', lineHeight: 20 },
  schedule: { color: colors.muted, fontSize: 13 },
  dateRange: { color: colors.muted, fontSize: 12 },
  progressRow: {
    borderTopColor: colors.line,
    borderTopWidth: 1,
    gap: 4,
    marginTop: 3,
    paddingTop: 10,
  },
  progressText: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  todayStatus: { color: colors.muted, fontSize: 12 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accentDark,
    borderRadius: 11,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  emptyCard: { backgroundColor: '#fff8e8', borderRadius: 16, gap: 10, padding: 18 },
  emptyTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 21 },
  secondaryButton: {
    alignSelf: 'flex-start',
    borderColor: colors.accentDark,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 13,
    paddingVertical: 9,
  },
  secondaryButtonText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  messageCard: { backgroundColor: '#fff', borderRadius: 14, gap: 10, padding: 16 },
  errorText: { color: '#982e22', fontSize: 13, lineHeight: 18 },
  retryButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  retryText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  pressed: { opacity: 0.68 },
});
