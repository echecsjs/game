# Richer Error Messages + Rook-Capture Tests

Date: 2026-03-30

## Summary

Two small improvements to `@echecs/game`:

1. **Descriptive illegal move error messages** in `Game.move()` — replace the
   generic `"Illegal move: e2 → e5"` with context-aware messages that explain
   _why_ the move is illegal.
2. **Explicit rook-capture castling tests** — add tests that verify castling
   rights are revoked when a rook is captured on its starting square.

## 1. Error Messages

### Current Behavior

`Game.move()` throws a single generic error:

```
Illegal move: e2 → e5
```

No indication of _why_ the move is illegal.

### Proposed Behavior

Inspect the position and cached legal moves (already available) to produce a
specific reason. Checked in this order:

| Condition                                | Message                                          |
| ---------------------------------------- | ------------------------------------------------ |
| No piece on `from`                       | `"Illegal move: no piece on e2"`                 |
| Piece on `from` is opponent's            | `"Illegal move: e2 has a black piece"`           |
| Game is already over                     | `"Illegal move: game is over"`                   |
| No legal moves from `from` at all        | `"Illegal move: e2 pawn has no legal moves"`     |
| Legal moves exist from `from` but not to | `"Illegal move: e2 pawn cannot move to e5"`      |
| `to` matches but promotion mismatch      | `"Illegal move: pawn must promote on e8"` (etc.) |

All messages start with `"Illegal move:"` for consistency.

### Approach

**Post-hoc inspection in the error branch** (Approach A from brainstorming). The
reason logic runs only inside the `if (!isLegal)` block — zero cost on the happy
path. Uses data already available: `this.#position`, `this.#cachedState`, the
input move.

### Alternatives Considered

- **Tag pseudo-legal moves with rejection reasons during generation:** Too
  invasive; changes `moves.ts` and adds overhead to every `generateMoves` call.
- **Reconstruct pseudo-legal logic post-hoc:** Duplicates move generation logic;
  fragile.

### Scope

- Change only `Game.move()` in `src/game.ts`.
- No new exports, no new error classes.
- Add tests for each error message in `game.spec.ts`.

## 2. Rook-Capture Castling Tests

### Gap

Branch coverage shows uncovered lines in `moves.ts` for specific rook-capture
castling rights revocation (e.g., capturing the rook on a1 revokes white
queenside castling). Perft tests exercise these paths indirectly but there are
no explicit unit tests.

### Proposed Tests

Add a `describe('castling rights on rook capture')` block in `moves.spec.ts` (or
`game.spec.ts`) with 4 cases:

1. Capture white rook on a1 — revokes white queenside castling.
2. Capture white rook on h1 — revokes white kingside castling.
3. Capture black rook on a8 — revokes black queenside castling.
4. Capture black rook on h8 — revokes black kingside castling.

Each test sets up a position where the capture is legal, plays it, and asserts
the resulting FEN has the correct castling rights.

## Non-Goals

- No custom `IllegalMoveError` class.
- No `game.validate()` method.
- No changes to `moves.ts` or `detection.ts`.
- No performance changes to legal move generation.
