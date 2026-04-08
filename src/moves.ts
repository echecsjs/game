import type { Move, PromotionPieceType } from './types.js';
import type { CastlingRights,
  Color,
  EnPassantSquare,
  Piece,
  Position,
  Square } from '@echecs/position';



const PROMOTION_PIECES: PromotionPieceType[] = [
  'bishop',
  'knight',
  'queen',
  'rook',
];

function enemyColor(color: Color): Color {
  return color === 'white' ? 'black' : 'white';
}

/**
 * Check if a square is attacked by the given color on the given position.
 * For each enemy piece, checks if the target square is in its reach.
 */
function isSquareAttacked(
  position: Position,
  square: Square,
  by: Color,
): boolean {
  for (const [sq, piece] of position.pieces(by)) {
    const targets = position.reach(sq, piece);
    if (targets.includes(square)) {
      return true;
    }
  }

  return false;
}

/**
 * Generate pseudo-legal moves for a piece on a square, excluding castling.
 * Uses `position.reach()` for target squares.
 */
function generatePseudoLegalMoves(position: Position, square: Square): Move[] {
  const piece = position.at(square);
  if (piece === undefined || piece.color !== position.turn) {
    return [];
  }

  const targets = position.reach(square, piece);
  const moves: Move[] = [];

  for (const target of targets) {
    if (piece.type === 'pawn') {
      const rank = target[1];
      const isPromotion = rank === '8' || rank === '1';
      if (isPromotion) {
        for (const promo of PROMOTION_PIECES) {
          moves.push({ from: square, promotion: promo, to: target });
        }
      } else {
        moves.push({ from: square, promotion: undefined, to: target });
      }
    } else {
      moves.push({ from: square, promotion: undefined, to: target });
    }
  }

  return moves;
}

/**
 * Generate castling moves for the active color.
 */
function generateCastlingMoves(position: Position): Move[] {
  const moves: Move[] = [];
  const color = position.turn;
  const enemy = enemyColor(color);
  const rank = color === 'white' ? '1' : '8';
  const kingSquare: Square = `e${rank}` as Square;

  // King must be on e1/e8
  const king = position.at(kingSquare);
  if (king === undefined || king.type !== 'king' || king.color !== color) {
    return moves;
  }

  // King must not be in check
  if (isSquareAttacked(position, kingSquare, enemy)) {
    return moves;
  }

  const rights =
    color === 'white'
      ? position.castlingRights.white
      : position.castlingRights.black;

  // Kingside
  if (rights.king) {
    const fSquare: Square = `f${rank}` as Square;
    const gSquare: Square = `g${rank}` as Square;

    if (
      position.at(fSquare) === undefined &&
      position.at(gSquare) === undefined &&
      !isSquareAttacked(position, fSquare, enemy) &&
      !isSquareAttacked(position, gSquare, enemy)
    ) {
      moves.push({ from: kingSquare, promotion: undefined, to: gSquare });
    }
  }

  // Queenside
  if (rights.queen) {
    const bSquare: Square = `b${rank}` as Square;
    const cSquare: Square = `c${rank}` as Square;
    const dSquare: Square = `d${rank}` as Square;

    if (
      position.at(bSquare) === undefined &&
      position.at(cSquare) === undefined &&
      position.at(dSquare) === undefined &&
      !isSquareAttacked(position, cSquare, enemy) &&
      !isSquareAttacked(position, dSquare, enemy)
    ) {
      moves.push({ from: kingSquare, promotion: undefined, to: cSquare });
    }
  }

  return moves;
}

/**
 * Apply a move to a Position, returning a new Position.
 * Does not validate legality — assumes the move is valid.
 */
function move(position: Position, m: Move): Position {
  const piece = position.at(m.from);
  if (piece === undefined) {
    return position;
  }

  const changes: [Square, Piece | undefined][] = [ [m.from, undefined]];

  // Remove piece from origin

  // Place piece (or promoted piece) on destination
  const movedPiece: Piece =
    piece.type === 'pawn' && m.promotion !== undefined
      ? { color: piece.color, type: m.promotion }
      : piece;
  changes.push([m.to, movedPiece]);

  // En passant capture: remove the captured pawn
  const isCapture = position.at(m.to) !== undefined;
  const isEnPassant =
    piece.type === 'pawn' && m.to === position.enPassantSquare && !isCapture;

  if (isEnPassant) {
    const capturedFile = m.to[0] as string;
    const capturedRank = m.from[1] as string;
    const capturedSquare = `${capturedFile}${capturedRank}` as Square;
    changes.push([capturedSquare, undefined]);
  }

  // Castling: move the rook
  const fromFile = m.from[0];
  const toFile = m.to[0];
  const isCastling =
    piece.type === 'king' &&
    fromFile === 'e' &&
    (toFile === 'g' || toFile === 'c');

  if (isCastling) {
    const rank = m.from[1] as string;
    if (toFile === 'g') {
      // Kingside
      changes.push([`h${rank}` as Square, undefined], [
        `f${rank}` as Square,
        { color: piece.color, type: 'rook' },
      ]);
    } else {
      // Queenside
      changes.push([`a${rank}` as Square, undefined], [
        `d${rank}` as Square,
        { color: piece.color, type: 'rook' },
      ]);
    }
  }

  // Castling rights
  let wK = position.castlingRights.white.king;
  let wQ = position.castlingRights.white.queen;
  let bK = position.castlingRights.black.king;
  let bQ = position.castlingRights.black.queen;

  // King moves: revoke all castling for that side
  if (piece.type === 'king') {
    if (piece.color === 'white') {
      wK = false;
      wQ = false;
    } else {
      bK = false;
      bQ = false;
    }
  }

  // Rook moves: revoke own castling
  if (piece.type === 'rook') {
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

  // Rook captured: revoke opponent castling
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

  const castlingRights: CastlingRights = {
    black: { king: bK, queen: bQ },
    white: { king: wK, queen: wQ },
  };

  // En passant square
  let enPassantSquare: EnPassantSquare | undefined;
  if (piece.type === 'pawn') {
    const fromRank = m.from[1];
    const toRank = m.to[1];
    const rankDiff = Math.abs(Number(toRank) - Number(fromRank));
    if (rankDiff === 2) {
      const epRank = piece.color === 'white' ? '3' : '6';
      enPassantSquare = `${m.from[0]}${epRank}` as EnPassantSquare;
    }
  }

  // Clocks
  const halfmoveClock =
    piece.type === 'pawn' || isCapture || isEnPassant
      ? 0
      : position.halfmoveClock + 1;

  const fullmoveNumber =
    position.turn === 'black'
      ? position.fullmoveNumber + 1
      : position.fullmoveNumber;

  const turn = enemyColor(position.turn);

  return position.derive({
    castlingRights,
    changes,
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
  const pseudoMoves: Move[] = [];

  if (square === undefined) {
    for (const [sq] of position.pieces(position.turn)) {
      pseudoMoves.push(...generatePseudoLegalMoves(position, sq));
    }

    pseudoMoves.push(...generateCastlingMoves(position));
  } else {
    const piece = position.at(square);
    if (piece === undefined || piece.color !== position.turn) {
      return [];
    }

    pseudoMoves.push(...generatePseudoLegalMoves(position, square));

    // Include castling if querying the king square
    if (piece.type === 'king') {
      pseudoMoves.push(...generateCastlingMoves(position));
    }
  }

  // Filter: discard moves that leave own king in check
  // After move(), turn has flipped. We need to check if the side that
  // just moved left their king in check. Build a temp position with
  // the original turn to use isCheck.
  const legalMoves: Move[] = [];
  for (const m of pseudoMoves) {
    const nextPosition = move(position, m);
    const checkPosition = nextPosition.derive({ turn: position.turn });
    if (!checkPosition.isCheck) {
      legalMoves.push(m);
    }
  }

  return legalMoves;
}

export { generateMoves, move };
