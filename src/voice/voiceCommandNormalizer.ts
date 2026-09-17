import type { Language } from '../i18n';

/**
 * Turns raw speech-to-text output into clean tokens where board squares are
 * canonical ("effe tre" -> "f3", "see six" -> "c6", "E 4" -> "e4").
 * It never interprets chess meaning; that is the parser's job.
 */

const FILES = 'abcdefgh';

const FILE_WORDS: Record<Language, Record<string, string>> = {
  it: {
    a: 'a',
    b: 'b', bi: 'b',
    c: 'c', ci: 'c',
    d: 'd', di: 'd',
    e: 'e',
    f: 'f', effe: 'f', ef: 'f',
    g: 'g', gi: 'g',
    h: 'h', acca: 'h',
  },
  en: {
    a: 'a', ay: 'a', eh: 'a',
    b: 'b', bee: 'b', be: 'b',
    c: 'c', see: 'c', sea: 'c', si: 'c',
    d: 'd', dee: 'd', de: 'd',
    e: 'e', ee: 'e',
    f: 'f', ef: 'f', eff: 'f',
    g: 'g', gee: 'g', ji: 'g',
    h: 'h', aitch: 'h', age: 'h',
  },
};

const NUMBER_WORDS: Record<Language, Record<string, string>> = {
  it: {
    uno: '1', una: '1', un: '1',
    due: '2',
    tre: '3',
    quattro: '4',
    cinque: '5',
    sei: '6',
    sette: '7',
    otto: '8',
  },
  en: {
    one: '1', won: '1',
    two: '2', to: '2', too: '2',
    three: '3', tree: '3',
    four: '4', for: '4', fore: '4',
    five: '5',
    six: '6', sicks: '6',
    seven: '7',
    eight: '8', ate: '8',
  },
};

/** Whole-word STT quirks that map straight to a square. */
const SQUARE_QUIRKS: Record<Language, Record<string, string>> = {
  it: {
    effetre: 'f3', effequattro: 'f4', effecinque: 'f5', effesei: 'f6',
    acca3: 'h3', acca4: 'h4',
  },
  en: {
    before: 'b4', befour: 'b4',
    seaford: 'c4', seefour: 'c4',
    defore: 'd4',
  },
};

const SQUARE_RE = /^[a-h][1-8]$/;
const FILE_DIGIT_RE = /^([a-h]|bi|ci|di|gi|effe|acca|bee|see|dee|gee|aitch|eff|ef)([1-8])$/;

export function isSquareToken(token: string): boolean {
  return SQUARE_RE.test(token);
}

export function normalizeCommand(raw: string, language: Language): string[] {
  const fileWords = FILE_WORDS[language];
  const numberWords = NUMBER_WORDS[language];
  const quirks = SQUARE_QUIRKS[language];

  const cleaned = raw
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[-–—_/\\.,;:!?()"“”«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  // Split glued letter+digit like "f3" stays; "F-3" already became "f 3".
  const rawTokens = cleaned.split(' ');

  // Pass 1: direct token rewrites.
  const pass1: string[] = [];
  for (let token of rawTokens) {
    if (quirks[token] && SQUARE_RE.test(quirks[token])) {
      pass1.push(quirks[token]);
      continue;
    }
    const glued = FILE_DIGIT_RE.exec(token);
    if (glued) {
      const file = fileWords[glued[1]] ?? (FILES.includes(glued[1]) ? glued[1] : null);
      if (file) {
        pass1.push(`${file}${glued[2]}`);
        continue;
      }
    }
    // Digits attached to letter via number word, e.g. "effe3" handled above; "f tre" handled in pass 2.
    if (/^\d+$/.test(token) && token.length > 1) {
      // "e 24" is noise; keep as is.
      pass1.push(token);
      continue;
    }
    token = token.normalize('NFD').replace(/[̀-ͯ]/g, ''); // strip accents for matching
    pass1.push(token);
  }

  // Pass 2: merge (file word)(number word) pairs into squares.
  const out: string[] = [];
  for (let i = 0; i < pass1.length; i++) {
    const token = pass1[i];
    const next = pass1[i + 1];
    const file = fileWords[token];
    if (file && next !== undefined) {
      const digit = /^[1-8]$/.test(next) ? next : numberWords[next];
      if (digit) {
        out.push(`${file}${digit}`);
        i++;
        continue;
      }
    }
    out.push(token);
  }

  return out.filter((t) => t.length > 0);
}

/** Convenience for logs and the "last command" label. */
export function normalizedText(raw: string, language: Language): string {
  return normalizeCommand(raw, language).join(' ');
}
