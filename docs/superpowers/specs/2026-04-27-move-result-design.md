# Move Result Output

**Issue:**
[#19 — Consider returning applied move output from game.move()](https://github.com/echecsjs/game/issues/19)
**Date:** 2026-04-27 **Breaking:** yes (major version bump)

---

## Problem

`game.move()` returns `this` for chaining. Consumers that need to know what
happened on the board — which piece moved, what was captured, where the castling
rook went — have no way to get that information from the call itself.

`@echecs/react-board` works around this by diffing the full position map before
and after every move (`diffPositions()` in `utilities.ts`). The diffing is
heuristic: it pairs removed and added pieces by type using greedy matching. This
breaks down for en passant (captured pawn vanishes without animation), can
misidentify promotions (pawn becomes queen but greedy matching may pair the
wrong piece), and handles castling only by accident (king and rook happen to be
unique types).

External consumers like `@mirasen/chessboard` report the same gap — they need
normalized move effects to animate or update the board without re-deriving
special move logic outside the rules layer.

## Decision

`game.move()` returns a `MoveResult` object instead of `this`. `game.undo()` and
`game.redo()` also return `MoveResult | undefined`.

This is a breaking change. Chaining (`game.move().move()`) stops working. In
practice, every real consumer does work between moves (update state, animate,
check game over), so chaining optimizes for demo snippets, not real usage.

Illegal moves continue to throw.

## MoveResult Type

```ts
interface MoveResult {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: {
    square: Square;
    piece: Piece;
  };
  promotion?: Piece;
  castling?: {
    from: Square;
    to: Square;
    piece: Piece;
  };
}
```

Every piece involved is a full `Piece` object (`{ color, type }`). No deriving
needed by the consumer.

### Fields

| Field       | Description                                                                                      |
| ----------- | ------------------------------------------------------------------------------------------------ |
| `from`      | origin square of the moved piece                                                                 |
| `to`        | destination square of the moved piece                                                            |
| `piece`     | the piece that moved (before promotion, if applicable)                                           |
| `captured`  | the captured piece and the square it was on. for en passant, `captured.square` differs from `to` |
| `promotion` | the piece the pawn promoted to (full `Piece` with color and type)                                |
| `castling`  | the rook relocation — `from`, `to`, and the rook `Piece`                                         |

### Examples

**Normal move** — `e2 to e4`:

```ts
{
  from: 'e2',
  to: 'e4',
  piece: { color: 'white', type: 'pawn' },
}
```

**Capture** — knight takes pawn on d5:

```ts
{
  from: 'f3',
  to: 'd5',
  piece: { color: 'white', type: 'knight' },
  captured: {
    square: 'd5',
    piece: { color: 'black', type: 'pawn' },
  },
}
```

For a normal capture, `captured.square` equals `to`. The field is always present
on captures so the consumer knows which piece was removed.

**En passant** — white pawn on e5 captures black pawn on d5 via d6:

```ts
{
  from: 'e5',
  to: 'd6',
  piece: { color: 'white', type: 'pawn' },
  captured: {
    square: 'd5',
    piece: { color: 'black', type: 'pawn' },
  },
}
```

**Kingside castling** — white:

```ts
{
  from: 'e1',
  to: 'g1',
  piece: { color: 'white', type: 'king' },
  castling: {
    from: 'h1',
    to: 'f1',
    piece: { color: 'white', type: 'rook' },
  },
}
```

**Promotion** — pawn promotes to queen:

```ts
{
  from: 'e7',
  to: 'e8',
  piece: { color: 'white', type: 'pawn' },
  promotion: { color: 'white', type: 'queen' },
}
```

**Promotion with capture**:

```ts
{
  from: 'e7',
  to: 'd8',
  piece: { color: 'white', type: 'pawn' },
  captured: {
    square: 'd8',
    piece: { color: 'black', type: 'rook' },
  },
  promotion: { color: 'white', type: 'queen' },
}
```

## Method Signatures

### `move(input: Move): MoveResult`

Applies the move, returns the result. Throws on illegal moves.

### `undo(): MoveResult | undefined`

Steps back one move. Returns a **reversed** `MoveResult` (piece moves from `to`
back to `from`, captured piece reappears, castling rook returns). Returns
`undefined` if there is nothing to undo.

The reversed result is ready for backward animation — the consumer does not need
to flip anything.

### `redo(): MoveResult | undefined`

Steps forward one move after an undo. Returns the **forward** `MoveResult` (same
as the original `move()` call). Returns `undefined` if there is nothing to redo.

## Internal Changes

### HistoryEntry

The history entry stores the `MoveResult` when the move is first played:

```ts
interface HistoryEntry {
  move: Move;
  previousPosition: Position;
  result: MoveResult;
}
```

- `redo()` returns `entry.result` directly — no recomputation.
- `undo()` reverses `entry.result` (swap from/to, restore captured piece,
  reverse castling) and returns it.

### MoveResult Construction

The `move()` function in `moves.ts` already computes all the data needed via
`boardChanges()`. The `MoveResult` is constructed alongside the position
transition — no extra traversal.

Specifically, `move()` in `moves.ts` already knows:

- the piece on `from` (via `position.at(m.from)`)
- whether it's a capture (via `position.at(m.to)`)
- whether it's en passant (pawn moving to `enPassantSquare`)
- whether it's castling (king moving from e-file to g or c)
- the promotion piece (from `m.promotion`)

The `MoveResult` is assembled from these existing checks, not from new logic.

### Reversing a MoveResult

For `undo()`, the reversal is mechanical:

```ts
function reverseMoveResult(result: MoveResult): MoveResult {
  return {
    from: result.to,
    to: result.from,
    piece: result.promotion ?? result.piece,
    // captured is omitted — the piece reappears, but that's a board
    // state change, not a movement. the consumer sees the piece return
    // via the position update.
    // OR: include captured with a flag? see open question below.
    ...(result.castling && {
      castling: {
        from: result.castling.to,
        to: result.castling.from,
        piece: result.castling.piece,
      },
    }),
    // promotion is omitted — the piece reverts to a pawn, which is
    // already expressed by `piece` being the promoted piece moving
    // back and becoming a pawn again on the origin square.
  };
}
```

`captured` is omitted on the reversed result. The position update already
handles reappearance. Adding a `restored` field would create semantics specific
to undo, making the type harder to reason about.

`promotion` is also omitted on undo. The `piece` field on the reversed result is
the promoted piece (e.g. queen), and the destination is the pawn's origin
square. The consumer knows a queen is reverting to a pawn because the position
update shows a pawn on that square.

## What Does Not Change

- `Move` type stays the same (`{ from, to, promotion? }`)
- `generateMoves()` stays the same (returns `Move[]`)
- `game.moves()` stays the same (returns `Move[]`)
- detection functions stay the same
- `game.history()` stays the same (returns `Move[]`)
- illegal move handling stays the same (throws `Error`)
- `Position` is not modified

## Migration

Callers that chain `game.move().move()` split into separate statements:

```ts
// before
game.move({ from: 'e2', to: 'e4' }).move({ from: 'e7', to: 'e5' });

// after
game.move({ from: 'e2', to: 'e4' });
game.move({ from: 'e7', to: 'e5' });
```

Callers that ignore the return value don't need to change.

Callers that use `undo()` / `redo()` and ignore the return value don't need to
change (return type goes from `void` to `MoveResult | undefined`).

## Out of Scope

**Pre-commit move effects on `moves()`:** the requester also asked about
attaching `MoveResult`-style data to legal moves _before_ they are applied, so
board UIs can show castling rook destinations or en passant capture squares
during drag/drop. This is a separate concern — `moves()` currently returns
`Move[]` and enriching it would require computing effects for every legal move
up front. Worth considering as a follow-up but not part of this change.

## Versioning

Major version bump. This is a breaking change to the return type of `move()`.
