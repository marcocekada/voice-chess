import type { PieceSymbol, Square } from 'chess.js';
import type { Language } from '../i18n';
import type { MoveIntent } from './types';
import { isSquareToken, normalizeCommand } from '../voice/voiceCommandNormalizer';

/**
 * Natural-language parser (Italian + English).
 * Input: raw text. Output: a structured MoveIntent. It never touches the board.
 */

interface Vocabulary {
  pieces: Record<string, PieceSymbol>;
  captureVerbs: Set<string>;
  /** Capture verbs with an attached object pronoun: "mangialo", "prendila". */
  pronounVerbs: Set<string>;
  pronouns: Set<string>;
  withWords: Set<string>;
  fromWords: Set<string>;
  toWords: Set<string>;
  castleWords: Set<string>;
  shortWords: Set<string>;
  longWords: Set<string>;
  kingSideWords: string[];
  queenSideWords: string[];
  promoteWords: Set<string>;
  clarifyMarkers: string[];
  /** Single-letter SAN piece codes used in this language. */
  sanLetters: Record<string, PieceSymbol>;
  stopWords: Set<string>;
}

const IT: Vocabulary = {
  pieces: {
    pedone: 'p', pedoni: 'p', pedina: 'p',
    cavallo: 'n', cavalli: 'n',
    alfiere: 'b', alfieri: 'b',
    torre: 'r', torri: 'r',
    donna: 'q', regina: 'q',
    re: 'k',
  },
  captureVerbs: new Set([
    'mangia', 'mangio', 'mangiare', 'mangi',
    'cattura', 'catturo', 'catturare', 'catturi',
    'prende', 'prendi', 'prendo', 'prendere',
    'elimina', 'togli', 'x',
  ]),
  pronounVerbs: new Set([
    'mangialo', 'mangiala', 'mangiali',
    'catturalo', 'catturala',
    'prendilo', 'prendila',
    'toglilo', 'toglila', 'eliminalo', 'eliminala',
  ]),
  pronouns: new Set(['lo', 'la', 'quello', 'quella', 'quel', 'esso']),
  withWords: new Set(['con', 'col', 'coi', 'usando', 'tramite', 'mediante']),
  fromWords: new Set(['da', 'dal', 'dalla', 'di']),
  toWords: new Set(['in', 'a', 'su', 'verso', 'ad']),
  castleWords: new Set(['arrocco', 'arrocca', 'arroccare', 'arrocchi', 'arroco', 'arroca', 'roccata']),
  shortWords: new Set(['corto', 'piccolo', 'breve']),
  longWords: new Set(['lungo', 'grande']),
  kingSideWords: ['lato re', 'di re', 'del re'],
  queenSideWords: ['lato donna', 'di donna', 'della donna', 'lato regina'],
  promoteWords: new Set(['promuovi', 'promuovo', 'promozione', 'promuovere', 'diventa', 'trasforma', 'trasformalo']),
  clarifyMarkers: ['quello', 'quella', 'quelli', 'quelle', 'intendo', 'intendevo', 'volevo'],
  sanLetters: { C: 'n', A: 'b', T: 'r', D: 'q', R: 'k', N: 'n', B: 'b', Q: 'q', K: 'k' },
  stopWords: new Set([
    'il', 'lo', 'la', 'i', 'gli', 'le', 'un', 'uno', 'una', 'l', 'del', 'della', 'dello',
    'muovi', 'muovo', 'sposta', 'sposto', 'porta', 'porto', 'metti', 'metto', 'gioca', 'gioco',
    'va', 'vai', 'vada', 'andare', 'mossa', 'muovere', 'spostare', 'poi', 'ora', 'adesso',
    'per', 'favore', 'e', 'ed', 'che', 'mio', 'mia', 'tuo', 'tua', 'suo', 'sua', 'ok',
  ]),
};

const EN: Vocabulary = {
  pieces: {
    pawn: 'p', pawns: 'p', pond: 'p', porn: 'p',
    knight: 'n', knights: 'n', night: 'n', horse: 'n', nite: 'n',
    bishop: 'b', bishops: 'b',
    rook: 'r', rooks: 'r', rock: 'r', brook: 'r',
    queen: 'q', queens: 'q',
    king: 'k',
  },
  captureVerbs: new Set([
    'take', 'takes', 'took', 'taking',
    'capture', 'captures', 'capturing',
    'eat', 'eats', 'grab', 'grabs', 'kill', 'x',
  ]),
  pronounVerbs: new Set([]),
  pronouns: new Set(['it', 'that', 'him', 'her', 'them']),
  withWords: new Set(['with', 'using', 'by']),
  fromWords: new Set(['from']),
  toWords: new Set(['to', 'on', 'onto', 'at', 'into', 'in']),
  castleWords: new Set(['castle', 'castles', 'castling', 'castel', 'cassel']),
  shortWords: new Set(['short', 'kingside', 'kingsside', 'small']),
  longWords: new Set(['long', 'queenside', 'queensside', 'big']),
  kingSideWords: ['king side', 'kings side', 'king s side'],
  queenSideWords: ['queen side', 'queens side', 'queen s side'],
  promoteWords: new Set(['promote', 'promotes', 'promotion', 'promoting', 'become', 'becomes', 'make']),
  clarifyMarkers: ['the one', 'that one', 'one on', 'one from', 'i mean', 'i meant'],
  sanLetters: { N: 'n', B: 'b', R: 'r', Q: 'q', K: 'k' },
  stopWords: new Set([
    'the', 'a', 'an', 'my', 'your', 'his',
    'move', 'moves', 'put', 'play', 'plays', 'go', 'goes', 'bring', 'send', 'place',
    'please', 'and', 'then', 'now', 'ok', 'okay', 'um', 'uh',
  ]),
};

const VOCAB: Record<Language, Vocabulary> = { it: IT, en: EN };

const SAN_RE = /^([NBRQKCATD])?([a-h])?([1-8])?[x:]?([a-h][1-8])(?:=?([NBRQCATD]))?[+#]?$/;
const CASTLE_SAN_RE = /^(o-o-o|0-0-0|ooo|000|o-o|0-0|oo|00)$/i;

export function parseCommand(raw: string, language: Language): MoveIntent {
  const vocab = VOCAB[language];
  const trimmed = raw.trim();
  if (!trimmed) return { kind: 'unknown', raw };

  // 1. Typed SAN / castling notation ("Nf3", "Cf3", "exd5", "O-O").
  const single = trimmed.split(/\s+/);
  if (single.length === 1) {
    if (CASTLE_SAN_RE.test(single[0])) {
      const isLong = single[0].replace(/-/g, '').length >= 3;
      return { kind: 'castle', side: isLong ? 'q' : 'k' };
    }
    const san = SAN_RE.exec(single[0]);
    const hasUppercase = single[0] !== single[0].toLowerCase();
    if (san && (hasUppercase || (!san[1] && !san[5]))) {
      const s = san;
      const piece = s[1] ? vocab.sanLetters[s[1].toUpperCase()] : undefined;
      const promotion = s[5] ? vocab.sanLetters[s[5].toUpperCase()] : undefined;
      if (!s[1] || piece) {
        const intent: MoveIntent = {
          kind: 'move',
          piece: piece ?? (s[2] || s[3] ? 'p' : undefined),
          to: s[4] as Square,
          fromFile: s[2] || undefined,
          fromRank: s[3] || undefined,
          capture: /[x:]/.test(single[0]) || undefined,
          promotion: promotion && promotion !== 'k' ? promotion : undefined,
        };
        return intent;
      }
    }
  }

  const tokens = normalizeCommand(trimmed, language);
  if (tokens.length === 0) return { kind: 'unknown', raw };
  const joined = tokens.join(' ');

  // 2. Castling.
  if (tokens.some((t) => vocab.castleWords.has(t))) {
    let side: 'k' | 'q' | undefined;
    if (tokens.some((t) => vocab.shortWords.has(t)) || vocab.kingSideWords.some((w) => joined.includes(w))) side = 'k';
    else if (tokens.some((t) => vocab.longWords.has(t)) || vocab.queenSideWords.some((w) => joined.includes(w))) side = 'q';
    // "castle" alone in English also means the verb; if a square or another piece is present it is not castling.
    return { kind: 'castle', side };
  }

  // 3. Scan tokens.
  const squares: { sq: Square; idx: number }[] = [];
  const pieceHits: { piece: PieceSymbol; idx: number }[] = [];
  let captureIdx = -1;
  let pronoun = false;
  let promoteIdx = -1;
  const fileOnly: { file: string; idx: number }[] = [];

  tokens.forEach((tok, idx) => {
    if (isSquareToken(tok)) squares.push({ sq: tok as Square, idx });
    else if (vocab.pieces[tok]) pieceHits.push({ piece: vocab.pieces[tok], idx });
    else if (vocab.pronounVerbs.has(tok)) {
      captureIdx = captureIdx < 0 ? idx : captureIdx;
      pronoun = true;
    } else if (vocab.captureVerbs.has(tok)) {
      captureIdx = captureIdx < 0 ? idx : captureIdx;
    } else if (vocab.promoteWords.has(tok)) promoteIdx = idx;
    else if (/^[a-h]$/.test(tok) && idx > 0 && (vocab.toWords.has(tokens[idx - 1]) || vocab.fromWords.has(tokens[idx - 1]))) {
      fileOnly.push({ file: tok, idx });
    }
  });

  if (captureIdx >= 0) {
    const after = tokens.slice(captureIdx + 1, captureIdx + 3);
    if (after.some((t) => vocab.pronouns.has(t)) && !after.some((t) => vocab.pieces[t])) pronoun = true;
  }

  const isWithPrefixed = (idx: number) => {
    for (let i = idx - 1; i >= Math.max(0, idx - 3); i--) {
      const tok = tokens[i];
      if (vocab.withWords.has(tok)) return true;
      if (!vocab.stopWords.has(tok)) break;
    }
    return false;
  };
  const isFromPrefixed = (idx: number) => idx > 0 && vocab.fromWords.has(tokens[idx - 1]);

  // 4. Clarification-shaped answers ("the one on d2", "quello in d2", "col cavallo").
  const hasClarifyMarker = vocab.clarifyMarkers.some((m) => joined.includes(m));
  if (hasClarifyMarker && captureIdx < 0) {
    const sq = squares[0]?.sq;
    const piece = pieceHits[0]?.piece;
    const file = fileOnly[0]?.file;
    if (sq || piece || file) return { kind: 'clarify', square: sq, piece, file };
  }

  // 5. Promotion-only command ("promote to queen", "promuovi a donna").
  if (promoteIdx >= 0 && squares.length === 0) {
    const promoPiece = pieceHits.find((p) => p.idx > promoteIdx)?.piece ?? pieceHits[0]?.piece;
    if (promoPiece && promoPiece !== 'k' && promoPiece !== 'p') return { kind: 'promote', piece: promoPiece };
  }

  // 6. Split piece mentions into mover / target / with / promotion.
  let mover: PieceSymbol | undefined;
  let withPiece: PieceSymbol | undefined;
  let targetPiece: PieceSymbol | undefined;
  let promotion: PieceSymbol | undefined;
  const lastSquareIdx = squares.length ? squares[squares.length - 1].idx : -1;

  for (const hit of pieceHits) {
    if (isWithPrefixed(hit.idx)) {
      if (!withPiece) withPiece = hit.piece;
      continue;
    }
    if (promoteIdx >= 0 && hit.idx > promoteIdx && hit.piece !== 'k' && hit.piece !== 'p') {
      promotion = hit.piece;
      continue;
    }
    if (captureIdx >= 0 && hit.idx > captureIdx) {
      if (!targetPiece) targetPiece = hit.piece;
      continue;
    }
    if (lastSquareIdx >= 0 && hit.idx > lastSquareIdx && (mover !== undefined || captureIdx >= 0) && hit.piece !== 'k' && hit.piece !== 'p') {
      // "pedone in e8 donna" -> promotion piece after the destination
      promotion = hit.piece;
      continue;
    }
    if (mover === undefined) mover = hit.piece;
    else if (hit.piece !== 'k' && hit.piece !== 'p' && lastSquareIdx >= 0 && hit.idx > lastSquareIdx) promotion = hit.piece;
  }
  if (!mover && withPiece) mover = withPiece;

  // 7. Squares -> from / to.
  let from: Square | undefined;
  let to: Square | undefined;
  let targetSquare: Square | undefined;
  if (squares.length >= 2) {
    from = squares[0].sq;
    to = squares[1].sq;
    if (isFromPrefixed(squares[1].idx) && !isFromPrefixed(squares[0].idx)) {
      from = squares[1].sq;
      to = squares[0].sq;
    }
  } else if (squares.length === 1) {
    if (isFromPrefixed(squares[0].idx) && captureIdx >= 0) from = squares[0].sq;
    else to = squares[0].sq;
  }
  const fromFile = !from && fileOnly.find((f) => isFromPrefixed(f.idx))?.file;

  // 8. Capture without destination -> capture intent.
  if (captureIdx >= 0 && !to) {
    if (!targetPiece && !pronoun && !withPiece && !from) {
      // bare "take"/"mangia": treat as pronoun-like reference
      pronoun = true;
    }
    return {
      kind: 'capture',
      targetPiece,
      targetSquare,
      withPiece: withPiece ?? (mover && mover !== targetPiece ? mover : undefined),
      pronoun,
      promotion,
    };
  }

  if (!to && !mover && !from) return { kind: 'unknown', raw };

  return {
    kind: 'move',
    piece: mover,
    from,
    fromFile: fromFile || undefined,
    to,
    capture: captureIdx >= 0 ? true : undefined,
    promotion,
  };
}
