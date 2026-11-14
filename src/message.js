/**
 * Motivational message selection.
 * Rotates through config/messages.json by week, so every line is used once
 * before any line repeats. No state is stored between runs.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FALLBACK = 'Keep going — every percent counts.';
const DAY_MS = 86_400_000;
// Monday, Jan 5 1970 (UTC): week numbering starts here so weeks run Mon–Sun.
const EPOCH_MONDAY_MS = Date.UTC(1970, 0, 5);
// Shifts where the rotation starts. Set so the week of Nov 16, 2026 begins on
// line 11 (the first newly added line), after lines 1-10 were used at random.
const ROTATION_OFFSET = 3;

/**
 * Load templates from config/messages.json (or use provided list).
 * @param {string[]} [templates]
 * @returns {string[]}
 */
export function loadTemplates(templates) {
  if (Array.isArray(templates) && templates.length > 0) {
    return templates;
  }
  const path = join(__dirname, '..', 'config', 'messages.json');
  const data = JSON.parse(readFileSync(path, 'utf8'));
  return data.templates ?? [];
}

/**
 * Continuous week number for the local calendar date of `now` in `timeZone`.
 * Keeps counting across year boundaries, so the rotation never resets on Jan 1.
 * @param {Date} now
 * @param {string} [timeZone='UTC']
 * @returns {number}
 */
export function weekNumber(now, timeZone = 'UTC') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const localMidnightMs = Date.UTC(get('year'), get('month') - 1, get('day'));
  return Math.floor((localMidnightMs - EPOCH_MONDAY_MS) / DAY_MS / 7);
}

/**
 * Pick this week's message. Same week -> same line; next week -> next line.
 * @param {string[]} [templates]
 * @param {{ now?: Date, timeZone?: string }} [options]
 * @returns {string}
 */
export function pickMessage(templates, options = {}) {
  const list = loadTemplates(templates);
  if (list.length === 0) {
    return FALLBACK;
  }
  const week = weekNumber(options.now ?? new Date(), options.timeZone ?? 'UTC');
  const n = list.length;
  const index = (((week + ROTATION_OFFSET) % n) + n) % n;
  return list[index];
}

export default pickMessage;
