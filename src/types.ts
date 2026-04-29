import type { Piece, Square } from '@echecs/position';

interface Movement {
  from: Square | undefined;
  to: Square | undefined;
  piece: Piece;
}

export type { Movement };
