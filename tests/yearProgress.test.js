import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { getYearProgress, startOfYear } from '../src/yearProgress.js';

const DAY = 24 * 60 * 60 * 1000;
const utc = (...a) => new Date(Date.UTC(...a));
const U = { timeZone: 'UTC' };

describe('getYearProgress', () => {
  it('returns 0.00% at Jan 1 00:00 of a non-leap year', () => {
    const r = getYearProgress(utc(2025, 0, 1), U);
    assert.equal(r.percentLabel, '0.00');
    assert.equal(r.year, 2025);
    assert.equal(r.totalMs, 365 * DAY);
  });

  it('accounts for leap years', () => {
    assert.equal(getYearProgress(utc(2024, 0, 1), U).totalMs, 366 * DAY);
    assert.equal(getYearProgress(utc(2025, 0, 1), U).totalMs, 365 * DAY);
  });

  it('mid-year uses exactly 2 decimals', () => {
    const r = getYearProgress(utc(2025, 6, 2, 12), U);
    assert.equal(r.percentLabel, '50.00');
    assert.match(r.percentLabel, /^\d+\.\d{2}$/);
  });

  it('last moment of Dec 31 -> 100.00%', () => {
    assert.equal(getYearProgress(utc(2025, 11, 31, 23, 59, 59, 999), U).percentLabel, '100.00');
  });

  it('start of the 100.00% window (26m 16.8s before year end, 365-day year)', () => {
    const end = Date.UTC(2026, 0, 1);
    assert.equal(getYearProgress(new Date(end - 1576800), U).percentLabel, '100.00');
    assert.equal(getYearProgress(new Date(end - 1576801), U).percentLabel, '99.99');
  });

  it('leap-year 100.00% window is 26m 21.12s', () => {
    const end = Date.UTC(2025, 0, 1);
    assert.equal(getYearProgress(new Date(end - 1581120), U).percentLabel, '100.00');
    assert.equal(getYearProgress(new Date(end - 1581121), U).percentLabel, '99.99');
  });

  it('next Jan 1 00:00 is 0.00% of the new year', () => {
    const r = getYearProgress(utc(2026, 0, 1), U);
    assert.equal(r.year, 2026);
    assert.equal(r.percentLabel, '0.00');
  });

  it('does not hard-code the year', () => {
    assert.equal(getYearProgress(utc(2030, 0, 1), U).year, 2030);
    assert.equal(getYearProgress(utc(1999, 5, 15), U).year, 1999);
  });
});

describe('timezone year bounds', () => {
  const NY = { timeZone: 'America/New_York' };

  it('Jan 1 00:00 in America/New_York (05:00 UTC) is 0.00%', () => {
    assert.equal(startOfYear(2026, 'America/New_York'), Date.UTC(2026, 0, 1, 5));
    const r = getYearProgress(utc(2026, 0, 1, 5), NY);
    assert.equal(r.year, 2026);
    assert.equal(r.percentLabel, '0.00');
  });

  it('same instant differs between America/New_York and UTC', () => {
    const t = utc(2026, 0, 1, 2); // still Dec 31 21:00 in New York
    const u = getYearProgress(t, U);
    const n = getYearProgress(t, NY);
    assert.equal(u.year, 2026);
    assert.equal(n.year, 2025);
    assert.equal(n.percentLabel, '99.97');
    assert.notEqual(u.percentLabel, n.percentLabel);
  });

  it('DST does not change year length (still 365 days in New York)', () => {
    assert.equal(getYearProgress(utc(2025, 6, 1), NY).totalMs, 365 * DAY);
  });

  it('BOT_TIMEZONE env overrides config', () => {
    const prev = process.env.BOT_TIMEZONE;
    process.env.BOT_TIMEZONE = 'Asia/Tokyo';
    try {
      assert.equal(getYearProgress(utc(2025, 11, 31, 15)).percentLabel, '0.00');
      assert.equal(getYearProgress(utc(2025, 11, 31, 15)).timeZone, 'Asia/Tokyo');
    } finally {
      if (prev === undefined) delete process.env.BOT_TIMEZONE; else process.env.BOT_TIMEZONE = prev;
    }
  });

  it('rejects invalid timezones', () => {
    assert.throws(() => getYearProgress(new Date(), { timeZone: 'Not/AZone' }), RangeError);
  });
});
