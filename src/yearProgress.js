/**
 * Year-progress calculation.
 *
 *   percent = (elapsedMs / totalYearDurationMs) * 100, rounded to 2 decimals.
 *
 * Year bounds are Jan 1 00:00 → next Jan 1 00:00 in ONE IANA timezone:
 *   options.timeZone → env BOT_TIMEZONE → config posting.timezone → "UTC".
 * (Host TZ is ignored.) DST is handled via Intl offsets.
 *
 * Elapsed is clamped to [0, total); next Jan 1 00:00 is 0.00% of the new year.
 * 100.00% is shown when the remaining time is ≤ 0.005% of the year
 * (last 26m 16.8s of a 365-day year, 26m 21.12s of a leap year).
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function configTimeZone() {
  try {
    const cfg = JSON.parse(readFileSync(join(__dirname, '..', 'config', 'default.json'), 'utf8'));
    return cfg?.posting?.timezone;
  } catch {
    return undefined;
  }
}

/** Resolve the single timezone used for year bounds. */
export function resolveTimeZone(explicit) {
  const tz = explicit || process.env.BOT_TIMEZONE || configTimeZone() || 'UTC';
  new Intl.DateTimeFormat('en-US', { timeZone: tz }); // throws RangeError if invalid
  return tz;
}

function zonedParts(ms, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric',
    hour: 'numeric', minute: 'numeric', second: 'numeric',
  }).formatToParts(new Date(ms));
  const p = Object.fromEntries(parts.map((x) => [x.type, Number(x.value)]));
  return p;
}

/** Offset (ms) of timeZone from UTC at instant ms. */
function offsetAt(ms, timeZone) {
  const p = zonedParts(ms, timeZone);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** UTC instant of Jan 1 00:00 local time of `year` in timeZone. */
export function startOfYear(year, timeZone) {
  const guess = Date.UTC(year, 0, 1);
  let t = guess - offsetAt(guess, timeZone);
  const off2 = offsetAt(t, timeZone);
  if (guess - off2 !== t) t = guess - off2;
  return t;
}

/**
 * @param {Date} [now=new Date()]
 * @param {{ timeZone?: string }} [options]
 */
export function getYearProgress(now = new Date(), options = {}) {
  const timeZone = resolveTimeZone(options.timeZone);
  const nowMs = now.getTime();
  let year = zonedParts(nowMs, timeZone).year;
  let start = startOfYear(year, timeZone);
  if (nowMs < start) { year -= 1; start = startOfYear(year, timeZone); }
  let end = startOfYear(year + 1, timeZone);
  if (nowMs >= end) { year += 1; start = end; end = startOfYear(year + 1, timeZone); }
  const totalMs = end - start;
  const elapsedMs = Math.min(Math.max(nowMs - start, 0), totalMs - 1);
  const percent = Math.round((elapsedMs / totalMs) * 10000) / 100;
  const percentLabel = percent.toFixed(2);
  return { percent, percentLabel, year, elapsedMs, totalMs, timeZone };
}

export default getYearProgress;
