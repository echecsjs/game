/* eslint-disable vitest/expect-expect -- benchmarks measure via the bench fixture, not assertions */

import { STARTING_FEN as FEN } from '@echecs/fen';
import { Chess } from 'chess.js';
import { describe, test } from 'vitest';

import { Game } from '../game.js';
import { fromFen } from './helpers.js';

const STARTING_FEN = FEN;

// A mid-game position with more varied piece placement
const MIDGAME_FEN =
  'r1bqk2r/pp2bppp/2nppn2/8/3NP3/2N1B3/PPP1BPPP/R2QK2R w KQkq - 0 8';

// Fool's mate — white is in checkmate
const CHECKMATE_FEN =
  'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';

// Stalemate — black has no legal moves
const STALEMATE_FEN = 'k7/8/1QK5/8/8/8/8/8 b - - 0 1';

// ── Construction ─────────────────────────────────────────────────────────────

describe('new Game() [starting position]', () => {
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      new Game();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      new Chess();
    }).run();
  });
});

describe('new Game(fromFen()) [starting position]', () => {
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      new Game(fromFen(STARTING_FEN));
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      new Chess(STARTING_FEN);
    }).run();
  });
});

describe('new Game(fromFen()) [midgame]', () => {
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      new Game(fromFen(MIDGAME_FEN));
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      new Chess(MIDGAME_FEN);
    }).run();
  });
});

// ── Move generation ───────────────────────────────────────────────────────────

describe('moves() [starting position — 20 moves, uncached]', () => {
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      new Game().moves();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      new Chess().moves();
    }).run();
  });
});

describe('moves() [midgame, uncached]', () => {
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      new Game(fromFen(MIDGAME_FEN)).moves();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      new Chess(MIDGAME_FEN).moves();
    }).run();
  });
});

describe('moves({square}) [e2 — 2 moves, uncached]', () => {
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      new Game().moves('e2');
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      new Chess().moves({ square: 'e2' });
    }).run();
  });
});

// ── Move execution ────────────────────────────────────────────────────────────

describe('move({from,to}) + undo()', () => {
  const g = new Game();
  const c = new Chess();
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      g.move({ from: 'e2', to: 'e4' });
      g.undo();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      c.move({ from: 'e2', to: 'e4' });
      c.undo();
    }).run();
  });
});

// ── Board queries ─────────────────────────────────────────────────────────────

describe('position()', () => {
  const g = new Game();
  const c = new Chess();
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      g.position();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      c.fen();
    }).run();
  });
});

describe('get("e1")', () => {
  const g = new Game();
  const c = new Chess();
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      g.get('e1');
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      c.get('e1');
    }).run();
  });
});

// ── State detection ───────────────────────────────────────────────────────────

describe('isCheck() [starting position — false]', () => {
  const g = new Game();
  const c = new Chess();
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      g.isCheck();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      c.isCheck();
    }).run();
  });
});

describe('isCheckmate() [checkmate position — true]', () => {
  const g = new Game(fromFen(CHECKMATE_FEN));
  const c = new Chess(CHECKMATE_FEN);
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      g.isCheckmate();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      c.isCheckmate();
    }).run();
  });
});

describe('isStalemate() [stalemate position — true]', () => {
  const g = new Game(fromFen(STALEMATE_FEN));
  const c = new Chess(STALEMATE_FEN);
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      g.isStalemate();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      c.isStalemate();
    }).run();
  });
});

describe('isDraw() [starting position — false]', () => {
  const g = new Game();
  const c = new Chess();
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      g.isDraw();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      c.isDraw();
    }).run();
  });
});

describe('isGameOver() [starting position — false]', () => {
  const g = new Game();
  const c = new Chess();
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      g.isGameOver();
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      c.isGameOver();
    }).run();
  });
});

// ── Perft — recursive move generation + execution ────────────────────────────

function perft(game: Game, depth: number): number {
  if (depth === 0) {
    return 1;
  }

  const moves = game.moves();
  if (depth === 1) {
    return moves.length;
  }

  let count = 0;
  for (const m of moves) {
    game.move({ from: m.from, promotion: m.promotion, to: m.to });
    count += perft(game, depth - 1);
    game.undo();
  }

  return count;
}

describe('perft(3) [starting position — 8,902 nodes]', () => {
  test('@echecs/game', async ({ bench }) => {
    await bench('@echecs/game', () => {
      perft(new Game(), 3);
    }).run();
  });
  test('chess.js', async ({ bench }) => {
    await bench('chess.js', () => {
      new Chess(STARTING_FEN).perft(3);
    }).run();
  });
});
