import DateTimePicker from '@react-native-community/datetimepicker';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  amendRatingEntry,
  confirmRatingEntry,
  deleteRatingEntry,
  exportRatingEntries,
  getRatingAction,
  getRatingCandidateResolution,
  listRatingEntries,
  reviewRatingCandidate,
  saveRatingEntryDraft,
} from './actionsApi';
import type {
  RatingAction,
  RatingEntry,
  RatingEntryValues,
  RecordRatingActionSettings,
  RecordRatingCandidate,
} from './actionTypes';
import { formatActionDateRange, getActionProgress, getTodayEntry } from './actionStatus';
import {
  createUuid,
  dayKeyAtCapturedOffset,
  normalizeRatingContext,
  parseRatingScore,
} from './ratingDomain';
import { getRatingMetricPresentation } from './ratingMetrics';
import { shareRatingExport } from './shareRatingExport';
import {
  formatActionCadence,
  formatActionDuration,
  formatClockTime,
} from './scheduleFormatting';

type Props = {
  recordingId?: string;
  actionId?: string;
  draftId?: string;
  sourceVersion?: string;
  candidate?: RecordRatingCandidate;
  compactWhenActive?: boolean;
  onSessionStateChange?: (status: RecordRatingSessionState) => void;
};

export type RecordRatingSessionState =
  | 'loading'
  | 'needs_setup'
  | 'active'
  | 'already_active'
  | 'linked_existing'
  | 'conflict'
  | 'not_added'
  | 'error';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function settingsFromCandidate(
  candidate: RecordRatingCandidate,
): RecordRatingActionSettings | null {
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
    duration_kind: 'fixed',
    duration_days: candidate.duration_days,
    preferred_check_in_time: null,
    preferred_time_zone: null,
    schedule_origin: 'moodi_default',
    configuration: candidate.configuration,
  };
}

type DurationChoice = '7' | '14' | '30' | 'custom' | 'ongoing';

function durationChoiceFrom(settings: RecordRatingActionSettings): DurationChoice {
  if (settings.duration_kind === 'ongoing') return 'ongoing';
  if (settings.duration_days === 7) return '7';
  if (settings.duration_days === 14) return '14';
  if (settings.duration_days === 30) return '30';
  return 'custom';
}

function timePickerValue(value: string | null) {
  const date = new Date();
  const [hours, minutes] = (value ?? '20:00').split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function timeString(value: Date) {
  return `${value.getHours().toString().padStart(2, '0')}:${value
    .getMinutes()
    .toString()
    .padStart(2, '0')}`;
}

function endDateFor(startDate: string, durationDays: number) {
  return new Date(
    Date.parse(`${startDate}T00:00:00.000Z`) + (durationDays - 1) * 24 * 60 * 60 * 1000,
  )
    .toISOString()
    .slice(0, 10);
}

function formatEntryDate(entryTime: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(entryTime));
}

export function RecordRatingActionCard({
  recordingId,
  actionId,
  draftId,
  sourceVersion,
  candidate,
  compactWhenActive = false,
  onSessionStateChange,
}: Props) {
  const router = useRouter();
  const [action, setAction] = useState<RatingAction | null>(null);
  const [existingAction, setExistingAction] = useState<RatingAction | null>(null);
  const [resolutionStatus, setResolutionStatus] = useState<
    'needs_setup' | 'activated' | 'linked_existing' | 'already_active' | 'rejected' | 'conflict'
  >('needs_setup');
  const [entries, setEntries] = useState<RatingEntry[]>([]);
  const [selectedEntryIds, setSelectedEntryIds] = useState<Set<string>>(() => new Set());
  const [rejected, setRejected] = useState(false);
  const [loading, setLoading] = useState(Boolean(recordingId || actionId));
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
  const [ratingValue, setRatingValue] = useState<number | null>(null);
  const [ratingLabel, setRatingLabel] = useState('');
  const [context, setContext] = useState('');
  const [reviewedSettings, setReviewedSettings] = useState<RecordRatingActionSettings | null>(() =>
    candidate ? settingsFromCandidate(candidate) : null,
  );
  const [editingSchedule, setEditingSchedule] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [draftCheckInTime, setDraftCheckInTime] = useState(() => new Date());
  const [draftDurationChoice, setDraftDurationChoice] =
    useState<DurationChoice>('14');
  const [draftCustomDays, setDraftCustomDays] = useState('14');
  const metric = candidate?.metric ?? action?.metric ?? existingAction?.metric ?? 'mood';
  const presentation = getRatingMetricPresentation(metric);
  const metricLabel = presentation.checkInTitle.replace(' check-in', '');

  const editEntry = useCallback((entry: RatingEntry, announce = true) => {
    setEntryId(entry.id);
    setEntryRevision(entry.revision);
    setEditingConfirmed(entry.status === 'confirmed');
    setReviewing(false);
    setEntryTime(entry.values.entry_time);
    setTimezoneOffsetMinutes(entry.values.timezone_offset_minutes);
    setRatingValue(entry.values.rating_value);
    setRatingLabel(entry.values.rating_label ?? '');
    setContext(entry.values.context ?? '');
    if (announce) {
      setNotice(entry.status === 'draft' ? 'Draft resumed.' : 'Editing saved entry.');
    }
    setError(null);
  }, []);

  const refreshEntries = useCallback(
    async (activeAction: RatingAction, openTodayEntry = false) => {
      const loaded = await listRatingEntries(activeAction.id);
      setEntries(loaded);
      const available = new Set(
        loaded.filter((entry) => entry.status === 'confirmed').map((entry) => entry.id),
      );
      setSelectedEntryIds((current) =>
        new Set([...current].filter((entryId) => available.has(entryId))),
      );
      if (openTodayEntry) {
        const todayEntry = getTodayEntry(loaded);
        if (todayEntry?.status === 'draft') editEntry(todayEntry, false);
      }
    },
    [editEntry],
  );

  useEffect(() => {
    if (!recordingId && !actionId) {
      return;
    }
    let active = true;
    if (recordingId && candidate) onSessionStateChange?.('loading');
    const load = async () => {
      try {
        if (actionId) {
          const loadedAction = await getRatingAction(actionId);
          if (!active) return;
          setAction(loadedAction);
          await refreshEntries(loadedAction, true);
          return;
        }
        if (!recordingId) return;
        const resolution = candidate
          ? await getRatingCandidateResolution(recordingId, candidate.id)
          : null;
        if (!active) return;
        const activeAction =
          resolution?.status === 'activated' || resolution?.status === 'linked_existing'
            ? resolution.action
            : null;
        const availableAction =
          resolution?.status === 'already_active' || resolution?.status === 'conflict'
            ? resolution.action
            : null;
        setAction(activeAction);
        setExistingAction(availableAction);
        const nextStatus = resolution?.status ?? 'needs_setup';
        setResolutionStatus(nextStatus);
        const wasRejected = nextStatus === 'rejected';
        setRejected(wasRejected);
        onSessionStateChange?.(
          nextStatus === 'activated'
            ? 'active'
            : nextStatus === 'linked_existing'
              ? 'linked_existing'
              : nextStatus === 'already_active'
                ? 'already_active'
                : nextStatus === 'conflict'
                  ? 'conflict'
                  : wasRejected
                    ? 'not_added'
                    : 'needs_setup',
        );
        if (activeAction && !compactWhenActive) await refreshEntries(activeAction, true);
      } catch (loadError) {
        if (active) {
          setError(messageFrom(loadError, 'The Action could not be loaded.'));
          onSessionStateChange?.('error');
        }
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, [
    actionId,
    candidate,
    compactWhenActive,
    onSessionStateChange,
    recordingId,
    refreshEntries,
    sourceVersion,
  ]);

  const resetForm = useCallback(() => {
    const now = new Date();
    setEntryId(createUuid());
    setEntryRevision(null);
    setEditingConfirmed(false);
    setReviewing(false);
    setEntryTime(now.toISOString());
    setTimezoneOffsetMinutes(-now.getTimezoneOffset());
    setRatingValue(null);
    setRatingLabel('');
    setContext('');
  }, []);

  const values = useMemo((): RatingEntryValues | null => {
    if (!action) return null;
    try {
      const dayKey = dayKeyAtCapturedOffset(entryTime, timezoneOffsetMinutes);
      const configuration = action.settings.configuration;
      const numericValue =
        configuration.input_kind === 'numeric_0_10' && ratingValue !== null
          ? parseRatingScore(ratingValue)
          : null;
      const label =
        configuration.input_kind === 'label' && ratingLabel.trim() ? ratingLabel.trim() : null;
      return {
        relevant_date: dayKey,
        entry_time: entryTime,
        timezone_offset_minutes: timezoneOffsetMinutes,
        day_key: dayKey,
        rating_value: numericValue,
        rating_label: label,
        context: configuration.context_enabled ? normalizeRatingContext(context) : null,
        scale_id: numericValue === null ? null : configuration.scale?.id ?? null,
      };
    } catch {
      return null;
    }
  }, [action, context, entryTime, ratingLabel, ratingValue, timezoneOffsetMinutes]);

  const activate = useCallback(async () => {
    if (!recordingId || !draftId || !sourceVersion || !candidate || !reviewedSettings) return;
    setBusy(true);
    setError(null);
    try {
      const review = await reviewRatingCandidate({
        recordingId,
        candidateId: candidate.id,
        draftId,
        sourceVersion,
        disposition: 'activate',
        settings: reviewedSettings,
      });
      if (!review.action) throw new Error('The activated Action was not returned.');
      const activatedPresentation = getRatingMetricPresentation(review.action.metric);
      const linkedExisting = review.disposition === 'linked_existing';
      setAction(review.action);
      setExistingAction(null);
      setResolutionStatus(linkedExisting ? 'linked_existing' : 'activated');
      setRejected(false);
      setNotice(
        linkedExisting
          ? `This session now uses your existing ${activatedPresentation.checkInTitle.toLowerCase()} Action.`
          : `${activatedPresentation.checkInTitle} Action activated.`,
      );
      onSessionStateChange?.(linkedExisting ? 'linked_existing' : 'active');
    } catch (activationError) {
      setError(messageFrom(activationError, 'The Action could not be activated.'));
    } finally {
      setBusy(false);
    }
  }, [candidate, draftId, onSessionStateChange, recordingId, reviewedSettings, sourceVersion]);

  const openScheduleEditor = useCallback(() => {
    if (!reviewedSettings) return;
    const choice = durationChoiceFrom(reviewedSettings);
    setDraftCheckInTime(timePickerValue(reviewedSettings.preferred_check_in_time));
    setDraftDurationChoice(choice);
    setDraftCustomDays(`${reviewedSettings.duration_days ?? 14}`);
    setShowTimePicker(false);
    setEditingSchedule(true);
    setError(null);
    setNotice(null);
  }, [reviewedSettings]);

  const saveSchedule = useCallback(() => {
    if (!reviewedSettings || !reviewedSettings.start_date) return;
    const ongoing = draftDurationChoice === 'ongoing';
    const durationDays = ongoing
      ? null
      : Number(draftDurationChoice === 'custom' ? draftCustomDays : draftDurationChoice);
    if (
      !ongoing &&
      (durationDays === null ||
        !Number.isInteger(durationDays) ||
        durationDays < 1 ||
        durationDays > 365)
    ) {
      setError('Choose a duration from 1 to 365 days.');
      return;
    }
    const preferredTime = timeString(draftCheckInTime);
    const preferredTimeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    setReviewedSettings({
      ...reviewedSettings,
      duration_kind: ongoing ? 'ongoing' : 'fixed',
      duration_days: durationDays,
      end_date:
        ongoing || durationDays === null
          ? null
          : endDateFor(reviewedSettings.start_date, durationDays),
      preferred_check_in_time: preferredTime,
      preferred_time_zone: preferredTimeZone,
      schedule_origin: 'user_selected',
    });
    setEditingSchedule(false);
    setShowTimePicker(false);
    setError(null);
    setNotice('Schedule updated. Review it before activating.');
  }, [draftCheckInTime, draftCustomDays, draftDurationChoice, reviewedSettings]);

  const reject = useCallback(async () => {
    if (!recordingId || !draftId || !sourceVersion || !candidate) return;
    setBusy(true);
    setError(null);
    try {
      await reviewRatingCandidate({
        recordingId,
        candidateId: candidate.id,
        draftId,
        sourceVersion,
        disposition: 'reject',
        settings: null,
      });
      setRejected(true);
      setExistingAction(null);
      setResolutionStatus('rejected');
      setNotice('Candidate dismissed. No Action was created.');
      onSessionStateChange?.('not_added');
    } catch (reviewError) {
      setError(messageFrom(reviewError, 'The candidate review could not be saved.'));
    } finally {
      setBusy(false);
    }
  }, [candidate, draftId, onSessionStateChange, recordingId, sourceVersion]);

  const saveDraft = useCallback(async () => {
    if (!action || !values) return;
    setBusy(true);
    setError(null);
    try {
      const saved = await saveRatingEntryDraft({
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
    if (values.rating_value === null && values.rating_label === null && values.context === null) {
      setError('Enter a rating or label before saving.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (editingConfirmed && entryRevision !== null) {
        await amendRatingEntry({
          actionId: action.id,
          entryId,
          values,
          expectedRevision: entryRevision,
        });
        setNotice('Rating entry corrected.');
      } else {
        await confirmRatingEntry({
          actionId: action.id,
          entryId,
          values,
          expectedRevision: entryRevision,
        });
        setNotice('Rating entry saved.');
      }
      resetForm();
      await refreshEntries(action, true);
    } catch (confirmError) {
      setError(messageFrom(confirmError, 'The entry could not be saved. Your input is still here.'));
    } finally {
      setBusy(false);
    }
  }, [action, editingConfirmed, entryId, entryRevision, refreshEntries, resetForm, values]);

  const startReview = useCallback(() => {
    if (!values) return;
    if (values.rating_value === null && values.rating_label === null && values.context === null) {
      setError('Enter a rating or label before reviewing.');
      return;
    }
    setError(null);
    setReviewing(true);
  }, [values]);

  const removeEntry = useCallback(
    (entry: RatingEntry) => {
      if (!action) return;
      Alert.alert('Delete rating entry?', 'This removes the selected entry.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            void (async () => {
              setBusy(true);
              try {
                await deleteRatingEntry(action.id, entry.id);
                await refreshEntries(action);
                if (entry.id === entryId) {
                  resetForm();
                }
                setNotice('Rating entry deleted.');
              } catch (deleteError) {
                setError(messageFrom(deleteError, 'The rating entry could not be deleted.'));
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
      const payload = await exportRatingEntries(action.id, [...selectedEntryIds]);
      await shareRatingExport(payload);
      setNotice('Selected rating entries exported.');
    } catch (exportError) {
      setError(messageFrom(exportError, 'The selected entries could not be exported.'));
    } finally {
      setBusy(false);
    }
  }, [action, selectedEntryIds]);

  if (loading) {
    return <ActivityIndicator color={colors.accentDark} />;
  }
  if (!candidate && !action) {
    return error ? (
      <View style={styles.candidateCard}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    ) : null;
  }

  if (!action && candidate && existingAction) {
    const hasConflict = resolutionStatus === 'conflict';
    const canLink = Boolean(
      !hasConflict && reviewedSettings && recordingId && draftId && sourceVersion,
    );
    return (
      <View style={styles.candidateCard}>
        <View style={styles.titleRow}>
          <Text style={styles.candidateTitle}>{presentation.checkInTitle}</Text>
          <Text style={[styles.candidateBadge, hasConflict && styles.conflictBadge]}>
            {hasConflict ? 'NEEDS ATTENTION' : 'ALREADY ACTIVE'}
          </Text>
        </View>
        <Text style={styles.taskText}>{candidate.exact_task}</Text>
        <Text style={styles.supportingText}>
          {hasConflict
            ? `An ongoing ${presentation.checkInTitle.toLowerCase()} Action already exists with different tracking settings. Moodi will not create another one or change the existing Action.`
            : `An ongoing ${presentation.checkInTitle.toLowerCase()} Action from an earlier session already covers this task. You can link this session without creating another Action.`}
        </Text>
        <View style={styles.scheduleReviewBox}>
          <Text style={styles.scheduleTitle}>Existing Action</Text>
          <Text style={styles.taskText}>{formatActionCadence(existingAction.settings)}</Text>
          <Text style={styles.metaText}>{formatActionDuration(existingAction.settings)}</Text>
        </View>
        <View style={styles.sourceBox}>
          <Text style={styles.sourceLabel}>From this session</Text>
          <Text style={styles.sourceText}>“{candidate.source_excerpt}”</Text>
        </View>
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
        <View style={styles.buttonRow}>
          <Pressable
            accessibilityRole="button"
            disabled={busy}
            onPress={() => void reject()}
            style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Not an action</Text>
          </Pressable>
          {canLink ? (
            <Pressable
              accessibilityRole="button"
              disabled={busy}
              onPress={() => void activate()}
              style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
              <Text style={styles.primaryButtonText}>Use existing Action</Text>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() =>
                router.push({
                  pathname: '/actions/[actionId]',
                  params: { actionId: existingAction.id },
                })
              }
              style={({ pressed }) => [styles.openActionsButton, pressed && styles.pressed]}>
              <Text style={styles.openActionsButtonText}>Open existing Action</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  if (!action) {
    if (rejected) {
      return (
        <View style={styles.candidateCard}>
          <Text style={styles.candidateTitle}>{presentation.checkInTitle} not added</Text>
          <Text style={styles.supportingText}>
            You marked this as something that was not agreed in the session.
          </Text>
        </View>
      );
    }
    if (!candidate) return null;
    const canActivate = Boolean(
      reviewedSettings && recordingId && draftId && sourceVersion && !editingSchedule,
    );
    return (
      <View style={styles.candidateCard}>
        <View style={styles.titleRow}>
          <Text style={styles.candidateTitle}>{presentation.checkInTitle}</Text>
          <Text style={styles.candidateBadge}>
            NEEDS SETUP
          </Text>
        </View>
        <Text style={styles.taskText}>{candidate.exact_task}</Text>
        <Text style={styles.metaText}>
          {[candidate.frequency, candidate.reference_period].filter(Boolean).join(' · ')}
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
                Moodi default for {metricLabel.toLowerCase()}: 0–10, once each evening for 14 days.
                You can edit the check-in schedule before activating.
              </Text>
            ) : (
              <Text style={styles.supportingText}>Scale stated in the session.</Text>
            )}
          </View>
        ) : null}
        {reviewedSettings ? (
          <View style={styles.scheduleReviewBox}>
            <View style={styles.titleRow}>
              <Text style={styles.scheduleTitle}>Schedule</Text>
              {!editingSchedule ? (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy}
                  onPress={openScheduleEditor}
                  style={({ pressed }) => [styles.editScheduleButton, pressed && styles.pressed]}>
                  <Text style={styles.secondaryButtonText}>Edit</Text>
                </Pressable>
              ) : null}
            </View>
            {editingSchedule ? (
              <View style={styles.scheduleEditor}>
                <Text style={styles.fieldLabel}>Check-in time</Text>
                <Pressable
                  accessibilityHint="Opens the time picker"
                  accessibilityLabel={`Check-in time, ${formatClockTime(timeString(draftCheckInTime))}`}
                  accessibilityRole="button"
                  onPress={() => setShowTimePicker(true)}
                  style={({ pressed }) => [styles.timeButton, pressed && styles.pressed]}>
                  <Text style={styles.timeButtonText}>
                    {formatClockTime(timeString(draftCheckInTime))}
                  </Text>
                  <Text style={styles.timeButtonAction}>
                    {showTimePicker ? 'Selecting…' : 'Change'}
                  </Text>
                </Pressable>

                {showTimePicker && Platform.OS === 'ios' ? (
                  <View style={styles.timePickerPanel}>
                    <View style={styles.timePickerHeader}>
                      <Text style={styles.timePickerTitle}>Select check-in time</Text>
                      <Pressable
                        accessibilityLabel="Confirm check-in time"
                        accessibilityRole="button"
                        onPress={() => setShowTimePicker(false)}
                        style={({ pressed }) => [
                          styles.timePickerDoneButton,
                          pressed && styles.pressed,
                        ]}>
                        <Text style={styles.timePickerDoneText}>Done</Text>
                      </Pressable>
                    </View>
                    <DateTimePicker
                      accentColor={colors.accentDark}
                      display="spinner"
                      mode="time"
                      minuteInterval={5}
                      onValueChange={(_event, selectedTime) =>
                        setDraftCheckInTime(selectedTime)
                      }
                      style={styles.timePicker}
                      textColor={colors.ink}
                      themeVariant="light"
                      value={draftCheckInTime}
                    />
                  </View>
                ) : null}

                {showTimePicker && Platform.OS !== 'ios' ? (
                  <DateTimePicker
                    display="default"
                    mode="time"
                    minuteInterval={5}
                    onDismiss={() => setShowTimePicker(false)}
                    onValueChange={(_event, selectedTime) => {
                      setDraftCheckInTime(selectedTime);
                      setShowTimePicker(false);
                    }}
                    value={draftCheckInTime}
                  />
                ) : null}

                <Text style={styles.fieldLabel}>Duration</Text>
                <View style={styles.durationOptions}>
                  {(['7', '14', '30'] as const).map((days) => (
                    <Pressable
                      key={days}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: draftDurationChoice === days }}
                      onPress={() => setDraftDurationChoice(days)}
                      style={({ pressed }) => [
                        styles.durationOption,
                        draftDurationChoice === days && styles.durationOptionSelected,
                        pressed && styles.pressed,
                      ]}>
                      <Text
                        style={[
                          styles.durationOptionText,
                          draftDurationChoice === days && styles.durationOptionTextSelected,
                        ]}>
                        {days} days
                      </Text>
                    </Pressable>
                  ))}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draftDurationChoice === 'custom' }}
                    onPress={() => setDraftDurationChoice('custom')}
                    style={({ pressed }) => [
                      styles.durationOption,
                      draftDurationChoice === 'custom' && styles.durationOptionSelected,
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.durationOptionText,
                        draftDurationChoice === 'custom' && styles.durationOptionTextSelected,
                      ]}>
                      Custom
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ selected: draftDurationChoice === 'ongoing' }}
                    onPress={() => setDraftDurationChoice('ongoing')}
                    style={({ pressed }) => [
                      styles.durationOption,
                      draftDurationChoice === 'ongoing' && styles.durationOptionSelected,
                      pressed && styles.pressed,
                    ]}>
                    <Text
                      style={[
                        styles.durationOptionText,
                        draftDurationChoice === 'ongoing' && styles.durationOptionTextSelected,
                      ]}>
                      Ongoing
                    </Text>
                  </Pressable>
                </View>
                {draftDurationChoice === 'custom' ? (
                  <TextInput
                    accessibilityLabel="Custom duration in days"
                    keyboardType="number-pad"
                    maxLength={3}
                    onChangeText={setDraftCustomDays}
                    placeholder="Number of days"
                    style={styles.input}
                    value={draftCustomDays}
                  />
                ) : null}
                {draftDurationChoice === 'ongoing' ? (
                  <Text style={styles.supportingText}>No end date.</Text>
                ) : null}
                <View style={styles.buttonRow}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => {
                      setEditingSchedule(false);
                      setShowTimePicker(false);
                      setError(null);
                    }}
                    style={({ pressed }) => [styles.textOnlyButton, pressed && styles.pressed]}>
                    <Text style={styles.textOnlyButtonText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={saveSchedule}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
                    <Text style={styles.primaryButtonText}>Save changes</Text>
                  </Pressable>
                </View>
              </View>
            ) : (
              <>
                <Text style={styles.taskText}>{formatActionCadence(reviewedSettings)}</Text>
                <Text style={styles.metaText}>{formatActionDuration(reviewedSettings)}</Text>
              </>
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

  if (compactWhenActive) {
    return (
      <View style={styles.activatedCard}>
        <View style={styles.titleRow}>
          <Text style={styles.activatedMark}>✓</Text>
          <Text style={styles.candidateTitle}>
            {resolutionStatus === 'linked_existing'
              ? `Using existing ${presentation.checkInTitle.toLowerCase()} Action`
              : `${presentation.checkInTitle} activated`}
          </Text>
        </View>
        <Text style={styles.metaText}>{formatActionCadence(action.settings)}</Text>
        <Text style={styles.metaText}>{formatActionDuration(action.settings)}</Text>
        {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}
        <Pressable
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/actions/[actionId]', params: { actionId: action.id } })
          }
          style={({ pressed }) => [styles.openActionsButton, pressed && styles.pressed]}>
          <Text style={styles.openActionsButtonText}>Open in Actions</Text>
        </Pressable>
      </View>
    );
  }

  const configuration = action.settings.configuration;
  const scale = configuration.scale;
  const progress = getActionProgress(action);
  const todayEntry = getTodayEntry(entries);
  return (
    <View style={styles.actionCard}>
      <View style={styles.titleRow}>
        <Text style={styles.candidateTitle}>{presentation.checkInTitle}</Text>
        <Text style={[styles.activeBadge, progress.completed && styles.completedBadge]}>
          {progress.completed ? 'COMPLETED' : 'ACTIVE'}
        </Text>
      </View>
      <Text style={styles.taskText}>{action.settings.exact_task}</Text>
      <Text style={styles.metaText}>
        {formatActionCadence(action.settings)} · {action.settings.reference_period}
      </Text>
      <Text style={styles.progressText}>
        {progress.completed
          ? 'Completed'
          : action.settings.duration_kind === 'ongoing'
            ? `Day ${progress.dayNumber} · Ongoing`
            : `Day ${progress.dayNumber} of ${action.settings.duration_days}`}{' '}
        · {formatActionDateRange(action)}
      </Text>

      {progress.completed && entryRevision === null ? (
        <View style={styles.completedMessage}>
          <Text style={styles.composerTitle}>
            {action.settings.duration_kind === 'ongoing'
              ? 'This Action has ended'
              : `This ${action.settings.duration_days}-day Action is complete`}
          </Text>
          <Text style={styles.supportingText}>
            You can review, correct, delete, or export the entries below.
          </Text>
        </View>
      ) : todayEntry?.status === 'confirmed' && entryRevision === null ? (
        <View style={styles.completedMessage}>
          <Text style={styles.composerTitle}>Today recorded</Text>
          <Text style={styles.reviewValue}>
            {todayEntry.values.rating_value !== null
              ? `${metricLabel}: ${todayEntry.values.rating_value}/10`
              : `${metricLabel}: ${todayEntry.values.rating_label ?? 'Not supplied'}`}
          </Text>
          {todayEntry.values.context ? (
            <Text style={styles.reviewContext}>{todayEntry.values.context}</Text>
          ) : null}
          <Text style={styles.dateText}>{formatEntryDate(todayEntry.values.entry_time)}</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => editEntry(todayEntry)}
            style={({ pressed }) => [styles.editTodayButton, pressed && styles.pressed]}>
            <Text style={styles.secondaryButtonText}>Edit today’s entry</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.composer}>
        <Text style={styles.composerTitle}>
          {editingConfirmed ? 'Correct rating entry' : entryRevision ? 'Resume draft' : presentation.question}
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
                  accessibilityLabel={`${presentation.accessibilityLabel} ${score}`}
                  accessibilityRole="button"
                  accessibilityState={{ selected: ratingValue === score }}
                  disabled={reviewing}
                  onPress={() => setRatingValue(score)}
                  style={({ pressed }) => [
                    styles.scoreButton,
                    ratingValue === score && styles.scoreButtonSelected,
                    pressed && styles.pressed,
                  ]}>
                  <Text
                    style={[
                      styles.scoreText,
                      ratingValue === score && styles.scoreTextSelected,
                    ]}>
                    {score}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        ) : (
          <TextInput
            accessibilityLabel={`${presentation.checkInTitle} label`}
            maxLength={120}
            onChangeText={setRatingLabel}
            editable={!reviewing}
            placeholder="How would you describe this rating?"
            style={styles.input}
            value={ratingLabel}
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
              {values.rating_value !== null
                ? `${metricLabel}: ${values.rating_value}/10`
                : `${metricLabel}: ${values.rating_label ?? 'Not supplied'}`}
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
      )}

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
                  {entry.values.rating_value !== null
                    ? `${entry.values.rating_value}/10 ${scale ? `(${scale.minimum_label}–${scale.maximum_label})` : ''}`
                    : entry.values.rating_label ?? 'Text-only entry'}
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
  activatedCard: { backgroundColor: '#eef6ef', borderRadius: 14, gap: 8, padding: 14 },
  activatedMark: { color: '#23613a', fontSize: 18, fontWeight: '900' },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  candidateTitle: { color: colors.ink, flex: 1, fontSize: 16, fontWeight: '800' },
  candidateBadge: { backgroundColor: '#f5dfb4', borderRadius: 7, color: '#725d36', fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  conflictBadge: { backgroundColor: '#fde2dd', color: '#9b2f20' },
  activeBadge: { backgroundColor: '#d4ead9', borderRadius: 7, color: '#23613a', fontSize: 10, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 3 },
  completedBadge: { backgroundColor: '#e8e2d8', color: colors.muted },
  taskText: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 21 },
  metaText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  progressText: { color: colors.ink, fontSize: 12, fontWeight: '700', lineHeight: 17 },
  sourceBox: { borderLeftColor: '#d2b16c', borderLeftWidth: 3, gap: 3, paddingLeft: 10 },
  scaleReviewBox: { backgroundColor: '#fffdf8', borderRadius: 10, gap: 4, padding: 10 },
  scheduleReviewBox: { backgroundColor: '#fffdf8', borderRadius: 10, gap: 7, padding: 11 },
  scheduleTitle: { color: colors.ink, flex: 1, fontSize: 14, fontWeight: '800' },
  editScheduleButton: { paddingHorizontal: 6, paddingVertical: 4 },
  scheduleEditor: { gap: 9 },
  fieldLabel: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  timeButton: { alignItems: 'center', alignSelf: 'stretch', borderColor: colors.line, borderRadius: 10, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 13, paddingVertical: 11 },
  timeButtonAction: { color: colors.accentDark, fontSize: 12, fontWeight: '800' },
  timeButtonText: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  timePicker: { alignSelf: 'stretch', height: 180 },
  timePickerDoneButton: { paddingHorizontal: 6, paddingVertical: 5 },
  timePickerDoneText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  timePickerHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  timePickerPanel: { backgroundColor: '#fff', borderColor: colors.line, borderRadius: 10, borderWidth: 1, overflow: 'hidden', paddingHorizontal: 10, paddingTop: 6 },
  timePickerTitle: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  durationOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  durationOption: { backgroundColor: '#efe9df', borderRadius: 9, paddingHorizontal: 10, paddingVertical: 8 },
  durationOptionSelected: { backgroundColor: colors.accentDark },
  durationOptionText: { color: colors.ink, fontSize: 12, fontWeight: '800' },
  durationOptionTextSelected: { color: '#fff' },
  sourceLabel: { color: '#725d36', fontSize: 10, fontWeight: '800', textTransform: 'uppercase' },
  sourceText: { color: '#5e5038', fontSize: 13, fontStyle: 'italic', lineHeight: 18 },
  supportingText: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  composer: { backgroundColor: '#fffdf8', borderColor: colors.line, borderRadius: 13, borderWidth: 1, gap: 10, padding: 12 },
  completedMessage: { backgroundColor: '#fffdf8', borderRadius: 13, gap: 4, padding: 12 },
  editTodayButton: { alignSelf: 'flex-start', paddingVertical: 6 },
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
  openActionsButton: { alignSelf: 'flex-start', paddingVertical: 4 },
  openActionsButtonText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
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
