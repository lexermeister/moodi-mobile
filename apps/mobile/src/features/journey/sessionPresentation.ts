import type { RecordingMetadata } from '../recordings/recordingStorage';
export function formatDuration(ms: number) {
  const seconds = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
export function sessionDate(recording: RecordingMetadata) {
  // Date-only session dates represent local calendar days, not UTC midnight.
  return recording.sessionDate ? new Date(`${recording.sessionDate}T12:00:00`) : new Date(recording.createdAt);
}
export function sessionStatus(recording: RecordingMetadata) {
  if (isProcessing(recording)) return 'Processing';
  if (recording.processingStatus === 'failed') return 'Needs retry';
  if (recording.sessionInsights?.result.status === 'insufficient_source') return 'Limited summary';
  if (recording.sessionInsightsReview && recording.sessionInsightsReview.draft_id === recording.sessionInsights?.draft_id &&
      recording.sessionInsightsReview.source_version === recording.sessionInsights?.source_version) return 'Reviewed';
  if (recording.sessionInsights) return 'Ready to review';
  return 'Saved';
}
export function isProcessing(recording: RecordingMetadata) {
  return ['uploading', 'transcribing', 'ready_for_insights', 'generating_insights']
    .includes(recording.processingStatus ?? 'local');
}
export function sessionProcessingMessage(recording: RecordingMetadata) {
  switch (recording.processingStatus ?? 'local') {
    case 'local': return 'Saving your recording…';
    case 'uploading': return 'Uploading your recording…';
    case 'transcribing': return 'Preparing the transcript…';
    case 'ready_for_insights': return 'Transcript ready. Preparing the session summary…';
    case 'generating_insights': return 'Generating the session summary…';
    case 'failed': return recording.processingError ?? 'Processing stopped before the session was ready.';
    default: return null;
  }
}
export function sortedSessions(recordings: RecordingMetadata[]) {
  return [...recordings].sort((a, b) => sessionDate(b).getTime() - sessionDate(a).getTime() || b.createdAt.localeCompare(a.createdAt));
}
