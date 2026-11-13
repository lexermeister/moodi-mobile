import {
  isRatingAction,
  isRatingCandidateResolution,
  isRatingEntry,
  type RatingAction,
  type RatingCandidateResolution,
  type RatingCandidateReviewResult,
  type RatingEntry,
  type RatingEntryValues,
  type RecordRatingActionSettings,
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

export async function listRatingActions(recordingId?: string): Promise<RatingAction[]> {
  const query = recordingId ? `?recording_id=${encodeURIComponent(recordingId)}` : '';
  const payload = await requestJson(`/actions${query}`);
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { actions?: unknown }).actions) ||
    !(payload as { actions: unknown[] }).actions.every(isRatingAction)
  ) {
    throw new ActionsApiError('The Moodi backend returned invalid Actions.');
  }
  return (payload as { actions: RatingAction[] }).actions;
}

export async function getRatingAction(actionId: string): Promise<RatingAction> {
  const payload = await requestJson(`/actions/${encodeURIComponent(actionId)}`);
  if (!isRatingAction(payload)) {
    throw new ActionsApiError('The Moodi backend returned an invalid Action.');
  }
  return payload;
}

export async function deleteRatingAction(actionId: string): Promise<void> {
  try {
    await requestJson(`/actions/${encodeURIComponent(actionId)}`, { method: 'DELETE' });
  } catch (error) {
    if (error instanceof ActionsApiError && error.status === 404) return;
    throw error;
  }
}

export async function reviewRatingCandidate({
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
  settings: RecordRatingActionSettings | null;
}): Promise<RatingCandidateReviewResult> {
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
    (action !== null && !isRatingAction(action))
  ) {
    throw new ActionsApiError('The Moodi backend returned an invalid Action.');
  }
  return {
    disposition: responseDisposition,
    action: action as RatingAction | null,
  };
}

export async function getRatingCandidateResolution(
  recordingId: string,
  candidateId: string,
): Promise<RatingCandidateResolution> {
  const payload = await requestJson(
    `/recordings/${encodeURIComponent(recordingId)}/action-candidates/${encodeURIComponent(candidateId)}/resolution`,
  );
  if (!isRatingCandidateResolution(payload)) {
    throw new ActionsApiError('The Moodi backend returned an invalid Action resolution.');
  }
  return payload;
}

export async function getRatingCandidateReview(
  recordingId: string,
  candidateId: string,
): Promise<RatingCandidateReviewResult | null> {
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
    (action !== null && !isRatingAction(action))
  ) {
    throw new ActionsApiError('The Moodi backend returned an invalid Action review.');
  }
  return {
    disposition: disposition as RatingCandidateReviewResult['disposition'],
    action: action as RatingAction | null,
  };
}

export async function listRatingEntries(actionId: string): Promise<RatingEntry[]> {
  const payload = await requestJson(`/actions/${actionId}/entries`);
  if (
    !payload ||
    typeof payload !== 'object' ||
    !Array.isArray((payload as { entries?: unknown }).entries) ||
    !(payload as { entries: unknown[] }).entries.every(isRatingEntry)
  ) {
    throw new ActionsApiError('The Moodi backend returned invalid rating entries.');
  }
  return (payload as { entries: RatingEntry[] }).entries;
}

function requireRatingEntry(value: unknown): RatingEntry {
  if (!isRatingEntry(value)) {
    throw new ActionsApiError('The Moodi backend returned an invalid rating entry.');
  }
  return value;
}

export async function saveRatingEntryDraft({
  actionId,
  entryId,
  values,
  expectedRevision,
}: {
  actionId: string;
  entryId: string;
  values: RatingEntryValues;
  expectedRevision: number | null;
}): Promise<RatingEntry> {
  return requireRatingEntry(
    await requestJson(`/actions/${actionId}/entries/${entryId}/draft`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, expected_revision: expectedRevision }),
    }),
  );
}

export async function confirmRatingEntry({
  actionId,
  entryId,
  values,
  expectedRevision,
}: {
  actionId: string;
  entryId: string;
  values: RatingEntryValues;
  expectedRevision: number | null;
}): Promise<RatingEntry> {
  return requireRatingEntry(
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

export async function amendRatingEntry({
  actionId,
  entryId,
  values,
  expectedRevision,
}: {
  actionId: string;
  entryId: string;
  values: RatingEntryValues;
  expectedRevision: number;
}): Promise<RatingEntry> {
  return requireRatingEntry(
    await requestJson(`/actions/${actionId}/entries/${entryId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values, expected_revision: expectedRevision }),
    }),
  );
}

export async function deleteRatingEntry(actionId: string, entryId: string): Promise<void> {
  await requestJson(
    `/actions/${encodeURIComponent(actionId)}/entries/${encodeURIComponent(entryId)}`,
    { method: 'DELETE' },
  );
}

export async function exportRatingEntries(actionId: string, entryIds: string[]): Promise<unknown> {
  return requestJson(`/actions/${actionId}/entries/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ entry_ids: entryIds }),
  });
}
