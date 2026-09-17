import { useCallback, useEffect, useRef, useState } from 'react';
import { speechRecognition, type SpeechSession } from '../voice/speechRecognition';
import { useI18n } from '../i18n';

/**
 * Push-to-talk voice input. One utterance per tap; the final transcript is
 * handed to `onCommand`. Falls back to `available: false` in Expo Go.
 */
export function useVoiceCommands(onCommand: (text: string) => void) {
  const { locale, t } = useI18n();
  const [available] = useState(() => speechRecognition.isAvailable());
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  const sessionRef = useRef<SpeechSession | null>(null);
  const onCommandRef = useRef(onCommand);
  onCommandRef.current = onCommand;

  useEffect(() => {
    return () => {
      sessionRef.current?.abort();
      sessionRef.current = null;
    };
  }, []);

  const stop = useCallback(() => {
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
    let finalText = '';
    const session = speechRecognition.start(locale, {
      onStart: () => setListening(true),
      onPartial: (text) => setPartial(text),
      onFinal: (text) => {
        finalText = text;
      },
      onError: (message) => {
        setError(message);
      },
      onEnd: () => {
        setListening(false);
        setPartial('');
        sessionRef.current = null;
        if (finalText.trim()) onCommandRef.current(finalText);
      },
    });
    if (session) {
      sessionRef.current = session;
      setListening(true);
    }
  }, [available, locale, t]);

  const toggle = useCallback(() => {
    if (listening) stop();
    else void start();
  }, [listening, start, stop]);

  return { available, listening, partial, error, toggle, start, stop, clearError: () => setError(null) };
}
