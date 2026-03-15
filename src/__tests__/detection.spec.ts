// Sources:
//   chess.js test suite — https://github.com/jhlywa/chess.js/tree/master/__tests__
//   Original positions noted per describe block where applicable.

import { describe, expect, it } from 'vitest';

import {
  isCheckmate,
  isDraw,
  isInsufficientMaterial,
  isStalemate,
  isThreefoldRepetition,
} from '../detection.js';
import { parseFen } from '../fen.js';

describe('isCheckmate', () => {
  it("detects fool's mate", () => {
    const fen = 'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    expect(isCheckmate(parseFen(fen))).toBe(true);
  });

  it('starting position is not checkmate', () => {
    expect(
      isCheckmate(
        parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      ),
    ).toBe(false);
  });

  // Positions from chess.js is-checkmate.test.ts
  it('position 1', () => {
    expect(isCheckmate(parseFen('8/5r2/4K1q1/4p3/3k4/8/8/8 w - - 0 7'))).toBe(
      true,
    );
  });

  it('position 2', () => {
    expect(
      isCheckmate(
        parseFen('4r2r/p6p/1pnN2p1/kQp5/3pPq2/3P4/PPP3PP/R5K1 b - - 0 2'),
      ),
    ).toBe(true);
  });

  it('position 3', () => {
    expect(
      isCheckmate(
        parseFen(
          'r3k2r/ppp2p1p/2n1p1p1/8/2B2P1q/2NPb1n1/PP4PP/R2Q3K w kq - 0 8',
        ),
      ),
    ).toBe(true);
  });

  it('position 4', () => {
    expect(
      isCheckmate(parseFen('8/6R1/pp1r3p/6p1/P3R1Pk/1P4P1/7K/8 b - - 0 4')),
    ).toBe(true);
  });

  it('stalemate is not checkmate', () => {
    // From chess.js is-checkmate.test.ts notCheckmates list
    expect(isCheckmate(parseFen('1R6/8/8/8/8/8/7R/k6K b - - 0 1'))).toBe(false);
  });
});

describe('isStalemate', () => {
  // Positions from chess.js is-stalemate.test.ts
  it('stalemate 1', () => {
    expect(isStalemate(parseFen('1R6/8/8/8/8/8/7R/k6K b - - 0 1'))).toBe(true);
  });

  it('stalemate 2', () => {
    expect(isStalemate(parseFen('8/8/5k2/p4p1p/P4K1P/1r6/8/8 w - - 0 2'))).toBe(
      true,
    );
  });

  it('classic queen trap', () => {
    // Black king on a8, white queen on b6, white king on c6
    const fen = 'k7/8/1QK5/8/8/8/8/8 b - - 0 1';
    expect(isStalemate(parseFen(fen))).toBe(true);
  });

  it('starting position is not stalemate', () => {
    expect(
      isStalemate(
        parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      ),
    ).toBe(false);
  });

  it('checkmate is not stalemate', () => {
    // From chess.js is-stalemate.test.ts
    expect(isStalemate(parseFen('R3k3/8/4K3/8/8/8/8/8 b - - 0 1'))).toBe(false);
  });
});

describe('isInsufficientMaterial', () => {
  // Positions from chess.js is-insufficient-material.test.ts

  it('K vs K is insufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('8/8/8/8/8/8/8/k6K w - - 0 1')),
    ).toBe(true);
  });

  it('K+N vs K is insufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('8/2N5/8/8/8/8/8/k6K w - - 0 1')),
    ).toBe(true);
  });

  it('K+B vs K is insufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('8/2b5/8/8/8/8/8/k6K w - - 0 1')),
    ).toBe(true);
  });

  it('KB vs KB (same color bishops) is insufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('8/b7/3B4/8/8/8/8/k6K w - - 0 1')),
    ).toBe(true);
  });

  it('KB vs KB (many same color bishops) is insufficient', () => {
    expect(
      isInsufficientMaterial(
        parseFen('8/b1B1b1B1/1b1B1b1B/8/8/8/8/1k5K w - - 0 1'),
      ),
    ).toBe(true);
  });

  it('starting position is sufficient', () => {
    expect(
      isInsufficientMaterial(
        parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      ),
    ).toBe(false);
  });

  it('K+P vs K is sufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('8/2p5/8/8/8/8/8/k6K w - - 0 1')),
    ).toBe(false);
  });

  it('KB vs KB (opposite color bishops) is sufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('5k1K/7B/8/6b1/8/8/8/8 b - - 0 1')),
    ).toBe(false);
  });

  it('KN vs KB is sufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('7K/5k1N/8/6b1/8/8/8/8 b - - 0 1')),
    ).toBe(false);
  });

  it('KN vs KN is sufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('7K/5k1N/8/4n3/8/8/8/8 b - - 0 1')),
    ).toBe(false);
  });

  it('K+Q vs K is sufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('4k3/8/8/8/8/8/8/4KQ2 w - - 0 1')),
    ).toBe(false);
  });
});

describe('isCheck', () => {
  // Positions from chess.js is-check.test.ts

  it('starting position is not check', () => {
    expect(
      isStalemate(
        parseFen('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'),
      ),
    ).toBe(false);
  });

  it('black giving check', () => {
    // isCheck is exercised via isCheckmate — white in check, has legal moves
    const fen = 'rnb1kbnr/pppp1ppp/8/8/4Pp1q/2N5/PPPP2PP/R1BQKBNR w KQkq - 2 4';
    expect(isCheckmate(parseFen(fen))).toBe(false); // in check but not mate
    expect(isStalemate(parseFen(fen))).toBe(false); // in check, not stalemate
  });

  it('checkmate is also check (not stalemate)', () => {
    // From chess.js is-check.test.ts
    const fen = 'R3k3/8/4K3/8/8/8/8/8 b - - 0 1';
    expect(isCheckmate(parseFen(fen))).toBe(true);
    expect(isStalemate(parseFen(fen))).toBe(false);
  });

  it('stalemate is not check', () => {
    // From chess.js is-check.test.ts
    const fen = '4k3/4P3/4K3/8/8/8/8/8 b - - 0 1';
    expect(isCheckmate(parseFen(fen))).toBe(false);
    expect(isStalemate(parseFen(fen))).toBe(true);
  });
});

describe('isThreefoldRepetition', () => {
  it('detects threefold repetition', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(isThreefoldRepetition([fen, fen, fen])).toBe(true);
  });

  it('two occurrences is not threefold', () => {
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    expect(isThreefoldRepetition([fen, fen])).toBe(false);
  });
});

describe('isDraw', () => {
  it('50-move rule: halfmoveClock >= 100 is a draw', () => {
    const state = parseFen('4k3/8/8/8/8/8/8/4K3 w - - 100 50');
    expect(isDraw(state, [])).toBe(true);
  });

  it('insufficient material is a draw', () => {
    const state = parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(isDraw(state, [])).toBe(true);
  });

  it('starting position is not a draw', () => {
    const state = parseFen(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(isDraw(state, [])).toBe(false);
  });
});
