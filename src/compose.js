/**
 * Compose the final post text: percentage + motivational message.
 * The progress bar is a separate PNG (see progressImage.js).
 */

import { getYearProgress } from './yearProgress.js';
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
 * @param {{ now?: Date, config?: object, templates?: string[], random?: () => number }} [options]
 * @returns {{ text: string, percent: number, percentLabel: string, message: string, year: number }}
 */
export function composePost(options = {}) {
  const config = options.config ?? loadDefaultConfig();
  const now = options.now ?? new Date();

  const { percent, percentLabel, year } = getYearProgress(now, { timeZone: options.timeZone ?? process.env.BOT_TIMEZONE ?? config.posting?.timezone });
  const message = pickMessage(options.templates, options.random);

  const text = [
    `${year} is ${percentLabel}% complete`,
    message,
  ].join('\n');

  return { text, percent, percentLabel, message, year };
}

export default composePost;
