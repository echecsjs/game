import { describe, expect, it } from 'vitest';

import { STARTING_FEN, parseFen, serialiseFen } from '../fen.js';
import { applyMoveToState, generateMoves, isInCheck } from '../moves.js';

describe('generateMoves — starting position', () => {
  const state = parseFen(STARTING_FEN);

  it('generates 20 legal moves', () => {
    expect(generateMoves(state)).toHaveLength(20);
  });

  it('includes e2-e4', () => {
    expect(generateMoves(state)).toContainEqual({ from: 'e2', to: 'e4' });
  });

  it('includes e2-e3', () => {
    expect(generateMoves(state)).toContainEqual({ from: 'e2', to: 'e3' });
  });

  it('includes Nb1-a3', () => {
    expect(generateMoves(state)).toContainEqual({ from: 'b1', to: 'a3' });
  });
});

describe('generateMoves — filtered by square', () => {
  const state = parseFen(STARTING_FEN);

  it('e2 pawn has 2 moves', () => {
    expect(generateMoves(state, 'e2')).toHaveLength(2);
  });

  it('a1 rook has 0 moves (blocked)', () => {
    expect(generateMoves(state, 'a1')).toHaveLength(0);
  });
});

describe('isInCheck', () => {
  it('starting position is not check', () => {
    expect(isInCheck(parseFen(STARTING_FEN), 'w')).toBe(false);
  });

  it('detects check', () => {
    // Fool's mate position — white is in check
    const fen = 'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(isInCheck(parseFen(fen), 'w')).toBe(true);
  });
});

describe('generateMoves — castling', () => {
  it('includes kingside castling when available', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const moves = generateMoves(parseFen(fen), 'e1');
    expect(moves).toContainEqual({ from: 'e1', to: 'g1' });
  });

  it('includes queenside castling when available', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const moves = generateMoves(parseFen(fen), 'e1');
    expect(moves).toContainEqual({ from: 'e1', to: 'c1' });
  });

  it('does not castle through check', () => {
    // White rook on f1 side attacked — cannot castle kingside through f1
    const fen = '4k2r/8/8/8/8/8/8/R3K2r w KQ - 0 1';
    const moves = generateMoves(parseFen(fen), 'e1');
    expect(moves).not.toContainEqual({ from: 'e1', to: 'g1' });
  });
});

describe('generateMoves — en passant', () => {
  it('includes en passant capture', () => {
    // White pawn on e5, black just played d7-d5 (en passant target = d6)
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    const moves = generateMoves(parseFen(fen), 'e5');
    expect(moves).toContainEqual({ from: 'e5', to: 'd6' });
  });
});

describe('generateMoves — promotion', () => {
  it('includes all 4 promotion targets', () => {
    // Black king on a8, white king on a1, white pawn on e7 — clear path to e8
    const fen = 'k7/4P3/8/8/8/8/8/K7 w - - 0 1';
    const moves = generateMoves(parseFen(fen), 'e7');
    expect(moves).toContainEqual({ from: 'e7', to: 'e8', promotion: 'q' });
    expect(moves).toContainEqual({ from: 'e7', to: 'e8', promotion: 'r' });
    expect(moves).toContainEqual({ from: 'e7', to: 'e8', promotion: 'b' });
    expect(moves).toContainEqual({ from: 'e7', to: 'e8', promotion: 'n' });
  });
});

describe('applyMoveToState', () => {
  it('moves a pawn', () => {
    const state = parseFen(STARTING_FEN);
    const next = applyMoveToState(state, { from: 'e2', to: 'e4' });
    expect(next.board[28]).toEqual({ color: 'w', type: 'p' }); // e4
    expect(next.board[12]).toBeUndefined(); // e2 now empty
  });

  it('sets en passant square on double pawn push', () => {
    const state = parseFen(STARTING_FEN);
    const next = applyMoveToState(state, { from: 'e2', to: 'e4' });
    expect(next.enPassantSquare).toBe('e3');
  });

  it('switches turn', () => {
    const state = parseFen(STARTING_FEN);
    const next = applyMoveToState(state, { from: 'e2', to: 'e4' });
    expect(next.turn).toBe('b');
  });
});

function perft(fen: string, depth: number): number {
  const state = parseFen(fen);
  if (depth === 0) {
    return 1;
  }

  const moves = generateMoves(state);
  if (depth === 1) {
    return moves.length;
  }

  let count = 0;
  for (const move of moves) {
    const next = applyMoveToState(state, move);
    count += perft(serialiseFen(next), depth - 1);
  }

  return count;
}

describe('perft', () => {
  it('perft(1) = 20', () => {
    expect(perft(STARTING_FEN, 1)).toBe(20);
  });

  it('perft(2) = 400', () => {
    expect(perft(STARTING_FEN, 2)).toBe(400);
  });

  it('perft(3) = 8902', () => {
    expect(perft(STARTING_FEN, 3)).toBe(8902);
  });
});
