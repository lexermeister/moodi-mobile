export async function shareRatingExport(payload: unknown): Promise<void> {
  const uri = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = uri;
  link.download = `moodi-rating-export-${Date.now()}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(uri), 1000);
}
