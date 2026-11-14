/**
 * Compose the post text.
 *   text         — percent + message (posted with the PNG progress bar attached)
 *   fallbackText — percent + █/░ bar + message (posted if the image can't be used)
 */

import { getYearProgress } from './yearProgress.js';
import { renderProgressBar } from './progressBar.js';
import { pickMessage } from './message.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadDefaultConfig() {
  const path = join(__dirname, '..', 'config', 'default.json');
  return JSON.parse(readFileSync(path, 'utf8'));
}

/**
 * @param {{ now?: Date, config?: object, templates?: string[], timeZone?: string }} [options]
 * @returns {{ text: string, fallbackText: string, percent: number, percentLabel: string, bar: string, message: string, year: number }}
 */
export function composePost(options = {}) {
  const config = options.config ?? loadDefaultConfig();
  const now = options.now ?? new Date();

  const timeZone = options.timeZone ?? process.env.BOT_TIMEZONE ?? config.posting?.timezone;
  const { percent, percentLabel, year } = getYearProgress(now, { timeZone });
  const bar = renderProgressBar(percent, config.progressBar ?? {});
  const message = pickMessage(options.templates, { now, timeZone: timeZone || 'UTC' });
  const headline = `${year} is ${percentLabel}% complete`;

  const text = [headline, message].join('\n');
  const fallbackText = [headline, bar, message].join('\n');

  return { text, fallbackText, percent, percentLabel, bar, message, year };
}

export default composePost;
