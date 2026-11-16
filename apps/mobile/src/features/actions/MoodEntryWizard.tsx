import { useEffect, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { confirmRatingEntry, listRatingEntries, saveRatingEntryDraft } from './actionsApi';
import type { RatingAction, RatingEntry, RatingEntryValues } from './actionTypes';
import { createUuid, dayKeyAtCapturedOffset } from './ratingDomain';
import { cleanMoodValues, FEELINGS, MEASUREMENTS, MoodDraftWriter, moodSteps, skipMoodStep, type MoodStep } from './moodWizardDomain';
import { MoodScale } from './MoodScale';

const titles: Record<MoodStep, string> = {
  mood: 'How was your mood today?', additional_ratings: 'Anything else to rate?',
  feelings: 'Want to say a little more about how you felt?', intensity: 'How strong was that feeling?',
  context: 'What was happening?', review: 'Review your entry',
};

export function MoodEntryWizard({ action, draft, onClose }: { action: RatingAction; draft?: RatingEntry; onClose: () => void }) {
  const [entryId] = useState(() => draft?.id ?? createUuid());
  const [values, setValues] = useState<RatingEntryValues>(() => {
    if (draft) return cleanMoodValues({ ...draft.values, current_step: draft.values.current_step ?? 'mood' });
    const now = new Date();
    const offset = -now.getTimezoneOffset();
    const day = dayKeyAtCapturedOffset(now.toISOString(), offset);
    return { relevant_date: day, day_key: day, entry_time: now.toISOString(), timezone_offset_minutes: offset,
      mood_value: null, mood_label: null, scale_id: null, energy_value: null, sleep_quality_value: null,
      motivation_value: null, feelings: [], custom_feeling: null, feeling_intensity: null, context: null, current_step: 'mood' };
  });
  const [writer] = useState(() => new MoodDraftWriter({
    save: (values, expectedRevision) => saveRatingEntryDraft({ actionId: action.id, entryId, values, expectedRevision }),
    confirm: (values, expectedRevision) => confirmRatingEntry({ actionId: action.id, entryId, values, expectedRevision }),
    load: async () => (await listRatingEntries(action.id)).find(entry => entry.id === entryId),
  }, draft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [confirmAttempted, setConfirmAttempted] = useState(false);
  const operation = useRef(false);
  const latest = useRef(values);
  useEffect(() => { latest.current = values; }, [values]);
  const steps = moodSteps(action.settings.what_to_record, values);
  const step = steps.includes(values.current_step ?? 'mood') ? values.current_step ?? 'mood' : 'feelings';
  const stepIndex = steps.indexOf(step);
  const locked = busy || confirmAttempted;
  const describeError = (cause: unknown) => cause instanceof Error ? cause.message : 'Could not save. Your answers are still here. Please retry.';

  useEffect(() => {
    if (confirmed || busy || confirmAttempted) return;
    let current = true;
    const timeout = setTimeout(() => {
      setSaveStatus('Saving draft…');
      void writer.save(values).then(() => { if (current) { setSaveStatus('Draft saved'); setError(null); } })
        .catch(cause => { if (current) { setSaveStatus('Draft not saved'); setError(describeError(cause)); } });
    }, 350);
    return () => { current = false; clearTimeout(timeout); };
  }, [values, writer, confirmed, busy, confirmAttempted]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active' && !confirmed && !confirmAttempted) {
        void writer.save(latest.current).catch(cause => setError(describeError(cause)));
      }
    });
    return () => listener.remove();
  }, [writer, confirmed, confirmAttempted]);

  function update(patch: Partial<RatingEntryValues>) {
    setValues(current => {
      const next = { ...current, ...patch };
      if (!next.feelings?.length && !next.custom_feeling?.trim()) next.feeling_intensity = null;
      return next;
    });
  }
  function move(nextStep: MoodStep, source = values) { setValues({ ...source, current_step: nextStep }); }
  function next(skip = false) {
    const nextValues = skip ? skipMoodStep(values, step) : values;
    const nextSteps = moodSteps(action.settings.what_to_record, nextValues);
    move(nextSteps[nextSteps.indexOf(step) + 1] ?? 'review', nextValues);
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
        setConfirmed(true);
      } else onClose();
    } catch (cause) { setError(describeError(cause)); }
    finally { operation.current = false; setBusy(false); }
  }
  const textInput = (label: string, field: 'custom_feeling' | 'context', maxLength: number) =>
    <TextInput accessibilityLabel={label} placeholder={label} placeholderTextColor="#a9a4b6" value={values[field] ?? ''}
      onChangeText={text => update({ [field]: text })} multiline maxLength={maxLength} editable={!locked} style={styles.input} />;
  const button = (label: string, press: () => void, secondary = false, disabled = false) =>
    <Pressable accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={press}
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
      <Text style={[styles.buttonText, secondary && styles.light]}>{label}</Text>
    </Pressable>;
  const reviewItem = (label: string, answer: string, target: MoodStep) => <View key={label} style={styles.reviewRow}>
    <View style={styles.answer}><Text style={styles.hint}>{label}</Text><Text style={styles.body}>{answer}</Text></View>
    <Pressable accessibilityRole="button" accessibilityLabel={`Edit ${label}`} disabled={locked} onPress={() => move(target)}><Text style={styles.edit}>Edit</Text></Pressable>
  </View>;
  return <Modal visible animationType="slide" onRequestClose={() => { if (!busy) { if (confirmed) onClose(); else void finish(false); } }}>
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}><Text style={styles.brand}>Moodi</Text>
          <Pressable accessibilityRole="button" disabled={busy} onPress={() => { if (confirmed) onClose(); else void finish(false); }}>
            <Text style={styles.edit}>{confirmed ? 'Close' : 'Save & close'}</Text>
          </Pressable>
        </View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
          {confirmed ? <><Text style={styles.title}>Entry saved</Text><Text style={styles.body}>Your check-in is complete. You can record another entry whenever you want.</Text></> : <>
            <Text style={styles.hint}>{new Date(values.entry_time).toLocaleString()} · {stepIndex + 1} of {steps.length}</Text>
            <Text accessibilityRole="header" style={styles.title}>{titles[step]}</Text>
            {step === 'mood' ? <><Text style={styles.body}>Think about how the day felt overall.</Text>
              <MoodScale label="Whole-day mood" low="Worst" high="Best" value={values.mood_value} disabled={locked}
                onChange={mood_value => update({ mood_value, mood_label: null, scale_id: action.settings.configuration.scale?.id ?? null })} /></> : null}
            {step === 'additional_ratings' ? <>{MEASUREMENTS.filter(item => action.settings.what_to_record.includes(item.id)).map(item =>
              <MoodScale key={item.id} label={item.label} value={values[item.field] ?? null} disabled={locked} onChange={score => update({ [item.field]: score })} />)}</> : null}
            {step === 'feelings' ? <><Text style={styles.body}>Choose any that fit, or tell me in your own words.</Text><View style={styles.chips}>
              {FEELINGS.map(feeling => {
                const checked = values.feelings?.includes(feeling) ?? false;
                return <Pressable key={feeling} accessibilityRole="checkbox" accessibilityLabel={feeling} accessibilityState={{ checked, disabled: locked }} disabled={locked}
                  onPress={() => update({ feelings: checked ? values.feelings?.filter(item => item !== feeling) : [...values.feelings ?? [], feeling] })}
                  style={[styles.chip, checked && styles.selected]}><Text style={checked ? styles.buttonText : styles.body}>{feeling}</Text></Pressable>;
              })}</View>{textInput('In your own words', 'custom_feeling', 500)}</> : null}
            {step === 'intensity' ? <><Text style={styles.body}>{[...values.feelings ?? [], values.custom_feeling].filter(Boolean).join(', ')}</Text>
              <MoodScale label="Feeling intensity" low="Not strong" high="Very strong" value={values.feeling_intensity ?? null} disabled={locked} onChange={feeling_intensity => update({ feeling_intensity })} /></> : null}
            {step === 'context' ? textInput('What happened', 'context', 2000) : null}
            {step === 'review' ? <><Text style={styles.body}>Here’s what I got. Does it look right?</Text><View style={styles.review}>
              {reviewItem('Mood', `${values.mood_value ?? '—'} / 10`, 'mood')}
              {MEASUREMENTS.filter(item => action.settings.what_to_record.includes(item.id)).map(item => reviewItem(item.label, values[item.field] == null ? 'Skipped' : `${values[item.field]} / 10`, 'additional_ratings'))}
              {reviewItem('Feelings', [...values.feelings ?? [], values.custom_feeling?.trim()].filter(Boolean).join(', ') || 'Skipped', 'feelings')}
              {steps.includes('intensity') ? reviewItem('Intensity', values.feeling_intensity == null ? 'Skipped' : `${values.feeling_intensity} / 10`, 'intensity') : null}
              {reviewItem('What happened', values.context?.trim() || 'Skipped', 'context')}
            </View></> : null}
            <Text accessibilityLiveRegion="polite" style={styles.hint}>{saveStatus}</Text>
          </>}
          {error ? <><Text accessibilityRole="alert" style={styles.error}>{error}</Text>
            {!confirmAttempted ? button('Retry saving draft', () => { void writer.save(values).then(() => { setError(null); setSaveStatus('Draft saved'); }).catch(cause => setError(describeError(cause))); }, true, busy) : null}</> : null}
        </ScrollView>
        <View style={styles.footer}>
          {confirmed ? button('Back to Today', onClose) : <>
            {stepIndex > 0 ? button('Back', () => move(steps[stepIndex - 1]), true, locked) : null}
            {step !== 'mood' && step !== 'review' ? button('Skip', () => next(true), true, locked) : null}
            {step === 'review' ? <Pressable accessibilityRole="button" disabled={busy || values.mood_value === null}
              onPress={() => void finish(true)} style={[styles.button, busy && styles.disabled]}>
              <Text style={styles.buttonText}>{busy ? 'Saving…' : confirmAttempted ? 'Retry confirmation' : 'Confirm entry'}</Text>
            </Pressable>
              : button('Continue', () => next(), false, locked || (step === 'mood' && values.mood_value === null))}
          </>}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  </Modal>;
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#222129' }, flex: { flex: 1 },
  header: { padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#fff', fontWeight: '700', fontSize: 16 }, edit: { color: '#d7caff', paddingVertical: 12, fontWeight: '600' },
  content: { padding: 24, gap: 24, flexGrow: 1 }, title: { color: '#faf9ff', fontSize: 29, fontWeight: '700', letterSpacing: -0.7 },
  body: { color: '#e1deea', fontSize: 16, lineHeight: 24 }, hint: { color: '#b9b4c7', fontSize: 13, lineHeight: 20 },
  input: { borderWidth: 1, borderColor: '#514b63', borderRadius: 14, padding: 16, minHeight: 120, color: '#fff', fontSize: 16, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 }, chip: { borderWidth: 1, borderColor: '#514b63', padding: 14, borderRadius: 24 },
  selected: { backgroundColor: '#d7caff' }, review: { padding: 16, backgroundColor: '#2d2a35', borderRadius: 18, gap: 16 },
  reviewRow: { flexDirection: 'row', gap: 16, alignItems: 'center' }, answer: { flex: 1, gap: 4 },
  footer: { padding: 20, flexDirection: 'row', gap: 8, borderTopWidth: 1, borderColor: '#423e4c' },
  button: { flexGrow: 1, minHeight: 48, borderRadius: 12, backgroundColor: '#d7caff', padding: 14, alignItems: 'center', justifyContent: 'center' },
  secondary: { backgroundColor: '#34303f' }, buttonText: { color: '#24212e', fontSize: 15, fontWeight: '700' },
  light: { color: '#f8f7fb' }, disabled: { opacity: 0.4 }, error: { color: '#ffb4ab', fontSize: 14 },
});
