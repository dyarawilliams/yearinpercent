/**
 * yearinpercent — entry point. Dry-run by default.
 * Posts only when DRY_RUN=false (or --live) and --dry-run is absent. --dry-run always wins.
 */
import { loadEnvFile } from './loadEnv.js';
import { composePost } from './compose.js';
import { createPost } from './xClient.js';

loadEnvFile();

if (process.argv.includes('--dry-run')) {
  process.env.DRY_RUN = 'true';
} else if (process.argv.includes('--live')) {
  process.env.DRY_RUN = 'false';
}

async function main() {
  const composed = composePost();
  const result = await createPost(composed.text);
  if (result.dryRun) {
    console.log('=== yearinpercent dry-run ===');
    console.log(result.text);
    console.log('=============================');
    console.log(result.note);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
