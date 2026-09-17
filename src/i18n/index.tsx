import { it, type Translations } from './it';

/** The app is Italian only. */
export const LOCALE = 'it-IT';

interface I18nValue {
  t: Translations;
  /** Speech recognition / TTS locale tag. */
  locale: string;
}

const VALUE: I18nValue = { t: it, locale: LOCALE };

export function useI18n(): I18nValue {
  return VALUE;
}

export { it as translations };
