import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { it, type Translations } from './it';
import { en } from './en';
import { STORAGE_KEYS } from '../storage/storageKeys';

export type Language = 'it' | 'en';

export const SUPPORTED_LANGUAGES: Language[] = ['it', 'en'];

const DICTIONARIES: Record<Language, Translations> = { it, en };

/** Speech recognition / TTS locale tags per language. */
export const LANGUAGE_LOCALE: Record<Language, string> = {
  it: 'it-IT',
  en: 'en-US',
};

/** Default language: Italian. The user can switch to English from the Home screen. */
export const DEFAULT_LANGUAGE: Language = 'it';

interface I18nContextValue {
  language: Language;
  t: Translations;
  locale: string;
  setLanguage: (lang: Language | null) => Promise<void>;
  /** true when the user forced a language, false when following the device. */
  isOverridden: boolean;
  ready: boolean;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [override, setOverride] = useState<Language | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEYS.languageOverride)
      .then((value) => {
        if (cancelled) return;
        if (value === 'it' || value === 'en') setOverride(value);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const language: Language = override ?? DEFAULT_LANGUAGE;

  const setLanguage = useCallback(async (lang: Language | null) => {
    setOverride(lang);
    try {
      if (lang) await AsyncStorage.setItem(STORAGE_KEYS.languageOverride, lang);
      else await AsyncStorage.removeItem(STORAGE_KEYS.languageOverride);
    } catch {
      // non-critical
    }
  }, []);

  const value = useMemo<I18nContextValue>(
    () => ({
      language,
      t: DICTIONARIES[language],
      locale: LANGUAGE_LOCALE[language],
      setLanguage,
      isOverridden: override !== null,
      ready,
    }),
    [language, setLanguage, override, ready],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}

export function getTranslations(language: Language): Translations {
  return DICTIONARIES[language];
}
