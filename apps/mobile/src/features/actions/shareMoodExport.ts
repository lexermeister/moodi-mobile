import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export async function shareMoodExport(payload: unknown): Promise<void> {
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Sharing is not available on this device.');
  }

  const file = new File(Paths.cache, `moodi-mood-export-${Date.now()}.json`);
  try {
    file.create({ overwrite: true });
    await file.write(JSON.stringify(payload, null, 2));
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Export selected mood entries',
      mimeType: 'application/json',
      UTI: 'public.json',
    });
  } finally {
    if (file.exists) file.delete();
  }
}
