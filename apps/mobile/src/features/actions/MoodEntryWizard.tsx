import { useEffect, useRef, useState } from 'react';
import { AppState, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { confirmRatingEntry, listRatingEntries, saveRatingEntryDraft } from './actionsApi';
import type { RatingAction, RatingEntry, RatingEntryValues } from './actionTypes';
import { createUuid, dayKeyAtCapturedOffset } from './ratingDomain';
import { cleanMoodValues, FEELINGS, MEASUREMENTS, MoodDraftWriter, moodSteps, skipMoodStep, type MoodStep } from './moodWizardDomain';
import { MoodScale } from './MoodScale';
import { MoodiWave } from '@/ui/MoodiWave';

const titles: Record<MoodStep, string> = {
  mood: 'How was your mood today?', additional_ratings: 'Anything else to rate?',
  feelings: 'Want to say a little more about how you felt?', intensity: 'How strong was that feeling?',
  context: 'What was happening?', thoughts: 'What went through your mind?',
  actions_taken: 'What did you do?', review: 'Review your entry',
};

function capturedDate(values: RatingEntryValues) {
  return new Date(Date.parse(values.entry_time) + values.timezone_offset_minutes * 60_000);
}

function dateLabel(values: RatingEntryValues) {
  return capturedDate(values).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC',
  });
}

export function MoodEntryWizard({ action, draft, onClose }: { action: RatingAction; draft?: RatingEntry; onClose: () => void }) {
  const [entryId] = useState(() => draft?.id ?? createUuid());
  const [values, setValues] = useState<RatingEntryValues>(() => {
    if (draft) return cleanMoodValues({ ...draft.values, current_step: draft.values.current_step ?? 'mood' });
    const now = new Date();
    const offset = -now.getTimezoneOffset();
    const day = dayKeyAtCapturedOffset(now.toISOString(), offset);
    return { relevant_date: day, day_key: day, entry_time: now.toISOString(), timezone_offset_minutes: offset,
      mood_value: null, mood_label: null, scale_id: null, energy_value: null, sleep_quality_value: null,
      motivation_value: null, feelings: [], custom_feeling: null, feeling_intensity: null,
      context: null, thoughts: null, actions_taken: null, current_step: 'mood' };
  });
  const [writer] = useState(() => new MoodDraftWriter({
    save: (answer, expectedRevision) => saveRatingEntryDraft({ actionId: action.id, entryId, values: answer, expectedRevision }),
    confirm: (answer, expectedRevision) => confirmRatingEntry({ actionId: action.id, entryId, values: answer, expectedRevision }),
    load: async () => (await listRatingEntries(action.id)).find(entry => entry.id === entryId),
  }, draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const [editingDate, setEditingDate] = useState(false);
  const [dateInput, setDateInput] = useState(() => capturedDate(values).toISOString().slice(0, 10));
  const [timeInput, setTimeInput] = useState(() => capturedDate(values).toISOString().slice(11, 16));
  const [dateError, setDateError] = useState<string | null>(null);
  const operation = useRef(false);
  const latest = useRef(values);
  useEffect(() => { latest.current = values; }, [values]);
  const steps = moodSteps(action.settings.what_to_record, values);
  const step = steps.includes(values.current_step ?? 'mood') ? values.current_step ?? 'mood' : 'feelings';
  const stepIndex = steps.indexOf(step);
  const locked = busy || confirmAttempted;
  const describeError = (cause: unknown) => cause instanceof Error ? cause.message : 'Could not save. Your answers are still here. Please retry.';

  useEffect(() => {
    if (busy || confirmAttempted) return;
    let current = true;
    const timeout = setTimeout(() => {
      setSaveStatus('Saving draft…');
      void writer.save(values).then(() => { if (current) { setSaveStatus('Draft saved'); setError(null); } })
        .catch(cause => { if (current) { setSaveStatus('Draft not saved'); setError(describeError(cause)); } });
    }, 350);
    return () => { current = false; clearTimeout(timeout); };
  }, [values, writer, busy, confirmAttempted]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active' && !confirmAttempted) {
        void writer.save(latest.current).catch(cause => setError(describeError(cause)));
      }
    });
    return () => listener.remove();
  }, [writer, confirmAttempted]);

  function update(patch: Partial<RatingEntryValues>) {
    setValues(current => {
      const next = { ...current, ...patch };
      if (!next.feelings?.length && !next.custom_feeling?.trim()) next.feeling_intensity = null;
      return next;
    });
  }
  function move(nextStep: MoodStep, source = values) { Keyboard.dismiss(); setValues({ ...source, current_step: nextStep }); }
  function next(skip = false) {
    const nextValues = skip ? skipMoodStep(values, step) : values;
    const nextSteps = moodSteps(action.settings.what_to_record, nextValues);
    move(nextSteps[nextSteps.indexOf(step) + 1] ?? 'review', nextValues);
  }
  function saveDate() {
    const matchDate = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateInput);
    const matchTime = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(timeInput);
    if (!matchDate || !matchTime) { setDateError('Use YYYY-MM-DD and HH:MM.'); return; }
    const year = Number(matchDate[1]); const month = Number(matchDate[2]); const day = Number(matchDate[3]);
    const date = new Date(year, month - 1, day, Number(matchTime[1]), Number(matchTime[2]));
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
      setDateError('Choose a valid date and time.'); return;
    }
    const offset = -date.getTimezoneOffset();
    const dayKey = dayKeyAtCapturedOffset(date.toISOString(), offset);
    update({ entry_time: date.toISOString(), timezone_offset_minutes: offset, day_key: dayKey, relevant_date: dayKey });
    setDateError(null); setEditingDate(false);
  }
  async function finish(confirm: boolean) {
    if (operation.current) return;
    operation.current = true;
    setBusy(true); setError(null);
    try {
      await writer.save(values);
      if (confirm) {
        setConfirmAttempted(true);
        await writer.confirm(values);
      }
      onClose();
    } catch (cause) { setError(describeError(cause)); }
    finally { operation.current = false; setBusy(false); }
  }
  const textInput = (label: string, field: 'custom_feeling' | 'context' | 'thoughts' | 'actions_taken', placeholder: string, maxLength: number) =>
    <View style={styles.inputRow}><TextInput accessibilityLabel={label} placeholder={placeholder} placeholderTextColor="#AAA5B5" value={values[field] ?? ''}
      onChangeText={text => update({ [field]: text })} maxLength={maxLength} returnKeyType="done" onSubmitEditing={() => next()}
      editable={!locked} style={styles.input} />
      <Pressable accessibilityRole="button" accessibilityLabel={`Save ${label} and continue`} disabled={locked} onPress={() => next()}
        style={[styles.send, locked && styles.disabled]}><Text style={styles.sendText}>↑</Text></Pressable></View>;
  const button = (label: string, press: () => void, secondary = false, disabled = false) =>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={press}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.light]}>{label}</Text>
    </Pressable>;
  const reviewItem = (label: string, answer: string, target: MoodStep) => <View key={label} style={styles.reviewRow}>
    <View style={styles.answer}><Text style={styles.hint}>{label}</Text><Text style={styles.body}>{answer}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} disabled={locked} onPress={() => move(target)}><Text style={styles.edit}>Edit</Text></Pressable>
  </View>;
  return <View style={styles.root}>
    <View style={styles.header}><Text style={styles.brand}>Moodi</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Save and close mood check-in" disabled={busy}
        onPress={() => void finish(false)}><Text style={styles.edit}>Save & close</Text></Pressable>
    </View>
    <ScrollView key={step} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {stepIndex > 0 ? <Pressable accessibilityRole="button" onPress={() => move(steps[stepIndex - 1])} disabled={locked}>
        <Text style={styles.edit}>‹ Back</Text></Pressable> : null}
      {step === 'mood' ? <>
        <Pressable accessibilityRole="button" accessibilityLabel="Edit entry date and time" onPress={() => setEditingDate(value => !value)} style={styles.dateChip}>
          <Text style={styles.dateText}>▣  {dateLabel(values)}  ✎</Text>
        </Pressable>
        {editingDate ? <View style={styles.dateEditor}>
          <TextInput accessibilityLabel="Entry date" value={dateInput} onChangeText={setDateInput} placeholder="YYYY-MM-DD" placeholderTextColor="#AAA5B5" style={styles.dateField} />
          <TextInput accessibilityLabel="Entry time" value={timeInput} onChangeText={setTimeInput} placeholder="HH:MM" placeholderTextColor="#AAA5B5" style={styles.dateField} />
          {button('Save date and time', saveDate)}
          {dateError ? <Text accessibilityRole="alert" style={styles.error}>{dateError}</Text> : null}
        </View> : null}
      </> : <Text style={styles.savedBadge}>✓  Mood saved{values.mood_value !== null ? ` · ${values.mood_value}/10` : ''}</Text>}
      <Text accessibilityRole="header" style={styles.title}>{titles[step]}</Text>
      {step === 'mood' ? <><Text style={styles.body}>Think about how the day felt overall.</Text>
        <MoodScale label="Whole-day mood" low="Worst" high="Best" value={values.mood_value} disabled={locked} prominent
          onChange={mood_value => update({ mood_value, mood_label: null, scale_id: action.settings.configuration.scale?.id ?? null })} />
        <Text style={styles.hint}>Your score saves when you choose it.</Text></> : null}
      {step === 'additional_ratings' ? <><Text style={styles.body}>I saved your mood as {values.mood_value} out of 10. Add anything else you agreed to track?</Text>
        {MEASUREMENTS.filter(item => action.settings.what_to_record.includes(item.id)).map(item =>
          <MoodScale key={item.id} label={item.label} value={values[item.field] ?? null} disabled={locked} onChange={score => update({ [item.field]: score })} />)}</> : null}
      {step === 'feelings' ? <><Text style={styles.body}>Tell me in your own words. You can include what happened or what you did.</Text>
        <View style={styles.chips}>{FEELINGS.map(feeling => {
          const checked = values.feelings?.includes(feeling) ?? false;
          return <Pressable key={feeling} accessibilityRole="checkbox" accessibilityLabel={feeling}
            accessibilityState={{ checked, disabled: locked }} disabled={locked}
            onPress={() => update({ feelings: checked ? values.feelings?.filter(item => item !== feeling) : [...values.feelings ?? [], feeling] })}
            style={[styles.chip, checked && styles.selected]}><Text style={checked ? styles.selectedText : styles.body}>{feeling}</Text></Pressable>;
        })}</View>{textInput('Feeling in your own words', 'custom_feeling', 'I felt…', 500)}</> : null}
      {step === 'intensity' ? <><Text style={styles.body}>{[...values.feelings ?? [], values.custom_feeling].filter(Boolean).join(', ')}</Text>
        <MoodScale label="Feeling intensity" low="Not strong" high="Very strong" value={values.feeling_intensity ?? null} disabled={locked} onChange={feeling_intensity => update({ feeling_intensity })} /></> : null}
      {step === 'context' ? textInput('What was happening?', 'context', 'What was going on at the time?', 2000) : null}
      {step === 'thoughts' ? textInput('What went through your mind?', 'thoughts', 'Write whatever you remember…', 2000) : null}
      {step === 'actions_taken' ? textInput('What did you do?', 'actions_taken', 'What did you do next?', 2000) : null}
      {step === 'review' ? <><Text style={styles.body}>Here’s what I got. Does it look right?</Text><View style={styles.review}>
        <View style={styles.reviewMood}><View style={styles.waveIcon}><MoodiWave width={20} /></View><Text style={styles.reviewMoodTitle}>Whole-day mood</Text>
          <Text style={styles.reviewScore}>{values.mood_value ?? '—'}<Text style={styles.reviewOutOf}> / 10</Text></Text></View>
        <Text style={styles.reviewDate}>{dateLabel(values)}</Text>
        {MEASUREMENTS.filter(item => action.settings.what_to_record.includes(item.id)).map(item => reviewItem(item.label, values[item.field] == null ? 'Skipped' : `${values[item.field]} / 10`, 'additional_ratings'))}
        {reviewItem('Feeling', [...values.feelings ?? [], values.custom_feeling?.trim()].filter(Boolean).join(', ') || 'Skipped', 'feelings')}
        {steps.includes('intensity') ? reviewItem('Feeling intensity', values.feeling_intensity == null ? 'Skipped' : `${values.feeling_intensity} / 10`, 'intensity') : null}
        {reviewItem('What was happening?', values.context?.trim() || 'Skipped', 'context')}
        {reviewItem('What went through your mind?', values.thoughts?.trim() || 'Skipped', 'thoughts')}
        {reviewItem('What did you do?', values.actions_taken?.trim() || 'Skipped', 'actions_taken')}
      </View></> : null}
      <Text accessibilityLiveRegion="polite" style={styles.hint}>{saveStatus}</Text>
      {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
        {!confirmAttempted ? button('Retry saving draft', () => { void writer.save(values).then(() => { setError(null); setSaveStatus('Draft saved'); }).catch(cause => setError(describeError(cause))); }, true, busy) : null}</> : null}
    </ScrollView>
    <View style={styles.footer}>
      {step === 'review' ? <>
        {button('Edit entry', () => move('mood'), true, locked)}
        <Pressable accessibilityRole="button" disabled={busy || values.mood_value === null}
          onPress={() => void finish(true)} style={[styles.button, (busy || values.mood_value === null) && styles.disabled]}>
          <Text style={styles.buttonText}>{confirmAttempted ? 'Retry confirmation' : 'Confirm entry ✓'}</Text>
        </Pressable>
      </> : <>
        {step !== 'mood' ? button('Skip', () => next(true), true, locked) : null}
        {button('Continue  →', () => next(), false, locked || (step === 'mood' && values.mood_value === null))}
        {step !== 'mood' ? button('Review now', () => move('review'), true, locked || values.mood_value === null) : null}
      </>}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 }, header: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 }, edit: { color: '#C9B7FF', paddingVertical: 10, fontWeight: '700', fontSize: 12 },
  content: { padding: 16, gap: 14, paddingBottom: 24 }, title: { color: '#FAF9FF', fontSize: 25, fontWeight: '800', letterSpacing: -0.7 },
  body: { color: '#D4D0DD', fontSize: 14, lineHeight: 21 }, hint: { color: '#B9B4C7', fontSize: 12, lineHeight: 18 },
  savedBadge: { alignSelf: 'flex-start', backgroundColor: '#2D473D', color: '#ACE3C8', fontWeight: '800', overflow: 'hidden', paddingHorizontal: 11, paddingVertical: 8, borderRadius: 16 },
  dateChip: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#4A4655', backgroundColor: '#2E2B36', padding: 12, borderRadius: 24 },
  dateText: { color: '#D4D0DD', fontWeight: '700', fontSize: 13 }, dateEditor: { gap: 8 },
  dateField: { borderWidth: 1, borderColor: '#55515F', borderRadius: 10, color: '#FFFFFF', paddingHorizontal: 12, minHeight: 42 },
  inputRow: { flexDirection: 'row', gap: 6 }, input: { flex: 1, borderWidth: 1, borderColor: '#55515F', borderRadius: 12, paddingHorizontal: 14, minHeight: 48, color: '#FFFFFF', fontSize: 15 },
  send: { width: 47, minHeight: 48, borderRadius: 12, backgroundColor: '#C9B7FF', alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#24212E', fontSize: 25 }, chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderColor: '#55515F', paddingHorizontal: 13, paddingVertical: 9, borderRadius: 22 }, selected: { backgroundColor: '#C9B7FF' },
  selectedText: { color: '#24212E', fontWeight: '700' }, review: { padding: 14, backgroundColor: '#2E2B36', borderRadius: 15, gap: 4, borderWidth: 1, borderColor: '#4A4655' },
  reviewMood: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingBottom: 12 }, waveIcon: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#403954' },
  reviewMoodTitle: { flex: 1, color: '#FFFFFF', fontSize: 13, fontWeight: '700' }, reviewScore: { color: '#C9B7FF', fontSize: 28, fontWeight: '800' }, reviewOutOf: { color: '#D4D0DD', fontSize: 12, fontWeight: '500' },
  reviewDate: { color: '#C7C2D0', fontSize: 12, paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#514D5A' },
  reviewRow: { flexDirection: 'row', gap: 10, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#514D5A', paddingVertical: 9 },
  answer: { flex: 1, gap: 2 }, footer: { padding: 12, flexDirection: 'row', gap: 7, borderTopWidth: 1, borderColor: '#423E4C' },
  button: { flex: 1, minHeight: 45, borderRadius: 10, backgroundColor: '#C9B7FF', padding: 8, alignItems: 'center', justifyContent: 'center' },
  secondary: { flex: 0, minWidth: 69, borderWidth: 1, borderColor: '#514B63', backgroundColor: 'transparent' },
  buttonText: { color: '#24212E', fontSize: 13, fontWeight: '800', textAlign: 'center' }, light: { color: '#F8F7FB' },
  disabled: { opacity: 0.4 }, error: { color: '#FFB4AB', fontSize: 13 },
});
