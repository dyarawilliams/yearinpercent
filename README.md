# yearinpercent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

Automated X (Twitter) bot that posts year progress as a percentage, a Unicode progress bar, and a short motivational line.

> **Author / Maintainer:** [D'yara Williams](https://github.com/dyarawilliams) (`dyarawilliams`)

---

## Table of contents

1. [Project description](#project-description) · 2. [Project status](#project-status) · 3. [Features](#features) · 4. [Example output](#example-output)
5. [How it works](#how-it-works) · 6. [Architecture](#architecture-overview) · 7. [Year-progress calculation](#year-progress-calculation) · 8. [Progress bar](#progress-bar-design)
9. [Bot personality](#bot-personality) · 10. [X API](#x-api-integration) · 11. [Auth / security](#authentication--security) · 12. [Environment variables](#environment-variables)
13. [Local development](#local-development) · 14. [Installation](#installation) · 15. [Configuration](#configuration) · 16. [Testing](#testing)
17. [Automation](#automation--scheduling) · 18. [Deployment](#deployment-considerations) · 19. [Project structure](#project-structure) · 20. [API considerations](#api-considerations)
21. [Error handling](#error-handling) · 22. [Future improvements](#future-improvements) · 23. [Contributing](#contributing) · 24. [License](#license) · 25. [Author](#author--maintainer)

---

## Project description

Node.js bot that calculates year progress, renders a matching Unicode bar, picks a line from `config/messages.json`, and composes one post. Dry-run runs locally without calling X; live posting is stubbed pending OAuth.

---

## Project status

**Early / blueprint — not production.**

| Area | Status |
|------|--------|
| Year-progress math | `src/yearProgress.js` |
| Progress bar | `src/progressBar.js` |
| Message selection | `src/message.js` |
| Post composition | `src/compose.js` |
| Dry-run entrypoint | `src/index.js` |
| Live X posting (OAuth) | **Not implemented** — stub in `src/xClient.js` |
| Scheduled automation | Example only (`docs/github-actions/post.yml.example`) |

---

## Features

- Continuous year % (2 decimals); leap-year aware (Jan 1 → next Jan 1)
- Progress bar (`█` / `░`) aligned with the rounded percent
- Rotating motivational messages; dry-run by default
- Config for bar, timezone hints, posting metadata
- Example GitHub Actions schedule (disabled) under `docs/github-actions/`
- MIT licensed

---

## Example output

```text
2026 is 75.34% complete
███████████████░░░░░ 75.34%
Keep going — every percent counts.
```

Dry-run wraps the same body with `=== yearinpercent dry-run ===` and `DRY_RUN: post was composed but not sent to X.`

---

## How it works

1. **Clock** — Current time (`TZ` / host).
2. **Progress** — `elapsedMs / totalYearDurationMs * 100`, round to 2 decimals.
3. **Bar** — Map that percent onto a fixed-length bar.
4. **Message** — Select from `config/messages.json`.
5. **Compose** — Headline + bar + message.
6. **Publish** — Dry-run prints; live (future): `POST https://api.x.com/2/tweets` with user-context OAuth.

---

## Architecture overview

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

Round to **two decimals** (e.g. `75.34`). Year from `now` (no hard-coded year). Bounds: Jan 1 00:00:00.000 → next Jan 1 (leap years included). Clamp elapsed to `[0, totalMs]`; label with `toFixed(2)`. See `src/yearProgress.js`.

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

OAuth 1.0a user tokens suit scheduled bots. Rate limits vary by tier — watch `x-rate-limit-remaining` / `x-rate-limit-reset`; back off on `429`. Live HTTP posting is stubbed in `src/xClient.js`.

---

## Authentication / security

Never commit keys, tokens, or `.env`. Use `.env` locally (gitignored) and encrypted secrets in CI. App needs **read and write** to post; `X_BEARER_TOKEN` alone is not enough. Prefer least privilege on GitHub. Rotate/revoke leaked credentials in the Developer Portal.

---

## Environment variables

| Variable | Required for live post | Purpose |
|----------|------------------------|---------|
| `X_API_KEY` | Yes (OAuth 1.0a) | Consumer API key |
| `X_API_SECRET` | Yes (OAuth 1.0a) | Consumer API secret |
| `X_ACCESS_TOKEN` | Yes (OAuth 1.0a) | User access token |
| `X_ACCESS_TOKEN_SECRET` | Yes (OAuth 1.0a) | User access token secret |
| `X_BEARER_TOKEN` | No | Optional; **not sufficient alone for posting** |
| `DRY_RUN` | No (default `true`) | Unless `false`, compose only — do not call X |
| `TZ` | No | Timezone (e.g. `America/New_York`) |

See `.env.example`. Do not commit real credentials.

---

## Local development

Requires **Node.js 18+**.

```bash
git clone https://github.com/dyarawilliams/yearinpercent.git
cd yearinpercent
cp .env.example .env   # leave DRY_RUN=true
npm install
npm test
npm run dry-run        # or: node src/index.js
```

Dry-run prints the composed post with no network call to X.

---

## Installation

```bash
npm install
```

No runtime dependencies in the current scaffold. Uses Node’s built-in test runner (`node --test`) and ES modules. Add an OAuth 1.0a signing helper when implementing live posting.

---

## Configuration

| Concern | Where |
|---------|--------|
| Posting frequency / cron hint | `config/default.json` → `posting` |
| Timezone hint | `config/default.json` → `posting.timezone` and/or `TZ` |
| Bar length / characters | `config/default.json` → `progressBar` |
| Dry-run default | `config/default.json` → `dryRun` and `DRY_RUN` |
| Motivational lines | `config/messages.json` |

Match frequency to your X access tier (daily is a reasonable default).

---

## Testing

```bash
npm test
```

| Area | Cases |
|------|--------|
| Year progress | Leap vs non-leap; start / mid / end; `0.00%` / near-`100.00%`; 2-decimal rounding; no hard-coded year |
| Progress bar | Empty / full / mid; custom chars; clamp; length vs percent |
| Messages | Load templates; deterministic pick with injected RNG; empty fallback |
| Compose | Headline + bar + message; percent in text |
| API / auth (future) | Missing secrets throw; dry-run never networks; HTTP 429 backoff |
| Dry-run | `node src/index.js` prints only |

---

## Automation / scheduling

1. **GitHub Actions** — `docs/github-actions/post.yml.example` (commented, not enabled)
2. **Serverless cron** — EventBridge + Lambda, Cloud Scheduler, etc.
3. **Cloud worker / VPS** — Workers cron, Fly.io, system cron

Start with Actions + `workflow_dispatch` + `DRY_RUN=true`; enable schedule after live posting and secrets are verified.

---

## Deployment considerations

Secrets out of repo and logs; default dry-run in new environments. Pin Node in CI; monitor X errors, rate-limit headers, and failed runs. Confirm current X API tier/pricing in the [Developer Portal](https://developer.x.com/) before a frequent schedule. Follow X Automation rules and applicable law.

---

## Project structure

```text
yearinpercent/
  README.md  LICENSE  .gitignore  .env.example  package.json
  config/
    default.json          # frequency, bar, timezone, dryRun
    messages.json         # motivational templates
  src/
    index.js              # entry — dry-run compose
    yearProgress.js       # year % calculation
    progressBar.js        # █ / ░ bar
    message.js            # template picker
    compose.js            # wires percent + bar + message
    xClient.js            # OAuth posting stub
  tests/                  # yearProgress, progressBar, message, compose
  docs/github-actions/
    post.yml.example      # commented schedule — copy to .github/workflows/ when ready
```

The workflow example lives under `docs/github-actions/` (pushing to `.github/workflows/` needs the `workflow` scope); copy it there when that permission is available.

---

## API considerations

See [X API integration](#x-api-integration). For a live bot: validate text length against X limits; guard against double-fire (“already posted today”); verify tier/rate limits in the Developer Portal and handle `429` via `x-rate-limit-*` headers.

---

## Error handling

| Situation | Expected behavior |
|-----------|-------------------|
| Missing OAuth secrets (live) | Throw listing missing env var names |
| `DRY_RUN=true` | Never call X; print composed post |
| Live posting not implemented | Throw “not implemented” after credential check |
| HTTP 429 (future) | Back off until `x-rate-limit-reset` |
| HTTP 4xx/5xx (future) | Log status/body without secrets; fail the job |
| Invalid config / empty messages | Safe defaults where possible |

Never log raw tokens or full `.env` contents.

---

## Future improvements

- OAuth 1.0a signed `POST /2/tweets`; optional OAuth 2.0 PKCE + refresh
- “Already posted today” deduplication; media / branded bar images
- Time-of-year templates; metrics on failed posts; multi-timezone / locale
- Real CI workflow once secrets exist

---

## Contributing

Improvements to calculation accuracy, tests, docs, or safe automation are welcome.

1. Fork and create a feature branch.
2. Keep secrets out of commits.
3. Add/adjust tests for behavior changes.
4. Open a PR describing the change.

Contributions are licensed under MIT.

---

## License

**MIT License** — see [LICENSE](./LICENSE).

---

## Author / maintainer

**D'yara Williams** · GitHub: [dyarawilliams](https://github.com/dyarawilliams)

---

*Blueprint scaffold — dry-run works today; live X posting is a follow-up once Developer Portal credentials and write permissions are in place.*
