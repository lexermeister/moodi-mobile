import { AgreedActionsSection } from '../actions/AgreedActionsSection';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button, Card, typography } from '@/ui/components';
import { theme } from '@/ui/theme';
import type { RecordingMetadata } from '../recordings/recordingStorage';
import { SessionInsightsEditor } from '../recordings/SessionInsightsEditor';
import { useSharedRecordingLibrary } from '../recordings/RecordingLibraryProvider';
import { sessionDate } from './sessionPresentation';

export function JourneySummary({ recording }: { recording: RecordingMetadata }) {
  const [editing, setEditing] = useState(false);
  const library = useSharedRecordingLibrary();
  const insights = recording.sessionInsights;
  const review = recording.sessionInsightsReview?.draft_id === insights?.draft_id &&
    recording.sessionInsightsReview?.source_version === insights?.source_version
    ? recording.sessionInsightsReview : undefined;
  const sections = review ? review.sections.map(section => ({
    key: section.key, heading: section.heading,
    bullets: section.items.filter(item => item.disposition !== 'removed' && item.displayed_text)
      .map(item => ({ text: item.displayed_text!, edited: item.provenance === 'client_edited' })),
  })) : insights?.result.sections.map(section => ({
    key: section.key, heading: section.heading,
    bullets: section.bullets.map(bullet => ({ text: bullet.text, edited: false })),
  })) ?? [];
  const reviewable = insights?.draft_id && insights.result.status === 'draft' &&
    insights.result.sections.every(section => section.bullets.every(bullet => bullet.item_id))
    ? { ...insights, draft_id: insights.draft_id } : null;
  const agreements = sections.find(section => section.key === 'agreements')?.bullets ?? [];

  return <>
    <Card>
      <View style={styles.header}>
        <Text style={styles.label}>SESSION SUMMARY · {sessionDate(recording).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase()}</Text>
        {insights ? <Text style={styles.badge}>{review ? 'Reviewed' : insights.result.status === 'insufficient_source' ? 'Limited' : 'Draft'}</Text> : null}
      </View>
      {insights?.result.coverage_note ? <View style={styles.note}><Text style={styles.noteText}>{insights.result.coverage_note}</Text></View> : null}
      {editing && reviewable ? <SessionInsightsEditor insights={reviewable} review={review}
        onCancel={() => setEditing(false)} onSave={async request => {
          await library.saveInsightsReview(recording, request); setEditing(false);
        }} /> : <>
        {!insights ? <Text style={typography.body}>A session summary isn’t available yet.</Text> :
          insights.result.status === 'insufficient_source' ? <Text style={typography.body}>There wasn’t enough information in this recording to prepare a reliable summary.</Text> :
          !sections.some(section => section.bullets.length) ? <Text style={typography.body}>{review ? 'No summary points were retained.' : 'No summary points are available.'}</Text> :
          sections.filter(section => section.bullets.length).map(section => <View key={section.key} style={styles.section}>
            <Text style={styles.heading}>{section.heading}</Text>
            {section.bullets.map((bullet, index) => <View key={index} style={styles.bullet}>
              <Text style={styles.dot}>•</Text><View style={styles.copy}>
                <Text selectable style={styles.body}>{bullet.text}</Text>
                {bullet.edited ? <Text style={styles.noteText}>Edited by you</Text> : null}
              </View>
            </View>)}
          </View>)}
        {reviewable ? <Button secondary label={review ? 'Edit reviewed summary' : 'Review summary'} onPress={() => setEditing(true)} /> : null}
      </>}
    </Card>
    <View style={styles.group}>
      <Text style={typography.heading}>Agreed actions</Text>
      {agreements.length ? agreements.map((agreement, index) => <View key={index} style={styles.agreement}><Text style={styles.body}>{agreement.text}</Text></View>) :
        <Text style={typography.body}>{!insights ? 'Agreed actions will appear once your session summary is available.' : insights.result.status === 'insufficient_source' ? 'Agreed actions couldn’t be identified reliably from this recording.' : insights.result.action_candidates.some(candidate => candidate.type === 'record_mood') ? 'Review the proposed action below.' : 'No agreed actions are recorded in this summary.'}</Text>}
    </View>
    {recording.sessionInsights?.result.action_candidates
      .filter(candidate => candidate.type === 'record_mood')
      .map(candidate => <AgreedActionsSection
        key={`${recording.sessionInsights?.draft_id}:${candidate.id}`}
        candidate={candidate}
        recordingId={recording.backendRecordingId}
        draftId={recording.sessionInsights?.draft_id}
        sourceVersion={recording.sessionInsights?.source_version}
      />)}
    <View style={styles.group}>
      <Text style={typography.heading}>Transcript</Text>
      {recording.transcriptTurns?.length ? recording.transcriptTurns.map((turn, index) => <View key={index} style={styles.turn}>
        <Text style={styles.speaker}>{turn.role === 'client' ? 'You' : 'Therapist'}</Text>
        <Text selectable style={styles.body}>{turn.text}</Text>
      </View>) : <Text selectable style={typography.body}>{recording.transcript || 'A transcript isn’t available yet.'}</Text>}
    </View>
  </>;
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { flex: 1, fontSize: 11, fontWeight: '800', letterSpacing: 0.4, color: theme.colors.ink },
  badge: { fontSize: 11, fontWeight: '700', color: theme.colors.accent, backgroundColor: theme.colors.soft, borderRadius: 5, padding: 5 },
  note: { backgroundColor: '#F4F3F7', borderLeftWidth: 2, borderLeftColor: theme.colors.accent, padding: 10 },
  noteText: { fontSize: 12, lineHeight: 18, color: theme.colors.muted },
  section: { borderTopWidth: 1, borderTopColor: theme.colors.line, paddingTop: 14, gap: 10, paddingBottom: 6 },
  heading: { fontSize: 15, fontWeight: '700', color: theme.colors.ink },
  bullet: { flexDirection: 'row', gap: 10 },
  dot: { color: theme.colors.accent, fontSize: 18 }, copy: { flex: 1, gap: 4 },
  body: { fontSize: 14, lineHeight: 22, color: theme.colors.ink },
  group: { gap: 12 },
  agreement: { borderRadius: 12, backgroundColor: theme.colors.soft, padding: 14 },
  turn: { borderBottomWidth: 1, borderBottomColor: theme.colors.line, paddingVertical: 12, gap: 5 },
  speaker: { fontSize: 12, fontWeight: '700', color: theme.colors.accent },
});
