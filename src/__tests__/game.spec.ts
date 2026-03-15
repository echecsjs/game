import { describe, expect, it } from 'vitest';

import { Game } from '../game.js';

describe('new Game()', () => {
  it('starts with white to move', () => {
    expect(new Game().turn()).toBe('w');
  });

  it('has 20 legal moves', () => {
    expect(new Game().moves()).toHaveLength(20);
  });

  it('get() returns white pawn on e2', () => {
    expect(new Game().get('e2')).toEqual({ color: 'w', type: 'p' });
  });

  it('get() returns undefined on e4', () => {
    expect(new Game().get('e4')).toBeUndefined();
  });
});

describe('Game.fromFen()', () => {
  it('loads a custom position', () => {
    const game = Game.fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(game.turn()).toBe('w');
    expect(game.get('e1')).toEqual({ color: 'w', type: 'k' });
  });

  it('throws on invalid FEN', () => {
    expect(() => Game.fromFen('bad fen')).toThrow(Error);
  });
});

describe('move()', () => {
  it('applies a legal move', () => {
    const game = new Game().move({ from: 'e2', to: 'e4' });
    expect(game.get('e4')).toEqual({ color: 'w', type: 'p' });
    expect(game.get('e2')).toBeUndefined();
  });

  it('switches turn after move', () => {
    expect(new Game().move({ from: 'e2', to: 'e4' }).turn()).toBe('b');
  });

  it('throws on illegal move', () => {
    expect(() => new Game().move({ from: 'e2', to: 'e5' })).toThrow(
      'Illegal move: e2 → e5',
    );
  });

  it('returns this for chaining', () => {
    const game = new Game();
    const result = game.move({ from: 'e2', to: 'e4' });
    expect(result).toBe(game);
  });
});

describe('undo() / redo()', () => {
  it('undoes a move', () => {
    const game = new Game().move({ from: 'e2', to: 'e4' });
    game.undo();
    expect(game.get('e2')).toEqual({ color: 'w', type: 'p' });
    expect(game.get('e4')).toBeUndefined();
  });

  it('undo at start is a no-op', () => {
    const game = new Game();
    expect(() => game.undo()).not.toThrow();
    expect(game.turn()).toBe('w');
  });

  it('redoes an undone move', () => {
    const game = new Game().move({ from: 'e2', to: 'e4' });
    game.undo();
    game.redo();
    expect(game.get('e4')).toEqual({ color: 'w', type: 'p' });
  });

  it('redo at end is a no-op', () => {
    const game = new Game();
    expect(() => game.redo()).not.toThrow();
  });

  it('new move clears redo stack', () => {
    const game = new Game().move({ from: 'e2', to: 'e4' });
    game.undo();
    game.move({ from: 'd2', to: 'd4' });
    game.redo(); // should be a no-op
    expect(game.get('e4')).toBeUndefined();
  });
});

describe('history()', () => {
  it('starts empty', () => {
    expect(new Game().history()).toHaveLength(0);
  });

  it('records moves', () => {
    const game = new Game().move({ from: 'e2', to: 'e4' });
    expect(game.history()).toHaveLength(1);
    expect(game.history()[0]).toEqual({ from: 'e2', to: 'e4' });
  });

  it('excludes undone moves', () => {
    const game = new Game().move({ from: 'e2', to: 'e4' });
    game.undo();
    expect(game.history()).toHaveLength(0);
  });
});

describe('fen()', () => {
  it('returns starting FEN for new game', () => {
    expect(new Game().fen()).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
  });
});

describe('board()', () => {
  it('returns 8 ranks', () => {
    expect(new Game().board()).toHaveLength(8);
  });

  it('each rank has 8 files', () => {
    for (const rank of new Game().board()) {
      expect(rank).toHaveLength(8);
    }
  });

  it('rank 0, file 4 (e1) is white king', () => {
    expect(new Game().board()[0]?.[4]).toEqual({ color: 'w', type: 'k' });
  });
});

describe('isCheck / isCheckmate / isStalemate / isDraw / isGameOver', () => {
  it('starting position: none active', () => {
    const game = new Game();
    expect(game.isCheck()).toBe(false);
    expect(game.isCheckmate()).toBe(false);
    expect(game.isStalemate()).toBe(false);
    expect(game.isDraw()).toBe(false);
    expect(game.isGameOver()).toBe(false);
  });

  it("detects checkmate (fool's mate)", () => {
    const game = Game.fromFen(
      'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    );
    expect(game.isCheck()).toBe(true);
    expect(game.isCheckmate()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });

  it('detects stalemate', () => {
    const game = Game.fromFen('k7/8/1QK5/8/8/8/8/8 b - - 0 1');
    expect(game.isStalemate()).toBe(true);
    expect(game.isDraw()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });
});

describe('moves() filtered by square', () => {
  it('returns moves only for that square', () => {
    const game = new Game();
    const moves = game.moves('e2');
    expect(moves).toHaveLength(2);
    expect(moves.every((m) => m.from === 'e2')).toBe(true);
  });
});

// Regression tests — ported from chess.js regression.test.ts
// https://github.com/jhlywa/chess.js/blob/master/__tests__/regression.test.ts

describe('regression', () => {
  it('issue #552 — invalid castling rights in FEN should not crash isGameOver', () => {
    // Position has castling rights set but rooks/king not in castling positions.
    // chess.js was crashing due to invalid castling moves being generated.
    const game = Game.fromFen(
      'kb4r1/p2n3P/1PP5/1P6/8/8/6p1/R3KR2 b KQkq - 0 19',
    );
    expect(() => game.isGameOver()).not.toThrow();
    expect(game.isGameOver()).toBe(false);
  });
});
