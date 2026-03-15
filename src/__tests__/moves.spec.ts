import { describe, expect, it } from 'vitest';

import { STARTING_FEN, parseFen } from '../fen.js';
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
    expect(next.board[68]).toEqual({ color: 'w', type: 'p' }); // e4 (0x88 index 68)
    expect(next.board[100]).toBeUndefined(); // e2 now empty (0x88 index 100)
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

import type { FenState } from '../fen.js';

// Pass FenState directly — avoids FEN round-trip overhead per node,
// making depth-4 positions feasible within test time.
function perft(state: FenState, depth: number): number {
  if (depth === 0) {
    return 1;
  }

  const moves = generateMoves(state);
  if (depth === 1) {
    return moves.length;
  }

  let count = 0;
  for (const move of moves) {
    count += perft(applyMoveToState(state, move), depth - 1);
  }

  return count;
}

// Known perft values from https://www.chessprogramming.org/Perft_Results
// Positions 2-7 from chess.js perft.test.ts — https://github.com/jhlywa/chess.js/blob/master/__tests__/perft.test.ts

describe('perft — starting position (position 1)', () => {
  it('perft(1) = 20', () => {
    expect(perft(parseFen(STARTING_FEN), 1)).toBe(20);
  });

  it('perft(2) = 400', () => {
    expect(perft(parseFen(STARTING_FEN), 2)).toBe(400);
  });

  it('perft(3) = 8902', () => {
    expect(perft(parseFen(STARTING_FEN), 3)).toBe(8902);
  });

  it('perft(4) = 197281', () => {
    expect(perft(parseFen(STARTING_FEN), 4)).toBe(197_281);
  });
});

describe('perft — position 2 (castling, en passant)', () => {
  // r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1
  const fen =
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

  it('perft(3) = 97862', () => {
    expect(perft(parseFen(fen), 3)).toBe(97_862);
  });
});

describe('perft — position 3 (endgame pawns)', () => {
  // 8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1
  const fen = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';

  it('perft(4) = 43238', () => {
    expect(perft(parseFen(fen), 4)).toBe(43_238);
  });
});

describe('perft — position 4 (promotions)', () => {
  // r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1
  const fen =
    'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1';

  it('perft(4) = 422333', () => {
    expect(perft(parseFen(fen), 4)).toBe(422_333);
  });
});

describe('perft — position 5 (discovered checks)', () => {
  // rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8
  const fen = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';

  it('perft(3) = 62379', () => {
    expect(perft(parseFen(fen), 3)).toBe(62_379);
  });
});

describe('perft — position 6 (complex midgame)', () => {
  // r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10
  const fen =
    'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10';

  it('perft(3) = 89890', () => {
    expect(perft(parseFen(fen), 3)).toBe(89_890);
  });
});

describe('perft — position 7 (en passant in FEN)', () => {
  // rnbqkbnr/p3pppp/2p5/1pPp4/3P4/8/PP2PPPP/RNBQKBNR w KQkq b6 0 4
  const fen = 'rnbqkbnr/p3pppp/2p5/1pPp4/3P4/8/PP2PPPP/RNBQKBNR w KQkq b6 0 4';

  it('perft(3) = 23509', () => {
    expect(perft(parseFen(fen), 3)).toBe(23_509);
  });
});
