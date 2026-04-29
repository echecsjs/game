# GAME

[![npm](https://img.shields.io/npm/v/@echecs/game)](https://www.npmjs.com/package/@echecs/game)
[![Coverage](https://codecov.io/gh/echecsjs/game/branch/main/graph/badge.svg)](https://codecov.io/gh/echecsjs/game)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**GAME** is a TypeScript chess game engine — part of the
[ECHECS](https://github.com/echecsjs) project.

It provides a single mutable `Game` class that manages board state, generates
legal moves, and detects game-ending conditions. Single runtime dependency:
[`@echecs/position`](https://www.npmjs.com/package/@echecs/position).

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

console.log(game.turn()); // 'white'
console.log(game.moves()); // all legal moves for white
```

## API

### Construction

#### `new Game()`

Creates a new game from the standard starting position.

```typescript
const game = new Game();
```

#### `new Game(position)`

Creates a game from an existing `Position` object (from `@echecs/position`).

```typescript
import { Position } from '@echecs/game';

const game = new Game(position);
```

### Board queries

#### `game.turn()`

Returns the color whose turn it is to move: `'white'` or `'black'`.

#### `game.get(square)`

Returns the piece on the given square, or `undefined` if the square is empty.

```typescript
game.get('e1'); // { color: 'white', type: 'king' }
game.get('e4'); // undefined
```

#### `game.board()`

Returns the board as an 8×8 array of `Piece | undefined`, indexed `[rank][file]`
with `board()[0]` = rank 1 (a1–h1) and `board()[7]` = rank 8.

```typescript
game.board()[0]?.[4]; // { color: 'white', type: 'king' }  (e1)
```

#### `game.position()`

Returns the underlying `Position` object. Useful for direct access to castling
rights, en passant square, halfmove clock, fullmove number, and attack queries.

```typescript
const pos = game.position();
pos.turn; // 'white' | 'black'
pos.isCheck; // boolean
pos.castlingRights; // { white: { king: boolean, queen: boolean }, black: { king: boolean, queen: boolean } }
```

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
  promotion?: PromotionPieceType;
}
```

Where `PromotionPieceType` is `'queen' | 'rook' | 'bishop' | 'knight'`. Both
`Move` and `PromotionPieceType` are exported from `@echecs/game`.

### Move execution

#### `game.move(move)`

Applies a move and returns a `Movement[]` describing all board changes. Throws
`Error` if the move is illegal.

```typescript
const result = game.move({ from: 'e2', to: 'e4' });
// [{ from: 'e2', to: 'e4', piece: { color: 'white', type: 'pawn' } }]

// capture
const result = game.move({ from: 'e4', to: 'd5' });
// [{ from: 'e4', to: 'd5', piece: { color: 'white', type: 'pawn' } },
//  { from: 'd5', to: undefined, piece: { color: 'black', type: 'pawn' } }]

// castling
const result = game.move({ from: 'e1', to: 'g1' });
// [{ from: 'e1', to: 'g1', piece: { color: 'white', type: 'king' } },
//  { from: 'h1', to: 'f1', piece: { color: 'white', type: 'rook' } }]

// promotion
const result = game.move({ from: 'e7', to: 'e8', promotion: 'queen' });
// [{ from: 'e7', to: undefined, piece: { color: 'white', type: 'pawn' } },
//  { from: undefined, to: 'e8', piece: { color: 'white', type: 'queen' } }]
```

The `Movement` type:

```typescript
interface Movement {
  from: Square | undefined;
  to: Square | undefined;
  piece: Piece;
}
```

- `from: undefined` — piece appears on the board (promoted piece, uncaptured
  piece on undo)
- `to: undefined` — piece disappears from the board (captured piece, pawn on
  promotion)
- Ordering: active color first, then opponent color

#### `game.undo()`

Steps back one move. Returns a reversed `Movement[]` (from/to swapped on each
movement) or `undefined` at the start of the game. Captures become uncaptures
(pieces reappearing), promotions become depromotions.

#### `game.redo()`

Steps forward one move (after an undo). Returns the forward `Movement[]`, or
`undefined` at the end of history. Cleared whenever a new `move()` is made.

```typescript
game.move({ from: 'e2', to: 'e4' });
const undone = game.undo();
// [{ from: 'e4', to: 'e2', piece: { color: 'white', type: 'pawn' } }]
const redone = game.redo();
// [{ from: 'e2', to: 'e4', piece: { color: 'white', type: 'pawn' } }]
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

## Exports

`@echecs/game` re-exports the following from `@echecs/position` for convenience:

```typescript
import {
  Game,
  Position,
  STARTING_POSITION, // ReadonlyMap<Square, Piece> — the standard starting board
} from '@echecs/game';

import type {
  CastlingRights, // { white: SideCastlingRights, black: SideCastlingRights }
  Color, // 'white' | 'black'
  EnPassantSquare, // typed en passant target square
  Move, // { from: Square, to: Square, promotion?: PromotionPieceType }
  Movement, // { from: Square | undefined, to: Square | undefined, piece: Piece }
  Piece, // { color: Color, type: PieceType }
  PieceType, // 'pawn' | 'knight' | 'bishop' | 'rook' | 'queen' | 'king'
  PromotionPieceType, // 'queen' | 'rook' | 'bishop' | 'knight'
  SideCastlingRights, // { king: boolean, queen: boolean }
  Square, // 'a1' | 'a2' | … | 'h8'
} from '@echecs/game';
```

## Interop

`@echecs/game` has no dependency on `@echecs/pgn` or `@echecs/uci`. The caller
bridges them.

### UCI

```typescript
// Feed engine moves from UCI into a Game
uci.on('bestmove', ({ move }) => {
  game.move({
    from: move.slice(0, 2) as Square,
    to: move.slice(2, 4) as Square,
  });
});
```

### PGN

`@echecs/pgn`'s `Move.from` is a disambiguation hint
(`Square | File | Rank | undefined`), not the origin square. PGN moves encode
only the destination square (`to`) and enough information to disambiguate which
piece moves there — they do not carry a full origin square in every move. To
replay a PGN, resolve each move against `game.moves()` by matching `to` and the
optional disambiguation hint:

```typescript
import parse from '@echecs/pgn';
import { Game } from '@echecs/game';
import type { PromotionPieceType } from '@echecs/game';

const [pgn] = parse(pgnString);
const game = new Game();

for (const [, white, black] of pgn.moves) {
  for (const pgnMove of [white, black]) {
    if (!pgnMove) {
      continue;
    }

    const legal = game.moves().find((m) => {
      if (m.to !== pgnMove.to) {
        return false;
      }

      if (pgnMove.from === undefined) {
        return true;
      }

      // Disambiguation: pgnMove.from is a File, Rank, or full Square
      return m.from.startsWith(pgnMove.from) || m.from.endsWith(pgnMove.from);
    });

    if (legal) {
      // Map PGN promotion letter to full word, e.g. 'q' → 'queen'
      const promotionMap: Record<string, PromotionPieceType> = {
        b: 'bishop',
        n: 'knight',
        q: 'queen',
        r: 'rook',
      };
      game.move({
        ...legal,
        promotion: pgnMove.promotion
          ? promotionMap[pgnMove.promotion.toLowerCase()]
          : undefined,
      });
    }
  }
}
```

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) for
guidelines on how to submit issues and pull requests.
