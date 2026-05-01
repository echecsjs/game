import { parse } from '@echecs/fen';
import { Position } from '@echecs/position';

function fromFen(fen: string): Position {
  const parsed = parse(fen);
  if (!parsed) {
    throw new Error(`Invalid FEN in test: ${fen}`);
  }

  return new Position(parsed);
}

export { fromFen };
