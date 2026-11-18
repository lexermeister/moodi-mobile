import { createContext, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { AppState, Keyboard, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Button } from '@/ui/components';
import { theme } from '@/ui/theme';
import { MoodiWave } from '@/ui/MoodiWave';
import { MoodEntryWizard } from '../actions/MoodEntryWizard';
import type { RatingAction, RatingEntry } from '../actions/actionTypes';
import { listRatingActions, listRatingEntries } from '../actions/actionsApi';
import { latestMoodDraft } from '../actions/moodWizardDomain';
import { hasConfirmedMoodForToday, isMoodActionDue } from '../actions/moodSchedule';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { formatDuration } from '../journey/sessionPresentation';

type MoodSession = { action: RatingAction; draft?: RatingEntry };
type PanelState = {
  open: boolean;
  setOpen: (value: boolean) => void;
  moodSession: MoodSession | null;
  openMoodCheckIn: (session: MoodSession) => void;
  closeMoodCheckIn: () => void;
  entryVersion: number;
};
const PanelContext = createContext<PanelState | null>(null);
export function MoodiPanelProvider({ children }: PropsWithChildren) {
  const [open, setOpen] = useState(false);
  const [moodSession, setMoodSession] = useState<MoodSession | null>(null);
  const [entryVersion, setEntryVersion] = useState(0);
  const openMoodCheckIn = (session: MoodSession) => { setMoodSession(current => current ?? session); setOpen(true); };
  const closeMoodCheckIn = () => { setMoodSession(null); setOpen(false); setEntryVersion(value => value + 1); };
  return <PanelContext.Provider value={{ open, setOpen, moodSession, openMoodCheckIn, closeMoodCheckIn, entryVersion }}>{children}</PanelContext.Provider>;
}
export function useMoodiPanel() {
  const value = useContext(PanelContext);
  if (!value) throw new Error('Moodi panel provider is missing');
  return value;
}
export function MoodiPanel() {
  const { open, setOpen, moodSession, openMoodCheckIn, closeMoodCheckIn, entryVersion } = useMoodiPanel();
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
    if (!open || moodSession || active) return;
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
  }, [open, moodSession, active, entryVersion]);
  useEffect(() => {
    if (!pendingReviewId || appState !== 'active' || AppState.currentState !== 'active') return;
    const recordingId = pendingReviewId;
    consumePendingReview();
    setOpen(false);
    router.push({ pathname: '/journey/session/[id]', params: { id: recordingId } });
  }, [appState, consumePendingReview, pendingReviewId, router, setOpen]);
  return <View pointerEvents="box-none" style={[styles.layer, { bottom: Math.max(64 + insets.bottom + 12, keyboardHeight + 8), top: insets.top + 16 }]}>
    {moodSession ? <View style={[styles.moodPanel, !open && styles.hidden]}>
      <MoodEntryWizard key={moodSession.draft?.id ?? moodSession.action.id} action={moodSession.action} draft={moodSession.draft} onClose={closeMoodCheckIn} />
    </View> : open ? <View style={styles.panel}>
      <View style={styles.header}><Text style={styles.name}>Moodi</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Minimize Moodi" onPress={() => setOpen(false)} style={styles.close}>
          <Text style={styles.copy}>−</Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.panelContent}>
        <Text accessibilityRole="header" style={styles.title}>{library.isRecording ? 'Recording session' : library.isStarting ? 'Preparing microphone…' : library.isBusy ? 'Saving your recording…' : 'Ready when you are'}</Text>
        {active ? <Text style={styles.timer}>{formatDuration(library.durationMs)}</Text> :
          <Text style={styles.copy}>{moodOption ? 'Record a session or check in with your mood.' : 'Record a session, then review it in Journey.'}</Text>}
        {!active && moodOption ? <Button label={moodOption.draft ? 'Resume mood check-in' : 'Record mood'}
          onPress={() => { setAvailableMood(null); openMoodCheckIn(moodOption); }} /> : null}
        <Button label={library.isRecording ? 'Stop recording' : 'Start recording'} disabled={library.isBusy} onPress={library.toggleRecording} />
        {library.permission.known && !library.permission.granted ? <>
          <Text style={styles.copy}>Allow microphone access to record your session.</Text>
          {!library.permission.canAskAgain ? <Button label="Open Settings" onPress={() => void library.openSettings()} /> : null}
        </> : null}
        {library.error ? <Text accessibilityLiveRegion="assertive" style={styles.copy}>{library.error}</Text> : null}
        {library.notice ? <Text accessibilityLiveRegion="polite" style={styles.copy}>{library.notice}</Text> : null}
        {!active && library.recordings.length ? <Button label="View Journey" onPress={() => { setOpen(false); router.navigate('/journey'); }} /> : null}
      </ScrollView>
    </View> : null}
    <Pressable accessibilityRole="button" accessibilityLabel={open ? 'Minimize Moodi' : active ? 'Open recording controls' : 'Ask Moodi'}
      accessibilityState={{ expanded: open }} onPress={() => { if (open) Keyboard.dismiss(); setOpen(!open); }} style={styles.launcher}>
      {library.isRecording ? <Text style={styles.recordingDot}>●</Text> : <MoodiWave />}
    </Pressable>
  </View>;
}
const styles = StyleSheet.create({
  layer: { position: 'absolute', right: 16, left: 16, justifyContent: 'flex-end', alignItems: 'flex-end', gap: 8 },
  panel: { backgroundColor: theme.colors.panel, borderRadius: 24, padding: 16, width: '100%', maxWidth: 400, flexShrink: 1 },
  moodPanel: { backgroundColor: theme.colors.panel, borderRadius: 22, width: '100%', maxWidth: 400, height: 560, maxHeight: '100%', overflow: 'hidden' },
  hidden: { display: 'none' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { color: theme.colors.panelText, fontWeight: '700', fontSize: 13 },
  close: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center' },
  panelContent: { gap: 16, paddingBottom: 4 },
  title: { color: theme.colors.panelText, fontSize: 25, fontWeight: '700', letterSpacing: -0.5 },
  copy: { color: theme.colors.panelMuted, fontSize: 15, lineHeight: 23 },
  timer: { color: theme.colors.panelText, fontSize: 32, fontVariant: ['tabular-nums'] },
  launcher: { width: 54, height: 54, borderRadius: 19, backgroundColor: theme.colors.panel,
    alignItems: 'center', justifyContent: 'center', shadowColor: '#19151F', shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22, shadowRadius: 12, elevation: 7 },
  recordingDot: { color: '#D7C8FF', fontSize: 25, lineHeight: 30, includeFontPadding: false },
});
