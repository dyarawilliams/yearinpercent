/**
 * Visual progress bar.
 *
 * Uses filled/unfilled characters (default █ / ░). Filled segment count is
 * derived from the same rounded percentage used in the post so bar and
 * label stay consistent.
 */

/**
 * @param {number} percent - Year progress 0–100 (use the same rounded value as the label)
 * @param {{ length?: number, filledChar?: string, emptyChar?: string }} [options]
 * @returns {string}
 */
export function renderProgressBar(percent, options = {}) {
  const length = options.length ?? 20;
  const filledChar = options.filledChar ?? '█';
  const emptyChar = options.emptyChar ?? '░';

  const clamped = Math.min(Math.max(percent, 0), 100);
  const filled = Math.round((clamped / 100) * length);
  const empty = length - filled;

  return filledChar.repeat(filled) + emptyChar.repeat(empty);
}

export default renderProgressBar;
