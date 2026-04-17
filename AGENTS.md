# AGENTS.md

Agent guidance for the `@echecs/game` repository — a TypeScript chess game
engine depending on `@echecs/position`, providing legal move generation,
undo/redo, and game-state detection.

**See also:** [`REFERENCES.md`](REFERENCES.md) |
[`COMPARISON.md`](COMPARISON.md) | [`SPEC.md`](SPEC.md)

**Backlog:** tracked in
[GitHub Issues](https://github.com/echecsjs/game/issues).

---

## Project Overview

`@echecs/game` exposes a single mutable `Game` class. The internal state is a
`Position` object (from `@echecs/position`) which contains the board, castling
rights, en passant target, halfmove clock, fullmove number, and turn. Single
runtime dependency: `@echecs/position`. No SAN notation, no PGN.

---

Key source files:

| File                                | Role                                                                                                                                                                  |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                      | Public re-exports (`Game` class, `Position` class, and all public types from `@echecs/position`)                                                                      |
| `src/types.ts`                      | Local `Move` and `PromotionPieceType` types (removed from `@echecs/position` v3)                                                                                      |
| `src/game.ts`                       | `Game` class — public API, undo/redo stacks, history, wraps `Position` from `@echecs/position`                                                                        |
| `src/moves.ts`                      | Legal move generation, `move` (applies move to Position), uses `position.reach()` for pseudo-legal targets and `position.derive()` + `isCheck` for legality filtering |
| `src/detection.ts`                  | `isCheckmate`, `isStalemate`, `isDraw`, `isThreefoldRepetition` — all take `Position` + `Move[]`                                                                      |
| `src/__tests__/game.spec.ts`        | Unit tests for the `Game` class                                                                                                                                       |
| `src/__tests__/moves.spec.ts`       | Unit tests for move generation, including perft                                                                                                                       |
| `src/__tests__/detection.spec.ts`   | Unit tests for game-state detection                                                                                                                                   |
| `src/__tests__/playthrough.spec.ts` | Full game playthrough test (Fischer-Spassky 1972 Game 6) via `@echecs/san`                                                                                            |
| `src/__tests__/hash.spec.ts`        | Zobrist hash consistency tests (move/undo cycles, transpositions)                                                                                                     |
| `src/__tests__/regression.spec.ts`  | Regression edge-case tests ported from chess.js                                                                                                                       |
| `src/__tests__/helpers.ts`          | Test helper: `fromFen` utility for constructing Position from FEN strings                                                                                             |
| `src/__tests__/comparison.bench.ts` | Comparative benchmarks vs `chess.js`                                                                                                                                  |

---

## Commands

Use **pnpm** exclusively (no npm/yarn).

### Build

```bash
pnpm build              # bundle TypeScript → dist/ via tsdown
```

### Test

```bash
pnpm test               # run all tests once (vitest run)
pnpm test:watch         # watch mode
pnpm test:coverage      # with v8 coverage report

# Run a single test file
pnpm test src/__tests__/moves.spec.ts

# Run tests matching a name substring
pnpm test -- --reporter=verbose -t "perft"
```

### Benchmark

```bash
pnpm bench              # run comparison benchmarks vs chess.js (vitest bench)
```

Benchmark results are recorded manually in `BENCHMARK_RESULTS.md` after each
run. Benchmarks are excluded from coverage and never run in CI.

### Lint & Format

```bash
pnpm lint               # ESLint + tsc type-check (auto-fixes style issues)
pnpm lint:ci            # strict — zero warnings allowed, no auto-fix
pnpm lint:style         # ESLint only (auto-fixes)
pnpm lint:types         # tsc --noEmit type-check only
pnpm format             # Prettier (writes changes)
pnpm format:ci          # Prettier check only (no writes)
```

### Full pre-PR check

```bash
pnpm lint && pnpm test && pnpm build
```

---

## Architecture Notes

- **ESM-only** — the package ships only ESM. Do not add a CJS build.

### Board representation

Board representation is fully internal to `@echecs/position`. `@echecs/game`
does not manipulate 0x88 arrays directly — all board access goes through the
`Position` public API (`at()`, `reach()`, `derive()`, etc.). The 0x88 layout,
attack tables, and index utilities are implementation details of the position
package and are not exported.

### Position (from `@echecs/position`)

The `Position` class (from `@echecs/position`) is the complete immutable
position state used internally by all modules:

- Board: `Map<Square, Piece>` (public API) / 0x88 array (internal)
- `castlingRights`, `enPassantSquare`, `fullmoveNumber`, `halfmoveClock`, `turn`
- State queries: `isCheck`, `isInsufficientMaterial`, `isValid`, `hash`
- Piece access: `at(square)` returns `Piece | undefined`
- Pseudo-legal targets: `reach(square)` returns target squares for the piece on
  that square
- Position transitions: `derive({ changes })` returns a new `Position` with the
  given board changes applied

This replaces the old internal `FenState` interface. `Position` is an immutable
value object — `derive()` returns new instances, never mutates. `Move` and
`PromotionPieceType` are defined locally in `src/types.ts` (removed from
`@echecs/position` v3).

### Move generation (`src/moves.ts`)

`generateMoves(position, square?)` produces legal moves only:

1. Generate pseudo-legal moves per piece type for the active color.
2. For each pseudo-legal move, apply board changes via `boardChanges` +
   `position.derive({ changes })` and check if the active color's king is in
   check. Discard if so.

`isInCheck` uses a separate `isKingAttackedOn` path that does **not** generate
castling moves — this breaks the infinite recursion that would otherwise occur
when castling checks whether the king passes through an attacked square.

`isKingAttackedOn` uses `derive({ changes })` to apply a tentative board change
and then reads `isCheck` on the resulting `Position`. Castling legality checks
(whether transit squares are attacked) use the same approach — no
`isSquareAttackedBy`, `ATTACKS`, `RAYS`, or `PIECE_MASKS` lookups; those are
internal to `@echecs/position`.

Pseudo-legal target squares come from `position.reach(square)`, which the
position package computes internally. Castling moves are generated separately by
the game (they are not covered by `reach()`).

`move(position, move)` returns a new `Position` (does not mutate). It handles:
en passant pawn removal, rook relocation on castling, pawn promotion, castling
rights revocation on king/rook moves, en passant target update on double pawn
push, halfmove clock reset on captures and pawn moves.

### Game class (`src/game.ts`)

Private fields:

| Field              | Type                                               | Purpose                                                |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------ |
| `#position`        | `Position`                                         | Current position (from `@echecs/position`)             |
| `#cache`           | `{ inCheck: boolean; moves: Move[] } \| undefined` | Cached legal moves and check flag; cleared on mutation |
| `#past`            | `HistoryEntry[]`                                   | Stack of played moves with previous Position           |
| `#future`          | `HistoryEntry[]`                                   | Stack of undone moves; cleared on `move()`             |
| `#positionHistory` | `string[]`                                         | Zobrist hash snapshots for threefold repetition        |

`HistoryEntry` stores `{ move, previousPosition }`. `undo()` restores
`#position = entry.previousPosition` directly — no reversal logic needed.
`redo()` reapplies via `move(entry.previousPosition, entry.move)`.

**Caching:** `#cache` is populated lazily via the private `#cachedState` getter
on the first call to `moves()`, `isCheck()`, `isCheckmate()`, `isStalemate()`,
`isDraw()`, or `isGameOver()` from a given position. `move()` reads the cache
for legality validation, then invalidates after applying. `undo()` and `redo()`
check whether the history stack is empty before invalidating, so no-op calls do
not evict the cache. Repeated queries from the same position are O(1) after the
first call.

### Detection (`src/detection.ts`)

All detection functions in `src/detection.ts` take `Position` + `Move[]` and
remain pure — no caching inside them. Caching is handled by the `Game` class,
which stores legal moves and the check flag after each position change and
invalidates on every `move()`, `undo()`, and `redo()`. Repeated calls to
`isCheck()`, `isCheckmate()`, `isStalemate()`, `isDraw()`, and `moves()` from
the same position are O(1) after the first call.

### Interop with other ECHECS packages

`@echecs/game` has no runtime dependencies on `@echecs/pgn` or `@echecs/uci`.
The caller bridges them:

```typescript
// Replay a parsed PGN into a Game
const moves = parse(pgnString); // @echecs/pgn
const game = new Game();
for (const move of moves) {
  game.move({ from: move.from, to: move.to, promotion: move.promotion });
}

// Feed engine moves from UCI into a Game
uci.on('bestmove', ({ move }) => {
  game.move({ from: move.slice(0, 2), to: move.slice(2, 4) });
});
```

---

## Validation

Input validation is mostly provided by TypeScript's strict type system at
compile time. There is no runtime validation library — the type signatures
enforce correct usage. Do not add runtime type-checking guards (e.g. `typeof`
checks, assertion functions) unless there is an explicit trust boundary.

---

## Release Protocol

Step-by-step process for releasing a new version. CI auto-publishes to npm when
`version` in `package.json` changes on `main`.

1. **Verify the package is clean:**

   ```bash
   pnpm lint && pnpm test && pnpm build
   ```

   Do not proceed if any step fails.

2. **Decide the semver level:**
   - `patch` — bug fixes, internal refactors with no API change
   - `minor` — new features, new exports, non-breaking additions
   - `major` — breaking changes to the public API

3. **Update `CHANGELOG.md`** following
   [Keep a Changelog](https://keepachangelog.com) format:

   ```markdown
   ## [x.y.z] - YYYY-MM-DD

   ### Added

   - …

   ### Changed

   - …

   ### Fixed

   - …

   ### Removed

   - …
   ```

   Include only sections that apply. Use past tense.

4. **Update `README.md`** if the release introduces new public API, changes
   usage examples, or deprecates/removes existing features.

5. **Bump the version:**

   ```bash
   npm version <major|minor|patch> --no-git-tag-version
   ```

6. **Open a release PR:**

   ```bash
   git checkout -b release/x.y.z
   git add package.json CHANGELOG.md README.md
   git commit -m "release: @echecs/game@x.y.z"
   git push -u origin release/x.y.z
   gh pr create --title "release: @echecs/game@x.y.z" --body "<description>"
   ```

   Wait for CI (format, lint, test) to pass on the PR before merging.

7. **Merge the PR:** Once CI is green, merge (squash) into `main`. The release
   workflow detects the version bump, publishes to npm, and creates a GitHub
   Release with a git tag.

Do not manually publish with `npm publish`. Do not create git tags manually —
the release workflow handles tagging.
