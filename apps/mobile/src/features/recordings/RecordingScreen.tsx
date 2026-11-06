import { useCallback } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import type { RecordingMetadata } from './recordingStorage';
import { useRecordingLibrary } from './useRecordingLibrary';

function formatDuration(durationMs: number) {
  const totalSeconds = Math.max(0, Math.floor(durationMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(isoDate: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(isoDate));
}

export function RecordingScreen() {
  const library = useRecordingLibrary();

  const confirmDelete = useCallback(
    (recording: RecordingMetadata) => {
      Alert.alert('Delete recording?', 'This removes the audio file from this device.', [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => void library.deleteRecording(recording),
        },
      ]);
    },
    [library],
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <ScrollView
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Text style={styles.eyebrow}>MOODI</Text>
          <Text style={styles.title}>Capture this moment.</Text>
          <Text style={styles.subtitle}>Saved on this device, then sent for transcription.</Text>
        </View>

        <View style={styles.recorderCard}>
          <View style={[styles.pulse, library.isRecording && styles.pulseActive]}>
            <Pressable
              accessibilityHint={
                library.isRecording ? 'Stops and saves this recording' : 'Starts a new recording'
              }
              accessibilityLabel={library.isRecording ? 'Stop recording' : 'Record audio'}
              accessibilityRole="button"
              disabled={library.isBusy}
              onPress={library.toggleRecording}
              style={({ pressed }) => [
                styles.recordButton,
                library.isRecording && styles.stopButton,
                pressed && styles.pressed,
                library.isBusy && styles.disabled,
              ]}>
              {library.isBusy ? (
                <ActivityIndicator color="#fff" size="large" />
              ) : (
                <>
                  <View style={library.isRecording ? styles.stopIcon : styles.recordIcon} />
                  <Text style={styles.recordButtonText}>
                    {library.isRecording ? 'Stop' : 'Record'}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
          <Text accessibilityLiveRegion="polite" style={styles.timer}>
            {formatDuration(library.isRecording || library.isBusy ? library.durationMs : 0)}
          </Text>
          <Text style={styles.recorderHint}>
            {library.isRecording
              ? 'Recording in the foreground'
              : library.isStarting
                ? 'Preparing microphone…'
                : library.isBusy
                ? 'Finalizing audio…'
                : 'Tap when you are ready'}
          </Text>
        </View>

        {library.permission.known && !library.permission.granted ? (
          <View style={styles.permissionCard}>
            <View style={styles.permissionCopy}>
              <Text style={styles.permissionTitle}>Microphone access needed</Text>
              <Text style={styles.permissionBody}>
                Moodi needs microphone permission to record your audio before transcription.
              </Text>
            </View>
            {!library.permission.canAskAgain ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => void library.openSettings()}
                style={({ pressed }) => [styles.settingsButton, pressed && styles.pressed]}>
                <Text style={styles.settingsButtonText}>Open Settings</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}

        {library.notice ? (
          <View accessibilityLiveRegion="polite" style={styles.notice}>
            <Text style={styles.noticeText}>✓ {library.notice}</Text>
          </View>
        ) : null}

        {library.error ? (
          <View accessibilityLiveRegion="assertive" style={styles.errorCard}>
            <Text style={styles.errorText}>{library.error}</Text>
          </View>
        ) : null}

        <View style={styles.libraryHeader}>
          <Text style={styles.sectionTitle}>Saved recordings</Text>
          <Text style={styles.count}>{library.recordings.length}</Text>
        </View>

        {library.isLoading ? (
          <ActivityIndicator color="#ef5b3f" style={styles.loading} />
        ) : library.recordings.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyBody}>Your recordings will appear here after they finish saving.</Text>
          </View>
        ) : (
          <View style={styles.list}>
            {library.recordings.map((recording) => {
              const isPlaying = library.playingId === recording.id;
              const actionsDisabled = library.isRecording || library.isBusy;
              const processingStatus = recording.processingStatus ?? 'local';
              const displayedTranscript = recording.transcriptTurns?.length
                ? recording.transcriptTurns
                    .map(
                      (turn) =>
                        `${turn.role === 'therapist' ? 'Therapist' : 'Client'}: "${turn.text}"`,
                    )
                    .join('\n')
                : recording.transcript;
              const isProcessing =
                processingStatus === 'uploading' || processingStatus === 'transcribing';
              const processingLabel =
                processingStatus === 'uploading'
                  ? 'Uploading…'
                  : processingStatus === 'transcribing'
                    ? 'Transcribing…'
                    : processingStatus === 'completed'
                      ? `Transcribed${recording.transcriptionLanguages?.length ? ` · ${recording.transcriptionLanguages.join(', ')}` : ''}`
                      : processingStatus === 'failed'
                        ? 'Processing failed'
                        : 'Not transcribed';

              return (
                <View key={recording.id} style={styles.recordingCard}>
                  <View style={styles.recordingRow}>
                    <Pressable
                      accessibilityLabel={isPlaying ? 'Stop playback' : 'Play recording'}
                      accessibilityRole="button"
                      disabled={actionsDisabled}
                      onPress={() => void library.togglePlayback(recording)}
                      style={({ pressed }) => [
                        styles.playButton,
                        isPlaying && styles.playButtonActive,
                        pressed && styles.pressed,
                        actionsDisabled && styles.disabled,
                      ]}>
                      <Text style={styles.playIcon}>{isPlaying ? '■' : '▶'}</Text>
                    </Pressable>

                    <View style={styles.recordingInfo}>
                      <Text style={styles.recordingDate}>{formatDate(recording.createdAt)}</Text>
                      <Text style={styles.recordingDuration}>
                        {formatDuration(recording.durationMs)}
                      </Text>
                    </View>

                    <View style={styles.rowActions}>
                      <Pressable
                        accessibilityLabel="Export recording"
                        accessibilityRole="button"
                        disabled={actionsDisabled}
                        onPress={() => void library.shareRecording(recording)}
                        style={({ pressed }) => [
                          styles.textButton,
                          pressed && styles.pressed,
                          actionsDisabled && styles.disabled,
                        ]}>
                        <Text style={styles.shareText}>Export</Text>
                      </Pressable>
                      <Pressable
                        accessibilityLabel="Delete recording"
                        accessibilityRole="button"
                        disabled={actionsDisabled}
                        onPress={() => confirmDelete(recording)}
                        style={({ pressed }) => [
                          styles.deleteButton,
                          pressed && styles.pressed,
                          actionsDisabled && styles.disabled,
                        ]}>
                        <Text style={styles.deleteText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>

                  <View style={styles.processingRow}>
                    {isProcessing ? (
                      <ActivityIndicator color={colors.accentDark} size="small" />
                    ) : null}
                    <Text
                      accessibilityLiveRegion="polite"
                      style={[
                        styles.processingLabel,
                        processingStatus === 'failed' && styles.processingLabelFailed,
                      ]}>
                      {processingLabel}
                    </Text>
                    {processingStatus === 'local' || processingStatus === 'failed' ? (
                      <Pressable
                        accessibilityLabel={
                          processingStatus === 'failed'
                            ? 'Retry transcription'
                            : 'Transcribe recording'
                        }
                        accessibilityRole="button"
                        disabled={actionsDisabled}
                        onPress={() => library.retryProcessing(recording)}
                        style={({ pressed }) => [
                          styles.retryButton,
                          pressed && styles.pressed,
                          actionsDisabled && styles.disabled,
                        ]}>
                        <Text style={styles.retryText}>
                          {processingStatus === 'failed' ? 'Retry' : 'Transcribe'}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>

                  {recording.processingError ? (
                    <Text style={styles.processingError}>{recording.processingError}</Text>
                  ) : null}

                  {displayedTranscript ? (
                    <View style={styles.transcript}>
                      <Text style={styles.transcriptLabel}>Transcript</Text>
                      <Text selectable style={styles.transcriptText}>
                        {displayedTranscript}
                      </Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const colors = {
  background: '#f8f4ec',
  card: '#fffdf8',
  ink: '#1e2421',
  muted: '#68716b',
  accent: '#ef5b3f',
  accentDark: '#ca3d28',
  line: '#e5ded2',
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 48, gap: 18 },
  header: { gap: 6 },
  eyebrow: { color: colors.accentDark, fontSize: 13, fontWeight: '800', letterSpacing: 2.4 },
  title: { color: colors.ink, fontSize: 34, fontWeight: '800', letterSpacing: -1.1 },
  subtitle: { color: colors.muted, fontSize: 16, lineHeight: 23 },
  recorderCard: {
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 28,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 26,
    shadowColor: '#3b3027',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
  },
  pulse: { borderColor: '#f8c9bd', borderRadius: 100, borderWidth: 10, padding: 7 },
  pulseActive: { borderColor: '#f2a896' },
  recordButton: {
    alignItems: 'center',
    backgroundColor: colors.accent,
    borderRadius: 84,
    height: 150,
    justifyContent: 'center',
    width: 150,
  },
  stopButton: { backgroundColor: colors.accentDark },
  recordIcon: { backgroundColor: '#fff', borderRadius: 10, height: 28, marginBottom: 8, width: 28 },
  stopIcon: { backgroundColor: '#fff', borderRadius: 4, height: 27, marginBottom: 8, width: 27 },
  recordButtonText: { color: '#fff', fontSize: 19, fontWeight: '800' },
  timer: {
    color: colors.ink,
    fontSize: 36,
    fontVariant: ['tabular-nums'],
    fontWeight: '700',
    letterSpacing: -0.7,
    marginTop: 18,
  },
  recorderHint: { color: colors.muted, fontSize: 14, marginTop: 3 },
  permissionCard: {
    alignItems: 'center',
    backgroundColor: '#fff2d9',
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    padding: 16,
  },
  permissionCopy: { flex: 1, gap: 3 },
  permissionTitle: { color: '#684a15', fontSize: 15, fontWeight: '800' },
  permissionBody: { color: '#725d36', fontSize: 13, lineHeight: 18 },
  settingsButton: { backgroundColor: '#684a15', borderRadius: 12, paddingHorizontal: 13, paddingVertical: 10 },
  settingsButtonText: { color: '#fff', fontSize: 13, fontWeight: '800' },
  notice: { backgroundColor: '#e6f4e9', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12 },
  noticeText: { color: '#23613a', fontSize: 14, fontWeight: '700' },
  errorCard: { backgroundColor: '#fde8e4', borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12 },
  errorText: { color: '#982e22', fontSize: 14, lineHeight: 19 },
  libraryHeader: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 5 },
  sectionTitle: { color: colors.ink, fontSize: 21, fontWeight: '800' },
  count: {
    backgroundColor: '#e8e2d8',
    borderRadius: 12,
    color: colors.muted,
    fontSize: 12,
    fontWeight: '800',
    minWidth: 24,
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
    textAlign: 'center',
  },
  loading: { marginVertical: 30 },
  emptyState: { alignItems: 'center', borderColor: colors.line, borderRadius: 18, borderStyle: 'dashed', borderWidth: 1, gap: 5, padding: 27 },
  emptyTitle: { color: colors.ink, fontSize: 16, fontWeight: '700' },
  emptyBody: { color: colors.muted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  list: { gap: 10 },
  recordingCard: {
    backgroundColor: colors.card,
    borderColor: colors.line,
    borderRadius: 18,
    borderWidth: 1,
    gap: 11,
    padding: 12,
  },
  recordingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  playButton: { alignItems: 'center', backgroundColor: '#efe9df', borderRadius: 22, height: 44, justifyContent: 'center', width: 44 },
  playButtonActive: { backgroundColor: colors.accent },
  playIcon: { color: colors.ink, fontSize: 16 },
  recordingInfo: { flex: 1, gap: 3 },
  recordingDate: { color: colors.ink, fontSize: 14, fontWeight: '700' },
  recordingDuration: { color: colors.muted, fontSize: 13, fontVariant: ['tabular-nums'] },
  rowActions: { alignItems: 'flex-end', gap: 3 },
  textButton: { paddingHorizontal: 6, paddingVertical: 5 },
  shareText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  deleteButton: { paddingHorizontal: 6, paddingVertical: 5 },
  deleteText: { color: '#8b8176', fontSize: 12, fontWeight: '700' },
  processingRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  processingLabel: { color: colors.muted, flex: 1, fontSize: 13, fontWeight: '700' },
  processingLabelFailed: { color: '#982e22' },
  retryButton: {
    backgroundColor: '#efe9df',
    borderRadius: 10,
    paddingHorizontal: 11,
    paddingVertical: 7,
  },
  retryText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  processingError: { color: '#982e22', fontSize: 12, lineHeight: 17 },
  transcript: { backgroundColor: '#f5f0e7', borderRadius: 12, gap: 4, padding: 12 },
  transcriptLabel: { color: colors.muted, fontSize: 12, fontWeight: '800' },
  transcriptText: { color: colors.ink, fontSize: 14, lineHeight: 21 },
  pressed: { opacity: 0.68 },
  disabled: { opacity: 0.45 },
});
