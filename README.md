# yearinpercent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Automated X (Twitter) bot that posts year progress as a percentage, a Unicode progress bar, and a short motivational line.

> **Author / Maintainer:** [D'yara Williams](https://github.com/dyarawilliams) (`dyarawilliams`)

---

## Table of contents

- [Overview](#overview)
- [Features](#features)
- [Example output](#example-output)
- [How it works](#how-it-works)
- [Year-progress calculation](#year-progress-calculation)
- [Progress-bar design](#progress-bar-design)
- [Bot personality](#bot-personality)
- [X API integration](#x-api-integration)
- [Configuration](#configuration)
- [Security](#security)
- [Local development](#local-development)
- [Testing](#testing)
- [Automation and deployment](#automation-and-deployment)
- [Project structure](#project-structure)
- [Contributing, license and author](#contributing-license-and-author)

---

## Overview

Node.js bot that calculates year progress, renders a matching Unicode bar, picks a line from `config/messages.json`, and composes one post. Dry-run is the default; `npm run post` publishes to X via OAuth 1.0a.

| Area | Status |
|------|--------|
| Year-progress math | `src/yearProgress.js` |
| Progress bar | `src/progressBar.js` |
| Message selection | `src/message.js` |
| Post composition | `src/compose.js` |
| Dry-run entrypoint | `src/index.js` |
| Live X posting (OAuth 1.0a) | `src/xClient.js` — implemented, tested with mocked API |
| Scheduled automation | Ready workflow in `docs/github-actions/post.yml.example` — copy to enable |

### Roadmap

- Optional OAuth 2.0 PKCE + refresh
- “Already posted today” deduplication; media / branded bar images
- Time-of-year templates; metrics on failed posts; multi-timezone / locale

---

## Features

- Continuous year % (2 decimals); leap-year aware (Jan 1 → next Jan 1)
- Progress bar (`█` / `░`) aligned with the rounded percent
- Rotating motivational messages; dry-run by default
- Config for bar, timezone, posting metadata
- Example GitHub Actions schedule (disabled) under `docs/github-actions/`
- MIT licensed

---

## Example output

```text
2026 is 75.34% complete
███████████████░░░░░
Keep going — every percent counts.
```

Dry-run wraps the same body with `=== yearinpercent dry-run ===` and `DRY_RUN: post was composed but not sent to X.`

---

## How it works

1. **Clock** — Current time, interpreted in the configured timezone (see below).
2. **Progress** — `elapsedMs / totalYearDurationMs * 100`, round to 2 decimals.
3. **Bar** — Map that percent onto a fixed-length bar.
4. **Message** — Select from `config/messages.json`.
5. **Compose** — Headline + bar + message.
6. **Publish** — Dry-run prints; live (future): `POST https://api.x.com/2/tweets` with user-context OAuth.

### Architecture

```text
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Scheduler      │────▶│  src/index.js    │────▶│  composePost() │
│  (GH Actions /  │     │  (entrypoint)    │     └───────┬────────┘
│   cron / worker)│     └────────┬─────────┘             │
└─────────────────┘              │         ┌─────────────┼─────────────┐
                                 │         ▼             ▼             ▼
                                 │  yearProgress   progressBar    message
                                 │         └─────────────┬─────────────┘
                                 ▼                       ▼
                          xClient.createPost()    composed text
                          (dry-run or future OAuth 1.0a POST)
```

Small, side-effect-light modules for easy tests and host swaps.

---

## Year-progress calculation

```text
percent = (elapsedTimeMs / totalYearDurationMs) * 100
```

Round to **two decimals** (e.g. `75.34`); label with `toFixed(2)`. Year from `now` (no hard-coded year). See `src/yearProgress.js`.

- **Bounds:** Jan 1 00:00 → next Jan 1 00:00 **local time in one IANA timezone** (leap years and DST handled). Timezone precedence: `BOT_TIMEZONE` env → `posting.timezone` in `config/default.json` → `UTC`. The host `TZ` is ignored. Example: at 2026-01-01 02:00 UTC it's 2026 at 0.02% in UTC but still 2025 at 99.97% in `America/New_York`.
- **0.00%:** exactly Jan 1 00:00 in the configured zone.
- **100.00%:** elapsed is clamped to `[0, total)`, so next Jan 1 00:00 is 0.00% of the new year. Rounding shows `100.00%` once ≤ 0.005% of the year remains — the last **26 min 16.8 s** of Dec 31 (365-day year) or **26 min 21.12 s** (leap year). This is intended.

---

## Progress-bar design

| Setting | Default | Notes |
|---------|---------|--------|
| Length | `20` | `config/default.json` |
| Filled | `█` | U+2588 FULL BLOCK |
| Empty | `░` | U+2591 LIGHT SHADE |

Filled count: `round((percent / 100) * length)` using the **same** rounded percent as the label. Example at 50%, length 20: `██████████░░░░░░░░░░`. See `src/progressBar.js`.

---

## Bot personality

Motivational, brief, encouraging. Templates in `config/messages.json` (default: random). Samples are tone examples — replace to match your voice.

- “Keep going — every percent counts.”
- “Small steps stack up. This year is still yours.”
- “Momentum beats perfection. Keep moving.”

---

## X API integration

| Item | Detail |
|------|--------|
| Endpoint | `POST https://api.x.com/2/tweets` |
| Auth | **User context** — OAuth 1.0a (API key/secret + access token/secret) **or** OAuth 2.0 Authorization Code with PKCE |
| App-only bearer | **Cannot** create posts |
| Body | JSON with at least `text` |
| App setup | Developer account → Project → App with **read and write** |

Docs: [Manage Posts quickstart](https://docs.x.com/x-api/posts/manage-tweets/quickstart) · [Developer Portal](https://developer.x.com/)

**Status: implemented.** `src/xClient.js` signs requests with OAuth 1.0a HMAC-SHA1 (`node:crypto`, no dependencies) and sends `{"text"}` via `fetch`. Posts over 280 characters are rejected before sending. On success it logs the post id. On `429` it logs when the limit resets (`x-rate-limit-reset`) and retries once only if that's within ~60 s; otherwise it exits nonzero.

**For a live bot:**
- Guard against double-fire (“already posted today”)
- Verify tier/pricing and rate limits in the Developer Portal before a frequent schedule

---

## Configuration

### Environment variables

| Variable | Required for live post | Purpose |
|----------|------------------------|---------|
| `X_API_KEY` | Yes (OAuth 1.0a) | Consumer API key |
| `X_API_SECRET` | Yes (OAuth 1.0a) | Consumer API secret |
| `X_ACCESS_TOKEN` | Yes (OAuth 1.0a) | User access token |
| `X_ACCESS_TOKEN_SECRET` | Yes (OAuth 1.0a) | User access token secret |
| `X_BEARER_TOKEN` | No | Optional; **not sufficient alone for posting** |
| `DRY_RUN` | No (default `true`) | Unless `false`, compose only — do not call X |
| `BOT_TIMEZONE` | No | IANA timezone for year bounds; overrides `posting.timezone` (e.g. `America/New_York`) |

See `.env.example`. Do not commit real credentials.

### Config files

| Concern | Where |
|---------|--------|
| Posting frequency / cron hint | `config/default.json` → `posting` |
| Timezone (year bounds) | `config/default.json` → `posting.timezone`; overridden by `BOT_TIMEZONE` |
| Bar length / characters | `config/default.json` → `progressBar` |
| Dry-run default | `config/default.json` → `dryRun` and `DRY_RUN` |
| Motivational lines | `config/messages.json` |

Match frequency to your X access tier (default: monthly on the 1st).

Timezone precedence: `BOT_TIMEZONE` env → `posting.timezone` → `UTC` (see [Year-progress calculation](#year-progress-calculation)).

---

## Security

Never commit keys, tokens, or `.env`. Use `.env` locally (gitignored) and encrypted secrets in CI. App needs **read and write** to post; `X_BEARER_TOKEN` alone is not enough. Prefer least privilege on GitHub. Rotate/revoke leaked credentials in the Developer Portal.

---

## Local development

Requires **Node.js 18+**.

```bash
git clone https://github.com/dyarawilliams/yearinpercent.git
cd yearinpercent
cp .env.example .env   # leave DRY_RUN=true
npm install
npm test
npm run dry-run        # node src/index.js --dry-run (works on macOS, Linux, Windows)
```

`--dry-run` forces dry-run regardless of `DRY_RUN`, with no network call to X. No runtime dependencies.

**Real test post:** put your four `X_*` keys in `.env` (loaded automatically; existing env vars win), then run `npm run post` (`node src/index.js --live`). It prints the new post id. `--dry-run` still wins if both flags are passed.

---

## Testing

```bash
npm test
```

| Area | Cases |
|------|--------|
| Year progress | Leap vs non-leap; mid-year; Jan 1 00:00 → `0.00%`; last moment of Dec 31 → `100.00%`; 1 ms before the 100% window → `99.99%`; same instant in `America/New_York` vs `UTC`; `BOT_TIMEZONE` override; no hard-coded year |
| Progress bar | Empty / full / mid; custom chars; clamp; length vs percent |
| Messages | Load templates; deterministic pick with injected RNG; empty fallback |
| Compose | Headline + bar + message; percent in text |
| API / auth | OAuth signature vs. documented example; missing secrets; dry-run never calls fetch; success id; 401; 429 (no retry / one bounded retry); 500; text > 280 |
| Dry-run | `--dry-run` flag forces dry-run even with `DRY_RUN=false`; prints only |

### Error handling

| Situation | Expected behavior |
|-----------|-------------------|
| Missing OAuth secrets (live) | Throw listing missing env var names |
| `DRY_RUN=true` | Never call X; print composed post |
| Text > 280 characters | Throw before sending |
| HTTP 401/403 | Auth error with hint: Read and write permission, regenerate access token |
| HTTP 429 | Log reset time; one retry only if reset ≤ ~60 s, else exit nonzero |
| Other 4xx/5xx | Log status + response body (never headers/secrets); exit nonzero |
| Invalid config / empty messages | Safe defaults where possible |

Never log raw tokens or full `.env` contents.

---

## Automation and deployment

1. **GitHub Actions** (recommended) — `docs/github-actions/post.yml.example`: monthly on the 1st at 14:07 UTC (`7 14 1 * *`, ~10:07 AM ET) plus manual `workflow_dispatch`; runs `npm test` then `npm run post`
2. **Serverless cron** — EventBridge + Lambda, Cloud Scheduler, etc.
3. **Cloud worker / VPS** — Workers cron, Fly.io, system cron

**Enable it:** add repo secrets `X_API_KEY`, `X_API_SECRET`, `X_ACCESS_TOKEN`, `X_ACCESS_TOKEN_SECRET` (Settings → Secrets and variables → Actions). Then in the GitHub web UI use **Add file → Create new file**, name it `.github/workflows/post.yml`, and paste the example. Trigger it once from the Actions tab to verify.

**Deployment:** default to dry-run in new environments; pin Node in CI; monitor X errors, rate-limit headers, and failed runs. Follow X Automation rules and applicable law.

---

## Project structure

```text
yearinpercent/
  README.md  LICENSE  .gitignore  .env.example  package.json
  config/
    default.json          # frequency, bar, timezone, dryRun
    messages.json         # motivational templates
  src/
    index.js              # entry — dry-run default, --live posts
    yearProgress.js       # year % calculation
    progressBar.js        # █ / ░ bar
    message.js            # template picker
    compose.js            # wires percent + bar + message
    loadEnv.js            # Tiny .env loader
    xClient.js            # OAuth 1.0a X posting
  tests/                  # unit tests incl. mocked X API
  docs/github-actions/
    post.yml.example      # ready workflow — copy to .github/workflows/post.yml
```

The workflow example lives under `docs/github-actions/` (pushing to `.github/workflows/` needs the `workflow` scope); copy it there via the GitHub web UI (Add file → Create new file).

---

## Contributing, license and author

Improvements to calculation accuracy, tests, docs, or safe automation are welcome.

1. Fork and create a feature branch.
2. Keep secrets out of commits.
3. Add/adjust tests for behavior changes.
4. Open a PR describing the change.

Contributions are licensed under MIT.

**License:** MIT — see [LICENSE](./LICENSE).

**Author / maintainer:** **D'yara Williams** · GitHub: [dyarawilliams](https://github.com/dyarawilliams)

---

*Blueprint scaffold — dry-run works today; live X posting is a follow-up once Developer Portal credentials and write permissions are in place.*
