import { Chess, type Move, type Color } from 'chess.js';
import type { GameResult, GameStatus, PlayerColor, SavedGame } from './types';
import type { Translations } from '../i18n/it';

/**
 * chess.js is the single source of truth for the rules. These helpers only
 * derive app-level status/result from it and build/restore SavedGame records.
 */

export function deriveStatus(chess: Chess): GameStatus {
  if (chess.isCheckmate()) return 'checkmate';
  if (chess.isStalemate()) return 'stalemate';
  if (chess.isThreefoldRepetition()) return 'threefold_repetition';
  if (chess.isInsufficientMaterial()) return 'insufficient_material';
  if (chess.isDrawByFiftyMoves()) return 'fifty_moves';
  if (chess.isDraw()) return 'draw';
  return 'active';
}

export function deriveResult(chess: Chess, status: GameStatus, playerColor: PlayerColor): GameResult | undefined {
  switch (status) {
    case 'active':
      return undefined;
    case 'checkmate':
      // side to move is mated
      return chess.turn() === 'w' ? '0-1' : '1-0';
    case 'resigned':
      return playerColor === 'white' ? '0-1' : '1-0';
    default:
      return '1/2-1/2';
  }
}

export function playerWon(game: Pick<SavedGame, 'result' | 'playerColor'>): boolean | null {
  if (!game.result || game.result === '1/2-1/2') return null;
  return (game.result === '1-0') === (game.playerColor === 'white');
}

export function colorToChess(color: PlayerColor): Color {
  return color === 'white' ? 'w' : 'b';
}

export function isPlayerTurn(chess: Chess, playerColor: PlayerColor): boolean {
  return chess.turn() === colorToChess(playerColor);
}

export function buildSavedGame(
  base: Pick<SavedGame, 'id' | 'createdAt' | 'playerColor' | 'opponentElo'>,
  chess: Chess,
  statusOverride?: GameStatus,
): SavedGame {
  const status = statusOverride ?? deriveStatus(chess);
  return {
    ...base,
    updatedAt: new Date().toISOString(),
    status,
    fen: chess.fen(),
    pgn: chess.pgn(),
    moveHistory: chess.history(),
    result: deriveResult(chess, status, base.playerColor),
  };
}

/**
 * Rebuild a game by replaying its move history, then verify that the
 * resulting FEN matches the saved FEN. Falls back to loading the FEN alone
 * if the history is corrupted (history-dependent rules may then be off).
 */
export function restoreChess(saved: SavedGame): { chess: Chess; consistent: boolean } {
  const chess = new Chess();
  let consistent = true;
  try {
    for (const san of saved.moveHistory) chess.move(san);
    if (chess.fen() !== saved.fen) {
      // Allow a mismatch on move counters only (older saves) but not on the position itself.
      const a = chess.fen().split(' ').slice(0, 4).join(' ');
      const b = saved.fen.split(' ').slice(0, 4).join(' ');
      consistent = a === b;
    }
  } catch {
    consistent = false;
  }
  if (!consistent) {
    const fallback = new Chess();
    try {
      fallback.load(saved.fen);
      return { chess: fallback, consistent: false };
    } catch {
      return { chess: new Chess(), consistent: false };
    }
  }
  return { chess, consistent: true };
}

/** Human-readable move description, e.g. "knight to f3", "pawn takes e5". */
export function describeMove(move: Move, t: Translations): string {
  if (move.isKingsideCastle()) return t.feedback.castleShort;
  if (move.isQueensideCastle()) return t.feedback.castleLong;
  const piece = t.pieces[move.piece];
  const verb = move.captured ? t.feedback.captures : t.feedback.on;
  let text = `${piece} ${verb} ${move.to}`;
  if (move.promotion) text += ` ${t.feedback.promotesTo} ${t.pieces[move.promotion]}`;
  return text;
}

export function colorName(color: Color, t: Translations): string {
  return color === 'w' ? t.common.white : t.common.black;
}

export function fullMoveCount(moveHistory: string[]): number {
  return Math.ceil(moveHistory.length / 2);
}
