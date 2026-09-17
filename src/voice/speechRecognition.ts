/**
 * Thin wrapper around expo-speech-recognition.
 *
 * The native module is NOT available inside Expo Go, so it is required lazily
 * and every call degrades gracefully: `isAvailable()` returns false and the
 * game screen falls back to typed commands. In an Expo Development Build the
 * module is present and voice input works.
 */

import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

type ResultEvent = { isFinal: boolean; results: { transcript: string; confidence: number }[] };
type ErrorEvent = { error: string; message: string };

interface NativeModuleLike {
  start(options: Record<string, unknown>): void;
  stop(): void;
  abort(): void;
  requestPermissionsAsync(): Promise<{ granted: boolean; status: string }>;
  getPermissionsAsync(): Promise<{ granted: boolean; status: string }>;
  isRecognitionAvailable(): boolean;
  addListener(event: string, listener: (e: never) => void): { remove(): void };
}

let cached: NativeModuleLike | null | undefined;

function loadModule(): NativeModuleLike | null {
  if (cached !== undefined) return cached;
  cached = null;
  try {
    // Ask expo-modules-core first: in Expo Go the native module is simply absent and
    // importing the package would throw "Cannot find native module 'ExpoSpeechRecognition'".
    if (Platform.OS !== 'web') {
      const native = requireOptionalNativeModule('ExpoSpeechRecognition');
      if (!native) return cached;
    }
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('expo-speech-recognition') as { ExpoSpeechRecognitionModule?: NativeModuleLike };
    const candidate = mod.ExpoSpeechRecognitionModule ?? null;
    if (candidate && typeof candidate.isRecognitionAvailable === 'function' && candidate.isRecognitionAvailable()) {
      cached = candidate;
    }
  } catch {
    cached = null;
  }
  return cached;
}

export interface SpeechSession {
  stop(): void;
  abort(): void;
  dispose(): void;
}

export interface SpeechCallbacks {
  onPartial?: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string, code: string) => void;
  onEnd: () => void;
  onStart?: () => void;
}

export const speechRecognition = {
  isAvailable(): boolean {
    return loadModule() !== null;
  },

  async requestPermission(): Promise<boolean> {
    const mod = loadModule();
    if (!mod) return false;
    try {
      const current = await mod.getPermissionsAsync();
      if (current.granted) return true;
      const res = await mod.requestPermissionsAsync();
      return res.granted;
    } catch {
      return false;
    }
  },

  /**
   * Start a single-utterance recognition session. Resolves with a handle to
   * stop it early. Results are delivered through callbacks.
   */
  start(locale: string, callbacks: SpeechCallbacks): SpeechSession | null {
    const mod = loadModule();
    if (!mod) return null;

    const subs: { remove(): void }[] = [];
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      callbacks.onEnd();
      subs.forEach((s) => s.remove());
    };

    subs.push(
      mod.addListener('start', () => callbacks.onStart?.()),
      mod.addListener('result', ((e: ResultEvent) => {
        const text = e.results?.[0]?.transcript ?? '';
        if (e.isFinal) callbacks.onFinal(text);
        else callbacks.onPartial?.(text);
      }) as never),
      mod.addListener('error', ((e: ErrorEvent) => {
        if (e.error !== 'aborted') callbacks.onError(e.message, e.error);
        finish();
      }) as never),
      mod.addListener('end', () => finish()),
    );

    try {
      mod.start({
        lang: locale,
        interimResults: true,
        continuous: false,
        maxAlternatives: 3,
        addsPunctuation: false,
        requiresOnDeviceRecognition: false,
        contextualStrings: [
          'a1', 'e4', 'f3', 'cavallo', 'alfiere', 'torre', 'donna', 'pedone', 'arrocco',
          'knight', 'bishop', 'rook', 'queen', 'pawn', 'castle',
        ],
      });
    } catch (e) {
      callbacks.onError(e instanceof Error ? e.message : String(e), 'start-failed');
      finish();
      return null;
    }

    return {
      stop: () => {
        try {
          mod.stop();
        } catch {
          finish();
        }
      },
      abort: () => {
        try {
          mod.abort();
        } finally {
          finish();
        }
      },
      dispose: finish,
    };
  },
};
