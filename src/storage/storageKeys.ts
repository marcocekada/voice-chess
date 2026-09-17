export const STORAGE_KEYS = {
  /** JSON array of SavedGame */
  games: '@voice-chess/games/v1',
  /** 'it' | 'en' when the user forces a language */
  languageOverride: '@voice-chess/settings/language',
  /** 'true' | 'false' */
  voiceFeedback: '@voice-chess/settings/voiceFeedback',
} as const;
