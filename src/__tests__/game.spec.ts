import { Position } from '@echecs/position';
import { describe, expect, it } from 'vitest';

import { Game } from '../game.js';
import { fromFen } from './helpers.js';

describe('new Game()', () => {
  it('starts with white to move', () => {
    expect(new Game().turn()).toBe('white');
  });

  it('has 20 legal moves', () => {
    expect(new Game().moves()).toHaveLength(20);
  });

  it('get() returns white pawn on e2', () => {
    expect(new Game().get('e2')).toEqual({ color: 'white', type: 'pawn' });
  });

  it('get() returns undefined on e4', () => {
    expect(new Game().get('e4')).toBeUndefined();
  });
});

describe('move()', () => {
  it('applies a legal move and returns MoveResult', () => {
    const game = new Game();
    const result = game.move({ from: 'e2', to: 'e4' });
    expect(game.get('e4')).toEqual({ color: 'white', type: 'pawn' });
    expect(game.get('e2')).toBeUndefined();
    expect(result).toEqual({
      from: 'e2',
      to: 'e4',
      piece: { color: 'white', type: 'pawn' },
    });
  });

  it('switches turn after move', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    expect(game.turn()).toBe('black');
  });

  it('throws on illegal move', () => {
    expect(() => new Game().move({ from: 'e2', to: 'e5' })).toThrow(
      /^Illegal move:/,
    );
  });

  it('returns MoveResult with capture info', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.move({ from: 'd7', to: 'd5' });
    const result = game.move({ from: 'e4', to: 'd5' });
    expect(result.captured).toEqual({
      square: 'd5',
      piece: { color: 'black', type: 'pawn' },
    });
  });

  it('returns MoveResult with castling info', () => {
    const game = new Game(
      fromFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'),
    );
    const result = game.move({ from: 'e1', to: 'g1' });
    expect(result.castling).toEqual({
      from: 'h1',
      to: 'f1',
      piece: { color: 'white', type: 'rook' },
    });
  });

  it('returns MoveResult with promotion info', () => {
    const game = new Game(fromFen('k7/4P3/8/8/8/8/8/K7 w - - 0 1'));
    const result = game.move({ from: 'e7', to: 'e8', promotion: 'queen' });
    expect(result.promotion).toEqual({ color: 'white', type: 'queen' });
    expect(result.piece).toEqual({ color: 'white', type: 'pawn' });
  });

  it('returns MoveResult with en passant capture', () => {
    const game = new Game(
      fromFen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3'),
    );
    const result = game.move({ from: 'e5', to: 'd6' });
    expect(result.captured).toEqual({
      square: 'd5',
      piece: { color: 'black', type: 'pawn' },
    });
  });
});

describe('move() error messages', () => {
  it('reports no piece on empty square', () => {
    expect(() => new Game().move({ from: 'e4', to: 'e5' })).toThrow(
      'Illegal move: no piece on e4',
    );
  });

  it('reports opponent piece on square', () => {
    expect(() => new Game().move({ from: 'e7', to: 'e6' })).toThrow(
      'Illegal move: e7 is not yours',
    );
  });

  it('reports game is over', () => {
    const game = new Game(
      fromFen('rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'),
    );
    expect(() => game.move({ from: 'a2', to: 'a3' })).toThrow(
      'Illegal move: game is over',
    );
  });

  it('reports piece has no legal moves', () => {
    expect(() => new Game().move({ from: 'a1', to: 'a3' })).toThrow(
      'Illegal move: a1 rook has no legal moves',
    );
  });

  it('reports piece cannot reach target', () => {
    expect(() => new Game().move({ from: 'e2', to: 'e5' })).toThrow(
      'Illegal move: e2 pawn cannot move to e5',
    );
  });

  it('reports missing promotion', () => {
    const game = new Game(fromFen('k7/4P3/8/8/8/8/8/K7 w - - 0 1'));
    expect(() => game.move({ from: 'e7', to: 'e8' })).toThrow(
      'Illegal move: pawn must promote on e8',
    );
  });

  it('reports promotion not allowed on non-promotion square', () => {
    expect(() =>
      new Game().move({ from: 'e2', promotion: 'queen', to: 'e4' }),
    ).toThrow('Illegal move: promotion not allowed on e4');
  });
});

describe('undo() / redo()', () => {
  it('undoes a move', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.undo();
    expect(game.get('e2')).toEqual({ color: 'white', type: 'pawn' });
    expect(game.get('e4')).toBeUndefined();
  });

  it('undo at start is a no-op', () => {
    const game = new Game();
    expect(() => game.undo()).not.toThrow();
    expect(game.turn()).toBe('white');
  });

  it('redoes an undone move', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.undo();
    game.redo();
    expect(game.get('e4')).toEqual({ color: 'white', type: 'pawn' });
  });

  it('redo at end is a no-op', () => {
    const game = new Game();
    expect(() => game.redo()).not.toThrow();
  });

  it('new move clears redo stack', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
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
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    expect(game.history()).toHaveLength(1);
    expect(game.history()[0]).toEqual({
      from: 'e2',
      to: 'e4',
    });
  });

  it('excludes undone moves', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.undo();
    expect(game.history()).toHaveLength(0);
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
    expect(new Game().board()[0]?.[4]).toEqual({
      color: 'white',
      type: 'king',
    });
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
    const game = new Game(
      fromFen('rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3'),
    );
    expect(game.isCheck()).toBe(true);
    expect(game.isCheckmate()).toBe(true);
    expect(game.isGameOver()).toBe(true);
  });

  it('detects stalemate', () => {
    const game = new Game(fromFen('k7/8/1QK5/8/8/8/8/8 b - - 0 1'));
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

describe('position()', () => {
  it('returns a Position instance', () => {
    expect(new Game().position()).toBeInstanceOf(Position);
  });

  it('position has correct turn', () => {
    expect(new Game().position().turn).toBe('white');
  });
});

// Regression tests — ported from chess.js regression.test.ts
// https://github.com/jhlywa/chess.js/blob/master/__tests__/regression.test.ts

describe('regression', () => {
  it('issue #552 — invalid castling rights in FEN should not crash isGameOver', () => {
    // Position has castling rights set but rooks/king not in castling positions.
    // chess.js was crashing due to invalid castling moves being generated.
    const game = new Game(
      fromFen('kb4r1/p2n3P/1PP5/1P6/8/8/6p1/R3KR2 b KQkq - 0 19'),
    );
    expect(() => game.isGameOver()).not.toThrow();
    expect(game.isGameOver()).toBe(false);
  });
});
