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

import { listRatingActions, listRatingEntries } from './actionsApi';
import {
  formatActionDate,
  getActionProgress,
  getTodayEntry,
} from './actionStatus';
import type { RatingAction, RatingEntry } from './actionTypes';
import { getRatingMetricPresentation } from './ratingMetrics';
import { formatActionCadence } from './scheduleFormatting';

type ActionOverview = {
  action: RatingAction;
  entries: RatingEntry[];
};

function messageFrom(error: unknown) {
  return error instanceof Error && error.message
    ? error.message
    : 'Actions could not be loaded.';
}

function entryValue(entry: RatingEntry) {
  return entry.values.rating_value !== null
    ? `${entry.values.rating_value}/10`
    : entry.values.rating_label ?? 'Saved';
}

function TodayActionCard({ overview }: { overview: ActionOverview }) {
  const router = useRouter();
  const presentation = getRatingMetricPresentation(overview.action.metric);
  const progress = getActionProgress(overview.action);
  const todayEntry = getTodayEntry(overview.entries);
  const callToAction = todayEntry?.status === 'confirmed'
    ? 'View or edit'
    : todayEntry?.status === 'draft'
      ? 'Resume'
      : 'Check in';
  const todayStatus = todayEntry?.status === 'confirmed'
    ? `${presentation.entryFallback} · ${entryValue(todayEntry)}`
    : todayEntry?.status === 'draft'
      ? 'Draft saved'
      : 'Ready when you are';

  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{presentation.checkInTitle}</Text>
      <Text style={styles.schedule}>{formatActionCadence(overview.action.settings)}</Text>
      <Text style={styles.todayStatus}>{todayStatus}</Text>
      <Text style={styles.progressText}>
        {overview.action.settings.duration_kind === 'ongoing'
          ? `Day ${progress.dayNumber}`
          : `Day ${progress.dayNumber} of ${overview.action.settings.duration_days}`}
      </Text>
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

function PastActionCard({ overview }: { overview: ActionOverview }) {
  const router = useRouter();
  const presentation = getRatingMetricPresentation(overview.action.metric);
  const progress = getActionProgress(overview.action);
  const confirmedCount = overview.entries.filter((entry) => entry.status === 'confirmed').length;

  return (
    <View style={styles.pastCard}>
      <View style={styles.pastCopy}>
        <Text style={styles.pastTitle}>{presentation.checkInTitle}</Text>
        <Text style={styles.pastMeta}>
          {confirmedCount} {confirmedCount === 1 ? 'entry' : 'entries'}
          {progress.endDate ? ` · Ended ${formatActionDate(progress.endDate)}` : ' · Ended'}
        </Text>
      </View>
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          router.push({
            pathname: '/actions/[actionId]/history',
            params: { actionId: overview.action.id },
          })
        }
        style={({ pressed }) => [styles.historyButton, pressed && styles.pressed]}>
        <Text style={styles.historyButtonText}>View history</Text>
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
      const actions = await listRatingActions();
      const loaded = await Promise.all(
        actions.map(async (action) => ({
          action,
          entries: await listRatingEntries(action.id),
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
          <Text style={styles.eyebrow}>ACTIONS</Text>
          <Text style={styles.title}>Today</Text>
          <Text style={styles.subtitle}>
            Things you agreed to, ready when you are.
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
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>For today</Text>
              {active.length ? (
                active.map((overview) => (
                  <TodayActionCard key={overview.action.id} overview={overview} />
                ))
              ) : (
                <View style={styles.todayEmptyCard}>
                  <Text style={styles.todayEmptyTitle}>Nothing waiting today</Text>
                  <Text style={styles.todayEmptyText}>Your past Actions are available below.</Text>
                </View>
              )}
            </View>
            {completed.length ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Past</Text>
                {completed.map((overview) => (
                  <PastActionCard key={overview.action.id} overview={overview} />
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
  cardTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  schedule: { color: colors.muted, fontSize: 13 },
  progressText: { color: colors.muted, fontSize: 12 },
  todayStatus: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: colors.accentDark,
    borderRadius: 11,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryButtonText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  pastCard: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  pastCopy: { flex: 1, gap: 3 },
  pastTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  pastMeta: { color: colors.muted, fontSize: 12 },
  historyButton: { paddingHorizontal: 6, paddingVertical: 8 },
  historyButtonText: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
  todayEmptyCard: { backgroundColor: '#fff', borderRadius: 14, gap: 4, padding: 15 },
  todayEmptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  todayEmptyText: { color: colors.muted, fontSize: 13, lineHeight: 18 },
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
