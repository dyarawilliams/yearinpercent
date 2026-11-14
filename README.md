# yearinpercent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Automated X (Twitter) bot that posts year progress as a percentage, a progress-bar image, and a short motivational line.

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

Node.js bot that calculates year progress, renders a matching PNG progress bar, picks a line from `config/messages.json`, and composes one post. Dry-run is the default; `npm run post` publishes to X via OAuth 1.0a.

| Area | Status |
|------|--------|
| Year-progress math | `src/yearProgress.js` |
| Progress-bar image | `src/progressImage.js` + `src/png.js` |
| Message selection | `src/message.js` |
| Post composition | `src/compose.js` |
| Dry-run entrypoint | `src/index.js` |
| Live X posting (OAuth 1.0a) | `src/xClient.js` — implemented, tested with mocked API |
| Scheduled automation | Ready workflow in `docs/github-actions/post.yml.example` — copy to enable |

### Roadmap

- Optional OAuth 2.0 PKCE + refresh
- “Already posted today” deduplication; image alt text
- Time-of-year templates; metrics on failed posts; multi-timezone / locale

---

## Features

- Continuous year % (2 decimals); leap-year aware (Jan 1 → next Jan 1)
- PNG progress bar attached to each post, aligned with the rounded percent; `█`/`░` text bar fallback
- Rotating motivational messages; dry-run by default
- Config for timezone, posting metadata
- Example GitHub Actions schedule (disabled) under `docs/github-actions/`
- MIT licensed

---

## Example output

```text
2026 is 86.00% complete
Keep going — every percent counts.
```

Attached image:

![2026 Progress Bar at 86%](docs/example-progress.png)

If the image can't be used, the bot posts the text-bar fallback instead:

```text
2026 is 86.00% complete
█████████████████░░░
Keep going — every percent counts.
```

Dry-run prints both versions, writes the image to `out/progress.png`, and ends with `DRY_RUN: post was composed but not sent to X.`

---

## How it works

1. **Clock** — Current time, interpreted in the configured timezone (see below).
2. **Progress** — `elapsedMs / totalYearDurationMs * 100`, round to 2 decimals.
3. **Image** — Render the PNG bar for that percent and year.
4. **Message** — Select from `config/messages.json`.
5. **Compose** — Headline + message.
6. **Publish** — Dry-run prints and saves the image; live uploads it (`POST /2/media/upload`), then posts (`POST /2/tweets`) with the media id.

### Architecture

```text
┌─────────────────┐     ┌──────────────────┐     ┌────────────────┐
│  Scheduler      │────▶│  src/index.js    │────▶│  composePost() │
│  (GH Actions /  │     │  (entrypoint)    │     └───────┬────────┘
│   cron / worker)│     └────────┬─────────┘             │
└─────────────────┘              │         ┌─────────────┼─────────────┐
                                 │         ▼             ▼             ▼
                                 │  yearProgress  progressImage   message
                                 │         └─────────────┬─────────────┘
                                 ▼                       ▼
                          xClient.createPost()   text + PNG
                          (dry-run, or upload + post via OAuth 1.0a)
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

A 1200×240 PNG with a white **“<YEAR> Progress Bar”** label on a tab that breaks the top border, and a 1080 px bar inside the frame.

| Element | Color |
|---------|-------|
| Background and label tab | navy `#030A1D` |
| Border | purple `#A653FB` |
| Fill | left-to-right gradient `#3295FA` → `#9348FD`, fixed to the full track (more violet shows as the year progresses) |
| Track (unfilled) | white `#FFFFFF` |
| Label | white |

Fill width: `round(1080 × percent / 100)` px, using the **same** rounded percent as the post text. The year comes from the same timezone logic.

Zero dependencies and identical on every OS: `src/png.js` encodes the PNG with `node:zlib`, and the label is drawn from pre-rendered Poppins ExtraBold glyphs in `assets/glyphs.json` (SIL OFL 1.1, see `assets/fonts/Poppins-OFL.txt`). To change the font, run `scripts/build-glyphs.py` (Pillow, dev only).

**Text fallback:** `src/progressBar.js` renders a 20-character `█`/`░` bar (`round(percent / 100 × 20)` filled, same rounded percent; length and characters in `config/default.json` → `progressBar`). It's used only when the image can't be rendered or uploaded.

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
| Endpoints | `POST https://api.x.com/2/media/upload` (image), then `POST https://api.x.com/2/tweets` |
| Auth | **User context** — OAuth 1.0a (API key/secret + access token/secret) **or** OAuth 2.0 Authorization Code with PKCE |
| App-only bearer | **Cannot** create posts |
| Upload body | JSON `{"media": "<base64 PNG>", "media_category": "tweet_image"}` (≤ 5 MB); returns `data.id` |
| Post body | JSON `{"text": "…", "media": {"media_ids": ["<id>"]}}` |
| App setup | Developer account → Project → App with **read and write** |

Docs: [Upload Media](https://docs.x.com/x-api/media/upload-media) · [Create Post](https://docs.x.com/x-api/posts/create-post) · [Developer Portal](https://developer.x.com/)

**Status: implemented.** `src/xClient.js` signs both requests with OAuth 1.0a HMAC-SHA1 (`node:crypto`, no dependencies; JSON bodies aren't part of the signature) and sends them via `fetch`. Posts over 280 characters are rejected before sending. If rendering or uploading the image fails for any reason (401/402/403, 429 after the retry, missing media id, network error), it logs a warning with the reason and posts the text-bar fallback without media. If the text post itself fails, the run exits nonzero. On success it logs the post id. On `429` it logs when the limit resets (`x-rate-limit-reset`) and retries once only if that's within ~60 s; otherwise it exits nonzero.

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
| Fallback bar length / characters | `config/default.json` → `progressBar` |
| Dry-run default | `config/default.json` → `dryRun` and `DRY_RUN` |
| Motivational lines | `config/messages.json` |

Match frequency to your X access tier (default: weekly, every Friday).

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
npm test
npm run dry-run        # node src/index.js --dry-run (works on macOS, Linux, Windows)
```

Dry-run prints the post text and saves the image to `out/progress.png` (gitignored); open it to preview. `--dry-run` forces dry-run regardless of `DRY_RUN`, with no network call to X. No runtime dependencies, so no `npm install` needed.

**Real test post:** put your four `X_*` keys in `.env` (loaded automatically; existing env vars win), then run `npm run post` (`node src/index.js --live`). It uploads the image, posts, and prints the new post id. `--dry-run` still wins if both flags are passed.

---

## Testing

```bash
npm test
```

| Area | Cases |
|------|--------|
| Year progress | Leap vs non-leap; mid-year; Jan 1 00:00 → `0.00%`; last moment of Dec 31 → `100.00%`; 1 ms before the 100% window → `99.99%`; same instant in `America/New_York` vs `UTC`; `BOT_TIMEZONE` override; no hard-coded year |
| Progress image | 1200×240 PNG; gradient colors at fill edges and 0% / 100%; gradient fixed to track; navy background, purple frame, tab, label |
| Fallback bar | Empty / full / mid; custom chars; clamp |
| Messages | Load templates; deterministic pick with injected RNG; empty fallback |
| Compose | Image text (no bar) and fallback text (percent, bar, message); percent once |
| API / auth | OAuth signature vs. documented example; missing secrets; dry-run never calls fetch; success id; image upload request shape + `media_ids`; fallback to text bar on upload 401 / 402 / 429 / missing id / network error / render error; text-post failure exits nonzero; 401; 429 (no retry / one bounded retry); 500; text > 280 |
| Dry-run | `--dry-run` flag forces dry-run even with `DRY_RUN=false`; prints image text and fallback text, writes `out/progress.png` |

### Error handling

| Situation | Expected behavior |
|-----------|-------------------|
| Missing OAuth secrets (live) | Throw listing missing env var names |
| `DRY_RUN=true` | Never call X; print composed post |
| Text > 280 characters | Throw before sending |
| Image render or upload fails | Warn with reason; post the text-bar fallback without media |
| HTTP 401/403 | Auth error with hint: Read and write permission, regenerate access token |
| HTTP 429 | Log reset time; one retry only if reset ≤ ~60 s, else exit nonzero |
| Other 4xx/5xx | Log status + response body (never headers/secrets); exit nonzero |
| Invalid config / empty messages | Safe defaults where possible |

Never log raw tokens or full `.env` contents.

---

## Automation and deployment

1. **GitHub Actions** (recommended) — `docs/github-actions/post.yml.example`: weekly every Friday at 14:07 UTC (`7 14 * * 5`, ~9:07 AM ET in winter, 10:07 AM ET in summer) plus manual `workflow_dispatch`; runs `npm test` then `npm run post`
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
    default.json          # frequency, timezone, fallback bar, dryRun
    messages.json         # motivational templates
  src/
    index.js              # entry — dry-run default, --live posts
    yearProgress.js       # year % calculation
    progressImage.js      # PNG progress bar
    progressBar.js        # █ / ░ text fallback
    png.js                # tiny PNG encoder
    message.js            # template picker
    compose.js            # image text + fallback text
    loadEnv.js            # Tiny .env loader
    xClient.js            # OAuth 1.0a media upload + posting
  assets/
    glyphs.json           # pre-rendered label glyphs
    fonts/Poppins-OFL.txt # font license
  scripts/build-glyphs.py # dev-only glyph builder
  tests/                  # unit tests incl. mocked X API
  docs/example-progress.png
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

