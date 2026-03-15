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
});

describe('isStalemate', () => {
  it('detects stalemate', () => {
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
});

describe('isInsufficientMaterial', () => {
  it('K vs K is insufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1')),
    ).toBe(true);
  });

  it('K+B vs K is insufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('4k3/8/8/8/8/8/8/4KB2 w - - 0 1')),
    ).toBe(true);
  });

  it('K+N vs K is insufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('4k3/8/8/8/8/8/8/4KN2 w - - 0 1')),
    ).toBe(true);
  });

  it('K+Q vs K is sufficient', () => {
    expect(
      isInsufficientMaterial(parseFen('4k3/8/8/8/8/8/8/4KQ2 w - - 0 1')),
    ).toBe(false);
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
