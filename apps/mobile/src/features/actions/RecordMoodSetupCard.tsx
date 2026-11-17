import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getRatingCandidateResolution, reviewRatingCandidate } from './actionsApi';
import type { MoodCadence, MoodMeasurement, RatingAction, RecordRatingCandidate } from './actionTypes';
import { EXACT_TIME, initialReminderTime, measurementLabels, MOOD_MEASUREMENTS, moodSettingsFromCandidate, suggestedCadence, toggleMeasurement, WEEKDAYS } from './moodSetup';
import { formatClockTime } from './scheduleFormatting';

export type RecordMoodSessionState =
  | 'loading' | 'needs_setup' | 'active' | 'already_active' | 'linked_existing'
  | 'conflict' | 'not_added' | 'error';

type Props = {
  candidate: RecordRatingCandidate;
  recordingId?: string;
  draftId?: string;
  sourceVersion?: string;
  onSessionStateChange?: (status: RecordMoodSessionState) => void;
  onActivated?: () => void;
};

export function RecordMoodSetupCard(props: Props) {
  return <RecordMoodSetupForm key={`${props.recordingId}:${props.draftId}:${props.sourceVersion}:${props.candidate.id}`} {...props} />;
}

function RecordMoodSetupForm({ candidate, recordingId, draftId, sourceVersion, onSessionStateChange, onActivated }: Props) {
  const hasSource = Boolean(recordingId && draftId && sourceVersion);
  const [measurements, setMeasurements] = useState<MoodMeasurement[]>(candidate.what_to_record ?? ['mood']);
  const [cadence, setCadence] = useState<MoodCadence>(suggestedCadence(candidate.frequency));
  const [reminderTime, setReminderTime] = useState(initialReminderTime(candidate.timing));
  const [weeklyWeekday, setWeeklyWeekday] = useState<number | null>(null);
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  const [status, setStatus] = useState<RecordMoodSessionState>(hasSource ? 'loading' : 'error');
  const [existing, setExisting] = useState<RatingAction | null>(null);
  const [error, setError] = useState<string | null>(hasSource ? null : 'Refresh this session summary before setting up the action.');
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [retry, setRetry] = useState(0);
  const submitting = useRef(false);
  useEffect(() => { onSessionStateChange?.(status); }, [status, onSessionStateChange]);
  useEffect(() => {
    let cancelled = false;
    if (!recordingId || !draftId || !sourceVersion) {
      return;
    }
    void getRatingCandidateResolution(recordingId, candidate.id).then(result => {
      if (cancelled) return;
      if (result.draft_id !== draftId || result.source_version !== sourceVersion) {
        throw new Error('The session summary changed. Reopen the session to review it.');
      }
      setExisting(result.action);
      setStatus(result.status === 'activated' ? 'active' : result.status === 'rejected' ? 'not_added' : result.status);
    }).catch(cause => {
      if (cancelled) return;
      setError(cause instanceof Error ? cause.message : 'Could not load this action.');
      setStatus('error');
    });
    return () => { cancelled = true; };
  }, [recordingId, candidate.id, draftId, sourceVersion, retry]);

  async function submit(disposition: 'activate' | 'reject') {
    if (submitting.current || !recordingId || !draftId || !sourceVersion) return;
    const settings = moodSettingsFromCandidate(candidate, measurements, { cadence, time: reminderTime, weeklyWeekday, timeZone });
    if (disposition === 'activate' && !settings) return;
    submitting.current = true;
    setBusy(true);
    setError(null);
    try {
      const result = await reviewRatingCandidate({ recordingId, candidateId: candidate.id, draftId,
        sourceVersion, disposition, settings: disposition === 'activate' ? settings : null });
      setExisting(result.action);
      const nextStatus = result.disposition === 'rejected' ? 'not_added' : result.disposition === 'linked_existing' ? 'linked_existing' : 'active';
      setStatus(nextStatus);
      onSessionStateChange?.(nextStatus);
      if (result.disposition !== 'rejected') onActivated?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save this action.');
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (status === 'loading') return <ActivityIndicator accessibilityLabel="Loading Record mood" />;
  const saved = status === 'active' || status === 'linked_existing';
  const rejected = status === 'not_added';
  const canSave = status !== 'error' &&
    Boolean(moodSettingsFromCandidate(candidate, measurements, { cadence, time: reminderTime, weeklyWeekday, timeZone }));

  return <View style={styles.card}>
    <Text style={styles.title}>Record mood</Text>
    <Text style={styles.intro}>You agreed to check in about your mood. Does this plan look right?</Text>
    {saved ? <>
      <Text style={styles.success}>Action activated</Text>
      <View style={styles.plan}>
        <Text style={styles.planRow}>Frequency  ·  {existing?.settings.cadence ?? cadence}{existing?.settings.cadence === 'weekly' ? ` · ${WEEKDAYS[existing.settings.weekly_weekday ?? 0]}` : ''}</Text>
        <Text style={styles.planRow}>Reminder time  ·  {existing?.settings.preferred_check_in_time ? formatClockTime(existing.settings.preferred_check_in_time) : 'Not set'}</Text>
        <Text style={styles.planRow}>What to record  ·  {measurementLabels(existing?.settings.what_to_record ?? measurements)}</Text>
      </View>
    </> : rejected ? <Text style={styles.body}>This action was not added.</Text> : <>
      <View style={styles.plan}>
        <View style={styles.planLine}><Text style={styles.planLabel}>Frequency</Text><Text style={styles.planValue}>{cadence === 'weekly' && weeklyWeekday !== null ? `Weekly · ${WEEKDAYS[weeklyWeekday]}` : cadence === 'weekdays' ? 'Weekdays' : cadence === 'weekly' ? 'Weekly · Choose day' : 'Daily'}</Text></View>
        <View style={styles.planLine}><Text style={styles.planLabel}>Reminder time</Text><Text style={styles.planValue}>{EXACT_TIME.test(reminderTime) ? formatClockTime(reminderTime) : 'Choose exact time'}</Text></View>
        <View style={styles.planLine}><Text style={styles.planLabel}>What to record</Text><Text style={styles.planValue}>{measurementLabels(measurements)}</Text></View>
        <Pressable accessibilityRole="button" onPress={() => setEditing(value => !value)} style={styles.editButton}>
          <Text style={styles.editText}>{editing ? 'Done editing' : '✎  Edit'}</Text>
        </Pressable>
      </View>
      {editing ? <View style={styles.editor}>
        <Text style={styles.editorLabel}>Frequency</Text>
        <View style={styles.choices}>{(['daily', 'weekdays', 'weekly'] as const).map(option =>
          <Pressable key={option} accessibilityRole="button" accessibilityState={{ selected: cadence === option }}
            onPress={() => setCadence(option)} style={[styles.choice, cadence === option && styles.selected]}>
            <Text style={styles.choiceText}>{option === 'daily' ? 'Daily' : option === 'weekdays' ? 'Weekdays' : 'Weekly'}</Text>
          </Pressable>)}</View>
        {cadence === 'weekly' ? <><Text style={styles.editorLabel}>Day of the week</Text>
          <View style={styles.choices}>{WEEKDAYS.map((day, index) => <Pressable key={day} accessibilityRole="button"
            accessibilityState={{ selected: weeklyWeekday === index }} onPress={() => setWeeklyWeekday(index)}
            style={[styles.choice, weeklyWeekday === index && styles.selected]}><Text style={styles.choiceText}>{day}</Text></Pressable>)}</View></> : null}
        <Text style={styles.editorLabel}>Reminder time · 24-hour format</Text>
        <TextInput accessibilityLabel="Reminder time" value={reminderTime} onChangeText={setReminderTime}
          keyboardType="numbers-and-punctuation" placeholder="20:00" placeholderTextColor="#AFA8BC"
          maxLength={5} autoCorrect={false} style={styles.timeInput} />
        {reminderTime && !EXACT_TIME.test(reminderTime) ? <Text style={styles.hint}>Enter an exact time from 00:00 to 23:59.</Text> : null}
        <Text style={styles.editorLabel}>What to record</Text>
        <View style={styles.choices}>
        {MOOD_MEASUREMENTS.map(item => {
          const checked = measurements.includes(item.id);
          return <Pressable key={item.id} accessibilityRole="checkbox" accessibilityLabel={item.label}
            accessibilityState={{ checked, disabled: item.id === 'mood' || busy || status === 'error' }}
            disabled={item.id === 'mood' || busy || status === 'error'}
            onPress={() => setMeasurements(current => toggleMeasurement(current, item.id))}
            style={[styles.choice, checked && styles.selected]}>
            <Text style={[styles.choiceText, checked && styles.selectedText]}>{checked ? '✓ ' : ''}{item.label}{item.id === 'mood' ? ' · Required' : ''}</Text>
          </Pressable>;
        })}
        </View>
      </View> : null}
      {!EXACT_TIME.test(reminderTime) || (cadence === 'weekly' && weeklyWeekday === null) ? <Text style={styles.hint}>Choose an exact reminder time{cadence === 'weekly' ? ' and weekday' : ''} to activate this action.</Text> : null}
      {status !== 'error' ? <View style={styles.buttons}>
        <Pressable accessibilityRole="button" disabled={busy || !canSave} onPress={() => void submit('activate')}
          style={[styles.primary, (busy || !canSave) && styles.disabled]}>
          <Text style={styles.selectedText}>{busy ? 'Saving…' : 'Activate'}</Text>
        </Pressable>
      </View> : null}
    </>}
    {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    {status === 'error' && hasSource ? <Pressable accessibilityRole="button" onPress={() => {
      setStatus('loading');
      setError(null);
      setRetry(value => value + 1);
    }} style={styles.secondary}>
      <Text style={styles.choiceText}>Retry</Text>
    </Pressable> : null}
  </View>;
}

const styles = StyleSheet.create({
  card: { gap: 16 }, title: { fontSize: 25, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.5 },
  intro: { fontSize: 15, lineHeight: 23, color: '#D4D0DD' },
  body: { fontSize: 14, lineHeight: 21, color: '#D4D0DD' },
  hint: { fontSize: 12, lineHeight: 18, color: '#BDB7CB' },
  plan: { borderWidth: 1, borderColor: '#4A4655', backgroundColor: '#2E2B36', borderRadius: 15, padding: 14, gap: 4 },
  planLine: { borderTopWidth: 1, borderTopColor: '#514D5A', paddingVertical: 11, flexDirection: 'row', gap: 12 },
  planLabel: { flex: 1, fontSize: 13, color: '#C7C2D0' },
  planValue: { flex: 1, fontSize: 13, color: '#FFFFFF', fontWeight: '700', textAlign: 'right' },
  planRow: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  editButton: { paddingVertical: 12, minHeight: 44, justifyContent: 'center' }, editText: { color: '#C9B7FF', fontWeight: '700' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  editor: { gap: 10 }, editorLabel: { color: '#D4D0DD', fontSize: 13, fontWeight: '700' },
  timeInput: { minHeight: 48, borderWidth: 1, borderColor: '#746C82', borderRadius: 12, backgroundColor: '#2E2B36', color: '#FFFFFF', fontSize: 16, paddingHorizontal: 14 },
  choice: { minHeight: 44, justifyContent: 'center', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 10, backgroundColor: '#403B4B' },
  selected: { backgroundColor: '#6C55B2' }, choiceText: { color: '#FFFFFF', fontWeight: '600' },
  selectedText: { color: '#272032', fontWeight: '700' },
  buttons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primary: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', padding: 14, borderRadius: 12, backgroundColor: '#C9B7FF' },
  secondary: { padding: 14, borderRadius: 12, backgroundColor: '#403B4B' },
  disabled: { opacity: 0.5 }, success: { color: '#BFE8CB', fontWeight: '600' }, error: { color: '#FFB4AB' },
});
