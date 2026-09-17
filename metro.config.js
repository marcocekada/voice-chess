// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// The Stockfish WebAssembly engine ships as a single self-contained HTML page
// (assets/engine/stockfish.html) loaded by a hidden WebView.
if (!config.resolver.assetExts.includes('html')) {
  config.resolver.assetExts.push('html');
}

module.exports = config;
