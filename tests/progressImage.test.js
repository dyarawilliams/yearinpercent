import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inflateSync } from 'node:zlib';
import { renderProgressImage, fillWidth, LAYOUT, COLORS } from '../src/progressImage.js';

/** Decode the encoder's own output (8-bit RGB, filter 0). */
function decode(png) {
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  let off = 8; let width; let height; const idat = [];
  while (off < png.length) {
    const len = png.readUInt32BE(off);
    const type = png.toString('ascii', off + 4, off + 8);
    const data = png.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0); height = data.readUInt32BE(4);
      assert.equal(data[8], 8); assert.equal(data[9], 2);
    }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 3 + 1;
  return {
    width, height,
    at(x, y) { const i = y * stride + 1 + x * 3; return [raw[i], raw[i + 1], raw[i + 2]]; },
  };
}

const { bar, frame } = LAYOUT;
const midY = bar.y + bar.h / 2;

test('image is a 1200x240 PNG', () => {
  const { png, width, height } = renderProgressImage({ percent: 50, year: 2026 });
  const img = decode(png);
  assert.equal(width, 1200); assert.equal(height, 240);
  assert.equal(img.width, 1200); assert.equal(img.height, 240);
  assert.ok(png.length < 5 * 1024 * 1024);
});

for (const percent of [86, 37.42]) {
  test(`fill boundary at ${percent}%`, () => {
    const { png, filled } = renderProgressImage({ percent, year: 2026 });
    assert.equal(filled, Math.round((bar.w * percent) / 100));
    const img = decode(png);
    assert.deepEqual(img.at(bar.x, midY), COLORS.fill);
    assert.deepEqual(img.at(bar.x + filled - 1, midY), COLORS.fill);
    assert.deepEqual(img.at(bar.x + filled, midY), COLORS.empty);
    assert.deepEqual(img.at(bar.x + bar.w - 1, midY), COLORS.empty);
    assert.deepEqual(img.at(bar.x + bar.w, midY), COLORS.background);
  });
}

test('0% is all white, 100% is all yellow', () => {
  const zero = decode(renderProgressImage({ percent: 0, year: 2026 }).png);
  assert.deepEqual(zero.at(bar.x, midY), COLORS.empty);
  const full = decode(renderProgressImage({ percent: 100, year: 2026 }).png);
  assert.deepEqual(full.at(bar.x + bar.w - 1, midY), COLORS.fill);
  assert.equal(fillWidth(-5), 0);
  assert.equal(fillWidth(150), bar.w);
});

test('frame, background, and label tab', () => {
  const { png, label } = renderProgressImage({ percent: 50, year: 2027 });
  assert.equal(label, '2027 Progress Bar');
  const img = decode(png);
  assert.deepEqual(img.at(5, 5), COLORS.background);
  assert.deepEqual(img.at(frame.x + 2, midY), COLORS.frame); // left border
  assert.deepEqual(img.at(100, frame.y + 2), COLORS.frame); // top border away from tab
  assert.deepEqual(img.at(600, frame.y + frame.h - 2), COLORS.frame); // bottom border
  // tab breaks the top border; label has white text pixels
  assert.deepEqual(img.at(LAYOUT.label.centerX - 150, frame.y + 2), COLORS.tab);
  let white = 0;
  for (let x = 450; x < 750; x++) for (let y = 15; y < 46; y++) if (img.at(x, y).every((c) => c > 240)) white++;
  assert.ok(white > 500, `expected label text pixels, got ${white}`);
});
