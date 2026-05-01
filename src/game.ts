import { Position, STARTING_POSITION } from '@echecs/position';

import { isCheckmate, isDraw, isStalemate } from './detection.js';
import { move as applyMove, generateMoves } from './moves.js';

import type { Movement } from './types.js';
import type { Color, Move, Piece, Square } from '@echecs/position';

interface HistoryEntry {
  move: Move;
  position: Position;
}

/**
 * A mutable chess game with legal move generation, undo/redo, and
 * game-state detection.
 *
 * @example
 * ```typescript
 * const game = new Game();
 * game.move({ from: 'e2', to: 'e4' });
 * game.move({ from: 'e7', to: 'e5' });
 * game.moves('d1'); // legal queen moves
 * ```
 */
export class Game {
  #cache: { inCheck: boolean; moves: Move[] } | undefined = undefined;
  #future: HistoryEntry[] = [];
  #past: HistoryEntry[] = [];
  #position: Position;
  #positionHistory: string[] = [];

  /**
   * Creates a new game. Defaults to the standard starting position.
   *
   * @example
   * ```typescript
   * const game = new Game();                     // starting position
   * const game = new Game(customPosition);        // from a Position
   * ```
   */
  constructor(position?: Position) {
    this.#position = position ?? new Position({ board: STARTING_POSITION });
    this.#positionHistory = [this.#position.hash];
  }

  get #cachedState(): { inCheck: boolean; moves: Move[] } {
    if (this.#cache === undefined) {
      this.#cache = {
        inCheck: this.#position.isCheck,
        moves: generateMoves(this.#position),
      };
    }

    return this.#cache;
  }

  #illegalMoveReason(m: Move, legalFromSquare: Move[]): string {
    const piece = this.#position.at(m.from);

    if (piece === undefined) {
      return `Illegal move: no piece on ${m.from}`;
    }

    if (piece.color !== this.#position.turn) {
      return `Illegal move: ${m.from} is not yours`;
    }

    if (this.isGameOver()) {
      return 'Illegal move: game is over';
    }

    if (legalFromSquare.length === 0) {
      return `Illegal move: ${m.from} ${piece.type} has no legal moves`;
    }

    const toMatches = legalFromSquare.filter((mv) => mv.to === m.to);
    if (toMatches.length === 0) {
      return `Illegal move: ${m.from} ${piece.type} cannot move to ${m.to}`;
    }

    const promotionRequired = toMatches.some(
      (mv) => mv.promotion !== undefined,
    );

    return promotionRequired
      ? `Illegal move: pawn must promote on ${m.to}`
      : `Illegal move: promotion not allowed on ${m.to}`;
  }

  /**
   * Returns the board as an 8x8 array of `Piece | undefined`, indexed
   * `[rank][file]` with `board()[0]` = rank 1 (a1-h1) and `board()[7]`
   * = rank 8.
   *
   * @example
   * ```typescript
   * const game = new Game();
   * game.board()[0]?.[4]; // { color: 'white', type: 'king' } (e1)
   * ```
   */
  board(): (Piece | undefined)[][] {
    const result: (Piece | undefined)[][] = [];
    // rank 0 → rank 1 (a1-h1), rank 7 → rank 8 (a8-h8) — matches original API
    for (let rank = 1; rank <= 8; rank++) {
      const row: (Piece | undefined)[] = [];
      for (let fileCode = 0; fileCode < 8; fileCode++) {
        const file = String.fromCodePoint(('a'.codePointAt(0) ?? 0) + fileCode);
        const square = `${file}${rank}` as Square;
        row.push(this.#position.at(square));
      }
      result.push(row);
    }
    return result;
  }

  /**
   * Returns the piece on the given square, or `undefined` if the square
   * is empty.
   *
   * @example
   * ```typescript
   * const game = new Game();
   * game.get('e1'); // { color: 'white', type: 'king' }
   * game.get('e4'); // undefined
   * ```
   */
  get(square: Square): Piece | undefined {
    return this.#position.at(square);
  }

  /**
   * Returns the list of moves played so far. Undone moves are not
   * included.
   */
  history(): Move[] {
    return this.#past.map((entry) => entry.move);
  }

  /** Returns `true` if the active color's king is in check. */
  isCheck(): boolean {
    return this.#cachedState.inCheck;
  }

  /** Returns `true` if the active color is in checkmate. */
  isCheckmate(): boolean {
    return isCheckmate(this.#position, this.#cachedState.moves);
  }

  /**
   * Returns `true` if the position is a draw by any of: 50-move rule,
   * insufficient material, stalemate, or threefold repetition.
   */
  isDraw(): boolean {
    return isDraw(
      this.#position,
      this.#cachedState.moves,
      this.#positionHistory,
    );
  }

  /** Returns `true` if the game is over by checkmate or draw. */
  isGameOver(): boolean {
    return this.isCheckmate() || this.isDraw();
  }

  /**
   * Returns `true` if the active color has no legal moves and is not in
   * check.
   */
  isStalemate(): boolean {
    return isStalemate(this.#position, this.#cachedState.moves);
  }

  /**
   * Applies a move and returns a {@link Movement} array describing all board changes.
   * Clears the redo stack.
   *
   * @throws Error if the move is illegal, with a descriptive message
   * explaining why.
   *
   * @example
   * ```typescript
   * const game = new Game();
   * game.move({ from: 'e2', to: 'e4' });
   * game.move({ from: 'e7', to: 'e5' });
   * // promotion
   * game.move({ from: 'e7', to: 'e8', promotion: 'queen' });
   * ```
   */
  move(input: Move): Movement[] {
    const legalFromSquare = this.#cachedState.moves.filter(
      (mv) => mv.from === input.from,
    );
    const isLegal = legalFromSquare.some(
      (mv) => mv.to === input.to && mv.promotion === input.promotion,
    );

    if (!isLegal) {
      throw new Error(this.#illegalMoveReason(input, legalFromSquare));
    }

    this.#cache = undefined;
    const position = this.#position;
    const { movements, position: newPosition } = applyMove(
      this.#position,
      input,
    );
    this.#position = newPosition;
    this.#past.push({ move: input, position });
    this.#future = [];
    this.#positionHistory.push(this.#position.hash);

    return movements;
  }

  /**
   * Returns all legal moves for the active color. If a square is given,
   * returns only the legal moves for the piece on that square.
   *
   * @example
   * ```typescript
   * const game = new Game();
   * game.moves();     // all 20 legal opening moves
   * game.moves('e2'); // [{ from: 'e2', to: 'e3' }, { from: 'e2', to: 'e4' }]
   * ```
   */
  moves(square?: Square): Move[] {
    if (square === undefined) {
      return this.#cachedState.moves;
    }

    return this.#cachedState.moves.filter((m) => m.from === square);
  }

  /** Returns the underlying {@link Position} object. */
  position(): Position {
    return this.#position;
  }

  /**
   * Steps forward one move after an {@link undo}. No-op if there is
   * nothing to redo.
   *
   * @remarks The redo stack is cleared whenever a new {@link move} is
   * made.
   */
  redo(): Movement[] | undefined {
    const entry = this.#future.pop();
    if (entry === undefined) {
      return undefined;
    }

    this.#cache = undefined;
    const { movements, position } = applyMove(entry.position, entry.move);
    this.#position = position;
    this.#past.push(entry);
    this.#positionHistory.push(this.#position.hash);

    return movements;
  }

  /** Returns the color whose turn it is to move: `'white'` or `'black'`. */
  turn(): Color {
    return this.#position.turn;
  }

  /** Steps back one move. No-op at the start of the game. */
  undo(): Movement[] | undefined {
    const entry = this.#past.pop();
    if (entry === undefined) {
      return undefined;
    }

    this.#cache = undefined;
    this.#position = entry.position;
    this.#future.push(entry);
    this.#positionHistory.pop();

    const { movements } = applyMove(entry.position, entry.move);
    const activeColor = entry.position.turn;
    const active = movements
      .filter((m) => m.piece.color === activeColor)
      .toReversed()
      .map((m) => ({ from: m.to, piece: m.piece, to: m.from }));
    const opponent = movements
      .filter((m) => m.piece.color !== activeColor)
      .toReversed()
      .map((m) => ({ from: m.to, piece: m.piece, to: m.from }));

    return [...active, ...opponent];
  }
}
