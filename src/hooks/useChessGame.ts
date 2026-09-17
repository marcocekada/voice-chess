import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import * as Haptics from 'expo-haptics';
import type { CandidateMove, ConversationContext, GameStatus, PlayerColor, SavedGame } from '../chess/types';
import {
  buildSavedGame,
  colorName,
  colorToChess,
  describeMove,
  deriveStatus,
  isPlayerTurn,
  restoreChess,
} from '../chess/game';
import { parseCommand } from '../chess/moveParser';
import { resolveClarification, resolveIntent } from '../chess/moveResolver';
import { cancelSearch, getBestMove } from '../engine';
import { createGameId, gameRepository } from '../storage/gameRepository';
import { useI18n } from '../i18n';
import { useSettings } from './useSettings';
import { tts } from '../voice/tts';
import type { LegalTarget } from '../components/ChessBoard/ChessBoard';

export type GameSource = { gameId: string } | { newGame: { playerColor: PlayerColor; opponentElo: number } };

export interface FeedbackMessage {
  text: string;
  kind: 'info' | 'error' | 'success' | 'question';
}

export interface Clarification {
  candidates: CandidateMove[];
  question: string;
}

interface GameMeta {
  id: string;
  createdAt: string;
  playerColor: PlayerColor;
  opponentElo: number;
}

export function useChessGame(source: GameSource) {
  const { t, language, locale } = useI18n();
  const { voiceFeedback } = useSettings();

  const chessRef = useRef(new Chess());
  const metaRef = useRef<GameMeta | null>(null);
  const statusOverrideRef = useRef<GameStatus | null>(null);
  const contextRef = useRef<ConversationContext>({
    lastOpponentMove: null,
    lastUserMove: null,
    lastMentionedPiece: null,
  });
  const mountedRef = useRef(true);
  const thinkingRef = useRef(false);

  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isEngineThinking, setEngineThinking] = useState(false);
  const [clarification, setClarification] = useState<Clarification | null>(null);
  const [message, setMessage] = useState<FeedbackMessage | null>(null);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const bump = useCallback(() => setTick((n) => n + 1), []);

  const speak = useCallback(
    (text: string) => {
      if (voiceFeedback) tts.speak(text, locale);
    },
    [voiceFeedback, locale],
  );

  /* --------------------------------- persistence -------------------------------- */

  const persist = useCallback(async () => {
    const meta = metaRef.current;
    if (!meta) return;
    const saved = buildSavedGame(meta, chessRef.current, statusOverrideRef.current ?? undefined);
    await gameRepository.save(saved).catch(() => undefined);
  }, []);

  /* ---------------------------------- derived ----------------------------------- */

  const derived = useMemo(() => {
    const chess = chessRef.current;
    const meta = metaRef.current;
    const status: GameStatus = statusOverrideRef.current ?? deriveStatus(chess);
    const history = chess.history({ verbose: true });
    const lastMove = history.length ? history[history.length - 1] : null;
    const inCheck = chess.inCheck();
    let checkSquare: Square | null = null;
    if (inCheck) {
      const board = chess.board();
      for (const row of board) {
        for (const sq of row) {
          if (sq && sq.type === 'k' && sq.color === chess.turn()) checkSquare = sq.square;
        }
      }
    }
    const playerColor = meta?.playerColor ?? 'white';
    const saved: SavedGame | null = meta ? buildSavedGame(meta, chess, status) : null;
    return {
      fen: chess.fen(),
      turn: chess.turn(),
      status,
      isGameOver: status !== 'active',
      history,
      lastMove,
      inCheck,
      checkSquare,
      playerColor,
      opponentElo: meta?.opponentElo ?? 1200,
      isPlayerTurn: status === 'active' && isPlayerTurn(chess, playerColor),
      result: saved?.result,
      moveCount: history.length,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, loading]);

  const legalTargets = useMemo<LegalTarget[]>(() => {
    if (!selectedSquare) return [];
    return chessRef.current
      .moves({ square: selectedSquare, verbose: true })
      .map((m) => ({ square: m.to, capture: !!m.captured }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSquare, tick]);

  /* ---------------------------------- feedback ---------------------------------- */

  const announceGameEnd = useCallback(
    (status: GameStatus) => {
      const chess = chessRef.current;
      const meta = metaRef.current;
      if (!meta) return;
      let text = '';
      switch (status) {
        case 'checkmate': {
          const playerMated = chess.turn() === colorToChess(meta.playerColor);
          text = `${t.feedback.checkmate} ${playerMated ? t.feedback.youLose : t.feedback.youWin}`;
          break;
        }
        case 'stalemate':
          text = t.feedback.stalemate;
          break;
        case 'threefold_repetition':
          text = t.feedback.threefold;
          break;
        case 'insufficient_material':
          text = t.feedback.insufficient;
          break;
        case 'fifty_moves':
          text = t.feedback.fifty;
          break;
        case 'resigned':
          text = t.feedback.resigned;
          break;
        default:
          text = t.game.draw;
      }
      setMessage({ text, kind: 'info' });
      speak(text);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    },
    [speak, t],
  );

  /* ---------------------------------- engine ------------------------------------ */

  const engineTurn = useCallback(async () => {
    const chess = chessRef.current;
    const meta = metaRef.current;
    if (!meta || thinkingRef.current) return;
    if (deriveStatus(chess) !== 'active' || isPlayerTurn(chess, meta.playerColor)) return;

    thinkingRef.current = true;
    setEngineThinking(true);
    const fenAtStart = chess.fen();
    try {
      const { uci } = await getBestMove(fenAtStart, { elo: meta.opponentElo });
      if (!mountedRef.current || chess.fen() !== fenAtStart) return;
      const move = chess.move({
        from: uci.slice(0, 2) as Square,
        to: uci.slice(2, 4) as Square,
        promotion: (uci[4] as PieceSymbol | undefined) ?? undefined,
      });
      contextRef.current.lastOpponentMove = move;
      bump();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => undefined);

      const status = deriveStatus(chess);
      const moveText = describeMove(move, t);
      const said = t.feedback.opponentPlays(colorName(move.color, t), moveText);
      if (status !== 'active') {
        await persist();
        announceGameEnd(status);
      } else {
        const text = chess.inCheck() ? `${said} ${t.feedback.check}` : said;
        setMessage({ text, kind: 'info' });
        speak(text);
        await persist();
      }
    } catch {
      // cancelled or engine failure: leave the position untouched
    } finally {
      thinkingRef.current = false;
      if (mountedRef.current) setEngineThinking(false);
    }
  }, [announceGameEnd, bump, persist, speak, t]);

  /* ------------------------------------ load ------------------------------------ */

  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    (async () => {
      if ('newGame' in source) {
        chessRef.current = new Chess();
        metaRef.current = {
          id: createGameId(),
          createdAt: new Date().toISOString(),
          playerColor: source.newGame.playerColor,
          opponentElo: source.newGame.opponentElo,
        };
        statusOverrideRef.current = null;
        await persist();
      } else {
        const saved = await gameRepository.get(source.gameId);
        if (cancelled) return;
        if (!saved) {
          setLoadError('not-found');
          setLoading(false);
          return;
        }
        const { chess } = restoreChess(saved);
        chessRef.current = chess;
        metaRef.current = {
          id: saved.id,
          createdAt: saved.createdAt,
          playerColor: saved.playerColor,
          opponentElo: saved.opponentElo,
        };
        statusOverrideRef.current = saved.status === 'resigned' ? 'resigned' : null;
        const history = chess.history({ verbose: true });
        const last = history[history.length - 1] ?? null;
        if (last) {
          if (last.color === colorToChess(saved.playerColor)) contextRef.current.lastUserMove = last;
          else contextRef.current.lastOpponentMove = last;
        }
      }
      if (cancelled) return;
      setLoading(false);
      bump();
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      cancelSearch();
      tts.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When the position is the computer's to move (new game as black, or resumed mid-think), let it play.
  useEffect(() => {
    if (loading) return;
    if (!derived.isGameOver && !derived.isPlayerTurn && !thinkingRef.current) {
      const timer = setTimeout(() => void engineTurn(), 450);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [loading, derived.isGameOver, derived.isPlayerTurn, engineTurn]);

  // Save when the app goes to background and on unmount.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background' || state === 'inactive') void persist();
    });
    return () => {
      sub.remove();
      void persist();
    };
  }, [persist]);

  /* --------------------------------- user moves --------------------------------- */

  const applyUserMove = useCallback(
    async (candidate: Move) => {
      const chess = chessRef.current;
      const meta = metaRef.current;
      if (!meta) return;
      let move: Move;
      try {
        move = chess.move({ from: candidate.from, to: candidate.to, promotion: candidate.promotion });
      } catch {
        setMessage({ text: t.feedback.illegal, kind: 'error' });
        return;
      }
      contextRef.current.lastUserMove = move;
      setClarification(null);
      setSelectedSquare(null);
      bump();
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => undefined);

      const status = deriveStatus(chess);
      await persist();
      if (status !== 'active') {
        announceGameEnd(status);
        return;
      }
      const text = chess.inCheck() ? `${describeMove(move, t)}. ${t.feedback.check}` : describeMove(move, t);
      setMessage({ text: capitalize(text), kind: 'success' });
      void engineTurn();
    },
    [announceGameEnd, bump, engineTurn, persist, t],
  );

  const handleResolution = useCallback(
    (result: ReturnType<typeof resolveIntent>) => {
      switch (result.type) {
        case 'move':
          void applyUserMove(result.move);
          break;
        case 'ambiguous':
          setClarification({ candidates: result.candidates, question: result.question });
          setMessage({ text: result.question, kind: 'question' });
          speak(result.question);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
          break;
        case 'error':
          setMessage({ text: result.message, kind: 'error' });
          speak(result.message);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
          break;
      }
    },
    [applyUserMove, speak],
  );

  const submitCommand = useCallback(
    (raw: string) => {
      const text = raw.trim();
      if (!text) return;
      setLastCommand(text);
      if (derived.isGameOver) return;
      if (!derived.isPlayerTurn || thinkingRef.current) {
        setMessage({ text: t.feedback.notYourTurn, kind: 'error' });
        return;
      }

      const intent = parseCommand(text, language);
      if (intent.kind === 'move' && intent.piece) contextRef.current.lastMentionedPiece = intent.piece;

      if (clarification) {
        const narrowed = resolveClarification(clarification.candidates, intent, t);
        if (narrowed) {
          if (narrowed.type === 'error') {
            setMessage({ text: `${narrowed.message} ${clarification.question}`, kind: 'error' });
            speak(narrowed.message);
            return;
          }
          handleResolution(narrowed);
          return;
        }
        // Not an answer: treat it as a brand-new command.
        setClarification(null);
      }

      handleResolution(resolveIntent(intent, chessRef.current, contextRef.current, t));
    },
    [clarification, derived.isGameOver, derived.isPlayerTurn, handleResolution, language, speak, t],
  );

  const chooseCandidate = useCallback(
    (move: CandidateMove) => {
      void applyUserMove(move);
    },
    [applyUserMove],
  );

  const cancelClarification = useCallback(() => {
    setClarification(null);
    setSelectedSquare(null);
    setMessage(null);
  }, []);

  const pressSquare = useCallback(
    (square: Square) => {
      if (derived.isGameOver || !derived.isPlayerTurn || thinkingRef.current) return;
      const chess = chessRef.current;

      if (selectedSquare) {
        const moves = chess.moves({ square: selectedSquare, verbose: true }).filter((m) => m.to === square);
        if (moves.length === 1) {
          void applyUserMove(moves[0]);
          return;
        }
        if (moves.length > 1) {
          // promotion: let the user pick the piece
          setClarification({ candidates: moves, question: t.feedback.promotionNeeded });
          setMessage({ text: t.feedback.promotionNeeded, kind: 'question' });
          return;
        }
      }

      const piece = chess.get(square);
      if (piece && piece.color === chess.turn()) {
        setSelectedSquare(square === selectedSquare ? null : square);
        Haptics.selectionAsync().catch(() => undefined);
      } else {
        setSelectedSquare(null);
      }
    },
    [applyUserMove, derived.isGameOver, derived.isPlayerTurn, selectedSquare, t],
  );

  const resign = useCallback(async () => {
    if (derived.isGameOver) return;
    cancelSearch();
    statusOverrideRef.current = 'resigned';
    setClarification(null);
    setSelectedSquare(null);
    bump();
    await persist();
    announceGameEnd('resigned');
  }, [announceGameEnd, bump, derived.isGameOver, persist]);

  return {
    loading,
    loadError,
    ...derived,
    isEngineThinking,
    clarification,
    message,
    lastCommand,
    selectedSquare,
    legalTargets,
    submitCommand,
    chooseCandidate,
    cancelClarification,
    pressSquare,
    resign,
    saveNow: persist,
    describeMove: (m: Move) => describeMove(m, t),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
