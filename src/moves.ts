import { cloneBoard, fileOf, indexToSquare, rankOf, squareToIndex } from './board.js';

import type { FenState } from './fen.js';
import type { Color, Move, Piece, PromotionPieceType, Square } from './types.js';

const PROMOTION_PIECES: PromotionPieceType[] = ['b', 'n', 'q', 'r'];

// Knight move offsets as [rankDelta, fileDelta]
const KNIGHT_OFFSETS: [number, number][] = [
  [-2, -1],
  [-2, 1],
  [-1, -2],
  [-1, 2],
  [1, -2],
  [1, 2],
  [2, -1],
  [2, 1],
];

// Bishop ray directions [rankDelta, fileDelta]
const BISHOP_RAYS: [number, number][] = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];

// Rook ray directions [rankDelta, fileDelta]
const ROOK_RAYS: [number, number][] = [
  [-1, 0],
  [0, -1],
  [0, 1],
  [1, 0],
];

// King move offsets [rankDelta, fileDelta]
const KING_OFFSETS: [number, number][] = [
  [-1, -1],
  [-1, 0],
  [-1, 1],
  [0, -1],
  [0, 1],
  [1, -1],
  [1, 0],
  [1, 1],
];

function squareRank(square: Square): number {
  return rankOf(square);
}

function squareFile(square: Square): number {
  return fileOf(square);
}

function makeSquare(rank: number, file: number): Square | undefined {
  if (rank < 1 || rank > 8 || file < 1 || file > 8) {
    return undefined;
  }

  return indexToSquare((rank - 1) * 8 + (file - 1));
}

function getPiece(board: (Piece | undefined)[], square: Square): Piece | undefined {
  return board[squareToIndex(square)];
}

function enemyColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

/**
 * Generate pseudo-legal attack moves for a single piece at `square`,
 * treating the piece as belonging to `attackerColor`.
 * This is used for check detection and does NOT include castling
 * (to avoid infinite recursion).
 */
function generateAttackMovesForSquare(
  board: (Piece | undefined)[],
  square: Square,
  attackerColor: Color,
): Square[] {
  const piece = getPiece(board, square);
  if (piece === undefined || piece.color !== attackerColor) {
    return [];
  }

  const rank = squareRank(square);
  const file = squareFile(square);
  const targets: Square[] = [];

  switch (piece.type) {
    case 'p': {
      collectPawnAttacks(rank, file, attackerColor, targets);
      break;
    }
    case 'n': {
      collectKnightAttacks(rank, file, attackerColor, board, targets);
      break;
    }
    case 'b': {
      collectSlidingAttacks(rank, file, attackerColor, board, BISHOP_RAYS, targets);
      break;
    }
    case 'r': {
      collectSlidingAttacks(rank, file, attackerColor, board, ROOK_RAYS, targets);
      break;
    }
    case 'q': {
      collectSlidingAttacks(rank, file, attackerColor, board, BISHOP_RAYS, targets);
      collectSlidingAttacks(rank, file, attackerColor, board, ROOK_RAYS, targets);
      break;
    }
    case 'k': {
      // King attacks all adjacent squares (no castling in attack check)
      for (const [rankDelta, fileDelta] of KING_OFFSETS) {
        const targetSquare = makeSquare(rank + rankDelta, file + fileDelta);
        if (targetSquare === undefined) {
          continue;
        }

        const target = getPiece(board, targetSquare);
        if (target === undefined || target.color !== attackerColor) {
          targets.push(targetSquare);
        }
      }

      break;
    }
  }

  return targets;
}

function collectPawnAttacks(
  rank: number,
  file: number,
  color: Color,
  targets: Square[],
): void {
  const direction = color === 'w' ? 1 : -1;
  const captureRank = rank + direction;

  for (const fileDelta of [-1, 1]) {
    const captureSquare = makeSquare(captureRank, file + fileDelta);
    if (captureSquare !== undefined) {
      targets.push(captureSquare);
    }
  }
}

function collectKnightAttacks(
  rank: number,
  file: number,
  color: Color,
  board: (Piece | undefined)[],
  targets: Square[],
): void {
  for (const [rankDelta, fileDelta] of KNIGHT_OFFSETS) {
    const targetSquare = makeSquare(rank + rankDelta, file + fileDelta);
    if (targetSquare === undefined) {
      continue;
    }

    const target = getPiece(board, targetSquare);
    if (target === undefined || target.color !== color) {
      targets.push(targetSquare);
    }
  }
}

function collectSlidingAttacks(
  rank: number,
  file: number,
  color: Color,
  board: (Piece | undefined)[],
  rays: [number, number][],
  targets: Square[],
): void {
  for (const [rankDelta, fileDelta] of rays) {
    let currentRank = rank + rankDelta;
    let currentFile = file + fileDelta;

    while (currentRank >= 1 && currentRank <= 8 && currentFile >= 1 && currentFile <= 8) {
      const targetSquare = makeSquare(currentRank, currentFile);
      if (targetSquare === undefined) {
        break;
      }

      const target = getPiece(board, targetSquare);
      if (target === undefined) {
        targets.push(targetSquare);
      } else if (target.color === color) {
        break;
      } else {
        targets.push(targetSquare);
        break;
      }

      currentRank += rankDelta;
      currentFile += fileDelta;
    }
  }
}

/**
 * Check if `square` is attacked by any piece of `attackerColor`.
 * Does NOT consider castling (no recursion).
 */
function isSquareAttackedBy(
  board: (Piece | undefined)[],
  square: Square,
  attackerColor: Color,
): boolean {
  for (let index = 0; index < 64; index++) {
    const piece = board[index];
    if (piece === undefined || piece.color !== attackerColor) {
      continue;
    }

    const fromSquare = indexToSquare(index);
    const attacks = generateAttackMovesForSquare(board, fromSquare, attackerColor);
    if (attacks.includes(square)) {
      return true;
    }
  }

  return false;
}

/**
 * Check if the king of `color` is currently in check.
 */
export function isInCheck(state: FenState, color: Color): boolean {
  // Find the king
  let kingSquare: Square | undefined;
  for (let index = 0; index < 64; index++) {
    const piece = state.board[index];
    if (piece !== undefined && piece.type === 'k' && piece.color === color) {
      kingSquare = indexToSquare(index);
      break;
    }
  }

  if (kingSquare === undefined) {
    return false;
  }

  return isSquareAttackedBy(state.board, kingSquare, enemyColor(color));
}

function generatePseudoLegalMovesForSquare(
  state: FenState,
  square: Square,
): Move[] {
  const piece = getPiece(state.board, square);
  if (piece === undefined || piece.color !== state.turn) {
    return [];
  }

  const rank = squareRank(square);
  const file = squareFile(square);
  const moves: Move[] = [];

  switch (piece.type) {
    case 'p': {
      generatePawnMoves(state, square, rank, file, piece.color, moves);
      break;
    }
    case 'n': {
      generateKnightMoves(state, square, rank, file, piece.color, moves);
      break;
    }
    case 'b': {
      generateSlidingMoves(state, square, rank, file, piece.color, BISHOP_RAYS, moves);
      break;
    }
    case 'r': {
      generateSlidingMoves(state, square, rank, file, piece.color, ROOK_RAYS, moves);
      break;
    }
    case 'q': {
      generateSlidingMoves(state, square, rank, file, piece.color, BISHOP_RAYS, moves);
      generateSlidingMoves(state, square, rank, file, piece.color, ROOK_RAYS, moves);
      break;
    }
    case 'k': {
      generateKingMoves(state, square, rank, file, piece.color, moves);
      break;
    }
  }

  return moves;
}

function generatePawnMoves(
  state: FenState,
  square: Square,
  rank: number,
  file: number,
  color: Color,
  moves: Move[],
): void {
  const direction = color === 'w' ? 1 : -1;
  const startRank = color === 'w' ? 2 : 7;
  const promoteRank = color === 'w' ? 8 : 1;
  const enemy = enemyColor(color);

  // Single push
  const singlePushRank = rank + direction;
  const singlePushSquare = makeSquare(singlePushRank, file);
  if (singlePushSquare !== undefined) {
    const singlePushOccupant = getPiece(state.board, singlePushSquare);
    // Pawn can push forward only if the square is empty
    if (singlePushOccupant === undefined) {
      if (singlePushRank === promoteRank) {
        for (const promo of PROMOTION_PIECES) {
          moves.push({ from: square, promotion: promo, to: singlePushSquare });
        }
      } else {
        moves.push({ from: square, to: singlePushSquare });
      }

      // Double push (only possible if single push square is empty — not just passable)
      if (rank === startRank && singlePushOccupant === undefined) {
        const doublePushRank = rank + direction * 2;
        const doublePushSquare = makeSquare(doublePushRank, file);
        if (doublePushSquare !== undefined && getPiece(state.board, doublePushSquare) === undefined) {
          moves.push({ from: square, to: doublePushSquare });
        }
      }
    }
  }

  // Diagonal captures
  for (const fileDelta of [-1, 1]) {
    const captureRank = rank + direction;
    const captureFile = file + fileDelta;
    const captureSquare = makeSquare(captureRank, captureFile);
    if (captureSquare === undefined) {
      continue;
    }

    const target = getPiece(state.board, captureSquare);
    const isEnPassant = state.enPassantSquare === captureSquare;

    if ((target !== undefined && target.color === enemy) || isEnPassant) {
      if (captureRank === promoteRank) {
        for (const promo of PROMOTION_PIECES) {
          moves.push({ from: square, promotion: promo, to: captureSquare });
        }
      } else {
        moves.push({ from: square, to: captureSquare });
      }
    }
  }
}

function generateKnightMoves(
  state: FenState,
  square: Square,
  rank: number,
  file: number,
  color: Color,
  moves: Move[],
): void {
  for (const [rankDelta, fileDelta] of KNIGHT_OFFSETS) {
    const targetSquare = makeSquare(rank + rankDelta, file + fileDelta);
    if (targetSquare === undefined) {
      continue;
    }

    const target = getPiece(state.board, targetSquare);
    if (target === undefined || target.color !== color) {
      moves.push({ from: square, to: targetSquare });
    }
  }
}

function generateSlidingMoves(
  state: FenState,
  square: Square,
  rank: number,
  file: number,
  color: Color,
  rays: [number, number][],
  moves: Move[],
): void {
  for (const [rankDelta, fileDelta] of rays) {
    let currentRank = rank + rankDelta;
    let currentFile = file + fileDelta;

    while (currentRank >= 1 && currentRank <= 8 && currentFile >= 1 && currentFile <= 8) {
      const targetSquare = makeSquare(currentRank, currentFile);
      if (targetSquare === undefined) {
        break;
      }

      const target = getPiece(state.board, targetSquare);
      if (target === undefined) {
        moves.push({ from: square, to: targetSquare });
      } else if (target.color === color) {
        break;
      } else {
        moves.push({ from: square, to: targetSquare });
        break;
      }

      currentRank += rankDelta;
      currentFile += fileDelta;
    }
  }
}

function generateKingMoves(
  state: FenState,
  square: Square,
  rank: number,
  file: number,
  color: Color,
  moves: Move[],
): void {
  // Normal king moves
  for (const [rankDelta, fileDelta] of KING_OFFSETS) {
    const targetSquare = makeSquare(rank + rankDelta, file + fileDelta);
    if (targetSquare === undefined) {
      continue;
    }

    const target = getPiece(state.board, targetSquare);
    if (target === undefined || target.color !== color) {
      moves.push({ from: square, to: targetSquare });
    }
  }

  // Castling
  const kingRank = color === 'w' ? 1 : 8;
  if (rank !== kingRank) {
    return;
  }

  const { castlingRights } = state;
  const enemy = enemyColor(color);

  // Kingside castling
  const canKingside = color === 'w' ? castlingRights.wK : castlingRights.bK;
  if (canKingside) {
    const f = makeSquare(kingRank, 6); // f1 or f8
    const g = makeSquare(kingRank, 7); // g1 or g8
    if (
      f !== undefined &&
      g !== undefined &&
      getPiece(state.board, f) === undefined &&
      getPiece(state.board, g) === undefined &&
      !isSquareAttackedBy(state.board, square, enemy) &&
      !isSquareAttackedBy(state.board, f, enemy) &&
      !isSquareAttackedBy(state.board, g, enemy)
    ) {
      moves.push({ from: square, to: g });
    }
  }

  // Queenside castling
  const canQueenside = color === 'w' ? castlingRights.wQ : castlingRights.bQ;
  if (canQueenside) {
    const b = makeSquare(kingRank, 2); // b1 or b8
    const c = makeSquare(kingRank, 3); // c1 or c8
    const d = makeSquare(kingRank, 4); // d1 or d8
    if (
      b !== undefined &&
      c !== undefined &&
      d !== undefined &&
      getPiece(state.board, b) === undefined &&
      getPiece(state.board, c) === undefined &&
      getPiece(state.board, d) === undefined &&
      !isSquareAttackedBy(state.board, square, enemy) &&
      !isSquareAttackedBy(state.board, d, enemy) &&
      !isSquareAttackedBy(state.board, c, enemy)
    ) {
      moves.push({ from: square, to: c });
    }
  }
}

/**
 * Apply a move to a FenState, returning a new FenState.
 * Does not validate legality — assumes the move is valid.
 */
export function applyMoveToState(state: FenState, move: Move): FenState {
  const board = cloneBoard(state.board);
  const fromIndex = squareToIndex(move.from);
  const toIndex = squareToIndex(move.to);
  const piece = board[fromIndex];

  if (piece === undefined) {
    return state;
  }

  const fromRank = squareRank(move.from);
  const toRank = squareRank(move.to);
  const fromFile = squareFile(move.from);
  const toFile = squareFile(move.to);
  const isCapture = board[toIndex] !== undefined;
  const isPawn = piece.type === 'p';
  const isKing = piece.type === 'k';
  const isRook = piece.type === 'r';

  // Detect en passant capture
  const isEnPassant =
    isPawn && move.to === state.enPassantSquare && !isCapture;

  // Detect castling (king moves 2 squares horizontally)
  const isCastling = isKing && Math.abs(toFile - fromFile) === 2;

  // Move the piece
  board[fromIndex] = undefined;

  // Handle promotion
  board[toIndex] = isPawn && move.promotion !== undefined ? { color: piece.color, type: move.promotion } : piece;

  // Remove en passant captured pawn
  if (isEnPassant) {
    const capturedPawnRank = piece.color === 'w' ? toRank - 1 : toRank + 1;
    const capturedPawnSquare = makeSquare(capturedPawnRank, toFile);
    if (capturedPawnSquare !== undefined) {
      board[squareToIndex(capturedPawnSquare)] = undefined;
    }
  }

  // Handle castling rook movement
  if (isCastling) {
    const castleRank = piece.color === 'w' ? 1 : 8;
    if (toFile > fromFile) {
      // Kingside: rook moves from h-file to f-file
      const rookFrom = makeSquare(castleRank, 8);
      const rookTo = makeSquare(castleRank, 6);
      if (rookFrom !== undefined && rookTo !== undefined) {
        board[squareToIndex(rookTo)] = board[squareToIndex(rookFrom)];
        board[squareToIndex(rookFrom)] = undefined;
      }
    } else {
      // Queenside: rook moves from a-file to d-file
      const rookFrom = makeSquare(castleRank, 1);
      const rookTo = makeSquare(castleRank, 4);
      if (rookFrom !== undefined && rookTo !== undefined) {
        board[squareToIndex(rookTo)] = board[squareToIndex(rookFrom)];
        board[squareToIndex(rookFrom)] = undefined;
      }
    }
  }

  // Update castling rights
  let { bK, bQ, wK, wQ } = state.castlingRights;

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
    switch (move.from) {
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
    switch (move.to) {
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
  if (isPawn && Math.abs(toRank - fromRank) === 2) {
    const epRank = piece.color === 'w' ? fromRank + 1 : fromRank - 1;
    enPassantSquare = makeSquare(epRank, fromFile);
  }

  // Update halfmove clock
  const halfmoveClock = isPawn || isCapture || isEnPassant ? 0 : state.halfmoveClock + 1;

  // Update fullmove number
  const fullmoveNumber =
    state.turn === 'b' ? state.fullmoveNumber + 1 : state.fullmoveNumber;

  // Switch turn
  const turn: Color = state.turn === 'w' ? 'b' : 'w';

  return {
    board,
    castlingRights,
    enPassantSquare,
    fullmoveNumber,
    halfmoveClock,
    turn,
  };
}

/**
 * Generate all legal moves for the active color, optionally filtered by square.
 */
export function generateMoves(state: FenState, square?: Square): Move[] {
  const pseudoMoves: Move[] = [];

  if (square === undefined) {
    for (let index = 0; index < 64; index++) {
      const piece = state.board[index];
      if (piece === undefined || piece.color !== state.turn) {
        continue;
      }

      const fromSquare = indexToSquare(index);
      pseudoMoves.push(...generatePseudoLegalMovesForSquare(state, fromSquare));
    }
  } else {
    const piece = getPiece(state.board, square);
    if (piece === undefined || piece.color !== state.turn) {
      return [];
    }

    pseudoMoves.push(...generatePseudoLegalMovesForSquare(state, square));
  }

  // Filter out moves that leave the king in check
  const legalMoves: Move[] = [];
  for (const move of pseudoMoves) {
    const next = applyMoveToState(state, move);
    if (!isInCheck(next, state.turn)) {
      legalMoves.push(move);
    }
  }

  return legalMoves;
}
