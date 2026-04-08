import type { PieceType, Square } from '@echecs/position';

type PromotionPieceType = Exclude<PieceType, 'king' | 'pawn'>;

interface Move {
  from: Square;
  promotion: PromotionPieceType | undefined;
  to: Square;
}

export type { Move, PromotionPieceType };
