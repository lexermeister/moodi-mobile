import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { Button, Card, typography } from '@/ui/components';
import { TodoRow } from '@/ui/TodoRow';
import { listRatingActions, listRatingEntries } from './actionsApi';
import type { RatingAction, RatingEntry } from './actionTypes';
import { formatClockTime } from './scheduleFormatting';
import { latestMoodDraft } from './moodWizardDomain';
import { hasConfirmedMoodForToday, isMoodActionDue } from './moodSchedule';
import { useMoodiPanel } from '../shell/MoodiPanel';

export function TodayMoodActions({ refreshKey }: { refreshKey: number }) {
  const router = useRouter();
  const { openMoodCheckIn } = useMoodiPanel();
  const [items, setItems] = useState<{ action: RatingAction; draft?: RatingEntry }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const opening = useRef(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    setItems([]);
    try {
      const actions = (await listRatingActions()).filter(action => action.state === 'active' && isMoodActionDue(action));
      const rows = await Promise.all(actions.map(async action => {
        const entries = await listRatingEntries(action.id);
        return { action, draft: latestMoodDraft(entries), completedToday: hasConfirmedMoodForToday(action, entries) };
      }));
      if (request.current === version) { setItems(rows.filter(row => !row.completedToday)); setError(null); }
    } catch (cause) {
      if (request.current === version) setError(cause instanceof Error ? cause.message : 'Could not load your actions.');
    } finally { if (request.current === version) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refreshKey; void refresh(); return () => { ++request.current; }; }, [refresh, refreshKey]));
  async function open(action: RatingAction) {
    if (opening.current) return;
    if (action.settings.configuration.input_kind !== 'numeric_0_10') {
      router.push({ pathname: '/actions/[actionId]', params: { actionId: action.id } }); return;
    }
    opening.current = true;
    try {
      const entries = await listRatingEntries(action.id);
      if (hasConfirmedMoodForToday(action, entries)) { void refresh(); return; }
      const draft = latestMoodDraft(entries);
      openMoodCheckIn({ action, draft });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open this check-in.'); }
    finally { opening.current = false; }
  }
  return <>
    {loading ? <ActivityIndicator accessibilityLabel="Loading active actions" /> : null}
    {error ? <Card><Text accessibilityRole="alert" style={typography.error}>{error}</Text><Button label="Retry actions" secondary onPress={() => void refresh()} /></Card> : null}
    {items.map(({ action, draft }) => <TodoRow key={action.id} kind="mood"
      title={draft ? 'Resume mood check-in' : 'Record mood'}
      subtitle={draft ? draft.values.mood_value !== null ? `Mood saved · ${draft.values.mood_value}/10` : 'Continue your check-in'
        : action.settings.preferred_check_in_time ? `Reminder at ${formatClockTime(action.settings.preferred_check_in_time)}` : 'Check in with your mood'}
      onPress={() => void open(action)} />)}
  </>;
}
