import type { Piece, Square } from './types.js';

// Index layout: a1=0, b1=1, ..., h1=7, a2=8, ..., h8=63
// Formula: index = (rank - 1) * 8 + file, where file: a=0..h=7

export function squareToIndex(square: Square): number {
  const file = (square.codePointAt(0) ?? 0) - ('a'.codePointAt(0) ?? 0);
  const rank = Number.parseInt(square[1] ?? '1', 10) - 1;
  return rank * 8 + file;
}

export function indexToSquare(index: number): Square {
  const file = String.fromCodePoint(('a'.codePointAt(0) ?? 0) + (index % 8));
  const rank = Math.floor(index / 8) + 1;
  return `${file}${rank}` as Square;
}

export function rankOf(square: Square): number {
  return Number.parseInt(square[1] ?? '1', 10);
}

export function fileOf(square: Square): number {
  return (square.codePointAt(0) ?? 0) - ('a'.codePointAt(0) ?? 0) + 1;
}

const BACK_RANK: Piece['type'][] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export const INITIAL_BOARD: readonly (Piece | undefined)[] = (() => {
  const board: (Piece | undefined)[] = Array.from({ length: 64 });
  for (let file = 0; file < 8; file++) {
    const type = BACK_RANK[file] ?? 'r';
    board[file] = { color: 'w', type }; // rank 1
    board[8 + file] = { color: 'w', type: 'p' }; // rank 2
    board[48 + file] = { color: 'b', type: 'p' }; // rank 7
    board[56 + file] = { color: 'b', type }; // rank 8
  }

  return board;
})();

export function cloneBoard(
  board: readonly (Piece | undefined)[],
): (Piece | undefined)[] {
  return [...board];
}
