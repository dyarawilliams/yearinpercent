/**
 * Motivational message selection.
 * Picks from a template collection so the bot does not repeat the same line every post.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

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
 * @param {string[]} [templates]
 * @param {() => number} [random=Math.random]
 * @returns {string}
 */
export function pickMessage(templates, random = Math.random) {
  const list = loadTemplates(templates);
  if (list.length === 0) {
    return 'Keep going — every percent counts.';
  }
  const index = Math.floor(random() * list.length);
  return list[index];
}

export default pickMessage;
