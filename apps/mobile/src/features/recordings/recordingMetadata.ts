import {
  type SessionInsightsResponse,
} from './sessionInsightsTypes';
import {
  isSessionInsightsReviewResponse,
  type SessionInsightsReviewResponse,
} from './sessionInsightsReviewTypes';
import { isTranscriptTurn, type TranscriptTurn } from './transcriptionTypes';

export type RecordingMetadata = {
  id: string;
  fileName: string;
  createdAt: string;
  sessionDate?: string;
  durationMs: number;
  sizeBytes: number;
  backendRecordingId?: string;
  processingStatus?: RecordingProcessingStatus;
  processingError?: string;
  transcript?: string;
  transcriptTurns?: TranscriptTurn[];
  transcriptionLanguages?: string[];
  sessionInsights?: SessionInsightsResponse;
  sessionInsightsReview?: SessionInsightsReviewResponse;
  failedStage?: RecordingFailedStage;
};

type StoredRecordingMetadata = Omit<RecordingMetadata, 'sessionInsights'> & {
  sessionInsights?: unknown;
};

export type RecordingFailedStage = 'upload' | 'transcription' | 'insights';

export type RecordingProcessingStatus =
  | 'local'
  | 'uploading'
  | 'transcribing'
  | 'ready_for_insights'
  | 'generating_insights'
  | 'completed'
  | 'failed';

export function isRecordingMetadata(value: unknown, extensions: readonly string[] = ['.m4a']): value is StoredRecordingMetadata {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const item = value as Partial<RecordingMetadata>;
  const processingStatuses: RecordingProcessingStatus[] = [
    'local',
    'uploading',
    'transcribing',
    'ready_for_insights',
    'generating_insights',
    'completed',
    'failed',
  ];

  return (
    typeof item.id === 'string' &&
    typeof item.fileName === 'string' &&
    extensions.some(extension => item.fileName!.endsWith(extension)) &&
    typeof item.createdAt === 'string' &&
    Number.isFinite(Date.parse(item.createdAt)) &&
    (item.sessionDate === undefined || /^\d{4}-\d{2}-\d{2}$/.test(item.sessionDate)) &&
    typeof item.durationMs === 'number' &&
    item.durationMs >= 0 &&
    typeof item.sizeBytes === 'number' &&
    item.sizeBytes > 0 &&
    (item.backendRecordingId === undefined || typeof item.backendRecordingId === 'string') &&
    (item.processingStatus === undefined || processingStatuses.includes(item.processingStatus)) &&
    (item.processingError === undefined || typeof item.processingError === 'string') &&
    (item.transcript === undefined || typeof item.transcript === 'string') &&
    (item.transcriptTurns === undefined ||
      (Array.isArray(item.transcriptTurns) && item.transcriptTurns.every(isTranscriptTurn))) &&
    (item.transcriptionLanguages === undefined ||
      (Array.isArray(item.transcriptionLanguages) &&
        item.transcriptionLanguages.every((language) => typeof language === 'string'))) &&
    (item.sessionInsights === undefined || typeof item.sessionInsights === 'object') &&
    (item.sessionInsightsReview === undefined ||
      isSessionInsightsReviewResponse(item.sessionInsightsReview)) &&
    (item.failedStage === undefined ||
      ['upload', 'transcription', 'insights'].includes(item.failedStage))
  );
}
