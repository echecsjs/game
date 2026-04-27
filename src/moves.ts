import type { Move, MoveResult, PromotionPieceType } from './types.js';
import type {
  CastlingRights,
  Color,
  EnPassantSquare,
  Piece,
  Position,
  Square,
} from '@echecs/position';

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
 * Check if the king would be in check on the given square. Derives a
 * position with the king moved there and reuses Position.isCheck.
 */
function isKingAttackedOn(
  position: Position,
  kingSquare: Square,
  targetSquare: Square,
): boolean {
  const king = position.at(kingSquare);
  if (king === undefined) {
    return false;
  }

  const test = position.derive({
    changes: [
      [kingSquare, undefined],
      [targetSquare, king],
    ],
  });

  return test.isCheck;
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
        moves.push({ from: square, to: target });
      }
    } else {
      moves.push({ from: square, to: target });
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
  const rank = color === 'white' ? '1' : '8';
  const kingSquare: Square = `e${rank}` as Square;

  // King must be on e1/e8
  const king = position.at(kingSquare);
  if (king === undefined || king.type !== 'king' || king.color !== color) {
    return moves;
  }

  // King must not be in check
  if (position.isCheck) {
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
      !isKingAttackedOn(position, kingSquare, fSquare) &&
      !isKingAttackedOn(position, kingSquare, gSquare)
    ) {
      moves.push({ from: kingSquare, to: gSquare });
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
      !isKingAttackedOn(position, kingSquare, cSquare) &&
      !isKingAttackedOn(position, kingSquare, dSquare)
    ) {
      moves.push({ from: kingSquare, to: cSquare });
    }
  }

  return moves;
}

/**
 * Compute only the board changes for a move (piece movement, en passant pawn
 * removal, castling rook relocation). Does not touch castling rights, clocks,
 * or turn. Used by the legality filter to avoid a full double-derive.
 */
function boardChanges(
  position: Position,
  m: Move,
): [Square, Piece | undefined][] {
  const piece = position.at(m.from);
  if (piece === undefined) {
    return [];
  }

  const changes: [Square, Piece | undefined][] = [[m.from, undefined]];

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
      changes.push(
        [`h${rank}` as Square, undefined],
        [`f${rank}` as Square, { color: piece.color, type: 'rook' }],
      );
    } else {
      // Queenside
      changes.push(
        [`a${rank}` as Square, undefined],
        [`d${rank}` as Square, { color: piece.color, type: 'rook' }],
      );
    }
  }

  return changes;
}

/**
 * Apply a move to a Position, returning the new Position and a MoveResult.
 * Does not validate legality — assumes the move is valid.
 */
function move(
  position: Position,
  m: Move,
): { position: Position; result: MoveResult } {
  const piece = position.at(m.from);
  if (piece === undefined) {
    return {
      position,
      result: {
        from: m.from,
        piece: { color: 'white', type: 'pawn' },
        to: m.to,
      },
    };
  }

  const changes = boardChanges(position, m);

  const isCapture = position.at(m.to) !== undefined;
  const isEnPassant =
    piece.type === 'pawn' && m.to === position.enPassantSquare && !isCapture;

  // Castling detection
  const fromFile = m.from[0];
  const toFile = m.to[0];
  const isCastling =
    piece.type === 'king' &&
    fromFile === 'e' &&
    (toFile === 'g' || toFile === 'c');

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

  const newPosition = position.derive({
    castlingRights,
    changes,
    enPassantSquare,
    fullmoveNumber,
    halfmoveClock,
    turn,
  });

  // Build MoveResult
  const result: MoveResult = { from: m.from, piece, to: m.to };

  if (isEnPassant) {
    const capturedFile = m.to[0] as string;
    const capturedRank = m.from[1] as string;
    const capturedSquare = `${capturedFile}${capturedRank}` as Square;
    const capturedPiece = position.at(capturedSquare);
    if (capturedPiece !== undefined) {
      result.captured = { piece: capturedPiece, square: capturedSquare };
    }
  } else if (isCapture) {
    const capturedPiece = position.at(m.to);
    if (capturedPiece !== undefined) {
      result.captured = { piece: capturedPiece, square: m.to };
    }
  }

  if (piece.type === 'pawn' && m.promotion !== undefined) {
    result.promotion = { color: piece.color, type: m.promotion };
  }

  if (isCastling) {
    const rank = m.from[1] as string;
    result.castling =
      toFile === 'g'
        ? {
            from: `h${rank}` as Square,
            piece: { color: piece.color, type: 'rook' },
            to: `f${rank}` as Square,
          }
        : {
            from: `a${rank}` as Square,
            piece: { color: piece.color, type: 'rook' },
            to: `d${rank}` as Square,
          };
  }

  return { position: newPosition, result };
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

  // Filter: discard moves that leave own king in check.
  // Apply only board changes (no turn flip), then check isCheck directly
  // against the moving side — eliminates the double-derive overhead.
  const legalMoves: Move[] = [];
  for (const m of pseudoMoves) {
    const changes = boardChanges(position, m);
    const testPosition = position.derive({ changes });
    if (!testPosition.isCheck) {
      legalMoves.push(m);
    }
  }

  return legalMoves;
}

export { generateMoves, move };
