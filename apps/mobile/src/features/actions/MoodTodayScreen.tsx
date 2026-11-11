import { useMemo, useState } from 'react';
import { useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import type { MoodAction, MoodEntry, MoodEntryValues } from './actionTypes';
import { getActionProgress, getTodayEntry } from './actionStatus';
import {
  createUuid,
  dayKeyAtCapturedOffset,
  normalizeMoodContext,
  parseMoodScore,
} from './moodDomain';
import { formatActionCadence } from './scheduleFormatting';
import { useMoodActionDetail } from './useMoodActionDetail';

type Props = {
  actionId: string;
  entryId?: string;
};

type ComposerProps = {
  action: MoodAction;
  busy: boolean;
  entry?: MoodEntry;
  error: string | null;
  notice: string | null;
  onCancel?: () => void;
  onSaveConfirmed: (
    entryId: string,
    values: MoodEntryValues,
    expectedRevision: number | null,
    editingConfirmed: boolean,
  ) => Promise<MoodEntry | null>;
  onSaveDraft: (
    entryId: string,
    values: MoodEntryValues,
    expectedRevision: number | null,
  ) => Promise<MoodEntry | null>;
  onSaved: () => void;
};

function formatEntryDate(entryTime: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(entryTime));
}

function entryValue(entry: MoodEntry) {
  return entry.values.mood_value !== null
    ? `${entry.values.mood_value}/10`
    : entry.values.mood_label ?? 'Mood recorded';
}

function MoodEntryComposer({
  action,
  busy,
  entry,
  error,
  notice,
  onCancel,
  onSaveConfirmed,
  onSaveDraft,
  onSaved,
}: ComposerProps) {
  const now = new Date();
  const [entryId] = useState(entry?.id ?? createUuid);
  const [entryRevision, setEntryRevision] = useState<number | null>(entry?.revision ?? null);
  const [entryTime] = useState(entry?.values.entry_time ?? now.toISOString());
  const [timezoneOffsetMinutes] = useState(
    entry?.values.timezone_offset_minutes ?? -now.getTimezoneOffset(),
  );
  const [moodValue, setMoodValue] = useState<number | null>(entry?.values.mood_value ?? null);
  const [moodLabel, setMoodLabel] = useState(entry?.values.mood_label ?? '');
  const [context, setContext] = useState(entry?.values.context ?? '');
  const [noteExpanded, setNoteExpanded] = useState(Boolean(entry?.values.context));
  const configuration = action.settings.configuration;
  const scale = configuration.scale;
  const editingConfirmed = entry?.status === 'confirmed';

  const values = useMemo((): MoodEntryValues | null => {
    try {
      const dayKey = dayKeyAtCapturedOffset(entryTime, timezoneOffsetMinutes);
      const numericValue =
        configuration.input_kind === 'numeric_0_10' && moodValue !== null
          ? parseMoodScore(moodValue)
          : null;
      const label =
        configuration.input_kind === 'label' && moodLabel.trim() ? moodLabel.trim() : null;
      return {
        relevant_date: dayKey,
        entry_time: entryTime,
        timezone_offset_minutes: timezoneOffsetMinutes,
        day_key: dayKey,
        mood_value: numericValue,
        mood_label: label,
        context: configuration.context_enabled ? normalizeMoodContext(context) : null,
        scale_id: numericValue === null ? null : configuration.scale?.id ?? null,
      };
    } catch {
      return null;
    }
  }, [configuration, context, entryTime, moodLabel, moodValue, timezoneOffsetMinutes]);

  const hasMood = Boolean(values && (values.mood_value !== null || values.mood_label !== null));

  return (
    <View style={styles.composer}>
      <View style={styles.composerHeader}>
        <View style={styles.headerCopy}>
          <Text style={styles.composerTitle}>
            {editingConfirmed ? 'Edit mood entry' : entry ? 'Resume draft' : 'How was today?'}
          </Text>
          <Text style={styles.dateText}>{formatEntryDate(entryTime)}</Text>
        </View>
        {onCancel ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={onCancel}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <Text style={styles.textButtonText}>Cancel</Text>
          </Pressable>
        ) : null}
      </View>

      {configuration.input_kind === 'numeric_0_10' ? (
        <>
          <Text style={styles.prompt}>Your overall mood for the whole day</Text>
          <View style={styles.scaleLabels}>
            <Text style={styles.scaleLabel}>{scale?.minimum_label ?? 'Lowest'}</Text>
            <Text style={styles.scaleLabel}>{scale?.maximum_label ?? 'Highest'}</Text>
          </View>
          <View style={styles.scoreGrid}>
            {Array.from({ length: 11 }, (_, score) => (
              <Pressable
                key={score}
                accessibilityLabel={`Mood rating ${score}`}
                accessibilityRole="button"
                accessibilityState={{ selected: moodValue === score }}
                disabled={busy}
                onPress={() => setMoodValue(score)}
                style={({ pressed }) => [
                  styles.scoreButton,
                  moodValue === score && styles.scoreButtonSelected,
                  pressed && styles.pressed,
                ]}>
                <Text style={[styles.scoreText, moodValue === score && styles.scoreTextSelected]}>
                  {score}
                </Text>
              </Pressable>
            ))}
          </View>
        </>
      ) : (
        <TextInput
          accessibilityLabel="Mood label"
          editable={!busy}
          maxLength={120}
          onChangeText={setMoodLabel}
          placeholder="How would you describe your mood?"
          style={styles.input}
          value={moodLabel}
        />
      )}

      {configuration.context_enabled ? (
        noteExpanded ? (
          <TextInput
            accessibilityLabel="Optional note"
            editable={!busy}
            maxLength={2000}
            multiline
            onChangeText={setContext}
            placeholder="Optional note"
            style={[styles.input, styles.noteInput]}
            value={context}
          />
        ) : (
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => setNoteExpanded(true)}
            style={({ pressed }) => [styles.addNoteButton, pressed && styles.pressed]}>
            <Text style={styles.addNoteText}>+ Add a note</Text>
          </Pressable>
        )
      ) : null}

      {error ? (
        <Text accessibilityLiveRegion="assertive" style={styles.errorText}>
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
          {notice}
        </Text>
      ) : null}

      <View style={styles.composerActions}>
        {!editingConfirmed ? (
          <Pressable
            accessibilityRole="button"
            disabled={busy || !values || !hasMood}
            onPress={() => {
              if (!values) return;
              void onSaveDraft(entryId, values, entryRevision).then((saved) => {
                if (saved) setEntryRevision(saved.revision);
              });
            }}
            style={({ pressed }) => [styles.finishLaterButton, pressed && styles.pressed]}>
            <Text style={styles.finishLaterText}>Finish later</Text>
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          disabled={busy || !values || !hasMood}
          onPress={() => {
            if (!values) return;
            void onSaveConfirmed(entryId, values, entryRevision, editingConfirmed).then((saved) => {
              if (saved) onSaved();
            });
          }}
          style={({ pressed }) => [styles.saveButton, pressed && styles.pressed]}>
          {busy ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>
              {editingConfirmed ? 'Save changes' : 'Save mood'}
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  );
}

export function MoodTodayScreen({ actionId, entryId }: Props) {
  const router = useRouter();
  const detail = useMoodActionDetail(actionId);
  const [editingEntryId, setEditingEntryId] = useState<string | null>(entryId ?? null);

  if (detail.loading) {
    return <ActivityIndicator color={colors.accentDark} style={styles.loading} />;
  }
  if (!detail.action) {
    return (
      <View style={styles.messageCard}>
        <Text style={styles.errorText}>{detail.error ?? 'This mood check-in could not be opened.'}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void detail.reload()}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.outlineButtonText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  const action = detail.action;
  const progress = getActionProgress(action);
  const todayEntry = getTodayEntry(detail.entries);
  const targetEntryId = entryId ?? editingEntryId;
  const selectedEntry = targetEntryId
    ? detail.entries.find((entry) => entry.id === targetEntryId)
    : undefined;
  const composerEntry = selectedEntry ?? (todayEntry?.status === 'draft' ? todayEntry : undefined);
  const editingHistoricalEntry = Boolean(entryId);

  const openHistory = () =>
    router.push({
      pathname: '/actions/[actionId]/history',
      params: { actionId },
    });

  if (entryId && !selectedEntry) {
    return (
      <View style={styles.messageCard}>
        <Text style={styles.errorText}>This mood entry could not be found.</Text>
        <Pressable
          accessibilityRole="button"
          onPress={openHistory}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.outlineButtonText}>Back to history</Text>
        </Pressable>
      </View>
    );
  }

  if (progress.completed && !selectedEntry) {
    return (
      <View style={styles.endedCard}>
        <Text style={styles.endedTitle}>This tracking period has ended</Text>
        <Text style={styles.supportingText}>
          Your saved entries are still available in mood history.
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={openHistory}
          style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
          <Text style={styles.outlineButtonText}>View history</Text>
        </Pressable>
      </View>
    );
  }

  if (todayEntry?.status === 'confirmed' && !editingEntryId) {
    return (
      <View style={styles.savedCard}>
        <Text style={styles.savedMark}>✓</Text>
        <Text style={styles.savedTitle}>Saved for today</Text>
        <Text style={styles.savedValue}>{entryValue(todayEntry)}</Text>
        {todayEntry.values.context ? (
          <Text style={styles.supportingText}>{todayEntry.values.context}</Text>
        ) : null}
        <Text style={styles.dateText}>{formatEntryDate(todayEntry.values.entry_time)}</Text>
        {detail.notice ? (
          <Text accessibilityLiveRegion="polite" style={styles.noticeText}>
            {detail.notice}
          </Text>
        ) : null}
        <View style={styles.savedActions}>
          <Pressable
            accessibilityRole="button"
            onPress={() => setEditingEntryId(todayEntry.id)}
            style={({ pressed }) => [styles.outlineButton, pressed && styles.pressed]}>
            <Text style={styles.outlineButtonText}>Edit</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={openHistory}
            style={({ pressed }) => [styles.textButton, pressed && styles.pressed]}>
            <Text style={styles.historyLinkText}>View history</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.actionMeta}>
        <Text style={styles.actionTitle}>Mood check-in</Text>
        <Text style={styles.supportingText}>
          {formatActionCadence(action.settings)} ·{' '}
          {action.settings.duration_kind === 'ongoing'
            ? `Day ${progress.dayNumber}`
            : `Day ${progress.dayNumber} of ${action.settings.duration_days}`}
        </Text>
      </View>

      <MoodEntryComposer
        action={action}
        busy={detail.busy}
        entry={composerEntry}
        error={detail.error}
        key={composerEntry ? `${composerEntry.id}:${composerEntry.revision}` : 'new-entry'}
        notice={detail.notice}
        onCancel={
          selectedEntry
            ? () => {
                if (editingHistoricalEntry) router.back();
                else setEditingEntryId(null);
              }
            : undefined
        }
        onSaveConfirmed={detail.saveConfirmed}
        onSaveDraft={detail.saveDraft}
        onSaved={() => {
          if (editingHistoricalEntry) router.back();
          else setEditingEntryId(null);
        }}
      />

      {!editingHistoricalEntry ? (
        <Pressable
          accessibilityRole="button"
          onPress={openHistory}
          style={({ pressed }) => [styles.historyLink, pressed && styles.pressed]}>
          <Text style={styles.historyLinkText}>View mood history</Text>
          <Text style={styles.chevron}>›</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const colors = {
  accent: '#ef5b3f',
  accentDark: '#ca3d28',
  ink: '#1e2421',
  line: '#e5ded2',
  muted: '#68716b',
};

const styles = StyleSheet.create({
  screen: { gap: 14 },
  loading: { marginTop: 60 },
  actionMeta: { gap: 3 },
  actionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  composer: {
    backgroundColor: '#fff',
    borderColor: colors.line,
    borderRadius: 16,
    borderWidth: 1,
    gap: 13,
    padding: 16,
  },
  composerHeader: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  headerCopy: { flex: 1, gap: 3 },
  composerTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  prompt: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  dateText: { color: colors.muted, fontSize: 12 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { color: colors.muted, fontSize: 11 },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  scoreButton: {
    alignItems: 'center',
    backgroundColor: '#efe9df',
    borderRadius: 10,
    height: 38,
    justifyContent: 'center',
    width: 38,
  },
  scoreButtonSelected: { backgroundColor: colors.accent },
  scoreText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  scoreTextSelected: { color: '#fff' },
  input: {
    backgroundColor: '#fffdf8',
    borderColor: colors.line,
    borderRadius: 10,
    borderWidth: 1,
    color: colors.ink,
    fontSize: 14,
    paddingHorizontal: 11,
    paddingVertical: 10,
  },
  noteInput: { minHeight: 76, textAlignVertical: 'top' },
  addNoteButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  addNoteText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  composerActions: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  finishLaterButton: { paddingHorizontal: 8, paddingVertical: 10 },
  finishLaterText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  saveButton: {
    alignItems: 'center',
    backgroundColor: colors.accentDark,
    borderRadius: 11,
    minWidth: 112,
    paddingHorizontal: 15,
    paddingVertical: 11,
  },
  saveButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  savedCard: {
    alignItems: 'flex-start',
    backgroundColor: '#eef6ef',
    borderRadius: 16,
    gap: 7,
    padding: 18,
  },
  savedMark: { color: '#23613a', fontSize: 22, fontWeight: '900' },
  savedTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  savedValue: { color: colors.ink, fontSize: 30, fontWeight: '900' },
  savedActions: { alignItems: 'center', flexDirection: 'row', gap: 12, marginTop: 4 },
  endedCard: { backgroundColor: '#fff', borderRadius: 16, gap: 8, padding: 18 },
  endedTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  messageCard: { alignItems: 'flex-start', backgroundColor: '#fff', borderRadius: 14, gap: 10, padding: 16 },
  outlineButton: {
    borderColor: colors.accentDark,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  outlineButtonText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  textButton: { paddingHorizontal: 5, paddingVertical: 9 },
  textButtonText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  supportingText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  historyLink: {
    alignItems: 'center',
    borderTopColor: colors.line,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 13,
  },
  historyLinkText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  chevron: { color: colors.accentDark, fontSize: 20, fontWeight: '800' },
  errorText: { color: '#982e22', fontSize: 13, lineHeight: 18 },
  noticeText: { color: '#23613a', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
