/**
 * Bundles Stockfish 19 "lite single-threaded" (nmrugg/stockfish.js, GPLv3) into a
 * single self-contained HTML page that runs inside a hidden react-native-webview.
 *
 *   npx tsx scripts/build-stockfish.ts
 *
 * Output: assets/engine/stockfish.html  (JS + WASM inlined as base64, ~2.5 MB)
 *
 * The page speaks UCI over the WebView bridge:
 *   RN -> page : window.sendUci("go movetime 1000")   (via injectJavaScript)
 *   page -> RN : window.ReactNativeWebView.postMessage(line)  one UCI output line per message
 *                plus the control lines "__ready" and "__error <message>".
 *
 * Opened directly in a desktop browser (no ReactNativeWebView), the page runs a
 * small self-test and prints the UCI dialogue on screen.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BIN = join(__dirname, '..', 'node_modules', 'stockfish', 'bin');
const OUT_DIR = join(__dirname, '..', 'assets', 'engine');
const NAME = 'stockfish-19-lite-single';

const js = readFileSync(join(BIN, `${NAME}.js`), 'utf8');
const wasmB64 = readFileSync(join(BIN, `${NAME}.wasm`)).toString('base64');
const version = JSON.parse(readFileSync(join(BIN, '..', 'package.json'), 'utf8')).version as string;

const glue = String.raw`
(function () {
  var RN = window.ReactNativeWebView;
  var log = document.getElementById('log');
  function post(line) {
    if (RN) RN.postMessage(line);
    else if (log) { log.textContent += line + '\n'; }
  }

  var b64 = document.getElementById('wasm').textContent.trim();
  var bin = atob(b64);
  var bytes = new Uint8Array(bin.length);
  for (var i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  b64 = bin = null;

  var factory = document.getElementById('sf')._exports;
  var queue = [];
  var engine = null;

  var config = {
    wasmBinary: bytes,
    locateFile: function (p) { return p; },
    // Search progress lines are noisy and useless to the app: keep the bridge quiet.
    listener: function (line) { if (line.indexOf('info depth') !== 0 && line.indexOf('info string') !== 0) post(line); },
    printErr: function (line) { post('__error ' + line); }
  };

  function raw(cmd) {
    engine.ccall('command', null, ['string'], [cmd], { async: /^go\b/.test(cmd) });
  }
  function flush() {
    while (queue.length && (!engine._isSearching || !engine._isSearching())) raw(queue.shift());
  }
  function sendUci(cmd) {
    cmd = String(cmd).trim();
    if (!cmd) return;
    if (!engine) { queue.push(cmd); return; }
    if (/^(go|setoption|position|ucinewgame)\b/.test(cmd)) { queue.push(cmd); flush(); }
    else raw(cmd); // uci, isready, stop, quit go straight through
  }
  window.sendUci = sendUci;

  factory(config).then(function (mod) {
    (function whenReady() {
      if (mod._isReady && !mod._isReady()) return setTimeout(whenReady, 10);
      engine = mod;
      mod.onDoneSearching = function () { setTimeout(flush, 1); };
      post('__ready');
      flush();
    })();
  }).catch(function (e) {
    post('__error ' + (e && e.message ? e.message : String(e)));
  });

  if (!RN) {
    // Desktop self-test.
    sendUci('uci');
    sendUci('setoption name UCI_LimitStrength value true');
    sendUci('setoption name UCI_Elo value 2400');
    sendUci('position fen r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 4 4');
    sendUci('go movetime 1000');
  }
})();
`;

const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>Stockfish ${version} lite</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>body{margin:0;background:#F6F1E4;font:12px monospace;color:#26352B}pre{white-space:pre-wrap;padding:8px}</style>
</head><body>
<pre id="log"></pre>
<script type="text/plain" id="wasm">${wasmB64}</script>
<script id="sf">${js}</script>
<script>${glue}</script>
</body></html>
`;

mkdirSync(OUT_DIR, { recursive: true });
const out = join(OUT_DIR, 'stockfish.html');
writeFileSync(out, html);
console.log(`Wrote ${out} (${(html.length / 1024 / 1024).toFixed(2)} MB) from stockfish@${version}`);
