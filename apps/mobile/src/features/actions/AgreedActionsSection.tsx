import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { RecordRatingCandidate } from './actionTypes';
import {
  RecordRatingActionCard,
  type RecordRatingSessionState,
} from './RecordRatingActionCard';

type Props = {
  candidate: RecordRatingCandidate;
  draftId?: string;
  onStatusChange?: (candidateId: string, status: RecordRatingSessionState) => void;
  recordingId?: string;
  sourceVersion?: string;
};

const statusLabels: Record<RecordRatingSessionState, string> = {
  active: 'ACTIVE',
  already_active: 'ALREADY ACTIVE',
  conflict: 'NEEDS ATTENTION',
  error: 'NEEDS ATTENTION',
  linked_existing: 'ALREADY ACTIVE',
  loading: 'CHECKING',
  needs_setup: 'NEEDS SETUP',
  not_added: 'NOT ADDED',
};

export function AgreedActionsSection({
  candidate,
  draftId,
  onStatusChange,
  recordingId,
  sourceVersion,
}: Props) {
  const [status, setStatus] = useState<RecordRatingSessionState>('loading');

  const updateStatus = useCallback(
    (nextStatus: RecordRatingSessionState) => {
      setStatus((current) => (current === nextStatus ? current : nextStatus));
      onStatusChange?.(candidate.id, nextStatus);
    },
    [candidate.id, onStatusChange],
  );

  return (
    <View style={styles.container}>
      <View style={styles.titleRow}>
        <View style={styles.titleCopy}>
          <Text style={styles.eyebrow}>
            {status === 'needs_setup' || status === 'already_active'
              ? 'NEXT STEP'
              : 'AGREED TASK'}
          </Text>
          <Text style={styles.title}>Agreed actions</Text>
        </View>
        <Text
          accessibilityLiveRegion="polite"
          style={[
            styles.statusBadge,
            (status === 'active' ||
              status === 'already_active' ||
              status === 'linked_existing') &&
              styles.activeBadge,
            status === 'not_added' && styles.inactiveBadge,
            (status === 'error' || status === 'conflict') && styles.errorBadge,
          ]}>
          {statusLabels[status]}
        </Text>
      </View>

      <Text style={styles.helpText}>
        Reviewing the session summary does not start a check-in. Choose separately whether Moodi
        should support this agreed task.
      </Text>

      <RecordRatingActionCard
        candidate={candidate}
        compactWhenActive
        draftId={draftId}
        onSessionStateChange={updateStatus}
        recordingId={recordingId}
        sourceVersion={sourceVersion}
      />
    </View>
  );
}

const colors = {
  accentDark: '#ca3d28',
  ink: '#1e2421',
  line: '#e5ded2',
  muted: '#68716b',
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fffdf8',
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 10 },
  titleCopy: { flex: 1, gap: 2 },
  eyebrow: { color: colors.accentDark, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
  title: { color: colors.ink, fontSize: 17, fontWeight: '800' },
  helpText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  statusBadge: {
    backgroundColor: '#eee9df',
    borderRadius: 8,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  activeBadge: { backgroundColor: '#dcefe1', color: '#23613a' },
  inactiveBadge: { backgroundColor: '#e8e2d8', color: colors.muted },
  errorBadge: { backgroundColor: '#fde2dd', color: '#9b2f20' },
});
