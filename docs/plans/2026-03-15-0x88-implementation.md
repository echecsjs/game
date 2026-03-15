# 0x88 Board Representation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Replace the flat `[64]` board with a 0x88 `[128]` board, add
precomputed ATTACKS and RAYS tables, and rewrite `isSquareAttackedBy` to use
them — making off-board checks and attack detection significantly faster.

**Architecture:** Three files change: `src/board.ts` (new index arithmetic),
`src/fen.ts` (board loop updates), `src/moves.ts` (ATTACKS/RAYS tables +
rewritten attack detection + 0x88 bounds checks). Public API and all other files
are untouched. Perft(3) = 8,902 is the correctness gate.

**Tech Stack:** TypeScript 5.9, Vitest 4, pnpm.

---

## Context

All work is in `/Users/mormubis/workspace/echecs/game/`.

### 0x88 index layout

```
index = rank * 16 + file
  rank: 0-based top-down  (rank 8 = row 0, rank 1 = row 7)
  file: a=0 … h=7

a8=0,   b8=1,   … h8=7
a7=16,  b7=17,  … h7=23
…
a2=96,  b2=97,  … h2=103
a1=112, b1=113, … h1=119
```

Off-board check: `index & 0x88 !== 0`

Array size: 128. Only indices where `index & 0x88 === 0` are valid squares.

### Key formula translations (flat → 0x88)

```
// flat [64]:  index = (rank-1) * 8  + (file-1)   rank 1-based, file 1-based
// 0x88 [128]: index = (8-rank) * 16 + (file-1)   rank 1-based, file 1-based
//   equivalent:       (7-(rank-1)) * 16 + (file-1)
```

Examples:

- `a1`: rank=1, file=1 → `(8-1)*16 + 0 = 112`
- `h1`: rank=1, file=8 → `(8-1)*16 + 7 = 119`
- `a8`: rank=8, file=1 → `(8-8)*16 + 0 = 0`
- `e4`: rank=4, file=5 → `(8-4)*16 + 4 = 68`

### 0x88 piece offsets (replacing [rankDelta, fileDelta] pairs)

```
Knight:  [-33, -31, -18, -14, +14, +18, +31, +33]
Bishop:  [-17, -15, +15, +17]
Rook:    [-16, -1, +1, +16]
King:    [-17, -16, -15, -1, +1, +15, +16, +17]
White pawn single push: -16 (toward rank 8 = toward lower indices)
White pawn double push: -32
White pawn captures:    -17, -15
Black pawn single push: +16
Black pawn double push: +32
Black pawn captures:    +17, +15
```

### ATTACKS table

```typescript
const PAWN_MASK = 0x01;
const KNIGHT_MASK = 0x02;
const BISHOP_MASK = 0x04; // also covers queen diagonals
const ROOK_MASK = 0x08; // also covers queen straights
const KING_MASK = 0x10;

const PIECE_MASKS: Record<string, number> = {
  b: BISHOP_MASK,
  k: KING_MASK,
  n: KNIGHT_MASK,
  p: PAWN_MASK,
  q: BISHOP_MASK | ROOK_MASK,
  r: ROOK_MASK,
};

// tableIndex = (to - from) + 119
// range: -119..+119 → 0..238, array size 240
const ATTACKS = new Uint8Array(240);
const RAYS = new Int8Array(240);
```

---

## Task 1: Update `src/board.ts`

**Files:**

- Modify: `src/board.ts`
- Test: `src/__tests__/board.spec.ts`

**Step 1: Update the failing tests**

The existing tests check the old flat indexing. Update
`src/__tests__/board.spec.ts` to expect 0x88 indices:

```typescript
describe('squareToIndex', () => {
  it('maps a1 to 112', () => {
    expect(squareToIndex('a1')).toBe(112);
  });
  it('maps h1 to 119', () => {
    expect(squareToIndex('h1')).toBe(119);
  });
  it('maps a8 to 0', () => {
    expect(squareToIndex('a8')).toBe(0);
  });
  it('maps h8 to 7', () => {
    expect(squareToIndex('h8')).toBe(7);
  });
  it('maps e4 to 68', () => {
    expect(squareToIndex('e4')).toBe(68);
  });
});

describe('indexToSquare', () => {
  it('maps 112 to a1', () => {
    expect(indexToSquare(112)).toBe('a1');
  });
  it('maps 119 to h1', () => {
    expect(indexToSquare(119)).toBe('h1');
  });
  it('maps 0 to a8', () => {
    expect(indexToSquare(0)).toBe('a8');
  });
  it('maps 7 to h8', () => {
    expect(indexToSquare(7)).toBe('h8');
  });
  it('maps 68 to e4', () => {
    expect(indexToSquare(68)).toBe('e4');
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
  it('returns 1 for a1', () => {
    expect(fileOf('a1')).toBe(1);
  });
  it('returns 8 for h8', () => {
    expect(fileOf('h8')).toBe(8);
  });
});

describe('INITIAL_BOARD', () => {
  it('has a white king on e1 (index 116)', () => {
    expect(INITIAL_BOARD[squareToIndex('e1')]).toEqual({
      color: 'w',
      type: 'k',
    });
  });
  it('has a black pawn on e7 (index 20)', () => {
    expect(INITIAL_BOARD[squareToIndex('e7')]).toEqual({
      color: 'b',
      type: 'p',
    });
  });
  it('has undefined on e4 (index 68)', () => {
    expect(INITIAL_BOARD[squareToIndex('e4')]).toBeUndefined();
  });
  it('has 32 pieces total', () => {
    expect(INITIAL_BOARD.filter(Boolean)).toHaveLength(32);
  });
  it('has 128 total slots', () => {
    expect(INITIAL_BOARD.length).toBe(128);
  });
});
```

**Step 2: Run tests to confirm they fail**

```bash
pnpm test src/__tests__/board.spec.ts
```

Expected: FAIL — old indices don't match.

**Step 3: Rewrite `src/board.ts`**

```typescript
import type { Piece, Square } from './types.js';

// 0x88 index layout:
// index = (8 - rank) * 16 + (file - 1)   rank: 1-based, file: a=1..h=8
// a8=0, h8=7, a7=16, ..., a1=112, h1=119
// Off-board check: index & 0x88 !== 0

export const OFF_BOARD = 0x88;

export function squareToIndex(square: Square): number {
  const file = (square.codePointAt(0) ?? 0) - ('a'.codePointAt(0) ?? 0);
  const rank = Number.parseInt(square[1] ?? '1', 10);
  return (8 - rank) * 16 + file;
}

export function indexToSquare(index: number): Square {
  const rank = 8 - Math.floor(index / 16);
  const file = index % 16;
  return `${String.fromCodePoint(('a'.codePointAt(0) ?? 0) + file)}${rank}` as Square;
}

export function rankOf(square: Square): number {
  return Number.parseInt(square[1] ?? '1', 10);
}

export function fileOf(square: Square): number {
  return (square.codePointAt(0) ?? 0) - ('a'.codePointAt(0) ?? 0) + 1;
}

const BACK_RANK: Piece['type'][] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];

export const INITIAL_BOARD: readonly (Piece | undefined)[] = (() => {
  const board: (Piece | undefined)[] = Array.from({ length: 128 });
  for (let file = 0; file < 8; file++) {
    const type = BACK_RANK[file] ?? 'r';
    // rank 1 = row 7 = index 112+file
    board[112 + file] = { color: 'w', type };
    // rank 2 = row 6 = index 96+file
    board[96 + file] = { color: 'w', type: 'p' };
    // rank 7 = row 1 = index 16+file
    board[16 + file] = { color: 'b', type: 'p' };
    // rank 8 = row 0 = index 0+file
    board[file] = { color: 'b', type };
  }

  return board;
})();

export function cloneBoard(
  board: readonly (Piece | undefined)[],
): (Piece | undefined)[] {
  return [...board];
}
```

**Step 4: Run board tests**

```bash
pnpm test src/__tests__/board.spec.ts
```

Expected: all board tests pass.

**Step 5: Run full suite to see what broke**

```bash
pnpm test 2>&1 | tail -20
```

Expected: board tests pass, fen/moves/game tests fail (they still use old
indices). That's expected — we haven't updated them yet.

**Step 6: Commit**

```bash
git -C /Users/mormubis/workspace/echecs/game add src/board.ts src/__tests__/board.spec.ts
git -C /Users/mormubis/workspace/echecs/game commit -m "feat: switch board to 0x88 [128] layout"
```

---

## Task 2: Update `src/fen.ts`

**Files:**

- Modify: `src/fen.ts`
- Test: `src/__tests__/fen.spec.ts`

The fen tests don't test indices directly — they test FEN round-trips and piece
placement by square name. They should pass once fen.ts uses the new index
arithmetic.

**Step 1: Update `parsePiecePlacement` in `src/fen.ts`**

Replace the board loop to use 0x88 indices:

```typescript
function parsePiecePlacement(placement: string): (Piece | undefined)[] {
  const board: (Piece | undefined)[] = Array.from({ length: 128 });
  const ranks = placement.split('/');

  if (ranks.length !== 8) {
    throw new Error(`Invalid FEN piece placement: ${placement}`);
  }

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    // FEN rank 0 = rank 8 = 0x88 row 0
    // 0x88 index for rank r (1-based), file f (0-based) = (8-r)*16 + f
    const boardRank = 8 - rankIndex; // 1-based rank (8 down to 1)
    const rankString = ranks[rankIndex] ?? '';
    let file = 0;

    for (const char of rankString) {
      const emptyCount = Number.parseInt(char, 10);

      if (Number.isNaN(emptyCount)) {
        const color: Color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase() as Piece['type'];
        const index = (8 - boardRank) * 16 + file;
        board[index] = { color, type };
        file += 1;
      } else {
        file += emptyCount;
      }
    }

    if (file !== 8) {
      throw new Error(`Invalid FEN rank: ${rankString}`);
    }
  }

  return board;
}
```

**Step 2: Update `serialisePiecePlacement` in `src/fen.ts`**

```typescript
function serialisePiecePlacement(board: (Piece | undefined)[]): string {
  const ranks: string[] = [];

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    // FEN rank 0 = rank 8 = 0x88 row 0 (indices 0-7)
    const row = rankIndex; // 0x88 row (0 = rank 8, 7 = rank 1)
    let rankString = '';
    let emptyCount = 0;

    for (let file = 0; file < 8; file++) {
      const index = row * 16 + file;
      const piece = board[index];

      if (piece === undefined) {
        emptyCount += 1;
      } else {
        if (emptyCount > 0) {
          rankString += String(emptyCount);
          emptyCount = 0;
        }

        const char =
          piece.color === 'w'
            ? piece.type.toUpperCase()
            : piece.type.toLowerCase();
        rankString += char;
      }
    }

    if (emptyCount > 0) {
      rankString += String(emptyCount);
    }

    ranks.push(rankString);
  }

  return ranks.join('/');
}
```

**Step 3: Run FEN tests**

```bash
pnpm test src/__tests__/fen.spec.ts
```

Expected: all FEN tests pass (round-trips, starting position, invalid FEN).

**Step 4: Commit**

```bash
git -C /Users/mormubis/workspace/echecs/game add src/fen.ts src/__tests__/fen.spec.ts
git -C /Users/mormubis/workspace/echecs/game commit -m "feat: update FEN parsing to use 0x88 board indices"
```

---

## Task 3: Rewrite `src/moves.ts`

This is the largest task. Work in stages: first get the existing tests passing
with 0x88 indices, then add the ATTACKS/RAYS tables.

**Files:**

- Modify: `src/moves.ts`

### Stage A: Update index arithmetic throughout

**Step 1: Replace imports and constants**

Remove `fileOf`, `rankOf` from imports (no longer needed for move generation —
use raw index arithmetic instead). Keep `cloneBoard`, `indexToSquare`,
`squareToIndex`, `OFF_BOARD`.

Replace the `[rankDelta, fileDelta]` offset arrays with flat 0x88 offsets:

```typescript
import {
  OFF_BOARD,
  cloneBoard,
  indexToSquare,
  squareToIndex,
} from './board.js';

// 0x88 offsets (applied directly to index)
const KNIGHT_OFFSETS_0x88 = [-33, -31, -18, -14, 14, 18, 31, 33];
const BISHOP_DIRS_0x88 = [-17, -15, 15, 17];
const ROOK_DIRS_0x88 = [-16, -1, 1, 16];
const KING_OFFSETS_0x88 = [-17, -16, -15, -1, 1, 15, 16, 17];
```

**Step 2: Replace `makeSquare` with inline off-board check**

The old `makeSquare(rank, file)` returned `Square | undefined` using 4
comparisons. Replace all call sites to use index arithmetic:

```typescript
// OLD pattern (throughout moves.ts):
const targetSquare = makeSquare(rank + rankDelta, file + fileDelta);
if (targetSquare === undefined) continue;

// NEW pattern:
const targetIndex = fromIndex + offset;
if (targetIndex & OFF_BOARD) continue;
const targetSquare = indexToSquare(targetIndex);
```

**Step 3: Rewrite `generatePawnMoves`**

```typescript
function generatePawnMoves(
  state: FenState,
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  const dir = color === 'w' ? -16 : 16; // toward lower index = toward rank 8
  const startRow = color === 'w' ? 6 : 1; // 0x88 row: rank2=row6, rank7=row1
  const promoteRow = color === 'w' ? 0 : 7; // rank8=row0, rank1=row7
  const currentRow = fromIndex >> 4; // fromIndex / 16
  const enemy = enemyColor(color);
  const captureOffsets = color === 'w' ? [-17, -15] : [15, 17];

  // Single push
  const singleIdx = fromIndex + dir;
  if (!(singleIdx & OFF_BOARD) && state.board[singleIdx] === undefined) {
    const toSquare = indexToSquare(singleIdx);
    const toRow = singleIdx >> 4;
    if (toRow === promoteRow) {
      for (const promo of PROMOTION_PIECES) {
        moves.push({ from: fromSquare, promotion: promo, to: toSquare });
      }
    } else {
      moves.push({ from: fromSquare, to: toSquare });
    }

    // Double push
    if (currentRow === startRow) {
      const doubleIdx = fromIndex + dir * 2;
      if (!(doubleIdx & OFF_BOARD) && state.board[doubleIdx] === undefined) {
        moves.push({ from: fromSquare, to: indexToSquare(doubleIdx) });
      }
    }
  }

  // Diagonal captures + en passant
  for (const capOffset of captureOffsets) {
    const capIdx = fromIndex + capOffset;
    if (capIdx & OFF_BOARD) continue;
    const capSquare = indexToSquare(capIdx);
    const target = state.board[capIdx];
    const isEnPassant = state.enPassantSquare === capSquare;

    if ((target !== undefined && target.color === enemy) || isEnPassant) {
      const toRow = capIdx >> 4;
      if (toRow === promoteRow) {
        for (const promo of PROMOTION_PIECES) {
          moves.push({ from: fromSquare, promotion: promo, to: capSquare });
        }
      } else {
        moves.push({ from: fromSquare, to: capSquare });
      }
    }
  }
}
```

**Step 4: Rewrite `generateKnightMoves`**

```typescript
function generateKnightMoves(
  state: FenState,
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  for (const offset of KNIGHT_OFFSETS_0x88) {
    const toIndex = fromIndex + offset;
    if (toIndex & OFF_BOARD) continue;
    const target = state.board[toIndex];
    if (target === undefined || target.color !== color) {
      moves.push({ from: fromSquare, to: indexToSquare(toIndex) });
    }
  }
}
```

**Step 5: Rewrite `generateSlidingMoves`**

```typescript
function generateSlidingMoves(
  state: FenState,
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  dirs: number[],
  moves: Move[],
): void {
  for (const dir of dirs) {
    let toIndex = fromIndex + dir;
    while (!(toIndex & OFF_BOARD)) {
      const target = state.board[toIndex];
      if (target === undefined) {
        moves.push({ from: fromSquare, to: indexToSquare(toIndex) });
      } else if (target.color !== color) {
        moves.push({ from: fromSquare, to: indexToSquare(toIndex) });
        break;
      } else {
        break;
      }
      toIndex += dir;
    }
  }
}
```

**Step 6: Rewrite `generateKingMoves` (non-castling part)**

```typescript
function generateKingMoves(
  state: FenState,
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  for (const offset of KING_OFFSETS_0x88) {
    const toIndex = fromIndex + offset;
    if (toIndex & OFF_BOARD) continue;
    const target = state.board[toIndex];
    if (target === undefined || target.color !== color) {
      moves.push({ from: fromSquare, to: indexToSquare(toIndex) });
    }
  }

  // Castling (keep existing logic, just update square lookups to use squareToIndex)
  // ... castling squares are named squares so squareToIndex handles them
}
```

**Step 7: Update `generatePseudoLegalMovesForSquare`**

Change it to pass `fromIndex` alongside `fromSquare` to all sub-functions:

```typescript
function generatePseudoLegalMovesForSquare(
  state: FenState,
  square: Square,
): Move[] {
  const fromIndex = squareToIndex(square);
  const piece = state.board[fromIndex];
  if (piece === undefined || piece.color !== state.turn) {
    return [];
  }

  const moves: Move[] = [];

  switch (piece.type) {
    case 'p': {
      generatePawnMoves(state, fromIndex, square, piece.color, moves);
      break;
    }
    case 'n': {
      generateKnightMoves(state, fromIndex, square, piece.color, moves);
      break;
    }
    case 'b': {
      generateSlidingMoves(
        state,
        fromIndex,
        square,
        piece.color,
        BISHOP_DIRS_0x88,
        moves,
      );
      break;
    }
    case 'r': {
      generateSlidingMoves(
        state,
        fromIndex,
        square,
        piece.color,
        ROOK_DIRS_0x88,
        moves,
      );
      break;
    }
    case 'q': {
      generateSlidingMoves(
        state,
        fromIndex,
        square,
        piece.color,
        BISHOP_DIRS_0x88,
        moves,
      );
      generateSlidingMoves(
        state,
        fromIndex,
        square,
        piece.color,
        ROOK_DIRS_0x88,
        moves,
      );
      break;
    }
    case 'k': {
      generateKingMoves(state, fromIndex, square, piece.color, moves);
      break;
    }
  }

  return moves;
}
```

**Step 8: Update `isInCheck` king search loop**

```typescript
export function isInCheck(state: FenState, color: Color): boolean {
  let kingIndex = -1;
  for (let i = 0; i <= 119; i++) {
    if (i & OFF_BOARD) continue;
    const piece = state.board[i];
    if (piece !== undefined && piece.type === 'k' && piece.color === color) {
      kingIndex = i;
      break;
    }
  }
  if (kingIndex === -1) return false;
  return isSquareAttackedBy(state.board, kingIndex, enemyColor(color));
}
```

**Step 9: Update `isSquareAttackedBy` signature to take index**

Change `isSquareAttackedBy(board, square: Square, color)` to
`isSquareAttackedBy(board, targetIndex: number, color)`. Update its internal
loop to use 0x88 iteration and indices directly (keep the same ray-tracing logic
for now — ATTACKS table comes in Stage B):

```typescript
function isSquareAttackedBy(
  board: (Piece | undefined)[],
  targetIndex: number,
  attackerColor: Color,
): boolean {
  for (let i = 0; i <= 119; i++) {
    if (i & OFF_BOARD) continue;
    const piece = board[i];
    if (piece === undefined || piece.color !== attackerColor) continue;

    const fromSquare = indexToSquare(i);
    const targetSquare = indexToSquare(targetIndex);
    const attacks = generateAttackMovesForSquare(
      board,
      fromSquare,
      attackerColor,
    );
    if (attacks.includes(targetSquare)) return true;
  }
  return false;
}
```

Also update `generateAttackMovesForSquare` to use 0x88 offsets instead of
`[rankDelta, fileDelta]` pairs — same structure as the move generation rewrites
above, but without color restrictions on captures (attack detection ignores
piece color of the target).

**Step 10: Update `applyMoveToState`**

This function iterates the board and uses `squareToIndex`. Since `squareToIndex`
now returns 0x88 indices, and the board is `[128]`, the logic is unchanged — but
verify all `board[squareToIndex(sq)]` calls and any numeric index arithmetic.
The board clone in `applyMoveToState` must clone 128 slots:

```typescript
// cloneBoard already does [...board] which works for any length
```

**Step 11: Run the full test suite**

```bash
pnpm test 2>&1 | tail -30
```

Expected: all 89 tests pass. If any fail, the issue is in the index arithmetic —
compare the 0x88 index of the failing square against the expected value using
the formula `(8 - rank) * 16 + (file - 1)`.

**Step 12: Commit Stage A**

```bash
git -C /Users/mormubis/workspace/echecs/game add src/moves.ts
git -C /Users/mormubis/workspace/echecs/game commit -m "feat: update move generation to use 0x88 index arithmetic"
```

### Stage B: Add ATTACKS and RAYS tables

**Step 13: Add table initialization to `src/moves.ts`**

Add this block near the top of `moves.ts`, after the imports:

```typescript
// ── ATTACKS / RAYS lookup tables ─────────────────────────────────────────────

const PAWN_MASK = 0x01;
const KNIGHT_MASK = 0x02;
const BISHOP_MASK = 0x04;
const ROOK_MASK = 0x08;
const KING_MASK = 0x10;

const PIECE_MASKS: Record<string, number> = {
  b: BISHOP_MASK,
  k: KING_MASK,
  n: KNIGHT_MASK,
  p: PAWN_MASK,
  q: BISHOP_MASK | ROOK_MASK,
  r: ROOK_MASK,
};

const ATTACKS = new Uint8Array(240);
const RAYS = new Int8Array(240);

// Knight
for (const offset of [-33, -31, -18, -14, 14, 18, 31, 33]) {
  ATTACKS[offset + 119] |= KNIGHT_MASK;
}

// King
for (const offset of [-17, -16, -15, -1, 1, 15, 16, 17]) {
  ATTACKS[offset + 119] |= KING_MASK;
}

// Pawns — white attacks -17/-15 (toward rank 8), black attacks +15/+17
for (const offset of [15, 17]) {
  ATTACKS[offset + 119] |= PAWN_MASK;
  ATTACKS[-offset + 119] |= PAWN_MASK;
}

// Sliding pieces
for (let from = 0; from <= 119; from++) {
  if (from & 0x88) continue;

  for (const dir of [-16, 16, -1, 1]) {
    let to = from + dir;
    while (!(to & 0x88)) {
      const diff = to - from;
      ATTACKS[diff + 119] |= ROOK_MASK;
      RAYS[diff + 119] = dir;
      to += dir;
    }
  }

  for (const dir of [-17, -15, 15, 17]) {
    let to = from + dir;
    while (!(to & 0x88)) {
      const diff = to - from;
      ATTACKS[diff + 119] |= BISHOP_MASK;
      RAYS[diff + 119] = dir;
      to += dir;
    }
  }
}
```

**Step 14: Replace `isSquareAttackedBy` with the lookup version**

```typescript
function isSquareAttackedBy(
  board: (Piece | undefined)[],
  targetIndex: number,
  attackerColor: Color,
): boolean {
  for (let i = 0; i <= 119; i++) {
    if (i & OFF_BOARD) continue;
    const piece = board[i];
    if (piece === undefined || piece.color !== attackerColor) continue;

    const diff = i - targetIndex;
    const index = diff + 119;
    const mask = ATTACKS[index];
    if (mask === undefined || mask === 0) continue;

    const pieceMask = PIECE_MASKS[piece.type];
    if (pieceMask === undefined || !(mask & pieceMask)) continue;

    // Pawn: direction must match attacker color
    if (piece.type === 'p') {
      // White pawns attack toward lower indices (negative diff from attacker to target)
      // i.e. attacker index > target index → diff > 0 → white attacks
      if (attackerColor === 'w' && diff <= 0) continue;
      if (attackerColor === 'b' && diff >= 0) continue;
      return true;
    }

    // Knight / King: no blockers possible
    if (piece.type === 'n' || piece.type === 'k') return true;

    // Sliding piece: check for blockers along the ray
    const step = RAYS[index];
    if (step === undefined || step === 0) continue;
    let j = i + step;
    while (j !== targetIndex) {
      if (board[j] !== undefined) break;
      j += step;
    }
    if (j === targetIndex) return true;
  }

  return false;
}
```

Also remove the now-unused `generateAttackMovesForSquare`, `collectPawnAttacks`,
`collectKnightAttacks`, `collectSlidingAttacks` functions — they are replaced by
the ATTACKS table.

**Step 15: Run the full test suite**

```bash
pnpm test 2>&1 | tail -20
```

Expected: all 89 tests pass including perft(3) = 8,902.

If perft(3) is wrong, the pawn direction check is the most likely culprit —
verify: white pawn on e2 (index 100) attacks d3 (index 83) and f3 (index 85).
`diff = 100 - 83 = +17` — `attackerColor === 'w'` and `diff > 0` → true. ✓

**Step 16: Run lint**

```bash
pnpm lint
```

Fix any errors. Common issues:

- `sort-keys` on `PIECE_MASKS` object literal — keys must be alphabetical
- Unused imports after removing `fileOf`, `rankOf`
- `@typescript-eslint/no-non-null-assertion` — avoid `!` on array lookups, use
  `?? 0` fallback or proper narrowing

**Step 17: Commit Stage B**

```bash
git -C /Users/mormubis/workspace/echecs/game add src/moves.ts
git -C /Users/mormubis/workspace/echecs/game commit -m "perf: add ATTACKS/RAYS tables, rewrite isSquareAttackedBy"
```

---

## Task 4: Run benchmarks and update results

**Files:**

- Modify: `BENCHMARK_RESULTS.md`
- Modify: `src/__tests__/comparison.bench.ts`

**Step 1: Add raw perft benchmark**

Add this describe block to `src/__tests__/comparison.bench.ts`:

```typescript
import { parseFen, serialiseFen, STARTING_FEN } from '../fen.js';
import { applyMoveToState, generateMoves } from '../moves.js';

// Raw perft — bypasses Game cache, exercises move generation directly
function rawPerft(fen: string, depth: number): number {
  const state = parseFen(fen);
  if (depth === 0) return 1;
  const moves = generateMoves(state);
  if (depth === 1) return moves.length;
  let count = 0;
  for (const move of moves) {
    count += rawPerft(serialiseFen(applyMoveToState(state, move)), depth - 1);
  }
  return count;
}

describe('raw perft(3) — no cache, exercises move generation', () => {
  bench('@echecs/game', () => {
    rawPerft(STARTING_FEN, 3);
  });
  bench('chess.js', () => {
    new Chess(STARTING_FEN).perft(3);
  });
});
```

**Step 2: Build and run benchmarks**

```bash
pnpm build && pnpm bench 2>&1
```

Run from: `/Users/mormubis/workspace/echecs/game/`

**Step 3: Update `BENCHMARK_RESULTS.md`**

Replace all benchmark results with the new numbers. Follow the exact format of
the existing file. Update the date header and the Key Findings section to
reflect the 0x88 improvements.

**Step 4: Commit**

```bash
git -C /Users/mormubis/workspace/echecs/game add BENCHMARK_RESULTS.md src/__tests__/comparison.bench.ts
git -C /Users/mormubis/workspace/echecs/game commit -m "docs: update benchmark results after 0x88 migration"
```

---

## Task 5: Update AGENTS.md

**Files:**

- Modify: `AGENTS.md`

**Step 1: Update the Board representation section**

Find the section starting "### Board representation" and update it to describe
0x88:

```markdown
### Board representation

The board is a flat `(Piece | undefined)[128]` array using the 0x88
representation. Index layout:
```

index = (8 - rank) \* 16 + file where file: a=0 … h=7, rank: 1-based a8=0, b8=1,
…, h8=7, a7=16, …, a1=112, h1=119

```

Off-board check: `index & 0x88 !== 0` — one bitwise AND.

Valid squares occupy indices where `index & 0x88 === 0`. The other 64 slots
are always `undefined` and act as implicit padding. This layout enables:

1. **Single-instruction off-board check** — replaces 4 comparisons per step
2. **ATTACKS lookup table** — `ATTACKS[(to - from) + 119]` gives a bitmask
   of piece types that can attack along any vector, enabling O(1) attack
   detection per enemy piece

`src/board.ts` provides `squareToIndex` and `indexToSquare` for converting
between `Square` strings and indices. All internal code uses indices directly;
the public API accepts `Square` strings.
```

**Step 2: Update the Move generation section**

Add a note about ATTACKS/RAYS tables to the move generation description.

**Step 3: Format and commit**

```bash
cd /Users/mormubis/workspace/echecs/game && pnpm format
git add AGENTS.md
git commit -m "docs: update AGENTS.md to reflect 0x88 board representation"
```

---

## Final verification

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: all 89 tests pass, zero lint errors, clean build.
