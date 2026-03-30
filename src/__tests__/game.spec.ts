import { Position } from '@echecs/position';
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
      /^Illegal move:/,
    );
  });

  it('returns this for chaining', () => {
    const game = new Game();
    const result = game.move({ from: 'e2', to: 'e4' });
    expect(result).toBe(game);
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
    const game = Game.fromFen(
      'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
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
    const game = Game.fromFen('k7/4P3/8/8/8/8/8/K7 w - - 0 1');
    expect(() => game.move({ from: 'e7', to: 'e8' })).toThrow(
      'Illegal move: pawn must promote on e8',
    );
  });

  it('reports promotion not allowed on non-promotion square', () => {
    expect(() =>
      new Game().move({ from: 'e2', promotion: 'q', to: 'e4' }),
    ).toThrow('Illegal move: promotion not allowed on e4');
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
    expect(game.history()[0]).toEqual({
      from: 'e2',
      promotion: undefined,
      to: 'e4',
    });
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

describe('position()', () => {
  it('returns a Position instance', () => {
    expect(new Game().position()).toBeInstanceOf(Position);
  });

  it('position has correct turn', () => {
    expect(new Game().position().turn).toBe('w');
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

// isAttacked tests ported from chess.js is-attacked.test.ts
// https://github.com/jhlywa/chess.js/blob/master/__tests__/is-attacked.test.ts

describe('isAttacked', () => {
  it('white pawn attacks diagonally', () => {
    const game = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('d3', 'w')).toBe(true);
    expect(game.isAttacked('f3', 'w')).toBe(true);
  });

  it('white pawn does not attack forward squares', () => {
    const game = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('e3', 'w')).toBe(false);
    expect(game.isAttacked('e4', 'w')).toBe(false);
  });

  it('black pawn attacks diagonally', () => {
    const game = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('f6', 'b')).toBe(true);
    expect(game.isAttacked('d6', 'b')).toBe(true);
  });

  it('black pawn does not attack forward squares', () => {
    const game = Game.fromFen('4k3/4p3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('e6', 'b')).toBe(false);
    expect(game.isAttacked('e5', 'b')).toBe(false);
  });

  it('knight attacks', () => {
    const game = Game.fromFen('4k3/4p3/8/8/4N3/8/8/4K3 w - - 0 1');
    const attacked = ['d2', 'f2', 'c3', 'g3', 'd6', 'f6', 'c5', 'g5'] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'w')).toBe(true);
    }
    expect(game.isAttacked('e4', 'w')).toBe(false); // same square
  });

  it('bishop attacks along diagonals', () => {
    const game = Game.fromFen('4k3/4p3/8/8/4b3/8/8/4K3 w - - 0 1');
    const attacked = [
      'b1',
      'c2',
      'd3',
      'f5',
      'g6',
      'h7',
      'a8',
      'b7',
      'c6',
      'd5',
      'f3',
      'g2',
      'h1',
    ] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'b')).toBe(true);
    }
    expect(game.isAttacked('e4', 'b')).toBe(false); // same square
  });

  it('rook attacks along ranks and files (including own pieces)', () => {
    const game = Game.fromFen('4k3/4n3/8/8/8/4R3/8/4K3 w - - 0 1');
    const attacked = [
      'e1',
      'e2',
      'e4',
      'e5',
      'e6',
      'e7',
      'a3',
      'b3',
      'c3',
      'd3',
      'f3',
      'g3',
      'h3',
    ] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'w')).toBe(true);
    }
    expect(game.isAttacked('e3', 'w')).toBe(false); // same square
  });

  it('rook does not x-ray through pieces', () => {
    const game = Game.fromFen('4k3/4n3/8/8/8/4R3/8/4K3 w - - 0 1');
    expect(game.isAttacked('e8', 'w')).toBe(false);
  });

  it('queen attacks in all directions', () => {
    const game = Game.fromFen('4k3/4n3/8/8/8/4q3/4P3/4K3 w - - 0 1');
    const attacked = [
      'e2',
      'e4',
      'e5',
      'e6',
      'e7',
      'a3',
      'b3',
      'c3',
      'd3',
      'f3',
      'g3',
      'h3',
      'c1',
      'd2',
      'f4',
      'g5',
      'h6',
      'g1',
      'f2',
      'd4',
      'c5',
      'b6',
      'a7',
    ] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'b')).toBe(true);
    }
    expect(game.isAttacked('e3', 'b')).toBe(false); // same square
  });

  it('king attacks adjacent squares (including own pieces)', () => {
    const game = Game.fromFen('4k3/4n3/8/8/8/4q3/4P3/4K3 w - - 0 1');
    const attacked = ['e2', 'd1', 'd2', 'f1', 'f2'] as const;
    for (const sq of attacked) {
      expect(game.isAttacked(sq, 'w')).toBe(true);
    }
    expect(game.isAttacked('e1', 'w')).toBe(false); // same square
  });

  it('pinned piece still attacks', () => {
    const game = Game.fromFen('4k3/4r3/8/8/8/8/4P3/4K3 w - - 0 1');
    expect(game.isAttacked('d3', 'w')).toBe(true);
    expect(game.isAttacked('f3', 'w')).toBe(true);
  });

  it('doc test examples', () => {
    const game = new Game();
    expect(game.isAttacked('f3', 'w')).toBe(true);
    expect(game.isAttacked('f6', 'b')).toBe(true);
    expect(game.isAttacked('e2', 'w')).toBe(true);
  });
});
