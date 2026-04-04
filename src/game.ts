import parse, { stringify } from '@echecs/fen';
import { Position } from '@echecs/position';

import { isCheckmate, isDraw, isStalemate } from './detection.js';
import { move as applyMove, generateMoves } from './moves.js';

import type {
  Color,
  Move,
  Piece,
  PieceType,
  PromotionPieceType,
  Square,
} from '@echecs/position';

const PIECE_NAMES: Record<PieceType, string> = {
  b: 'bishop',
  k: 'king',
  n: 'knight',
  p: 'pawn',
  q: 'queen',
  r: 'rook',
};

/**
 * Input shape for {@link Game.move}. Requires an origin and destination
 * square, plus an optional promotion piece type for pawn promotions.
 */
export interface MoveInput {
  from: Square;
  promotion?: PromotionPieceType;
  to: Square;
}

interface HistoryEntry {
  move: Move;
  previousPosition: Position;
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

  /** Creates a new game from the standard starting position. */
  constructor() {
    this.#position = new Position();
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
    const piece = this.#position.piece(m.from);

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
      return `Illegal move: ${m.from} ${PIECE_NAMES[piece.type]} has no legal moves`;
    }

    const toMatches = legalFromSquare.filter((mv) => mv.to === m.to);
    if (toMatches.length === 0) {
      return `Illegal move: ${m.from} ${PIECE_NAMES[piece.type]} cannot move to ${m.to}`;
    }

    const promotionRequired = toMatches.some(
      (mv) => mv.promotion !== undefined,
    );

    return promotionRequired
      ? `Illegal move: pawn must promote on ${m.to}`
      : `Illegal move: promotion not allowed on ${m.to}`;
  }

  /**
   * Creates a game from an arbitrary FEN string.
   *
   * @throws Error if the FEN string is invalid.
   *
   * @example
   * ```typescript
   * const game = Game.fromFen(
   *   'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq e3 0 1',
   * );
   * game.turn(); // 'b'
   * ```
   */
  static fromFen(fen: string): Game {
    const parsed = parse(fen);
    if (!parsed) {
      throw new Error(`Invalid FEN: ${fen}`);
    }

    const game = new Game();
    game.#position = new Position(parsed.board, {
      castlingRights: parsed.castlingRights,
      enPassantSquare: parsed.enPassantSquare,
      fullmoveNumber: parsed.fullmoveNumber,
      halfmoveClock: parsed.halfmoveClock,
      turn: parsed.turn,
    });
    game.#past = [];
    game.#future = [];
    game.#positionHistory = [game.#position.hash];
    game.#cache = undefined;
    return game;
  }

  /**
   * Returns the board as an 8x8 array of `Piece | undefined`, indexed
   * `[rank][file]` with `board()[0]` = rank 1 (a1-h1) and `board()[7]`
   * = rank 8.
   *
   * @example
   * ```typescript
   * const game = new Game();
   * game.board()[0]?.[4]; // { color: 'w', type: 'k' } (e1)
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
        row.push(this.#position.piece(square));
      }
      result.push(row);
    }
    return result;
  }

  /** Returns the current position as a FEN string. */
  fen(): string {
    return stringify({
      board: this.#position.pieces(),
      castlingRights: this.#position.castlingRights,
      enPassantSquare: this.#position.enPassantSquare,
      fullmoveNumber: this.#position.fullmoveNumber,
      halfmoveClock: this.#position.halfmoveClock,
      turn: this.#position.turn,
    });
  }

  /**
   * Returns the piece on the given square, or `undefined` if the square
   * is empty.
   *
   * @example
   * ```typescript
   * const game = new Game();
   * game.get('e1'); // { color: 'w', type: 'k' }
   * game.get('e4'); // undefined
   * ```
   */
  get(square: Square): Piece | undefined {
    return this.#position.piece(square);
  }

  /**
   * Returns the list of moves played so far. Undone moves are not
   * included.
   */
  history(): Move[] {
    return this.#past.map((entry) => entry.move);
  }

  /**
   * Returns `true` if any piece of the given color attacks the square.
   * The square does not need to be empty — it may contain a piece of
   * either color. Pinned pieces still count as attacking.
   *
   * @example
   * ```typescript
   * const game = new Game();
   * game.isAttacked('f3', 'w'); // true — white pawn on g2 attacks f3
   * game.isAttacked('f6', 'b'); // true — black pawn on g7 attacks f6
   * ```
   */
  isAttacked(square: Square, color: Color): boolean {
    return this.#position.isAttacked(square, color);
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
   * Applies a move and returns `this` for chaining. Clears the redo
   * stack.
   *
   * @throws Error if the move is illegal, with a descriptive message
   * explaining why.
   *
   * @example
   * ```typescript
   * const game = new Game();
   * game.move({ from: 'e2', to: 'e4' }).move({ from: 'e7', to: 'e5' });
   * // promotion
   * game.move({ from: 'e7', to: 'e8', promotion: 'q' });
   * ```
   */
  move(input: MoveInput): this {
    const m: Move = {
      from: input.from,
      promotion: input.promotion,
      to: input.to,
    };
    const legalFromSquare = this.#cachedState.moves.filter(
      (mv) => mv.from === m.from,
    );
    const isLegal = legalFromSquare.some(
      (mv) => mv.to === m.to && mv.promotion === m.promotion,
    );

    if (!isLegal) {
      throw new Error(this.#illegalMoveReason(m, legalFromSquare));
    }

    this.#cache = undefined;
    const previousPosition = this.#position;
    this.#position = applyMove(this.#position, m);
    this.#past.push({ move: m, previousPosition });
    this.#future = [];
    this.#positionHistory.push(this.#position.hash);

    return this;
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
  redo(): void {
    const entry = this.#future.pop();
    if (entry === undefined) {
      return;
    }

    this.#cache = undefined;
    this.#position = applyMove(entry.previousPosition, entry.move);
    this.#past.push(entry);
    this.#positionHistory.push(this.#position.hash);
  }

  /** Returns the color whose turn it is to move: `'w'` or `'b'`. */
  turn(): Color {
    return this.#position.turn;
  }

  /** Steps back one move. No-op at the start of the game. */
  undo(): void {
    const entry = this.#past.pop();
    if (entry === undefined) {
      return;
    }

    this.#cache = undefined;
    this.#position = entry.previousPosition;
    this.#future.push(entry);
    this.#positionHistory.pop();
  }
}
