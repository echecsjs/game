import { describe, expect, it } from 'vitest';

import {
  INITIAL_BOARD,
  cloneBoard,
  fileOf,
  indexToSquare,
  rankOf,
  squareToIndex,
} from '../board.js';

describe('squareToIndex', () => {
  it('maps a1 to 0', () => {
    expect(squareToIndex('a1')).toBe(0);
  });
  it('maps h1 to 7', () => {
    expect(squareToIndex('h1')).toBe(7);
  });
  it('maps a8 to 56', () => {
    expect(squareToIndex('a8')).toBe(56);
  });
  it('maps h8 to 63', () => {
    expect(squareToIndex('h8')).toBe(63);
  });
  it('maps e4 to 28', () => {
    expect(squareToIndex('e4')).toBe(28);
  });
});

describe('indexToSquare', () => {
  it('maps 0 to a1', () => {
    expect(indexToSquare(0)).toBe('a1');
  });
  it('maps 63 to h8', () => {
    expect(indexToSquare(63)).toBe('h8');
  });
  it('maps 28 to e4', () => {
    expect(indexToSquare(28)).toBe('e4');
  });
});

describe('rankOf', () => {
  it('returns 1 for a1', () => {
    expect(rankOf('a1')).toBe(1);
  });
  it('returns 8 for h8', () => {
    expect(rankOf('h8')).toBe(8);
  });
});

describe('fileOf', () => {
  it('returns 1 for a1 (a=1)', () => {
    expect(fileOf('a1')).toBe(1);
  });
  it('returns 8 for h8 (h=8)', () => {
    expect(fileOf('h8')).toBe(8);
  });
});

describe('INITIAL_BOARD', () => {
  it('has a white king on e1', () => {
    expect(INITIAL_BOARD[squareToIndex('e1')]).toEqual({
      color: 'w',
      type: 'k',
    });
  });
  it('has a black pawn on e7', () => {
    expect(INITIAL_BOARD[squareToIndex('e7')]).toEqual({
      color: 'b',
      type: 'p',
    });
  });
  it('has undefined on e4', () => {
    expect(INITIAL_BOARD[squareToIndex('e4')]).toBeUndefined();
  });
  it('has 32 pieces total', () => {
    expect(INITIAL_BOARD.filter(Boolean)).toHaveLength(32);
  });
});

describe('cloneBoard', () => {
  it('returns a new array', () => {
    const clone = cloneBoard(INITIAL_BOARD);
    expect(clone).not.toBe(INITIAL_BOARD);
  });
  it('has the same content', () => {
    const clone = cloneBoard(INITIAL_BOARD);
    expect(clone).toEqual([...INITIAL_BOARD]);
  });
});
