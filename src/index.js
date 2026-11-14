/**
 * yearinpercent — entry point. Dry-run by default.
 * Posts only when DRY_RUN=false (or --live) and --dry-run is absent. --dry-run always wins.
 * Dry-run writes the progress image to out/progress.png; live uploads it and attaches it,
 * falling back to the text █/░ bar post if the image can't be rendered or uploaded.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadEnvFile } from './loadEnv.js';
import { composePost } from './compose.js';
import { renderProgressImage } from './progressImage.js';
import { createPost } from './xClient.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DRY_RUN_IMAGE = join(ROOT, 'out', 'progress.png');

loadEnvFile();

if (process.argv.includes('--dry-run')) {
  process.env.DRY_RUN = 'true';
} else if (process.argv.includes('--live')) {
  process.env.DRY_RUN = 'false';
}

async function main() {
  const composed = composePost();
  const image = () => renderProgressImage(composed).png;
  const result = await createPost(composed.text, { image, fallbackText: composed.fallbackText });
  if (result.dryRun) {
    mkdirSync(dirname(DRY_RUN_IMAGE), { recursive: true });
    writeFileSync(DRY_RUN_IMAGE, image());
    console.log('=== yearinpercent dry-run ===');
    console.log(result.text);
    console.log('--- image ---');
    console.log(relative(process.cwd(), DRY_RUN_IMAGE) || DRY_RUN_IMAGE);
    console.log('--- fallback (text bar, used if the image fails) ---');
    console.log(result.fallbackText);
    console.log('=============================');
    console.log(result.note);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
