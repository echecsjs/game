# AGENTS.md

Agent guidance for the `@echecs/game` repository — a zero-dependency TypeScript
chess game engine providing legal move generation, undo/redo, and game-state
detection.

---

## Project Overview

`@echecs/game` exposes a single mutable `Game` class. The internal state is a
flat `(Piece | undefined)[64]` board array plus castling rights, en passant
target, halfmove clock, and fullmove number — mirroring the FEN format exactly.
Zero runtime dependencies; no SAN notation, no PGN.

---

## Similar Libraries

Use these to cross-check output when testing:

- [`chess.js`](https://www.npmjs.com/package/chess.js) — the most popular
  TypeScript chess library; move generation, validation, check/checkmate
  detection.
- [`chessops`](https://www.npmjs.com/package/chessops) — TypeScript chess rules
  and operations; supports variants.
- [`js-chess-engine`](https://www.npmjs.com/package/js-chess-engine) — chess
  engine with configurable AI, no dependencies.
- [`chess.ts`](https://www.npmjs.com/package/chess.ts) — TypeScript rewrite of
  chess.js.

---

Key source files:

| File                                | Role                                                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `src/index.ts`                      | Public re-exports (`Game` class + all public types)                                                     |
| `src/game.ts`                       | `Game` class — public API, undo/redo stacks, history                                                    |
| `src/moves.ts`                      | Legal move generation, `applyMoveToState`, `isInCheck`                                                  |
| `src/detection.ts`                  | `isCheckmate`, `isStalemate`, `isDraw`, `isInsufficientMaterial`, `isThreefoldRepetition`               |
| `src/fen.ts`                        | `FenState` interface, `parseFen`, `serialiseFen`, `STARTING_FEN`                                        |
| `src/board.ts`                      | `squareToIndex`, `indexToSquare`, `rankOf`, `fileOf`, `INITIAL_BOARD`, `cloneBoard`                     |
| `src/types.ts`                      | Exported types: `Color`, `PieceType`, `PromotionPieceType`, `Square`, `Piece`, `Move`, `CastlingRights` |
| `src/__tests__/game.spec.ts`        | Unit tests for the `Game` class                                                                         |
| `src/__tests__/moves.spec.ts`       | Unit tests for move generation, including perft                                                         |
| `src/__tests__/detection.spec.ts`   | Unit tests for game-state detection                                                                     |
| `src/__tests__/fen.spec.ts`         | Unit tests for FEN parsing and serialisation                                                            |
| `src/__tests__/board.spec.ts`       | Unit tests for board utilities                                                                          |
| `src/__tests__/comparison.bench.ts` | Comparative benchmarks vs `chess.js`                                                                    |

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

## TypeScript

- **Strict mode** fully enabled: `strict`, `noUncheckedIndexedAccess`,
  `noImplicitOverride`.
- Target: `ESNext`; module system: `NodeNext` with NodeNext resolution.
- All type-only imports must use `import type { ... }` (enforced by
  `@typescript-eslint/consistent-type-imports`).
- All exported functions and methods must have explicit return types
  (`@typescript-eslint/explicit-module-boundary-types`).
- Avoid non-null assertions (`!`); use explicit narrowing or `?? fallback`
  instead (`@typescript-eslint/no-non-null-assertion` is a warning).
- Use `interface` for object shapes and `type` for unions/aliases
  (`@typescript-eslint/consistent-type-definitions: ['error', 'interface']`).
- Always include `.js` extension on relative imports — NodeNext resolution
  requires it even for `.ts` source files.
- **`null` is banned** — `unicorn/no-null` is an error. Use `undefined`
  everywhere, including public API return types (e.g. `get()` returns
  `Piece | undefined`, not `Piece | null`).

---

## Code Style

### Formatting (Prettier)

- **Single quotes** for strings.
- **Trailing commas** everywhere (`all`).
- `quoteProps: 'consistent'` — quote all object keys or none within an object.
- `proseWrap: 'always'` — wrap markdown prose at print width.
- Prettier runs automatically via lint-staged on every commit.

### ESLint rules of note

- `eqeqeq` — always use `===`/`!==`.
- `curly: 'all'` — always use braces for control flow bodies, even single lines.
- `sort-keys` — object literal keys and interface fields must be sorted
  alphabetically in source files. Disabled in test files.
- `sort-imports` — named import specifiers must be sorted within each import
  statement. Declaration-level ordering is handled by `import-x/order`.
- `no-console` — disallowed in source (warning); permitted in tests.
- **`eslint-plugin-unicorn`** (recommended) is enabled — modern JS/TS idioms
  enforced (e.g. prefer `Array.from`, avoid `forEach`, prefer `for...of`).
- **`@vitest/eslint-plugin`** (recommended) is enabled in test files.

### Import ordering (`import-x/order`)

Groups, separated by a blank line, in this order:

1. Built-in + external packages
2. Internal (`@/…` path aliases)
3. Parent and sibling relative imports
4. Type-only imports

---

## Naming Conventions

| Construct              | Convention             | Examples                                            |
| ---------------------- | ---------------------- | --------------------------------------------------- |
| Classes                | `PascalCase`           | `Game`                                              |
| Functions              | `camelCase`            | `generateMoves`, `parseFen`, `squareToIndex`        |
| Types / Interfaces     | `PascalCase`           | `Color`, `Move`, `Piece`, `FenState`                |
| Module-level constants | `SCREAMING_SNAKE_CASE` | `STARTING_FEN`, `INITIAL_BOARD`, `PROMOTION_PIECES` |
| Variables / Parameters | `camelCase`            | `state`, `move`, `square`, `depth`                  |
| Source files           | `camelCase.ts`         | `index.ts`, `moves.ts`, `board.ts`                  |

---

## Testing Conventions

- Framework: **Vitest** (`vitest run`).
- Test files live in `src/__tests__/` with the `.spec.ts` suffix.
- Benchmark files use the `.bench.ts` suffix and are excluded from coverage.
- Use `describe` to group cases; use `it` (not `test`) inside them.
- Prefer `expect(x).toBe(y)` for exact equality.
- `sort-keys` and `no-console` are relaxed inside `__tests__/`.
- **Perft is the correctness oracle for move generation.** The perft tests in
  `moves.spec.ts` count reachable positions recursively and compare against
  known values. If move generation is wrong, perft diverges. Known values from
  the starting position:

  | Depth | Nodes |
  | ----- | ----- |
  | 1     | 20    |
  | 2     | 400   |
  | 3     | 8,902 |

  Do not change the perft expected values unless you have verified them against
  an independent source (e.g. the official perft results page at
  https://www.chessprogramming.org/Perft_Results).

---

## Architecture Notes

- **ESM-only** — the package ships only ESM. Do not add a CJS build.

### Board representation

The board is a flat `(Piece | undefined)[128]` array using the **0x88
representation**. Index layout:

```
index = (8 - rank) * 16 + file   where file: a=0 … h=7, rank: 1-based
a8=0, b8=1, …, h8=7, a7=16, …, a1=112, h1=119
```

Valid squares satisfy `index & 0x88 === 0`. The other 64 slots are always
`undefined` and act as padding — they enable two key optimisations:

1. **Off-board check:** `index & 0x88 !== 0` — one bitwise AND replaces four
   comparisons per ray step.
2. **ATTACKS lookup table:** `ATTACKS[(to - from) + 119]` gives a bitmask of
   piece types that can attack along any vector in O(1), without ray tracing.

`src/board.ts` provides `squareToIndex`, `indexToSquare`, and the `OFF_BOARD`
constant. All internal code uses indices directly; the public API accepts
`Square` strings.

### FenState

`FenState` (defined in `src/fen.ts`) is the complete game state passed between
all internal modules:

```typescript
interface FenState {
  board: (Piece | undefined)[];
  castlingRights: CastlingRights;
  enPassantSquare: Square | undefined;
  fullmoveNumber: number;
  halfmoveClock: number;
  turn: Color;
}
```

It is an internal type — not exported from `src/index.ts`.

### Move generation (`src/moves.ts`)

`generateMoves(state, square?)` produces legal moves only:

1. Generate pseudo-legal moves per piece type for the active color.
2. For each pseudo-legal move, apply it via `applyMoveToState` and check if the
   active color's king is in check. Discard if so.

`isInCheck` uses a separate `isSquareAttackedBy` path that does **not** generate
castling moves — this breaks the infinite recursion that would otherwise occur
when castling checks whether the king passes through an attacked square.

`isSquareAttackedBy` uses the `ATTACKS[240]` and `RAYS[240]` lookup tables
(precomputed at module load). For each enemy piece, one table lookup determines
if that piece type can attack along the vector from the attacker to the target.
For sliding pieces, a ray walk then checks for blockers. This is significantly
faster than generating all attack moves and scanning them.

`applyMoveToState` returns a new `FenState` (does not mutate). It handles: en
passant pawn removal, rook relocation on castling, pawn promotion, castling
rights revocation on king/rook moves, en passant target update on double pawn
push, halfmove clock reset on captures and pawn moves.

### Game class (`src/game.ts`)

Private fields:

| Field              | Type                                               | Purpose                                                |
| ------------------ | -------------------------------------------------- | ------------------------------------------------------ |
| `#state`           | `FenState`                                         | Current board state                                    |
| `#cache`           | `{ inCheck: boolean; moves: Move[] } \| undefined` | Cached legal moves and check flag; cleared on mutation |
| `#past`            | `HistoryEntry[]`                                   | Stack of played moves with previous state              |
| `#future`          | `HistoryEntry[]`                                   | Stack of undone moves; cleared on `move()`             |
| `#positionHistory` | `string[]`                                         | FEN snapshots for threefold repetition                 |

`HistoryEntry` stores `{ move, previousState }`. `undo()` restores
`#state = entry.previousState` directly — no reversal logic needed. `redo()`
reapplies via `applyMoveToState(entry.previousState, entry.move)`.

**Caching:** `#cache` is populated lazily via the private `#cachedState` getter
on the first call to `moves()`, `isCheck()`, `isCheckmate()`, `isStalemate()`,
`isDraw()`, or `isGameOver()` from a given position. It is invalidated
(`#cache = undefined`) at the start of `move()`, `undo()`, and `redo()` — but
only after confirming the operation is not a no-op. Repeated queries from the
same position are O(1) after the first call.

### Detection (`src/detection.ts`)

All detection functions in `src/detection.ts` take `FenState` and remain pure —
no caching inside them. Caching is handled by the `Game` class, which stores
legal moves and the check flag after each position change and invalidates on
every `move()`, `undo()`, and `redo()`. Repeated calls to `isCheck()`,
`isCheckmate()`, `isStalemate()`, `isDraw()`, and `moves()` from the same
position are O(1) after the first call.

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

Input validation is mostly provided by TypeScript's strict type system at compile
time. There is no runtime validation library — the type signatures enforce
correct usage. Do not add runtime type-checking guards (e.g. `typeof` checks,
assertion functions) unless there is an explicit trust boundary.

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

6. **Commit and push:**
   ```bash
   git add package.json CHANGELOG.md README.md
   git commit -m "release: @echecs/game@x.y.z"
   git push
   ```

7. **CI takes over:** GitHub Actions detects the version bump, runs
   format → lint → test, and publishes to npm.

Do not manually publish with `npm publish`.
