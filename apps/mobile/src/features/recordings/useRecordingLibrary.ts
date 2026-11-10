import {
  getRecordingPermissionsAsync,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
  type RecordingStatus,
} from 'expo-audio';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import * as Sharing from 'expo-sharing';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';

import {
  generateSessionInsights,
  saveSessionInsightsReview,
  transcribeRecording,
  uploadRecording,
} from './recordingApi';
import {
  deletePersistedRecording,
  getRecordingUri,
  loadRecordings,
  persistFinalizedRecording,
  type RecordingFailedStage,
  type RecordingMetadata,
  updatePersistedRecording,
} from './recordingStorage';
import type {
  SessionInsightsReviewRequest,
  SessionInsightsReviewResponse,
} from './sessionInsightsReviewTypes';

type Phase = 'idle' | 'starting' | 'recording' | 'stopping';
type StopReason = 'button' | 'background' | 'interruption';

type MicrophonePermission = {
  granted: boolean;
  canAskAgain: boolean;
  known: boolean;
};

const KEEP_AWAKE_TAG = 'moodi-recording';
const recordingOptions = {
  ...RecordingPresets.HIGH_QUALITY,
  directory: 'document' as const,
};

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function localDateFromIso(isoDate: string) {
  const date = new Date(isoDate);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(message)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

export function useRecordingLibrary() {
  const [phase, setPhase] = useState<Phase>('idle');
  const phaseRef = useRef<Phase>('idle');
  const [recordings, setRecordings] = useState<RecordingMetadata[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [permission, setPermission] = useState<MicrophonePermission>({
    granted: false,
    canAskAgain: true,
    known: false,
  });
  const [recordingEvent, setRecordingEvent] = useState<RecordingStatus | null>(null);

  const busyRef = useRef(false);
  const playbackBusyRef = useRef(false);
  const processingIdsRef = useRef(new Set<string>());
  const startCancelledRef = useRef(false);
  const startedAtRef = useRef<Date | null>(null);

  const recorder = useAudioRecorder(recordingOptions, setRecordingEvent);
  const recorderState = useAudioRecorderState(recorder, 100);
  const durationRef = useRef(0);
  const player = useAudioPlayer(null);
  const playerStatus = useAudioPlayerStatus(player);

  const updatePhase = useCallback((next: Phase) => {
    phaseRef.current = next;
    setPhase(next);
  }, []);

  useEffect(() => {
    durationRef.current = recorderState.durationMillis;
  }, [recorderState.durationMillis]);

  const refreshPermission = useCallback(async () => {
    const response = await getRecordingPermissionsAsync();
    setPermission({
      granted: response.granted,
      canAskAgain: response.canAskAgain,
      known: true,
    });
    return response;
  }, []);

  const resetAudioSession = useCallback(async () => {
    await Promise.allSettled([
      deactivateKeepAwake(KEEP_AWAKE_TAG),
      setAudioModeAsync({
        allowsRecording: false,
        allowsBackgroundRecording: false,
        interruptionMode: 'doNotMix',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      }),
    ]);
  }, []);

  const stopPlayback = useCallback(async () => {
    player.pause();
    try {
      await player.seekTo(0);
    } catch {
      // An unloaded player has no timeline to seek.
    }
    setPlayingId(null);
  }, [player]);

  const saveRecordingUpdate = useCallback(
    async (recording: RecordingMetadata, updates: Partial<RecordingMetadata>) => {
      const updated = { ...recording, ...updates };
      await updatePersistedRecording(updated);
      setRecordings((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
      return updated;
    },
    [],
  );

  const processRecording = useCallback(
    async (recording: RecordingMetadata) => {
      if (processingIdsRef.current.has(recording.id)) {
        return;
      }

      processingIdsRef.current.add(recording.id);
      let current = recording;
      let failedStage: RecordingFailedStage = current.backendRecordingId
        ? 'transcription'
        : 'upload';

      try {
        let backendRecordingId = current.backendRecordingId;
        if (!backendRecordingId) {
          current = await saveRecordingUpdate(current, {
            processingError: undefined,
            processingStatus: 'uploading',
          });
          const uploaded = await uploadRecording(getRecordingUri(current));
          backendRecordingId = uploaded.id;
        }

        failedStage = 'transcription';
        current = await saveRecordingUpdate(current, {
          backendRecordingId,
          failedStage: undefined,
          processingError: undefined,
          processingStatus: 'transcribing',
        });

        const transcription = await transcribeRecording(backendRecordingId);
        current = await saveRecordingUpdate(current, {
          processingError: undefined,
          processingStatus: 'ready_for_insights',
          transcript: transcription.text,
          transcriptTurns: transcription.turns,
          transcriptionLanguages: transcription.languages.map((language) => language.code),
        });

        failedStage = 'insights';
        current = await saveRecordingUpdate(current, {
          failedStage: undefined,
          processingError: undefined,
          processingStatus: 'generating_insights',
        });
        const insights = await generateSessionInsights(
          backendRecordingId,
          current.sessionDate ?? localDateFromIso(current.createdAt),
        );
        await saveRecordingUpdate(current, {
          failedStage: undefined,
          processingError: undefined,
          processingStatus: 'completed',
          sessionInsights: insights,
          sessionInsightsReview:
            current.sessionInsightsReview?.draft_id === insights.draft_id
              ? current.sessionInsightsReview
              : undefined,
        });
      } catch (processingError) {
        try {
          await saveRecordingUpdate(current, {
            processingError: messageFrom(processingError, 'The recording could not be processed.'),
            processingStatus: 'failed',
            failedStage,
          });
        } catch {
          // The recording may have been deleted while its network request was in flight.
        }
      } finally {
        processingIdsRef.current.delete(recording.id);
      }
    },
    [saveRecordingUpdate],
  );

  const finishRecording = useCallback(
    async (reason: StopReason, eventUri?: string | null) => {
      if (busyRef.current || phaseRef.current !== 'recording') {
        return;
      }

      busyRef.current = true;
      updatePhase('stopping');
      const statusBeforeStop = recorder.getStatus();
      const durationMs = Math.max(statusBeforeStop.durationMillis, durationRef.current);

      try {
        if (statusBeforeStop.isRecording) {
          await recorder.stop();
        }

        const sourceUri = recorder.uri ?? eventUri;
        if (!sourceUri) {
          throw new Error('The recorder stopped without returning an audio file.');
        }

        const recording = await persistFinalizedRecording({
          sourceUri,
          createdAt: startedAtRef.current ?? new Date(),
          durationMs,
        });
        setRecordings((current) => [recording, ...current.filter((item) => item.id !== recording.id)]);
        setNotice(
          reason === 'background'
            ? 'Saved after Moodi left the foreground.'
            : reason === 'interruption'
              ? 'Saved after an audio interruption.'
              : 'Saved. Generate insights when you are ready.',
        );
        setError(null);
      } catch (finishError) {
        setNotice(null);
        setError(messageFrom(finishError, 'The recording could not be finalized.'));
      } finally {
        startedAtRef.current = null;
        await resetAudioSession();
        busyRef.current = false;
        updatePhase('idle');
      }
    },
    [recorder, resetAudioSession, updatePhase],
  );

  const startRecording = useCallback(async () => {
    if (
      busyRef.current ||
      playbackBusyRef.current ||
      phaseRef.current !== 'idle' ||
      AppState.currentState !== 'active'
    ) {
      return;
    }

    busyRef.current = true;
    startCancelledRef.current = false;
    updatePhase('starting');
    setError(null);
    setNotice(null);

    try {
      await stopPlayback();
      let microphonePermission = await getRecordingPermissionsAsync();
      if (!microphonePermission.granted && microphonePermission.canAskAgain) {
        microphonePermission = await requestRecordingPermissionsAsync();
      }

      setPermission({
        granted: microphonePermission.granted,
        canAskAgain: microphonePermission.canAskAgain,
        known: true,
      });

      if (!microphonePermission.granted) {
        updatePhase('idle');
        return;
      }

      if (startCancelledRef.current || AppState.currentState !== 'active') {
        throw new Error('Recording was cancelled because Moodi left the foreground.');
      }

      await setAudioModeAsync({
        allowsRecording: true,
        allowsBackgroundRecording: false,
        interruptionMode: 'doNotMix',
        playsInSilentMode: true,
        shouldPlayInBackground: false,
        shouldRouteThroughEarpiece: false,
      });
      await activateKeepAwakeAsync(KEEP_AWAKE_TAG);

      const startedAt = new Date();
      await withTimeout(
        recorder.prepareToRecordAsync({
          ...recordingOptions,
          fileName: `moodi-${startedAt.toISOString().replace(/[:.]/g, '-')}`,
        }),
        15_000,
        'The microphone did not become ready. Check the active audio input and try again.',
      );

      if (startCancelledRef.current || AppState.currentState !== 'active') {
        throw new Error('Recording was cancelled because Moodi left the foreground.');
      }

      startedAtRef.current = startedAt;
      recorder.record();
      updatePhase('recording');
    } catch (startError) {
      if (recorder.isRecording) {
        await recorder.stop().catch(() => undefined);
      }
      startedAtRef.current = null;
      setError(messageFrom(startError, 'Recording could not start.'));
      await resetAudioSession();
      updatePhase('idle');
    } finally {
      busyRef.current = false;
    }
  }, [recorder, resetAudioSession, stopPlayback, updatePhase]);

  const toggleRecording = useCallback(() => {
    if (phaseRef.current === 'recording') {
      void finishRecording('button');
      return;
    }
    if (phaseRef.current === 'idle') {
      void startRecording();
    }
  }, [finishRecording, startRecording]);

  const togglePlayback = useCallback(
    async (recording: RecordingMetadata) => {
      if (phaseRef.current !== 'idle' || busyRef.current || playbackBusyRef.current) {
        return;
      }

      playbackBusyRef.current = true;
      try {
        setError(null);
        if (playingId === recording.id && playerStatus.playing) {
          await stopPlayback();
          return;
        }

        await stopPlayback();
        await setAudioModeAsync({
          allowsRecording: false,
          allowsBackgroundRecording: false,
          interruptionMode: 'doNotMix',
          playsInSilentMode: true,
          shouldPlayInBackground: false,
          shouldRouteThroughEarpiece: false,
        });
        player.replace({ uri: getRecordingUri(recording), name: 'Moodi recording' });
        setPlayingId(recording.id);
        player.play();
      } catch (playbackError) {
        setError(messageFrom(playbackError, 'The recording could not be played.'));
        await stopPlayback();
      } finally {
        playbackBusyRef.current = false;
      }
    },
    [player, playerStatus.playing, playingId, stopPlayback],
  );

  const shareRecording = useCallback(async (recording: RecordingMetadata) => {
    try {
      if (!(await Sharing.isAvailableAsync())) {
        throw new Error('Sharing is not available on this device.');
      }
      await Sharing.shareAsync(getRecordingUri(recording), {
        dialogTitle: 'Export Moodi recording',
        mimeType: 'audio/mp4',
        UTI: 'public.mpeg-4-audio',
      });
    } catch (shareError) {
      setError(messageFrom(shareError, 'The recording could not be exported.'));
    }
  }, []);

  const deleteRecording = useCallback(
    async (recording: RecordingMetadata) => {
      try {
        if (playingId === recording.id) {
          await stopPlayback();
        }
        await deletePersistedRecording(recording);
        setRecordings((current) => current.filter((item) => item.id !== recording.id));
        setNotice('Recording deleted');
        setError(null);
      } catch (deleteError) {
        setError(messageFrom(deleteError, 'The recording could not be deleted.'));
      }
    },
    [playingId, stopPlayback],
  );

  const generateInsights = useCallback(
    (recording: RecordingMetadata) => {
      void processRecording(recording);
    },
    [processRecording],
  );

  const saveInsightsReview = useCallback(
    async (
      recording: RecordingMetadata,
      reviewRequest: SessionInsightsReviewRequest,
    ): Promise<SessionInsightsReviewResponse> => {
      if (!recording.backendRecordingId) {
        throw new Error('Generate session insights before reviewing them.');
      }

      try {
        setError(null);
        setNotice(null);
        const review = await saveSessionInsightsReview(
          recording.backendRecordingId,
          reviewRequest,
        );
        await saveRecordingUpdate(recording, { sessionInsightsReview: review });
        setNotice('Reviewed insights saved.');
        return review;
      } catch (reviewError) {
        setError(messageFrom(reviewError, 'Reviewed session insights could not be saved.'));
        throw reviewError;
      }
    },
    [saveRecordingUpdate],
  );

  useEffect(() => {
    let active = true;
    Promise.all([loadRecordings(), getRecordingPermissionsAsync()])
      .then(async ([savedRecordings, microphonePermission]) => {
        const recoveredRecordings: RecordingMetadata[] = [];
        for (const recording of savedRecordings) {
          if (
            recording.processingStatus === 'uploading' ||
            recording.processingStatus === 'transcribing' ||
            recording.processingStatus === 'generating_insights'
          ) {
            recoveredRecordings.push(
              await updatePersistedRecording({
                ...recording,
                failedStage:
                  recording.processingStatus === 'uploading'
                    ? 'upload'
                    : recording.processingStatus === 'generating_insights'
                      ? 'insights'
                      : 'transcription',
                processingError: 'Processing was interrupted. Tap Retry to continue.',
                processingStatus: 'failed',
              }),
            );
          } else {
            recoveredRecordings.push(recording);
          }
        }

        if (active) {
          setRecordings(recoveredRecordings);
          setPermission({
            granted: microphonePermission.granted,
            canAskAgain: microphonePermission.canAskAgain,
            known: true,
          });
        }
      })
      .catch((loadError) => {
        if (active) {
          setError(messageFrom(loadError, 'Saved recordings could not be loaded.'));
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [refreshPermission]);

  useEffect(() => {
    if (!recordingEvent || phaseRef.current !== 'recording' || busyRef.current) {
      return;
    }

    if (recordingEvent.hasError || recordingEvent.mediaServicesDidReset) {
      void finishRecording('interruption', recordingEvent.url);
    } else if (recordingEvent.isFinished) {
      void finishRecording('interruption', recordingEvent.url);
    }
  }, [finishRecording, recordingEvent]);

  useEffect(() => {
    if (!playingId || (!playerStatus.didJustFinish && !playerStatus.error)) {
      return;
    }

    const timeout = setTimeout(() => {
      if (playerStatus.error) {
        setError(playerStatus.error);
      }
      void stopPlayback();
    }, 0);

    return () => clearTimeout(timeout);
  }, [playerStatus.didJustFinish, playerStatus.error, playingId, stopPlayback]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        void refreshPermission();
        return;
      }

      void stopPlayback();
      if (phaseRef.current === 'starting') {
        startCancelledRef.current = true;
      } else if (phaseRef.current === 'recording') {
        void finishRecording('background');
      }
    });

    return () => subscription.remove();
  }, [finishRecording, refreshPermission, stopPlayback]);

  useEffect(
    () => () => {
      void deactivateKeepAwake(KEEP_AWAKE_TAG);
      player.pause();
      if (recorder.isRecording) {
        void recorder.stop();
      }
    },
    [player, recorder],
  );

  return {
    deleteRecording,
    durationMs: recorderState.durationMillis,
    error,
    isBusy: phase === 'starting' || phase === 'stopping',
    isLoading,
    isRecording: phase === 'recording',
    isStarting: phase === 'starting',
    notice,
    openSettings: Linking.openSettings,
    permission,
    playingId: playerStatus.playing ? playingId : null,
    recordings,
    generateInsights,
    saveInsightsReview,
    shareRecording,
    togglePlayback,
    toggleRecording,
  };
}
