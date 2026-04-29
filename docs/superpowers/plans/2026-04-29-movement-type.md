# Replace `MoveResult` with `Movement[]` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> superpowers:subagent-driven-development (recommended) or
> superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `MoveResult` with an ordered `Movement[]` that uniformly
describes all board changes — forward and backward — without information loss.

**Architecture:** Delete `MoveResult`, add `Movement` type. Rewrite the result
construction in `move()` (moves.ts) to build `Movement[]`. Update `Game` class
to drop stored results from history, compute movements on demand, and reverse
them for undo. Update all tests.

**Tech Stack:** TypeScript, vitest

**Spec:** `docs/superpowers/specs/2026-04-29-movement-type-design.md`

---

### Task 1: Replace `MoveResult` type with `Movement` in `src/types.ts`

**Files:**

- Modify: `src/types.ts`

- [ ] **Step 1: Replace `MoveResult` with `Movement`**

Replace the entire contents of `src/types.ts` with:

```typescript
import type { Piece, Square } from '@echecs/position';

interface Movement {
  from: Square | undefined;
  to: Square | undefined;
  piece: Piece;
}

export type { Movement };
```

- [ ] **Step 2: Verify types compile**

Run: `pnpm lint:types` Expected: Failures in `game.ts`, `moves.ts`, `index.ts`
referencing `MoveResult`. This is expected — we fix those in later tasks.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "refactor: replace MoveResult type with Movement"
```

---

### Task 2: Update public exports in `src/index.ts`

**Files:**

- Modify: `src/index.ts`

- [ ] **Step 1: Replace `MoveResult` export with `Movement`**

Change line 3 from:

```typescript
export type { MoveResult } from './types.js';
```

to:

```typescript
export type { Movement } from './types.js';
```

- [ ] **Step 2: Commit**

```bash
git add src/index.ts
git commit -m "refactor: export Movement instead of MoveResult"
```

---

### Task 3: Rewrite `move()` in `src/moves.ts` to return `Movement[]`

**Files:**

- Modify: `src/moves.ts`

- [ ] **Step 1: Update the import**

Change line 1 from:

```typescript
import type { MoveResult } from './types.js';
```

to:

```typescript
import type { Movement } from './types.js';
```

- [ ] **Step 2: Update the `move()` function signature and return type**

Change the function signature (line 207-210) from:

```typescript
function move(
  position: Position,
  m: Move,
): { position: Position; result: MoveResult } {
```

to:

```typescript
function move(
  position: Position,
  m: Move,
): { movements: Movement[]; position: Position } {
```

- [ ] **Step 3: Update the early return for missing piece**

Change lines 211-221 from:

```typescript
const piece = position.at(m.from);
if (piece === undefined) {
  return {
    position,
    result: {
      from: m.from,
      piece: { color: 'white', type: 'pawn' },
      to: m.to,
    },
  };
}
```

to:

```typescript
const piece = position.at(m.from);
if (piece === undefined) {
  return { movements: [], position };
}
```

- [ ] **Step 4: Replace `MoveResult` construction with `Movement[]`
      construction**

Replace lines 339-375 (the `// Build MoveResult` block through the castling
result) with:

```typescript
// Build Movement[]
const movements: Movement[] = [];

if (piece.type === 'pawn' && m.promotion !== undefined) {
  // Promotion: pawn disappears, promoted piece appears
  movements.push({ from: m.from, piece, to: undefined });
  movements.push({
    from: undefined,
    piece: { color: piece.color, type: m.promotion },
    to: m.to,
  });
} else {
  // Primary movement
  movements.push({ from: m.from, piece, to: m.to });
}

// Castling: rook relocation
if (isCastling) {
  const rank = m.from[1] as string;
  const rook: Piece = { color: piece.color, type: 'rook' };
  movements.push(
    toFile === 'g'
      ? { from: `h${rank}` as Square, piece: rook, to: `f${rank}` as Square }
      : { from: `a${rank}` as Square, piece: rook, to: `d${rank}` as Square },
  );
}

// Captures
if (isEnPassant) {
  const capturedFile = m.to[0] as string;
  const capturedRank = m.from[1] as string;
  const capturedSquare = `${capturedFile}${capturedRank}` as Square;
  const capturedPiece = position.at(capturedSquare);
  if (capturedPiece !== undefined) {
    movements.push({
      from: capturedSquare,
      piece: capturedPiece,
      to: undefined,
    });
  }
} else if (isCapture) {
  const capturedPiece = position.at(m.to);
  if (capturedPiece !== undefined) {
    movements.push({ from: m.to, piece: capturedPiece, to: undefined });
  }
}
```

- [ ] **Step 5: Update the return statement**

Change line 377 from:

```typescript
return { position: newPosition, result };
```

to:

```typescript
return { movements, position: newPosition };
```

- [ ] **Step 6: Verify types compile**

Run: `pnpm lint:types` Expected: Failures in `game.ts` only (still references
`MoveResult` and `result`). `moves.ts` should compile cleanly.

- [ ] **Step 7: Commit**

```bash
git add src/moves.ts
git commit -m "refactor: move() returns Movement[] instead of MoveResult"
```

---

### Task 4: Update `Game` class in `src/game.ts`

**Files:**

- Modify: `src/game.ts`

- [ ] **Step 1: Update imports**

Change line 6 from:

```typescript
import type { MoveResult } from './types.js';
```

to:

```typescript
import type { Movement } from './types.js';
```

- [ ] **Step 2: Delete `reverseMoveResult` function**

Delete lines 9-25 (the entire `reverseMoveResult` function).

- [ ] **Step 3: Update `HistoryEntry` interface**

Replace:

```typescript
interface HistoryEntry {
  move: Move;
  previousPosition: Position;
  result: MoveResult;
}
```

with:

```typescript
interface HistoryEntry {
  move: Move;
  position: Position;
}
```

- [ ] **Step 4: Update `move()` method**

Replace the `move()` method body. Change:

```typescript
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

to:

```typescript
  move(input: Move): Movement[] {
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
    const position = this.#position;
    const { movements, position: newPosition } = applyMove(this.#position, input);
    this.#position = newPosition;
    this.#past.push({ move: input, position });
    this.#future = [];
    this.#positionHistory.push(this.#position.hash);

    return movements;
  }
```

- [ ] **Step 5: Update `undo()` method**

Replace:

```typescript
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

with:

```typescript
  undo(): Movement[] | undefined {
    const entry = this.#past.pop();
    if (entry === undefined) {
      return undefined;
    }

    this.#cache = undefined;
    this.#position = entry.position;
    this.#future.push(entry);
    this.#positionHistory.pop();

    const { movements } = applyMove(entry.position, entry.move);
    const swap = (m: Movement) => ({
      from: m.to,
      piece: m.piece,
      to: m.from,
    });
    const activeColor = entry.position.turn;
    const active = movements
      .filter((m) => m.piece.color === activeColor)
      .reverse()
      .map(swap);
    const opponent = movements
      .filter((m) => m.piece.color !== activeColor)
      .reverse()
      .map(swap);

    return [...active, ...opponent];
  }
```

- [ ] **Step 6: Update `redo()` method**

Replace:

```typescript
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

with:

```typescript
  redo(): Movement[] | undefined {
    const entry = this.#future.pop();
    if (entry === undefined) {
      return undefined;
    }

    this.#cache = undefined;
    const { movements, position } = applyMove(entry.position, entry.move);
    this.#position = position;
    this.#past.push(entry);
    this.#positionHistory.push(this.#position.hash);

    return movements;
  }
```

- [ ] **Step 7: Update JSDoc on `move()` method**

Change the JSDoc comment from:

```typescript
  /**
   * Applies a move and returns a {@link MoveResult} describing what happened.
   * Clears the redo stack.
```

to:

```typescript
  /**
   * Applies a move and returns a {@link Movement} array describing all board
   * changes. Clears the redo stack.
```

- [ ] **Step 8: Verify types compile**

Run: `pnpm lint:types` Expected: PASS — all `MoveResult` references removed.

- [ ] **Step 9: Commit**

```bash
git add src/game.ts
git commit -m "refactor: Game class uses Movement[] for move/undo/redo"
```

---

### Task 5: Update `move()` return value tests

**Files:**

- Modify: `src/__tests__/game.spec.ts`

- [ ] **Step 1: Write failing tests for `move()` returning `Movement[]`**

Replace the `describe('move()', ...)` block (lines 25-89) with:

```typescript
describe('move()', () => {
  it('applies a legal move and returns Movement[]', () => {
    const game = new Game();
    const result = game.move({ from: 'e2', to: 'e4' });
    expect(game.get('e4')).toEqual({ color: 'white', type: 'pawn' });
    expect(game.get('e2')).toBeUndefined();
    expect(result).toEqual([
      { from: 'e2', to: 'e4', piece: { color: 'white', type: 'pawn' } },
    ]);
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

  it('returns Movement[] with capture', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.move({ from: 'd7', to: 'd5' });
    const result = game.move({ from: 'e4', to: 'd5' });
    expect(result).toEqual([
      { from: 'e4', to: 'd5', piece: { color: 'white', type: 'pawn' } },
      { from: 'd5', to: undefined, piece: { color: 'black', type: 'pawn' } },
    ]);
  });

  it('returns Movement[] with castling', () => {
    const game = new Game(
      fromFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'),
    );
    const result = game.move({ from: 'e1', to: 'g1' });
    expect(result).toEqual([
      { from: 'e1', to: 'g1', piece: { color: 'white', type: 'king' } },
      { from: 'h1', to: 'f1', piece: { color: 'white', type: 'rook' } },
    ]);
  });

  it('returns Movement[] with promotion', () => {
    const game = new Game(fromFen('k7/4P3/8/8/8/8/8/K7 w - - 0 1'));
    const result = game.move({ from: 'e7', to: 'e8', promotion: 'queen' });
    expect(result).toEqual([
      { from: 'e7', to: undefined, piece: { color: 'white', type: 'pawn' } },
      { from: undefined, to: 'e8', piece: { color: 'white', type: 'queen' } },
    ]);
  });

  it('returns Movement[] with promotion and capture', () => {
    const game = new Game(fromFen('k2r4/4P3/8/8/8/8/8/K7 w - - 0 1'));
    const result = game.move({ from: 'e7', to: 'd8', promotion: 'queen' });
    expect(result).toEqual([
      { from: 'e7', to: undefined, piece: { color: 'white', type: 'pawn' } },
      { from: undefined, to: 'd8', piece: { color: 'white', type: 'queen' } },
      { from: 'd8', to: undefined, piece: { color: 'black', type: 'rook' } },
    ]);
  });

  it('returns Movement[] with en passant', () => {
    const game = new Game(
      fromFen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3'),
    );
    const result = game.move({ from: 'e5', to: 'd6' });
    expect(result).toEqual([
      { from: 'e5', to: 'd6', piece: { color: 'white', type: 'pawn' } },
      { from: 'd5', to: undefined, piece: { color: 'black', type: 'pawn' } },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test src/__tests__/game.spec.ts -- --reporter=verbose -t "move()"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/game.spec.ts
git commit -m "test: update move() tests to assert Movement[]"
```

---

### Task 6: Update `undo()` return value tests

**Files:**

- Modify: `src/__tests__/game.spec.ts`

- [ ] **Step 1: Replace `undo()` return value tests**

Replace the `describe('undo() return value', ...)` block (lines 266-319) with:

```typescript
describe('undo() return value', () => {
  it('returns undefined when nothing to undo', () => {
    const game = new Game();
    expect(game.undo()).toBeUndefined();
  });

  it('returns reversed Movement[] for a normal move', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    const result = game.undo();
    expect(result).toEqual([
      { from: 'e4', to: 'e2', piece: { color: 'white', type: 'pawn' } },
    ]);
  });

  it('returns reversed Movement[] with capture (uncapture)', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.move({ from: 'd7', to: 'd5' });
    game.move({ from: 'e4', to: 'd5' });
    const result = game.undo();
    expect(result).toEqual([
      { from: 'd5', to: 'e4', piece: { color: 'white', type: 'pawn' } },
      { from: undefined, to: 'd5', piece: { color: 'black', type: 'pawn' } },
    ]);
  });

  it('returns reversed Movement[] with en passant (uncapture)', () => {
    const game = new Game(
      fromFen('rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3'),
    );
    game.move({ from: 'e5', to: 'd6' });
    const result = game.undo();
    expect(result).toEqual([
      { from: 'd6', to: 'e5', piece: { color: 'white', type: 'pawn' } },
      { from: undefined, to: 'd5', piece: { color: 'black', type: 'pawn' } },
    ]);
  });

  it('returns reversed Movement[] with castling', () => {
    const game = new Game(
      fromFen('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1'),
    );
    game.move({ from: 'e1', to: 'g1' });
    const result = game.undo();
    expect(result).toEqual([
      { from: 'g1', to: 'e1', piece: { color: 'white', type: 'king' } },
      { from: 'f1', to: 'h1', piece: { color: 'white', type: 'rook' } },
    ]);
  });

  it('returns reversed Movement[] with promotion (depromotion)', () => {
    const game = new Game(fromFen('k7/4P3/8/8/8/8/8/K7 w - - 0 1'));
    game.move({ from: 'e7', to: 'e8', promotion: 'queen' });
    const result = game.undo();
    expect(result).toEqual([
      { from: undefined, to: 'e7', piece: { color: 'white', type: 'pawn' } },
      { from: 'e8', to: undefined, piece: { color: 'white', type: 'queen' } },
    ]);
  });

  it('returns reversed Movement[] with promotion and capture', () => {
    const game = new Game(fromFen('k2r4/4P3/8/8/8/8/8/K7 w - - 0 1'));
    game.move({ from: 'e7', to: 'd8', promotion: 'queen' });
    const result = game.undo();
    expect(result).toEqual([
      { from: undefined, to: 'e7', piece: { color: 'white', type: 'pawn' } },
      { from: 'd8', to: undefined, piece: { color: 'white', type: 'queen' } },
      { from: undefined, to: 'd8', piece: { color: 'black', type: 'rook' } },
    ]);
  });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `pnpm test src/__tests__/game.spec.ts -- --reporter=verbose -t "undo"`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/game.spec.ts
git commit -m "test: update undo() tests to assert reversed Movement[]"
```

---

### Task 7: Update `redo()` return value tests

**Files:**

- Modify: `src/__tests__/game.spec.ts`

- [ ] **Step 1: Replace `redo()` return value tests**

Replace the `describe('redo() return value', ...)` block (lines 322-352) with:

```typescript
describe('redo() return value', () => {
  it('returns undefined when nothing to redo', () => {
    const game = new Game();
    expect(game.redo()).toBeUndefined();
  });

  it('returns forward Movement[]', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.undo();
    const result = game.redo();
    expect(result).toEqual([
      { from: 'e2', to: 'e4', piece: { color: 'white', type: 'pawn' } },
    ]);
  });

  it('returns forward Movement[] with capture', () => {
    const game = new Game();
    game.move({ from: 'e2', to: 'e4' });
    game.move({ from: 'd7', to: 'd5' });
    game.move({ from: 'e4', to: 'd5' });
    game.undo();
    const result = game.redo();
    expect(result).toEqual([
      { from: 'e4', to: 'd5', piece: { color: 'white', type: 'pawn' } },
      { from: 'd5', to: undefined, piece: { color: 'black', type: 'pawn' } },
    ]);
  });
});
```

- [ ] **Step 2: Run full test suite**

Run: `pnpm test` Expected: All tests PASS.

- [ ] **Step 3: Commit**

```bash
git add src/__tests__/game.spec.ts
git commit -m "test: update redo() tests to assert Movement[]"
```

---

### Task 8: Run lint, types, and build

**Files:** None (verification only)

- [ ] **Step 1: Run lint**

Run: `pnpm lint` Expected: PASS

- [ ] **Step 2: Run full test suite**

Run: `pnpm test` Expected: All tests PASS.

- [ ] **Step 3: Run build**

Run: `pnpm build` Expected: PASS — clean build output in `dist/`.
