// Regression tests ported from chess.js
// https://github.com/jhlywa/chess.js/blob/master/__tests__/regression.test.ts

import { describe, expect, it } from 'vitest';

import { Game } from '../game.js';
import { generateMoves, move } from '../moves.js';
import { fromFen } from './helpers.js';

describe('regression tests (ported from chess.js)', () => {
  // chess.js issue #32 — castling flag reappearing after a move
  // A move that doesn't touch king or rook squares must not affect castling rights.
  describe('issue #32 — castling rights are not incorrectly removed', () => {
    it('black kingside castling right is preserved after unrelated bishop capture', () => {
      // Black bishop on a8, white knight on g2. Black has only kingside castling (k).
      // The bishop captures the knight (a8 -> g2): neither a king nor a rook move,
      // so black kingside castling rights must remain intact.
      const fen = 'b3k2r/5p2/4p3/1p5p/6p1/2PR2P1/BP3qNP/6QK b k - 2 28';
      const position = fromFen(fen);
      const { position: next } = move(position, { from: 'a8', to: 'g2' });
      expect(next.castlingRights.black.king).toBe(true);
    });

    it('FEN after bishop capture matches expected position', () => {
      const fen = 'b3k2r/5p2/4p3/1p5p/6p1/2PR2P1/BP3qNP/6QK b k - 2 28';
      const position = fromFen(fen);
      const { position: next } = move(position, { from: 'a8', to: 'g2' });
      // Bishop now on g2, a8 empty, kingside castling preserved, halfmoveClock reset (capture)
      expect(next.at('g2')).toEqual({ color: 'black', type: 'bishop' });
      expect(next.at('a8')).toBeUndefined();
      expect(next.castlingRights.black.king).toBe(true);
      expect(next.castlingRights.black.queen).toBe(false);
      expect(next.halfmoveClock).toBe(0);
      expect(next.fullmoveNumber).toBe(29);
      expect(next.turn).toBe('white');
    });
  });

  // chess.js issue #284 — illegal move (king walks into attack) must be rejected
  describe('issue #284 — illegal moves are not accepted', () => {
    it('king move into pawn attack throws', () => {
      // White king on e1, black pawn on e3 attacks d2 and f2.
      // e1 -> f2 would walk into the pawn's attack.
      const fen = '4k3/8/8/8/8/4p3/8/4K3 w - - 0 1';
      const game = new Game(fromFen(fen));
      expect(() => game.move({ from: 'e1', to: 'f2' })).toThrow(
        /^Illegal move:/,
      );
    });

    it('f2 is not a legal king move in that position', () => {
      const fen = '4k3/8/8/8/8/4p3/8/4K3 w - - 0 1';
      const position = fromFen(fen);
      const legalTargets = generateMoves(position, 'e1').map((m) => m.to);
      expect(legalTargets).not.toContain('f2');
    });
  });

  // chess.js issue #552 — invalid castling rights in FEN must not crash
  // (also covered in game.spec.ts as a smoke test; this test adds move-generation depth)
  describe('issue #552 — invalid castling rights in FEN are handled gracefully', () => {
    it('isGameOver() returns false without throwing', () => {
      // King is not on the standard castling square for black, yet FEN declares KQkq.
      const fen = 'kb4r1/p2n3P/1PP5/1P6/8/8/6p1/R3KR2 b KQkq - 0 19';
      const game = new Game(fromFen(fen));
      expect(() => game.isGameOver()).not.toThrow();
      expect(game.isGameOver()).toBe(false);
    });

    it('move generation does not crash on invalid castling rights', () => {
      const fen = 'kb4r1/p2n3P/1PP5/1P6/8/8/6p1/R3KR2 b KQkq - 0 19';
      const position = fromFen(fen);
      expect(() => generateMoves(position)).not.toThrow();
    });
  });

  // Castling through check — kingside castling is legal only when transit squares are safe
  describe('castling through check', () => {
    it('O-O is legal when path is clear and king is not in check', () => {
      const fen = 'r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1';
      const moves = generateMoves(fromFen(fen), 'e1');
      expect(moves).toContainEqual({ from: 'e1', to: 'g1' });
    });

    it('O-O is illegal when f1 is attacked', () => {
      // Black rook on f8 covers f1 — white cannot castle kingside through f1.
      const fen = 'r3kr1r/8/8/8/8/8/8/R3K2R w KQ - 0 1';
      const moves = generateMoves(fromFen(fen), 'e1');
      expect(moves).not.toContainEqual({ from: 'e1', to: 'g1' });
    });

    it('O-O is illegal when g1 is attacked', () => {
      // Black rook on g8 covers g1 — white cannot castle kingside to g1.
      const fen = 'r3k1rr/8/8/8/8/8/8/R3K2R w KQ - 0 1';
      const moves = generateMoves(fromFen(fen), 'e1');
      expect(moves).not.toContainEqual({ from: 'e1', to: 'g1' });
    });
  });

  // En passant edge case — captured pawn must be removed from the correct square
  describe('en passant — captured pawn is removed correctly', () => {
    it('f5 x e6 removes the pawn on e5', () => {
      // White pawn on f5, black pawn just played e7-e5 (en passant target = e6).
      const fen =
        'rnbqkbnr/pppp1ppp/8/4pP2/8/8/PPPPP1PP/RNBQKBNR w KQkq e6 0 1';
      const position = fromFen(fen);
      const { position: next } = move(position, { from: 'f5', to: 'e6' });
      // White pawn should now be on e6
      expect(next.at('e6')).toEqual({ color: 'white', type: 'pawn' });
      // Origin square vacated
      expect(next.at('f5')).toBeUndefined();
      // Captured black pawn on e5 must be gone
      expect(next.at('e5')).toBeUndefined();
    });

    it('en passant is a legal move in that position', () => {
      const fen =
        'rnbqkbnr/pppp1ppp/8/4pP2/8/8/PPPPP1PP/RNBQKBNR w KQkq e6 0 1';
      const position = fromFen(fen);
      const moves = generateMoves(position, 'f5');
      expect(moves).toContainEqual({ from: 'f5', to: 'e6' });
    });
  });
});
