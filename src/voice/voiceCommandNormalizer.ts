/**
 * Turns raw Italian speech-to-text output into clean tokens where board
 * squares are canonical ("effe tre" -> "f3", "ci sei" -> "c6", "E 4" -> "e4").
 * It never interprets chess meaning; that is the parser's job.
 */

const FILES = 'abcdefgh';

const FILE_WORDS: Record<string, string> = {
  a: 'a',
  b: 'b', bi: 'b',
  c: 'c', ci: 'c',
  d: 'd', di: 'd',
  e: 'e',
  f: 'f', effe: 'f', ef: 'f',
  g: 'g', gi: 'g',
  h: 'h', acca: 'h',
};

const NUMBER_WORDS: Record<string, string> = {
  uno: '1', una: '1', un: '1',
  due: '2',
  tre: '3',
  quattro: '4',
  cinque: '5',
  sei: '6',
  sette: '7',
  otto: '8',
};

/** Whole-word STT quirks that map straight to a square. */
const SQUARE_QUIRKS: Record<string, string> = {
  effetre: 'f3', effequattro: 'f4', effecinque: 'f5', effesei: 'f6',
};

const SQUARE_RE = /^[a-h][1-8]$/;
const FILE_DIGIT_RE = /^([a-h]|bi|ci|di|gi|effe|acca|ef)([1-8])$/;

export function isSquareToken(token: string): boolean {
  return SQUARE_RE.test(token);
}

export function normalizeCommand(raw: string): string[] {
  const cleaned = raw
    .toLowerCase()
    .replace(/[’']/g, ' ')
    .replace(/[-–—_/\\.,;:!?()"“”«»]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return [];

  const rawTokens = cleaned.split(' ');

  // Pass 1: direct token rewrites.
  const pass1: string[] = [];
  for (let token of rawTokens) {
    if (SQUARE_QUIRKS[token]) {
      pass1.push(SQUARE_QUIRKS[token]);
      continue;
    }
    const glued = FILE_DIGIT_RE.exec(token);
    if (glued) {
      const file = FILE_WORDS[glued[1]] ?? (FILES.includes(glued[1]) ? glued[1] : null);
      if (file) {
        pass1.push(`${file}${glued[2]}`);
        continue;
      }
    }
    token = token.normalize('NFD').replace(/[̀-ͯ]/g, ''); // strip accents for matching
    pass1.push(token);
  }

  // Pass 2: merge (file word)(number word) pairs into squares.
  const out: string[] = [];
  for (let i = 0; i < pass1.length; i++) {
    const token = pass1[i];
    const next = pass1[i + 1];
    const file = FILE_WORDS[token];
    if (file && next !== undefined) {
      const digit = /^[1-8]$/.test(next) ? next : NUMBER_WORDS[next];
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
export function normalizedText(raw: string): string {
  return normalizeCommand(raw).join(' ');
}
