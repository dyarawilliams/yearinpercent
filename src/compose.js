/**
 * Compose the final post text: percentage + progress bar + motivational message.
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
 * @param {{ now?: Date, config?: object, templates?: string[], random?: () => number }} [options]
 * @returns {{ text: string, percent: number, percentLabel: string, bar: string, message: string, year: number }}
 */
export function composePost(options = {}) {
  const config = options.config ?? loadDefaultConfig();
  const now = options.now ?? new Date();
  const barOpts = config.progressBar ?? {};

  const { percent, percentLabel, year } = getYearProgress(now);
  const bar = renderProgressBar(percent, barOpts);
  const message = pickMessage(options.templates, options.random);

  const text = [
    `${year} is ${percentLabel}% complete`,
    `${bar} ${percentLabel}%`,
    message,
  ].join('\n');

  return { text, percent, percentLabel, bar, message, year };
}

export default composePost;
