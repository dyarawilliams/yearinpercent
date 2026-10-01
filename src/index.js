/**
 * yearinpercent — entry point (dry-run by default).
 * Composes a year-progress post and prints it. Does not call X unless
 * DRY_RUN=false and live posting is implemented.
 */

import { composePost } from './compose.js';
import { createPost } from './xClient.js';

async function main() {
  const composed = composePost();
  const result = await createPost(composed.text);

  if (result.dryRun) {
    console.log('=== yearinpercent dry-run ===');
    console.log(result.text);
    console.log('=============================');
    console.log(result.note);
  } else {
    console.log('Posted successfully.');
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exitCode = 1;
});
