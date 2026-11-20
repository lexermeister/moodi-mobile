import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text } from 'react-native';
import { Button, Card, typography } from '@/ui/components';
import { TodoRow } from '@/ui/TodoRow';
import { listActivityActions, listActivityAttempts } from './actionsApi';
import { outcomeLabels } from './activityFlowDomain';
import type { ActivityAction, ActivityAttempt } from './activityTypes';
import { useMoodiPanel } from '../shell/MoodiPanel';

function subtitle(action: ActivityAction, latest?: ActivityAttempt): string {
  if (latest?.status === 'draft') return `Resume activity · ${latest.selection.label}`;
  if (latest?.outcome) return `Last check-in · ${outcomeLabels[latest.outcome]}`;
  const activity = action.settings.agreed_activity;
  if (activity) return activity;
  const period = action.settings.reference_period ?? action.settings.frequency;
  return period ? `Choose an activity · ${period}` : 'Choose an activity when you’re ready';
}

export function TodayActivityActions({ refreshKey }: { refreshKey: number }) {
  const { openActivityCheckIn } = useMoodiPanel();
  const [items, setItems] = useState<{ action: ActivityAction; latest?: ActivityAttempt }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  const refresh = useCallback(async () => {
    const version = ++request.current;
    setLoading(true);
    try {
      const actions = await listActivityActions();
      const rows = await Promise.all(actions.filter(action => action.state === 'active').map(async action => {
        const attempts = await listActivityAttempts(action.id).catch(() => []);
        return { action, latest: attempts.find(item => item.status === 'draft') ??
          attempts.find(item => item.status === 'confirmed') };
      }));
      if (request.current === version) {
        setItems(rows);
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
    void refreshKey; void refresh();
    return () => { ++request.current; };
  }, [refresh, refreshKey]));

  function open(action: ActivityAction) {
    openActivityCheckIn(action.id);
  }

  return <>
    {loading ? <ActivityIndicator accessibilityLabel="Loading activity actions" /> : null}
    {error ? <Card><Text accessibilityRole="alert" style={typography.error}>{error}</Text>
      <Button label="Retry activities" secondary onPress={() => void refresh()} /></Card> : null}
    {items.map(({ action, latest }) => <TodoRow key={action.id} kind="activity"
      title="Do an enjoyable or meaningful activity" subtitle={subtitle(action, latest)}
      onPress={() => open(action)} />)}
  </>;
}
