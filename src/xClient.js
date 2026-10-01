/**
 * X API client stub (dry-run only in this blueprint).
 *
 * Live posting is intentionally NOT implemented yet.
 * When implemented, use:
 *   POST https://api.x.com/2/tweets
 * with User Context auth (OAuth 1.0a recommended for scheduled bots).
 *
 * Official quickstart:
 *   https://docs.x.com/x-api/posts/manage-tweets/quickstart
 *
 * App-only bearer tokens CANNOT create posts.
 */

/**
 * @returns {{ apiKey?: string, apiSecret?: string, accessToken?: string, accessTokenSecret?: string, dryRun: boolean }}
 */
export function loadCredentialsFromEnv() {
  return {
    apiKey: process.env.X_API_KEY,
    apiSecret: process.env.X_API_SECRET,
    accessToken: process.env.X_ACCESS_TOKEN,
    accessTokenSecret: process.env.X_ACCESS_TOKEN_SECRET,
    dryRun:
      process.env.DRY_RUN === undefined
        ? true
        : String(process.env.DRY_RUN).toLowerCase() !== 'false',
  };
}

/**
 * @param {ReturnType<typeof loadCredentialsFromEnv>} creds
 */
export function assertPostingCredentials(creds) {
  const missing = [];
  if (!creds.apiKey) missing.push('X_API_KEY');
  if (!creds.apiSecret) missing.push('X_API_SECRET');
  if (!creds.accessToken) missing.push('X_ACCESS_TOKEN');
  if (!creds.accessTokenSecret) missing.push('X_ACCESS_TOKEN_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Missing X API credentials for posting: ${missing.join(', ')}. ` +
        'Set them in the environment (see .env.example). App-only bearer tokens cannot create posts.'
    );
  }
}

/**
 * Post text to X, or print in dry-run mode.
 * Live OAuth 1.0a signing / HTTP call is a future implementation step.
 *
 * @param {string} text
 * @param {{ dryRun?: boolean }} [options]
 * @returns {Promise<{ ok: boolean, dryRun: boolean, text: string, note?: string }>}
 */
export async function createPost(text, options = {}) {
  const creds = loadCredentialsFromEnv();
  const dryRun = options.dryRun ?? creds.dryRun;

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      text,
      note: 'DRY_RUN: post was composed but not sent to X.',
    };
  }

  // Live path: require secrets, then fail clearly until OAuth posting is implemented.
  assertPostingCredentials(creds);
  throw new Error(
    'Live X posting is not implemented yet. Keep DRY_RUN=true or implement OAuth 1.0a POST to https://api.x.com/2/tweets.'
  );
}

export default createPost;
