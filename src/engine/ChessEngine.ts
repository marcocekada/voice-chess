export interface EngineOptions {
  /** Approximate target strength. */
  elo: number;
  /** Soft time budget for the search. */
  moveTimeMs?: number;
}

/**
 * Abstraction over the opponent engine so the app is never tied to a single
 * implementation (LocalJsEngine today, native Stockfish or a remote engine later).
 * Returns a move in UCI/LAN form, e.g. "e2e4" or "e7e8q".
 */
export interface ChessEngine {
  readonly name: string;
  getBestMove(fen: string, options: EngineOptions): Promise<string>;
  /** Cancel any search in progress (best effort). */
  cancel(): void;
}
