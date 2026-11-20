import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Keyboard, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { getActivityAction, listActivityAttempts, listActivitySuggestions, saveActivityAttempt } from './actionsApi';
import { activityAgreementText, activityChoices, formatElapsed, newActivityAttemptId, outcomeLabels, parseOptionalMinutes } from './activityFlowDomain';
import type { ActivityAction, ActivityAttempt, ActivityAttemptData, ActivityOutcome,
  ActivitySelection, ActivitySuggestion } from './activityTypes';

export type ActivityFlowStep = 'agreement' | 'choose' | 'time' | 'ready' | 'outcome' | 'feelings' | 'review' | 'saved';
type Step = ActivityFlowStep;
const outcomeOrder: ActivityOutcome[] = ['completed', 'partly_completed', 'skipped', 'stopped_early'];
const optional = (value: string) => value.trim() || null;

function ActionButton({ label, onPress, secondary = false, disabled = false }: {
  label: string; onPress: () => void; secondary?: boolean; disabled?: boolean;
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={[styles.button, secondary && styles.secondaryButton, disabled && styles.disabled]}>
    <Text style={[styles.buttonText, secondary && styles.secondaryButtonText]}>{label}</Text>
  </Pressable>;
}

function Field({ label, value, onChangeText, placeholder, multiline = false, numeric = false, maxLength }: {
  label: string; value: string; onChangeText: (value: string) => void;
  placeholder?: string; multiline?: boolean; numeric?: boolean; maxLength?: number;
}) {
  return <View style={styles.field}>
    <TextInput accessibilityLabel={label} value={value} onChangeText={onChangeText}
      placeholder={placeholder ?? label} placeholderTextColor="#AAA5B5"
      keyboardType={numeric ? 'number-pad' : 'default'} multiline={multiline} maxLength={maxLength}
      style={[styles.input, multiline && styles.multiline]} />
  </View>;
}

export function ActivityActionFlow({ actionId, onClose, onStepChange }: {
  actionId: string; onClose: () => void; onStepChange: (step: ActivityFlowStep) => void;
}) {
  const [action, setAction] = useState<ActivityAction | null>(null);
  const [suggestions, setSuggestions] = useState<ActivitySuggestion[]>([]);
  const [history, setHistory] = useState<ActivityAttempt[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<Step>('agreement');
  const [selection, setSelection] = useState<ActivitySelection | null>(null);
  const [attempt, setAttempt] = useState<ActivityAttempt | null>(null);
  const [attemptId, setAttemptId] = useState(newActivityAttemptId);
  const [plannedInput, setPlannedInput] = useState('');
  const [actualInput, setActualInput] = useState('');
  const [outcome, setOutcome] = useState<ActivityOutcome | null>(null);
  const [howItWent, setHowItWent] = useState('');
  const [feelingsAfter, setFeelingsAfter] = useState('');
  const [timerStartedAt, setTimerStartedAt] = useState<number | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => { onStepChange(step); }, [onStepChange, step]);

  useEffect(() => {
    if (!actionId) return;
    let active = true;
    void getActivityAction(actionId)
      .then(async loadedAction => {
        const [suggestionResult, historyResult] = await Promise.allSettled([
          listActivitySuggestions(actionId), listActivityAttempts(actionId),
        ]);
        if (!active) return;
        setAction(loadedAction);
        const loadedSuggestions = suggestionResult.status === 'fulfilled' ? suggestionResult.value : [];
        const loadedHistory = historyResult.status === 'fulfilled' ? historyResult.value : [];
        setSuggestions(loadedSuggestions); setHistory(loadedHistory);
        if (suggestionResult.status === 'rejected' || historyResult.status === 'rejected') {
          setError('Some activity ideas or past check-ins could not be loaded. You can still use this Action.');
        }
        const draft = loadedHistory.find(item => item.status === 'draft');
        if (draft) {
          setAttempt(draft); setAttemptId(draft.id); setSelection(draft.selection);
          setPlannedInput(draft.planned_minutes?.toString() ?? '');
          setActualInput(draft.actual_minutes?.toString() ?? '');
          setOutcome(draft.outcome); setHowItWent(draft.how_it_went ?? '');
          setFeelingsAfter(draft.feelings_after ?? '');
        }
      })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load the activity.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [actionId]);

  useEffect(() => {
    if (timerStartedAt === null) return;
    const interval = setInterval(() => setElapsedSeconds(Math.floor((Date.now() - timerStartedAt) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [timerStartedAt]);

  const choices = useMemo(() => action ? activityChoices(action, suggestions) : [], [action, suggestions]);
  const sessionChoices = choices.filter(item => item.origin === 'session_mention');
  const predefinedChoices = choices.filter(item => item.origin === 'predefined');
  const plannedMinutes = parseOptionalMinutes(plannedInput);
  const actualMinutes = parseOptionalMinutes(actualInput);

  function goBack() {
    setError(null);
    if (step === 'agreement' || step === 'saved') { onClose(); return; }
    if (step === 'outcome' && attempt?.status === 'confirmed') { setStep('agreement'); return; }
    if (step === 'ready') { setTimerStartedAt(null); setElapsedSeconds(0); }
    const previous: Record<Exclude<Step, 'agreement' | 'saved'>, Step> = {
      choose: 'agreement', time: action?.settings.assignment_kind === 'specific' ? 'agreement' : 'choose',
      ready: 'time', outcome: 'ready', feelings: 'outcome', review: 'feelings',
    };
    setStep(previous[step]);
  }

  function start() {
    if (!action) return;
    setError(null);
    if (attempt?.status === 'draft' && selection) {
      setStep('ready');
      return;
    }
    if (attempt?.status === 'confirmed') another();
    if (action.settings.assignment_kind === 'specific') {
      setSelection(choices[0] ?? null);
      setStep('time');
    } else {
      setStep('choose');
    }
  }

  async function saveDraft(planned = plannedMinutes) {
    if (!action || !selection || !actionId || planned === undefined || busy) return;
    setBusy(true); setError(null);
    const data: ActivityAttemptData = {
      status: 'draft', selection, planned_minutes: planned,
      outcome: null, actual_minutes: null, how_it_went: null, feelings_after: null,
    };
    try {
      const saved = await saveActivityAttempt(actionId, attemptId, action.revision, attempt?.revision ?? 0, data);
      setAttempt(saved); setSelection(saved.selection); setStep('ready');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your choice.'); }
    finally { setBusy(false); }
  }

  function stopTimer() {
    if (timerStartedAt === null) return;
    const seconds = Math.floor((Date.now() - timerStartedAt) / 1000);
    setElapsedSeconds(seconds); setTimerStartedAt(null);
    if (!actualInput && seconds >= 60) setActualInput(String(Math.max(1, Math.round(seconds / 60))));
  }

  function report() {
    stopTimer(); setStep('outcome'); setError(null);
  }

  function edit(saved: ActivityAttempt) {
    setAttempt(saved); setAttemptId(saved.id); setSelection(saved.selection);
    setPlannedInput(saved.planned_minutes?.toString() ?? '');
    setActualInput(saved.actual_minutes?.toString() ?? '');
    setOutcome(saved.outcome); setHowItWent(saved.how_it_went ?? '');
    setFeelingsAfter(saved.feelings_after ?? ''); setStep('outcome'); setError(null);
  }

  async function saveOutcome() {
    if (!action || !actionId || !selection || !outcome || !attempt || actualMinutes === undefined || busy) return;
    setBusy(true); setError(null);
    const data: ActivityAttemptData = {
      status: 'confirmed', selection, planned_minutes: plannedMinutes ?? null,
      outcome, actual_minutes: actualMinutes, how_it_went: optional(howItWent),
      feelings_after: optional(feelingsAfter),
    };
    try {
      const saved = await saveActivityAttempt(actionId, attemptId, action.revision, attempt.revision, data);
      setAttempt(saved);
      setHistory(current => [saved, ...current.filter(item => item.id !== saved.id)]);
      setStep('saved');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your outcome.'); }
    finally { setBusy(false); }
  }

  function another() {
    setAttempt(null); setAttemptId(newActivityAttemptId()); setSelection(null);
    setPlannedInput(''); setActualInput(''); setOutcome(null); setHowItWent('');
    setFeelingsAfter(''); setElapsedSeconds(0); setTimerStartedAt(null); setStep('agreement');
  }

  const title = step === 'choose' ? 'What would you like to do?'
    : step === 'time' ? 'How much time would you like to make for it?'
    : step === 'ready' ? 'Ready when you are'
    : step === 'outcome' ? 'How did it go?'
    : step === 'feelings' ? 'How did you feel afterward?'
    : step === 'review' ? 'Did I get that right?'
    : step === 'saved' ? 'Outcome saved' : 'Do an enjoyable or meaningful activity';

  return <View style={styles.root}>
    <View style={styles.header}><Text style={styles.brand}>Moodi</Text>
      <Pressable accessibilityRole="button" accessibilityLabel="Close activity check-in"
        accessibilityState={{ disabled: busy }} disabled={busy} onPress={onClose}
        style={styles.close}><Text style={styles.link}>Close</Text></Pressable></View>
    <ScrollView key={step} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
      {step !== 'agreement' && step !== 'saved' ? <Pressable accessibilityRole="button"
        accessibilityLabel="Back" accessibilityState={{ disabled: busy }} disabled={busy}
        onPress={goBack} style={styles.back}><Text style={styles.link}>‹ Back</Text></Pressable> : null}
      {loading ? <ActivityIndicator accessibilityLabel="Loading activity" /> : action ? <>
        {step === 'time' && selection ? <Text style={styles.selectedLabel}>{selection.label}</Text> : null}
        <Text accessibilityRole="header" style={styles.title}>{title}</Text>

        {step === 'agreement' ? <>
          <Text style={styles.body}>Does this match what you agreed to?</Text>
          <View style={styles.card}><Text style={styles.active}>Active</Text>
            <Text style={styles.answer}>{activityAgreementText(action.settings)}</Text>
            <Text style={styles.hint}>From your session · {action.source_ids.join(', ')}</Text>
            <Text style={styles.hint}>“{action.source_excerpt}”</Text></View>
          <ActionButton label={attempt?.status === 'draft' ? 'Resume activity →'
            : action.settings.assignment_kind === 'specific' ? 'Continue with this activity →' : 'Choose an activity →'} onPress={start} />
          {history.some(item => item.status === 'confirmed') ? <View style={styles.card}>
            <Text style={styles.sectionTitle}>Past check-ins</Text>
            {history.filter(item => item.status === 'confirmed').map(item => <Pressable key={item.id}
              accessibilityRole="button" accessibilityLabel={`Edit ${item.selection.label}, ${outcomeLabels[item.outcome!]}`}
              onPress={() => edit(item)} style={styles.historyRow}>
              <Text style={styles.answer}>{item.selection.label}</Text>
              <Text style={styles.hint}>{item.outcome ? outcomeLabels[item.outcome] : ''} · {new Date(item.updated_at).toLocaleDateString()}</Text>
              <Text style={styles.link}>Edit outcome ›</Text>
            </Pressable>)}
          </View> : null}
        </> : null}

        {step === 'choose' ? <>
          <Text style={styles.body}>Pick something that feels enjoyable or meaningful to you.</Text>
          {sessionChoices.length ? <><Text style={styles.sectionTitle}>Mentioned in your session</Text>
            <View style={styles.choices}>{sessionChoices.map(item => <Pressable key={`${item.label}:${item.source_ids.join(',')}`}
              accessibilityRole="button" onPress={() => { setSelection(item); setStep('time'); }} style={styles.choice}>
              <Text style={styles.choiceText}>{item.label}</Text></Pressable>)}</View></> : null}
          {predefinedChoices.length ? <><Text style={styles.sectionTitle}>More ideas</Text>
            <View style={styles.choices}>{predefinedChoices.map(item => <Pressable key={item.suggestion_id}
              accessibilityRole="button" onPress={() => { setSelection(item); setStep('time'); }} style={styles.choice}>
              <Text style={styles.choiceText}>{item.label}</Text></Pressable>)}</View></> : null}
          <View style={styles.inputRow}><Field label="Your own activity idea"
            value={selection?.origin === 'own_idea' ? selection.label : ''}
            onChangeText={value => setSelection({ origin: 'own_idea', label: value, suggestion_id: null, source_ids: [] })}
            placeholder="Or tell me your own idea…" maxLength={200} />
            <Pressable accessibilityRole="button" accessibilityLabel="Use my idea"
              disabled={selection?.origin !== 'own_idea' || !selection.label.trim()}
              onPress={() => { Keyboard.dismiss(); setStep('time'); }}
              style={[styles.send, (selection?.origin !== 'own_idea' || !selection?.label.trim()) && styles.disabled]}>
              <Text style={styles.sendText}>↑</Text></Pressable></View>
        </> : null}

        {step === 'time' ? <>
          <Text style={styles.body}>You chose {selection?.label}.</Text>
          <View style={styles.inputRow}><Field label="Planned time in minutes" value={plannedInput}
            onChangeText={setPlannedInput} placeholder="e.g. About 15 minutes" numeric maxLength={4} />
            <Pressable accessibilityRole="button" accessibilityLabel="Continue with planned time"
              disabled={busy || !selection || plannedMinutes === undefined}
              onPress={() => { Keyboard.dismiss(); void saveDraft(); }}
              style={[styles.send, (busy || !selection || plannedMinutes === undefined) && styles.disabled]}>
              <Text style={styles.sendText}>↑</Text></Pressable></View>
          {plannedMinutes === undefined ? <Text style={styles.error}>Enter 1 to 1440 minutes, or leave it blank.</Text> : null}
          <View style={styles.choices}><Pressable accessibilityRole="button" accessibilityLabel="No set time"
            disabled={busy} onPress={() => { Keyboard.dismiss(); setPlannedInput(''); void saveDraft(null); }} style={styles.choice}>
            <Text style={styles.choiceText}>No set time</Text></Pressable></View>
        </> : null}

        {step === 'ready' ? <>
          <Text style={styles.body}>{selection?.label} · {plannedMinutes ? `${plannedMinutes} min planned` : 'No set time'}</Text>
          {timerStartedAt !== null || elapsedSeconds > 0 ? <Text style={styles.timer}>{formatElapsed(elapsedSeconds)}</Text> : null}
          <View style={styles.buttonRow}>{timerStartedAt === null ? <ActionButton label={elapsedSeconds ? 'Restart timer →' : 'Start timer →'}
            onPress={() => { setElapsedSeconds(0); setTimerStartedAt(Date.now()); }} />
            : <ActionButton label="Stop timer" onPress={stopTimer} />}
            <ActionButton label="Tell you how it went" secondary onPress={report} /></View>
          <Text style={styles.hint}>The timer is optional. You can report the activity whenever you’re ready.</Text>
        </> : null}

        {step === 'outcome' ? <>
          <Text style={styles.body}>You can tell me what happened and roughly how long it lasted.</Text>
          <Field label="What happened?" value={howItWent} onChangeText={setHowItWent}
            placeholder="e.g. I stopped after 5 minutes" multiline maxLength={2000} />
          <View style={styles.choices}>{outcomeOrder.map(value => <Pressable key={value} accessibilityRole="button"
            accessibilityState={{ selected: outcome === value }} onPress={() => setOutcome(value)}
            style={[styles.choice, outcome === value && styles.chosen]}>
            <Text style={styles.choiceText}>{outcomeLabels[value]}</Text></Pressable>)}</View>
          <Field label="About how many minutes?" value={actualInput} onChangeText={setActualInput}
            placeholder="About how many minutes? · optional" numeric maxLength={4} />
          {actualInput.trim() && actualMinutes === undefined ? <Text style={styles.error}>Enter 1 to 1440 minutes, or leave it blank.</Text> : null}
          <ActionButton label="Continue →" disabled={!outcome || actualMinutes === undefined}
            onPress={() => { Keyboard.dismiss(); setStep('feelings'); }} />
        </> : null}

        {step === 'feelings' ? <>
          <Text style={styles.body}>If you’d like, describe how you felt after the activity.</Text>
          <Field label="How did you feel afterward?" value={feelingsAfter}
            onChangeText={setFeelingsAfter} placeholder="How did you feel afterward?" multiline maxLength={1000} />
          <ActionButton label={feelingsAfter.trim() ? 'Continue →' : 'Skip this question →'}
            onPress={() => { Keyboard.dismiss(); setStep('review'); }} />
        </> : null}

        {step === 'review' ? <>
          <Text style={styles.body}>Here’s what I’ll save.</Text>
          <View style={styles.card}>
            <View style={styles.summaryRow}><Text style={styles.hint}>Activity</Text><Text style={styles.answer}>{selection?.label}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.hint}>Outcome</Text><Text style={styles.answer}>{outcome ? outcomeLabels[outcome] : ''}</Text></View>
            {plannedMinutes ? <View style={styles.summaryRow}><Text style={styles.hint}>Planned time</Text><Text style={styles.answer}>{plannedMinutes} min</Text></View> : null}
            {actualMinutes ? <View style={styles.summaryRow}><Text style={styles.hint}>Actual time</Text><Text style={styles.answer}>{actualMinutes} min</Text></View> : null}
            {howItWent.trim() ? <View style={styles.summaryRow}><Text style={styles.hint}>What happened</Text><Text style={styles.answer}>{howItWent.trim()}</Text></View> : null}
            {feelingsAfter.trim() ? <View style={styles.summaryRow}><Text style={styles.hint}>Afterward</Text><Text style={styles.answer}>{feelingsAfter.trim()}</Text></View> : null}
          </View>
          <ActionButton label="Change outcome" secondary onPress={() => setStep('outcome')} />
          <ActionButton label={busy ? 'Saving…' : 'Save outcome ✓'} disabled={busy || !outcome || actualMinutes === undefined}
            onPress={() => void saveOutcome()} />
        </> : null}

        {step === 'saved' ? <><Text style={styles.body}>Your check-in was saved.</Text>
          <Text style={styles.answer}>{selection?.label} · {outcome ? outcomeLabels[outcome] : ''}</Text>
          <ActionButton label="Done" onPress={onClose} />
          <ActionButton label="Try another activity" secondary onPress={another} /></> : null}
      </> : <Text style={styles.error}>{error ?? 'This activity is unavailable.'}</Text>}
      {error && action ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
    </ScrollView>
  </View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 16, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  brand: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  close: { minWidth: 44, minHeight: 44, alignItems: 'flex-end', justifyContent: 'center' },
  content: { padding: 16, gap: 16, paddingBottom: 24 },
  back: { minHeight: 36, alignSelf: 'flex-start', justifyContent: 'center' },
  link: { color: '#C9B7FF', fontSize: 13, fontWeight: '700' },
  title: { color: '#FAF9FF', fontSize: 25, fontWeight: '800', letterSpacing: -0.7 },
  body: { color: '#D4D0DD', fontSize: 14, lineHeight: 21 },
  hint: { color: '#B9B4C7', fontSize: 12, lineHeight: 18 },
  sectionTitle: { color: '#D4D0DD', fontSize: 12, fontWeight: '800' },
  selectedLabel: { alignSelf: 'flex-end', backgroundColor: '#403954', color: '#FFFFFF', borderRadius: 12,
    overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 7, fontSize: 12 },
  card: { backgroundColor: '#2E2B36', borderRadius: 15, gap: 12, padding: 14,
    borderWidth: 1, borderColor: '#4A4655' },
  active: { alignSelf: 'flex-start', color: '#ACE3C8', backgroundColor: '#2D473D', overflow: 'hidden',
    borderRadius: 8, paddingHorizontal: 9, paddingVertical: 5, fontSize: 12, fontWeight: '800' },
  answer: { color: '#FAF9FF', fontSize: 14, lineHeight: 21, fontWeight: '700' },
  field: { flex: 1 },
  input: { borderWidth: 1, borderColor: '#55515F', borderRadius: 12, minHeight: 48,
    paddingHorizontal: 14, paddingVertical: 11, color: '#FFFFFF', fontSize: 15 },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  inputRow: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' },
  send: { width: 48, height: 48, borderRadius: 12, backgroundColor: '#C9B7FF',
    alignItems: 'center', justifyContent: 'center' },
  sendText: { color: '#24212E', fontSize: 25 },
  button: { minHeight: 48, borderRadius: 12, backgroundColor: '#C9B7FF',
    paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#24212E', fontSize: 14, fontWeight: '800', textAlign: 'center' },
  secondaryButton: { backgroundColor: 'transparent', borderWidth: 1, borderColor: '#55515F' },
  secondaryButtonText: { color: '#FAF9FF' },
  disabled: { opacity: 0.4 },
  buttonRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  timer: { color: '#C9B7FF', fontSize: 36, fontWeight: '800', textAlign: 'center' },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { borderWidth: 1, borderColor: '#55515F', borderRadius: 12,
    paddingHorizontal: 13, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  chosen: { backgroundColor: '#403954', borderColor: '#C9B7FF' },
  choiceText: { color: '#FAF9FF', fontSize: 13, fontWeight: '700' },
  summaryRow: { borderTopWidth: 1, borderTopColor: '#514D5A', paddingTop: 10,
    flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  historyRow: { borderTopWidth: 1, borderTopColor: '#514D5A', paddingTop: 10, gap: 3 },
  error: { color: '#FFB4AB', fontSize: 13, lineHeight: 18 },
});
