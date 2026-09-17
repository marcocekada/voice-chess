# Voice Chess Play — note per Claude

App mobile Expo (SDK 57, React Native 0.86, TypeScript strict) per giocare a
scacchi contro il computer con comandi vocali in italiano e inglese.
La specifica di prodotto completa è in `README.md` (sezioni 1–27); la sezione
28 descrive lo stato dell'implementazione.

## Comandi

```bash
npm install
npx expo start -c                       # Expo Go / dev client, cache pulita
npx expo start --web                    # anteprima browser (react-native-web)
npx tsc --noEmit                        # typecheck: deve restare a zero errori
npx tsx scripts/parser.selftest.ts      # parser + resolver IT/EN (deve stampare ALL OK)
npx tsx scripts/engine.selftest.ts      # tempi/mosse engine per Elo
npx tsx scripts/make-icons.ts           # rigenera tutte le icone in assets/
npx tsx scripts/build-stockfish.ts      # rigenera assets/engine/stockfish.html
```

Non esiste una suite Jest: i due selftest sopra sono la rete di sicurezza.
Dopo ogni modifica a parser, normalizzatore, resolver o i18n rilanciare
`parser.selftest.ts` e aggiungere un caso se il bug era coperto da nessuno.

## Architettura (src/)

- `chess/` — `types.ts` (SavedGame, MoveIntent, ResolveResult), `game.ts`
  (status/result da chess.js, restore con replay + verifica FEN, describeMove),
  `moveParser.ts` (testo → MoveIntent, vocabolari IT/EN), `moveResolver.ts`
  (MoveIntent → mossa legale, chiarimenti).
- `voice/` — `voiceCommandNormalizer.ts` (lettere/numeri parlati → "f3"),
  `speechRecognition.ts` (wrapper lazy su expo-speech-recognition),
  `tts.ts` (expo-speech).
- `engine/` — interfaccia `ChessEngine`. `index.ts` sceglie il motore:
  `StockfishWebViewEngine` (Stockfish 19 lite WASM in una WebView nascosta,
  `<StockfishHost/>` montato in App.tsx, UCI via `injectJavaScript`/`onMessage`)
  da 1320 Elo in su; `LocalJsEngine` (alpha-beta su chess.js, `profileForElo`)
  sotto 1320 o come ripiego. Entrambi restituiscono UCI ("e2e4", "e7e8q").
  La pagina `assets/engine/stockfish.html` è generata da
  `scripts/build-stockfish.ts` (JS + WASM inlinati); `metro.config.js` aggiunge
  `html` agli assetExts.
- `storage/` — `gameRepository.ts` su AsyncStorage (array JSON, scritture serializzate).
- `hooks/useChessGame.ts` — tutto il flusso di partita: comandi, touch,
  chiarimenti, engine, salvataggio (dopo ogni mossa, background, unmount).
- `hooks/useVoiceCommands.ts` — push-to-talk; `available:false` in Expo Go.
- `i18n/` — `it.ts` è la fonte dei tipi (`Translations`), `en.ts` deve
  combaciare. Lingua predefinita italiano (`DEFAULT_LANGUAGE`); l'utente può
  passare all'inglese dalla Home, scelta salvata in AsyncStorage.
- `components/ChessBoard/` — scacchiera in View + SvgXml, pezzi cburnett
  inlinati in `pieceSvgs.ts`, animazioni con `Animated`.
- `screens/`, `navigation/` — stack: Home, NewGame, Game, History.
- `theme/index.ts` — colori/spaziature; le icone leggono gli stessi token.

## Regole del progetto

- chess.js è l'unica fonte di verità: nessuna mossa arriva alla UI o allo
  storage se `chess.move()` non l'ha accettata. Il parser non tocca la posizione.
- Il resolver non indovina: 0 candidati → errore, 1 → esegue, N → domanda
  con `candidates`; la risposta passa da `resolveClarification`.
- Portrait only, light mode only (`app.json`).
- Testi utente sempre in entrambe le lingue; in italiano rispettare il genere
  dei pezzi (torre/donna femminili, helper in `it.ts`).
- Non importare `expo-speech-recognition` staticamente: in Expo Go il modulo
  nativo manca e l'import lancia. Passare sempre da `speechRecognition.ts`,
  che controlla `requireOptionalNativeModule` prima del `require`.

## Gotchas

- Expo Go: niente microfono (modulo nativo assente), la GameScreen apre la
  tastiera. Voce reale solo in Development Build (`expo-dev-client` installato)
  o build EAS.
- LocalJsEngine gira sul thread JS: cede il controllo tra le mosse radice
  (`yieldToUi`), i budget di tempo sono in `profileForElo`. Vale ~1400-1600
  Elo reali al massimo: sopra 1320 si usa sempre Stockfish.
- Stockfish è GPLv3: l'app che lo include deve rendere disponibile il sorgente.
- La WebView di Stockfish non gira su web (react-native-webview non ha
  supporto web): lì si usa LocalJsEngine, segnalato come `degraded`.
- `assets/icon.png` deve restare RGB senza alpha (App Store); lo script
  `make-icons.ts` produce RGBA, la conversione è fatta con PIL alla fine.
- Pezzi cburnett: CC BY-SA 3.0, attribuzione in README.
- Bundle id: `com.bohtech.voicechess` (iOS e Android). Build/submit: `eas.json`.
