export function browserAudioExtension(mimeType: string) {
  switch (mimeType.split(';')[0].trim().toLowerCase()) {
    case 'audio/mp4': case 'video/mp4': case 'audio/m4a': case 'audio/x-m4a': return '.m4a';
    case 'audio/webm': case 'video/webm': return '.webm';
    case 'audio/ogg': return '.ogg';
    case 'audio/wav': case 'audio/x-wav': return '.wav';
    default: throw new Error('This browser produced an unsupported recording format. Try Chrome or Safari.');
  }
}
