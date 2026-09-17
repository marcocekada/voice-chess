import type { Move, PieceSymbol, Square } from 'chess.js';

export type PlayerColor = 'white' | 'black';

export type GameStatus =
  | 'active'
  | 'checkmate'
  | 'stalemate'
  | 'threefold_repetition'
  | 'insufficient_material'
  | 'fifty_moves'
  | 'draw'
  | 'resigned';

export type GameResult = '1-0' | '0-1' | '1/2-1/2';

export interface SavedGame {
  id: string;
  createdAt: string;
  updatedAt: string;
  status: GameStatus;
  playerColor: PlayerColor;
  opponentElo: number;
  fen: string;
  pgn: string;
  /** SAN moves from the initial position. */
  moveHistory: string[];
  result?: GameResult;
}

/** A legal move that matches (part of) the user's intent. */
export type CandidateMove = Move;

/**
 * Structured intent produced by the natural-language parser.
 * It never touches the board; the resolver matches it against legal moves.
 */
export type MoveIntent =
  | {
      kind: 'move';
      piece?: PieceSymbol;
      from?: Square;
      fromFile?: string;
      fromRank?: string;
      to?: Square;
      capture?: boolean;
      promotion?: PieceSymbol;
    }
  | {
      /** "take the knight", "capture it with the pawn", "take on e5" */
      kind: 'capture';
      targetPiece?: PieceSymbol;
      targetSquare?: Square;
      withPiece?: PieceSymbol;
      /** pronoun reference ("it", "lo") */
      pronoun?: boolean;
      promotion?: PieceSymbol;
    }
  | { kind: 'castle'; side?: 'k' | 'q' }
  | { kind: 'san'; san: string }
  | { kind: 'promote'; piece: PieceSymbol }
  | {
      /** Answer to a clarification question: "the one on d2", "with the knight" */
      kind: 'clarify';
      square?: Square;
      piece?: PieceSymbol;
      file?: string;
      rank?: string;
    }
  | { kind: 'unknown'; raw: string };

export interface ConversationContext {
  /** Last move played by the opponent (for "take it"). */
  lastOpponentMove: Move | null;
  /** Last move played by the user. */
  lastUserMove: Move | null;
  /** Last piece type the user mentioned. */
  lastMentionedPiece: PieceSymbol | null;
}

export type ResolveResult =
  | { type: 'move'; move: CandidateMove }
  | { type: 'ambiguous'; candidates: CandidateMove[]; question: string }
  | { type: 'error'; message: string };
