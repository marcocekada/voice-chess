import { Chess } from 'chess.js';
import { LocalJsEngine, profileForElo } from '../src/engine/LocalJsEngine';

async function main() {
  const engine = new LocalJsEngine();
  const positions = [
    ['start', new Chess().fen()],
    ['middlegame', 'r1bqkb1r/pppp1ppp/2n2n2/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4'],
    ['mate in 1', 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4'],
    ['hanging queen', 'rnb1kbnr/pppp1ppp/8/4p3/4P2q/5N2/PPPP1PPP/RNBQKB1R w KQkq - 0 3'],
  ] as const;
  for (const elo of [400, 1200, 1800, 2400, 3200]) {
    console.log(`\n=== Elo ${elo}`, JSON.stringify(profileForElo(elo)));
    for (const [name, fen] of positions) {
      const t0 = Date.now();
      const mv = await engine.getBestMove(fen, { elo });
      console.log(`  ${name.padEnd(14)} ${mv.padEnd(6)} ${Date.now() - t0}ms`);
    }
  }
}
main();
