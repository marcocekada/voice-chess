import React, { useEffect, useRef, useState } from 'react';
import { Platform, View } from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { Asset } from 'expo-asset';
import type { ChessEngine, EngineOptions } from './ChessEngine';

/**
 * Stockfish 19 (lite NNUE, single-threaded WebAssembly) running inside a hidden
 * WebView. UCI lines travel over the WebView bridge; see scripts/build-stockfish.ts
 * for the page side. Mount <StockfishHost /> once near the app root.
 *
 * Stockfish's own strength limitation (UCI_LimitStrength / UCI_Elo) covers
 * 1320–3190 Elo; below that the app uses LocalJsEngine (see engine/index.ts).
 */

export const STOCKFISH_MIN_ELO = 1320;
export const STOCKFISH_MAX_ELO = 3190;

type LineListener = (line: string) => void;
type BridgeStatus = 'idle' | 'loading' | 'ready' | 'failed';

class StockfishBridge {
  private webview: WebView | null = null;
  private status: BridgeStatus = 'idle';
  private listeners = new Set<LineListener>();
  private readyWaiters: ((ok: boolean) => void)[] = [];
  private outbox: string[] = [];

  getStatus(): BridgeStatus {
    return this.status;
  }

  isReady(): boolean {
    return this.status === 'ready';
  }

  setStatus(status: BridgeStatus): void {
    this.status = status;
    if (status === 'ready') {
      this.outbox.forEach((cmd) => this.inject(cmd));
      this.outbox = [];
    }
    if (status === 'ready' || status === 'failed') {
      const ok = status === 'ready';
      this.readyWaiters.forEach((w) => w(ok));
      this.readyWaiters = [];
    }
  }

  attach(webview: WebView | null): void {
    this.webview = webview;
  }

  whenReady(timeoutMs: number): Promise<boolean> {
    if (this.status === 'ready') return Promise.resolve(true);
    if (this.status === 'failed') return Promise.resolve(false);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.readyWaiters = this.readyWaiters.filter((w) => w !== waiter);
        resolve(false);
      }, timeoutMs);
      const waiter = (ok: boolean) => {
        clearTimeout(timer);
        resolve(ok);
      };
      this.readyWaiters.push(waiter);
    });
  }

  send(cmd: string): void {
    if (this.status !== 'ready') {
      this.outbox.push(cmd);
      return;
    }
    this.inject(cmd);
  }

  private inject(cmd: string): void {
    const js = `window.sendUci(${JSON.stringify(cmd)}); true;`;
    this.webview?.injectJavaScript(js);
  }

  subscribe(listener: LineListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  handleMessage(line: string): void {
    if (line === '__ready') {
      this.setStatus('ready');
      return;
    }
    if (line.startsWith('__error')) {
      if (this.status !== 'ready') this.setStatus('failed');
      return;
    }
    this.listeners.forEach((l) => l(line));
  }
}

export const stockfishBridge = new StockfishBridge();

/* --------------------------------- host view --------------------------------- */

// eslint-disable-next-line @typescript-eslint/no-require-imports
const ENGINE_PAGE = require('../../assets/engine/stockfish.html');

export function StockfishHost() {
  const ref = useRef<WebView>(null);
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    if (Platform.OS === 'web') {
      stockfishBridge.setStatus('failed');
      return;
    }
    stockfishBridge.setStatus('loading');
    let cancelled = false;
    Asset.fromModule(ENGINE_PAGE)
      .downloadAsync()
      .then((asset) => {
        if (cancelled) return;
        if (asset.localUri) setUri(asset.localUri);
        else stockfishBridge.setStatus('failed');
      })
      .catch(() => {
        if (!cancelled) stockfishBridge.setStatus('failed');
      });
    return () => {
      cancelled = true;
      stockfishBridge.attach(null);
    };
  }, []);

  if (!uri) return null;
  const dir = uri.slice(0, uri.lastIndexOf('/') + 1);

  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: -10, top: -10, width: 2, height: 2, opacity: 0.01 }}>
      <WebView
        ref={(w) => {
          ref.current = w;
          stockfishBridge.attach(w);
        }}
        source={{ uri }}
        originWhitelist={['*']}
        javaScriptEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs
        allowingReadAccessToURL={dir}
        cacheEnabled={false}
        mediaPlaybackRequiresUserAction={false}
        onMessage={(e: WebViewMessageEvent) => stockfishBridge.handleMessage(String(e.nativeEvent.data))}
        onError={() => stockfishBridge.setStatus('failed')}
        onHttpError={() => stockfishBridge.setStatus('failed')}
        onRenderProcessGone={() => stockfishBridge.setStatus('failed')}
        onContentProcessDidTerminate={() => stockfishBridge.setStatus('failed')}
        style={{ width: 2, height: 2, backgroundColor: 'transparent' }}
      />
    </View>
  );
}

/* ---------------------------------- engine ----------------------------------- */

interface PendingSearch {
  resolve: (uci: string) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

function moveTimeForElo(elo: number): number {
  if (elo < 2000) return 700;
  if (elo < 2600) return 1100;
  if (elo < 3000) return 1600;
  return 2200;
}

export class StockfishWebViewEngine implements ChessEngine {
  readonly name = 'Stockfish 19 lite (WASM)';
  private pending: PendingSearch | null = null;
  private unsubscribe: (() => void) | null = null;
  private configured = false;

  private ensureListening(): void {
    if (this.unsubscribe) return;
    this.unsubscribe = stockfishBridge.subscribe((line) => {
      const m = /^bestmove\s+(\S+)/.exec(line);
      if (!m || !this.pending) return;
      const { resolve, reject, timer } = this.pending;
      clearTimeout(timer);
      this.pending = null;
      if (m[1] === '(none)') reject(new Error('No legal moves'));
      else resolve(m[1]);
    });
  }

  private configure(): void {
    if (this.configured) return;
    stockfishBridge.send('uci');
    stockfishBridge.send('setoption name Threads value 1');
    stockfishBridge.send('setoption name Hash value 16');
    stockfishBridge.send('setoption name Ponder value false');
    stockfishBridge.send('ucinewgame');
    this.configured = true;
  }

  isAvailable(): boolean {
    return stockfishBridge.isReady();
  }

  async getBestMove(fen: string, options: EngineOptions): Promise<string> {
    const ready = await stockfishBridge.whenReady(10_000);
    if (!ready) throw new Error('stockfish-unavailable');
    this.ensureListening();
    this.configure();

    // A previous search still running (e.g. user resigned mid-think): stop it and
    // wait for its bestmove so the next one is not mistaken for it.
    if (this.pending) await this.drainPending();

    const elo = Math.round(options.elo);
    const limited = elo < STOCKFISH_MAX_ELO;
    const uciElo = Math.max(STOCKFISH_MIN_ELO, Math.min(STOCKFISH_MAX_ELO, elo));
    const moveTime = options.moveTimeMs ?? moveTimeForElo(elo);

    stockfishBridge.send(`setoption name UCI_LimitStrength value ${limited}`);
    stockfishBridge.send(`setoption name UCI_Elo value ${uciElo}`);
    stockfishBridge.send(`position fen ${fen}`);

    return new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => {
        if (this.pending) {
          stockfishBridge.send('stop');
          this.pending = null;
          reject(new Error('stockfish-timeout'));
        }
      }, moveTime + 8000);
      this.pending = { resolve, reject, timer };
      stockfishBridge.send(`go movetime ${moveTime}`);
    });
  }

  private drainPending(): Promise<void> {
    return new Promise((resolve) => {
      const prev = this.pending;
      if (!prev) return resolve();
      clearTimeout(prev.timer);
      const settle = () => resolve();
      const timer = setTimeout(() => {
        this.pending = null;
        settle();
      }, 1500);
      this.pending = {
        resolve: () => {
          clearTimeout(timer);
          settle();
        },
        reject: () => {
          clearTimeout(timer);
          settle();
        },
        timer,
      };
      stockfishBridge.send('stop');
      prev.reject(new Error('cancelled'));
    });
  }

  cancel(): void {
    if (!this.pending) return;
    stockfishBridge.send('stop');
    // Keep a silent waiter so the late bestmove is consumed, not misattributed.
    const prev = this.pending;
    clearTimeout(prev.timer);
    const timer = setTimeout(() => {
      this.pending = null;
    }, 1500);
    this.pending = {
      resolve: () => clearTimeout(timer),
      reject: () => clearTimeout(timer),
      timer,
    };
    prev.reject(new Error('cancelled'));
  }
}
