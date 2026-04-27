import { STARTING_FEN } from '@echecs/fen';
import { describe, expect, it } from 'vitest';

import { generateMoves, move } from '../moves.js';
import { fromFen } from './helpers.js';

import type { Position } from '@echecs/position';

describe('generateMoves — starting position', () => {
  const position = fromFen(STARTING_FEN);

  it('generates 20 legal moves', () => {
    expect(generateMoves(position)).toHaveLength(20);
  });

  it('includes e2-e4', () => {
    expect(generateMoves(position)).toContainEqual({
      from: 'e2',

      to: 'e4',
    });
  });

  it('includes e2-e3', () => {
    expect(generateMoves(position)).toContainEqual({
      from: 'e2',

      to: 'e3',
    });
  });

  it('includes Nb1-a3', () => {
    expect(generateMoves(position)).toContainEqual({
      from: 'b1',

      to: 'a3',
    });
  });
});

describe('generateMoves — filtered by square', () => {
  const position = fromFen(STARTING_FEN);

  it('e2 pawn has 2 moves', () => {
    expect(generateMoves(position, 'e2')).toHaveLength(2);
  });

  it('a1 rook has 0 moves (blocked)', () => {
    expect(generateMoves(position, 'a1')).toHaveLength(0);
  });
});

describe('isCheck via position.isCheck', () => {
  it('starting position is not check', () => {
    expect(fromFen(STARTING_FEN).isCheck).toBe(false);
  });

  it('detects check', () => {
    // Fool's mate position — white is in check
    const fen = 'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(fromFen(fen).isCheck).toBe(true);
  });
});

describe('generateMoves — castling', () => {
  it('includes kingside castling when available', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const moves = generateMoves(fromFen(fen), 'e1');
    expect(moves).toContainEqual({
      from: 'e1',

      to: 'g1',
    });
  });

  it('includes queenside castling when available', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const moves = generateMoves(fromFen(fen), 'e1');
    expect(moves).toContainEqual({
      from: 'e1',

      to: 'c1',
    });
  });

  it('does not castle through check', () => {
    // White rook on f1 side attacked — cannot castle kingside through f1
    const fen = '4k2r/8/8/8/8/8/8/R3K2r w KQ - 0 1';
    const moves = generateMoves(fromFen(fen), 'e1');
    expect(moves).not.toContainEqual({
      from: 'e1',

      to: 'g1',
    });
  });
});

describe('generateMoves — en passant', () => {
  it('includes en passant capture', () => {
    // White pawn on e5, black just played d7-d5 (en passant target = d6)
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    const moves = generateMoves(fromFen(fen), 'e5');
    expect(moves).toContainEqual({
      from: 'e5',

      to: 'd6',
    });
  });
});

describe('generateMoves — promotion', () => {
  it('includes all 4 promotion targets', () => {
    // Black king on a8, white king on a1, white pawn on e7 — clear path to e8
    const fen = 'k7/4P3/8/8/8/8/8/K7 w - - 0 1';
    const moves = generateMoves(fromFen(fen), 'e7');
    expect(moves).toContainEqual({ from: 'e7', to: 'e8', promotion: 'queen' });
    expect(moves).toContainEqual({ from: 'e7', to: 'e8', promotion: 'rook' });
    expect(moves).toContainEqual({ from: 'e7', to: 'e8', promotion: 'bishop' });
    expect(moves).toContainEqual({ from: 'e7', to: 'e8', promotion: 'knight' });
  });
});

describe('move()', () => {
  it('returns position and result', () => {
    const position = fromFen(STARTING_FEN);
    const { position: next, result } = move(position, { from: 'e2', to: 'e4' });
    expect(next.at('e4')).toEqual({ color: 'white', type: 'pawn' });
    expect(next.at('e2')).toBeUndefined();
    expect(result).toEqual({
      from: 'e2',
      to: 'e4',
      piece: { color: 'white', type: 'pawn' },
    });
  });

  it('sets en passant square on double pawn push', () => {
    const position = fromFen(STARTING_FEN);
    const { position: next } = move(position, { from: 'e2', to: 'e4' });
    expect(next.enPassantSquare).toBe('e3');
  });

  it('switches turn', () => {
    const position = fromFen(STARTING_FEN);
    const { position: next } = move(position, { from: 'e2', to: 'e4' });
    expect(next.turn).toBe('black');
  });

  it('result includes captured piece', () => {
    const fen =
      'rnbqkb1r/ppp1pppp/5n2/3p4/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const position = fromFen(fen);
    const { result } = move(position, { from: 'e4', to: 'd5' });
    expect(result.captured).toEqual({
      square: 'd5',
      piece: { color: 'black', type: 'pawn' },
    });
  });

  it('result includes en passant capture with correct square', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    const position = fromFen(fen);
    const { result } = move(position, { from: 'e5', to: 'd6' });
    expect(result.captured).toEqual({
      square: 'd5',
      piece: { color: 'black', type: 'pawn' },
    });
    expect(result.from).toBe('e5');
    expect(result.to).toBe('d6');
  });

  it('result includes castling rook movement (kingside)', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const position = fromFen(fen);
    const { result } = move(position, { from: 'e1', to: 'g1' });
    expect(result.piece).toEqual({ color: 'white', type: 'king' });
    expect(result.castling).toEqual({
      from: 'h1',
      to: 'f1',
      piece: { color: 'white', type: 'rook' },
    });
  });

  it('result includes castling rook movement (queenside)', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const position = fromFen(fen);
    const { result } = move(position, { from: 'e1', to: 'c1' });
    expect(result.castling).toEqual({
      from: 'a1',
      to: 'd1',
      piece: { color: 'white', type: 'rook' },
    });
  });

  it('result includes promotion piece', () => {
    const fen = 'k7/4P3/8/8/8/8/8/K7 w - - 0 1';
    const position = fromFen(fen);
    const { result } = move(position, {
      from: 'e7',
      to: 'e8',
      promotion: 'queen',
    });
    expect(result.piece).toEqual({ color: 'white', type: 'pawn' });
    expect(result.promotion).toEqual({ color: 'white', type: 'queen' });
  });

  it('result includes both capture and promotion', () => {
    const fen = 'k3r3/3P4/8/8/8/8/8/K7 w - - 0 1';
    const position = fromFen(fen);
    const { result } = move(position, {
      from: 'd7',
      to: 'e8',
      promotion: 'queen',
    });
    expect(result.captured).toEqual({
      square: 'e8',
      piece: { color: 'black', type: 'rook' },
    });
    expect(result.promotion).toEqual({ color: 'white', type: 'queen' });
  });
});

describe('move — castling rights on rook capture', () => {
  it('capturing rook on a1 revokes white queenside castling', () => {
    // Black bishop on b2, white a-pawn removed — bishop captures rook on a1
    const position = fromFen(
      'r3k2r/pppppppp/8/8/8/8/1bPPPPPP/R3K2R b KQkq - 0 1',
    );
    const { position: next } = move(position, { from: 'b2', to: 'a1' });
    expect(next.castlingRights.white.queen).toBe(false);
    expect(next.castlingRights.white.king).toBe(true);
  });

  it('capturing rook on h1 revokes white kingside castling', () => {
    // Black queen on h3, white g and h pawns removed — queen captures rook on h1
    const position = fromFen(
      'r3k2r/pppppppp/8/8/8/7q/PPPPPP2/R3K2R b KQkq - 0 1',
    );
    const { position: next } = move(position, { from: 'h3', to: 'h1' });
    expect(next.castlingRights.white.king).toBe(false);
    expect(next.castlingRights.white.queen).toBe(true);
  });

  it('capturing rook on a8 revokes black queenside castling', () => {
    // White queen on a3, black a-pawn removed — queen captures rook on a8
    const position = fromFen(
      'r3k2r/1ppppppp/8/8/8/Q7/PPPPPPPP/R3K2R w KQkq - 0 1',
    );
    const { position: next } = move(position, { from: 'a3', to: 'a8' });
    expect(next.castlingRights.black.queen).toBe(false);
    expect(next.castlingRights.black.king).toBe(true);
  });

  it('capturing rook on h8 revokes black kingside castling', () => {
    // White queen on h3, black g and h pawns removed — queen captures rook on h8
    const position = fromFen(
      'r3k2r/pppppp2/8/8/8/7Q/PPPPPPPP/R3K2R w KQkq - 0 1',
    );
    const { position: next } = move(position, { from: 'h3', to: 'h8' });
    expect(next.castlingRights.black.king).toBe(false);
    expect(next.castlingRights.black.queen).toBe(true);
  });
});

// Pass Position directly — avoids FEN round-trip overhead per node,
// making depth-4 positions feasible within test time.
function perft(position: Position, depth: number): number {
  if (depth === 0) {
    return 1;
  }

  const moves = generateMoves(position);
  if (depth === 1) {
    return moves.length;
  }

  let count = 0;
  for (const m of moves) {
    count += perft(move(position, m).position, depth - 1);
  }

  return count;
}

// Known perft values from https://www.chessprogramming.org/Perft_Results
// Positions 2-7 from chess.js perft.test.ts — https://github.com/jhlywa/chess.js/blob/master/__tests__/perft.test.ts

describe('perft — starting position (position 1)', () => {
  it('perft(1) = 20', () => {
    expect(perft(fromFen(STARTING_FEN), 1)).toBe(20);
  });

  it('perft(2) = 400', () => {
    expect(perft(fromFen(STARTING_FEN), 2)).toBe(400);
  });

  it('perft(3) = 8902', () => {
    expect(perft(fromFen(STARTING_FEN), 3)).toBe(8902);
  });

  it('perft(4) = 197281', { timeout: 30_000 }, () => {
    expect(perft(fromFen(STARTING_FEN), 4)).toBe(197_281);
  });
});

describe('perft — position 2 (castling, en passant)', () => {
  // r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1
  const fen =
    'r3k2r/p1ppqpb1/bn2pnp1/3PN3/1p2P3/2N2Q1p/PPPBBPPP/R3K2R w KQkq - 0 1';

  it('perft(3) = 97862', () => {
    expect(perft(fromFen(fen), 3)).toBe(97_862);
  });
});

describe('perft — position 3 (endgame pawns)', () => {
  // 8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1
  const fen = '8/2p5/3p4/KP5r/1R3p1k/8/4P1P1/8 w - - 0 1';

  it('perft(4) = 43238', { timeout: 30_000 }, () => {
    expect(perft(fromFen(fen), 4)).toBe(43_238);
  });
});

describe('perft — position 4 (promotions)', () => {
  // r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1
  const fen =
    'r2q1rk1/pP1p2pp/Q4n2/bbp1p3/Np6/1B3NBn/pPPP1PPP/R3K2R b KQ - 0 1';

  it('perft(4) = 422333', { timeout: 30_000 }, () => {
    expect(perft(fromFen(fen), 4)).toBe(422_333);
  });
});

describe('perft — position 5 (discovered checks)', () => {
  // rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8
  const fen = 'rnbq1k1r/pp1Pbppp/2p5/8/2B5/8/PPP1NnPP/RNBQK2R w KQ - 1 8';

  it('perft(3) = 62379', () => {
    expect(perft(fromFen(fen), 3)).toBe(62_379);
  });
});

describe('perft — position 6 (complex midgame)', () => {
  // r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10
  const fen =
    'r4rk1/1pp1qppp/p1np1n2/2b1p1B1/2B1P1b1/P1NP1N2/1PP1QPPP/R4RK1 w - - 0 10';

  it('perft(3) = 89890', () => {
    expect(perft(fromFen(fen), 3)).toBe(89_890);
  });
});

describe('perft — position 7 (en passant in FEN)', () => {
  // rnbqkbnr/p3pppp/2p5/1pPp4/3P4/8/PP2PPPP/RNBQKBNR w KQkq b6 0 4
  const fen = 'rnbqkbnr/p3pppp/2p5/1pPp4/3P4/8/PP2PPPP/RNBQKBNR w KQkq b6 0 4';

  it('perft(3) = 23509', () => {
    expect(perft(fromFen(fen), 3)).toBe(23_509);
  });
});
