import { File, UploadType } from 'expo-file-system';

import {
  isSessionInsightsResponse,
  type SessionInsightsResponse,
} from './sessionInsightsTypes';
import { isTranscriptTurn, type TranscriptTurn } from './transcriptionTypes';

const UPLOAD_TIMEOUT_MS = 120_000;
const TRANSCRIPTION_TIMEOUT_MS = 300_000;
const INSIGHTS_TIMEOUT_MS = 180_000;

type UploadRecordingResponse = {
  id: string;
  filename: string;
  size_bytes: number;
  status: 'saved';
};

export type TranscriptionResponse = {
  recording_id: string;
  text: string;
  turns: TranscriptTurn[];
  languages: { code: string }[];
  model: string;
  role_model: string | null;
  role_prompt_version: string | null;
  status: 'completed';
  completed_at: string;
};

class MoodiApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'MoodiApiError';
  }
}

function getApiUrl() {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!value) {
    throw new MoodiApiError(
      'The Moodi backend is not configured. Set EXPO_PUBLIC_API_URL and reload the app.',
    );
  }
  return value;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new MoodiApiError('The Moodi backend returned an invalid response.');
  }
}

function errorMessage(body: string, fallback: string) {
  try {
    const payload = JSON.parse(body) as { detail?: unknown };
    return typeof payload.detail === 'string' ? payload.detail : fallback;
  } catch {
    return fallback;
  }
}

function isUploadResponse(value: unknown): value is UploadRecordingResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const response = value as Partial<UploadRecordingResponse>;
  return (
    typeof response.id === 'string' &&
    typeof response.filename === 'string' &&
    typeof response.size_bytes === 'number' &&
    response.status === 'saved'
  );
}

function isTranscriptionResponse(value: unknown): value is TranscriptionResponse {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const response = value as Partial<TranscriptionResponse>;
  return (
    typeof response.recording_id === 'string' &&
    typeof response.text === 'string' &&
    Array.isArray(response.turns) &&
    response.turns.every(isTranscriptTurn) &&
    Array.isArray(response.languages) &&
    response.languages.every(
      (language) =>
        Boolean(language) &&
        typeof language === 'object' &&
        typeof (language as { code?: unknown }).code === 'string',
    ) &&
    typeof response.model === 'string' &&
    (response.role_model === null || typeof response.role_model === 'string') &&
    (response.role_prompt_version === null ||
      typeof response.role_prompt_version === 'string') &&
    response.status === 'completed' &&
    typeof response.completed_at === 'string'
  );
}

export async function uploadRecording(uri: string): Promise<UploadRecordingResponse> {
  const file = new File(uri);
  if (!file.exists || file.size <= 0) {
    throw new MoodiApiError('The local recording is missing or empty.');
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPLOAD_TIMEOUT_MS);

  try {
    const result = await file.upload(`${getApiUrl()}/recordings`, {
      fieldName: 'file',
      httpMethod: 'POST',
      mimeType: 'audio/mp4',
      sessionType: 'foreground',
      signal: controller.signal,
      uploadType: UploadType.MULTIPART,
    });

    if (result.status < 200 || result.status >= 300) {
      throw new MoodiApiError(
        errorMessage(result.body, 'The recording could not be uploaded.'),
        result.status,
      );
    }

    const payload = parseJson(result.body);
    if (!isUploadResponse(payload)) {
      throw new MoodiApiError('The Moodi backend returned an invalid upload response.');
    }
    return payload;
  } catch (error) {
    if (error instanceof MoodiApiError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new MoodiApiError('The recording upload timed out.');
    }
    throw new MoodiApiError('Could not reach the Moodi backend.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function transcribeRecording(recordingId: string): Promise<TranscriptionResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TRANSCRIPTION_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiUrl()}/recordings/${recordingId}/transcription`, {
      method: 'POST',
      signal: controller.signal,
    });
    const body = await response.text();

    if (!response.ok) {
      throw new MoodiApiError(
        errorMessage(body, 'The recording could not be transcribed.'),
        response.status,
      );
    }

    const payload = parseJson(body);
    if (!isTranscriptionResponse(payload)) {
      throw new MoodiApiError('The Moodi backend returned an invalid transcription response.');
    }
    return payload;
  } catch (error) {
    if (error instanceof MoodiApiError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new MoodiApiError('The transcription request timed out.');
    }
    throw new MoodiApiError('Could not reach the Moodi backend.');
  } finally {
    clearTimeout(timeout);
  }
}

export async function generateSessionInsights(
  recordingId: string,
  sessionDate: string,
): Promise<SessionInsightsResponse> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), INSIGHTS_TIMEOUT_MS);

  try {
    const response = await fetch(`${getApiUrl()}/recordings/${recordingId}/insights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_date: sessionDate }),
      signal: controller.signal,
    });
    const body = await response.text();

    if (!response.ok) {
      throw new MoodiApiError(
        errorMessage(body, 'Session insights could not be generated.'),
        response.status,
      );
    }

    const payload = parseJson(body);
    if (!isSessionInsightsResponse(payload)) {
      throw new MoodiApiError('The Moodi backend returned an invalid session insights response.');
    }
    return payload;
  } catch (error) {
    if (error instanceof MoodiApiError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new MoodiApiError('The session insights request timed out.');
    }
    throw new MoodiApiError('Could not reach the Moodi backend.');
  } finally {
    clearTimeout(timeout);
  }
}
