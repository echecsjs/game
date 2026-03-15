# GAME

[![npm](https://img.shields.io/npm/v/@echecs/game)](https://www.npmjs.com/package/@echecs/game)
[![Test](https://github.com/mormubis/game/actions/workflows/test.yml/badge.svg)](https://github.com/mormubis/game/actions/workflows/test.yml)
[![Coverage](https://codecov.io/gh/mormubis/game/branch/main/graph/badge.svg)](https://codecov.io/gh/mormubis/game)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**GAME** is a TypeScript chess game engine — part of the
[ECHECS](https://github.com/mormubis) project.

It provides a single mutable `Game` class that manages board state, generates
legal moves, and detects game-ending conditions. Zero runtime dependencies.

## Installation

```bash
npm install @echecs/game
```

## Quick Start

```typescript
import { Game } from '@echecs/game';

const game = new Game();

game.move({ from: 'e2', to: 'e4' });
game.move({ from: 'e7', to: 'e5' });

console.log(game.turn()); // 'w'
console.log(game.moves()); // all legal moves for white
console.log(game.fen()); // current position as FEN string
```

## API

### Construction

#### `new Game()`

Creates a new game from the standard starting position.

```typescript
const game = new Game();
```

#### `Game.fromFen(fen)`

Creates a game from an arbitrary FEN string. Throws `Error` if the FEN is
invalid.

```typescript
const game = Game.fromFen(
  'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
);
```

### Board queries

#### `game.turn()`

Returns the color whose turn it is to move: `'w'` or `'b'`.

#### `game.get(square)`

Returns the piece on the given square, or `undefined` if the square is empty.

```typescript
game.get('e1'); // { color: 'w', type: 'k' }
game.get('e4'); // undefined
```

#### `game.board()`

Returns the board as an 8×8 array of `Piece | undefined`, indexed `[rank][file]`
with `board()[0]` = rank 1 (a1–h1) and `board()[7]` = rank 8.

```typescript
game.board()[0]?.[4]; // { color: 'w', type: 'k' }  (e1)
```

#### `game.fen()`

Returns the current position as a FEN string.

### Move generation

#### `game.moves(square?)`

Returns all legal moves for the active color. If `square` is given, returns only
the legal moves for the piece on that square.

```typescript
game.moves(); // all 20 legal opening moves
game.moves('e2'); // [{ from: 'e2', to: 'e3' }, { from: 'e2', to: 'e4' }]
```

Each `Move` object has the shape:

```typescript
interface Move {
  from: Square;
  to: Square;
  promotion?: 'n' | 'b' | 'r' | 'q';
}
```

### Move execution

#### `game.move(move)`

Applies a move. Returns `this` for chaining. Throws `Error` if the move is
illegal.

```typescript
game.move({ from: 'e2', to: 'e4' });
game.move({ from: 'e7', to: 'e8', promotion: 'q' }); // promotion
```

#### `game.undo()`

Steps back one move. Returns `this`. No-op at the start of the game.

#### `game.redo()`

Steps forward one move (after an undo). Returns `this`. No-op at the end of
history. Cleared whenever a new `move()` is made.

```typescript
game.move({ from: 'e2', to: 'e4' });
game.undo(); // back to start
game.redo(); // e4 again
```

### History

#### `game.history()`

Returns the list of moves played so far. Undone moves are not included.

```typescript
game.move({ from: 'e2', to: 'e4' });
game.history(); // [{ from: 'e2', to: 'e4' }]
```

### State detection

#### `game.isCheck()`

Returns `true` if the active color's king is in check.

#### `game.isAttacked(square, color)`

Returns `true` if any piece of `color` attacks `square`. The square does not
need to be empty — it may contain a piece of either color. A piece does not
attack its own square.

```typescript
const game = new Game();
game.isAttacked('f3', 'w'); // true — white pawn on g2 attacks f3
game.isAttacked('f6', 'b'); // true — black pawn on g7 attacks f6
```

Pinned pieces still count as attacking. There is no X-ray — a piece blocked by
another piece does not attack through it.

#### `game.isCheckmate()`

Returns `true` if the active color is in checkmate.

#### `game.isStalemate()`

Returns `true` if the active color has no legal moves and is not in check.

#### `game.isDraw()`

Returns `true` if the position is a draw by any of:

- 50-move rule (100 half-moves without a pawn move or capture)
- Insufficient material (K vs K, K+B vs K, K+N vs K, all bishops on the same
  square colour)
- Stalemate
- Threefold repetition

#### `game.isGameOver()`

Returns `true` if the game is over by checkmate or draw.

## Interop

`@echecs/game` has no dependency on `@echecs/pgn` or `@echecs/uci`. The caller
bridges them:

```typescript
import { parse } from '@echecs/pgn';
import { Game } from '@echecs/game';

// Replay a parsed PGN into a Game
const [pgn] = parse(pgnString);
const game = new Game();
for (const [, white, black] of pgn.moves) {
  if (white) {
    game.move({ from: white.from, to: white.to, promotion: white.promotion });
  }
  if (black) {
    game.move({ from: black.from, to: black.to, promotion: black.promotion });
  }
}
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines on how to submit issues and pull requests.
