/**
 * Progress-bar image (PNG) attached to each post.
 *
 * Layout (1200×240): near-black background, yellow frame, "<YEAR> Progress Bar"
 * label on a black tab that breaks the top border, and a bar inside the frame —
 * yellow fill from the left, white remainder. Fill width uses the same rounded
 * percent as the post text: round(barWidth * percent / 100).
 *
 * Text is drawn from pre-rendered Poppins ExtraBold masks (assets/glyphs.json,
 * OFL-1.1), so output is identical on every OS with zero dependencies.
 */
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { encodePng } from './png.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const LAYOUT = Object.freeze({
  width: 1200,
  height: 240,
  frame: { x: 29, y: 24, w: 1142, h: 192, thickness: 7 },
  bar: { x: 60, y: 60, w: 1080, h: 120 },
  label: { centerX: 600, baseline: 39, tabTop: 8, tabBottom: 49, padding: 23, tracking: 0.5 },
});

export const COLORS = Object.freeze({
  background: [10, 10, 10],
  frame: [252, 246, 0],
  fill: [250, 222, 0],
  empty: [255, 255, 255],
  tab: [0, 0, 0],
  text: [255, 255, 255],
});

let glyphCache;
function loadGlyphs() {
  if (glyphCache) return glyphCache;
  const raw = JSON.parse(readFileSync(join(__dirname, '..', 'assets', 'glyphs.json'), 'utf8'));
  glyphCache = {};
  for (const [ch, g] of Object.entries(raw.glyphs)) {
    glyphCache[ch] = { ...g, mask: g.data ? inflateSync(Buffer.from(g.data, 'base64')) : null };
  }
  return glyphCache;
}

function fillRect(px, W, x, y, w, h, [r, g, b]) {
  for (let yy = y; yy < y + h; yy++) {
    for (let xx = x; xx < x + w; xx++) {
      const i = (yy * W + xx) * 3;
      px[i] = r; px[i + 1] = g; px[i + 2] = b;
    }
  }
}

/** Width in px of a label set with the glyph atlas. */
function measure(text, glyphs, tracking) {
  let w = 0;
  [...text].forEach((ch, i) => {
    const g = glyphs[ch];
    if (!g) throw new Error(`No glyph for "${ch}" in assets/glyphs.json`);
    w += g.advance + (i > 0 ? tracking : 0);
  });
  return w;
}

function drawText(px, W, text, startX, baseline, color, glyphs, tracking) {
  let pen = startX;
  for (const ch of text) {
    const g = glyphs[ch];
    if (g.mask) {
      const ox = Math.round(pen) + g.x;
      const oy = baseline + g.y;
      for (let y = 0; y < g.h; y++) {
        for (let x = 0; x < g.w; x++) {
          const a = g.mask[y * g.w + x] / 255;
          if (!a) continue;
          const i = ((oy + y) * W + ox + x) * 3;
          for (let c = 0; c < 3; c++) px[i + c] = Math.round(px[i + c] * (1 - a) + color[c] * a);
        }
      }
    }
    pen += g.advance + tracking;
  }
}

/** Number of filled pixels in the bar for a percent (0–100). */
export function fillWidth(percent, barWidth = LAYOUT.bar.w) {
  const clamped = Math.min(Math.max(Number(percent) || 0, 0), 100);
  return Math.round((barWidth * clamped) / 100);
}

/**
 * @param {{ percent: number, year: number }} input
 * @returns {{ png: Buffer, width: number, height: number, filled: number, label: string }}
 */
export function renderProgressImage({ percent, year }) {
  const { width: W, height: H, frame, bar, label: L } = LAYOUT;
  const px = new Uint8Array(W * H * 3);
  fillRect(px, W, 0, 0, W, H, COLORS.background);

  const t = frame.thickness;
  fillRect(px, W, frame.x, frame.y, frame.w, t, COLORS.frame);
  fillRect(px, W, frame.x, frame.y + frame.h - t, frame.w, t, COLORS.frame);
  fillRect(px, W, frame.x, frame.y, t, frame.h, COLORS.frame);
  fillRect(px, W, frame.x + frame.w - t, frame.y, t, frame.h, COLORS.frame);

  const filled = fillWidth(percent, bar.w);
  fillRect(px, W, bar.x, bar.y, filled, bar.h, COLORS.fill);
  fillRect(px, W, bar.x + filled, bar.y, bar.w - filled, bar.h, COLORS.empty);

  const glyphs = loadGlyphs();
  const label = `${year} Progress Bar`;
  const textW = measure(label, glyphs, L.tracking);
  const tabW = Math.round(textW) + 2 * L.padding;
  const tabX = Math.round(L.centerX - tabW / 2);
  fillRect(px, W, tabX, L.tabTop, tabW, L.tabBottom - L.tabTop, COLORS.tab);
  drawText(px, W, label, L.centerX - textW / 2, L.baseline, COLORS.text, glyphs, L.tracking);

  return { png: encodePng(W, H, px), width: W, height: H, filled, label };
}

export default renderProgressImage;
