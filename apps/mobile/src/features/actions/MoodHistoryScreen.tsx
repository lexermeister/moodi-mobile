import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type { MoodAction, MoodEntry } from './actionTypes';
import { currentDayKey, getActionProgress } from './actionStatus';
import { shareMoodExport } from './shareMoodExport';
import { useMoodActionDetail } from './useMoodActionDetail';

type Props = {
  actionId: string;
};

const DAY_MS = 24 * 60 * 60 * 1000;

function dateKeyToTimestamp(dateKey: string) {
  return Date.parse(`${dateKey}T00:00:00.000Z`);
}

function elapsedDayCount(action: MoodAction) {
  const { endDate, startDate } = getActionProgress(action);
  const today = currentDayKey();
  if (today < startDate) return 0;
  const cutoff = endDate && endDate < today ? endDate : today;
  return Math.floor((dateKeyToTimestamp(cutoff) - dateKeyToTimestamp(startDate)) / DAY_MS) + 1;
}

function formatEntryDate(entry: MoodEntry) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(entry.values.entry_time));
}

function entryValue(entry: MoodEntry) {
  return entry.values.mood_value !== null
    ? `${entry.values.mood_value}/10`
    : entry.values.mood_label ?? 'Text-only entry';
}

export function MoodHistoryScreen({ actionId }: Props) {
  const router = useRouter();
  const detail = useMoodActionDetail(actionId);
  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [shareError, setShareError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<string | null>(null);

  const sortedEntries = useMemo(
    () =>
      [...detail.entries].sort((left, right) =>
        right.values.entry_time.localeCompare(left.values.entry_time),
      ),
    [detail.entries],
  );
  const confirmedEntries = sortedEntries.filter((entry) => entry.status === 'confirmed');
  const draftCount = sortedEntries.length - confirmedEntries.length;
  const confirmedDayCount = new Set(
    confirmedEntries.map((entry) => entry.values.relevant_date),
  ).size;

  if (detail.loading) {
    return <ActivityIndicator color={colors.accentDark} style={styles.loading} />;
  }
  if (!detail.action) {
    return (
      <View style={styles.messageCard}>
        <Text style={styles.errorText}>{detail.error ?? 'Mood history could not be loaded.'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void detail.reload()}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.outlineButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const elapsedDays = elapsedDayCount(detail.action);

  const startSelecting = () => {
    setSelectedIds(new Set(confirmedEntries.map((entry) => entry.id)));
    setSelecting(true);
    setShareError(null);
    setShareNotice(null);
  };

  const toggleSelected = (entryId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  };

  const exportSelected = async () => {
    if (!selectedIds.size) return;
    const payload = await detail.prepareExport([...selectedIds]);
    if (!payload) return;
    try {
      await shareMoodExport(payload);
      setSelecting(false);
      setShareNotice('Selected mood entries exported.');
    } catch (shareFailure) {
      setShareError(
        shareFailure instanceof Error && shareFailure.message
          ? shareFailure.message
          : 'The selected entries could not be shared.',
      );
    }
  };

  const confirmDelete = (entry: MoodEntry) => {
    Alert.alert('Delete mood entry?', 'This removes the selected entry.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => void detail.removeEntry(entry.id),
      },
    ]);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.coverageCard}>
        <Text style={styles.coverageValue}>
          {confirmedDayCount} of {elapsedDays} elapsed days recorded
        </Text>
        <Text style={styles.coverageNote}>
          No entry is treated as no record, not as a missed task.
        </Text>
        {draftCount ? (
          <Text style={styles.draftText}>
            {draftCount} saved {draftCount === 1 ? 'draft' : 'drafts'}
          </Text>
        ) : null}
      </View>

      {detail.error || shareError ? (
        <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
          {shareError ?? detail.error}
        </Text>
      ) : null}
      {detail.notice || shareNotice ? (
        <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
          {shareNotice ?? detail.notice}
        </Text>
      ) : null}

      <View style={styles.listHeader}>
        <Text style={styles.sectionTitle}>Entries</Text>
        {confirmedEntries.length ? (
          selecting ? (
            <View style={styles.selectionActions}>
              <Pressable
                accessibilityRole="button"
                disabled={detail.busy}
                onPress={() => {
                  setSelecting(false);
                  setSelectedIds(new Set());
                }}
                style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
                <Text style={styles.textButtonText}>Cancel</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={detail.busy || !selectedIds.size}
                onPress={() => void exportSelected()}
                style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
                <Text style={styles.outlineButtonText}>Export ({selectedIds.size})</Text>
              </Pressable>
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={startSelecting}
              style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
              <Text style={styles.outlineButtonText}>Share history</Text>
            </Pressable>
          )
        ) : null}
      </View>

      {sortedEntries.length ? (
        <View style={styles.entries}>
          {sortedEntries.map((entry) => (
            <View key={entry.id} style={styles.entryRow}>
              {selecting && entry.status === 'confirmed' ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectedIds.has(entry.id) }}
                  onPress={() => toggleSelected(entry.id)}
                  style={({ pressed }) => [
                    styles.checkbox,
                    selectedIds.has(entry.id) && styles.checkboxSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.checkboxText}>{selectedIds.has(entry.id) ? '✓' : ''}</Text>
                </Pressable>
              ) : null}
              <View style={styles.entryCopy}>
                <Text style={styles.entryValue}>{entryValue(entry)}</Text>
                <Text style={styles.entryMeta}>
                  {formatEntryDate(entry)} · {entry.status === 'draft' ? 'Draft' : 'Saved'}
                </Text>
                {entry.values.context ? (
                  <Text numberOfLines={2} style={styles.entryContext}>
                    {entry.values.context}
                  </Text>
                ) : null}
              </View>
              {!selecting ? (
                <View style={styles.rowActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      router.push({
                        pathname: '/actions/[actionId]',
                        params: { actionId, entryId: entry.id },
                      })
                    }
                    style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}>
                    <Text style={styles.rowButtonText}>
                      {entry.status === 'draft' ? 'Resume' : 'Edit'}
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    disabled={detail.busy}
                    onPress={() => confirmDelete(entry)}
                    style={({ pressed }) => [styles.rowButton, pressed && styles.pressed]}>
                    <Text style={styles.deleteText}>Delete</Text>
                  </Pressable>
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No mood entries yet</Text>
          <Text style={styles.coverageNote}>Your saved check-ins will appear here.</Text>
        </View>
      )}
    </View>
  );
}

const colors = {
  accentDark: '#ca3d28',
  ink: '#1e2421',
  line: '#e5ded2',
  muted: '#68716b',
};

const styles = StyleSheet.create({
  screen: { gap: 16 },
  loading: { marginTop: 60 },
  coverageCard: { backgroundColor: '#eef6ef', borderRadius: 14, gap: 5, padding: 15 },
  coverageValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  coverageNote: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  draftText: { color: '#23613a', fontSize: 12, fontWeight: '800' },
  listHeader: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  sectionTitle: { color: colors.ink, flex: 1, fontSize: 18, fontWeight: '900' },
  selectionActions: { alignItems: 'center', flexDirection: 'row', gap: 5 },
  entries: { gap: 9 },
  entryRow: {
    alignItems: 'center',
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    padding: 12,
  },
  entryCopy: { flex: 1, gap: 3 },
  entryValue: { color: colors.ink, fontSize: 16, fontWeight: '900' },
  entryMeta: { color: colors.muted, fontSize: 11 },
  entryContext: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  rowActions: { alignItems: 'flex-end', gap: 3 },
  rowButton: { paddingHorizontal: 5, paddingVertical: 5 },
  rowButtonText: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
  deleteText: { color: '#8b8176', fontSize: 12, fontWeight: '700' },
  checkbox: {
    alignItems: 'center',
    borderColor: colors.line,
    borderRadius: 6,
    borderWidth: 1,
    height: 24,
    justifyContent: 'center',
    width: 24,
  },
  checkboxSelected: { backgroundColor: colors.accentDark, borderColor: colors.accentDark },
  checkboxText: { color: '#fff', fontSize: 14, fontWeight: '900' },
  outlineButton: {
    borderColor: colors.accentDark,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  outlineButtonText: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
  textButton: { paddingHorizontal: 6, paddingVertical: 8 },
  textButtonText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  messageCard: { alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, gap: 10, padding: 16 },
  emptyCard: { backgroundColor: '#fff', borderRadius: 14, gap: 4, padding: 16 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '900' },
  errorText: { color: '#982e22', fontSize: 13, lineHeight: 18 },
  noticeText: { color: '#23613a', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
