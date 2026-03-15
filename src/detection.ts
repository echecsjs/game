import { generateMoves, isInCheck } from './moves.js';

import type { FenState } from './fen.js';
import type { Piece } from './types.js';

export function isCheckmate(state: FenState): boolean {
  return isInCheck(state, state.turn) && generateMoves(state).length === 0;
}

export function isStalemate(state: FenState): boolean {
  return !isInCheck(state, state.turn) && generateMoves(state).length === 0;
}

// Returns the square color (0 or 1) for a 0x88 index.
// Bishops on the same square color cannot cover all squares.
function squareColor(index: number): number {
  const rank = 8 - Math.floor(index / 16);
  const file = index % 16;
  return (rank + file) % 2;
}

export function isInsufficientMaterial(state: FenState): boolean {
  const pieces: { index: number; piece: Piece }[] = [];
  for (let index = 0; index <= 119; index++) {
    if (index & 0x88) {
      continue;
    }

    const piece = state.board[index];
    if (piece !== undefined) {
      pieces.push({ index: index, piece });
    }
  }

  // K vs K
  if (pieces.every(({ piece: p }) => p.type === 'k')) {
    return true;
  }

  const nonKings = pieces.filter(({ piece: p }) => p.type !== 'k');

  // K+B vs K or K+N vs K
  if (nonKings.length === 1) {
    const entry = nonKings[0];
    if (entry !== undefined) {
      return entry.piece.type === 'b' || entry.piece.type === 'n';
    }
  }

  // KB vs KB — any number of bishops, all on the same square color
  if (nonKings.every(({ piece: p }) => p.type === 'b')) {
    const colors = nonKings.map(({ index }) => squareColor(index));
    const allSame = colors.every((c) => c === colors[0]);
    if (allSame) {
      return true;
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
