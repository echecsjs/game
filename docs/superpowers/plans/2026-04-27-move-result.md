# MoveResult Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** `game.move()` returns a `MoveResult` object describing what happened
on the board. `undo()` and `redo()` also return `MoveResult | undefined`.

**Architecture:** Add a `MoveResult` type to `src/types.ts`. Modify `move()` in
`src/moves.ts` to construct and return a `MoveResult` alongside the new
`Position`. Update `Game` class methods (`move`, `undo`, `redo`) to surface the
result. Add a `reverseMoveResult()` utility for `undo()`. Update all tests.

**Tech Stack:** TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-04-27-move-result-design.md`

---

## File Map

| File                               | Action | Responsibility                                                                                                                      |
| ---------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------- |
| `src/types.ts`                     | Modify | Add `MoveResult` type, export it                                                                                                    |
| `src/moves.ts`                     | Modify | `move()` returns `{ position: Position, result: MoveResult }` instead of just `Position`                                            |
| `src/game.ts`                      | Modify | `move()` returns `MoveResult`, `undo()`/`redo()` return `MoveResult \| undefined`, store result in history, add `reverseMoveResult` |
| `src/index.ts`                     | Modify | Export `MoveResult` type                                                                                                            |
| `src/__tests__/game.spec.ts`       | Modify | Update tests for new return types                                                                                                   |
| `src/__tests__/moves.spec.ts`      | Modify | Update tests for new `move()` return shape                                                                                          |
| `src/__tests__/regression.spec.ts` | Modify | Update direct `move()` calls to destructure `{ position }`                                                                          |

---

### Task 1: Add the MoveResult type

**Files:**

- Modify: `src/types.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Add `MoveResult` interface to `src/types.ts`**

```ts
interface MoveResult {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: {
    square: Square;
    piece: Piece;
  };
  promotion?: Piece;
  castling?: {
    from: Square;
    to: Square;
    piece: Piece;
  };
}
```

Add `MoveResult` to the existing exports alongside `Move` and
`PromotionPieceType`. The imports at the top need `Piece` and `Square` from
`@echecs/position` (already imports `Square` and `PieceType` — add `Piece`).

Full file after changes:

```ts
import type { Piece, PieceType, Square } from '@echecs/position';

type PromotionPieceType = Exclude<PieceType, 'king' | 'pawn'>;

interface Move {
  from: Square;
  promotion?: PromotionPieceType;
  to: Square;
}

interface MoveResult {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: {
    square: Square;
    piece: Piece;
  };
  promotion?: Piece;
  castling?: {
    from: Square;
    to: Square;
    piece: Piece;
  };
}

export type { Move, MoveResult, PromotionPieceType };
```

- [ ] **Step 2: Export `MoveResult` from `src/index.ts`**

Add `MoveResult` to the type export from `./types.js`:

```ts
export type { Move, MoveResult, PromotionPieceType } from './types.js';
```

- [ ] **Step 3: Run type check**

Run: `pnpm lint:types` Expected: PASS — no type errors (nothing consumes
`MoveResult` yet)

- [ ] **Step 4: Commit**

```bash
git add src/types.ts src/index.ts
git commit -m "feat: add MoveResult type"
```

---

### Task 2: Make `move()` in `moves.ts` return MoveResult alongside Position

**Files:**

- Modify: `src/moves.ts`
- Test: `src/__tests__/moves.spec.ts`

- [ ] **Step 1: Write failing tests for the new `move()` return shape**

In `src/__tests__/moves.spec.ts`, update the existing
`move (applyMoveToState equivalent)` describe block. The `move()` function will
now return `{ position: Position, result: MoveResult }` instead of just
`Position`.

Replace the entire `describe('move (applyMoveToState equivalent)')` block:

```ts
describe('move()', () => {
  it('returns position and result', () => {
    const position = fromFen(STARTING_FEN);
    const { position: next, result } = move(position, { from: 'e2', to: 'e4' });
    expect(next.at('e4')).toEqual({ color: 'white', type: 'pawn' });
    expect(next.at('e2')).toBeUndefined();
    expect(result).toEqual({
      from: 'e2',
      to: 'e4',
      piece: { color: 'white', type: 'pawn' },
    });
  });

  it('sets en passant square on double pawn push', () => {
    const position = fromFen(STARTING_FEN);
    const { position: next } = move(position, { from: 'e2', to: 'e4' });
    expect(next.enPassantSquare).toBe('e3');
  });

  it('switches turn', () => {
    const position = fromFen(STARTING_FEN);
    const { position: next } = move(position, { from: 'e2', to: 'e4' });
    expect(next.turn).toBe('black');
  });

  it('result includes captured piece', () => {
    // White knight on f3, black pawn on d5 — Nf3xd5 is not legal from
    // starting position, so use a custom FEN where it is.
    const fen =
      'rnbqkb1r/ppp1pppp/5n2/3p4/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3';
    const position = fromFen(fen);
    const { result } = move(position, { from: 'e4', to: 'd5' });
    expect(result.captured).toEqual({
      square: 'd5',
      piece: { color: 'black', type: 'pawn' },
    });
  });

  it('result includes en passant capture with correct square', () => {
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    const position = fromFen(fen);
    const { result } = move(position, { from: 'e5', to: 'd6' });
    expect(result.captured).toEqual({
      square: 'd5',
      piece: { color: 'black', type: 'pawn' },
    });
    expect(result.from).toBe('e5');
    expect(result.to).toBe('d6');
  });

  it('result includes castling rook movement (kingside)', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const position = fromFen(fen);
    const { result } = move(position, { from: 'e1', to: 'g1' });
    expect(result.piece).toEqual({ color: 'white', type: 'king' });
    expect(result.castling).toEqual({
      from: 'h1',
      to: 'f1',
      piece: { color: 'white', type: 'rook' },
    });
  });

  it('result includes castling rook movement (queenside)', () => {
    const fen = 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1';
    const position = fromFen(fen);
    const { result } = move(position, { from: 'e1', to: 'c1' });
    expect(result.castling).toEqual({
      from: 'a1',
      to: 'd1',
      piece: { color: 'white', type: 'rook' },
    });
  });

  it('result includes promotion piece', () => {
    const fen = 'k7/4P3/8/8/8/8/8/K7 w - - 0 1';
    const position = fromFen(fen);
    const { result } = move(position, {
      from: 'e7',
      to: 'e8',
      promotion: 'queen',
    });
    expect(result.piece).toEqual({ color: 'white', type: 'pawn' });
    expect(result.promotion).toEqual({ color: 'white', type: 'queen' });
  });

  it('result includes both capture and promotion', () => {
    // White pawn on d7, black rook on e8
    const fen = 'k3r3/3P4/8/8/8/8/8/K7 w - - 0 1';
    const position = fromFen(fen);
    const { result } = move(position, {
      from: 'd7',
      to: 'e8',
      promotion: 'queen',
    });
    expect(result.captured).toEqual({
      square: 'e8',
      piece: { color: 'black', type: 'rook' },
    });
    expect(result.promotion).toEqual({ color: 'white', type: 'queen' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/moves.spec.ts` Expected: FAIL — `move()` still
returns a `Position`, not `{ position, result }`

- [ ] **Step 3: Update the perft helper and castling rights tests**

The `perft` function and castling rights tests in `moves.spec.ts` use `move()`
expecting a `Position` return. Update them to destructure:

In the `perft` function (around line 188):

```ts
function perft(position: Position, depth: number): number {
  if (depth === 0) {
    return 1;
  }

  const moves = generateMoves(position);
  if (depth === 1) {
    return moves.length;
  }

  let count = 0;
  for (const m of moves) {
    count += perft(move(position, m).position, depth - 1);
  }

  return count;
}
```

In all `describe('move — castling rights on rook capture')` tests, change
`move(position, ...)` to `move(position, ...).position`. For example:

```ts
it('capturing rook on a1 revokes white queenside castling', () => {
  const position = fromFen(
    'r3k2r/pppppppp/8/8/8/8/1bPPPPPP/R3K2R b KQkq - 0 1',
  );
  const { position: next } = move(position, { from: 'b2', to: 'a1' });
  expect(next.castlingRights.white.queen).toBe(false);
  expect(next.castlingRights.white.king).toBe(true);
});
```

Apply the same pattern to all four rook capture tests and both en passant tests
in the regression describe block.

- [ ] **Step 4: Implement the `move()` return change in `src/moves.ts`**

Change the `move` function signature and return type. Instead of returning
`Position`, return `{ position: Position, result: MoveResult }`.

Add the import at the top:

```ts
import type { Move, MoveResult, PromotionPieceType } from './types.js';
```

Replace the `move` function (starting at line 205):

```ts
function move(
  position: Position,
  m: Move,
): { position: Position; result: MoveResult } {
  const piece = position.at(m.from);
  if (piece === undefined) {
    return {
      position,
      result: {
        from: m.from,
        to: m.to,
        piece: { color: position.turn, type: 'pawn' },
      },
    };
  }

  const changes = boardChanges(position, m);

  const isCapture = position.at(m.to) !== undefined;
  const isEnPassant =
    piece.type === 'pawn' && m.to === position.enPassantSquare && !isCapture;

  // Build MoveResult
  const result: MoveResult = {
    from: m.from,
    to: m.to,
    piece,
  };

  // Capture (normal or en passant)
  if (isCapture) {
    const capturedPiece = position.at(m.to);
    if (capturedPiece !== undefined) {
      result.captured = { square: m.to, piece: capturedPiece };
    }
  } else if (isEnPassant) {
    const capturedFile = m.to[0] as string;
    const capturedRank = m.from[1] as string;
    const capturedSquare = `${capturedFile}${capturedRank}` as Square;
    const capturedPiece = position.at(capturedSquare);
    if (capturedPiece !== undefined) {
      result.captured = { square: capturedSquare, piece: capturedPiece };
    }
  }

  // Promotion
  if (piece.type === 'pawn' && m.promotion !== undefined) {
    result.promotion = { color: piece.color, type: m.promotion };
  }

  // Castling
  const fromFile = m.from[0];
  const toFile = m.to[0];
  const isCastling =
    piece.type === 'king' &&
    fromFile === 'e' &&
    (toFile === 'g' || toFile === 'c');

  if (isCastling) {
    const rank = m.from[1] as string;
    if (toFile === 'g') {
      result.castling = {
        from: `h${rank}` as Square,
        to: `f${rank}` as Square,
        piece: { color: piece.color, type: 'rook' },
      };
    } else {
      result.castling = {
        from: `a${rank}` as Square,
        to: `d${rank}` as Square,
        piece: { color: piece.color, type: 'rook' },
      };
    }
  }

  // Castling rights (unchanged logic)
  let wK = position.castlingRights.white.king;
  let wQ = position.castlingRights.white.queen;
  let bK = position.castlingRights.black.king;
  let bQ = position.castlingRights.black.queen;

  if (piece.type === 'king') {
    if (piece.color === 'white') {
      wK = false;
      wQ = false;
    } else {
      bK = false;
      bQ = false;
    }
  }

  if (piece.type === 'rook') {
    switch (m.from) {
      case 'a1': {
        wQ = false;
        break;
      }
      case 'h1': {
        wK = false;
        break;
      }
      case 'a8': {
        bQ = false;
        break;
      }
      case 'h8': {
        bK = false;
        break;
      }
    }
  }

  if (isCapture) {
    switch (m.to) {
      case 'a1': {
        wQ = false;
        break;
      }
      case 'h1': {
        wK = false;
        break;
      }
      case 'a8': {
        bQ = false;
        break;
      }
      case 'h8': {
        bK = false;
        break;
      }
    }
  }

  const castlingRights: CastlingRights = {
    black: { king: bK, queen: bQ },
    white: { king: wK, queen: wQ },
  };

  let enPassantSquare: EnPassantSquare | undefined;
  if (piece.type === 'pawn') {
    const fromRank = m.from[1];
    const toRank = m.to[1];
    const rankDiff = Math.abs(Number(toRank) - Number(fromRank));
    if (rankDiff === 2) {
      const epRank = piece.color === 'white' ? '3' : '6';
      enPassantSquare = `${m.from[0]}${epRank}` as EnPassantSquare;
    }
  }

  const halfmoveClock =
    piece.type === 'pawn' || isCapture || isEnPassant
      ? 0
      : position.halfmoveClock + 1;

  const fullmoveNumber =
    position.turn === 'black'
      ? position.fullmoveNumber + 1
      : position.fullmoveNumber;

  const turn = enemyColor(position.turn);

  const newPosition = position.derive({
    castlingRights,
    changes,
    enPassantSquare,
    fullmoveNumber,
    halfmoveClock,
    turn,
  });

  return { position: newPosition, result };
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm test src/__tests__/moves.spec.ts` Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/moves.ts src/__tests__/moves.spec.ts
git commit -m "feat: move() in moves.ts returns MoveResult alongside Position"
```

---

### Task 3: Update Game class — `move()` returns `MoveResult`

**Files:**

- Modify: `src/game.ts`
- Test: `src/__tests__/game.spec.ts`

- [ ] **Step 1: Write failing tests for `game.move()` returning `MoveResult`**

In `src/__tests__/game.spec.ts`, update the `describe('move()')` block. Replace
it entirely:

```ts
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
```

Also remove the old "returns this for chaining" test — that behavior is
intentionally gone.

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/game.spec.ts` Expected: FAIL — `move()` still
returns `this`

- [ ] **Step 3: Update `game.ts` — `move()` returns `MoveResult`**

Import `MoveResult`:

```ts
import type { Move, MoveResult } from './types.js';
```

Update the `HistoryEntry` interface:

```ts
interface HistoryEntry {
  move: Move;
  previousPosition: Position;
  result: MoveResult;
}
```

Replace the `move()` method:

```ts
  move(input: Move): MoveResult {
    const legalFromSquare = this.#cachedState.moves.filter(
      (mv) => mv.from === input.from,
    );
    const isLegal = legalFromSquare.some(
      (mv) => mv.to === input.to && mv.promotion === input.promotion,
    );

    if (!isLegal) {
      throw new Error(this.#illegalMoveReason(input, legalFromSquare));
    }

    this.#cache = undefined;
    const previousPosition = this.#position;
    const { position, result } = applyMove(this.#position, input);
    this.#position = position;
    this.#past.push({ move: input, previousPosition, result });
    this.#future = [];
    this.#positionHistory.push(this.#position.hash);

    return result;
  }
```

- [ ] **Step 4: Fix tests that relied on chaining**

In `game.spec.ts`, the `switches turn after move` test was updated in step 1.
But other test files also chain — those are handled in Task 5.

Also update the `history()` test that used chaining:

```ts
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
```

And update the `undo() / redo()` describe block to not chain on `move()`:

```ts
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
```

Update the detection tests and regression test that chain:

```ts
describe('isCheck / isCheckmate / isStalemate / isDraw / isGameOver', () => {
  // These tests don't chain — no changes needed
});
```

Check the `moves() filtered by square` — no chaining. The `board()` tests — no
chaining. The regression test at the bottom — no chaining. Good.

- [ ] **Step 5: Run tests**

Run: `pnpm test src/__tests__/game.spec.ts` Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/game.ts src/__tests__/game.spec.ts
git commit -m "feat: game.move() returns MoveResult instead of this"
```

---

### Task 4: Update Game class — `undo()` and `redo()` return `MoveResult | undefined`

**Files:**

- Modify: `src/game.ts`
- Test: `src/__tests__/game.spec.ts`

- [ ] **Step 1: Write failing tests for `undo()` and `redo()` return values**

Add a new describe block in `src/__tests__/game.spec.ts`:

```ts
describe('undo() return value', () => {
  it('returns undefined when nothing to undo', () => {
    const game = new Game();
    expect(game.undo()).toBeUndefined();
  });

  it('returns reversed MoveResult for a normal move', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    const result = game.undo();
    expect(result).toEqual({
      from: 'e4',
      to: 'e2',
      piece: { color: 'white', type: 'pawn' },
    });
  });

  it('returns reversed MoveResult for castling', () => {
    const game = new Game(
      fromFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'),
    );
    game.move({ from: 'e1', to: 'g1' });
    const result = game.undo();
    expect(result).toEqual({
      from: 'g1',
      to: 'e1',
      piece: { color: 'white', type: 'king' },
      castling: {
        from: 'f1',
        to: 'h1',
        piece: { color: 'white', type: 'rook' },
      },
    });
  });

  it('returns reversed MoveResult for promotion (piece is the promoted piece)', () => {
    const game = new Game(fromFen('k7/4P3/8/8/8/8/8/K7 w - - 0 1'));
    game.move({ from: 'e7', to: 'e8', promotion: 'queen' });
    const result = game.undo();
    expect(result).toEqual({
      from: 'e8',
      to: 'e7',
      piece: { color: 'white', type: 'queen' },
    });
  });

  it('omits captured on undo', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.move({ from: 'd7', to: 'd5' });
    game.move({ from: 'e4', to: 'd5' });
    const result = game.undo();
    expect(result?.captured).toBeUndefined();
  });
});

describe('redo() return value', () => {
  it('returns undefined when nothing to redo', () => {
    const game = new Game();
    expect(game.redo()).toBeUndefined();
  });

  it('returns the forward MoveResult', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.undo();
    const result = game.redo();
    expect(result).toEqual({
      from: 'e2',
      to: 'e4',
      piece: { color: 'white', type: 'pawn' },
    });
  });

  it('returns forward MoveResult with capture info', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.move({ from: 'd7', to: 'd5' });
    game.move({ from: 'e4', to: 'd5' });
    game.undo();
    const result = game.redo();
    expect(result?.captured).toEqual({
      square: 'd5',
      piece: { color: 'black', type: 'pawn' },
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/game.spec.ts` Expected: FAIL — `undo()` and
`redo()` return `void`/`undefined` without the result

- [ ] **Step 3: Add `reverseMoveResult` helper and update `undo()`/`redo()` in
      `game.ts`**

Add a private static-like function at the top of `game.ts` (after imports,
before the class):

```ts
function reverseMoveResult(result: MoveResult): MoveResult {
  const reversed: MoveResult = {
    from: result.to,
    to: result.from,
    piece: result.promotion ?? result.piece,
  };

  if (result.castling) {
    reversed.castling = {
      from: result.castling.to,
      to: result.castling.from,
      piece: result.castling.piece,
    };
  }

  return reversed;
}
```

Update `undo()`:

```ts
  undo(): MoveResult | undefined {
    const entry = this.#past.pop();
    if (entry === undefined) {
      return undefined;
    }

    this.#cache = undefined;
    this.#position = entry.previousPosition;
    this.#future.push(entry);
    this.#positionHistory.pop();

    return reverseMoveResult(entry.result);
  }
```

Update `redo()`:

```ts
  redo(): MoveResult | undefined {
    const entry = this.#future.pop();
    if (entry === undefined) {
      return undefined;
    }

    this.#cache = undefined;
    const { position } = applyMove(entry.previousPosition, entry.move);
    this.#position = position;
    this.#past.push(entry);
    this.#positionHistory.push(this.#position.hash);

    return entry.result;
  }
```

Also update the import to include `MoveResult`:

```ts
import type { Move, MoveResult } from './types.js';
```

- [ ] **Step 4: Run tests**

Run: `pnpm test src/__tests__/game.spec.ts` Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/game.ts src/__tests__/game.spec.ts
git commit -m "feat: undo() and redo() return MoveResult or undefined"
```

---

### Task 5: Update remaining test files for new return shapes

**Files:**

- Modify: `src/__tests__/hash.spec.ts`
- Modify: `src/__tests__/playthrough.spec.ts`
- Modify: `src/__tests__/regression.spec.ts`

- [ ] **Step 1: Update `hash.spec.ts`**

This file chains `game.move()` in several places. Since `move()` no longer
returns `this`, replace chaining with separate statements.

Line 17-18 — change:

```ts
game.move({ from: 'e2', to: 'e4' });
```

This is already not chaining. But line 25:

```ts
const game = new Game();
```

Check each test — the hash tests mostly don't chain. But the
`game.move({ ... })` return value is used by `game.position().hash` on the next
line, which is fine because `game` is still the game object.

Actually, scanning the file: no chaining is used in `hash.spec.ts`. The
`game.move()` calls are all standalone statements. No changes needed.

- [ ] **Step 2: Update `playthrough.spec.ts`**

The playthrough test calls `game.move(parse(san, game.position()))` in a loop.
The return value is ignored. No chaining. No changes needed.

- [ ] **Step 3: Update `regression.spec.ts`**

This file imports `move` from `../moves.js` and uses it directly. All calls need
`.position` destructuring:

```ts
describe('regression tests (ported from chess.js)', () => {
  describe('issue #32 — castling rights are not incorrectly removed', () => {
    it('black kingside castling right is preserved after unrelated bishop capture', () => {
      const fen = 'b3k2r/5p2/4p3/1p5p/6p1/2PR2P1/BP3qNP/6QK b k - 2 28';
      const position = fromFen(fen);
      const { position: next } = move(position, { from: 'a8', to: 'g2' });
      expect(next.castlingRights.black.king).toBe(true);
    });

    it('FEN after bishop capture matches expected position', () => {
      const fen = 'b3k2r/5p2/4p3/1p5p/6p1/2PR2P1/BP3qNP/6QK b k - 2 28';
      const position = fromFen(fen);
      const { position: next } = move(position, { from: 'a8', to: 'g2' });
      expect(next.at('g2')).toEqual({ color: 'black', type: 'bishop' });
      expect(next.at('a8')).toBeUndefined();
      expect(next.castlingRights.black.king).toBe(true);
      expect(next.castlingRights.black.queen).toBe(false);
      expect(next.halfmoveClock).toBe(0);
      expect(next.fullmoveNumber).toBe(29);
      expect(next.turn).toBe('white');
    });
  });

  // issue #284 tests use Game, not move() directly — no changes needed

  // issue #552 tests use Game, not move() directly — no changes needed

  // castling through check tests use generateMoves only — no changes needed

  describe('en passant — captured pawn is removed correctly', () => {
    it('f5 x e6 removes the pawn on e5', () => {
      const fen =
        'rnbqkbnr/pppp1ppp/8/4pP2/8/8/PPPPP1PP/RNBQKBNR w KQkq e6 0 1';
      const position = fromFen(fen);
      const { position: next } = move(position, { from: 'f5', to: 'e6' });
      expect(next.at('e6')).toEqual({ color: 'white', type: 'pawn' });
      expect(next.at('f5')).toBeUndefined();
      expect(next.at('e5')).toBeUndefined();
    });

    // The second en passant test uses generateMoves only — no changes needed
  });
});
```

- [ ] **Step 4: Run all tests**

Run: `pnpm test` Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/__tests__/regression.spec.ts
git commit -m "fix: update regression tests for new move() return shape"
```

---

### Task 6: Lint, type-check, and build

**Files:** none (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm lint` Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `pnpm test` Expected: PASS

- [ ] **Step 3: Run build**

Run: `pnpm build` Expected: PASS — dist/ output updated

- [ ] **Step 4: Fix any issues**

If any step fails, fix the issue and re-run.

- [ ] **Step 5: Commit any remaining fixes**

Only if fixes were needed in step 4.
