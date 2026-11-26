export function confirmRecordingDeletion(onConfirm: () => void) {
  if (window.confirm('Delete this recording and its saved session details from this browser? Server copies are retained.')) {
    onConfirm();
  }
}
