import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, rmSync } from 'node:fs';

test('--dry-run flag forces dry-run even when DRY_RUN=false, and writes the image', () => {
  rmSync('out/progress.png', { force: true });
  const r = spawnSync(process.execPath, ['src/index.js', '--dry-run'], {
    env: { ...process.env, DRY_RUN: 'false' },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /=== yearinpercent dry-run ===/);
  assert.match(r.stdout, /is \d+\.\d{2}% complete/);
  assert.match(r.stdout, /--- image ---\n.*progress\.png/);
  assert.match(r.stdout, /--- fallback[^\n]*\n\d{4} is \d+\.\d{2}% complete\n[█░]{20}\n/);
  const imagePart = r.stdout.split('--- image ---')[0];
  assert.doesNotMatch(imagePart, /[█░]/);
  const png = readFileSync('out/progress.png');
  assert.equal(png.subarray(1, 4).toString('ascii'), 'PNG');
});
