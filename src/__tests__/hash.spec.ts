import { Position, STARTING_POSITION } from '@echecs/position';
import { describe, expect, it } from 'vitest';

import { Game } from '../game.js';
import { fromFen } from './helpers.js';

describe('zobrist hash consistency', () => {
  it('starting position has a consistent hash', () => {
    const pos1 = new Position({ board: STARTING_POSITION });
    const pos2 = new Position({ board: STARTING_POSITION });
    expect(pos1.hash).toBe(pos2.hash);
    expect(pos1.hash).toMatch(/^[\da-f]{16}$/);
  });

  it('hash changes after a move', () => {
    const game = new Game();
    const hashBefore = game.position().hash;
    game.move({ from: 'e2', to: 'e4' });
    expect(game.position().hash).not.toBe(hashBefore);
  });

  it('undo restores the previous hash', () => {
    const game = new Game();
    const hashBefore = game.position().hash;
    game.move({ from: 'e2', to: 'e4' });
    game.undo();
    expect(game.position().hash).toBe(hashBefore);
  });

  it('hash is consistent after move + undo cycle', () => {
    const game = new Game();
    const startHash = game.position().hash;

    game.move({ from: 'e2', to: 'e4' });
    const afterE4 = game.position().hash;
    game.move({ from: 'e7', to: 'e5' });

    game.undo();
    expect(game.position().hash).toBe(afterE4);
    game.undo();
    expect(game.position().hash).toBe(startHash);
  });

  it('same position reached via different move orders has the same hash', () => {
    // 1. Nf3 Nf6 2. Nc3 Nc6
    const game1 = new Game();
    game1.move({ from: 'g1', to: 'f3' });
    game1.move({ from: 'g8', to: 'f6' });
    game1.move({ from: 'b1', to: 'c3' });
    game1.move({ from: 'b8', to: 'c6' });

    // 1. Nc3 Nc6 2. Nf3 Nf6
    const game2 = new Game();
    game2.move({ from: 'b1', to: 'c3' });
    game2.move({ from: 'b8', to: 'c6' });
    game2.move({ from: 'g1', to: 'f3' });
    game2.move({ from: 'g8', to: 'f6' });

    expect(game1.position().hash).toBe(game2.position().hash);
  });

  it('hash matches for position constructed from FEN vs reached by play', () => {
    // Play 1. e4
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    const playedHash = game.position().hash;

    // Construct same position from FEN
    const fenPosition = fromFen(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    );
    expect(fenPosition.hash).toBe(playedHash);
  });

  it('different positions have different hashes', () => {
    const pos1 = fromFen(
      'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
    );
    const pos2 = fromFen(
      'rnbqkbnr/pppppppp/8/8/3P4/8/PPP1PPPP/RNBQKBNR b KQkq d3 0 1',
    );
    expect(pos1.hash).not.toBe(pos2.hash);
  });

  it('full game move/undo cycle preserves hash at every step', () => {
    const game = new Game();
    const moves = [
      { from: 'e2', to: 'e4' },
      { from: 'e7', to: 'e5' },
      { from: 'g1', to: 'f3' },
      { from: 'b8', to: 'c6' },
      { from: 'f1', to: 'b5' },
    ] as const;

    const hashes: string[] = [game.position().hash];

    for (const move of moves) {
      game.move(move);
      hashes.push(game.position().hash);
    }

    // Undo all and verify hashes in reverse
    for (let index = moves.length; index > 0; index--) {
      game.undo();
      expect(game.position().hash).toBe(hashes[index - 1]);
    }
  });
});
