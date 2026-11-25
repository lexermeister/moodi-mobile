import { PracticeActionFlow, type PracticeFlowStep } from '../actions/PracticeActionFlow';
import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { Button } from '@/ui/components';
import { theme } from '@/ui/theme';
import { MoodiWave } from '@/ui/MoodiWave';
import { MoodEntryWizard } from '../actions/MoodEntryWizard';
import { ActivityActionFlow, type ActivityFlowStep } from '../actions/ActivityActionFlow';
import type { RatingAction, RatingEntry } from '../actions/actionTypes';
import { listRatingActions, listRatingEntries } from '../actions/actionsApi';
import { latestMoodDraft } from '../actions/moodWizardDomain';
import { hasConfirmedMoodForToday, isMoodActionDue } from '../actions/moodSchedule';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { formatDuration } from '../journey/sessionPresentation';
import { RecordingWaveform } from './RecordingWaveform';

type MoodSession = { action: RatingAction; draft?: RatingEntry };
const activityDialogHeights: Record<ActivityFlowStep, number> = {
  agreement: 400, choose: 420, time: 320, ready: 280,
  outcome: 420, feelings: 310, review: 420, saved: 260,
};
const practiceDialogHeights: Record<PracticeFlowStep, number> = {
  agreement: 480, choice: 420, timer: 420, outcome: 530, tension: 640, notes: 480, review: 560,
};
type PanelState = {
  practiceSession: { actionId: string; attemptId?: string } | null;
  practiceStep: PracticeFlowStep;
  setPracticeStep: (step: PracticeFlowStep) => void;
  openPracticeCheckIn: (actionId: string, attemptId?: string) => void;
  closePracticeCheckIn: () => void;
  practiceSaved: () => void;
  open: boolean;
  setOpen: (value: boolean) => void;
  moodSession: MoodSession | null;
  activityActionId: string | null;
  activityStep: ActivityFlowStep;
  setActivityStep: (step: ActivityFlowStep) => void;
  openMoodCheckIn: (session: MoodSession) => void;
  openActivityCheckIn: (actionId: string) => void;
  closeMoodCheckIn: () => void;
  closeActivityCheckIn: () => void;
  resetPanel: () => void;
  entryVersion: number;
};
const PanelContext = createContext<PanelState | null>(null);
export function MoodiPanelProvider({ children }: PropsWithChildren) {
  const [practiceSession, setPracticeSession] = useState<{ actionId: string; attemptId?: string } | null>(null);
  const [practiceStep, setPracticeStep] = useState<PracticeFlowStep>('agreement');
  const [open, setOpen] = useState(false);
  const [moodSession, setMoodSession] = useState<MoodSession | null>(null);
  const [activityActionId, setActivityActionId] = useState<string | null>(null);
  const [activityStep, setActivityStep] = useState<ActivityFlowStep>('agreement');
  const [entryVersion, setEntryVersion] = useState(0);
  const openMoodCheckIn = (session: MoodSession) => { setPracticeSession(null); setActivityActionId(null); setMoodSession(current => current ?? session); setOpen(true); };
  const openActivityCheckIn = (actionId: string) => { setPracticeSession(null); setMoodSession(null); setActivityStep('agreement'); setActivityActionId(actionId); setOpen(true); };
  const closeMoodCheckIn = () => { setMoodSession(null); setOpen(false); setEntryVersion(value => value + 1); };
  const closeActivityCheckIn = () => { setActivityActionId(null); setOpen(false); setEntryVersion(value => value + 1); };
  const openPracticeCheckIn = (actionId: string, attemptId?: string) => { setMoodSession(null); setActivityActionId(null); setPracticeStep('agreement'); setPracticeSession({ actionId, attemptId }); setOpen(true); };
  const closePracticeCheckIn = () => { setPracticeSession(null); setOpen(false); setEntryVersion(value => value + 1); };
  const practiceSaved = () => setEntryVersion(value => value + 1);
  const resetPanel = () => { setPracticeSession(null); setMoodSession(null); setActivityActionId(null); setOpen(false); setEntryVersion(value => value + 1); };
  return <PanelContext.Provider value={{ practiceSession, practiceStep, setPracticeStep, openPracticeCheckIn, closePracticeCheckIn, practiceSaved, open, setOpen, moodSession, activityActionId, activityStep, setActivityStep, openMoodCheckIn,
    openActivityCheckIn, closeMoodCheckIn, closeActivityCheckIn, resetPanel, entryVersion }}>{children}</PanelContext.Provider>;
}
export function useMoodiPanel() {
  const value = useContext(PanelContext);
  if (!value) throw new Error('Moodi panel provider is missing');
  return value;
}
export function MoodiPanel() {
  const { practiceSession, practiceStep, setPracticeStep, closePracticeCheckIn, practiceSaved, open, setOpen, moodSession, activityActionId, activityStep, setActivityStep, openMoodCheckIn, closeMoodCheckIn,
    closeActivityCheckIn, entryVersion } = useMoodiPanel();
  const library = useSharedRecordingLibrary();
  const { consumePendingReview, pendingReviewId } = library;
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [appState, setAppState] = useState(AppState.currentState);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [availableMood, setAvailableMood] = useState<{ session: MoodSession; version: number } | null>(null);
  const moodOption = availableMood?.version === entryVersion ? availableMood.session : null;
  const active = library.isRecording || library.isBusy;
  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', event => setKeyboardHeight(event.endCoordinates.height));
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboardHeight(0));
    return () => { show.remove(); hide.remove(); };
  }, []);
  useEffect(() => {
    if (!open || moodSession || activityActionId || practiceSession || active) return;
    let current = true;
    void listRatingActions().then(async actions => {
      for (const action of actions) {
        if (action.state !== 'active' || action.settings.configuration.input_kind !== 'numeric_0_10' || !isMoodActionDue(action)) continue;
        const entries = await listRatingEntries(action.id);
        if (!hasConfirmedMoodForToday(action, entries)) return { action, draft: latestMoodDraft(entries) };
      }
      return null;
    }).then(session => { if (current) setAvailableMood(session ? { session, version: entryVersion } : null); })
      .catch(() => { if (current) setAvailableMood(null); });
    return () => { current = false; };
  }, [open, moodSession, activityActionId, practiceSession, active, entryVersion]);
  useEffect(() => {
    if (!pendingReviewId || appState !== 'active' || AppState.currentState !== 'active') return;
    const recordingId = pendingReviewId;
    consumePendingReview();
    setOpen(false);
    router.push({ pathname: '/journey/session/[id]', params: { id: recordingId } });
  }, [appState, consumePendingReview, pendingReviewId, router, setOpen]);
  return <View pointerEvents="box-none" style={[styles.layer, { bottom: Math.max(64 + insets.bottom + 12, keyboardHeight + 8), top: insets.top + 16 }]}>
    {practiceSession ? <View style={[styles.moodPanel, styles.activityPanel, { maxHeight: '90%' },
      { height: practiceDialogHeights[practiceStep] }, !open && styles.hidden]}>
      <PracticeActionFlow key={`${practiceSession.actionId}:${practiceSession.attemptId ?? 'new'}`}
        actionId={practiceSession.actionId} initialAttemptId={practiceSession.attemptId}
        onClose={closePracticeCheckIn} onSaved={practiceSaved} onStepChange={setPracticeStep} />
    </View> : moodSession ? <View style={[styles.moodPanel, !open && styles.hidden]}>
      <MoodEntryWizard key={moodSession.draft?.id ?? moodSession.action.id} action={moodSession.action} draft={moodSession.draft} onClose={closeMoodCheckIn} />
    </View> : activityActionId ? <View style={[styles.moodPanel, styles.activityPanel,
      { height: activityDialogHeights[activityStep] }, !open && styles.hidden]}>
      <ActivityActionFlow key={activityActionId} actionId={activityActionId}
        onClose={closeActivityCheckIn} onStepChange={setActivityStep} />
    </View> : open ? <View style={styles.panel}>
      <View style={styles.header}><Text style={styles.name}>Moodi</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Minimize Moodi" onPress={() => setOpen(false)} style={styles.close}>
          <Text style={styles.copy}>−</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.panelContent}>
        {library.isRecording ? <>
          <Text accessibilityRole="header" style={styles.title}>Recording session</Text>
          <View style={styles.callCard}>
            <RecordingWaveform />
            <Text accessibilityLiveRegion="polite" style={styles.timer}>{formatDuration(library.durationMs).padStart(5, '0')}</Text>
            <Text style={styles.callCaption}>Recording in progress</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Stop recording" onPress={library.toggleRecording}
            style={({ pressed }) => [styles.actionButton, pressed && styles.pressed]}>
            <Text style={styles.actionText}>Stop recording</Text>
            <SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={19} tintColor="#282038" />
          </Pressable>
        </> : <>
          <Text accessibilityRole="header" style={styles.title}>{library.isStarting ? 'Preparing microphone…' : library.isBusy ? 'Saving your recording…' : 'Ready when you are'}</Text>
          {!active ? <Text style={styles.copy}>I’ll prepare a transcript and pull out what you agreed to try.</Text> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Start recording" disabled={library.isBusy}
            onPress={library.toggleRecording} style={({ pressed }) => [styles.actionButton, (pressed || library.isBusy) && styles.pressed]}>
            <Text style={styles.actionText}>{library.isStarting ? 'Preparing…' : library.isBusy ? 'Saving…' : 'Start recording'}</Text>
            <SymbolView name={{ ios: 'mic', android: 'mic', web: 'mic' }} size={20} tintColor="#282038" />
          </Pressable>
          {!active && moodOption ? <Button label={moodOption.draft ? 'Resume mood check-in' : 'Record mood'} secondary
            onPress={() => { setAvailableMood(null); openMoodCheckIn(moodOption); }} /> : null}
        </>}
        {library.permission.known && !library.permission.granted ? <>
          <Text style={styles.copy}>Allow microphone access to record your session.</Text>
          {!library.permission.canAskAgain ? <Button label="Open Settings" onPress={() => void library.openSettings()} /> : null}
        </> : null}
        {library.error ? <Text accessibilityLiveRegion="assertive" style={styles.copy}>{library.error}</Text> : null}
        {library.notice ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{library.notice}</Text> : null}
      </ScrollView>
    </View> : null}
    {open ? <>
      <View pointerEvents="none" accessible={false} style={styles.panelTailBorder} />
      <View pointerEvents="none" accessible={false} style={styles.panelTail} />
    </> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Minimize Moodi' : active ? 'Open recording controls' : 'Ask Moodi'}
      accessibilityState={{ expanded: open }} onPress={() => { if (open) Keyboard.dismiss(); setOpen(!open); }}
      style={[styles.launcher, library.isRecording && styles.recordingLauncher]}>
      <MoodiWave color={library.isRecording ? '#33254B' : '#D7CCFF'} />
      {library.isRecording ? <View style={styles.recordingIndicator} /> : null}
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  layer: { position: 'absolute', right: 16, left: 16, justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8 },
  panel: { backgroundColor: theme.colors.panel, borderRadius: 24, padding: 16, width: '100%', maxWidth: 400, flexShrink: 1,
    borderWidth: 1, borderColor: '#4A4655', shadowColor: '#19151F', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.26, shadowRadius: 18, elevation: 10 },
  moodPanel: { backgroundColor: theme.colors.panel, borderRadius: 22, width: '100%', maxWidth: 400, height: 560, maxHeight: '100%', overflow: 'hidden',
    borderWidth: 1, borderColor: '#4A4655' },
  panelTailBorder: { position: 'absolute', right: 15, bottom: 56, width: 0, height: 0,
    borderLeftWidth: 12, borderRightWidth: 12, borderTopWidth: 12,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: '#4A4655',
    zIndex: 1, elevation: 11 },
  panelTail: { position: 'absolute', right: 17, bottom: 58, width: 0, height: 0,
    borderLeftWidth: 10, borderRightWidth: 10, borderTopWidth: 10,
    borderLeftColor: 'transparent', borderRightColor: 'transparent', borderTopColor: theme.colors.panel,
    zIndex: 2, elevation: 12 },
  activityPanel: { maxHeight: '78%', borderWidth: 1, borderColor: '#4A4655',
    shadowColor: '#19151F', shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.26,
    shadowRadius: 18, elevation: 10 },
  hidden: { display: 'none' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: theme.colors.panelText, fontWeight: '700', fontSize: 13 },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  panelContent: { gap: 16, paddingBottom: 4, paddingTop: 8 },
  title: { color: theme.colors.panelText, fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
  copy: { color: theme.colors.panelMuted, fontSize: 15, lineHeight: 23 },
  callCard: { backgroundColor: '#332E40', borderWidth: 1, borderColor: '#4A4259', borderRadius: 16,
    alignItems: 'center', paddingHorizontal: 12, paddingTop: 12, paddingBottom: 16 },
  timer: { color: '#C6B4FF', fontSize: 52, fontWeight: '700', fontVariant: ['tabular-nums'], letterSpacing: 1 },
  callCaption: { color: theme.colors.panelMuted, fontSize: 13, marginTop: 3 },
  actionButton: { alignSelf: 'flex-start', minHeight: 48, borderRadius: 13, backgroundColor: '#C6B4FF',
    paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  actionText: { color: '#282038', fontSize: 16, fontWeight: '700' },
  pressed: { opacity: 0.65 },
  launcher: { width: 54, height: 54, borderRadius: 19, backgroundColor: theme.colors.panel,
    alignItems: 'center', justifyContent: 'center', shadowColor: '#19151F', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 7 },
  recordingLauncher: { backgroundColor: '#C6B4FF' },
  recordingIndicator: { position: 'absolute', top: 1, right: 1, width: 11, height: 11, borderRadius: 6,
    backgroundColor: '#77C5A0', borderWidth: 2, borderColor: theme.colors.panel },
});
