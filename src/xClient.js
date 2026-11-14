/**
 * X API client: OAuth 1.0a (HMAC-SHA1) signed requests.
 *   1. POST https://api.x.com/2/media/upload  (JSON: base64 media, media_category=tweet_image)
 *   2. POST https://api.x.com/2/tweets        (JSON: text + media.media_ids)
 * JSON bodies are not part of the OAuth 1.0a signature base string.
 * No runtime dependencies — uses node:crypto and global fetch (Node 18+).
 * Docs: https://docs.x.com/x-api/media/upload-media, https://docs.x.com/x-api/posts/create-post
 */
import crypto from 'node:crypto';

export const POST_URL = 'https://api.x.com/2/tweets';
export const MEDIA_UPLOAD_URL = 'https://api.x.com/2/media/upload';
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_POST_LENGTH = 280;
const MAX_RETRY_WAIT_MS = 60_000;

export function loadCredentialsFromEnv(env = process.env) {
  return {
    apiKey: env.X_API_KEY,
    apiSecret: env.X_API_SECRET,
    accessToken: env.X_ACCESS_TOKEN,
    accessTokenSecret: env.X_ACCESS_TOKEN_SECRET,
    dryRun: env.DRY_RUN === undefined ? true : String(env.DRY_RUN).toLowerCase() !== 'false',
  };
}

export function assertPostingCredentials(creds) {
  const missing = [];
  if (!creds.apiKey) missing.push('X_API_KEY');
  if (!creds.apiSecret) missing.push('X_API_SECRET');
  if (!creds.accessToken) missing.push('X_ACCESS_TOKEN');
  if (!creds.accessTokenSecret) missing.push('X_ACCESS_TOKEN_SECRET');
  if (missing.length > 0) {
    throw new Error(
      `Missing X API credentials for posting: ${missing.join(', ')}. ` +
        'Set them in .env or the environment (see .env.example).'
    );
  }
}

/** RFC 3986 percent-encoding as required by OAuth 1.0a. */
export function percentEncode(str) {
  return encodeURIComponent(String(str)).replace(
    /[!'()*]/g,
    (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase()
  );
}

/**
 * Compute the OAuth 1.0a HMAC-SHA1 signature.
 * `params` = oauth_* params plus any query (or form) params. JSON bodies are NOT included.
 */
export function signRequest(method, url, params, consumerSecret, tokenSecret) {
  const paramString = Object.entries(params)
    .map(([k, v]) => [percentEncode(k), percentEncode(v)])
    .sort(([a, av], [b, bv]) => (a < b ? -1 : a > b ? 1 : av < bv ? -1 : av > bv ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&');
  const base = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const key = `${percentEncode(consumerSecret)}&${percentEncode(tokenSecret)}`;
  return crypto.createHmac('sha1', key).update(base).digest('base64');
}

/** Build the Authorization header. nonce/timestamp injectable for tests. */
export function buildAuthHeader(method, url, creds, { nonce, timestamp, extraParams = {} } = {}) {
  const oauth = {
    oauth_consumer_key: creds.apiKey,
    oauth_nonce: nonce ?? crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: String(timestamp ?? Math.floor(Date.now() / 1000)),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  oauth.oauth_signature = signRequest(
    method, url, { ...extraParams, ...oauth }, creds.apiSecret, creds.accessTokenSecret
  );
  return (
    'OAuth ' +
    Object.keys(oauth).sort().map((k) => `${percentEncode(k)}="${percentEncode(oauth[k])}"`).join(', ')
  );
}

/** Characters as X roughly counts them (code points). */
export function postLength(text) {
  return [...text].length;
}

async function safeBody(res) {
  try {
    const t = await res.text();
    return t.length > 1000 ? t.slice(0, 1000) + '…' : t;
  } catch {
    return '';
  }
}

async function failFor(res, what) {
  const body = await safeBody(res);
  if (res.status === 401 || res.status === 403) {
    throw new Error(
      `X API authentication failed (${res.status}) during ${what}: ${body}\n` +
        'Hint: check the four X_* keys, make sure the app has "Read and write" permission ' +
        '(User authentication settings), and regenerate the Access Token and Secret after changing permissions.'
    );
  }
  throw new Error(`X API ${what} failed (${res.status}): ${body}`);
}

/**
 * Signed JSON POST with one bounded retry on 429.
 * @returns {Promise<object>} parsed JSON body of the successful response
 */
async function signedJsonPost(url, payload, what, ctx) {
  const { creds, doFetch, sleep, now, log } = ctx;
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await doFetch(url, {
      method: 'POST',
      headers: {
        Authorization: buildAuthHeader('POST', url, creds),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) return res.json();

    if (res.status === 429) {
      const reset = Number(res.headers.get('x-rate-limit-reset'));
      const waitMs = Number.isFinite(reset) && reset > 0 ? reset * 1000 - now() : NaN;
      const when = Number.isFinite(waitMs) ? new Date(reset * 1000).toISOString() : 'unknown';
      log.error(`X API rate limit hit (429) during ${what}. Limit resets at ${when}.`);
      if (attempt === 0 && Number.isFinite(waitMs) && waitMs <= MAX_RETRY_WAIT_MS) {
        const ms = Math.max(waitMs, 0) + 1000;
        log.error(`Retrying once in ${Math.ceil(ms / 1000)}s.`);
        await sleep(ms);
        continue;
      }
      throw new Error(`X API rate limited (429) during ${what}. Try again after ${when}.`);
    }

    await failFor(res, what);
  }
  throw new Error(`X API rate limited (429) during ${what} after retry.`);
}

/**
 * Upload one image (PNG/JPG/GIF/WEBP ≤ 5 MB) and return its media id.
 * @param {Buffer} image
 */
export async function uploadMedia(image, ctx) {
  if (!Buffer.isBuffer(image) || image.length === 0) throw new Error('Image upload: no image data.');
  if (image.length > MAX_IMAGE_BYTES) {
    throw new Error(`Image is ${image.length} bytes; X allows at most ${MAX_IMAGE_BYTES} for tweet_image.`);
  }
  const data = await signedJsonPost(
    MEDIA_UPLOAD_URL,
    { media: image.toString('base64'), media_category: 'tweet_image' },
    'media upload',
    ctx
  );
  const id = data?.data?.id;
  if (!id) throw new Error(`X API media upload returned no media id: ${JSON.stringify(data).slice(0, 500)}`);
  return String(id);
}

/**
 * Post text (and optionally one image) to X, or return the composed post in dry-run mode.
 *
 * `image` may be a Buffer or a function returning one (so rendering errors are caught too).
 * Without `fallbackText`, an image failure throws and nothing is posted.
 * With `fallbackText`, any image failure (render, 401/402/403, 429 after retry, missing id,
 * network error) logs a warning and posts `fallbackText` without media instead.
 * A failure of the text post itself always throws.
 * @param {string} text
 * @param {{ image?: Buffer | (() => Buffer), fallbackText?: string, dryRun?: boolean, env?: object, fetch?: Function, sleep?: Function, logger?: Console, now?: () => number }} [options]
 */
export async function createPost(text, options = {}) {
  const env = options.env ?? process.env;
  const creds = loadCredentialsFromEnv(env);
  const dryRun = options.dryRun ?? creds.dryRun;
  const log = options.logger ?? console;
  const { fallbackText } = options;

  for (const t of fallbackText === undefined ? [text] : [text, fallbackText]) {
    if (postLength(t) > MAX_POST_LENGTH) {
      throw new Error(`Post is ${postLength(t)} characters; X allows at most ${MAX_POST_LENGTH}.`);
    }
  }

  if (dryRun) {
    return { ok: true, dryRun: true, text, fallbackText, note: 'DRY_RUN: post was composed but not sent to X.' };
  }

  assertPostingCredentials(creds);
  const ctx = {
    creds,
    log,
    doFetch: options.fetch ?? globalThis.fetch,
    sleep: options.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms))),
    now: options.now ?? Date.now,
  };

  let postText = text;
  let mediaId;
  let fallbackReason;
  if (options.image) {
    try {
      const image = typeof options.image === 'function' ? options.image() : options.image;
      mediaId = await uploadMedia(image, ctx);
    } catch (err) {
      if (fallbackText === undefined) throw err;
      fallbackReason = err?.message || String(err);
      log.error(`Warning: progress image could not be attached — posting the text-bar version instead.\nReason: ${fallbackReason}`);
      postText = fallbackText;
    }
  }

  const payload = { text: postText };
  if (mediaId) payload.media = { media_ids: [mediaId] };

  const data = await signedJsonPost(POST_URL, payload, 'post', ctx);
  const id = data?.data?.id;
  log.log(`Posted to X${mediaId ? ' with progress image' : ''}. Post id: ${id}`);
  return { ok: true, dryRun: false, text: postText, id, mediaId, fallback: Boolean(fallbackReason), fallbackReason };
}

export default createPost;
