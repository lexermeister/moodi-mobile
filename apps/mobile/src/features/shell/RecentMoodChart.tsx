import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { theme } from '@/ui/theme';
import { listRatingActions, listRatingEntries } from '../actions/actionsApi';
import type { RatingEntry } from '../actions/actionTypes';
import { recentMoodDays } from './recentMood';

export function RecentMoodChart() {
  const [entries, setEntries] = useState<RatingEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    // A retry revision intentionally starts a fresh request while this tab is focused.
    void retry;
    let active = true;
    setLoading(true);
    setError(false);
    async function load() {
      try {
        const actions = await listRatingActions();
        const results = await Promise.all(actions.map(action => listRatingEntries(action.id)));
        if (active) setEntries(results.flat());
      } catch {
        if (active) setError(true);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]));
  const days = recentMoodDays(entries);
  const hasMoods = days.some(day => day.value !== null);
  return <View style={styles.card}>
    <Text style={styles.title}>Recent mood</Text>
    <Text style={styles.caption}>Last 7 days</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Loading recent moods" color={theme.colors.accent} /> : error ? <View>
      <Text style={styles.message}>Couldn’t load recent moods.</Text>
      <Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)} style={styles.retry}><Text style={styles.retryText}>Try again</Text></Pressable>
    </View> : <>
      <View style={styles.chart}>
        <View accessible={false} style={styles.axis}><Text style={styles.tick}>10</Text><Text style={styles.tick}>5</Text><Text style={styles.tick}>0</Text></View>
        <View style={styles.plot}>
          <View pointerEvents="none" style={styles.grid}><View style={styles.line} /><View style={styles.line} /><View style={styles.line} /></View>
          <View style={styles.columns}>{days.map(day => <View key={day.key} style={styles.column} accessible
            accessibilityLabel={`${day.date.toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}: ${day.value === null ? 'No mood recorded' : `${day.value} out of 10`}`}>
            <View style={styles.track}>{day.value !== null ? <View style={[styles.bar, { height: `${day.value * 10}%`, minHeight: 2 }]} /> : null}</View>
            <Text style={styles.day}>{day.date.toLocaleDateString('en', { weekday: 'narrow' })}</Text>
          </View>)}</View>
        </View>
      </View>
      <Text style={styles.message}>{hasMoods ? 'Latest saved mood each day. Blank days have no rating.' : 'No moods recorded in the last 7 days.'}</Text>
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: '#F5F2FA', borderWidth: 1, borderColor: theme.colors.line, borderRadius: 18, padding: 16, gap: 6 },
  title: { color: theme.colors.ink, fontSize: 16, fontWeight: '700' },
  caption: { color: theme.colors.muted, fontSize: 12 },
  chart: { flexDirection: 'row', marginTop: 8, height: 108, gap: 8 },
  axis: { width: 22, height: 84, justifyContent: 'space-between', alignItems: 'flex-end' },
  tick: { fontSize: 10, color: theme.colors.muted, lineHeight: 12 },
  plot: { flex: 1 },
  grid: { position: 'absolute', left: 0, right: 0, top: 0, height: 84, justifyContent: 'space-between' },
  line: { height: 1, backgroundColor: theme.colors.line },
  columns: { flexDirection: 'row', justifyContent: 'space-around', gap: 8 },
  column: { flex: 1, alignItems: 'center', gap: 5 },
  track: { height: 84, width: '100%', maxWidth: 24, borderRadius: 7, backgroundColor: '#EDE7F7', justifyContent: 'flex-end', overflow: 'hidden' },
  bar: { width: '100%', borderRadius: 7, backgroundColor: '#AD96EA' },
  day: { fontSize: 11, color: theme.colors.muted },
  message: { color: theme.colors.muted, fontSize: 12, lineHeight: 18, marginTop: 4 },
  retry: { minHeight: 44, justifyContent: 'center' },
  retryText: { color: theme.colors.accent, fontWeight: '600' },
});
