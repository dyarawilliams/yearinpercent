/**
 * Year-progress calculation.
 *
 * Formula (continuous, not day-bucketed):
 *   percent = (elapsedMs / totalYearDurationMs) * 100
 * rounded to exactly 2 decimal places.
 *
 * - No hard-coded year: uses the year of `now` (or injected date).
 * - Leap years: total duration is derived from Jan 1 → next Jan 1, so
 *   Feb 29 is included automatically when present.
 * - Works across year boundaries: each call recomputes from the current year.
 */

/**
 * @param {Date} [now=new Date()]
 * @returns {{ percent: number, percentLabel: string, year: number, elapsedMs: number, totalMs: number }}
 */
export function getYearProgress(now = new Date()) {
  const year = now.getFullYear();
  const start = new Date(year, 0, 1, 0, 0, 0, 0);
  const end = new Date(year + 1, 0, 1, 0, 0, 0, 0);
  const totalMs = end.getTime() - start.getTime();
  const elapsedMs = Math.min(Math.max(now.getTime() - start.getTime(), 0), totalMs);
  const raw = (elapsedMs / totalMs) * 100;
  const percent = Math.round(raw * 100) / 100; // exactly 2 decimal places
  const percentLabel = percent.toFixed(2);

  return { percent, percentLabel, year, elapsedMs, totalMs };
}

export default getYearProgress;
