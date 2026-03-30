# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
