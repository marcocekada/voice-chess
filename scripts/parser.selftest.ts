import { Chess } from 'chess.js';
import type { ConversationContext } from '../src/chess/types';
import { parseCommand } from '../src/chess/moveParser';
import { resolveIntent, resolveClarification } from '../src/chess/moveResolver';
import { normalizeCommand } from '../src/voice/voiceCommandNormalizer';
import { it } from '../src/i18n/it';
import { en } from '../src/i18n/en';

let fails = 0;
function check(name: string, got: unknown, expected: unknown) {
  const g = JSON.stringify(got), e = JSON.stringify(expected);
  if (g !== e) { fails++; console.log(`FAIL ${name}\n   got:  ${g}\n   want: ${e}`); }
  else console.log(`ok   ${name}`);
}

// normalizer
check('norm effe tre', normalizeCommand('Cavallo in effe tre', 'it'), ['cavallo','in','f3']);
check('norm ci sei', normalizeCommand('alfiere in ci sei', 'it'), ['alfiere','in','c6']);
check('norm bi quattro', normalizeCommand('pedone bi quattro', 'it'), ['pedone','b4']);
check('norm F-3', normalizeCommand('Cavallo F-3', 'it'), ['cavallo','f3']);
check('norm e 4', normalizeCommand('pedone in e 4', 'it'), ['pedone','in','e4']);
check('norm en see six', normalizeCommand('bishop to see six', 'en'), ['bishop','to','c6']);
check('norm en a four', normalizeCommand('pawn a four', 'en'), ['pawn','a4']);
check('norm en knight to f3', normalizeCommand('Knight to F3', 'en'), ['knight','to','f3']);
check('norm en before', normalizeCommand('pawn before', 'en'), ['pawn','b4']);

// parser IT
const ctx: ConversationContext = { lastOpponentMove: null, lastUserMove: null, lastMentionedPiece: null };
const start = new Chess();
const r = (cmd: string, chess: Chess, lang: 'it'|'en' = 'it', c = ctx) => {
  const intent = parseCommand(cmd, lang);
  const res = resolveIntent(intent, chess, c as any, lang === 'it' ? it : en);
  return res.type === 'move' ? res.move.san : res.type === 'ambiguous' ? `? ${res.question}` : `! ${res.message}`;
};
check('pedone in e4', r('Pedone in e4', start), 'e4');
check('pedone da e2 a e4', r('Pedone da e2 a e4', start), 'e4');
check('cavallo in f3', r('Cavallo in f3', start), 'Nf3');
check('cavallo da g1 a f3', r('Cavallo da g1 a f3', start), 'Nf3');
check('muovi il cavallo in f3', r('Muovi il cavallo in f3', start), 'Nf3');
check('porta il cavallo in f3', r('Porta il cavallo in f3', start), 'Nf3');
check('cavallo f3', r('Cavallo f3', start), 'Nf3');
check('il cavallo va in f3', r('Il cavallo va in f3', start), 'Nf3');
check('metti il pedone in e4', r('Metti il pedone in e4', start), 'e4');
check('e4 bare', r('e4', start), 'e4');
check('Nf3 SAN', r('Nf3', start), 'Nf3');
check('Cf3 SAN IT', r('Cf3', start), 'Nf3');
check('alfiere in b5 illegal', r('Alfiere in b5', start), '! Nessun alfiere può andare in b5.');
check('cavallo in f6 wrong side', r('Cavallo in f6', start), '! Nessun cavallo può andare in f6.');
check('arrocco corto illegal', r('Arrocco corto', start), '! Non puoi arroccare adesso.');

// ambiguity: two knights to e2 -> from g1 (Nge2) and c3 (Nce2)
const amb = new Chess('rnbqkbnr/pppppppp/8/8/4P3/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 1');
check('cavallo in e2 ambiguo', r('Cavallo in e2', amb), '? Quale cavallo intendi, quello in c3 o g1?');
{
  const intent = parseCommand('Cavallo in e2', 'it');
  const res = resolveIntent(intent, amb, ctx, it);
  if (res.type === 'ambiguous') {
    const a = resolveClarification(res.candidates, parseCommand('quello in g1', 'it'), it);
    check('clarify quello in g1', a?.type === 'move' ? a.move.san : a, 'Nge2');
    const b = resolveClarification(res.candidates, parseCommand('c3', 'it'), it);
    check('clarify c3', b?.type === 'move' ? b.move.san : b, 'Nce2');
    const c = resolveClarification(res.candidates, parseCommand('quello di g', 'it'), it);
    check('clarify file g', c?.type === 'move' ? c.move.san : c, 'Nge2');
  }
}

// captures
const cap = new Chess();
cap.move('e4'); cap.move('d5');
const ctx2: ConversationContext = { ...ctx, lastOpponentMove: cap.history({verbose:true}).at(-1)! };
check('mangialo col pedone', r('Mangialo col pedone', cap, 'it', ctx2), 'exd5');
check('mangia il pedone', r('Mangia il pedone', cap, 'it', ctx2), 'exd5');
check('pedone mangia in d5', r('Pedone mangia in d5', cap, 'it', ctx2), 'exd5');
check('mangialo', r('Mangialo', cap, 'it', ctx2), 'exd5');
check('prendilo con il pedone', r('Prendilo con il pedone', cap, 'it', ctx2), 'exd5');
check('exd5 SAN', r('exd5', cap), 'exd5');
check('mangia il cavallo none', r('Mangia il cavallo', cap, 'it', ctx2), '! Nessun tuo pezzo può catturare quel cavallo.');
check('mangialo con la donna', r('Mangialo con la donna', cap, 'it', ctx2), '! Con la donna non puoi catturare nulla ora.');

// castling
const cas = new Chess('r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1');
check('arrocco corto', r('Arrocco corto', cas), 'O-O');
check('arrocco lungo', r('Arrocco lungo', cas), 'O-O-O');
check('arrocco lato donna', r('Arrocco lato donna', cas), 'O-O-O');
check('arrocco ambiguo', r('Arrocco', cas), '? Quale mossa intendi? arrocco corto o arrocco lungo');
check('O-O typed', r('O-O', cas), 'O-O');
check('re in g1 (castle by king move)', r('Re in g1', cas), 'O-O');

// promotion
const promo = new Chess('8/P6k/8/8/8/8/8/K7 w - - 0 1');
check('pedone in a8 ambiguous promotion', r('Pedone in a8', promo), '? A quale pezzo vuoi promuovere?');
check('pedone in a8 donna', r('Pedone in a8 donna', promo), 'a8=Q');
check('promuovi a donna', r('Promuovi a donna', promo), 'a8=Q');
check('a8 cavallo', r('Pedone a8 cavallo', promo), 'a8=N');
{
  const res = resolveIntent(parseCommand('Pedone in a8', 'it'), promo, ctx, it);
  if (res.type === 'ambiguous') {
    const a = resolveClarification(res.candidates, parseCommand('torre', 'it'), it);
    check('clarify promotion torre', a?.type === 'move' ? a.move.san : a, 'a8=R');
  }
}

// EN
check('en pawn to e4', r('Pawn to e4', start, 'en'), 'e4');
check('en knight to f3', r('Knight to f3', start, 'en'), 'Nf3');
check('en knight f3', r('knight f3', start, 'en'), 'Nf3');
check('en move the knight to f3', r('move the knight to f3', start, 'en'), 'Nf3');
check('en e2 to e4', r('e2 to e4', start, 'en'), 'e4');
check('en pawn from e2 to e4', r('pawn from e2 to e4', start, 'en'), 'e4');
check('en take it with the pawn', r('take it with the pawn', cap, 'en', ctx2), 'exd5');
check('en pawn takes d5', r('pawn takes d5', cap, 'en', ctx2), 'exd5');
check('en take the pawn', r('take the pawn', cap, 'en', ctx2), 'exd5');
check('en castle kingside', r('castle kingside', cas, 'en'), 'O-O');
check('en castle king side', r('castle king side', cas, 'en'), 'O-O');
check('en castle long', r('castle long', cas, 'en'), 'O-O-O');
check('en promote to queen', r('promote to queen', promo, 'en'), 'a8=Q');
check('en pawn to a8 queen', r('pawn to a8 queen', promo, 'en'), 'a8=Q');
check('en knight to e2 ambiguous', r('knight to e2', amb, 'en'), '? Which knight do you mean, the one on c3 or g1?');
{
  const res = resolveIntent(parseCommand('knight to e2', 'en'), amb, ctx, en);
  if (res.type === 'ambiguous') {
    const a = resolveClarification(res.candidates, parseCommand('the one on g1', 'en'), en);
    check('en clarify the one on g1', a?.type === 'move' ? a.move.san : a, 'Nge2');
  }
}
check('gibberish', r('buongiorno a tutti', start), '! Non ho capito il comando.');

console.log(fails ? `\n${fails} FAILED` : '\nALL OK');
