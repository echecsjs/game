import { positionFromFen } from '../fen.js';

import type { Position } from '@echecs/position';

function fromFen(fen: string): Position {
  const position = positionFromFen(fen);
  if (position === undefined) {
    throw new Error(`Invalid FEN in test: ${fen}`);
  }

  return position;
}

export { fromFen };
