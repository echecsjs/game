# Comparative Benchmark Results

**Date**: 2026-03-15 **Test**: Game Engine Comparison **Command**: `pnpm bench`
**Vitest**: v4.1.0

## Overview

Comparative benchmarks for `@echecs/game` against `chess.js@1.4.0` across all
operations both libraries share.

Only operations present in both public APIs are included. The benchmark measures
each operation in isolation on a pre-constructed instance to avoid construction
overhead contaminating results.

## Fixtures

| Fixture           | FEN                                                                | Description                            |
| ----------------- | ------------------------------------------------------------------ | -------------------------------------- |
| starting position | `rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1`         | Standard opening position              |
| midgame           | `r1bqk2r/pp2bppp/2nppn2/8/3NP3/2N1B3/PPP1BPPP/R2QK2R w KQkq - 0 8` | Varied mid-game position               |
| checkmate         | `rnb1kbnr/pppp1ppp/4p3/8/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3`    | Fool's mate — white in checkmate       |
| stalemate         | `k7/8/1QK5/8/8/8/8/8 b - - 0 1`                                    | Classic stalemate — black has no moves |

## Construction

### new Game() [starting position]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  321,257.00  0.0026  0.6890  0.0031  0.0031  0.0040  0.0042  0.0147  ±0.32%  160629
chess.js      155,158.40  0.0053  2.7615  0.0064  0.0063  0.0121  0.0144  0.0393  ±1.10%   77580
```

**@echecs/game is 2.07x faster than chess.js**

### fromFen() [starting position]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  161,983.05  0.0052  0.1247  0.0062  0.0062  0.0079  0.0086  0.0168  ±0.18%   80992
chess.js      160,476.06  0.0052  0.1153  0.0062  0.0062  0.0080  0.0095  0.0182  ±0.20%   80239
```

**effectively tied (1.01x)**

### fromFen() [midgame]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  157,762.97  0.0054  0.1187  0.0063  0.0063  0.0081  0.0107  0.0179  ±0.18%   78882
chess.js      161,860.66  0.0051  0.1275  0.0062  0.0062  0.0079  0.0081  0.0168  ±0.20%   80931
```

**effectively tied (1.03x)**

## Move Generation

### moves() [starting position — 20 moves]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game   28,721.81  0.0301  0.1619  0.0348  0.0349  0.0425  0.0447  0.1057  ±0.20%   14361
chess.js       55,953.30  0.0153  0.1120  0.0179  0.0178  0.0222  0.0227  0.0826  ±0.20%   27977
```

**chess.js is 1.95x faster than @echecs/game**

### moves() [midgame]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game    9,747.81  0.0875  0.2461  0.1026  0.1035  0.1278  0.1622  0.2008  ±0.22%    4874
chess.js       22,574.15  0.0383  0.1672  0.0443  0.0438  0.0550  0.0606  0.1206  ±0.21%   11288
```

**chess.js is 2.32x faster than @echecs/game**

### moves({square}) [e2 — 2 moves]

```
name          hz          min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  294,065.09  0.0029  0.1360  0.0034  0.0034  0.0043  0.0044  0.0125  ±0.17%  147033
chess.js      536,985.91  0.0015  4.5638  0.0019  0.0018  0.0031  0.0061  0.0107  ±1.80%  268493
```

**chess.js is 1.83x faster than @echecs/game**

## Move Execution

### move({from, to}) + undo()

```
name          hz          min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  221,587.60  0.0036  6.7792  0.0045  0.0043  0.0113  0.0126  0.0187  ±2.67%  110794
chess.js       30,399.62  0.0280  0.2210  0.0329  0.0327  0.0435  0.0470  0.1744  ±0.30%   15200
```

**@echecs/game is 7.29x faster than chess.js**

## Board Queries

### fen()

```
name          hz            min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  1,553,936.54  0.0005  0.1682  0.0006  0.0006  0.0008  0.0010  0.0012  ±0.22%  776969
chess.js      1,535,409.20  0.0005  6.3133  0.0007  0.0006  0.0009  0.0010  0.0071  ±2.49%  767705
```

**effectively tied (1.01x)**

### get("e1")

```
name          hz             min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  48,604,698.89  0.0000  0.3635  0.0000  0.0000  0.0000  0.0000  0.0001  ±0.18%  24302351
chess.js      48,982,187.31  0.0000  0.0330  0.0000  0.0000  0.0000  0.0000  0.0000  ±0.09%  24491094
```

**effectively tied (1.01x)**

## State Detection

### isCheck() [starting position — false]

```
name          hz            min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game    634,108.62  0.0013  0.3751  0.0016  0.0015  0.0020  0.0021  0.0073  ±0.44%   317055
chess.js      6,115,540.84  0.0001  0.0475  0.0002  0.0002  0.0002  0.0003  0.0003  ±0.09%  3057771
```

**chess.js is 9.64x faster than @echecs/game**

### isCheckmate() [checkmate position — true]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game   80,660.22  0.0101  0.3878  0.0124  0.0122  0.0184  0.0217  0.0300  ±0.54%   40331
chess.js      119,416.53  0.0070  0.3561  0.0084  0.0082  0.0108  0.0155  0.0250  ±0.57%   59709
```

**chess.js is 1.48x faster than @echecs/game**

### isStalemate() [stalemate position — true]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  327,279.25  0.0025  0.3621  0.0031  0.0030  0.0038  0.0042  0.0131  ±0.47%  163640
chess.js      261,451.72  0.0032  0.3658  0.0038  0.0038  0.0048  0.0053  0.0145  ±0.43%  130726
```

**@echecs/game is 1.25x faster than chess.js**

### isDraw() [starting position — false]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  25,439.76  0.0317  0.4662  0.0393  0.0400  0.0500  0.0635  0.3601  ±0.58%   12720
chess.js      51,362.30  0.0162  0.4267  0.0195  0.0194  0.0243  0.0267  0.0456  ±0.46%   25682
```

**chess.js is 2.02x faster than @echecs/game**

### isGameOver() [starting position — false]

```
name          hz         min     max     mean    p75     p99     p995    p999    rme     samples
@echecs/game  24,592.93  0.0343  0.4012  0.0407  0.0407  0.0506  0.0537  0.3449  ±0.53%   12297
chess.js      50,944.70  0.0165  0.3823  0.0196  0.0194  0.0265  0.0302  0.0475  ±0.44%   25473
```

**chess.js is 2.07x faster than @echecs/game**

## Summary

| Operation              | @echecs/game  | chess.js      | verdict                       |
| ---------------------- | ------------- | ------------- | ----------------------------- |
| `new Game()`           | 321,257 hz    | 155,158 hz    | **@echecs/game 2.07x faster** |
| `fromFen()` [starting] | 161,983 hz    | 160,476 hz    | effectively tied              |
| `fromFen()` [midgame]  | 157,763 hz    | 161,861 hz    | effectively tied              |
| `moves()` [starting]   | 28,722 hz     | 55,953 hz     | chess.js 1.95x faster         |
| `moves()` [midgame]    | 9,748 hz      | 22,574 hz     | chess.js 2.32x faster         |
| `moves({square})`      | 294,065 hz    | 536,986 hz    | chess.js 1.83x faster         |
| `move() + undo()`      | 221,588 hz    | 30,400 hz     | **@echecs/game 7.29x faster** |
| `fen()`                | 1,553,937 hz  | 1,535,409 hz  | effectively tied              |
| `get()`                | 48,604,699 hz | 48,982,187 hz | effectively tied              |
| `isCheck()`            | 634,109 hz    | 6,115,541 hz  | chess.js 9.64x faster         |
| `isCheckmate()`        | 80,660 hz     | 119,417 hz    | chess.js 1.48x faster         |
| `isStalemate()`        | 327,279 hz    | 261,452 hz    | **@echecs/game 1.25x faster** |
| `isDraw()`             | 25,440 hz     | 51,362 hz     | chess.js 2.02x faster         |
| `isGameOver()`         | 24,593 hz     | 50,945 hz     | chess.js 2.07x faster         |

## Key Findings

1. **`move() + undo()` is the biggest win for `@echecs/game`** (7.29x faster).
   chess.js's `move()` constructs a verbose move object with `san`, `lan`,
   `flags`, `before`/`after` FEN snapshots, and maintains a full move history
   per entry. `@echecs/game` stores only the previous `FenState` snapshot and
   skips SAN entirely.

2. **`isCheck()` is the biggest win for chess.js** (9.64x faster). chess.js
   maintains a cached check flag that is updated incrementally on each
   `move()`/`undo()`. `@echecs/game` recomputes attack detection from scratch on
   every call. The gap closes significantly on positions where check is actually
   true (`isCheckmate()`: 1.48x, `isStalemate()`: `@echecs/game` wins 1.25x)
   because both libraries must generate all legal moves to confirm no escape.

3. **`moves()` consistently favours chess.js** (~2x). chess.js caches move
   generation after each `move()`/`undo()` and returns the cached result on
   repeated calls from the same position. `@echecs/game` recomputes on every
   call.

4. **Construction, `fen()`, and `get()` are effectively tied** — neither library
   has a meaningful edge on these operations.

5. **The tradeoff is architectural**: chess.js pays per `move()`/`undo()` to
   maintain caches (check flag, legal move list, move history objects). This
   makes repeated queries cheap but mutation expensive. `@echecs/game` pays per
   query but keeps mutation cheap. Which is faster in practice depends on the
   call pattern of the application.
