import type { CastlingRights, Color, Piece, Square } from './types.js';

export interface FenState {
  board: (Piece | undefined)[];
  castlingRights: CastlingRights;
  enPassantSquare: Square | undefined;
  fullmoveNumber: number;
  halfmoveClock: number;
  turn: Color;
}

export const STARTING_FEN =
  'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function parsePiecePlacement(placement: string): (Piece | undefined)[] {
  const board: (Piece | undefined)[] = Array.from({ length: 64 });
  const ranks = placement.split('/');

  if (ranks.length !== 8) {
    throw new Error(`Invalid FEN piece placement: ${placement}`);
  }

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    // FEN rank 0 = rank 8 on board, rank 7 = rank 1 on board
    const boardRank = 7 - rankIndex;
    const rankString = ranks[rankIndex] ?? '';
    let file = 0;

    for (const char of rankString) {
      const emptyCount = Number.parseInt(char, 10);

      if (Number.isNaN(emptyCount)) {
        // It's a piece character
        const color: Color = char === char.toUpperCase() ? 'w' : 'b';
        const type = char.toLowerCase() as Piece['type'];
        const index = boardRank * 8 + file;
        board[index] = { color, type };
        file += 1;
      } else {
        file += emptyCount;
      }
    }

    if (file !== 8) {
      throw new Error(`Invalid FEN rank: ${rankString}`);
    }
  }

  return board;
}

function serialisePiecePlacement(board: (Piece | undefined)[]): string {
  const ranks: string[] = [];

  for (let rankIndex = 0; rankIndex < 8; rankIndex++) {
    // FEN rank 0 = rank 8 on board
    const boardRank = 7 - rankIndex;
    let rankString = '';
    let emptyCount = 0;

    for (let file = 0; file < 8; file++) {
      const piece = board[boardRank * 8 + file];

      if (piece === undefined) {
        emptyCount += 1;
      } else {
        if (emptyCount > 0) {
          rankString += String(emptyCount);
          emptyCount = 0;
        }

        const char =
          piece.color === 'w'
            ? piece.type.toUpperCase()
            : piece.type.toLowerCase();
        rankString += char;
      }
    }

    if (emptyCount > 0) {
      rankString += String(emptyCount);
    }

    ranks.push(rankString);
  }

  return ranks.join('/');
}

function parseCastlingRights(castling: string): CastlingRights {
  return {
    bK: castling.includes('k'),
    bQ: castling.includes('q'),
    wK: castling.includes('K'),
    wQ: castling.includes('Q'),
  };
}

function serialiseCastlingRights(rights: CastlingRights): string {
  let result = '';

  if (rights.wK) {
    result += 'K';
  }

  if (rights.wQ) {
    result += 'Q';
  }

  if (rights.bK) {
    result += 'k';
  }

  if (rights.bQ) {
    result += 'q';
  }

  return result.length > 0 ? result : '-';
}

export function parseFen(fen: string): FenState {
  const parts = fen.split(' ');

  if (parts.length !== 6) {
    throw new Error(`Invalid FEN string: "${fen}"`);
  }

  const [
    placement,
    turnString,
    castlingString,
    enPassantString,
    halfmoveString,
    fullmoveString,
  ] = parts as [string, string, string, string, string, string];

  if (turnString !== 'w' && turnString !== 'b') {
    throw new Error(`Invalid FEN turn: "${turnString}"`);
  }

  const turn: Color = turnString;
  const board = parsePiecePlacement(placement);
  const castlingRights = parseCastlingRights(castlingString);

  const enPassantSquare: Square | undefined =
    enPassantString === '-' ? undefined : (enPassantString as Square);

  const halfmoveClock = Number.parseInt(halfmoveString, 10);
  const fullmoveNumber = Number.parseInt(fullmoveString, 10);

  if (Number.isNaN(halfmoveClock) || Number.isNaN(fullmoveNumber)) {
    throw new TypeError(
      `Invalid FEN clocks: "${halfmoveString}" "${fullmoveString}"`,
    );
  }

  return {
    board,
    castlingRights,
    enPassantSquare,
    fullmoveNumber,
    halfmoveClock,
    turn,
  };
}

export function serialiseFen(state: FenState): string {
  const placement = serialisePiecePlacement(state.board);
  const castling = serialiseCastlingRights(state.castlingRights);
  const enPassant = state.enPassantSquare ?? '-';

  return [
    placement,
    state.turn,
    castling,
    enPassant,
    String(state.halfmoveClock),
    String(state.fullmoveNumber),
  ].join(' ');
}

// Re-export utilities used in other modules that work with FEN

export { indexToSquare, squareToIndex } from './board.js';
