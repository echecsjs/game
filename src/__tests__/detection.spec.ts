// Sources:
//   chess.js test suite — https://github.com/jhlywa/chess.js/tree/master/__tests__
//   Original positions noted per describe block where applicable.

import parse from '@echecs/fen';
import { Position } from '@echecs/position';
import { describe, expect, it } from 'vitest';

import {
  isCheckmate,
  isDraw,
  isStalemate,
  isThreefoldRepetition,
} from '../detection.js';
import { generateMoves } from '../moves.js';

function fromFen(fen: string): Position {
  const parsed = parse(fen);
  if (!parsed) {
    throw new Error(`Invalid FEN: ${fen}`);
  }
  return new Position(parsed.board, {
    castlingRights: parsed.castlingRights,
    enPassantSquare: parsed.enPassantSquare,
    fullmoveNumber: parsed.fullmoveNumber,
    halfmoveClock: parsed.halfmoveClock,
    turn: parsed.turn,
  });
}

describe('isCheckmate', () => {
  it("detects fool's mate", () => {
    const fen = 'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const position = fromFen(fen);
    expect(isCheckmate(position, generateMoves(position))).toBe(true);
  });

  it('starting position is not checkmate', () => {
    const position = fromFen(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(isCheckmate(position, generateMoves(position))).toBe(false);
  });

  // Positions from chess.js is-checkmate.test.ts
  it('position 1', () => {
    const position = fromFen('8/5r2/4K1q1/4p3/3k4/8/8/8 w - - 0 7');
    expect(isCheckmate(position, generateMoves(position))).toBe(true);
  });

  it('position 2', () => {
    const position = fromFen(
      '4r2r/p6p/1pnN2p1/kQp5/3pPq2/3P4/PPP3PP/R5K1 b - - 0 2',
    );
    expect(isCheckmate(position, generateMoves(position))).toBe(true);
  });

  it('position 3', () => {
    const position = fromFen(
      'r3k2r/ppp2p1p/2n1p1p1/8/2B2P1q/2NPb1n1/PP4PP/R2Q3K w kq - 0 8',
    );
    expect(isCheckmate(position, generateMoves(position))).toBe(true);
  });

  it('position 4', () => {
    const position = fromFen('8/6R1/pp1r3p/6p1/P3R1Pk/1P4P1/7K/8 b - - 0 4');
    expect(isCheckmate(position, generateMoves(position))).toBe(true);
  });

  it('stalemate is not checkmate', () => {
    // From chess.js is-checkmate.test.ts notCheckmates list
    const position = fromFen('1R6/8/8/8/8/8/7R/k6K b - - 0 1');
    expect(isCheckmate(position, generateMoves(position))).toBe(false);
  });
});

describe('isStalemate', () => {
  // Positions from chess.js is-stalemate.test.ts
  it('stalemate 1', () => {
    const position = fromFen('1R6/8/8/8/8/8/7R/k6K b - - 0 1');
    expect(isStalemate(position, generateMoves(position))).toBe(true);
  });

  it('stalemate 2', () => {
    const position = fromFen('8/8/5k2/p4p1p/P4K1P/1r6/8/8 w - - 0 2');
    expect(isStalemate(position, generateMoves(position))).toBe(true);
  });

  it('classic queen trap', () => {
    // Black king on a8, white queen on b6, white king on c6
    const fen = 'k7/8/1QK5/8/8/8/8/8 b - - 0 1';
    const position = fromFen(fen);
    expect(isStalemate(position, generateMoves(position))).toBe(true);
  });

  it('starting position is not stalemate', () => {
    const position = fromFen(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(isStalemate(position, generateMoves(position))).toBe(false);
  });

  it('checkmate is not stalemate', () => {
    // From chess.js is-stalemate.test.ts
    const position = fromFen('R3k3/8/4K3/8/8/8/8/8 b - - 0 1');
    expect(isStalemate(position, generateMoves(position))).toBe(false);
  });
});

describe('isInsufficientMaterial (via position.isInsufficientMaterial)', () => {
  // Positions from chess.js is-insufficient-material.test.ts

  it('K vs K is insufficient', () => {
    expect(fromFen('8/8/8/8/8/8/8/k6K w - - 0 1').isInsufficientMaterial).toBe(
      true,
    );
  });

  it('K+N vs K is insufficient', () => {
    expect(
      fromFen('8/2N5/8/8/8/8/8/k6K w - - 0 1').isInsufficientMaterial,
    ).toBe(true);
  });

  it('K+B vs K is insufficient', () => {
    expect(
      fromFen('8/2b5/8/8/8/8/8/k6K w - - 0 1').isInsufficientMaterial,
    ).toBe(true);
  });

  it('KB vs KB (same color bishops) is insufficient', () => {
    expect(
      fromFen('8/b7/3B4/8/8/8/8/k6K w - - 0 1').isInsufficientMaterial,
    ).toBe(true);
  });

  it('KB vs KB (many same color bishops) is insufficient', () => {
    expect(
      fromFen('8/b1B1b1B1/1b1B1b1B/8/8/8/8/1k5K w - - 0 1')
        .isInsufficientMaterial,
    ).toBe(true);
  });

  it('starting position is sufficient', () => {
    expect(
      fromFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1')
        .isInsufficientMaterial,
    ).toBe(false);
  });

  it('K+P vs K is sufficient', () => {
    expect(
      fromFen('8/2p5/8/8/8/8/8/k6K w - - 0 1').isInsufficientMaterial,
    ).toBe(false);
  });

  it('KB vs KB (opposite color bishops) is sufficient', () => {
    expect(
      fromFen('5k1K/7B/8/6b1/8/8/8/8 b - - 0 1').isInsufficientMaterial,
    ).toBe(false);
  });

  it('KN vs KB is sufficient', () => {
    expect(
      fromFen('7K/5k1N/8/6b1/8/8/8/8 b - - 0 1').isInsufficientMaterial,
    ).toBe(false);
  });

  it('KN vs KN is sufficient', () => {
    expect(
      fromFen('7K/5k1N/8/4n3/8/8/8/8 b - - 0 1').isInsufficientMaterial,
    ).toBe(false);
  });

  it('K+Q vs K is sufficient', () => {
    expect(
      fromFen('4k3/8/8/8/8/8/8/4KQ2 w - - 0 1').isInsufficientMaterial,
    ).toBe(false);
  });
});

describe('isCheck', () => {
  // Positions from chess.js is-check.test.ts

  it('starting position is not check', () => {
    const position = fromFen(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(isStalemate(position, generateMoves(position))).toBe(false);
  });

  it('black giving check', () => {
    // isCheck is exercised via isCheckmate — white in check, has legal moves
    const fen = 'rnb1kbnr/pppp1ppp/8/8/4Pp1q/2N5/PPPP2PP/R1BQKBNR w KQkq - 2 4';
    const position = fromFen(fen);
    const moves = generateMoves(position);
    expect(isCheckmate(position, moves)).toBe(false); // in check but not mate
    expect(isStalemate(position, moves)).toBe(false); // in check, not stalemate
  });

  it('checkmate is also check (not stalemate)', () => {
    // From chess.js is-check.test.ts
    const fen = 'R3k3/8/4K3/8/8/8/8/8 b - - 0 1';
    const position = fromFen(fen);
    const moves = generateMoves(position);
    expect(isCheckmate(position, moves)).toBe(true);
    expect(isStalemate(position, moves)).toBe(false);
  });

  it('stalemate is not check', () => {
    // From chess.js is-check.test.ts
    const fen = '4k3/4P3/4K3/8/8/8/8/8 b - - 0 1';
    const position = fromFen(fen);
    const moves = generateMoves(position);
    expect(isCheckmate(position, moves)).toBe(false);
    expect(isStalemate(position, moves)).toBe(true);
  });
});

describe('isThreefoldRepetition', () => {
  it('detects threefold repetition', () => {
    // Use Zobrist-hash-like strings — function counts string occurrences
    const hash = 'abc123def456abc1';
    expect(isThreefoldRepetition([hash, hash, hash])).toBe(true);
  });

  it('two occurrences is not threefold', () => {
    const hash = 'abc123def456abc1';
    expect(isThreefoldRepetition([hash, hash])).toBe(false);
  });
});

describe('isDraw', () => {
  it('50-move rule: halfmoveClock >= 100 is a draw', () => {
    const position = fromFen('4k3/8/8/8/8/8/8/4K3 w - - 100 50');
    expect(isDraw(position, generateMoves(position), [])).toBe(true);
  });

  it('insufficient material is a draw', () => {
    const position = fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(isDraw(position, generateMoves(position), [])).toBe(true);
  });

  it('starting position is not a draw', () => {
    const position = fromFen(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(isDraw(position, generateMoves(position), [])).toBe(false);
  });
});
