# GAME

**GAME** is a TypeScript chess game engine — part of the
[ECHECS](https://github.com/mormubis) project.

Zero runtime dependencies. Provides legal move generation, check/checkmate/
stalemate/draw detection, and undo/redo support.

## Installation

```bash
npm install @echecs/game
```

## Usage

```typescript
import { Game } from '@echecs/game';

const game = new Game();
console.log(game.moves()); // all 20 legal opening moves
game.move({ from: 'e2', to: 'e4' });
console.log(game.turn()); // 'b'
```

## License

MIT
