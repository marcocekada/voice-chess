import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../storage/storageKeys';

interface SettingsValue {
  voiceFeedback: boolean;
  setVoiceFeedback: (enabled: boolean) => void;
}

const SettingsContext = createContext<SettingsValue | null>(null);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const [voiceFeedback, setVoiceFeedbackState] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEYS.voiceFeedback)
      .then((v) => {
        if (v === 'false') setVoiceFeedbackState(false);
      })
      .catch(() => undefined);
  }, []);

  const setVoiceFeedback = useCallback((enabled: boolean) => {
    setVoiceFeedbackState(enabled);
    AsyncStorage.setItem(STORAGE_KEYS.voiceFeedback, enabled ? 'true' : 'false').catch(() => undefined);
  }, []);

  const value = useMemo(() => ({ voiceFeedback, setVoiceFeedback }), [voiceFeedback, setVoiceFeedback]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error('useSettings must be used inside SettingsProvider');
  return ctx;
}
