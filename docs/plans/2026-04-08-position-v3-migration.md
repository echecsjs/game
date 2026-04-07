# Position v3 Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** migrate `@echecs/game` from `@echecs/position` v1 to v3, rewriting
move generation to use `Position.reach()` instead of internal 0x88 tables.

**Architecture:** position v3 provides `reach(square, piece)` for pseudo-legal
target squares and `derive()` for immutable position updates. Game drops all
0x88 board manipulation and delegates piece reachability to position. Castling
move generation and legality filtering remain in game. FEN interop requires a
conversion layer since `@echecs/fen` still uses v1-style types.

**Tech Stack:** TypeScript, `@echecs/position@^3.0.0`, `@echecs/fen@^1.0.0`,
vitest

---

## File Structure

| File                          | Action  | Purpose                                                               |
| ----------------------------- | ------- | --------------------------------------------------------------------- |
| `src/types.ts`                | Create  | Local `Move`, `PromotionPieceType` types (removed from position v3)   |
| `src/fen.ts`                  | Create  | Conversion layer between `@echecs/fen` v1 types and position v3 types |
| `src/moves.ts`                | Rewrite | Move generation using `position.reach()` + `derive()`                 |
| `src/game.ts`                 | Modify  | Update imports, constructor, FEN interop, remove `isAttacked()`       |
| `src/detection.ts`            | Modify  | Update imports                                                        |
| `src/index.ts`                | Modify  | Update exports                                                        |
| `src/__tests__/game.spec.ts`  | Modify  | Update type assertions, remove `isAttacked` tests                     |
| `src/__tests__/moves.spec.ts` | Modify  | Update type assertions                                                |
| `src/__tests__/helpers.ts`    | Modify  | Update `fromFen` for v3 types                                         |

---

## Task 1: Define Local Types

**Files:**

- Create: `src/types.ts`

Game needs `Move` and `PromotionPieceType` which were removed from position v3.
Also define a `PromotionPieceType` matching v3's full-word `PieceType`.

- [ ] **Step 1: Create `src/types.ts`**

```typescript
import type { PieceType, Square } from '@echecs/position';

type PromotionPieceType = Exclude<PieceType, 'king' | 'pawn'>;

interface Move {
  from: Square;
  promotion: PromotionPieceType | undefined;
  to: Square;
}

export type { Move, PromotionPieceType };
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm lint:types` Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add local Move and PromotionPieceType types"
```

---

## Task 2: Create FEN Conversion Layer

**Files:**

- Create: `src/fen.ts`

`@echecs/fen` uses v1-style types (`'b'`/`'w'`, single-letter piece types, flat
`{ bK, bQ, wK, wQ }` castling). Game needs to convert at the FEN boundary.

- [ ] **Step 1: Create `src/fen.ts`**

```typescript
import parse from '@echecs/fen';
import { stringify } from '@echecs/fen';
import { Position } from '@echecs/position';

import type {
  CastlingRights,
  Color,
  EnPassantSquare,
  Piece,
  PieceType,
  Square,
} from '@echecs/position';
import type {
  CastlingRights as FenCastlingRights,
  Color as FenColor,
  Piece as FenPiece,
  PieceType as FenPieceType,
} from '@echecs/fen';

const COLOR_TO_FEN: Record<Color, FenColor> = {
  black: 'b',
  white: 'w',
};

const COLOR_FROM_FEN: Record<FenColor, Color> = {
  b: 'black',
  w: 'white',
};

const PIECE_TYPE_TO_FEN: Record<PieceType, FenPieceType> = {
  bishop: 'b',
  king: 'k',
  knight: 'n',
  pawn: 'p',
  queen: 'q',
  rook: 'r',
};

const PIECE_TYPE_FROM_FEN: Record<FenPieceType, PieceType> = {
  b: 'bishop',
  k: 'king',
  n: 'knight',
  p: 'pawn',
  q: 'queen',
  r: 'rook',
};

function positionFromFen(fen: string): Position | undefined {
  const parsed = parse(fen);
  if (!parsed) {
    return undefined;
  }

  const board = new Map<Square, Piece>();
  for (const [square, fenPiece] of parsed.board) {
    board.set(square, {
      color: COLOR_FROM_FEN[fenPiece.color],
      type: PIECE_TYPE_FROM_FEN[fenPiece.type],
    });
  }

  const castlingRights: CastlingRights = {
    black: {
      king: parsed.castlingRights.bK,
      queen: parsed.castlingRights.bQ,
    },
    white: {
      king: parsed.castlingRights.wK,
      queen: parsed.castlingRights.wQ,
    },
  };

  return new Position(board, {
    castlingRights,
    enPassantSquare: parsed.enPassantSquare as EnPassantSquare | undefined,
    fullmoveNumber: parsed.fullmoveNumber,
    halfmoveClock: parsed.halfmoveClock,
    turn: COLOR_FROM_FEN[parsed.turn],
  });
}

function positionToFen(position: Position): string {
  const board = new Map<Square, FenPiece>();
  for (const [square, piece] of position.pieces()) {
    board.set(square, {
      color: COLOR_TO_FEN[piece.color],
      type: PIECE_TYPE_TO_FEN[piece.type],
    });
  }

  const castlingRights: FenCastlingRights = {
    bK: position.castlingRights.black.king,
    bQ: position.castlingRights.black.queen,
    wK: position.castlingRights.white.king,
    wQ: position.castlingRights.white.queen,
  };

  return stringify({
    board,
    castlingRights,
    enPassantSquare: position.enPassantSquare,
    fullmoveNumber: position.fullmoveNumber,
    halfmoveClock: position.halfmoveClock,
    turn: COLOR_TO_FEN[position.turn],
  });
}

export { positionFromFen, positionToFen };
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm lint:types` Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/fen.ts
git commit -m "feat: add FEN conversion layer for position v3 types"
```

---

## Task 3: Rewrite Move Generation

**Files:**

- Rewrite: `src/moves.ts`

This is the core change. The current 721-line file uses 0x88 internal tables
from `@echecs/position/internal`. The new version uses `position.reach()` for
pseudo-legal targets and `derive()` + `isCheck` for legality filtering.

Key design decisions:

- `reach()` handles pawn pushes, captures, en passant, and all piece movement.
  It does NOT handle castling — game generates castling moves itself.
- Legality filter: apply move via `move()` (which uses `derive()`), then check
  `nextPosition.isCheck`. The side that just moved is now `nextPosition.turn`'s
  opponent — but `isCheck` checks the side to move. So we need to check the
  previous side's king. Since `derive()` doesn't flip turn (that's our job), we
  build the next position with the flipped turn and check `isCheck`. Actually —
  our `move()` function builds the full next `Position` with flipped turn, so
  `nextPosition.isCheck` checks the NEW side to move. We need the opposite: is
  the PREVIOUS side's king in check? We can check this by looking at the
  position BEFORE turn flip. Simplest: after applying piece changes via
  `derive()` but with the SAME turn, check `isCheck`. If the king is in check
  after the own move, it's illegal.
- Promotion: when a pawn target is on the back rank, emit 4 moves (one per
  promotion piece).
- Castling: generate separately — check rights, path clear, king not in check,
  transit squares not attacked. For the attack check, use a temporary position
  via `derive()` with the king on each transit square and check `isCheck`.

- [ ] **Step 1: Rewrite `src/moves.ts`**

```typescript
import { Position } from '@echecs/position';

import type {
  CastlingRights,
  Color,
  EnPassantSquare,
  Piece,
  PieceType,
  Square,
} from '@echecs/position';

import type { Move, PromotionPieceType } from './types.js';

const PROMOTION_PIECES: PromotionPieceType[] = [
  'bishop',
  'knight',
  'queen',
  'rook',
];

function enemyColor(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

/**
 * Check if a square is attacked by the given color on the given position.
 * Uses `reach()` in reverse: from the target square, check if any enemy piece
 * can reach it.
 */
function isSquareAttacked(
  position: Position,
  square: Square,
  by: Color,
): boolean {
  for (const [sq, piece] of position.pieces(by)) {
    const targets = position.reach(sq, piece);
    if (targets.includes(square)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate pseudo-legal moves for a piece on a square, excluding castling.
 * Uses `position.reach()` for target squares.
 */
function generatePseudoLegalMoves(position: Position, square: Square): Move[] {
  const piece = position.at(square);
  if (piece === undefined || piece.color !== position.turn) {
    return [];
  }

  const targets = position.reach(square, piece);
  const moves: Move[] = [];

  for (const target of targets) {
    if (piece.type === 'pawn') {
      const rank = target[1];
      const isPromotion = rank === '8' || rank === '1';
      if (isPromotion) {
        for (const promo of PROMOTION_PIECES) {
          moves.push({ from: square, promotion: promo, to: target });
        }
      } else {
        moves.push({ from: square, promotion: undefined, to: target });
      }
    } else {
      moves.push({ from: square, promotion: undefined, to: target });
    }
  }

  return moves;
}

/**
 * Generate castling moves for the active color.
 */
function generateCastlingMoves(position: Position): Move[] {
  const moves: Move[] = [];
  const color = position.turn;
  const enemy = enemyColor(color);
  const rank = color === 'white' ? '1' : '8';
  const kingSquare: Square = `e${rank}` as Square;

  // King must be on e1/e8
  const king = position.at(kingSquare);
  if (king === undefined || king.type !== 'king' || king.color !== color) {
    return moves;
  }

  // King must not be in check
  if (isSquareAttacked(position, kingSquare, enemy)) {
    return moves;
  }

  const rights =
    color === 'white'
      ? position.castlingRights.white
      : position.castlingRights.black;

  // Kingside
  if (rights.king) {
    const fSquare: Square = `f${rank}` as Square;
    const gSquare: Square = `g${rank}` as Square;

    if (
      position.at(fSquare) === undefined &&
      position.at(gSquare) === undefined &&
      !isSquareAttacked(position, fSquare, enemy) &&
      !isSquareAttacked(position, gSquare, enemy)
    ) {
      moves.push({ from: kingSquare, promotion: undefined, to: gSquare });
    }
  }

  // Queenside
  if (rights.queen) {
    const bSquare: Square = `b${rank}` as Square;
    const cSquare: Square = `c${rank}` as Square;
    const dSquare: Square = `d${rank}` as Square;

    if (
      position.at(bSquare) === undefined &&
      position.at(cSquare) === undefined &&
      position.at(dSquare) === undefined &&
      !isSquareAttacked(position, cSquare, enemy) &&
      !isSquareAttacked(position, dSquare, enemy)
    ) {
      moves.push({ from: kingSquare, promotion: undefined, to: cSquare });
    }
  }

  return moves;
}

/**
 * Apply a move to a Position, returning a new Position.
 * Does not validate legality — assumes the move is valid.
 */
function move(position: Position, m: Move): Position {
  const piece = position.at(m.from);
  if (piece === undefined) {
    return position;
  }

  const changes: [Square, Piece | undefined][] = [];

  // Remove piece from origin
  changes.push([m.from, undefined]);

  // Place piece (or promoted piece) on destination
  const movedPiece: Piece =
    piece.type === 'pawn' && m.promotion !== undefined
      ? { color: piece.color, type: m.promotion }
      : piece;
  changes.push([m.to, movedPiece]);

  // En passant capture: remove the captured pawn
  const isCapture = position.at(m.to) !== undefined;
  const isEnPassant =
    piece.type === 'pawn' && m.to === position.enPassantSquare && !isCapture;

  if (isEnPassant) {
    const capturedFile = m.to[0] as string;
    const capturedRank = m.from[1] as string;
    const capturedSquare = `${capturedFile}${capturedRank}` as Square;
    changes.push([capturedSquare, undefined]);
  }

  // Castling: move the rook
  const fromFile = m.from[0];
  const toFile = m.to[0];
  const isCastling =
    piece.type === 'king' &&
    fromFile === 'e' &&
    (toFile === 'g' || toFile === 'c');

  if (isCastling) {
    const rank = m.from[1] as string;
    if (toFile === 'g') {
      // Kingside
      changes.push([`h${rank}` as Square, undefined]);
      changes.push([
        `f${rank}` as Square,
        { color: piece.color, type: 'rook' },
      ]);
    } else {
      // Queenside
      changes.push([`a${rank}` as Square, undefined]);
      changes.push([
        `d${rank}` as Square,
        { color: piece.color, type: 'rook' },
      ]);
    }
  }

  // Castling rights
  const whiteKing =
    piece.type === 'king' && piece.color === 'white'
      ? false
      : position.castlingRights.white.king;
  const whiteQueen =
    piece.type === 'king' && piece.color === 'white'
      ? false
      : position.castlingRights.white.queen;
  const blackKing =
    piece.type === 'king' && piece.color === 'black'
      ? false
      : position.castlingRights.black.king;
  const blackQueen =
    piece.type === 'king' && piece.color === 'black'
      ? false
      : position.castlingRights.black.queen;

  let wK = whiteKing;
  let wQ = whiteQueen;
  let bK = blackKing;
  let bQ = blackQueen;

  // Rook moves: revoke own castling
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
      // No default
    }
  }

  // Rook captured: revoke opponent castling
  if (isCapture || isEnPassant) {
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
      // No default
    }
  }

  const castlingRights: CastlingRights = {
    black: { king: bK, queen: bQ },
    white: { king: wK, queen: wQ },
  };

  // En passant square
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

  // Clocks
  const halfmoveClock =
    piece.type === 'pawn' || isCapture || isEnPassant
      ? 0
      : position.halfmoveClock + 1;

  const fullmoveNumber =
    position.turn === 'black'
      ? position.fullmoveNumber + 1
      : position.fullmoveNumber;

  const turn = enemyColor(position.turn);

  return position.derive({
    castlingRights,
    changes,
    enPassantSquare,
    fullmoveNumber,
    halfmoveClock,
    turn,
  });
}

/**
 * Generate all legal moves for the active color, optionally filtered by square.
 */
function generateMoves(position: Position, square?: Square): Move[] {
  const pseudoMoves: Move[] = [];

  if (square === undefined) {
    for (const [sq, piece] of position.pieces(position.turn)) {
      pseudoMoves.push(...generatePseudoLegalMoves(position, sq));
    }

    pseudoMoves.push(...generateCastlingMoves(position));
  } else {
    const piece = position.at(square);
    if (piece === undefined || piece.color !== position.turn) {
      return [];
    }

    pseudoMoves.push(...generatePseudoLegalMoves(position, square));

    // Include castling if querying the king square
    if (piece.type === 'king') {
      pseudoMoves.push(...generateCastlingMoves(position));
    }
  }

  // Filter: discard moves that leave own king in check
  const legalMoves: Move[] = [];
  for (const m of pseudoMoves) {
    const nextPosition = move(position, m);
    // After move(), turn has flipped. We need to check if the side that
    // just moved left their king in check. derive() with same-turn trick:
    // build a temp position with the original turn to use isCheck.
    const checkPosition = nextPosition.derive({ turn: position.turn });
    if (!checkPosition.isCheck) {
      legalMoves.push(m);
    }
  }

  return legalMoves;
}

export { generateMoves, move };
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm lint:types` Expected: no errors (tests may fail — we haven't updated
them yet)

- [ ] **Step 3: Commit**

```bash
git add src/moves.ts
git commit -m "refactor: rewrite move generation using position.reach()"
```

---

## Task 4: Update Game Class

**Files:**

- Modify: `src/game.ts`

Changes: update constructor to use `STARTING_POSITION`, use FEN conversion
layer, update `piece()` -> `at()` calls, update type references, remove
`isAttacked()` method, update `PIECE_NAMES` for full-word piece types.

- [ ] **Step 1: Update imports**

Replace the current import block (lines 1-14) with:

```typescript
import { Position, STARTING_POSITION } from '@echecs/position';

import { positionFromFen, positionToFen } from './fen.js';
import { isCheckmate, isDraw, isStalemate } from './detection.js';
import { move as applyMove, generateMoves } from './moves.js';

import type { Color, Piece, PieceType, Square } from '@echecs/position';

import type { Move, PromotionPieceType } from './types.js';
```

- [ ] **Step 2: Update `PIECE_NAMES`**

Since `PieceType` values are now full words, the lookup becomes identity:

```typescript
const PIECE_NAMES: Record<PieceType, string> = {
  bishop: 'bishop',
  king: 'king',
  knight: 'knight',
  pawn: 'pawn',
  queen: 'queen',
  rook: 'rook',
};
```

- [ ] **Step 3: Update `MoveInput` interface**

`PromotionPieceType` now comes from local `./types.js`:

```typescript
export interface MoveInput {
  from: Square;
  promotion?: PromotionPieceType;
  to: Square;
}
```

No structural change — just the import source.

- [ ] **Step 4: Update constructor**

```typescript
constructor() {
  this.#position = new Position(STARTING_POSITION);
  this.#positionHistory = [this.#position.hash];
}
```

- [ ] **Step 5: Update `fromFen` to use conversion layer**

```typescript
static fromFen(fen: string): Game {
  const position = positionFromFen(fen);
  if (position === undefined) {
    throw new Error(`Invalid FEN: ${fen}`);
  }

  const game = new Game();
  game.#position = position;
  game.#past = [];
  game.#future = [];
  game.#positionHistory = [game.#position.hash];
  game.#cache = undefined;
  return game;
}
```

- [ ] **Step 6: Update `fen()` to use conversion layer**

```typescript
fen(): string {
  return positionToFen(this.#position);
}
```

- [ ] **Step 7: Update `get()` to use `at()`**

```typescript
get(square: Square): Piece | undefined {
  return this.#position.at(square);
}
```

- [ ] **Step 8: Update `board()` to use `at()`**

```typescript
board(): (Piece | undefined)[][] {
  const result: (Piece | undefined)[][] = [];
  for (let rank = 1; rank <= 8; rank++) {
    const row: (Piece | undefined)[] = [];
    for (let fileCode = 0; fileCode < 8; fileCode++) {
      const file = String.fromCodePoint(('a'.codePointAt(0) ?? 0) + fileCode);
      const square = `${file}${rank}` as Square;
      row.push(this.#position.at(square));
    }
    result.push(row);
  }
  return result;
}
```

- [ ] **Step 9: Remove `isAttacked()` method**

Delete the entire method and its TSDoc comment:

```typescript
// DELETE:
isAttacked(square: Square, color: Color): boolean {
  return this.#position.isAttacked(square, color);
}
```

- [ ] **Step 10: Update color comparisons**

In `#illegalMoveReason`, line checking piece ownership:

```typescript
if (piece.color !== this.#position.turn) {
```

No change needed — still compares to `position.turn` which now returns
`'white'`/`'black'`.

- [ ] **Step 11: Verify types compile**

Run: `pnpm lint:types` Expected: no errors

- [ ] **Step 12: Commit**

```bash
git add src/game.ts
git commit -m "refactor: update Game class for position v3"
```

---

## Task 5: Update Detection and Index

**Files:**

- Modify: `src/detection.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Update `src/detection.ts` imports**

Replace the `Move` import source:

```typescript
import type { Move } from './types.js';
```

Keep `Position` import from `@echecs/position`. Verify there are no references
to old color values (`'w'`/`'b'`) or old piece types — detection.ts only uses
`position.isCheck`, `position.isInsufficientMaterial`, and move count, so it
should be clean.

- [ ] **Step 2: Update `src/index.ts`**

```typescript
export { Game } from './game.js';
export { STARTING_POSITION, Position } from '@echecs/position';
export type { MoveInput } from './game.js';
export type { Move, PromotionPieceType } from './types.js';
export type {
  CastlingRights,
  Color,
  EnPassantSquare,
  Piece,
  PieceType,
  SideCastlingRights,
  Square,
} from '@echecs/position';
```

Note: `STARTING_POSITION` is re-exported. `Move` and `PromotionPieceType` now
come from local types. New types `EnPassantSquare` and `SideCastlingRights` are
re-exported.

- [ ] **Step 3: Verify types compile**

Run: `pnpm lint:types` Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add src/detection.ts src/index.ts
git commit -m "refactor: update detection and index for position v3"
```

---

## Task 6: Update Test Helpers

**Files:**

- Modify: `src/__tests__/helpers.ts`

- [ ] **Step 1: Read current helpers.ts and update**

The `fromFen` helper constructs a Position from a FEN string. It needs to use
the new FEN conversion layer or directly construct with v3 types.

Replace with:

```typescript
import { positionFromFen } from '../fen.js';

import type { Position } from '@echecs/position';

function fromFen(fen: string): Position {
  const position = positionFromFen(fen);
  if (position === undefined) {
    throw new Error(`Invalid FEN in test: ${fen}`);
  }
  return position;
}

export { fromFen };
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm lint:types` Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/helpers.ts
git commit -m "refactor: update test helpers for position v3"
```

---

## Task 7: Update Game Tests

**Files:**

- Modify: `src/__tests__/game.spec.ts`

All assertions using old Color (`'w'`/`'b'`), PieceType (`'p'`/`'k'`/etc.), and
`isAttacked` need updating.

- [ ] **Step 1: Update color assertions**

Replace all `'w'` -> `'white'` and `'b'` -> `'black'` in test expectations.

- [ ] **Step 2: Update piece type assertions**

Replace all single-letter piece types with full words in test expectations:
`'p'` -> `'pawn'`, `'n'` -> `'knight'`, `'b'` -> `'bishop'`, `'r'` -> `'rook'`,
`'q'` -> `'queen'`, `'k'` -> `'king'`.

- [ ] **Step 3: Remove `isAttacked` tests**

Delete the entire `describe('isAttacked()', ...)` block since the method is
removed from Game.

- [ ] **Step 4: Update promotion values in move expectations**

Any tests that check `promotion: 'q'` or similar need updating to
`promotion: 'queen'` etc.

- [ ] **Step 5: Run tests**

Run: `pnpm test src/__tests__/game.spec.ts` Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/game.spec.ts
git commit -m "test: update game tests for position v3 types"
```

---

## Task 8: Update Moves Tests

**Files:**

- Modify: `src/__tests__/moves.spec.ts`

- [ ] **Step 1: Update `piece()` -> `at()` calls**

Replace all `position.piece(...)` with `position.at(...)`.

- [ ] **Step 2: Update piece type and color assertions**

Same as game tests — full-word piece types and colors.

- [ ] **Step 3: Update castling rights assertions**

Replace `.castlingRights.wK` with `.castlingRights.white.king`, etc:

- `.wK` -> `.white.king`
- `.wQ` -> `.white.queen`
- `.bK` -> `.black.king`
- `.bQ` -> `.black.queen`

- [ ] **Step 4: Update promotion values**

Any `promotion: 'q'` -> `promotion: 'queen'` etc.

- [ ] **Step 5: Run tests**

Run: `pnpm test src/__tests__/moves.spec.ts` Expected: all tests pass (including
perft)

- [ ] **Step 6: Commit**

```bash
git add src/__tests__/moves.spec.ts
git commit -m "test: update moves tests for position v3 types"
```

---

## Task 9: Run Full Verification

- [ ] **Step 1: Run lint**

Run: `pnpm lint` Expected: no errors

- [ ] **Step 2: Run all tests**

Run: `pnpm test` Expected: all tests pass, including perft (correctness oracle)

- [ ] **Step 3: Run build**

Run: `pnpm build` Expected: clean build

- [ ] **Step 4: Run benchmarks**

Run: `pnpm bench` Note: performance may differ significantly due to the move
generation rewrite. Record results for comparison.

- [ ] **Step 5: Commit any lint fixes**

```bash
git add -A
git commit -m "fix: lint fixes for position v3 migration"
```

---

## Task 10: Update Documentation

**Files:**

- Modify: `README.md`
- Modify: `CHANGELOG.md`
- Modify: `AGENTS.md`
- Modify: `BACKLOG.md`

- [ ] **Step 1: Update README**

- Update Quick Start example if Color/PieceType values appear
- Update `isAttacked` section — remove or note removal
- Update `Move` interface documentation (promotion is now full word type)
- Update interop section if needed

- [ ] **Step 2: Update AGENTS.md**

- Update Architecture Notes section for new move generation approach
- Update dependency table for `@echecs/position` v3
- Remove references to `@echecs/position/internal`
- Update type examples

- [ ] **Step 3: Update CHANGELOG.md**

Add the v2.0.0 entry documenting all breaking changes.

- [ ] **Step 4: Update BACKLOG.md**

Mark the Square type expansion item as resolved (position v3 includes a TypeDoc
plugin for it).

- [ ] **Step 5: Commit**

```bash
git add README.md CHANGELOG.md AGENTS.md BACKLOG.md
git commit -m "docs: update documentation for position v3 migration"
```
