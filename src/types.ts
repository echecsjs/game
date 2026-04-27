import type { Piece, PieceType, Square } from '@echecs/position';

type PromotionPieceType = Exclude<PieceType, 'king' | 'pawn'>;

interface Move {
  from: Square;
  promotion?: PromotionPieceType;
  to: Square;
}

interface MoveResult {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: {
    square: Square;
    piece: Piece;
  };
  promotion?: Piece;
  castling?: {
    from: Square;
    to: Square;
    piece: Piece;
  };
}

export type { Move, MoveResult, PromotionPieceType };
