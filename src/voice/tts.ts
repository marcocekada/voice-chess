import * as Speech from 'expo-speech';

/**
 * Short spoken feedback. The board already gives visual context, so phrases
 * are kept brief. Speaking is best-effort and never blocks the game flow.
 */
export const tts = {
  speak(text: string, locale: string): void {
    try {
      Speech.stop();
      Speech.speak(text, { language: locale, rate: 1.0, pitch: 1.0 });
    } catch {
      // ignore
    }
  },
  stop(): void {
    try {
      Speech.stop();
    } catch {
      // ignore
    }
  },
};
