import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { RecordingMetadata } from './recordingStorage';
import { SessionInsightsEditor } from './SessionInsightsEditor';
import type { SessionInsightsReviewRequest } from './sessionInsightsReviewTypes';

type Props = {
  recording: RecordingMetadata;
  onSaveReview: (
    recording: RecordingMetadata,
    request: SessionInsightsReviewRequest,
  ) => Promise<unknown>;
};

export function SessionInsightsCard({ recording, onSaveReview }: Props) {
  const [transcriptVisible, setTranscriptVisible] = useState(false);
  const [editing, setEditing] = useState(false);
  const insights = recording.sessionInsights?.result;
  const draftId = recording.sessionInsights?.draft_id;
  const reviewableInsights =
    recording.sessionInsights &&
    draftId &&
    insights?.status === 'draft' &&
    insights.sections.every((section) => section.bullets.every((bullet) => bullet.item_id))
      ? { ...recording.sessionInsights, draft_id: draftId }
      : null;
  const savedReview = recording.sessionInsightsReview;
  const review =
    savedReview &&
    savedReview.draft_id === draftId &&
    savedReview.source_version === recording.sessionInsights?.source_version
      ? savedReview
      : undefined;
  const displayedSections = useMemo(
    () =>
      review
        ? review.sections.map((section) => ({
            key: section.key,
            heading: section.heading,
            bullets: section.items
              .filter((item) => item.disposition !== 'removed' && item.displayed_text)
              .map((item) => ({
                itemId: item.item_id,
                text: item.displayed_text as string,
                edited: item.provenance === 'client_edited',
              })),
          }))
        : (insights?.sections.map((section) => ({
            key: section.key,
            heading: section.heading,
            bullets: section.bullets.map((bullet, index) => ({
              itemId: bullet.item_id ?? `${section.key}-${index}`,
              text: bullet.text,
              edited: false,
            })),
          })) ?? []),
    [insights?.sections, review],
  );
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
          {editing && reviewableInsights ? (
            <SessionInsightsEditor
              insights={reviewableInsights}
              onCancel={() => setEditing(false)}
              onSave={async (request) => {
                await onSaveReview(recording, request);
                setEditing(false);
              }}
              review={review}
            />
          ) : (
            <>
              <View style={styles.titleRow}>
                <Text style={styles.title}>Session insights</Text>
                <Text style={[styles.statusBadge, review && styles.reviewedBadge]}>
                  {review ? 'REVIEWED' : 'DRAFT'}
                </Text>
              </View>

              {insights.status === 'insufficient_source' ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Not enough supported information</Text>
                  <Text style={styles.emptyText}>
                    Moodi could not generate reliable insights from the available transcript.
                  </Text>
                </View>
              ) : displayedSections.some((section) => section.bullets.length) ? (
                displayedSections.map((section) =>
                  section.bullets.length ? (
                    <View key={section.key} style={styles.section}>
                      <Text style={styles.sectionHeading}>{section.heading}</Text>
                      {section.bullets.map((bullet) => (
                        <View key={bullet.itemId} style={styles.bulletRow}>
                          <Text style={styles.bulletMark}>•</Text>
                          <View style={styles.bulletCopy}>
                            <Text selectable style={styles.bulletText}>
                              {bullet.text}
                            </Text>
                            {bullet.edited ? (
                              <Text style={styles.editedLabel}>Edited by you</Text>
                            ) : null}
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null,
                )
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>No insights retained</Text>
                  <Text style={styles.emptyText}>You removed every generated insight.</Text>
                </View>
              )}

              {insights.coverage_note ? (
                <View style={styles.coverageNote}>
                  <Text style={styles.coverageLabel}>Source note</Text>
                  <Text style={styles.coverageText}>{insights.coverage_note}</Text>
                </View>
              ) : null}

              {reviewableInsights ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setEditing(true)}
                  style={({ pressed }) => [styles.reviewButton, pressed && styles.pressed]}>
                  <Text style={styles.reviewButtonText}>
                    {review ? 'Edit reviewed insights' : 'Review & edit'}
                  </Text>
                </Pressable>
              ) : null}

              <Text style={styles.disclaimer}>
                AI-generated from the recording. Review for accuracy; this is not medical advice.
              </Text>
            </>
          )}
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
  statusBadge: {
    backgroundColor: '#e8e2d8',
    borderRadius: 8,
    color: colors.muted,
    fontSize: 10,
    fontWeight: '800',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  reviewedBadge: { backgroundColor: '#dcefe1', color: '#23613a' },
  section: { gap: 7 },
  sectionHeading: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  bulletRow: { alignItems: 'flex-start', flexDirection: 'row', gap: 8 },
  bulletMark: { color: colors.accentDark, fontSize: 17, lineHeight: 22 },
  bulletText: { color: colors.ink, flex: 1, fontSize: 14, lineHeight: 21 },
  bulletCopy: { flex: 1, gap: 2 },
  editedLabel: { color: colors.muted, fontSize: 10, fontWeight: '700' },
  emptyState: { gap: 4 },
  emptyTitle: { color: colors.ink, fontSize: 15, fontWeight: '800' },
  emptyText: { color: colors.muted, fontSize: 13, lineHeight: 19 },
  coverageNote: { backgroundColor: '#fff8e8', borderRadius: 10, gap: 3, padding: 10 },
  coverageLabel: { color: '#725d36', fontSize: 11, fontWeight: '800' },
  coverageText: { color: '#725d36', fontSize: 12, lineHeight: 17 },
  disclaimer: { color: colors.muted, fontSize: 11, lineHeight: 16 },
  reviewButton: {
    alignItems: 'center',
    borderColor: colors.accentDark,
    borderRadius: 11,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  reviewButtonText: { color: colors.accentDark, fontSize: 13, fontWeight: '800' },
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
