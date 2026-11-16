import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from '@/ui/theme';
import { listRatingActions, listRatingEntries } from './actionsApi';
import { currentDayKey } from './actionStatus';
import type { RatingEntry } from './actionTypes';
import { confirmedMoodEntries, entryFeeling, entryOffsetLabel, entryTimeLabel } from './moodEntryPresentation';

function Score({ value }: { value: number }) {
  return <Text style={styles.score}>{value}<Text style={styles.scoreOutOf}>/10</Text></Text>;
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return <View style={styles.detailRow}><Text style={styles.detailLabel}>{label}</Text><Text style={styles.detailValue}>{value}</Text></View>;
}

function MoodEntryDetail({ entry, onClose }: { entry: RatingEntry; onClose: () => void }) {
  const values = entry.values;
  const feeling = entryFeeling(entry);
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <SafeAreaView style={styles.overlay}>
      <View style={styles.sheet}>
        <Text style={styles.brand}>Moodi</Text>
        <Text accessibilityRole="header" style={styles.sheetTitle}>Mood entry saved</Text>
        <Text style={styles.sheetSubtitle}>Your saved check-in</Text>
        <ScrollView contentContainerStyle={styles.sheetScroll} showsVerticalScrollIndicator>
          <View style={styles.detailCard}>
            <View style={styles.moodHeader}><View style={styles.moodIcon}><Text style={styles.moodIconText}>∿</Text></View>
              <Text style={styles.moodTitle}>Whole-day mood</Text><Score value={values.mood_value ?? 0} /></View>
            <View style={styles.dateRow}><Text style={styles.dateText}>{entryTimeLabel(entry)}</Text>
              <Text style={styles.zoneText}>{entryOffsetLabel(entry)}</Text></View>
            {values.energy_value != null ? <DetailRow label="Energy" value={`${values.energy_value} / 10`} /> : null}
            {values.motivation_value != null ? <DetailRow label="Motivation" value={`${values.motivation_value} / 10`} /> : null}
            {values.sleep_quality_value != null ? <DetailRow label="Sleep quality" value={`${values.sleep_quality_value} / 10`} /> : null}
            {feeling ? <DetailRow label="Feeling" value={feeling} /> : null}
            {values.feeling_intensity != null ? <DetailRow label="Feeling intensity" value={`${values.feeling_intensity} / 10`} /> : null}
            {values.context?.trim() ? <DetailRow label="What happened" value={values.context.trim()} /> : null}
          </View>
        </ScrollView>
        <Pressable accessibilityRole="button" accessibilityLabel="Done viewing mood entry" onPress={onClose} style={styles.done}>
          <Text style={styles.doneText}>Done ✓</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  </Modal>;
}

export function MoodEntriesSection({ refreshKey }: { refreshKey: number }) {
  const [entries, setEntries] = useState<RatingEntry[]>([]);
  const [selected, setSelected] = useState<RatingEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  useFocusEffect(useCallback(() => {
    // Reopen this focused loader after a saved check-in or an explicit retry.
    void refreshKey;
    void retry;
    let active = true;
    setLoading(true);
    const load = async () => {
      try {
        const actions = await listRatingActions();
        const results = await Promise.all(actions.map(action => listRatingEntries(action.id)));
        if (active) { setEntries(confirmedMoodEntries(results.flat(), currentDayKey())); setError(null); }
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : 'Could not load mood entries.');
      } finally { if (active) setLoading(false); }
    };
    void load();
    return () => { active = false; };
  }, [refreshKey, retry]));
  return <View style={styles.section}>
    <Text style={styles.sectionTitle}>MOOD ENTRIES</Text>
    {loading ? <ActivityIndicator accessibilityLabel="Loading mood entries" color={theme.colors.accent} /> : null}
    {error ? <View><Text style={styles.empty}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setRetry(value => value + 1)}><Text style={styles.retry}>Try again</Text></Pressable></View> : null}
    {!loading && !error && !entries.length ? <Text style={styles.empty}>No mood entries recorded today.</Text> : null}
    {!error && entries.map(entry => <Pressable key={entry.id} accessibilityRole="button"
      accessibilityLabel={`Mood entry ${entry.values.mood_value} out of 10, ${entryTimeLabel(entry)}`}
      onPress={() => setSelected(entry)} style={({ pressed }) => [styles.entry, pressed && styles.pressed]}>
      <View style={styles.scoreBadge}><Score value={entry.values.mood_value ?? 0} /></View>
      <View style={styles.entryCopy}><Text style={styles.entryDate}>{entryTimeLabel(entry)}</Text>
        <Text style={styles.entryCaption}>Confirmed{entryFeeling(entry) ? ` · ${entryFeeling(entry)}` : ''}</Text></View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>)}
    {selected ? <MoodEntryDetail entry={selected} onClose={() => setSelected(null)} /> : null}
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: 10 }, sectionTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1, color: theme.colors.muted },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.line, backgroundColor: theme.colors.surface, padding: 8, minHeight: 64 },
  pressed: { opacity: 0.7 }, scoreBadge: { width: 48, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFE9FF' },
  score: { fontSize: 23, fontWeight: '800', color: theme.colors.accent }, scoreOutOf: { fontSize: 11, fontWeight: '500' },
  entryCopy: { flex: 1, gap: 3 }, entryDate: { fontSize: 13, fontWeight: '700', color: theme.colors.ink },
  entryCaption: { fontSize: 12, color: theme.colors.muted }, chevron: { fontSize: 24, color: theme.colors.muted, paddingHorizontal: 6 },
  empty: { color: theme.colors.muted, fontSize: 13, lineHeight: 20 }, retry: { color: theme.colors.accent, fontWeight: '700', paddingVertical: 12 },
  overlay: { flex: 1, justifyContent: 'center', padding: 16, backgroundColor: '#16131B99' },
  sheet: { alignSelf: 'center', width: '100%', maxWidth: 420, maxHeight: '92%', minHeight: 380, backgroundColor: theme.colors.panel, borderRadius: 22, padding: 16, gap: 12 },
  brand: { fontSize: 13, fontWeight: '800', color: theme.colors.panelText },
  sheetTitle: { fontSize: 26, fontWeight: '800', letterSpacing: -0.7, color: theme.colors.panelText },
  sheetSubtitle: { color: theme.colors.panelMuted, fontSize: 14 }, sheetScroll: { paddingBottom: 4 },
  detailCard: { padding: 14, borderRadius: 16, borderWidth: 1, borderColor: '#4A4655', backgroundColor: '#2E2B36' },
  moodHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingBottom: 14 },
  moodIcon: { width: 40, height: 40, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: '#403954' },
  moodIconText: { fontSize: 25, color: '#C9B7FF' }, moodTitle: { flex: 1, fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  dateRow: { borderTopWidth: 1, borderTopColor: '#514D5A', paddingVertical: 12, gap: 4 },
  dateText: { color: '#DDD9E5', fontSize: 13, fontWeight: '700' }, zoneText: { color: '#C7C2D0', fontSize: 12 },
  detailRow: { borderTopWidth: 1, borderTopColor: '#514D5A', flexDirection: 'row', gap: 12, paddingVertical: 11 },
  detailLabel: { flex: 1, color: '#C7C2D0', fontSize: 13 }, detailValue: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  done: { borderRadius: 11, minHeight: 48, backgroundColor: '#C9B7FF', alignItems: 'center', justifyContent: 'center' },
  doneText: { color: '#272032', fontWeight: '800', fontSize: 15 },
});
