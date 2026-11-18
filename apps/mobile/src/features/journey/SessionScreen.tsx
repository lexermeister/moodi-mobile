import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, Card, Page, typography } from '@/ui/components';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { JourneySummary } from './JourneySummary';
import { theme } from '@/ui/theme';
import { formatDuration, isProcessing, sessionDate, sessionProcessingMessage, sessionStatus } from './sessionPresentation';

export function SessionScreen() {
  const [transcriptOpen, setTranscriptOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { id } = useLocalSearchParams<{ id: string }>();
  const library = useSharedRecordingLibrary();
  const { generateInsights } = library;
  const router = useRouter();
  const recording = library.recordings.find((item) => item.id === id);
  const back = () => router.canGoBack() ? router.back() : router.replace('/journey');
  useEffect(() => {
    if (recording?.processingStatus === 'local') {
      generateInsights(recording);
    }
  }, [generateInsights, recording]);
  if (library.isLoading) return <Page><ActivityIndicator accessibilityLabel="Loading session" /></Page>;
  if (!recording) return <Page><Button secondary label="Back to Journey" onPress={back} /><Text style={typography.heading}>Session unavailable</Text><Text style={typography.body}>This recording is no longer available on this device.</Text></Page>;
  const busy = library.isRecording || library.isBusy || isProcessing(recording);
  const processingMessage = sessionProcessingMessage(recording);
  const canRetry = recording.processingStatus === 'failed';
  const recordedDate = sessionDate(recording);
  const isToday = recordedDate.toDateString() === new Date().toDateString();
  return <Page>
    <Pressable accessibilityRole="button" onPress={back} style={styles.back}><Text style={styles.backText}>‹  Timeline</Text></Pressable>
    <View style={styles.reviewArea}>
      <View style={styles.header}><View style={styles.dateRow}><Text style={styles.time}>{recordedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel={detailsOpen ? 'Hide recording details' : 'Show recording details'}
          onPress={() => setDetailsOpen(value => !value)} style={styles.more}><Text style={styles.moreText}>⋯</Text></Pressable></View>
        <Text style={styles.title}>{isToday ? 'Today' : 'Session review'}</Text></View>
      <JourneySummary recording={recording} onClose={back} />
    </View>
    {(detailsOpen || canRetry || isProcessing(recording)) ? <>
    <Text style={typography.heading}>Recording</Text>
    <Card><Text accessibilityLiveRegion="polite" style={typography.heading}>{sessionStatus(recording)}</Text>
      {isProcessing(recording) ? <ActivityIndicator accessibilityLabel="Processing session" /> : null}
      {processingMessage ? <Text style={recording.processingStatus === 'failed' ? typography.error : typography.body}>{processingMessage}</Text> : null}
      {canRetry ? <Button label="Retry processing" disabled={busy} onPress={() => library.generateInsights(recording)} /> : null}
      <Text style={typography.body}>{formatDuration(recording.durationMs)}</Text>
      <Button secondary label={library.playingId === id ? 'Stop playback' : 'Play recording'} disabled={busy} onPress={() => void library.togglePlayback(recording)} />
    </Card>
    <Card>
      <Button secondary label={transcriptOpen ? 'Hide transcript' : 'View transcript'} onPress={() => setTranscriptOpen(value => !value)} />
      {transcriptOpen ? recording.transcriptTurns?.length ? recording.transcriptTurns.map((turn, index) => <View key={index} style={styles.turn}>
        <Text style={styles.speaker}>{turn.role === 'client' ? 'You' : 'Therapist'}</Text>
        <Text selectable style={typography.body}>{turn.text}</Text>
      </View>) : <Text selectable style={typography.body}>{recording.transcript || 'A transcript isn’t available yet.'}</Text> : null}
    </Card>
    {library.error ? <Text accessibilityLiveRegion="polite" style={typography.error}>{library.error}</Text> : null}
    <Button secondary label="Export recording" disabled={busy} onPress={() => void library.shareRecording(recording)} />
    <Button secondary label="Delete recording" disabled={busy} onPress={() => Alert.alert('Delete recording?', 'This removes the audio and saved session details from this device.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Delete', style: 'destructive', onPress: () => void library.deleteRecording(recording) },
    ])} />
    </> : null}
  </Page>;
}

const styles = StyleSheet.create({
  back: { minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' },
  backText: { fontSize: 13, fontWeight: '600', color: theme.colors.accent },
  header: { gap: 10 },
  dateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  more: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  moreText: { fontSize: 22, color: theme.colors.accent, fontWeight: '700' },
  reviewArea: { gap: 8 },
  title: { fontSize: 32, fontWeight: '800', letterSpacing: -1.1, color: theme.colors.ink },
  time: { fontSize: 13, color: theme.colors.muted },
  turn: { borderBottomWidth: 1, borderBottomColor: theme.colors.line, paddingVertical: 10, gap: 4 },
  speaker: { fontSize: 12, fontWeight: '700', color: theme.colors.accent },
});
