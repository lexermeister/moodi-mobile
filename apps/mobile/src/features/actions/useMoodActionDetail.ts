import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import {
  amendMoodEntry,
  confirmMoodEntry,
  deleteMoodEntry,
  exportMoodEntries,
  getMoodAction,
  listMoodEntries,
  saveMoodEntryDraft,
} from './actionsApi';
import type { MoodAction, MoodEntry, MoodEntryValues } from './actionTypes';

function messageFrom(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function upsertEntry(entries: MoodEntry[], saved: MoodEntry) {
  const next = entries.filter((entry) => entry.id !== saved.id);
  next.push(saved);
  return next.sort((left, right) =>
    left.values.entry_time.localeCompare(right.values.entry_time),
  );
}

export function useMoodActionDetail(actionId?: string) {
  const [action, setAction] = useState<MoodAction | null>(null);
  const [entries, setEntries] = useState<MoodEntry[]>([]);
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
        getMoodAction(actionId),
        listMoodEntries(actionId),
      ]);
      setAction(loadedAction);
      setEntries(loadedEntries);
    } catch (loadError) {
      setError(messageFrom(loadError, 'The mood check-in could not be loaded.'));
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
      values: MoodEntryValues,
      expectedRevision: number | null,
    ) => {
      if (!actionId) return null;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        const saved = await saveMoodEntryDraft({
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
      values: MoodEntryValues,
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
        let saved: MoodEntry;
        if (editingConfirmed) {
          saved = await amendMoodEntry({
            actionId,
            entryId,
            values,
            expectedRevision: expectedRevision as number,
          });
        } else {
          saved = await confirmMoodEntry({
            actionId,
            entryId,
            values,
            expectedRevision,
          });
        }
        setEntries((current) => upsertEntry(current, saved));
        setNotice(editingConfirmed ? 'Mood entry updated.' : 'Mood saved for today.');
        return saved;
      } catch (saveError) {
        setError(messageFrom(saveError, 'The mood entry could not be saved. Your input is still here.'));
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
        await deleteMoodEntry(actionId, entryId);
        setEntries((current) => current.filter((entry) => entry.id !== entryId));
        setNotice('Mood entry deleted.');
        return true;
      } catch (deleteError) {
        setError(messageFrom(deleteError, 'The mood entry could not be deleted.'));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [actionId],
  );

  const prepareExport = useCallback(
    async (entryIds: string[]) => {
      if (!actionId) return null;
      setBusy(true);
      setError(null);
      setNotice(null);
      try {
        return await exportMoodEntries(actionId, entryIds);
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
    removeEntry,
    saveConfirmed,
    saveDraft,
  };
}
