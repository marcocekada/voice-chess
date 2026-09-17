/**
 * Public links shown in the app's "About" footer. Voice Chess Play embeds
 * Stockfish (GPLv3), so the app itself is GPLv3 and its source must be
 * reachable by users: update SOURCE_CODE_URL when the public repository exists.
 */
export const ABOUT = {
  appLicense: 'GPLv3',
  /** Public repository with the app source code (GPL requirement). */
  SOURCE_CODE_URL: 'https://github.com/marcocekada/voice-chess',
  STOCKFISH_URL: 'https://stockfishchess.org',
  STOCKFISH_JS_URL: 'https://github.com/nmrugg/stockfish.js',
  /** cburnett piece set, CC BY-SA 3.0 */
  PIECES_URL: 'https://github.com/lichess-org/lila/tree/master/public/piece/cburnett',
} as const;
