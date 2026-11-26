export async function validateBrowserAudio(audio: Blob): Promise<'webm' | 'm4a' | 'wav'> {
  if (!audio.size) throw new Error('The recording is empty. Record some audio and try again.');
  const mime = audio.type.split(';', 1)[0].toLowerCase();
  const bytes = new Uint8Array(await audio.slice(0, 12).arrayBuffer());
  if (mime === 'audio/webm' || mime === 'video/webm') {
    if (bytes[0] === 0x1a && bytes[1] === 0x45 && bytes[2] === 0xdf && bytes[3] === 0xa3) return 'webm';
  } else if (mime === 'audio/mp4' || mime === 'audio/m4a' || mime === 'video/mp4') {
    if (String.fromCharCode(...bytes.slice(4, 8)) === 'ftyp') return 'm4a';
  } else if (mime === 'audio/wav' || mime === 'audio/x-wav') {
    if (String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
      String.fromCharCode(...bytes.slice(8, 12)) === 'WAVE') return 'wav';
  } else {
    throw new Error('This audio format is not supported. Use a browser that records WebM or MP4 audio.');
  }
  throw new Error('The browser did not produce a valid audio recording.');
}
