import parse, { STARTING_FEN as FEN } from '@echecs/fen';
import { Position } from '@echecs/position';
import { Chess } from 'chess.js';
import { bench, describe } from 'vitest';

import { Game } from '../game.js';
import { generateMoves, move } from '../moves.js';

const STARTING_FEN = FEN;

// A mid-game position with more varied piece placement
const MIDGAME_FEN =
  'r1bqk2r/pp2bppp/2nppn2/8/3NP3/2N1B3/PPP1BPPP/R2QK2R w KQkq - 0 8';

// Fool's mate — white is in checkmate
const CHECKMATE_FEN =
  'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';

// Stalemate — black has no legal moves
const STALEMATE_FEN = 'k7/8/1QK5/8/8/8/8/8 b - - 0 1';

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

// ── Construction ─────────────────────────────────────────────────────────────

describe('new Game() [starting position]', () => {
  bench('@echecs/game', () => {
    new Game();
  });
  bench('chess.js', () => {
    new Chess();
  });
});

describe('fromFen() [starting position]', () => {
  bench('@echecs/game', () => {
    Game.fromFen(STARTING_FEN);
  });
  bench('chess.js', () => {
    new Chess(STARTING_FEN);
  });
});

describe('fromFen() [midgame]', () => {
  bench('@echecs/game', () => {
    Game.fromFen(MIDGAME_FEN);
  });
  bench('chess.js', () => {
    new Chess(MIDGAME_FEN);
  });
});

// ── Move generation ───────────────────────────────────────────────────────────

describe('moves() [starting position — 20 moves]', () => {
  const g = new Game();
  const c = new Chess();
  bench('@echecs/game', () => {
    g.moves();
  });
  bench('chess.js', () => {
    c.moves();
  });
});

describe('moves() [midgame]', () => {
  const g = Game.fromFen(MIDGAME_FEN);
  const c = new Chess(MIDGAME_FEN);
  bench('@echecs/game', () => {
    g.moves();
  });
  bench('chess.js', () => {
    c.moves();
  });
});

describe('moves({square}) [e2 — 2 moves]', () => {
  const g = new Game();
  const c = new Chess();
  bench('@echecs/game', () => {
    g.moves('e2');
  });
  bench('chess.js', () => {
    c.moves({ square: 'e2' });
  });
});

// ── Move execution ────────────────────────────────────────────────────────────

describe('move({from,to}) + undo()', () => {
  const g = new Game();
  const c = new Chess();
  bench('@echecs/game', () => {
    g.move({ from: 'e2', to: 'e4' });
    g.undo();
  });
  bench('chess.js', () => {
    c.move({ from: 'e2', to: 'e4' });
    c.undo();
  });
});

// ── Board queries ─────────────────────────────────────────────────────────────

describe('fen()', () => {
  const g = new Game();
  const c = new Chess();
  bench('@echecs/game', () => {
    g.fen();
  });
  bench('chess.js', () => {
    c.fen();
  });
});

describe('get("e1")', () => {
  const g = new Game();
  const c = new Chess();
  bench('@echecs/game', () => {
    g.get('e1');
  });
  bench('chess.js', () => {
    c.get('e1');
  });
});

// ── State detection ───────────────────────────────────────────────────────────

describe('isCheck() [starting position — false]', () => {
  const g = new Game();
  const c = new Chess();
  bench('@echecs/game', () => {
    g.isCheck();
  });
  bench('chess.js', () => {
    c.isCheck();
  });
});

describe('isCheckmate() [checkmate position — true]', () => {
  const g = Game.fromFen(CHECKMATE_FEN);
  const c = new Chess(CHECKMATE_FEN);
  bench('@echecs/game', () => {
    g.isCheckmate();
  });
  bench('chess.js', () => {
    c.isCheckmate();
  });
});

describe('isStalemate() [stalemate position — true]', () => {
  const g = Game.fromFen(STALEMATE_FEN);
  const c = new Chess(STALEMATE_FEN);
  bench('@echecs/game', () => {
    g.isStalemate();
  });
  bench('chess.js', () => {
    c.isStalemate();
  });
});

describe('isDraw() [starting position — false]', () => {
  const g = new Game();
  const c = new Chess();
  bench('@echecs/game', () => {
    g.isDraw();
  });
  bench('chess.js', () => {
    c.isDraw();
  });
});

describe('isGameOver() [starting position — false]', () => {
  const g = new Game();
  const c = new Chess();
  bench('@echecs/game', () => {
    g.isGameOver();
  });
  bench('chess.js', () => {
    c.isGameOver();
  });
});

// ── Raw perft — bypasses Game cache, no FEN round-trips, exercises move generation directly ──

function rawPerft(position: Position, depth: number): number {
  if (depth === 0) {
    return 1;
  }

  const moves = generateMoves(position);
  if (depth === 1) {
    return moves.length;
  }

  let count = 0;
  for (const m of moves) {
    count += rawPerft(move(position, m), depth - 1);
  }

  return count;
}

describe('raw perft(3) [no cache, no FEN round-trips — pure move generation]', () => {
  bench('@echecs/game', () => {
    rawPerft(fromFen(STARTING_FEN), 3);
  });
  bench('chess.js native perft', () => {
    new Chess(STARTING_FEN).perft(3);
  });
});
