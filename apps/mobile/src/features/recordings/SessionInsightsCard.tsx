import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RecordingMetadata } from './recordingStorage';

export function SessionInsightsCard({ recording }: { recording: RecordingMetadata }) {
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const insights = recording.sessionInsights?.result;
  const displayedTranscript = useMemo(
    () =>
      recording.transcriptTurns?.length
        ? recording.transcriptTurns
            .map(
              (turn) => `${turn.role === 'therapist' ? 'Therapist' : 'Client'}: “${turn.text}”`,
            )
            .join('\n\n')
        : recording.transcript,
    [recording.transcript, recording.transcriptTurns],
  );

  if (!insights && !displayedTranscript) {
    return null;
  }

  return (
    <View style={styles.container}>
      {insights ? (
        <View style={styles.insights}>
          <View style={styles.titleRow}>
            <Text style={styles.title}>Session insights</Text>
            <Text style={styles.draftBadge}>DRAFT</Text>
          </View>

          {insights.status === 'insufficient_source' ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Not enough supported information</Text>
              <Text style={styles.emptyText}>
                Moodi could not generate reliable insights from the available transcript.
              </Text>
            </View>
          ) : (
            insights.sections.map((section) => (
              <View key={section.key} style={styles.section}>
                <Text style={styles.sectionHeading}>{section.heading}</Text>
                {section.bullets.map((bullet, index) => (
                  <View key={`${section.key}-${index}`} style={styles.bulletRow}>
                    <Text style={styles.bulletMark}>•</Text>
                    <Text selectable style={styles.bulletText}>
                      {bullet.text}
                    </Text>
                  </View>
                ))}
              </View>
            ))
          )}

          {insights.coverage_note ? (
            <View style={styles.coverageNote}>
              <Text style={styles.coverageLabel}>Source note</Text>
              <Text style={styles.coverageText}>{insights.coverage_note}</Text>
            </View>
          ) : null}

          <Text style={styles.disclaimer}>
            AI-generated from the recording. Review for accuracy; this is not medical advice.
          </Text>
        </View>
      ) : null}

      {displayedTranscript ? (
        <View style={styles.transcriptArea}>
          <Pressable
            accessibilityLabel={transcriptVisible ? 'Hide transcript' : 'View transcript'}
            accessibilityRole="button"
            onPress={() => setTranscriptVisible((visible) => !visible)}
            style={({ pressed }) => [styles.transcriptButton, pressed && styles.pressed]}>
            <Text style={styles.transcriptButtonText}>
              {transcriptVisible ? 'Hide transcript' : 'View transcript'}
            </Text>
            <Text style={styles.chevron}>{transcriptVisible ? '⌃' : '⌄'}</Text>
          </Pressable>
          {transcriptVisible ? (
            <Text selectable style={styles.transcriptText}>
              {displayedTranscript}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const colors = {
  ink: '#1e2421',
  muted: '#68716b',
  accentDark: '#ca3d28',
  line: '#e5ded2',
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  insights: {
    backgroundColor: '#f5f0e7',
    borderRadius: 14,
    gap: 14,
    padding: 14,
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', gap: 8 },
  title: { color: colors.ink, flex: 1, fontSize: 17, fontWeight: '800' },
  draftBadge: {
    backgroundColor: '#e8e2d8',
    borderRadius: 8,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  section: { gap: 7 },
  sectionHeading: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  bulletMark: { color: colors.accentDark, fontSize: 17, lineHeight: 22 },
  bulletText: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 21 },
  emptyState: { gap: 4 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  coverageNote: { backgroundColor: '#fff8e8', borderRadius: 10, gap: 3, padding: 10 },
  coverageLabel: { color: '#725d36', fontSize: 11, fontWeight: '800' },
  coverageText: { color: '#725d36', fontSize: 12, lineHeight: 17 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  transcriptArea: { borderTopColor: colors.line, borderTopWidth: 1, paddingTop: 8 },
  transcriptButton: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  transcriptButtonText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
  chevron: { color: colors.accentDark, fontSize: 17, fontWeight: '800' },
  transcriptText: { color: colors.ink, fontSize: 13, lineHeight: 20, paddingTop: 9 },
  pressed: { opacity: 0.68 },
});
