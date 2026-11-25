import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { Button, Card, typography } from '@/ui/components';
import { TodoRow } from '@/ui/TodoRow';
import { listPracticeActions, listPracticeAttempts } from './actionsApi';
import { practiceTitle } from './practiceFlowDomain';
import type { PracticeAction, PracticeAttempt } from './practiceTypes';
import { useMoodiPanel } from '../shell/MoodiPanel';

function subtitle(action: PracticeAction, latest?: PracticeAttempt): string {
  if (latest?.status === 'draft') return 'Resume practice';
  return action.settings.duration_minutes === null ? 'Log your practice' : `${action.settings.duration_minutes} min practice`;
}

export function TodayPracticeActions({ refreshKey }: { refreshKey: number }) {
  const { openPracticeCheckIn } = useMoodiPanel();
  const [items, setItems] = useState<{ action: PracticeAction; latest?: PracticeAttempt }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    try {
      const actions = await listPracticeActions();
      const rows = await Promise.all(actions.filter(action => action.state === 'active').map(async action => {
        const attempts = await listPracticeAttempts(action.id).catch(() => []);
        return { action, latest: attempts.find(item => item.status === 'draft') ??
          attempts.find(item => item.status === 'confirmed') };
      }));
      if (request.current === version) {
        setItems(rows);
        setError(null);
      }
    } catch (cause) {
      if (request.current === version) {
        setError(cause instanceof Error ? cause.message : 'Could not load your practices.');
      }
    } finally {
      if (request.current === version) setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    void refreshKey; void refresh();
    return () => { ++request.current; };
  }, [refresh, refreshKey]));

  function open(action: PracticeAction) {
    openPracticeCheckIn(action.id);
  }

  return <>
    {loading ? <ActivityIndicator accessibilityLabel="Loading practice actions" /> : null}
    {error ? <Card><Text accessibilityRole="alert" style={typography.error}>{error}</Text>
      <Button label="Retry practices" secondary onPress={() => void refresh()} /></Card> : null}
    {items.map(({ action, latest }) => <TodoRow key={action.id} kind="practice"
      title={practiceTitle(action.settings)} subtitle={subtitle(action, latest)}
      onPress={() => open(action)} />)}
  </>;
}
