# Voice Chess Play --- React Native / Expo

**Licenza: GPLv3** (vedi `LICENSE`). L'app incorpora
[Stockfish](https://stockfishchess.org) tramite
[stockfish.js](https://github.com/nmrugg/stockfish.js), entrambi GPLv3; il
codice dell'app è quindi distribuito con la stessa licenza. Il link al
repository pubblico va indicato nella scheda dello store e in
`src/config/about.ts` (`SOURCE_CODE_URL`).

## 1. Obiettivo

**Voice Chess Play** è un'app mobile sviluppata con **React Native + Expo**
che permette di giocare una partita a scacchi contro il computer
principalmente tramite comandi vocali.

L'obiettivo dell'MVP è mantenere l'app estremamente semplice:

-   nessun account;
-   nessun profilo;
-   nessun backend obbligatorio;
-   avvio rapido di una nuova partita;
-   scelta della forza dell'avversario;
-   scacchiera sempre visibile;
-   mosse impartite vocalmente;
-   aggiornamento grafico immediato della posizione;
-   risposta del computer;
-   salvataggio automatico delle partite in locale;
-   possibilità di riprendere una partita interrotta.

Esempio:

> Utente: "Cavallo in f3"

L'app riconosce il comando, determina la mossa legale corrispondente,
muove graficamente il cavallo e lascia giocare l'avversario.

------------------------------------------------------------------------

## 2. Stack proposto

### MVP

-   **React Native**
-   **Expo**
-   **TypeScript**
-   **chess.js** --- stato della partita, generazione e validazione
    delle mosse
-   **AsyncStorage** --- persistenza locale delle partite
-   componente React Native per la visualizzazione della scacchiera
-   speech-to-text compatibile con Expo / piattaforma
-   engine scacchistico JavaScript compatibile con l'ambiente
    disponibile

### Evoluzione

Se un engine sufficientemente forte o configurabile non funziona bene in
**Expo Go**, il progetto dovrà passare a una **Expo Development Build**,
mantenendo comunque Expo come framework.

Questo permetterà, per esempio, di integrare una build nativa di
**Stockfish**.

------------------------------------------------------------------------

## 3. Schermata iniziale

La schermata iniziale deve essere minimale.

Elementi principali:

1.  **Nuova partita**
2.  **Riprendi partita** --- mostrato se esiste almeno una partita non
    terminata
3.  **Storico partite**

Non sono richiesti login, registrazione o sincronizzazione cloud
nell'MVP.

------------------------------------------------------------------------

## 4. Creazione di una partita

Premendo **Nuova partita**, l'utente sceglie la forza dell'avversario.

### Forza avversario

Intervallo indicativo:

**200 -- 3400 Elo**

L'interfaccia può utilizzare:

-   slider;
-   input numerico;
-   preset.

Esempi di preset:

-   400 --- Principiante
-   800 --- Base
-   1200 --- Intermedio
-   1600 --- Buon giocatore
-   2000 --- Esperto
-   2400 --- Molto forte
-   2800 --- Estremamente forte
-   3200+ --- Motore quasi al massimo

Il valore mostrato all'utente rappresenta una **forza Elo
approssimativa**, non necessariamente un rating FIDE reale.

Se viene utilizzato Stockfish, quando disponibile si potranno usare le
opzioni UCI di limitazione della forza, come `UCI_LimitStrength` e
`UCI_Elo`.

------------------------------------------------------------------------

## 5. Gameplay principale

Durante la partita devono essere visibili almeno:

-   scacchiera;
-   indicazione del turno;
-   pulsante microfono;
-   ultimo comando riconosciuto;
-   eventuale messaggio di errore/chiarimento;
-   pulsante per uscire dalla partita.

Flusso:

``` text
Utente parla
    ↓
Speech-to-text
    ↓
Parser comando
    ↓
Ricerca mosse legali compatibili
    ↓
0 mosse → errore
1 mossa → esegui
N mosse → chiedi chiarimento
    ↓
Aggiorna chess.js
    ↓
Anima la scacchiera
    ↓
Salva posizione
    ↓
Mossa computer
    ↓
Aggiorna scacchiera
    ↓
Salva nuovamente
```

------------------------------------------------------------------------

## 6. Interpretazione dei comandi vocali

Il parser non deve modificare direttamente la posizione.

Deve trasformare la frase dell'utente in un'intenzione strutturata e
confrontarla con le **mosse legali generate da chess.js**.

Esempio:

> "Cavallo in f3"

Parser:

``` ts
{
  piece: "n",
  to: "f3"
}
```

A questo punto vengono cercate tutte le mosse legali che:

-   muovono un cavallo;
-   terminano in `f3`.

### Un solo candidato

Se esiste una sola mossa compatibile, viene eseguita automaticamente.

### Nessun candidato

L'app risponde, per esempio:

> "Nessun cavallo può andare in f3."

La posizione non cambia.

### Più candidati

Se due cavalli possono raggiungere `f3`, l'app **non deve indovinare**.

Esempio:

> "Quale cavallo intendi, quello in d2 o quello in h2?"

L'app entra nello stato `awaitingClarification`.

L'utente può quindi dire:

> "Quello in d2."

La mossa viene completata senza richiedere di ripetere l'intero comando.

------------------------------------------------------------------------

## 7. Tipologie di comandi da supportare

Il parser deve comprendere almeno frasi equivalenti a:

``` text
Pedone in e4
Pedone da e2 a e4
Cavallo in f3
Cavallo da g1 a f3
Alfiere in b5
Torre in e1
Donna in h5
Re in g1
Cavallo mangia in e5
Mangia il cavallo
Mangialo col pedone
Arrocco corto
Arrocco lungo
Promuovi a donna
```

Deve inoltre tollerare varianti naturali del parlato.

Per esempio:

``` text
Muovi il cavallo in f3
Porta il cavallo in f3
Cavallo f3
Il cavallo va in f3
Metti il pedone in e4
Mangialo con il cavallo
```

------------------------------------------------------------------------

## 8. Contesto conversazionale

Il sistema deve mantenere un piccolo contesto delle ultime azioni.

Questo permette di comprendere comandi come:

> "Mangialo col cavallo."

Il pronome `lo` deve essere risolto utilizzando:

-   posizione corrente;
-   ultima mossa;
-   ultimo pezzo menzionato;
-   catture legali disponibili.

La regola fondamentale rimane:

**l'interpretazione finale deve sempre corrispondere a una mossa
legale.**

Se esistono più interpretazioni legali, chiedere chiarimento.

------------------------------------------------------------------------

## 9. chess.js come fonte di verità

`chess.js` deve essere la fonte di verità per lo stato della partita.

Non bisogna mantenere una seconda implementazione indipendente delle
regole degli scacchi.

Utilizzi principali:

``` ts
chess.moves({ verbose: true })
chess.move(...)
chess.fen()
chess.pgn()
chess.turn()
chess.isCheck()
chess.isCheckmate()
chess.isStalemate()
chess.isThreefoldRepetition()
chess.isDraw()
chess.isGameOver()
```

Prima di utilizzare una specifica API verificare la versione installata
di `chess.js`.

------------------------------------------------------------------------

## 10. Engine dell'avversario

L'architettura deve astrarre il motore tramite un'interfaccia.

``` ts
interface ChessEngine {
  getBestMove(
    fen: string,
    options: {
      elo: number;
      moveTimeMs?: number;
    }
  ): Promise<string>;
}
```

Questo evita di legare tutta l'app a Stockfish.

Possibili implementazioni:

``` text
LocalJsEngine
StockfishNativeEngine
RemoteEngine
```

### Fase Expo Go

Per il prototipo si preferisce un engine JavaScript che possa essere
eseguito senza codice nativo aggiuntivo.

### Fase successiva

Se necessario, usare Expo Development Build e integrare Stockfish
nativo.

------------------------------------------------------------------------

## 11. Elo e difficoltà

Non bisogna simulare la difficoltà semplicemente scegliendo casualmente
mosse sbagliate.

L'engine dovrebbe possibilmente supportare una forza limitata.

Con Stockfish:

``` text
setoption name UCI_LimitStrength value true
setoption name UCI_Elo value <rating>
```

Il rating mostrato nell'app è comunque da considerare
**approssimativo**.

Una futura fase di calibrazione potrà verificare se, per esempio, "1200"
nell'app produce realmente un'esperienza paragonabile a un giocatore
umano di quella fascia.

------------------------------------------------------------------------

## 12. Persistenza locale

**Tutte le partite devono essere salvate automaticamente in locale.**

Per l'MVP utilizzare:

``` text
@react-native-async-storage/async-storage
```

Il salvataggio deve avvenire almeno:

-   dopo ogni mossa dell'utente;
-   dopo ogni mossa del computer;
-   quando l'app passa in background;
-   quando l'utente esce dalla schermata partita.

Non deve essere necessario premere manualmente "Salva".

------------------------------------------------------------------------

## 13. Modello dati partita

Esempio:

``` ts
type GameStatus =
  | "active"
  | "checkmate"
  | "stalemate"
  | "threefold_repetition"
  | "draw"
  | "resigned";

interface SavedGame {
  id: string;
  createdAt: string;
  updatedAt: string;

  status: GameStatus;

  playerColor: "white" | "black";
  opponentElo: number;

  fen: string;
  pgn: string;

  moveHistory: string[];

  result?: "1-0" | "0-1" | "1/2-1/2";
}
```

Per rendere affidabile il ripristino è consigliabile salvare sia:

-   **FEN** della posizione corrente;
-   **PGN / cronologia completa delle mosse**.

La cronologia completa è importante anche per regole che dipendono dalla
storia della partita.

------------------------------------------------------------------------

## 14. Storico partite

La home contiene la voce:

**Storico partite**

Ogni partita mostra almeno:

``` text
Data
Colore giocatore
Elo avversario
Numero mosse
Stato
Risultato
```

Esempio:

``` text
16/09/2026 — vs 1200
Bianco
27 mosse
In corso

[RIPRENDI]
```

Una partita terminata può invece mostrare:

``` text
15/09/2026 — vs 1600
Nero
Scacco matto
0-1

[VEDI PARTITA]
```

------------------------------------------------------------------------

## 15. Riprendere una partita

Se `status === "active"`, nello storico deve comparire:

**Riprendi**

Premendolo:

1.  caricare il salvataggio;
2.  ricostruire la partita;
3.  verificare la coerenza della posizione;
4.  mostrare la scacchiera;
5.  ripristinare il turno corretto;
6.  continuare normalmente.

La partita deve poter essere ripresa anche dopo:

-   chiusura completa dell'app;
-   riavvio del telefono;
-   interruzione della sessione vocale.

------------------------------------------------------------------------

## 16. Ricostruzione della posizione

Quando possibile, la partita dovrebbe essere ricostruita dalla
cronologia delle mosse e non soltanto caricando una FEN isolata.

Esempio:

``` ts
const chess = new Chess();

for (const move of savedMoves) {
  chess.move(move);
}
```

Successivamente verificare che:

``` ts
chess.fen() === savedGame.fen
```

Questo aiuta a rilevare eventuali salvataggi corrotti o incoerenti.

------------------------------------------------------------------------

## 17. Triplice ripetizione

La partita deve applicare la regola standard della **triplice
ripetizione**.

Se la stessa posizione si verifica tre volte secondo le regole degli
scacchi, la partita può terminare in pareggio secondo la modalità
regolamentare implementata.

`chess.js` mette a disposizione funzionalità per rilevare la
ripetizione, a seconda della versione utilizzata.

Esempio concettuale:

``` ts
if (chess.isThreefoldRepetition()) {
  finishGame({
    status: "threefold_repetition",
    result: "1/2-1/2"
  });
}
```

### Nota regolamentare

Nelle regole FIDE standard la triplice ripetizione normalmente dà
diritto al giocatore di **reclamare** la patta; non è necessariamente
automatica al terzo verificarsi.

Per l'MVP possiamo semplificare deliberatamente la UX:

> alla triplice ripetizione l'app dichiara automaticamente pareggio.

Questa deve essere considerata una scelta di prodotto.

Una versione futura potrà mostrare:

**"Puoi reclamare il pareggio per triplice ripetizione."**

con i pulsanti:

``` text
[RECLAMA PAREGGIO]
[CONTINUA]
```

------------------------------------------------------------------------

## 18. Altre condizioni di fine partita

L'architettura deve essere predisposta almeno per:

-   scacco matto;
-   stallo;
-   materiale insufficiente;
-   triplice ripetizione;
-   regola delle 50 mosse;
-   abbandono.

Quando la partita termina:

``` ts
status !== "active"
```

e non deve più essere proposta come partita da riprendere.

------------------------------------------------------------------------

## 19. Stato applicativo suggerito

``` ts
interface GameState {
  gameId: string;

  fen: string;
  pgn: string;

  playerColor: "white" | "black";
  opponentElo: number;

  isListening: boolean;
  isEngineThinking: boolean;

  recognizedText: string | null;

  clarification: {
    active: boolean;
    candidates: CandidateMove[];
    question?: string;
  } | null;

  status: GameStatus;
}
```

------------------------------------------------------------------------

## 20. Architettura cartelle

Una possibile struttura:

``` text
src/
├── components/
│   ├── ChessBoard/
│   ├── MicrophoneButton/
│   ├── EloSelector/
│   └── GameStatus/
│
├── screens/
│   ├── HomeScreen.tsx
│   ├── NewGameScreen.tsx
│   ├── GameScreen.tsx
│   └── HistoryScreen.tsx
│
├── chess/
│   ├── game.ts
│   ├── moveParser.ts
│   ├── moveResolver.ts
│   ├── ambiguityResolver.ts
│   └── types.ts
│
├── engine/
│   ├── ChessEngine.ts
│   ├── LocalJsEngine.ts
│   └── StockfishEngine.ts
│
├── voice/
│   ├── speechRecognition.ts
│   └── voiceCommandNormalizer.ts
│
├── storage/
│   ├── gameRepository.ts
│   └── storageKeys.ts
│
└── hooks/
    ├── useChessGame.ts
    └── useVoiceCommands.ts
```

------------------------------------------------------------------------

## 21. Separazione fondamentale

L'app deve mantenere separati quattro livelli:

### Speech recognition

Trasforma:

``` text
audio → testo
```

### Natural-language parser

Trasforma:

``` text
"Cavallo in f3"
```

in:

``` ts
{
  piece: "n",
  destination: "f3"
}
```

### Chess resolver

Confronta l'intenzione con le mosse legali e determina la mossa esatta.

### Chess engine

Decide esclusivamente la mossa dell'avversario.

Questa separazione è importante per evitare che l'AI o il riconoscimento
vocale possano creare posizioni illegali.

------------------------------------------------------------------------

## 22. Principio di sicurezza della posizione

**Nessuna mossa deve essere applicata alla UI prima che chess.js l'abbia
accettata.**

Flusso corretto:

``` text
voce
→ interpretazione
→ validazione chess.js
→ aggiornamento stato
→ animazione UI
→ persistenza
```

Mai:

``` text
voce
→ animazione
→ tentativo di correggere lo stato dopo
```

La scacchiera visualizzata deve essere sempre una rappresentazione dello
stato ufficiale della partita.

------------------------------------------------------------------------

## 23. Gestione errori vocali

Esempio:

Utente:

> "Cavallo in effe tre"

Speech-to-text potrebbe produrre:

``` text
cavallo in f3
cavallo in effe 3
cavallo f tre
```

Il normalizzatore deve convertire varianti comuni nelle coordinate
standard.

Esempio:

``` ts
"effe tre" -> "f3"
"ci sei" -> "c6"
"bi quattro" -> "b4"
```

Il normalizzatore italiano sarà quindi una parte importante dell'MVP.

------------------------------------------------------------------------

## 24. Feedback vocale dell'app

L'app può opzionalmente rispondere anche tramite text-to-speech.

Esempi:

``` text
"Mossa eseguita."
"Il Nero gioca cavallo in c6."
"Quella mossa non è possibile."
"Quale cavallo intendi?"
"Scacco."
"Scacco matto."
"Pareggio per triplice ripetizione."
```

La risposta vocale deve essere breve, perché la scacchiera fornisce già
il contesto visivo.

------------------------------------------------------------------------

## 25. MVP --- ordine di sviluppo

### Fase 1 --- Scacchi senza voce

Implementare:

-   nuova partita;
-   selezione Elo;
-   scacchiera;
-   mosse touch;
-   chess.js;
-   engine;
-   salvataggio;
-   storico;
-   ripresa partita.

### Fase 2 --- Comandi testuali

Creare temporaneamente un input:

``` text
"Cavallo in f3"
```

Questo permette di sviluppare e testare parser e resolver senza
dipendere dal microfono.

### Fase 3 --- Voce

Sostituire/affiancare l'input testuale con speech-to-text.

### Fase 4 --- Conversazione

Implementare:

-   riferimenti contestuali;
-   domande di chiarimento;
-   risposte vocali;
-   gestione delle frasi naturali.

### Fase 5 --- Engine avanzato

Integrare Stockfish nativo tramite Expo Development Build se l'engine
JavaScript dell'MVP non è sufficiente.

------------------------------------------------------------------------

## 26. Criteri di successo MVP

L'MVP è riuscito quando è possibile:

1.  aprire l'app;
2.  premere **Nuova partita**;
3.  scegliere, per esempio, **1200 Elo**;
4.  iniziare con il Bianco;
5.  dire **"Pedone in e4"**;
6.  vedere il pedone animarsi da e2 a e4;
7.  vedere il computer rispondere;
8.  dire **"Cavallo in f3"**;
9.  continuare la partita vocalmente;
10. chiudere completamente l'app;
11. riaprirla;
12. entrare nello **Storico**;
13. premere **Riprendi**;
14. ritrovare esattamente la stessa posizione e continuare.

------------------------------------------------------------------------

## 27. Principio generale del progetto

La voce è l'interfaccia.

`chess.js` decide cosa è legalmente possibile.

Il motore decide cosa gioca l'avversario.

La scacchiera mostra sempre lo stato reale.

La persistenza locale garantisce che una partita non venga persa se la
sessione viene interrotta.

------------------------------------------------------------------------

## 28. Stato dell'implementazione (17/09/2026)

Il repository contiene ora l'app Expo (SDK 57, TypeScript) che copre le
Fasi 1–5: comandi vocali e Stockfish WebAssembly come avversario.

### Come avviare

``` bash
npm install
npx expo start          # QR code per Expo Go (iOS/Android)
npx expo start --web    # anteprima nel browser
```

Verifiche rapide senza device:

``` bash
npx tsc --noEmit                      # typecheck
npx tsx scripts/parser.selftest.ts    # parser + resolver
npx tsx scripts/engine.selftest.ts    # velocità/forza LocalJsEngine per Elo
npx tsx scripts/build-stockfish.ts    # rigenera assets/engine/stockfish.html
```

### Lingua

Solo italiano: interfaccia, parser dei comandi, riconoscimento vocale
(`it-IT`) e risposte vocali.

### Voce

-   **Expo Go**: il modulo nativo `expo-speech-recognition` non è
    disponibile; l'app lo rileva e mostra direttamente la tastiera per i
    comandi testuali (stessa pipeline parser → resolver).
-   **Expo Development Build** (`npx expo run:ios` / `run:android`):
    microfono attivo, push-to-talk, trascrizione parziale a schermo.
-   Le risposte vocali usano `expo-speech` (funziona anche in Expo Go) e
    si possono disattivare dalla home.

### Engine

Due motori dietro l'interfaccia `ChessEngine`, scelti in base all'Elo
(`src/engine/index.ts`):

-   **Stockfish 19 lite (WebAssembly)** da 1320 Elo in su. Gira in una
    WebView nascosta (`react-native-webview`) caricando
    `assets/engine/stockfish.html`, una pagina autonoma con JS e WASM
    inlinati generata da `npx tsx scripts/build-stockfish.ts` a partire dal
    pacchetto npm `stockfish` (nmrugg/stockfish.js). La forza è limitata dal
    motore stesso con `UCI_LimitStrength` / `UCI_Elo` (1320–3190); a 3200+
    gioca senza limiti.
-   **LocalJsEngine** (alpha-beta su chess.js con rumore) sotto 1320 Elo e
    come ripiego se la WebView non è disponibile (anteprima web, errori).

**Licenza**: Stockfish e stockfish.js sono GPLv3. Distribuire l'app con
Stockfish incluso implica rendere disponibile il codice sorgente dell'app
secondo i termini della GPL (come fanno lichess e altre app di scacchi).

### Pezzi

Set **cburnett** (Colin M.L. Burnett, CC BY-SA 3.0) via lichess, inlinato
in `src/components/ChessBoard/pieceSvgs.ts`.

### Icone

Tutte le icone (`assets/icon.png` 1024×1024 RGB per App Store, layer
adaptive Android, splash, favicon) si rigenerano dalla stessa
composizione del logo in home con:

``` bash
npx tsx scripts/make-icons.ts
```

### Build e pubblicazione (EAS)

``` bash
eas login                 # una volta sola
eas init                  # collega il progetto all'account Expo (una volta sola)

# Development build su iPhone (microfono attivo, dev menu)
eas build --platform ios --profile development

# Build di produzione con invio automatico a App Store Connect / TestFlight
eas build --platform ios --profile production --auto-submit
```

Al primo `--auto-submit` EAS chiede l'Apple ID, il team e crea l'app su
App Store Connect se non esiste; le credenziali vengono salvate su EAS.
Il `buildNumber` iOS è incrementato automaticamente (`autoIncrement`).
