import { Position } from '@echecs/position';
import {
  OFF_BOARD,
  boardFromMap,
  indexToSquare,
  squareToIndex,
} from '@echecs/position/internal';

import type {
  CastlingRights,
  Color,
  Move,
  Piece,
  PieceType,
  PromotionPieceType,
  Square,
} from '@echecs/position';

const PROMOTION_PIECES: PromotionPieceType[] = ['b', 'n', 'q', 'r'];

const KNIGHT_OFFSETS_0X88 = [-33, -31, -18, -14, 14, 18, 31, 33] as const;
const BISHOP_DIRS_0X88 = [-17, -15, 15, 17] as const;
const ROOK_DIRS_0X88 = [-16, -1, 1, 16] as const;
const KING_OFFSETS_0X88 = [-17, -16, -15, -1, 1, 15, 16, 17] as const;

// ── ATTACKS / RAYS lookup tables ─────────────────────────────────────────────

const PAWN_MASK = 0x01;
const KNIGHT_MASK = 0x02;
const BISHOP_MASK = 0x04;
const ROOK_MASK = 0x08;
const KING_MASK = 0x10;

const PIECE_MASKS: Record<PieceType, number> = {
  b: BISHOP_MASK,
  k: KING_MASK,
  n: KNIGHT_MASK,
  p: PAWN_MASK,
  q: BISHOP_MASK | ROOK_MASK,
  r: ROOK_MASK,
};

const DIFF_OFFSET = 119; // centres diff range [-119, +119] at index 0

const ATTACKS: number[] = Array.from<number>({ length: 240 }).fill(0);
const RAYS: number[] = Array.from<number>({ length: 240 }).fill(0);

(function initAttackTables() {
  // Knight
  for (const offset of KNIGHT_OFFSETS_0X88) {
    ATTACKS[offset + DIFF_OFFSET] =
      (ATTACKS[offset + DIFF_OFFSET] ?? 0) | KNIGHT_MASK;
  }

  // King
  for (const offset of KING_OFFSETS_0X88) {
    ATTACKS[offset + DIFF_OFFSET] =
      (ATTACKS[offset + DIFF_OFFSET] ?? 0) | KING_MASK;
  }

  // Pawns — white attacks at offsets -17 and -15 (toward rank 8 = lower index)
  // black attacks at +15 and +17. Both share PAWN_MASK; color checked at use time.
  for (const offset of [15, 17]) {
    ATTACKS[offset + DIFF_OFFSET] =
      (ATTACKS[offset + DIFF_OFFSET] ?? 0) | PAWN_MASK;
    ATTACKS[-offset + DIFF_OFFSET] =
      (ATTACKS[-offset + DIFF_OFFSET] ?? 0) | PAWN_MASK;
  }

  // Sliding pieces — walk every ray from every valid square
  for (let from = 0; from <= 119; from++) {
    if (from & OFF_BOARD) {
      continue;
    }

    for (const direction of ROOK_DIRS_0X88) {
      let to = from + direction;
      while (!(to & OFF_BOARD)) {
        const diff = to - from;
        ATTACKS[diff + DIFF_OFFSET] =
          (ATTACKS[diff + DIFF_OFFSET] ?? 0) | ROOK_MASK;
        RAYS[diff + DIFF_OFFSET] = direction;
        to += direction;
      }
    }

    for (const direction of BISHOP_DIRS_0X88) {
      let to = from + direction;
      while (!(to & OFF_BOARD)) {
        const diff = to - from;
        ATTACKS[diff + DIFF_OFFSET] =
          (ATTACKS[diff + DIFF_OFFSET] ?? 0) | BISHOP_MASK;
        RAYS[diff + DIFF_OFFSET] = direction;
        to += direction;
      }
    }
  }
})();

function enemyColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/**
 * Check if `targetIndex` is attacked by any piece of `attackerColor`.
 * Uses ATTACKS/RAYS lookup tables for O(1) piece-type check + ray blocker scan.
 * Does NOT consider castling (no recursion).
 * @internal
 */
function isSquareAttackedBy(
  board: (Piece | undefined)[],
  targetIndex: number,
  attackerColor: Color,
): boolean {
  for (let index = 0; index <= 119; index++) {
    if (index & OFF_BOARD) {
      continue;
    }

    const piece = board[index];
    if (piece === undefined || piece.color !== attackerColor) {
      continue;
    }

    const diff = index - targetIndex;
    const tableIndex = diff + DIFF_OFFSET;
    const attackMask = ATTACKS[tableIndex] ?? 0;
    if (attackMask === 0) {
      continue;
    }

    const pieceMask = PIECE_MASKS[piece.type];
    if ((attackMask & pieceMask) === 0) {
      continue;
    }

    // Pawn: direction must match attacker color
    // White pawn attacks toward lower indices (attacker index > target index → diff > 0)
    if (piece.type === 'p') {
      if (attackerColor === 'w' && diff <= 0) {
        continue;
      }

      if (attackerColor === 'b' && diff >= 0) {
        continue;
      }

      return true;
    }

    // Knight / King: no blockers
    if (piece.type === 'n' || piece.type === 'k') {
      return true;
    }

    // Sliding piece: walk ray and check for blockers
    // RAYS[diff + DIFF_OFFSET] = d where diff = to - from = d * n (n >= 1) along the ray.
    // Negating gives the step to walk from the attacker toward targetIndex.
    const step = -(RAYS[tableIndex] ?? 0);
    if (step === 0) {
      continue;
    }

    let index_ = index + step;
    while (index_ !== targetIndex) {
      if (index_ & OFF_BOARD || board[index_] !== undefined) {
        break;
      }

      index_ += step;
    }

    if (index_ === targetIndex) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the king of `color` is currently in check on the given raw board.
 * @internal
 */
function isKingInCheck(board: (Piece | undefined)[], color: Color): boolean {
  let kingIndex = -1;
  for (let index = 0; index <= 119; index++) {
    if (index & OFF_BOARD) {
      continue;
    }

    const piece = board[index];
    if (piece !== undefined && piece.type === 'k' && piece.color === color) {
      kingIndex = index;
      break;
    }
  }

  if (kingIndex === -1) {
    return false;
  }

  return isSquareAttackedBy(board, kingIndex, enemyColor(color));
}

function generatePseudoLegalMovesForSquare(
  board: (Piece | undefined)[],
  turn: Color,
  enPassantSquare: Square | undefined,
  castlingRights: CastlingRights,
  square: Square,
): Move[] {
  const fromIndex = squareToIndex(square);
  const piece = board[fromIndex];
  if (piece === undefined || piece.color !== turn) {
    return [];
  }

  const moves: Move[] = [];

  switch (piece.type) {
    case 'p': {
      generatePawnMoves(
        board,
        enPassantSquare,
        fromIndex,
        square,
        piece.color,
        moves,
      );
      break;
    }
    case 'n': {
      generateKnightMoves(board, fromIndex, square, piece.color, moves);
      break;
    }
    case 'b': {
      generateSlidingMoves(
        board,
        fromIndex,
        square,
        piece.color,
        BISHOP_DIRS_0X88,
        moves,
      );
      break;
    }
    case 'r': {
      generateSlidingMoves(
        board,
        fromIndex,
        square,
        piece.color,
        ROOK_DIRS_0X88,
        moves,
      );
      break;
    }
    case 'q': {
      generateSlidingMoves(
        board,
        fromIndex,
        square,
        piece.color,
        BISHOP_DIRS_0X88,
        moves,
      );
      generateSlidingMoves(
        board,
        fromIndex,
        square,
        piece.color,
        ROOK_DIRS_0X88,
        moves,
      );
      break;
    }
    case 'k': {
      generateKingMoves(
        board,
        castlingRights,
        fromIndex,
        square,
        piece.color,
        moves,
      );
      break;
    }
  }

  return moves;
}

function generatePawnMoves(
  board: (Piece | undefined)[],
  enPassantSquare: Square | undefined,
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  const direction = color === 'w' ? -16 : 16;
  const startRow = color === 'w' ? 6 : 1;
  const promoteRow = color === 'w' ? 0 : 7;
  const currentRow = fromIndex >> 4;
  const enemy = enemyColor(color);
  const captureOffsets = color === 'w' ? [-17, -15] : [15, 17];

  // Single push
  const singleIndex = fromIndex + direction;
  if (!(singleIndex & OFF_BOARD) && board[singleIndex] === undefined) {
    const toSquare = indexToSquare(singleIndex);
    const toRow = singleIndex >> 4;
    if (toRow === promoteRow) {
      for (const promo of PROMOTION_PIECES) {
        moves.push({ from: fromSquare, promotion: promo, to: toSquare });
      }
    } else {
      moves.push({ from: fromSquare, promotion: undefined, to: toSquare });
    }

    // Double push
    if (currentRow === startRow) {
      const doubleIndex = fromIndex + direction * 2;
      if (!(doubleIndex & OFF_BOARD) && board[doubleIndex] === undefined) {
        moves.push({
          from: fromSquare,
          promotion: undefined,
          to: indexToSquare(doubleIndex),
        });
      }
    }
  }

  // Diagonal captures + en passant
  for (const capOffset of captureOffsets) {
    const capIndex = fromIndex + capOffset;
    if (capIndex & OFF_BOARD) {
      continue;
    }

    const capSquare = indexToSquare(capIndex);
    const target = board[capIndex];
    const isEnPassant = enPassantSquare === capSquare;

    if ((target !== undefined && target.color === enemy) || isEnPassant) {
      const toRow = capIndex >> 4;
      if (toRow === promoteRow) {
        for (const promo of PROMOTION_PIECES) {
          moves.push({ from: fromSquare, promotion: promo, to: capSquare });
        }
      } else {
        moves.push({ from: fromSquare, promotion: undefined, to: capSquare });
      }
    }
  }
}

function generateKnightMoves(
  board: (Piece | undefined)[],
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  for (const offset of KNIGHT_OFFSETS_0X88) {
    const toIndex = fromIndex + offset;
    if (toIndex & OFF_BOARD) {
      continue;
    }

    const target = board[toIndex];
    if (target === undefined || target.color !== color) {
      moves.push({
        from: fromSquare,
        promotion: undefined,
        to: indexToSquare(toIndex),
      });
    }
  }
}

function generateSlidingMoves(
  board: (Piece | undefined)[],
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  directions: readonly number[],
  moves: Move[],
): void {
  for (const direction of directions) {
    let toIndex = fromIndex + direction;
    while (!(toIndex & OFF_BOARD)) {
      const target = board[toIndex];
      if (target === undefined) {
        moves.push({
          from: fromSquare,
          promotion: undefined,
          to: indexToSquare(toIndex),
        });
      } else if (target.color === color) {
        break;
      } else {
        moves.push({
          from: fromSquare,
          promotion: undefined,
          to: indexToSquare(toIndex),
        });
        break;
      }

      toIndex += direction;
    }
  }
}

function generateKingMoves(
  board: (Piece | undefined)[],
  castlingRights: CastlingRights,
  fromIndex: number,
  fromSquare: Square,
  color: Color,
  moves: Move[],
): void {
  // Normal king moves
  for (const offset of KING_OFFSETS_0X88) {
    const toIndex = fromIndex + offset;
    if (toIndex & OFF_BOARD) {
      continue;
    }

    const target = board[toIndex];
    if (target === undefined || target.color !== color) {
      moves.push({
        from: fromSquare,
        promotion: undefined,
        to: indexToSquare(toIndex),
      });
    }
  }

  // Castling
  // White king is on rank 1 (row 7 in 0x88: index 112..119), black on rank 8 (row 0: index 0..7)
  const kingRow = fromIndex >> 4;
  const expectedRow = color === 'w' ? 7 : 0;
  if (kingRow !== expectedRow) {
    return;
  }

  const enemy = enemyColor(color);

  // Kingside castling
  const canKingside = color === 'w' ? castlingRights.wK : castlingRights.bK;
  if (canKingside) {
    const fIndex = squareToIndex(color === 'w' ? 'f1' : 'f8');
    const gIndex = squareToIndex(color === 'w' ? 'g1' : 'g8');
    if (
      board[fIndex] === undefined &&
      board[gIndex] === undefined &&
      !isSquareAttackedBy(board, fromIndex, enemy) &&
      !isSquareAttackedBy(board, fIndex, enemy) &&
      !isSquareAttackedBy(board, gIndex, enemy)
    ) {
      moves.push({
        from: fromSquare,
        promotion: undefined,
        to: indexToSquare(gIndex),
      });
    }
  }

  // Queenside castling
  const canQueenside = color === 'w' ? castlingRights.wQ : castlingRights.bQ;
  if (canQueenside) {
    const bIndex = squareToIndex(color === 'w' ? 'b1' : 'b8');
    const cIndex = squareToIndex(color === 'w' ? 'c1' : 'c8');
    const dIndex = squareToIndex(color === 'w' ? 'd1' : 'd8');
    if (
      board[bIndex] === undefined &&
      board[cIndex] === undefined &&
      board[dIndex] === undefined &&
      !isSquareAttackedBy(board, fromIndex, enemy) &&
      !isSquareAttackedBy(board, dIndex, enemy) &&
      !isSquareAttackedBy(board, cIndex, enemy)
    ) {
      moves.push({
        from: fromSquare,
        promotion: undefined,
        to: indexToSquare(cIndex),
      });
    }
  }
}

/**
 * Apply a move to a raw 0x88 board array, returning a new board.
 * Used for the legality filter — avoids constructing a Position for every pseudo-legal move.
 * @internal
 */
function applyMoveToBoard(
  board: (Piece | undefined)[],
  m: Move,
  enPassantSquare: Square | undefined,
): (Piece | undefined)[] {
  const result = [...board];
  const fromIndex = squareToIndex(m.from);
  const toIndex = squareToIndex(m.to);
  const piece = result[fromIndex];

  if (piece === undefined) {
    return result;
  }

  const fromRow = fromIndex >> 4;
  const toFile = toIndex & 0x07;
  const isPawn = piece.type === 'p';
  const isKing = piece.type === 'k';
  const fromFile = fromIndex & 0x07;
  const isCapture = result[toIndex] !== undefined;
  const isEnPassant = isPawn && m.to === enPassantSquare && !isCapture;
  const isCastling = isKing && Math.abs(toFile - fromFile) === 2;

  // Move the piece
  result[fromIndex] = undefined;

  // Handle promotion
  result[toIndex] =
    isPawn && m.promotion !== undefined
      ? { color: piece.color, type: m.promotion }
      : piece;

  // Remove en passant captured pawn
  if (isEnPassant) {
    const capturedPawnIndex = (fromRow << 4) | toFile;
    result[capturedPawnIndex] = undefined;
  }

  // Handle castling rook movement
  if (isCastling) {
    const castleRow = piece.color === 'w' ? 7 : 0;
    if (toFile > fromFile) {
      // Kingside: rook moves from h-file (7) to f-file (5)
      const rookFrom = (castleRow << 4) | 7;
      const rookTo = (castleRow << 4) | 5;
      result[rookTo] = result[rookFrom];
      result[rookFrom] = undefined;
    } else {
      // Queenside: rook moves from a-file (0) to d-file (3)
      const rookFrom = castleRow << 4;
      const rookTo = (castleRow << 4) | 3;
      result[rookTo] = result[rookFrom];
      result[rookFrom] = undefined;
    }
  }

  return result;
}

/**
 * Apply a move to a Position, returning a new Position.
 * Does not validate legality — assumes the move is valid.
 */
function move(position: Position, m: Move): Position {
  const board = boardFromMap(position.pieces());
  const fromIndex = squareToIndex(m.from);
  const toIndex = squareToIndex(m.to);
  const piece = board[fromIndex];

  if (piece === undefined) {
    return position;
  }

  const fromRow = fromIndex >> 4;
  const toRow = toIndex >> 4;
  const fromFile = fromIndex & 0x07;
  const toFile = toIndex & 0x07;
  const isCapture = board[toIndex] !== undefined;
  const isPawn = piece.type === 'p';
  const isKing = piece.type === 'k';
  const isRook = piece.type === 'r';

  // Detect en passant capture
  const isEnPassant = isPawn && m.to === position.enPassantSquare && !isCapture;

  // Detect castling (king moves 2 squares horizontally)
  const isCastling = isKing && Math.abs(toFile - fromFile) === 2;

  // Move the piece
  board[fromIndex] = undefined;

  // Handle promotion
  board[toIndex] =
    isPawn && m.promotion !== undefined
      ? { color: piece.color, type: m.promotion }
      : piece;

  // Remove en passant captured pawn
  if (isEnPassant) {
    // The captured pawn is on the same file as toIndex but same row as fromIndex
    const capturedPawnIndex = (fromRow << 4) | toFile;
    board[capturedPawnIndex] = undefined;
  }

  // Handle castling rook movement
  if (isCastling) {
    const castleRow = piece.color === 'w' ? 7 : 0;
    if (toFile > fromFile) {
      // Kingside: rook moves from h-file (7) to f-file (5)
      const rookFrom = (castleRow << 4) | 7;
      const rookTo = (castleRow << 4) | 5;
      board[rookTo] = board[rookFrom];
      board[rookFrom] = undefined;
    } else {
      // Queenside: rook moves from a-file (0) to d-file (3)
      const rookFrom = castleRow << 4;
      const rookTo = (castleRow << 4) | 3;
      board[rookTo] = board[rookFrom];
      board[rookFrom] = undefined;
    }
  }

  // Update castling rights
  let { bK, bQ, wK, wQ } = position.castlingRights;

  if (isKing) {
    if (piece.color === 'w') {
      wK = false;
      wQ = false;
    } else {
      bK = false;
      bQ = false;
    }
  }

  if (isRook) {
    switch (m.from) {
      case 'a1': {
        wQ = false;

        break;
      }
      case 'h1': {
        wK = false;

        break;
      }
      case 'a8': {
        bQ = false;

        break;
      }
      case 'h8': {
        bK = false;

        break;
      }
      // No default
    }
  }

  // Rook captured: remove castling rights
  if (isCapture) {
    switch (m.to) {
      case 'a1': {
        wQ = false;

        break;
      }
      case 'h1': {
        wK = false;

        break;
      }
      case 'a8': {
        bQ = false;

        break;
      }
      case 'h8': {
        bK = false;

        break;
      }
      // No default
    }
  }

  const castlingRights = { bK, bQ, wK, wQ };

  // Update en passant square
  let enPassantSquare: Square | undefined;
  if (isPawn && Math.abs(toRow - fromRow) === 2) {
    const epRow = (fromRow + toRow) >> 1;
    enPassantSquare = indexToSquare((epRow << 4) | fromFile);
  }

  // Update halfmove clock
  const halfmoveClock =
    isPawn || isCapture || isEnPassant ? 0 : position.halfmoveClock + 1;

  // Update fullmove number
  const fullmoveNumber =
    position.turn === 'b'
      ? position.fullmoveNumber + 1
      : position.fullmoveNumber;

  // Switch turn
  const turn: Color = position.turn === 'w' ? 'b' : 'w';

  // Build new Map<Square, Piece> from the updated board
  const newPieces = new Map<Square, Piece>();
  for (let index = 0; index <= 119; index++) {
    if (index & OFF_BOARD) {
      continue;
    }

    const p = board[index];
    if (p !== undefined) {
      newPieces.set(indexToSquare(index), p);
    }
  }

  return new Position(newPieces, {
    castlingRights,
    enPassantSquare,
    fullmoveNumber,
    halfmoveClock,
    turn,
  });
}

/**
 * Generate all legal moves for the active color, optionally filtered by square.
 */
function generateMoves(position: Position, square?: Square): Move[] {
  const board = boardFromMap(position.pieces());
  const { castlingRights, enPassantSquare, turn } = position;
  const pseudoMoves: Move[] = [];

  if (square === undefined) {
    for (let index = 0; index <= 119; index++) {
      if (index & OFF_BOARD) {
        continue;
      }

      const piece = board[index];
      if (piece === undefined || piece.color !== turn) {
        continue;
      }

      const fromSquare = indexToSquare(index);
      pseudoMoves.push(
        ...generatePseudoLegalMovesForSquare(
          board,
          turn,
          enPassantSquare,
          castlingRights,
          fromSquare,
        ),
      );
    }
  } else {
    const fromIndex = squareToIndex(square);
    const piece = board[fromIndex];
    if (piece === undefined || piece.color !== turn) {
      return [];
    }

    pseudoMoves.push(
      ...generatePseudoLegalMovesForSquare(
        board,
        turn,
        enPassantSquare,
        castlingRights,
        square,
      ),
    );
  }

  // Filter out moves that leave the king in check
  const legalMoves: Move[] = [];
  for (const m of pseudoMoves) {
    const nextBoard = applyMoveToBoard(board, m, enPassantSquare);
    if (!isKingInCheck(nextBoard, turn)) {
      legalMoves.push(m);
    }
  }

  return legalMoves;
}

export { generateMoves, isSquareAttackedBy, move };
