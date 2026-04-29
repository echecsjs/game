# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [4.0.0] - 2026-04-29

### Changed

- **BREAKING:** `game.move()` returns `Movement[]` instead of `MoveResult`. Each
  movement is `{ from, to, piece }` where `from` or `to` can be `undefined`
  (piece appearing or disappearing from the board).
- **BREAKING:** `game.undo()` returns `Movement[] | undefined` instead of
  `MoveResult | undefined`. Movements are reversed (from/to swapped) and include
  uncaptures (pieces reappearing) and depromotions (queen disappearing, pawn
  reappearing).
- **BREAKING:** `game.redo()` returns `Movement[] | undefined` instead of
  `MoveResult | undefined`.
- `Move` and `PromotionPieceType` types are now imported from `@echecs/position`
  instead of defined locally.

### Added

- `Movement` type exported from `@echecs/game`.

### Removed

- **BREAKING:** `MoveResult` type removed. Use `Movement[]` instead.

## [3.0.0] - 2026-04-28

### Changed

- **BREAKING:** `game.move()` returns a `MoveResult` object instead of `this`.
  Chaining (`game.move().move()`) no longer works — split into separate
  statements. The result describes what happened on the board: which piece
  moved, what was captured (with correct square for en passant), castling rook
  relocation, and promotion.
- **BREAKING:** `game.undo()` returns `MoveResult | undefined` instead of
  `void`. The result is reversed (from/to swapped, castling reversed) and ready
  for backward animation. Returns `undefined` if there is nothing to undo.
- **BREAKING:** `game.redo()` returns `MoveResult | undefined` instead of
  `void`. Returns the original forward `MoveResult`, or `undefined` if there is
  nothing to redo.

### Added

- `MoveResult` type exported from `@echecs/game`.

## [2.0.2] - 2026-04-09

### Changed

- removed misleading keywords (`fen`, `board-game`)
- added `threefold-repetition` and `draw-detection` keywords

## [2.0.1] - 2026-04-09

### Fixed

- Corrected README to match 2.0.0 API: removed nonexistent `Game.fromFen()` and
  `game.fen()`, documented `new Game(position)` constructor, fixed `undo()` /
  `redo()` return types (`void`, not `this`), fixed `Move.promotion` signature,
  removed `MoveInput` from exports listing.
- Updated `AGENTS.md` to reflect single runtime dependency (`@echecs/position`),
  removed nonexistent `src/fen.ts`, added missing test files, removed stale
  references to `isAttacked` / `applyMoveToState`, updated naming convention
  examples.
- Changed `package.json` keyword from `no-dependencies` to
  `minimal-dependencies`.

## [2.0.0] - 2026-04-09

### Changed

- **BREAKING:** upgraded to `@echecs/position` v3. `Color` values are now
  `'white'`/`'black'` (was `'w'`/`'b'`). `PieceType` values are now full words
  (`'pawn'`, `'knight'`, `'bishop'`, `'rook'`, `'queen'`, `'king'`) instead of
  single letters.
- **BREAKING:** `CastlingRights` shape is now
  `{ white: { king, queen }, black: { king, queen } }` (was
  `{ wK, wQ, bK, bQ }`).
- **BREAKING:** `PromotionPieceType` uses full words (`'queen'`, `'rook'`,
  `'bishop'`, `'knight'`) instead of single letters.
- **BREAKING:** constructor now accepts an optional `Position` argument instead
  of always starting from the initial position. `new Game()` still defaults to
  the starting position; `new Game(position)` starts from any `Position`.
- **BREAKING:** `MoveInput` type merged into `Move` with optional `promotion`.
  `Game.move()` now takes `Move` directly.
- Rewrote move generation to use `position.reach()` for pseudo-legal targets and
  `position.derive()` + `isCheck` for legality filtering. Removed all 0x88
  internal board manipulation.
- `@echecs/fen` moved from runtime dependency to devDependency. FEN
  parsing/serialization is no longer part of the public API.

### Added

- Local `Move` and `PromotionPieceType` types (removed from `@echecs/position`
  v3).
- Re-exported `STARTING_POSITION`, `EnPassantSquare`, and `SideCastlingRights`
  from `@echecs/position`.
- Full game playthrough test (81-move Fischer-Spassky 1972 Game 6) via
  `@echecs/san`.
- Zobrist hash consistency tests (move/undo cycles, transpositions).
- Regression edge-case tests ported from chess.js.

### Removed

- **BREAKING:** `Game.fromFen()` static method — construct a `Position` and pass
  it to `new Game(position)` instead.
- **BREAKING:** `game.fen()` method — use `@echecs/fen` directly with
  `game.position()`.
- **BREAKING:** `isAttacked()` method — removed from `Game`. Position v3 no
  longer exposes attack queries.

## [1.2.2] - 2026-04-04

### Added

- TSDoc comments on all public methods and the `Game` class itself, with
  examples, `@throws`, and `@remarks` where applicable.
- Exported `MoveInput` interface as a public type.

## [1.2.1] - 2026-03-30

### Added

- Descriptive error messages for illegal moves in `Game.move()`. Messages now
  explain why a move is illegal: no piece on square, opponent's piece, game
  over, piece has no legal moves, piece cannot reach target, missing promotion,
  or promotion not allowed.
- Explicit tests for castling rights revocation when a rook is captured on its
  starting square (a1, h1, a8, h8).

## [1.2.0] - 2026-03-20

### Added

- `game.position()` getter returning the current `Position` from
  `@echecs/position`.

### Changed

- Internal state replaced with `Position` from `@echecs/position`. The `Game`
  class is now a thin stateful wrapper (undo/redo, legal move caching) over an
  immutable `Position` core.
- FEN parsing and serialization delegated to `@echecs/fen`.
- Types (`Color`, `Piece`, `Move`, `Square`, `CastlingRights`, `PieceType`,
  `PromotionPieceType`) are now re-exported from `@echecs/position`.
- Attack tables (`ATTACKS`, `RAYS`, `PIECE_MASKS`) imported from
  `@echecs/position/internal` instead of built locally.
- Threefold repetition detection uses Zobrist hashes instead of FEN strings.
- `@echecs/position` and `@echecs/fen` are now runtime dependencies.

### Removed

- `src/types.ts`, `src/board.ts`, `src/fen.ts` — replaced by external packages.
- `FenState` internal interface — replaced by `Position` class.
- `isInsufficientMaterial` from `detection.ts` — delegated to
  `position.isInsufficientMaterial`.

## [1.1.0] - 2026-03-15

### Added

- `Game.isAttacked(square, color)` — returns `true` if any piece of `color`
  attacks `square`. Matches chess.js semantics: pinned pieces still attack, own
  pieces count as attacked squares, no X-ray, same square returns `false`.

## [1.0.0] - 2026-03-15

### Changed

- First stable release. No API changes from `0.1.1`.

## [0.1.1] - 2026-03-15

### Changed

- Switched internal board representation from a flat `[64]` array to the 0x88
  `[128]` layout. Valid squares satisfy `index & 0x88 === 0`; the padding slots
  enable a single-instruction off-board check and the ATTACKS/RAYS lookup
  tables. No change to the public API.
- `isSquareAttackedBy` now uses precomputed `ATTACKS[240]` and `RAYS[240]`
  tables (initialised at module load) instead of generating attack move lists
  and scanning them. Attack detection is O(1) per piece for non-sliding pieces
  and O(ray length) for sliding pieces with an early bitmask skip.
- `Game` now lazily caches the legal move list and check flag per position. The
  cache is populated on the first call to `moves()`, `isCheck()`,
  `isCheckmate()`, `isStalemate()`, `isDraw()`, or `isGameOver()` from a given
  position, and invalidated on every `move()`, `undo()`, or `redo()`. Repeated
  queries from the same position are O(1) after the first call.
- `isInsufficientMaterial` now correctly handles KB vs KB positions where all
  bishops are on the same square colour (previously returned `false`).
- `move()` validates legality against the cached move list before clearing the
  cache, avoiding a redundant `generateMoves` call in the common `moves()` →
  `move()` pattern.
- `undo()` and `redo()` check whether the history stack is empty before
  invalidating the cache, so no-op calls at the start/end of history do not
  evict the cache unnecessarily.
- `isDraw()` in `Game` calls `this.isStalemate()` (cached) rather than
  delegating to the pure detection function, avoiding a redundant
  `generateMoves` call.

### Added

- `OFF_BOARD = 0x88` exported from `src/board.ts` for use in `moves.ts`.
- `BENCHMARK_RESULTS.md` — comparative benchmarks against `chess.js@1.4.0`
  across all shared operations, plus a raw perft benchmark.
- `pnpm bench` script — runs the comparison benchmark suite via Vitest bench.
- `vitest.config.ts` — excludes benchmark files from coverage.
- Extended test coverage:
  - Perft positions 2–7 from the chess programming wiki (depths 3–4), sourced
    from the chess.js test suite.
  - Perft depth 4 from the starting position (197,281 nodes).
  - Additional `isCheckmate`, `isStalemate`, `isCheck`, and
    `isInsufficientMaterial` positions from the chess.js test suite.
  - Regression: invalid castling rights in FEN must not crash `isGameOver()`.

## [0.1.0] - 2026-03-15

### Added

- Initial release with core chess game engine.
- `Game` class — mutable, with `move()`, `undo()`, `redo()`, `history()`,
  `moves()`, `get()`, `board()`, `fen()`, `turn()`, `isCheck()`,
  `isCheckmate()`, `isStalemate()`, `isDraw()`, `isGameOver()`.
- `Game.fromFen(fen)` static factory for loading arbitrary positions.
- Legal move generation for all piece types including castling, en passant, and
  promotion.
- Game-state detection: check, checkmate, stalemate, 50-move rule, insufficient
  material, threefold repetition.
- FEN parsing and serialisation (`parseFen`, `serialiseFen`, `STARTING_FEN`).
- Zero runtime dependencies.
