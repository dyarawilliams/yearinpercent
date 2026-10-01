import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getYearProgress } from '../src/yearProgress.js';

describe('getYearProgress', () => {
  it('returns 0.00% at the start of a non-leap year', () => {
    const result = getYearProgress(new Date(2025, 0, 1, 0, 0, 0, 0));
    assert.equal(result.percent, 0);
    assert.equal(result.percentLabel, '0.00');
    assert.equal(result.year, 2025);
    assert.equal(result.totalMs, 365 * 24 * 60 * 60 * 1000);
  });

  it('accounts for leap years in total duration', () => {
    const leap = getYearProgress(new Date(2024, 0, 1, 0, 0, 0, 0));
    const nonLeap = getYearProgress(new Date(2025, 0, 1, 0, 0, 0, 0));
    assert.equal(leap.totalMs, 366 * 24 * 60 * 60 * 1000);
    assert.equal(nonLeap.totalMs, 365 * 24 * 60 * 60 * 1000);
  });

  it('returns ~100.00% at the end of the year', () => {
    const result = getYearProgress(new Date(2025, 11, 31, 23, 59, 59, 999));
    assert.ok(result.percent >= 99.99);
    assert.ok(result.percent <= 100);
    assert.equal(result.percentLabel, result.percent.toFixed(2));
  });

  it('clamps to 100 at next year boundary', () => {
    const result = getYearProgress(new Date(2026, 0, 1, 0, 0, 0, 0));
    assert.equal(result.year, 2026);
    assert.equal(result.percent, 0);
  });

  it('uses exactly 2 decimal places', () => {
    const mid = getYearProgress(new Date(2025, 6, 1, 12, 0, 0, 0));
    assert.match(mid.percentLabel, /^\d+\.\d{2}$/);
    assert.equal(mid.percent, Number(mid.percentLabel));
  });

  it('does not hard-code the year', () => {
    const a = getYearProgress(new Date(2030, 0, 1));
    const b = getYearProgress(new Date(1999, 5, 15));
    assert.equal(a.year, 2030);
    assert.equal(b.year, 1999);
  });
});
