import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('--dry-run flag forces dry-run even when DRY_RUN=false', () => {
  const r = spawnSync(process.execPath, ['src/index.js', '--dry-run'], {
    env: { ...process.env, DRY_RUN: 'false' },
    encoding: 'utf8',
  });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /=== yearinpercent dry-run ===/);
  assert.match(r.stdout, /is \d+\.\d{2}% complete/);
});
