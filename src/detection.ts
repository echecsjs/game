import { generateMoves, isInCheck } from './moves.js';

import type { FenState } from './fen.js';
import type { Piece } from './types.js';


export function isCheckmate(state: FenState): boolean {
  return isInCheck(state, state.turn) && generateMoves(state).length === 0;
}

export function isStalemate(state: FenState): boolean {
  return !isInCheck(state, state.turn) && generateMoves(state).length === 0;
}

export function isInsufficientMaterial(state: FenState): boolean {
  const pieces = state.board.filter((p): p is Piece => p !== undefined);

  // Only kings remain
  if (pieces.every((p) => p.type === 'k')) {
    return true;
  }

  // One side has only king + one bishop or knight
  const nonKings = pieces.filter((p) => p.type !== 'k');
  if (nonKings.length === 1) {
    const [extra] = nonKings;
    if (extra !== undefined) {
      return extra.type === 'b' || extra.type === 'n';
    }
  }

  return false;
}

export function isThreefoldRepetition(positionHistory: string[]): boolean {
  const counts = new Map<string, number>();

  for (const fen of positionHistory) {
    // Compare only piece placement + turn + castling rights (ignore clocks)
    const key = fen.split(' ').slice(0, 3).join(' ');
    const count = (counts.get(key) ?? 0) + 1;
    counts.set(key, count);

    if (count >= 3) {
      return true;
    }
  }

  return false;
}

export function isDraw(state: FenState, positionHistory: string[]): boolean {
  return (
    state.halfmoveClock >= 100 ||
    isInsufficientMaterial(state) ||
    isStalemate(state) ||
    isThreefoldRepetition(positionHistory)
  );
}
