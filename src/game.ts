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

interface MoveInput {
  from: Square;
  promotion?: PromotionPieceType;
  to: Square;
}

interface HistoryEntry {
  move: Move;
  previousPosition: Position;
}

export class Game {
  #cache: { inCheck: boolean; moves: Move[] } | undefined = undefined;
  #future: HistoryEntry[] = [];
  #past: HistoryEntry[] = [];
  #position: Position;
  #positionHistory: string[] = [];

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

  get(square: Square): Piece | undefined {
    return this.#position.piece(square);
  }

  history(): Move[] {
    return this.#past.map((entry) => entry.move);
  }

  isAttacked(square: Square, color: Color): boolean {
    return this.#position.isAttacked(square, color);
  }

  isCheck(): boolean {
    return this.#cachedState.inCheck;
  }

  isCheckmate(): boolean {
    return isCheckmate(this.#position, this.#cachedState.moves);
  }

  isDraw(): boolean {
    return isDraw(
      this.#position,
      this.#cachedState.moves,
      this.#positionHistory,
    );
  }

  isGameOver(): boolean {
    return this.isCheckmate() || this.isDraw();
  }

  isStalemate(): boolean {
    return isStalemate(this.#position, this.#cachedState.moves);
  }

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

  moves(square?: Square): Move[] {
    if (square === undefined) {
      return this.#cachedState.moves;
    }

    return this.#cachedState.moves.filter((m) => m.from === square);
  }

  position(): Position {
    return this.#position;
  }

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

  turn(): Color {
    return this.#position.turn;
  }

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
