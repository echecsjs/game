# Replace `MoveResult` with `Movement[]`

Closes #28.

## Problem

`MoveResult` describes a chess move using named fields (`captured`, `castling`,
`promotion`). This works for forward moves but breaks on undo —
`reverseMoveResult` invents a synthetic reverse move that loses information
(drops captures, drops promotions, swaps from/to to describe a move that never
happened).

The root cause is that `MoveResult` can only represent forward chess moves. An
undo is a history operation, not a chess move — there is no way to represent
"uncapturing" a piece in the current type.

## Solution

Replace `MoveResult` with `Movement[]` — an ordered list of individual piece
movements that describe every board change, forward or backward.

### `Movement` type

```ts
interface Movement {
  from: Square | undefined;
  to: Square | undefined;
  piece: Piece;
}
```

Semantics:

- `from` defined, `to` defined — piece moves from one square to another
- `from` defined, `to` undefined — piece removed from the board (capture)
- `from` undefined, `to` defined — piece appears on the board (uncapture on
  undo, promoted piece appearing)

### Ordering

Active color first, then opponent color. Within active color: primary movement
first, then transformations.

1. **Primary movement** — the piece the player moved
2. **Transformations** — promotion (pawn disappears, promoted piece appears)
3. **Captures** — opponent piece removed

Examples:

**Normal move** (e2 to e4):

```ts
[{ from: 'e2', to: 'e4', piece: { color: 'white', type: 'pawn' } }];
```

**Capture** (Nf3 captures pawn on d5):

```ts
[
  { from: 'f3', to: 'd5', piece: { color: 'white', type: 'knight' } },
  { from: 'd5', to: undefined, piece: { color: 'black', type: 'pawn' } },
];
```

**En passant** (e5 captures pawn on d5 via d6):

```ts
[
  { from: 'e5', to: 'd6', piece: { color: 'white', type: 'pawn' } },
  { from: 'd5', to: undefined, piece: { color: 'black', type: 'pawn' } },
];
```

**Kingside castling**:

```ts
[
  { from: 'e1', to: 'g1', piece: { color: 'white', type: 'king' } },
  { from: 'h1', to: 'f1', piece: { color: 'white', type: 'rook' } },
];
```

**Promotion** (pawn promotes to queen):

```ts
[
  { from: 'e7', to: undefined, piece: { color: 'white', type: 'pawn' } },
  { from: undefined, to: 'e8', piece: { color: 'white', type: 'queen' } },
];
```

**Promotion with capture** (pawn captures rook on d8, promotes to queen):

```ts
[
  { from: 'e7', to: undefined, piece: { color: 'white', type: 'pawn' } },
  { from: undefined, to: 'd8', piece: { color: 'white', type: 'queen' } },
  { from: 'd8', to: undefined, piece: { color: 'black', type: 'rook' } },
];
```

**Undo of capture** (Nf3xd5 undone):

```ts
[
  { from: 'd5', to: 'f3', piece: { color: 'white', type: 'knight' } },
  { from: undefined, to: 'd5', piece: { color: 'black', type: 'pawn' } },
];
```

**Undo of en passant** (e5->d6 undone):

```ts
[
  { from: 'd6', to: 'e5', piece: { color: 'white', type: 'pawn' } },
  { from: undefined, to: 'd5', piece: { color: 'black', type: 'pawn' } },
];
```

**Undo of promotion**:

```ts
[
  { from: 'e8', to: undefined, piece: { color: 'white', type: 'queen' } },
  { from: undefined, to: 'e7', piece: { color: 'white', type: 'pawn' } },
];
```

**Undo of promotion with capture** (pawn captured rook on d8, promoted to
queen):

```ts
[
  { from: 'd8', to: undefined, piece: { color: 'white', type: 'queen' } },
  { from: undefined, to: 'e7', piece: { color: 'white', type: 'pawn' } },
  { from: undefined, to: 'd8', piece: { color: 'black', type: 'rook' } },
];
```

## API changes

| Method        | Before                    | After                     |
| ------------- | ------------------------- | ------------------------- |
| `move(input)` | `MoveResult`              | `Movement[]`              |
| `undo()`      | `MoveResult \| undefined` | `Movement[] \| undefined` |
| `redo()`      | `MoveResult \| undefined` | `Movement[] \| undefined` |

Breaking change — requires major version bump.

## Internal changes

### `src/types.ts`

- Delete `MoveResult` interface
- Add `Movement` interface

### `src/moves.ts`

- `move()` returns `{ position: Position, movements: Movement[] }` instead of
  `{ position: Position, result: MoveResult }`
- Build `Movement[]` from the same data already computed (piece, capture,
  castling, promotion detection)

### `src/game.ts`

- `HistoryEntry` becomes `{ position: Position, move: Move }` — drop `result`
- Delete `reverseMoveResult` function
- `move()` returns `Movement[]` from `applyMove`
- `undo()` recomputes `Movement[]` for the undone move via
  `applyMove(entry.position, entry.move)`, then reverses each movement (swap
  `from`/`to`)
- `redo()` recomputes `Movement[]` via `applyMove(entry.position, entry.move)`

### `src/index.ts`

- Export `Movement` type instead of `MoveResult`

## Undo reversal

`undo()` computes the forward `Movement[]` and produces the reverse:

- Swap `from` and `to` on each movement
- Active color movements come first, opponent color second
- No ordering guarantee within the same color group

## Testing

- Update existing `MoveResult` tests to assert `Movement[]` for each move type
- Add undo tests for captures, en passant, castling, and promotion — verify the
  reversed movements include uncaptures and depromotions
- Existing perft, detection, and playthrough tests should be unaffected (they
  don't inspect `MoveResult`)
