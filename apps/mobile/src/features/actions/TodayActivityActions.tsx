import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { Button, Card, typography } from '@/ui/components';
import { TodoRow } from '@/ui/TodoRow';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { listActivityActions } from './actionsApi';
import type { ActivityAction } from './activityTypes';

function subtitle(action: ActivityAction): string {
  const activity = action.settings.agreed_activity;
  if (activity) return activity;
  const period = action.settings.reference_period ?? action.settings.frequency;
  return period ? `Choose an activity · ${period}` : 'Choose an activity when you’re ready';
}

export function TodayActivityActions() {
  const router = useRouter();
  const library = useSharedRecordingLibrary();
  const [items, setItems] = useState<ActivityAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    try {
      const actions = await listActivityActions();
      if (request.current === version) {
        setItems(actions.filter(action => action.state === 'active'));
        setError(null);
      }
    } catch (cause) {
      if (request.current === version) {
        setError(cause instanceof Error ? cause.message : 'Could not load your activities.');
      }
    } finally {
      if (request.current === version) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refresh();
    return () => { ++request.current; };
  }, [refresh]));

  function open(action: ActivityAction) {
    const recording = library.recordings.find(item => item.backendRecordingId === action.recording_id);
    if (!recording) {
      setError('The session for this activity is unavailable on this device.');
      return;
    }
    router.push({ pathname: '/journey/session/[id]', params: {
      id: recording.id,
      activityCandidateId: action.candidate_id,
    } });
  }

  return <>
    {loading ? <ActivityIndicator accessibilityLabel="Loading activity actions" /> : null}
    {error ? <Card><Text accessibilityRole="alert" style={typography.error}>{error}</Text>
      <Button label="Retry activities" secondary onPress={() => void refresh()} /></Card> : null}
    {items.map(action => <TodoRow key={action.id} kind="activity"
      title="Do an enjoyable or meaningful activity" subtitle={subtitle(action)}
      onPress={() => open(action)} />)}
  </>;
}
