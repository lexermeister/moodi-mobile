export type TranscriptSpeaker = 'speaker_1' | 'speaker_2';

export type TranscriptTurn = {
  speaker: TranscriptSpeaker;
  text: string;
};

export function isTranscriptTurn(value: unknown): value is TranscriptTurn {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const turn = value as Partial<TranscriptTurn>;
  return (
    (turn.speaker === 'speaker_1' || turn.speaker === 'speaker_2') &&
    typeof turn.text === 'string' &&
    turn.text.trim().length > 0
  );
}
