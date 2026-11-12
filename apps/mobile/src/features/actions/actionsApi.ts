import {
  isMoodAction,
  isMoodCandidateResolution,
  isMoodEntry,
  type MoodAction,
  type MoodCandidateResolution,
  type MoodCandidateReviewResult,
  type MoodEntry,
  type MoodEntryValues,
  type RecordMoodActionSettings,
} from './actionTypes';

class ActionsApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'ActionsApiError';
  }
}

function getApiUrl() {
  const value = process.env.EXPO_PUBLIC_API_URL?.trim().replace(/\/+$/, '');
  if (!value) {
    throw new ActionsApiError(
      'The Moodi backend is not configured. Set EXPO_PUBLIC_API_URL and reload the app.',
    );
  }
  return value;
}

function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    throw new ActionsApiError('The Moodi backend returned an invalid response.');
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

async function requestJson(path: string, init?: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${getApiUrl()}${path}`, init);
  } catch {
    throw new ActionsApiError('Could not reach the Moodi backend.');
  }
  const body = await response.text();
  if (!response.ok) {
    throw new ActionsApiError(errorMessage(body, 'The Action request failed.'), response.status);
  }
  return body ? parseJson(body) : null;
}

export async function listMoodActions(recordingId?: string): Promise<MoodAction[]> {
  const query = recordingId ? `?recording_id=${encodeURIComponent(recordingId)}` : '';
  const payload = await requestJson(`/actions${query}`);
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { actions?: unknown }).actions) ||
    !(payload as { actions: unknown[] }).actions.every(isMoodAction)
  ) {
    throw new ActionsApiError('The Moodi backend returned invalid Actions.');
  }
  return (payload as { actions: MoodAction[] }).actions;
}

export async function getMoodAction(actionId: string): Promise<MoodAction> {
  const payload = await requestJson(`/actions/${encodeURIComponent(actionId)}`);
  if (!isMoodAction(payload)) {
    throw new ActionsApiError('The Moodi backend returned an invalid Action.');
  }
  return payload;
}

export async function deleteMoodAction(actionId: string): Promise<void> {
  try {
    await requestJson(`/actions/${encodeURIComponent(actionId)}`, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof ActionsApiError && error.status === 404) return;
    throw error;
  }
}

export async function reviewMoodCandidate({
  recordingId,
  candidateId,
  draftId,
  sourceVersion,
  disposition,
  settings,
}: {
  recordingId: string;
  candidateId: string;
  draftId: string;
  sourceVersion: string;
  disposition: 'activate' | 'reject';
  settings: RecordMoodActionSettings | null;
}): Promise<MoodCandidateReviewResult> {
  const payload = await requestJson(
    `/recordings/${recordingId}/action-candidates/${candidateId}/review`,
    {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_id: draftId,
        source_version: sourceVersion,
        disposition,
        settings,
      }),
    },
  );
  if (!payload || typeof payload !== 'object') {
    throw new ActionsApiError('The Moodi backend returned an invalid Action review.');
  }
  const responseDisposition = (payload as { disposition?: unknown }).disposition;
  const action = (payload as { action?: unknown }).action;
  if (
    (responseDisposition !== 'activated' &&
      responseDisposition !== 'linked_existing' &&
      responseDisposition !== 'rejected') ||
    (action !== null && !isMoodAction(action))
  ) {
    throw new ActionsApiError('The Moodi backend returned an invalid Action.');
  }
  return {
    disposition: responseDisposition,
    action: action as MoodAction | null,
  };
}

export async function getMoodCandidateResolution(
  recordingId: string,
  candidateId: string,
): Promise<MoodCandidateResolution> {
  const payload = await requestJson(
    `/recordings/${encodeURIComponent(recordingId)}/action-candidates/${encodeURIComponent(candidateId)}/resolution`,
  );
  if (!isMoodCandidateResolution(payload)) {
    throw new ActionsApiError('The Moodi backend returned an invalid Action resolution.');
  }
  return payload;
}

export async function getMoodCandidateReview(
  recordingId: string,
  candidateId: string,
): Promise<MoodCandidateReviewResult | null> {
  let payload: unknown;
  try {
    payload = await requestJson(
      `/recordings/${recordingId}/action-candidates/${candidateId}/review`,
    );
  } catch (error) {
    if (error instanceof ActionsApiError && error.status === 404) return null;
    throw error;
  }
  if (!payload || typeof payload !== 'object') {
    throw new ActionsApiError('The Moodi backend returned an invalid Action review.');
  }
  const disposition = (payload as { disposition?: unknown }).disposition;
  const action = (payload as { action?: unknown }).action;
  if (
    (disposition !== 'activated' &&
      disposition !== 'linked_existing' &&
      disposition !== 'rejected') ||
    (action !== null && !isMoodAction(action))
  ) {
    throw new ActionsApiError('The Moodi backend returned an invalid Action review.');
  }
  return {
    disposition: disposition as MoodCandidateReviewResult['disposition'],
    action: action as MoodAction | null,
  };
}

export async function listMoodEntries(actionId: string): Promise<MoodEntry[]> {
  const payload = await requestJson(`/actions/${actionId}/entries`);
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { entries?: unknown }).entries) ||
    !(payload as { entries: unknown[] }).entries.every(isMoodEntry)
  ) {
    throw new ActionsApiError('The Moodi backend returned invalid mood entries.');
  }
  return (payload as { entries: MoodEntry[] }).entries;
}

function requireMoodEntry(value: unknown): MoodEntry {
  if (!isMoodEntry(value)) {
    throw new ActionsApiError('The Moodi backend returned an invalid mood entry.');
  }
  return value;
}

export async function saveMoodEntryDraft({
  actionId,
  entryId,
  values,
  expectedRevision,
}: {
  actionId: string;
  entryId: string;
  values: MoodEntryValues;
  expectedRevision: number | null;
}): Promise<MoodEntry> {
  return requireMoodEntry(
    await requestJson(`/actions/${actionId}/entries/${entryId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, expected_revision: expectedRevision }),
    }),
  );
}

export async function confirmMoodEntry({
  actionId,
  entryId,
  values,
  expectedRevision,
}: {
  actionId: string;
  entryId: string;
  values: MoodEntryValues;
  expectedRevision: number | null;
}): Promise<MoodEntry> {
  return requireMoodEntry(
    await requestJson(`/actions/${actionId}/entries/${entryId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        values,
        expected_revision: expectedRevision,
        idempotency_key: `confirm-${entryId}`,
      }),
    }),
  );
}

export async function amendMoodEntry({
  actionId,
  entryId,
  values,
  expectedRevision,
}: {
  actionId: string;
  entryId: string;
  values: MoodEntryValues;
  expectedRevision: number;
}): Promise<MoodEntry> {
  return requireMoodEntry(
    await requestJson(`/actions/${actionId}/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, expected_revision: expectedRevision }),
    }),
  );
}

export async function deleteMoodEntry(actionId: string, entryId: string): Promise<void> {
  await requestJson(
    `/actions/${encodeURIComponent(actionId)}/entries/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' },
  );
}

export async function exportMoodEntries(actionId: string, entryIds: string[]): Promise<unknown> {
  return requestJson(`/actions/${actionId}/entries/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_ids: entryIds }),
  });
}
