import { parse } from '@echecs/san';
import { describe, expect, it } from 'vitest';

import { Game } from '../game.js';

const MOVES = [
  'c4',
  'e6',
  'Nf3',
  'd5',
  'd4',
  'Nf6',
  'Nc3',
  'Be7',
  'Bg5',
  'O-O',
  'e3',
  'h6',
  'Bh4',
  'b6',
  'cxd5',
  'Nxd5',
  'Bxe7',
  'Qxe7',
  'Nxd5',
  'exd5',
  'Rc1',
  'Be6',
  'Qa4',
  'c5',
  'Qa3',
  'Rc8',
  'Bb5',
  'a6',
  'dxc5',
  'bxc5',
  'O-O',
  'Ra7',
  'Be2',
  'Nd7',
  'Nd4',
  'Qf8',
  'Nxe6',
  'fxe6',
  'e4',
  'd4',
  'f4',
  'Qe7',
  'e5',
  'Rb8',
  'Bc4',
  'Kh8',
  'Qh3',
  'Nf8',
  'b3',
  'a5',
  'f5',
  'exf5',
  'Rxf5',
  'Nh7',
  'Rcf1',
  'Qd8',
  'Qg3',
  'Re7',
  'h4',
  'Rbb7',
  'e6',
  'Rbc7',
  'Qe5',
  'Qe8',
  'a4',
  'Qd8',
  'R1f2',
  'Qe8',
  'R2f3',
  'Qd8',
  'Bd3',
  'Qe8',
  'Qe4',
  'Nf6',
  'Rxf6',
  'gxf6',
  'Rxf6',
  'Kg8',
  'Bc4',
  'Kh8',
  'Qf4',
];

describe('full game playthrough (Fischer-Spassky 1972 Game 6)', () => {
  it('plays all 81 moves without errors', () => {
    const game = new Game();

    for (const san of MOVES) {
      const move = parse(san, game.position());

      if (!move) {
        throw new Error(`parse("${san}") returned null`);
      }

      game.move(move);
    }

    expect(game.history()).toHaveLength(81);
  });

  it('reaches the expected final position', () => {
    const game = new Game();

    for (const san of MOVES) {
      const move = parse(san, game.position());

      if (!move) {
        throw new Error(`parse("${san}") returned null`);
      }

      game.move(move);
    }

    expect(game.turn()).toBe('black');
    expect(game.isGameOver()).toBe(false);
    expect(game.isCheck()).toBe(false);
  });

  it('undo all moves returns to starting position', () => {
    const game = new Game();
    const startingHash = game.position().hash;

    for (const san of MOVES) {
      const move = parse(san, game.position());

      if (!move) {
        throw new Error(`parse("${san}") returned null`);
      }

      game.move(move);
    }

    let undoCount = MOVES.length;
    while (undoCount-- > 0) {
      game.undo();
    }

    expect(game.position().hash).toBe(startingHash);
    expect(game.history()).toHaveLength(0);
  });
});
