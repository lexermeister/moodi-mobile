import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  amendMoodEntry,
  confirmMoodEntry,
  deleteMoodEntry,
  exportMoodEntries,
  getMoodCandidateReview,
  listMoodActions,
  listMoodEntries,
  reviewMoodCandidate,
  saveMoodEntryDraft,
} from './actionsApi';
import type {
  MoodAction,
  MoodEntry,
  MoodEntryValues,
  RecordMoodActionSettings,
  RecordMoodCandidate,
} from './actionTypes';
import {
  createUuid,
  dayKeyAtCapturedOffset,
  normalizeMoodContext,
  parseMoodScore,
} from './moodDomain';
import { shareMoodExport } from './shareMoodExport';

type Props = {
  recordingId?: string;
  draftId?: string;
  sourceVersion: string;
  candidate?: RecordMoodCandidate;
};

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function settingsFromCandidate(
  candidate: RecordMoodCandidate,
): RecordMoodActionSettings | null {
  if (
    !candidate.frequency ||
    !candidate.reference_period ||
    !candidate.configuration
  ) {
    return null;
  }
  const now = new Date();
  const today = dayKeyAtCapturedOffset(now.toISOString(), -now.getTimezoneOffset());
  const startDate = candidate.start_date ?? today;
  const endDate =
    candidate.end_date ??
    new Date(
      Date.parse(`${startDate}T00:00:00.000Z`) +
        (candidate.duration_days - 1) * 24 * 60 * 60 * 1000,
    )
      .toISOString()
      .slice(0, 10);
  return {
    exact_task: candidate.exact_task,
    frequency: candidate.frequency,
    timing: candidate.timing,
    reference_period: candidate.reference_period,
    start_date: startDate,
    end_date: endDate,
    duration_days: candidate.duration_days,
    configuration: candidate.configuration,
  };
}

function formatEntryDate(entryTime: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(entryTime));
}

export function RecordMoodActionCard({
  recordingId,
  draftId,
  sourceVersion,
  candidate,
}: Props) {
  const [action, setAction] = useState<MoodAction | null>(null);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());
  const [rejected, setRejected] = useState(false);
  const [loading, setLoading] = useState(Boolean(recordingId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [entryId, setEntryId] = useState(createUuid);
  const [entryRevision, setEntryRevision] = useState<number | null>(null);
  const [editingConfirmed, setEditingConfirmed] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [entryTime, setEntryTime] = useState(() => new Date().toISOString());
  const [timezoneOffsetMinutes, setTimezoneOffsetMinutes] = useState(
    () => -new Date().getTimezoneOffset(),
  );
  const [moodValue, setMoodValue] = useState<number | null>(null);
  const [moodLabel, setMoodLabel] = useState('');
  const [context, setContext] = useState('');

  const refreshEntries = useCallback(async (activeAction: MoodAction) => {
    const loaded = await listMoodEntries(activeAction.id);
    setEntries(loaded);
    const available = new Set(
      loaded.filter((entry) => entry.status === 'confirmed').map((entry) => entry.id),
    );
    setSelectedEntryIds((current) =>
      new Set([...current].filter((entryId) => available.has(entryId))),
    );
  }, []);

  useEffect(() => {
    if (!recordingId) {
      return;
    }
    let active = true;
    const load = async () => {
      try {
        const actions = await listMoodActions(recordingId);
        const review = candidate
          ? await getMoodCandidateReview(recordingId, candidate.id)
          : null;
        if (!active) return;
        const activeAction = review?.action ?? actions[0] ?? null;
        setAction(activeAction);
        setRejected(review?.disposition === 'rejected');
        if (activeAction) await refreshEntries(activeAction);
      } catch (loadError) {
        if (active) setError(messageFrom(loadError, 'The Action could not be loaded.'));
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [candidate, recordingId, refreshEntries]);

  const resetForm = useCallback(() => {
    const now = new Date();
    setEntryId(createUuid());
    setEntryRevision(null);
    setEditingConfirmed(false);
    setReviewing(false);
    setEntryTime(now.toISOString());
    setTimezoneOffsetMinutes(-now.getTimezoneOffset());
    setMoodValue(null);
    setMoodLabel('');
    setContext('');
  }, []);

  const values = useMemo((): MoodEntryValues | null => {
    if (!action) return null;
    try {
      const dayKey = dayKeyAtCapturedOffset(entryTime, timezoneOffsetMinutes);
      const configuration = action.settings.configuration;
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
  }, [action, context, entryTime, moodLabel, moodValue, timezoneOffsetMinutes]);

  const activate = useCallback(async () => {
    if (!recordingId || !draftId || !candidate) return;
    const settings = settingsFromCandidate(candidate);
    if (!settings) return;
    setBusy(true);
    setError(null);
    try {
      const activated = await reviewMoodCandidate({
        recordingId,
        candidateId: candidate.id,
        draftId,
        sourceVersion,
        disposition: 'activate',
        settings,
      });
      setAction(activated);
      setRejected(false);
      setNotice('Record mood Action activated.');
    } catch (activationError) {
      setError(messageFrom(activationError, 'The Action could not be activated.'));
    } finally {
      setBusy(false);
    }
  }, [candidate, draftId, recordingId, sourceVersion]);

  const reject = useCallback(async () => {
    if (!recordingId || !draftId || !candidate) return;
    setBusy(true);
    setError(null);
    try {
      await reviewMoodCandidate({
        recordingId,
        candidateId: candidate.id,
        draftId,
        sourceVersion,
        disposition: 'reject',
        settings: null,
      });
      setRejected(true);
      setNotice('Candidate dismissed. No Action was created.');
    } catch (reviewError) {
      setError(messageFrom(reviewError, 'The candidate review could not be saved.'));
    } finally {
      setBusy(false);
    }
  }, [candidate, draftId, recordingId, sourceVersion]);

  const saveDraft = useCallback(async () => {
    if (!action || !values) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveMoodEntryDraft({
        actionId: action.id,
        entryId,
        values,
        expectedRevision: entryRevision,
      });
      setEntryRevision(saved.revision);
      await refreshEntries(action);
      setNotice('Draft saved.');
    } catch (saveError) {
      setError(messageFrom(saveError, 'The draft could not be saved. Your input is still here.'));
    } finally {
      setBusy(false);
    }
  }, [action, entryId, entryRevision, refreshEntries, values]);

  const confirm = useCallback(async () => {
    if (!action || !values) return;
    if (values.mood_value === null && values.mood_label === null && values.context === null) {
      setError('Enter a mood rating or label before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingConfirmed && entryRevision !== null) {
        await amendMoodEntry({
          actionId: action.id,
          entryId,
          values,
          expectedRevision: entryRevision,
        });
        setNotice('Mood entry corrected.');
      } else {
        await confirmMoodEntry({
          actionId: action.id,
          entryId,
          values,
          expectedRevision: entryRevision,
        });
        setNotice('Mood entry saved.');
      }
      await refreshEntries(action);
      resetForm();
    } catch (confirmError) {
      setError(messageFrom(confirmError, 'The entry could not be saved. Your input is still here.'));
    } finally {
      setBusy(false);
    }
  }, [action, editingConfirmed, entryId, entryRevision, refreshEntries, resetForm, values]);

  const startReview = useCallback(() => {
    if (!values) return;
    if (values.mood_value === null && values.mood_label === null && values.context === null) {
      setError('Enter a mood rating or label before reviewing.');
      return;
    }
    setError(null);
    setReviewing(true);
  }, [values]);

  const editEntry = useCallback((entry: MoodEntry) => {
    setEntryId(entry.id);
    setEntryRevision(entry.revision);
    setEditingConfirmed(entry.status === 'confirmed');
    setReviewing(false);
    setEntryTime(entry.values.entry_time);
    setTimezoneOffsetMinutes(entry.values.timezone_offset_minutes);
    setMoodValue(entry.values.mood_value);
    setMoodLabel(entry.values.mood_label ?? '');
    setContext(entry.values.context ?? '');
    setNotice(entry.status === 'draft' ? 'Draft resumed.' : 'Editing saved entry.');
    setError(null);
  }, []);

  const removeEntry = useCallback(
    (entry: MoodEntry) => {
      if (!action) return;
      Alert.alert('Delete mood entry?', 'This removes the selected entry.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deleteMoodEntry(action.id, entry.id);
                await refreshEntries(action);
                if (entry.id === entryId) resetForm();
                setNotice('Mood entry deleted.');
              } catch (deleteError) {
                setError(messageFrom(deleteError, 'The mood entry could not be deleted.'));
              } finally {
                setBusy(false);
              }
            })();
          },
        },
      ]);
    },
    [action, entryId, refreshEntries, resetForm],
  );

  const toggleExportSelection = useCallback((entryId: string) => {
    setSelectedEntryIds((current) => {
      const next = new Set(current);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }, []);

  const exportSelected = useCallback(async () => {
    if (!action || selectedEntryIds.size === 0) return;
    setBusy(true);
    setError(null);
    try {
      const payload = await exportMoodEntries(action.id, [...selectedEntryIds]);
      await shareMoodExport(payload);
      setNotice('Selected mood entries exported.');
    } catch (exportError) {
      setError(messageFrom(exportError, 'The selected entries could not be exported.'));
    } finally {
      setBusy(false);
    }
  }, [action, selectedEntryIds]);

  if (loading) {
    return <ActivityIndicator color={colors.accentDark} />;
  }
  if (!candidate && !action) return null;

  if (!action) {
    if (rejected) {
      return (
        <View style={styles.candidateCard}>
          <Text style={styles.candidateTitle}>Record mood candidate dismissed</Text>
          <Text style={styles.supportingText}>No Action was created.</Text>
        </View>
      );
    }
    if (!candidate) return null;
    const canActivate = Boolean(settingsFromCandidate(candidate) && recordingId && draftId);
    return (
      <View style={styles.candidateCard}>
        <View style={styles.titleRow}>
          <Text style={styles.candidateTitle}>Record mood Action found</Text>
          <Text style={styles.candidateBadge}>
            REVIEW
          </Text>
        </View>
        <Text style={styles.taskText}>{candidate.exact_task}</Text>
        <Text style={styles.metaText}>
          {[candidate.frequency, candidate.timing, candidate.reference_period]
            .filter(Boolean)
            .concat(`${candidate.duration_days} days`)
            .join(' · ') || 'Details not established'}
        </Text>
        {candidate.configuration?.input_kind === 'numeric_0_10' &&
        candidate.configuration.scale ? (
          <View style={styles.scaleReviewBox}>
            <Text style={styles.sourceLabel}>Scale to confirm</Text>
            <Text style={styles.taskText}>
              0 = {candidate.configuration.scale.minimum_label} · 10 ={' '}
              {candidate.configuration.scale.maximum_label}
            </Text>
            {candidate.configuration.scale_origin === 'moodi_default' ? (
              <Text style={styles.supportingText}>
                Moodi default for Record mood: overall mood 0–10, once each evening for 14 days.
                Activating confirms these defaults.
              </Text>
            ) : (
              <Text style={styles.supportingText}>Scale stated in the session.</Text>
            )}
          </View>
        ) : null}
        <View style={styles.sourceBox}>
          <Text style={styles.sourceLabel}>From the session</Text>
          <Text style={styles.sourceText}>“{candidate.source_excerpt}”</Text>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void reject()}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Not an action</Text>
          </Pressable>
          {canActivate ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void activate()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Activate</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  const configuration = action.settings.configuration;
  const scale = configuration.scale;
  return (
    <View style={styles.actionCard}>
      <View style={styles.titleRow}>
        <Text style={styles.candidateTitle}>Record mood</Text>
        <Text style={styles.activeBadge}>ACTIVE</Text>
      </View>
      <Text style={styles.taskText}>{action.settings.exact_task}</Text>
      <Text style={styles.metaText}>
        {[action.settings.frequency, action.settings.timing, action.settings.reference_period]
          .filter(Boolean)
          .concat(`${action.settings.duration_days} days`)
          .join(' · ')}
      </Text>

      <View style={styles.composer}>
        <Text style={styles.composerTitle}>
          {editingConfirmed ? 'Correct mood entry' : entryRevision ? 'Resume draft' : 'Today'}
        </Text>
        <Text style={styles.dateText}>{formatEntryDate(entryTime)}</Text>

        {configuration.input_kind === 'numeric_0_10' ? (
          <>
            <View style={styles.scaleLabels}>
              <Text style={styles.scaleLabel}>{scale?.minimum_label ?? '0'}</Text>
              <Text style={styles.scaleLabel}>{scale?.maximum_label ?? '10'}</Text>
            </View>
            <View style={styles.scoreGrid}>
              {Array.from({ length: 11 }, (_, score) => (
                <Pressable
                  key={score}
                  accessibilityLabel={`Mood rating ${score}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: moodValue === score }}
                  disabled={reviewing}
                  onPress={() => setMoodValue(score)}
                  style={({ pressed }) => [
                    styles.scoreButton,
                    moodValue === score && styles.scoreButtonSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.scoreText,
                      moodValue === score && styles.scoreTextSelected,
                    ]}>
                    {score}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <TextInput
            accessibilityLabel="Mood label"
            maxLength={120}
            onChangeText={setMoodLabel}
            editable={!reviewing}
            placeholder="How would you describe your mood?"
            style={styles.input}
            value={moodLabel}
          />
        )}

        {configuration.context_enabled ? (
          <TextInput
            accessibilityLabel="Optional context"
            maxLength={2000}
            multiline
            onChangeText={setContext}
            editable={!reviewing}
            placeholder="Optional context"
            style={[styles.input, styles.contextInput]}
            value={context}
          />
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
        {reviewing && values ? (
          <View style={styles.reviewBox}>
            <Text style={styles.reviewTitle}>Review before saving</Text>
            <Text style={styles.reviewValue}>
              {values.mood_value !== null
                ? `Overall mood: ${values.mood_value}/10`
                : `Mood: ${values.mood_label ?? 'Not supplied'}`}
            </Text>
            {values.context ? <Text style={styles.reviewContext}>{values.context}</Text> : null}
            <Text style={styles.historyMeta}>{formatEntryDate(values.entry_time)}</Text>
            <View style={styles.buttonRow}>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => setReviewing(false)}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Edit</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void confirm()}
                style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                {busy ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>Confirm entry</Text>
                )}
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.buttonRow}>
            {(entryRevision !== null || editingConfirmed) && (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={resetForm}
                style={({ pressed }) => [styles.textOnlyButton, pressed && styles.pressed]}>
                <Text style={styles.textOnlyButtonText}>Cancel</Text>
              </Pressable>
            )}
            {!editingConfirmed ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy || !values}
                onPress={() => void saveDraft()}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>Save draft</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={busy || !values}
              onPress={startReview}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>
                {editingConfirmed ? 'Review correction' : 'Review entry'}
              </Text>
            </Pressable>
          </View>
        )}
      </View>

      {entries.length ? (
        <View style={styles.history}>
          <View style={styles.titleRow}>
            <Text style={styles.historyTitle}>History</Text>
            {selectedEntryIds.size ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => void exportSelected()}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
                <Text style={styles.secondaryButtonText}>
                  Export selected ({selectedEntryIds.size})
                </Text>
              </Pressable>
            ) : null}
          </View>
          {entries.map((entry) => (
            <View key={entry.id} style={styles.historyRow}>
              <View style={styles.historyCopy}>
                <Text style={styles.historyValue}>
                  {entry.values.mood_value !== null
                    ? `${entry.values.mood_value}/10 ${scale ? `(${scale.minimum_label}–${scale.maximum_label})` : ''}`
                    : entry.values.mood_label ?? 'Text-only entry'}
                </Text>
                <Text style={styles.historyMeta}>
                  {formatEntryDate(entry.values.entry_time)} · {entry.status}
                </Text>
              </View>
              {entry.status === 'confirmed' ? (
                <Pressable
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectedEntryIds.has(entry.id) }}
                  onPress={() => toggleExportSelection(entry.id)}
                  style={({ pressed }) => [
                    styles.smallButton,
                    selectedEntryIds.has(entry.id) && styles.selectedButton,
                    pressed && styles.pressed,
                  ]}>
                  <Text style={styles.smallButtonText}>
                    {selectedEntryIds.has(entry.id) ? 'Selected' : 'Select'}
                  </Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                onPress={() => editEntry(entry)}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
                <Text style={styles.smallButtonText}>
                  {entry.status === 'draft' ? 'Resume' : 'Edit'}
                </Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => removeEntry(entry)}
                style={({ pressed }) => [styles.smallButton, pressed && styles.pressed]}>
                <Text style={styles.deleteText}>Delete</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const colors = {
  ink: '#1e2421',
  muted: '#68716b',
  accent: '#ef5b3f',
  accentDark: '#ca3d28',
  line: '#e5ded2',
};

const styles = StyleSheet.create({
  candidateCard: { backgroundColor: '#fff8e8', borderRadius: 14, gap: 10, padding: 14 },
  actionCard: { backgroundColor: '#eef6ef', borderRadius: 14, gap: 12, padding: 14 },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  candidateTitle: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '800' },
  candidateBadge: { backgroundColor: '#f5dfb4', borderRadius: 7, color: '#725d36', fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  activeBadge: { backgroundColor: '#d4ead9', borderRadius: 7, color: '#23613a', fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  taskText: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  metaText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  sourceBox: { borderLeftColor: '#d2b16c', borderLeftWidth: 3, gap: 3, paddingLeft: 10 },
  scaleReviewBox: { backgroundColor: '#fffdf8', borderRadius: 10, gap: 4, padding: 10 },
  sourceLabel: { color: '#725d36', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  sourceText: { color: '#5e5038', fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  supportingText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  composer: { backgroundColor: '#fffdf8', borderColor: colors.line, borderRadius: 13, borderWidth: 1, gap: 10, padding: 12 },
  composerTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  dateText: { color: colors.muted, fontSize: 12 },
  scaleLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  scaleLabel: { color: colors.muted, fontSize: 11 },
  scoreGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  scoreButton: { alignItems: 'center', backgroundColor: '#efe9df', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  scoreButtonSelected: { backgroundColor: colors.accent },
  scoreText: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  scoreTextSelected: { color: '#fff' },
  input: { backgroundColor: '#fff', borderColor: colors.line, borderRadius: 10, borderWidth: 1, color: colors.ink, fontSize: 14, paddingHorizontal: 11, paddingVertical: 10 },
  contextInput: { minHeight: 76, textAlignVertical: 'top' },
  reviewBox: { backgroundColor: '#f5f0e7', borderRadius: 10, gap: 7, padding: 11 },
  reviewTitle: { color: colors.ink, fontSize: 13, fontWeight: '800' },
  reviewValue: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  reviewContext: { color: colors.muted, fontSize: 13, lineHeight: 18 },
  buttonRow: { alignItems: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'flex-end' },
  primaryButton: { alignItems: 'center', backgroundColor: colors.accentDark, borderRadius: 10, minWidth: 108, paddingHorizontal: 13, paddingVertical: 10 },
  primaryButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  secondaryButton: { borderColor: colors.accentDark, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9 },
  secondaryButtonText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  textOnlyButton: { paddingHorizontal: 7, paddingVertical: 8 },
  textOnlyButtonText: { color: colors.muted, fontSize: 13, fontWeight: '700' },
  noticeText: { color: '#23613a', fontSize: 12, fontWeight: '700' },
  errorText: { color: '#982e22', fontSize: 12, lineHeight: 17 },
  history: { gap: 8 },
  historyTitle: { color: colors.ink, fontSize: 14, fontWeight: '800' },
  historyRow: { alignItems: 'center', backgroundColor: '#fffdf8', borderRadius: 10, flexDirection: 'row', gap: 6, padding: 10 },
  historyCopy: { flex: 1, gap: 2 },
  historyValue: { color: colors.ink, fontSize: 13, fontWeight: '700' },
  historyMeta: { color: colors.muted, fontSize: 11 },
  smallButton: { paddingHorizontal: 6, paddingVertical: 5 },
  selectedButton: { backgroundColor: '#dcefe1', borderRadius: 7 },
  smallButtonText: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
  deleteText: { color: '#8b8176', fontSize: 12, fontWeight: '700' },
  pressed: { opacity: 0.65 },
});
