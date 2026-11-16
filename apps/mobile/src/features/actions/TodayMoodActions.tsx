import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { Button, Card, typography } from '@/ui/components';
import { listRatingActions, listRatingEntries } from './actionsApi';
import { currentDayKey, getActionProgress } from './actionStatus';
import type { RatingAction, RatingEntry } from './actionTypes';
import { measurementLabels } from './moodSetup';
import { latestMoodDraft } from './moodWizardDomain';
import { MoodEntryWizard } from './MoodEntryWizard';

export function TodayMoodActions({ onEntriesChanged }: { onEntriesChanged?: () => void }) {
  const router = useRouter();
  const [items, setItems] = useState<{ action: RatingAction; draft?: RatingEntry }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<{ action: RatingAction; draft?: RatingEntry } | null>(null);
  const opening = useRef(false);
  const request = useRef(0);
  const refresh = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    try {
      const actions = (await listRatingActions()).filter(action => action.state === 'active' &&
        !getActionProgress(action).completed && (!action.settings.start_date || action.settings.start_date <= currentDayKey()));
      const rows = await Promise.all(actions.map(async action => ({ action, draft: latestMoodDraft(await listRatingEntries(action.id)) })));
      if (request.current === version) { setItems(rows); setError(null); }
    } catch (cause) {
      if (request.current === version) setError(cause instanceof Error ? cause.message : 'Could not load your actions.');
    } finally { if (request.current === version) setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { void refresh(); return () => { ++request.current; }; }, [refresh]));
  async function open(action: RatingAction) {
    if (opening.current) return;
    if (action.settings.configuration.input_kind !== 'numeric_0_10') {
      router.push({ pathname: '/actions/[actionId]', params: { actionId: action.id } }); return;
    }
    opening.current = true;
    try {
      const draft = latestMoodDraft(await listRatingEntries(action.id));
      setSession({ action, draft });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not open this check-in.'); }
    finally { opening.current = false; }
  }
  return <>
    {loading ? <ActivityIndicator accessibilityLabel="Loading active actions" /> : null}
    {error ? <Card><Text accessibilityRole="alert" style={typography.error}>{error}</Text><Button label="Retry actions" secondary onPress={() => void refresh()} /></Card> : null}
    {items.map(({ action, draft }) => <Card key={action.id}>
      <Text style={typography.heading}>Record mood</Text>
      <Text style={typography.body}>{measurementLabels(action.settings.what_to_record)}</Text>
      {draft ? <Text style={typography.body}>Unfinished entry · {new Date(draft.values.entry_time).toLocaleDateString()}</Text> : null}
      <Button label={draft ? 'Resume check-in' : 'Record mood'} onPress={() => void open(action)} />
    </Card>)}
    {session ? <MoodEntryWizard key={session.draft?.id ?? session.action.id} action={session.action} draft={session.draft}
      onClose={() => { setSession(null); void refresh(); onEntriesChanged?.(); }} /> : null}
  </>;
}
