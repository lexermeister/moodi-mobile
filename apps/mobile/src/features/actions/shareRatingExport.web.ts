import { downloadFile } from '@/lib/downloadFile';

export async function shareRatingExport(payload: unknown): Promise<void> {
  const uri = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], {
    type: 'application/json',
  }));
  downloadFile(uri, `moodi-rating-export-${Date.now()}.json`);
  setTimeout(() => URL.revokeObjectURL(uri), 60_000);
}
