import type { ChessEngine, EngineOptions } from './ChessEngine';
import { LocalJsEngine } from './LocalJsEngine';
import { STOCKFISH_MIN_ELO, StockfishWebViewEngine, stockfishBridge } from './StockfishWebViewEngine';

/**
 * Picks the engine for a given strength:
 *  - Stockfish (WASM, real UCI_Elo limitation) from 1320 Elo upwards
 *  - LocalJsEngine (shallow search + noise) below, or whenever Stockfish is not
 *    available (web preview, WebView failure), so a game can always continue.
 */

const local = new LocalJsEngine();
const stockfish = new StockfishWebViewEngine();

export interface EngineChoice {
  engine: ChessEngine;
  /** true when the requested strength could not be honoured. */
  degraded: boolean;
}

export async function pickEngine(elo: number, waitMs = 6000): Promise<EngineChoice> {
  if (elo < STOCKFISH_MIN_ELO) return { engine: local, degraded: false };
  const ready = await stockfishBridge.whenReady(waitMs);
  if (ready) return { engine: stockfish, degraded: false };
  return { engine: local, degraded: true };
}

export async function getBestMove(fen: string, options: EngineOptions): Promise<{ uci: string; engine: string; degraded: boolean }> {
  const choice = await pickEngine(options.elo);
  try {
    const uci = await choice.engine.getBestMove(fen, options);
    return { uci, engine: choice.engine.name, degraded: choice.degraded };
  } catch (err) {
    if (choice.engine === stockfish && !(err instanceof Error && err.message === 'cancelled')) {
      // Stockfish hiccup: never leave the player without an opponent move.
      const uci = await local.getBestMove(fen, options);
      return { uci, engine: local.name, degraded: true };
    }
    throw err;
  }
}

export function cancelSearch(): void {
  local.cancel();
  stockfish.cancel();
}

export { StockfishHost } from './StockfishWebViewEngine';
