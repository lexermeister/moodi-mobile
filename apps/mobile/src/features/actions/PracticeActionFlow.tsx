import { PracticeButton, PracticeSummary, practiceStyles } from './PracticeUI';
import { useEffect, useRef, useState } from 'react';
import { SymbolView } from 'expo-symbols';
import { ActivityIndicator, AppState, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { getPracticeAction, listPracticeAttempts, savePracticeAttempt } from './actionsApi';
import { formatElapsed, newActivityAttemptId, outcomeLabels } from './activityFlowDomain';
import type { ActivityOutcome } from './activityTypes';
import { MoodScale } from './MoodScale';
import { newPracticeData, PracticeAttemptWriter, parsePracticeMinutes, practiceTitle, timerSeconds, practiceLogTime } from './practiceFlowDomain';
import type { PracticeAction, PracticeAttempt, PracticeAttemptData, PracticeStep } from './practiceTypes';
import { PracticeAttemptDetail } from '../journey/PracticeAttemptDetail';

export type PracticeFlowStep = 'agreement' | PracticeStep;
export function PracticeActionFlow({ actionId, initialAttemptId, onClose, onSaved, onStepChange }: {
  actionId: string; initialAttemptId?: string; onClose: () => void; onSaved: () => void;
  onStepChange: (step: PracticeFlowStep) => void;
}) {
  const [action, setAction] = useState<PracticeAction | null>(null);
  const [history, setHistory] = useState<PracticeAttempt[]>([]);
  const [selectedHistory, setSelectedHistory] = useState<PracticeAttempt | null>(null);
  const [attempt, setAttempt] = useState<PracticeAttempt | null>(null);
  const [data, setData] = useState<PracticeAttemptData>(newPracticeData);
  const [attemptId, setAttemptId] = useState(newActivityAttemptId);
  const initialId = useRef(attemptId);
  const [step, setStep] = useState<PracticeFlowStep>('agreement');
  const [minutesInput, setMinutesInput] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retry, setRetry] = useState(0);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now);
  const saving = useRef(0);
  const saveVersion = useRef(0);
  const writer = useRef<PracticeAttemptWriter | null>(null);
  const current = useRef({ data, startedAt, step });
  useEffect(() => { current.current = { data, startedAt, step }; }, [data, startedAt, step]);
  useEffect(() => { onStepChange(step); }, [onStepChange, step]);
  useEffect(() => {
    let active = true;
    void Promise.all([getPracticeAction(actionId), listPracticeAttempts(actionId)]).then(([loaded, attempts]) => {
      if (!active) return;
      setAction(loaded); setHistory(attempts);
      const draft = initialAttemptId ? attempts.find(item => item.id === initialAttemptId)
        : attempts.find(item => item.status === 'draft');
      if (initialAttemptId && !draft) { setAction(null); setError('This practice record could not be found.'); return; }
      writer.current = new PracticeAttemptWriter({
        save: (values, revision) => savePracticeAttempt(actionId, draft?.id ?? initialId.current, loaded.revision, revision, values),
        load: async () => (await listPracticeAttempts(actionId)).find(item => item.id === (draft?.id ?? initialId.current)),
      }, draft?.revision ?? 0);
      if (draft) {
        setAttempt(draft); setAttemptId(draft.id); setData(draft); setMinutesInput(draft.actual_minutes?.toString() ?? '');
        if (initialAttemptId) setStep('outcome');
      }
    }).catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your practice.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [actionId, initialAttemptId, retry]);
  useEffect(() => {
    if (startedAt === null) return;
    const interval = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(interval);
  }, [startedAt]);

  async function persist(next: PracticeAttemptData, confirmed = false): Promise<boolean> {
    if (!action || !writer.current) return false;
    if (attempt?.status === 'confirmed' && !confirmed) { setData(next); return true; }
    const version = ++saveVersion.current;
    ++saving.current; setBusy(true); setError(null);
    try {
      const saved = await writer.current.write({ ...next, status: confirmed ? 'confirmed' : 'draft' });
      setAttempt(saved); if (version === saveVersion.current) setData(saved);
      if (confirmed) { setHistory(items => [saved, ...items.filter(item => item.id !== saved.id)]); onSaved(); }
      return true;
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save your practice. Your answers are still here.'); return false; }
    finally { --saving.current; setBusy(saving.current > 0); }
  }
  const persistRef = useRef(persist);
  useEffect(() => { persistRef.current = persist; });
  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      const snapshot = current.current;
      if (state === 'active' || snapshot.step === 'agreement') return;
      const next = { ...snapshot.data,
        timer_elapsed_seconds: timerSeconds(snapshot.data.timer_elapsed_seconds, snapshot.startedAt, Date.now()),
        timer_pause_count: snapshot.data.timer_pause_count + (snapshot.startedAt === null ? 0 : 1) };
      setStartedAt(null); setData(next);
      void persistRef.current(next);
    });
    return () => subscription.remove();
  }, []);

  const elapsed = timerSeconds(data.timer_elapsed_seconds, startedAt, now);
  function stopped(): PracticeAttemptData {
    const next = { ...data, timer_elapsed_seconds: timerSeconds(data.timer_elapsed_seconds, startedAt, Date.now()) };
    setStartedAt(null); setData(next); return next;
  }
  async function go(nextStep: PracticeStep, values = data) {
    const next = { ...values, current_step: nextStep };
    setData(next);
    if (await persist(next)) setStep(nextStep);
  }
  async function close() {
    if (busy) return;
    if (step === 'agreement' || attempt?.status === 'confirmed') { onClose(); return; }
    if (await persist(stopped())) onClose();
  }
  function makeWriter(id: string, revision: number) {
    if (!action) return;
    writer.current = new PracticeAttemptWriter({
      save: (values, expected) => savePracticeAttempt(actionId, id, action.revision, expected, values),
      load: async () => (await listPracticeAttempts(actionId)).find(item => item.id === id),
    }, revision);
  }
  function edit(item: PracticeAttempt) {
    makeWriter(item.id, item.revision);
    setAttempt(item); setAttemptId(item.id); setData(item); setMinutesInput(item.actual_minutes?.toString() ?? '');
    setStartedAt(null); setStep('outcome'); setError(null);
  }
  async function back() {
    if (busy) return;
    const previous: Record<PracticeStep, PracticeStep | 'agreement'> = {
      choice: 'agreement', timer: 'choice', outcome: 'choice', tension: 'outcome', notes: 'tension', review: 'notes',
    };
    if (step === 'agreement') return;
    const target = previous[step];
    const next = stopped();
    if (target === 'agreement') { if (await persist(next)) setStep(target); }
    else await go(target, next);
  }
  async function startTimer() {
    const next = { ...data, timer_used: true, current_step: 'timer' as const };
    setData(next);
    if (await persist(next)) { setStep('timer'); setNow(Date.now()); setStartedAt(Date.now()); }
  }
  async function pauseTimer() {
    const next = stopped(); next.timer_pause_count += 1; setData(next); await persist(next);
  }
  const title = step === 'agreement' ? action ? practiceTitle(action.settings) : 'Practice breathing'
    : step === 'choice' ? 'Have you already practiced?' : step === 'timer' ? 'Your practice timer'
    : step === 'outcome' ? 'How did it go?' : step === 'tension' ? 'Tension before and after'
    : step === 'notes' ? 'Anything you noticed?' : 'Did I get that right?';
  const footer = !action ? null :
    step === 'agreement' ? <>
      <PracticeButton label={attempt?.status === 'draft' ? 'Resume practice →' : action ? `${practiceTitle(action.settings) === 'Practice breathing' ? 'Log breathing practice' : 'Log relaxation practice'} →` : 'Log practice →'}
            disabled={busy || action.state !== 'active'} onPress={() => void go(attempt?.status === 'draft' ? data.current_step : 'choice')} />
</> :
    step === 'choice' ? <>
      <PracticeButton label="Start timer →" disabled={busy} onPress={() => void startTimer()} />
          <PracticeButton label="Tell you how it went" secondary disabled={busy} onPress={() => void go('outcome')} />
</> :
    step === 'timer' ? <>
      <PracticeButton label={startedAt === null ? 'Resume timer' : 'Pause timer'} disabled={busy}
            onPress={() => startedAt === null ? (setNow(Date.now()), setStartedAt(Date.now())) : void pauseTimer()} />
          <PracticeButton label="Stop and tell you how it went →" secondary disabled={busy} onPress={() => void go('outcome', stopped())} />
</> :
    step === 'outcome' ? <>
      <PracticeButton label="Continue →" disabled={busy || !data.outcome || parsePracticeMinutes(minutesInput) === undefined} onPress={() => void go('tension')} />
</> :
    step === 'tension' ? <>
      <PracticeButton label="Continue →" disabled={busy} onPress={() => void go('notes')} />
</> :
    step === 'notes' ? <>
      <PracticeButton label="Review outcome →" disabled={busy} onPress={() => void go('review')} />
</> :
    step === 'review' ? <>
      <PracticeButton label={busy ? 'Saving…' : 'Save outcome'} disabled={busy} onPress={() => {
            void persist({ ...data, current_step: 'review' }, true).then(saved => { if (saved) onClose(); });
          }} />
</> :
    null;
  return <View style={{ flex: 1 }}>
    <View style={practiceStyles.header}><Text style={practiceStyles.brand}>Moodi</Text>
      <Pressable accessibilityRole="button" disabled={busy} onPress={() => void close()} style={{ padding: 12 }}>
        <Text style={practiceStyles.link}>Close</Text></Pressable></View>
    <ScrollView key={step} keyboardShouldPersistTaps="handled" contentContainerStyle={practiceStyles.content}>
      {step !== 'agreement' ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => void back()} style={{ minHeight: 44, justifyContent: 'center' }}>
        <Text style={practiceStyles.link}>‹ Back</Text></Pressable> : null}
      {loading ? <ActivityIndicator accessibilityLabel="Loading practice" /> : action ? <>
        <Text accessibilityRole="header" style={practiceStyles.title}>{title}</Text>
        {step === 'agreement' ? <>
          <Text style={practiceStyles.body}>Does this match what you agreed to?</Text>
          <View style={practiceStyles.card}><Text style={practiceStyles.badge}>{action.state === 'active' ? 'Active' : 'Paused'}</Text>
            <Text style={practiceStyles.answer}>{action.settings.exact_task}</Text>
            {action.settings.technique ? <Text style={practiceStyles.body}>{action.settings.technique}</Text> : null}
            {action.settings.duration_minutes !== null ? <Text style={practiceStyles.hint}>Agreed duration · {action.settings.duration_minutes} min</Text> : null}
            {action.settings.repetitions ? <Text style={practiceStyles.hint}>{action.settings.repetitions}</Text> : null}
            {action.settings.limits ? <Text style={practiceStyles.body}>{action.settings.limits}</Text> : null}
            <Text style={practiceStyles.link}>From your session · {action.source_ids.join(', ')}</Text>
            <Text style={practiceStyles.hint}>“{action.source_excerpt}”</Text>
            {action.settings.resource_url ? <Pressable accessibilityRole="link" onPress={() => {
              const url = action.settings.resource_url!;
              if (/^https?:\/\//i.test(url)) void Linking.openURL(url).catch(() => setError('Could not open the original resource.'));
            }}><Text style={practiceStyles.link}>Original resource ↗</Text></Pressable> :
              <Text style={practiceStyles.hint}>Your therapist’s recording is not attached. You can log a practice you did on your own.</Text>}
          </View>
          {history.some(item => item.status === 'confirmed') ? <View style={practiceStyles.historySection}>
            <Text accessibilityRole="header" style={practiceStyles.historyTitle}>Past entries</Text>
            <View style={practiceStyles.history}>
            {history.filter(item => item.status === 'confirmed').map((item, index) => {
              const dateLabel = new Date(`${item.relevant_date}T12:00:00`).toLocaleDateString(undefined, {
                month: 'short', day: 'numeric', year: 'numeric',
              });
              return <Pressable key={item.id}
              accessibilityRole="button" accessibilityLabel={`Review practice, ${dateLabel}, ${outcomeLabels[item.outcome!]}`}
              disabled={busy} accessibilityState={{ disabled: busy }} onPress={() => setSelectedHistory(item)}
              style={({ pressed }) => [practiceStyles.historyRow, index > 0 && practiceStyles.historyDivider,
                (pressed || busy) && { opacity: 0.5 }]}>
              <Text style={practiceStyles.historyText}>{dateLabel} · {outcomeLabels[item.outcome!]}</Text>
              <SymbolView name={{ ios: 'pencil', android: 'edit', web: 'edit' }} size={16} tintColor="#C9B7FF" />
            </Pressable>; })}
            </View>
          </View> : null}
        </> : null}
        {step === 'choice' ? <>
          <Text style={practiceStyles.body}>If you have the practice your therapist showed you, you can use a simple timer or tell me how it went.</Text>
        </> : null}
        {step === 'timer' ? <>
          <Text style={practiceStyles.body}>Use the practice you agreed to. You can pause or stop whenever you like.</Text>
          <Text style={practiceStyles.timer}>{formatElapsed(elapsed)}</Text>
          {action.settings.duration_minutes !== null ? <Text style={practiceStyles.hint}>Agreed duration · {action.settings.duration_minutes} min{elapsed >= action.settings.duration_minutes * 60 ? ' · Time elapsed' : ''}</Text> : null}
        </> : null}
        {step === 'outcome' ? <>
          <Text style={practiceStyles.body}>You can tell me what happened and roughly how long it lasted.</Text>
          <TextInput accessibilityLabel="What happened?" editable={!busy} multiline value={data.notes ?? ''} maxLength={2000}
            onChangeText={notes => setData({ ...data, notes: notes || null })} placeholder="e.g. I stopped after 5 minutes"
            placeholderTextColor="#AAA5B5" style={[practiceStyles.input, practiceStyles.multiline]} />
          <View style={practiceStyles.choices}>
            {(['completed', 'partly_completed', 'skipped', 'stopped_early'] as ActivityOutcome[]).map(outcome => <Pressable key={outcome}
              accessibilityRole="button" disabled={busy} accessibilityState={{ selected: data.outcome === outcome, disabled: busy }}
              onPress={() => setData({ ...data, outcome })}
              style={[practiceStyles.choice, data.outcome === outcome && practiceStyles.chosen, busy && { opacity: 0.5 }]}>
              <Text style={practiceStyles.choiceText}>{outcomeLabels[outcome]}</Text></Pressable>)}
          </View>
          <Text style={practiceStyles.hint}>How many minutes did you practice? (optional)</Text>
          <TextInput accessibilityLabel="Actual practice minutes" keyboardType="decimal-pad" editable={!busy} value={minutesInput}
            onChangeText={text => { setMinutesInput(text); const value = parsePracticeMinutes(text); if (value !== undefined) setData({ ...data, actual_minutes: value }); }}
            placeholder="Leave blank if you’re not sure" placeholderTextColor="#AAA5B5" style={practiceStyles.input} />
          {parsePracticeMinutes(minutesInput) === undefined ? <Text style={practiceStyles.error}>Enter minutes or leave this blank.</Text> : null}
        </> : null}
        {step === 'tension' ? <>
          <Text style={practiceStyles.body}>Looking back, how tense did you feel before? How about afterward? Both ratings are optional.</Text>
          <MoodScale showInput={false} label="Tension before" disabled={busy} value={data.tension_before} onChange={value => setData({ ...data, tension_before: value })} low="Fully relaxed" high="Extremely tense" />
          <MoodScale showInput={false} label="Tension after" disabled={busy} value={data.tension_after} onChange={value => setData({ ...data, tension_after: value })} low="Fully relaxed" high="Extremely tense" />
        </> : null}
        {step === 'notes' ? <>
          <Text style={practiceStyles.body}>You can add a few words, or leave this blank.</Text>
          <TextInput accessibilityLabel="Anything you noticed?" editable={!busy} multiline value={data.notes ?? ''} maxLength={2000}
            onChangeText={notes => setData({ ...data, notes: notes || null })} placeholder="Anything you noticed…"
            placeholderTextColor="#AAA5B5" style={[practiceStyles.input, { minHeight: 110, textAlignVertical: 'top' }]} />
        </> : null}
        {step === 'review' ? <>
          <Text style={practiceStyles.body}>{action.settings.technique ?? action.settings.exact_task}</Text>
          <PracticeSummary data={data} loggedAt={attempt?.status === 'confirmed' ? practiceLogTime(attempt) : new Date().toISOString()} />
        </> : null}
      </> : <PracticeButton label="Retry loading practice" onPress={() => { setLoading(true); setError(null); setRetry(value => value + 1); }} />}
      {error ? <Text accessibilityRole="alert" style={practiceStyles.error}>{error}</Text> : null}
    </ScrollView>
    {!loading && action ? <View style={{ padding: 16, paddingTop: 8, gap: 10 }}>{footer}</View> : null}
    {selectedHistory ? <PracticeAttemptDetail attempt={selectedHistory} onClose={() => setSelectedHistory(null)}
      onEdit={() => { setSelectedHistory(null); edit(selectedHistory); }} /> : null}
  </View>;
}
