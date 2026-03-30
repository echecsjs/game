# Error Messages + Rook-Capture Tests Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to
> implement this plan task-by-task.

**Goal:** Add descriptive illegal move error messages to `Game.move()` and
explicit tests for castling rights revocation on rook capture.

**Architecture:** Post-hoc inspection in the error branch of `Game.move()` —
zero cost on the happy path. Uses cached legal moves and position state already
available. Rook-capture tests use FEN positions where capturing a corner rook is
legal.

**Tech Stack:** TypeScript, Vitest

---

### Task 1: Add rook-capture castling rights tests

**Files:**

- Modify: `src/__tests__/moves.spec.ts` (append new describe block after
  existing castling tests, around line 96)

**Step 1: Write the tests**

Add a new `describe` block after the existing castling tests (line 96):

```typescript
describe('castling rights revoked on rook capture', () => {
  it('capturing white rook on a1 revokes white queenside castling', () => {
    // Black bishop on b2 can capture the white rook on a1
    const fen = 'r3k2r/pppppppp/8/8/8/1b6/PPPPPPPP/R3K2R b KQkq - 0 1';
    const position = fromFen(fen);
    const next = move(position, { from: 'b3', promotion: undefined, to: 'a2' });
    // Actually we need a position where the capture lands on a1.
    // Let's use: black bishop on b2, white rook on a1
    // Wait — b2 has a white pawn in starting. Let me craft a proper FEN.
  });
});
```

Actually, let me craft correct FENs. We need positions where:

- A piece can legally capture the rook on the target corner square
- Castling rights are still set before the capture

**Correct FENs and moves:**

1. **Capture on a1 (revokes wQ):** Black to move, bishop captures rook on a1.
   `r3k2r/pppppppp/8/8/1b6/8/PPPPPPPP/R3K2R b KQkq - 0 1` — black bishop on b4
   captures... no, a white pawn is on a2/b2 blocking. Need to remove pawns.

   `r3k2r/pppppppp/8/8/1b6/8/1PPPPPPP/R3K2R b KQkq - 0 1` — a-file pawn removed,
   bishop on b4 can reach a3 but not a1 in one move. Bishop on b2 can capture
   a1.

   `r3k2r/pppppppp/8/8/8/8/1bPPPPPP/R3K2R b KQkq - 0 1` — black bishop on b2,
   a-pawn removed. Bishop captures a1.

   Move: `{ from: 'b2', to: 'a1' }`. After capture, FEN should have `KQkq` →
   castling rights should lose `Q` → `Kkq`.

   Wait — but black is capturing. After the move, it's white's turn. The FEN
   should show `Kkq` (white lost Q-side).

2. **Capture on h1 (revokes wK):**
   `r3k2r/pppppppp/8/8/8/8/PPPPPPgP/R3K2R b KQkq - 0 1` — black bishop on g2,
   h-pawn present but bishop captures h1 diagonally... g2 to h1 works.

   `r3k2r/pppppppp/8/8/8/8/PPPPPP1P/R3K2R b KQkq - 0 1` — wait, need the bishop
   on g2. But g-pawn is there. Remove it:

   `r3k2r/pppppppp/8/8/8/8/PPPPPP1g/R3K2R b KQkq - 0 1` — no, lowercase g =
   black bishop? No, in FEN `b` = black bishop, `g` is not valid.

   Let me use proper FEN piece letters. Black bishop = `b`.

   `r3k2r/pppppppp/8/8/8/8/PPPPPP1b/R3K2R b KQkq - 0 1` — black bishop on h2?
   No, that's g2 position... Let me count: a=P, b=P, c=P, d=P, e=P, f=P,
   g=1(empty), h=b(black bishop). So black bishop is on h2. It can capture...
   it's a bishop so it moves diagonally. From h2 it can go to g1 or g3. Not h1.

   Better approach: put a black rook on the h-file.
   `r3k2r/pppppppp/8/8/8/7q/PPPPPP1P/R3K2R b KQkq - 0 1` — black queen on h3,
   h-pawn on h2 blocks. Remove it:
   `r3k2r/pppppppp/8/8/8/7q/PPPPPP2/R3K2R b KQkq - 0 1` — black queen on h3, g
   and h pawns removed. Queen captures h1.

   Move: `{ from: 'h3', to: 'h1' }`. After capture, castling should lose `K` →
   `Qkq`.

3. **Capture on a8 (revokes bQ):** White to move, captures the black rook on a8.
   `r3k2r/1ppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1` — a-pawn removed. White
   needs a piece that can reach a8. Put a white queen on a3:
   `r3k2r/1ppppppp/8/8/8/Q7/PPPPPPPP/R3K2R w KQkq - 0 1` — white queen on a3.
   Path a3→a8 is clear (a7 pawn removed, a4-a7 empty). Queen captures a8.

   Move: `{ from: 'a3', to: 'a8' }`. After capture, castling should lose `q` →
   `KQk`.

4. **Capture on h8 (revokes bK):** White to move, captures black rook on h8.
   `r3k2r/pppppp1p/8/8/8/7Q/PPPPPPPP/R3K2R w KQkq - 0 1` — g-pawn removed, white
   queen on h3. Path h3→h8: h4,h5,h6,h7 — h7 has a pawn (`p`). Remove it too:
   `r3k2r/pppppp2/8/8/8/7Q/PPPPPPPP/R3K2R w KQkq - 0 1` — g and h pawns removed.
   Queen captures h8.

   Move: `{ from: 'h3', to: 'h8' }`. After capture, castling should lose `k` →
   `KQq`.

Let me verify these positions are valid and the moves are legal before writing
the plan. The implementer should verify by running the tests.

**Step 1: Write the tests**

Append after the existing `describe('generateMoves — promotion')` block (after
line 121) in `src/__tests__/moves.spec.ts`:

```typescript
describe('castling rights revoked on rook capture', () => {
  it('capturing rook on a1 revokes white queenside castling', () => {
    // Black bishop on b2, white a-pawn removed — bishop captures rook on a1
    const position = fromFen(
      'r3k2r/pppppppp/8/8/8/8/1bPPPPPP/R3K2R b KQkq - 0 1',
    );
    const next = move(position, { from: 'b2', promotion: undefined, to: 'a1' });
    expect(next.castlingRights.wQ).toBe(false);
    expect(next.castlingRights.wK).toBe(true);
  });

  it('capturing rook on h1 revokes white kingside castling', () => {
    // Black queen on h3, white g and h pawns removed — queen captures rook on h1
    const position = fromFen(
      'r3k2r/pppppppp/8/8/8/7q/PPPPPP2/R3K2R b KQkq - 0 1',
    );
    const next = move(position, { from: 'h3', promotion: undefined, to: 'h1' });
    expect(next.castlingRights.wK).toBe(false);
    expect(next.castlingRights.wQ).toBe(true);
  });

  it('capturing rook on a8 revokes black queenside castling', () => {
    // White queen on a3, black a-pawn removed — queen captures rook on a8
    const position = fromFen(
      'r3k2r/1ppppppp/8/8/8/Q7/PPPPPPPP/R3K2R w KQkq - 0 1',
    );
    const next = move(position, { from: 'a3', promotion: undefined, to: 'a8' });
    expect(next.castlingRights.bQ).toBe(false);
    expect(next.castlingRights.bK).toBe(true);
  });

  it('capturing rook on h8 revokes black kingside castling', () => {
    // White queen on h3, black g and h pawns removed — queen captures rook on h8
    const position = fromFen(
      'r3k2r/pppppp2/8/8/8/7Q/PPPPPPPP/R3K2R w KQkq - 0 1',
    );
    const next = move(position, { from: 'h3', promotion: undefined, to: 'h8' });
    expect(next.castlingRights.bK).toBe(false);
    expect(next.castlingRights.bQ).toBe(true);
  });
});
```

**Step 2: Run tests to verify they pass**

Run: `pnpm test src/__tests__/moves.spec.ts`

Expected: All pass (these code paths already work, just untested).

**Step 3: Commit**

```bash
git add src/__tests__/moves.spec.ts
git commit -m "test: add explicit rook-capture castling rights tests"
```

---

### Task 2: Add descriptive error messages to Game.move()

**Files:**

- Modify: `src/game.ts:132-145` (the `move()` method)

**Step 1: Write failing tests**

Add a new `describe` block in `src/__tests__/game.spec.ts` after the existing
`describe('move()')` block (after line 58). Also update the existing test at
line 48 to match the new, more specific error message.

First, update the existing test (line 47-51) — the message will change from
`'Illegal move: e2 → e5'` to `'Illegal move: e2 pawn cannot move to e5'`:

```typescript
it('throws on illegal move', () => {
  expect(() => new Game().move({ from: 'e2', to: 'e5' })).toThrow(
    'Illegal move: e2 pawn cannot move to e5',
  );
});
```

Then add the new describe block after the existing `move()` tests:

```typescript
describe('move() error messages', () => {
  it('reports no piece on empty square', () => {
    expect(() => new Game().move({ from: 'e4', to: 'e5' })).toThrow(
      'Illegal move: no piece on e4',
    );
  });

  it('reports opponent piece on square', () => {
    expect(() => new Game().move({ from: 'e7', to: 'e6' })).toThrow(
      'Illegal move: e7 is not yours',
    );
  });

  it('reports game is over', () => {
    // Fool's mate — white is checkmated
    const game = Game.fromFen(
      'rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3',
    );
    expect(() => game.move({ from: 'a2', to: 'a3' })).toThrow(
      'Illegal move: game is over',
    );
  });

  it('reports piece has no legal moves', () => {
    // Starting position — a1 rook has no legal moves
    expect(() => new Game().move({ from: 'a1', to: 'a3' })).toThrow(
      'Illegal move: a1 rook has no legal moves',
    );
  });

  it('reports piece cannot reach target', () => {
    // e2 pawn can move to e3 or e4, but not e5
    expect(() => new Game().move({ from: 'e2', to: 'e5' })).toThrow(
      'Illegal move: e2 pawn cannot move to e5',
    );
  });

  it('reports missing promotion', () => {
    // Pawn on 7th rank must promote
    const game = Game.fromFen('k7/4P3/8/8/8/8/8/K7 w - - 0 1');
    expect(() => game.move({ from: 'e7', to: 'e8' })).toThrow(
      'Illegal move: pawn must promote on e8',
    );
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `pnpm test src/__tests__/game.spec.ts`

Expected: 7 failures (the existing test message changed + 6 new tests).

**Step 3: Implement the error logic in Game.move()**

Replace the error branch in `src/game.ts` (lines 132-145). The current code:

```typescript
move(input: MoveInput): this {
  const m: Move = {
    from: input.from,
    promotion: input.promotion,
    to: input.to,
  };
  const legal = this.#cachedState.moves.filter((mv) => mv.from === m.from);
  const isLegal = legal.some(
    (mv) => mv.to === m.to && mv.promotion === m.promotion,
  );

  if (!isLegal) {
    throw new Error(`Illegal move: ${m.from} → ${m.to}`);
  }
```

Replace with:

```typescript
move(input: MoveInput): this {
  const m: Move = {
    from: input.from,
    promotion: input.promotion,
    to: input.to,
  };
  const legalFromSquare = this.#cachedState.moves.filter(
    (mv) => mv.from === m.from,
  );
  const isLegal = legalFromSquare.some(
    (mv) => mv.to === m.to && mv.promotion === m.promotion,
  );

  if (!isLegal) {
    throw new Error(this.#illegalMoveReason(m, legalFromSquare));
  }
```

Then add a private method after `move()`:

```typescript
#illegalMoveReason(m: Move, legalFromSquare: Move[]): string {
  const piece = this.#position.piece(m.from);

  // No piece on the source square
  if (piece === undefined) {
    return `Illegal move: no piece on ${m.from}`;
  }

  // Piece belongs to the opponent
  if (piece.color !== this.#position.turn) {
    return `Illegal move: ${m.from} is not yours`;
  }

  // Game is already over (checkmate or draw)
  if (this.isGameOver()) {
    return `Illegal move: game is over`;
  }

  // Piece exists but has zero legal moves
  if (legalFromSquare.length === 0) {
    return `Illegal move: ${m.from} ${piece.type} has no legal moves`;
  }

  // Legal moves from the square exist, but none reach the target
  const toMatches = legalFromSquare.some((mv) => mv.to === m.to);
  if (!toMatches) {
    return `Illegal move: ${m.from} ${piece.type} cannot move to ${m.to}`;
  }

  // The target square matches but promotion is wrong/missing
  return `Illegal move: pawn must promote on ${m.to}`;
}
```

Note: The piece type names use single-char codes (`p`, `r`, `n`, `b`, `q`, `k`).
This matches the existing `Piece.type` convention. If you want full names, add a
lookup:

```typescript
const PIECE_NAMES: Record<string, string> = {
  b: 'bishop',
  k: 'king',
  n: 'knight',
  p: 'pawn',
  q: 'queen',
  r: 'rook',
};
```

Then use `PIECE_NAMES[piece.type]` in the messages. **Decision: use full names
for readability.**

**Step 4: Run tests to verify they pass**

Run: `pnpm test src/__tests__/game.spec.ts`

Expected: All pass.

**Step 5: Run full test suite and lint**

Run: `pnpm lint && pnpm test`

Expected: All pass with no regressions.

**Step 6: Commit**

```bash
git add src/game.ts src/__tests__/game.spec.ts
git commit -m "feat: add descriptive illegal move error messages"
```

---

### Task 3: Update documentation

**Files:**

- Modify: `BACKLOG.md` — add these items as completed
- Modify: `CHANGELOG.md` — add unreleased section

**Step 1: Update CHANGELOG.md**

Add an `[Unreleased]` section at the top (after the `# Changelog` heading):

```markdown
## [Unreleased]

### Added

- Descriptive error messages for illegal moves in `Game.move()` — messages now
  explain why a move is illegal (no piece, opponent's piece, game over, piece
  has no legal moves, piece cannot reach target, missing promotion).

### Tests

- Explicit tests for castling rights revocation when a rook is captured on its
  starting square (a1, h1, a8, h8).
```

**Step 2: Commit**

```bash
git add CHANGELOG.md BACKLOG.md
git commit -m "docs: update changelog and backlog"
```

---

### Task 4: Final verification

**Step 1: Run full pre-PR check**

```bash
pnpm lint && pnpm test && pnpm build
```

Expected: All pass, zero warnings.
