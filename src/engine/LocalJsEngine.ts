import { Chess, type Move, type PieceSymbol } from 'chess.js';
import type { ChessEngine, EngineOptions } from './ChessEngine';

/**
 * Pure-JavaScript alpha-beta engine built on chess.js move generation.
 * Runs inside Expo Go with no native code. Strength is limited in the same
 * spirit as Stockfish's "Skill Level": shallower search plus evaluation noise
 * at low Elo, deeper search with quiescence and no noise at high Elo.
 *
 * Not a strong engine (no transposition table, no opening book) but honest:
 * every move it plays is a legal move chosen by search, never a random blunder.
 */

const INF = 1_000_000;
const MATE = 100_000;

const VALUES: Record<PieceSymbol, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0,
};

// Piece-square tables from white's point of view, index 0 = a8 … 63 = h1.
// (Simplified Evaluation Function, T. Michniewski.)
// prettier-ignore
const PST: Record<PieceSymbol, number[]> = {
  p: [
     0,  0,  0,  0,  0,  0,  0,  0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
     5,  5, 10, 25, 25, 10,  5,  5,
     0,  0,  0, 20, 20,  0,  0,  0,
     5, -5,-10,  0,  0,-10, -5,  5,
     5, 10, 10,-20,-20, 10, 10,  5,
     0,  0,  0,  0,  0,  0,  0,  0,
  ],
  n: [
    -50,-40,-30,-30,-30,-30,-40,-50,
    -40,-20,  0,  0,  0,  0,-20,-40,
    -30,  0, 10, 15, 15, 10,  0,-30,
    -30,  5, 15, 20, 20, 15,  5,-30,
    -30,  0, 15, 20, 20, 15,  0,-30,
    -30,  5, 10, 15, 15, 10,  5,-30,
    -40,-20,  0,  5,  5,  0,-20,-40,
    -50,-40,-30,-30,-30,-30,-40,-50,
  ],
  b: [
    -20,-10,-10,-10,-10,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5, 10, 10,  5,  0,-10,
    -10,  5,  5, 10, 10,  5,  5,-10,
    -10,  0, 10, 10, 10, 10,  0,-10,
    -10, 10, 10, 10, 10, 10, 10,-10,
    -10,  5,  0,  0,  0,  0,  5,-10,
    -20,-10,-10,-10,-10,-10,-10,-20,
  ],
  r: [
     0,  0,  0,  0,  0,  0,  0,  0,
     5, 10, 10, 10, 10, 10, 10,  5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
    -5,  0,  0,  0,  0,  0,  0, -5,
     0,  0,  0,  5,  5,  0,  0,  0,
  ],
  q: [
    -20,-10,-10, -5, -5,-10,-10,-20,
    -10,  0,  0,  0,  0,  0,  0,-10,
    -10,  0,  5,  5,  5,  5,  0,-10,
     -5,  0,  5,  5,  5,  5,  0, -5,
      0,  0,  5,  5,  5,  5,  0, -5,
    -10,  5,  5,  5,  5,  5,  0,-10,
    -10,  0,  5,  0,  0,  0,  0,-10,
    -20,-10,-10, -5, -5,-10,-10,-20,
  ],
  k: [
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -30,-40,-40,-50,-50,-40,-40,-30,
    -20,-30,-30,-40,-40,-30,-30,-20,
    -10,-20,-20,-20,-20,-20,-20,-10,
     20, 20,  0,  0,  0,  0, 20, 20,
     20, 30, 10,  0,  0, 10, 30, 20,
  ],
};

// prettier-ignore
const KING_ENDGAME: number[] = [
  -50,-40,-30,-20,-20,-30,-40,-50,
  -30,-20,-10,  0,  0,-10,-20,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 30, 40, 40, 30,-10,-30,
  -30,-10, 20, 30, 30, 20,-10,-30,
  -30,-30,  0,  0,  0,  0,-30,-30,
  -50,-30,-30,-30,-30,-30,-30,-50,
];

interface StrengthProfile {
  maxDepth: number;
  moveTimeMs: number;
  /** Standard deviation (centipawns) of noise added to root scores. */
  noise: number;
  quiescence: boolean;
}

export function profileForElo(elo: number): StrengthProfile {
  const e = Math.max(200, Math.min(3400, elo));
  const noise = Math.max(0, (2000 - e) * 0.15);
  if (e < 700) return { maxDepth: 1, moveTimeMs: 400, noise, quiescence: false };
  if (e < 1100) return { maxDepth: 2, moveTimeMs: 600, noise, quiescence: false };
  if (e < 1500) return { maxDepth: 2, moveTimeMs: 900, noise, quiescence: true };
  if (e < 2000) return { maxDepth: 3, moveTimeMs: 1400, noise, quiescence: true };
  if (e < 2600) return { maxDepth: 4, moveTimeMs: 2200, noise: 0, quiescence: true };
  return { maxDepth: 5, moveTimeMs: 3200, noise: 0, quiescence: true };
}

function evaluate(chess: Chess): number {
  const board = chess.board();
  let white = 0;
  let black = 0;
  let nonPawnMaterial = 0;
  let wKingIdx = -1;
  let bKingIdx = -1;

  for (let r = 0; r < 8; r++) {
    const row = board[r];
    for (let f = 0; f < 8; f++) {
      const sq = row[f];
      if (!sq) continue;
      const idxWhite = r * 8 + f;
      const idxBlack = (7 - r) * 8 + f;
      if (sq.type === 'k') {
        if (sq.color === 'w') wKingIdx = idxWhite;
        else bKingIdx = idxBlack;
        continue;
      }
      const value = VALUES[sq.type];
      if (sq.type !== 'p') nonPawnMaterial += value;
      if (sq.color === 'w') white += value + PST[sq.type][idxWhite];
      else black += value + PST[sq.type][idxBlack];
    }
  }

  const endgame = nonPawnMaterial <= 1300;
  const kingTable = endgame ? KING_ENDGAME : PST.k;
  if (wKingIdx >= 0) white += kingTable[wKingIdx];
  if (bKingIdx >= 0) black += kingTable[bKingIdx];

  const score = white - black;
  return chess.turn() === 'w' ? score : -score;
}

function moveOrderScore(m: Move): number {
  let s = 0;
  if (m.captured) s += 10 * VALUES[m.captured] - VALUES[m.piece] + 1000;
  if (m.promotion) s += 800 + VALUES[m.promotion];
  return s;
}

function orderMoves(moves: Move[]): Move[] {
  return moves
    .map((m) => ({ m, s: moveOrderScore(m) }))
    .sort((a, b) => b.s - a.s)
    .map((x) => x.m);
}

function gaussian(): number {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

const yieldToUi = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

export class LocalJsEngine implements ChessEngine {
  readonly name = 'LocalJsEngine';
  private cancelled = false;
  private aborted = false;
  private deadline = 0;
  private nodes = 0;

  cancel(): void {
    this.cancelled = true;
  }

  async getBestMove(fen: string, options: EngineOptions): Promise<string> {
    this.cancelled = false;
    const chess = new Chess(fen);
    const legal = chess.moves({ verbose: true });
    if (legal.length === 0) throw new Error('No legal moves in position');
    if (legal.length === 1) return toUci(legal[0]);

    const profile = profileForElo(options.elo);
    const budget = options.moveTimeMs ?? profile.moveTimeMs;
    const start = Date.now();
    this.deadline = start + budget;
    this.nodes = 0;

    let rootMoves = orderMoves(legal);
    let lastComplete: { move: Move; score: number }[] | null = null;
    const fullWindow = profile.noise > 0;

    for (let depth = 1; depth <= profile.maxDepth; depth++) {
      const scores: { move: Move; score: number }[] = [];
      let alpha = -INF;
      this.aborted = false;

      for (const m of rootMoves) {
        chess.move(m);
        const a = fullWindow ? -INF : alpha;
        const score = -this.negamax(chess, depth - 1, -INF, -a, 1, profile.quiescence);
        chess.undo();
        if (this.aborted || this.cancelled) break;
        scores.push({ move: m, score });
        if (score > alpha) alpha = score;
        await yieldToUi();
      }

      if (this.cancelled || this.aborted) break;
      lastComplete = scores;
      rootMoves = [...scores].sort((a, b) => b.score - a.score).map((s) => s.move);

      const bestScore = rootMoves.length ? scores.reduce((acc, s) => Math.max(acc, s.score), -INF) : 0;
      if (Math.abs(bestScore) > MATE - 1000) break; // mate found, stop
      if (Date.now() - start > budget * 0.45) break; // next iteration would blow the budget
    }

    if (this.cancelled) throw new Error('cancelled');
    if (!lastComplete || lastComplete.length === 0) return toUci(legal[0]);

    return toUci(this.pickMove(lastComplete, profile.noise));
  }

  private pickMove(scored: { move: Move; score: number }[], noise: number): Move {
    if (noise > 0) {
      let best = scored[0];
      let bestValue = -INF;
      for (const s of scored) {
        // Never throw away a forced mate, never walk into one, even when weak.
        const v = Math.abs(s.score) > MATE - 1000 ? s.score : s.score + gaussian() * noise;
        if (v > bestValue) {
          bestValue = v;
          best = s;
        }
      }
      return best.move;
    }
    const top = scored.reduce((acc, s) => Math.max(acc, s.score), -INF);
    const ties = scored.filter((s) => s.score === top);
    return ties[Math.floor(Math.random() * ties.length)].move;
  }

  private checkTime(): void {
    this.nodes++;
    if ((this.nodes & 511) === 0 && Date.now() > this.deadline) this.aborted = true;
  }

  private negamax(
    chess: Chess,
    depth: number,
    alpha: number,
    beta: number,
    ply: number,
    useQuiescence: boolean,
  ): number {
    this.checkTime();
    if (this.aborted) return 0;

    const moves = chess.moves({ verbose: true });
    if (moves.length === 0) return chess.inCheck() ? -MATE + ply : 0;
    if (depth <= 0) {
      return useQuiescence ? this.quiesce(chess, alpha, beta, ply, 0, moves) : evaluate(chess);
    }

    let best = -INF;
    for (const m of orderMoves(moves)) {
      chess.move(m);
      const score = -this.negamax(chess, depth - 1, -beta, -alpha, ply + 1, useQuiescence);
      chess.undo();
      if (this.aborted) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }

  private quiesce(
    chess: Chess,
    alpha: number,
    beta: number,
    ply: number,
    qDepth: number,
    knownMoves?: Move[],
  ): number {
    this.checkTime();
    if (this.aborted) return 0;

    const stand = evaluate(chess);
    if (qDepth >= 3) return stand;
    if (stand >= beta) return stand;
    if (stand > alpha) alpha = stand;

    const moves = knownMoves ?? chess.moves({ verbose: true });
    if (moves.length === 0) return chess.inCheck() ? -MATE + ply : 0;

    const tactical = orderMoves(moves.filter((m) => m.captured || m.promotion));
    let best = stand;
    for (const m of tactical) {
      chess.move(m);
      const score = -this.quiesce(chess, -beta, -alpha, ply + 1, qDepth + 1);
      chess.undo();
      if (this.aborted) return 0;
      if (score > best) best = score;
      if (score > alpha) alpha = score;
      if (alpha >= beta) break;
    }
    return best;
  }
}

export function toUci(m: Move): string {
  return `${m.from}${m.to}${m.promotion ?? ''}`;
}
