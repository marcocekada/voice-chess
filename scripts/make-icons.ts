/**
 * Generates all app icons from the same composition used by the Home logo:
 * sage-green rounded blob (tilted), white cburnett knight, coral microphone badge.
 *
 *   npx tsx scripts/make-icons.ts
 *
 * Outputs (in ./assets):
 *   icon.png                     1024x1024 opaque  (iOS / App Store)
 *   android-icon-foreground.png  1024x1024 alpha   (adaptive icon layer)
 *   android-icon-background.png  1024x1024 opaque  (adaptive icon layer)
 *   android-icon-monochrome.png  1024x1024 alpha   (themed icon)
 *   splash-icon.png              1024x1024 alpha
 *   favicon.png                  64x64
 */
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { Resvg } from '@resvg/resvg-js';
import { PIECE_SVGS } from '../src/components/ChessBoard/pieceSvgs';
import { colors } from '../src/theme';

const OUT = join(__dirname, '..', 'assets');
const SIZE = 1024;

/** Inner markup of the 45x45 cburnett knight, without the outer <svg>. */
function knightInner(monochrome = false): string {
  let svg = PIECE_SVGS.wN.replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  if (monochrome) {
    svg = svg.replace(/fill="#fff"/g, 'fill="#FFFFFF"').replace(/fill="#000"/g, 'fill="#FFFFFF"').replace(/stroke="#000"/g, 'stroke="#FFFFFF"');
  }
  return svg;
}

function micGlyph(cx: number, cy: number, r: number, fg: string): string {
  // Same glyph as the in-app microphone button, drawn in a 24x24 box.
  const s = (r * 1.15) / 24;
  const x = cx - 12 * s;
  const y = cy - 12 * s;
  return `
  <g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="${fg}" stroke-width="2.2" stroke-linecap="round">
    <rect x="9" y="2.5" width="6" height="12" rx="3" fill="${fg}" stroke="none"/>
    <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/>
    <path d="M12 18v3.5M8.5 21.5h7"/>
  </g>`;
}

interface LogoOptions {
  /** blob size as a fraction of the canvas */
  scale: number;
  monochrome?: boolean;
  badge?: boolean;
}

function logo({ scale, monochrome = false, badge = true }: LogoOptions): string {
  const blob = SIZE * scale;
  const cx = SIZE / 2;
  const cy = SIZE / 2;
  const rx = blob * 0.35;
  const knightSize = blob * 0.72;
  const k = knightSize / 45;
  const kx = cx - knightSize / 2;
  const ky = cy - knightSize / 2 + blob * 0.01;

  // Android themed icon: a single opaque silhouette, the launcher applies the color.
  if (monochrome) {
    const big = blob * 0.95;
    const kb = big / 45;
    return `<g transform="translate(${cx - big / 2} ${cy - big / 2}) scale(${kb})">${knightInner(true)}</g>`;
  }

  const badgeR = blob * 0.19;
  const bx = cx + blob / 2 - badgeR * 0.55;
  const by = cy + blob / 2 - badgeR * 0.75;
  const ring = badgeR * 0.14;

  return `
  <rect x="${cx - blob / 2}" y="${cy - blob / 2}" width="${blob}" height="${blob}" rx="${rx}"
        fill="${colors.primaryDark}" opacity="0.35" transform="rotate(-6 ${cx} ${cy}) translate(${blob * 0.02} ${blob * 0.03})"/>
  <rect x="${cx - blob / 2}" y="${cy - blob / 2}" width="${blob}" height="${blob}" rx="${rx}"
        fill="${colors.primary}" transform="rotate(-6 ${cx} ${cy})"/>
  <g transform="translate(${kx} ${ky}) scale(${k})">${knightInner()}</g>
  ${
    badge
      ? `<circle cx="${bx}" cy="${by}" r="${badgeR + ring}" fill="${colors.bg}"/>
         <circle cx="${bx}" cy="${by}" r="${badgeR}" fill="${colors.accent}"/>
         ${micGlyph(bx, by, badgeR, colors.textOnDark)}`
      : ''
  }`;
}

function svgDoc(body: string, background?: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  ${background ? `<rect width="${SIZE}" height="${SIZE}" fill="${background}"/>` : ''}
  ${body}
</svg>`;
}

function render(svg: string, file: string, width = SIZE): void {
  const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: width } });
  const png = resvg.render().asPng();
  writeFileSync(join(OUT, file), png);
  console.log(`  ${file.padEnd(30)} ${width}x${width}  ${(png.length / 1024).toFixed(0)} KB`);
}

console.log('Generating icons into assets/');
// App Store / iOS: opaque, no rounded corners (iOS masks them).
render(svgDoc(logo({ scale: 0.64 }), colors.bg), 'icon.png');
// Android adaptive icon: content must stay inside the central 66% safe zone.
render(svgDoc(logo({ scale: 0.5 })), 'android-icon-foreground.png');
render(svgDoc('', colors.bg), 'android-icon-background.png');
render(svgDoc(logo({ scale: 0.5, monochrome: true })), 'android-icon-monochrome.png');
// Splash: transparent, sits on the cream splash background from app.json.
render(svgDoc(logo({ scale: 0.42 })), 'splash-icon.png');
// Web favicon.
render(svgDoc(logo({ scale: 0.8, badge: false }), colors.bg), 'favicon.png', 64);
console.log('Done.');
