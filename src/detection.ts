import type { Move, Position } from '@echecs/position';

function isCheckmate(position: Position, moves: Move[]): boolean {
  return position.isCheck && moves.length === 0;
}

function isStalemate(position: Position, moves: Move[]): boolean {
  return !position.isCheck && moves.length === 0;
}

function isThreefoldRepetition(positionHistory: string[]): boolean {
  const counts = new Map<string, number>();

  for (const hash of positionHistory) {
    const count = (counts.get(hash) ?? 0) + 1;
    counts.set(hash, count);

    if (count >= 3) {
      return true;
    }
  }

  return false;
}

function isDraw(
  position: Position,
  moves: Move[],
  positionHistory: string[],
): boolean {
  return (
    position.halfmoveClock >= 100 ||
    position.isInsufficientMaterial ||
    isStalemate(position, moves) ||
    isThreefoldRepetition(positionHistory)
  );
}

export { isCheckmate, isDraw, isStalemate, isThreefoldRepetition };
