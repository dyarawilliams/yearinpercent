import { test } from 'node:test';
import assert from 'node:assert/strict';
import { signRequest, buildAuthHeader, createPost, POST_URL } from '../src/xClient.js';
import { parseEnv } from '../src/loadEnv.js';

const ENV = {
  DRY_RUN: 'false',
  X_API_KEY: 'ck', X_API_SECRET: 'cs', X_ACCESS_TOKEN: 'at', X_ACCESS_TOKEN_SECRET: 'ats',
};
const quiet = { log() {}, error() {} };
const res = (status, body, headers = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  headers: { get: (k) => headers[k.toLowerCase()] ?? null },
  json: async () => body,
  text: async () => JSON.stringify(body),
});

test('signature matches Twitter OAuth 1.0a documented example', () => {
  const sig = signRequest(
    'POST',
    'https://api.twitter.com/1.1/statuses/update.json',
    {
      status: 'Hello Ladies + Gentlemen, a signed OAuth request!',
      include_entities: 'true',
      oauth_consumer_key: 'xvz1evFS4wEEPTGEFPHBog',
      oauth_nonce: 'kYjzVBB8Y0ZFabxSWbWovY3uYSQ2pTgmZeNu2VS4cg',
      oauth_signature_method: 'HMAC-SHA1',
      oauth_timestamp: '1318622958',
      oauth_token: '370773112-GmHxMAgYyLbNEtIKZeRNFsMKPR9EyMZeS9weJAEb',
      oauth_version: '1.0',
    },
    'kAcSOqF21Fu85e7zjz7ZN2U4ZRhfV3WpwPAoE3Z7kBw',
    'LswwdoUaIvS8ltyTt5jkRh4J50vUPVVHtR2YPi5kE'
  );
  assert.equal(sig, 'hCtSmYh+iHYCEqBWrE7C7hYmtUk=');
});

test('auth header is deterministic with fixed nonce/timestamp', () => {
  const creds = { apiKey: 'ck', apiSecret: 'cs', accessToken: 'at', accessTokenSecret: 'ats' };
  const a = buildAuthHeader('POST', POST_URL, creds, { nonce: 'n', timestamp: 1 });
  const b = buildAuthHeader('POST', POST_URL, creds, { nonce: 'n', timestamp: 1 });
  assert.equal(a, b);
  assert.match(a, /^OAuth oauth_consumer_key="ck", oauth_nonce="n", oauth_signature="[^"]+", oauth_signature_method="HMAC-SHA1", oauth_timestamp="1", oauth_token="at", oauth_version="1.0"$/);
});

test('missing credentials lists names, not values', async () => {
  await assert.rejects(
    createPost('hi', { env: { DRY_RUN: 'false', X_API_KEY: 'secretvalue' }, fetch: () => assert.fail() }),
    (e) => /X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_TOKEN_SECRET/.test(e.message) && !e.message.includes('secretvalue')
  );
});

test('dry-run never calls fetch (default)', async () => {
  const r = await createPost('hi', { env: {}, fetch: () => assert.fail('fetch called') });
  assert.equal(r.dryRun, true);
  const r2 = await createPost('hi', { env: ENV, dryRun: true, fetch: () => assert.fail() });
  assert.equal(r2.dryRun, true);
});

test('success sends JSON body with OAuth header and returns id', async () => {
  let call;
  const r = await createPost('hello', {
    env: ENV, logger: quiet,
    fetch: async (url, init) => { call = { url, init }; return res(201, { data: { id: '123', text: 'hello' } }); },
  });
  assert.equal(r.id, '123');
  assert.equal(call.url, 'https://api.x.com/2/tweets');
  assert.equal(call.init.body, '{"text":"hello"}');
  assert.match(call.init.headers.Authorization, /^OAuth /);
});

test('401 gives auth hint', async () => {
  await assert.rejects(
    createPost('hi', { env: ENV, logger: quiet, fetch: async () => res(401, { title: 'Unauthorized' }) }),
    /authentication failed \(401\).*Read and write/s
  );
});

test('429 far in future fails without retry', async () => {
  let calls = 0;
  await assert.rejects(
    createPost('hi', {
      env: ENV, logger: quiet, now: () => 0, sleep: () => assert.fail('slept'),
      fetch: async () => { calls++; return res(429, {}, { 'x-rate-limit-reset': '3600' }); },
    }),
    /rate limited \(429\)/
  );
  assert.equal(calls, 1);
});

test('429 resetting soon retries exactly once', async () => {
  let calls = 0; let slept = 0;
  const r = await createPost('hi', {
    env: ENV, logger: quiet, now: () => 0, sleep: async (ms) => { slept = ms; },
    fetch: async () => (++calls === 1 ? res(429, {}, { 'x-rate-limit-reset': '10' }) : res(201, { data: { id: '9' } })),
  });
  assert.equal(r.id, '9');
  assert.equal(calls, 2);
  assert.equal(slept, 11000);
});

test('500 reports status and body', async () => {
  await assert.rejects(
    createPost('hi', { env: ENV, logger: quiet, fetch: async () => res(500, { error: 'boom' }) }),
    /failed \(500\).*boom/
  );
});

test('text over 280 chars is rejected before sending', async () => {
  await assert.rejects(
    createPost('x'.repeat(281), { env: ENV, fetch: () => assert.fail() }),
    /281 characters/
  );
});

test('.env parser handles quotes and comments', () => {
  assert.deepEqual(parseEnv('# c\nA=1\nB="two words"\nexport C=3 # note\n'), { A: '1', B: 'two words', C: '3' });
});
