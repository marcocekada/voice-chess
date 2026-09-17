import { useCallback, useEffect, useRef, useState } from 'react';
import { speechRecognition, type SpeechSession } from '../voice/speechRecognition';
import { useI18n } from '../i18n';

/**
 * Push-to-talk voice input. One utterance per tap; the final transcript is
 * handed to `onCommand`. Falls back to `available: false` in Expo Go.
 *
 * The recognizer runs in continuous mode so it does not cut the player off at
 * the first short pause. This hook decides when the utterance is over:
 *  - nothing heard at all for NO_SPEECH_TIMEOUT_MS  -> stop, no command
 *  - speech heard, then silence for END_SILENCE_MS  -> stop, submit transcript
 *  - MAX_UTTERANCE_MS as a hard cap
 * Tapping the microphone again stops immediately.
 */
const NO_SPEECH_TIMEOUT_MS = 8000;
const END_SILENCE_MS = 2200;
const MAX_UTTERANCE_MS = 15000;

export function useVoiceCommands(onCommand: (text: string) => void) {
  const { locale, t } = useI18n();
  const [available] = useState(() => speechRecognition.isAvailable());
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SpeechSession | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  const silenceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hardTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (silenceTimer.current) clearTimeout(silenceTimer.current);
    if (hardTimer.current) clearTimeout(hardTimer.current);
    silenceTimer.current = null;
    hardTimer.current = null;
  };

  useEffect(() => {
    return () => {
      clearTimers();
      sessionRef.current?.abort();
      sessionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
    clearTimers();
    sessionRef.current?.stop();
  }, []);

  const start = useCallback(async () => {
    if (!available) {
      setError(t.game.voiceUnavailable);
      return;
    }
    const granted = await speechRecognition.requestPermission();
    if (!granted) {
      setError(t.game.micPermissionDenied);
      return;
    }
    setError(null);
    setPartial('');

    let lastTranscript = '';
    let finalTranscript = '';

    const armSilence = (ms: number) => {
      if (silenceTimer.current) clearTimeout(silenceTimer.current);
      silenceTimer.current = setTimeout(() => sessionRef.current?.stop(), ms);
    };

    const session = speechRecognition.start(locale, {
      onStart: () => setListening(true),
      onPartial: (text) => {
        if (text.trim()) {
          lastTranscript = text;
          setPartial(text);
          armSilence(END_SILENCE_MS);
        }
      },
      onFinal: (text) => {
        if (text.trim()) {
          finalTranscript = text;
          lastTranscript = text;
          setPartial(text);
          armSilence(END_SILENCE_MS);
        }
      },
      onError: (message, code) => {
        // "no-speech" after our own timeout is not an error worth showing.
        if (code !== 'no-speech') setError(message);
      },
      onEnd: () => {
        clearTimers();
        setListening(false);
        setPartial('');
        sessionRef.current = null;
        const text = (finalTranscript || lastTranscript).trim();
        if (text) onCommandRef.current(text);
      },
    });

    if (session) {
      sessionRef.current = session;
      setListening(true);
      armSilence(NO_SPEECH_TIMEOUT_MS);
      hardTimer.current = setTimeout(() => sessionRef.current?.stop(), MAX_UTTERANCE_MS);
    }
  }, [available, locale, t]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  return { available, listening, partial, error, toggle, start, stop, clearError: () => setError(null) };
}
