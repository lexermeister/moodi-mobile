export type TranscriptRole = 'client' | 'therapist';

export type TranscriptTurn = {
  role: TranscriptRole;
  text: string;
};

export function isTranscriptTurn(value: unknown): value is TranscriptTurn {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const turn = value as Partial<TranscriptTurn>;
  return (
    (turn.role === 'client' || turn.role === 'therapist') &&
    typeof turn.text === 'string' &&
    turn.text.trim().length > 0
  );
}
