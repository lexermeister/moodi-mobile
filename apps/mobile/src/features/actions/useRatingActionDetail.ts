import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  amendRatingEntry,
  confirmRatingEntry,
  deleteRatingAction,
  deleteRatingEntry,
  exportRatingEntries,
  getRatingAction,
  listRatingEntries,
  saveRatingEntryDraft,
} from './actionsApi';
import type { RatingAction, RatingEntry, RatingEntryValues } from './actionTypes';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function upsertEntry(entries: RatingEntry[], saved: RatingEntry) {
  const next = entries.filter((entry) => entry.id !== saved.id);
  next.push(saved);
  return next.sort((left, right) =>
    left.values.entry_time.localeCompare(right.values.entry_time),
  );
}

export function useRatingActionDetail(actionId?: string) {
  const [action, setAction] = useState<RatingAction | null>(null);
  const [entries, setEntries] = useState<RatingEntry[]>([]);
  const [loading, setLoading] = useState(Boolean(actionId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!actionId) return;
    setLoading(true);
    setError(null);
    try {
      const [loadedAction, loadedEntries] = await Promise.all([
        getRatingAction(actionId),
        listRatingEntries(actionId),
      ]);
      setAction(loadedAction);
      setEntries(loadedEntries);
    } catch (loadError) {
      setError(messageFrom(loadError, 'The rating check-in could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }, [actionId]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const saveDraft = useCallback(
    async (
      entryId: string,
      values: RatingEntryValues,
      expectedRevision: number | null,
    ) => {
      if (!actionId) return null;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const saved = await saveRatingEntryDraft({
          actionId,
          entryId,
          values,
          expectedRevision,
        });
        setEntries((current) => upsertEntry(current, saved));
        setNotice('Draft saved.');
        return saved;
      } catch (saveError) {
        setError(messageFrom(saveError, 'The draft could not be saved. Your input is still here.'));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [actionId],
  );

  const saveConfirmed = useCallback(
    async (
      entryId: string,
      values: RatingEntryValues,
      expectedRevision: number | null,
      editingConfirmed: boolean,
    ) => {
      if (!actionId) return null;
      if (editingConfirmed && expectedRevision === null) {
        setError('This saved entry needs to be reloaded before it can be changed.');
        return null;
      }
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        let saved: RatingEntry;
        if (editingConfirmed) {
          saved = await amendRatingEntry({
            actionId,
            entryId,
            values,
            expectedRevision: expectedRevision as number,
          });
        } else {
          saved = await confirmRatingEntry({
            actionId,
            entryId,
            values,
            expectedRevision,
          });
        }
        setEntries((current) => upsertEntry(current, saved));
        setNotice(editingConfirmed ? 'Rating entry updated.' : 'Rating saved.');
        return saved;
      } catch (saveError) {
        setError(
          messageFrom(saveError, 'The rating entry could not be saved. Your input is still here.'),
        );
        return null;
      } finally {
        setBusy(false);
      }
    },
    [actionId],
  );

  const removeEntry = useCallback(
    async (entryId: string) => {
      if (!actionId) return false;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        await deleteRatingEntry(actionId, entryId);
        setEntries((current) => current.filter((entry) => entry.id !== entryId));
        setNotice('Rating entry deleted.');
        return true;
      } catch (deleteError) {
        setError(messageFrom(deleteError, 'The rating entry could not be deleted.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [actionId],
  );

  const removeAction = useCallback(async () => {
    if (!actionId) return false;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await deleteRatingAction(actionId);
      setAction(null);
      setEntries([]);
      return true;
    } catch (deleteError) {
      setError(messageFrom(deleteError, 'The Action could not be deleted.'));
      return false;
    } finally {
      setBusy(false);
    }
  }, [actionId]);

  const prepareExport = useCallback(
    async (entryIds: string[]) => {
      if (!actionId) return null;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        return await exportRatingEntries(actionId, entryIds);
      } catch (exportError) {
        setError(messageFrom(exportError, 'The selected entries could not be exported.'));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [actionId],
  );

  return {
    action,
    busy,
    entries,
    error,
    loading,
    notice,
    prepareExport,
    reload: load,
    removeAction,
    removeEntry,
    saveConfirmed,
    saveDraft,
  };
}
