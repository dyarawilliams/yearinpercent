# yearinpercent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)

An automated X (Twitter) bot that shares the current percentage of the year’s progress with a motivational message and a visual progress bar.

> **Author / Maintainer:** [D'yara Williams](https://github.com/dyarawilliams) (`dyarawilliams`)

---

## Table of contents

1. [Project title](#yearinpercent)
2. [Project description](#project-description)
3. [Project status](#project-status)
4. [Features](#features)
5. [Example output](#example-output)
6. [How it works](#how-it-works)
7. [Architecture overview](#architecture-overview)
8. [Year-progress calculation](#year-progress-calculation)
9. [Progress-bar design](#progress-bar-design)
10. [Bot personality](#bot-personality)
11. [X API integration](#x-api-integration)
12. [Authentication / security](#authentication--security)
13. [Environment variables](#environment-variables)
14. [Local development](#local-development)
15. [Installation](#installation)
16. [Configuration](#configuration)
17. [Testing](#testing)
18. [Automation / scheduling](#automation--scheduling)
19. [Deployment considerations](#deployment-considerations)
20. [Project structure](#project-structure)
21. [API considerations](#api-considerations)
22. [Error handling](#error-handling)
23. [Future improvements](#future-improvements)
24. [Contributing](#contributing)
25. [License](#license)
26. [Author / maintainer](#author--maintainer)

---

## Project description

**yearinpercent** is a small Node.js bot that:

1. Calculates how far the current calendar year has progressed (continuous elapsed time ÷ total year duration × 100).
2. Renders a Unicode progress bar that matches that percentage.
3. Picks a short motivational line from a configurable message set.
4. Composes a single post and (when live posting is implemented and credentials are present) publishes it to X via the X API v2.

This repository currently ships a **technical blueprint** plus **working dry-run scaffolding**: year progress, progress bar, message pick, and compose run locally without calling X.

---

## Project status

**Early / blueprint — not production.**

| Area | Status |
|------|--------|
| Year-progress math | Implemented in `src/yearProgress.js` |
| Progress bar | Implemented in `src/progressBar.js` |
| Message selection | Implemented in `src/message.js` |
| Post composition | Implemented in `src/compose.js` |
| Dry-run entrypoint | Implemented in `src/index.js` |
| Live X posting (OAuth) | **Not implemented** — stub only in `src/xClient.js` |
| Scheduled automation | Example workflow only (`docs/github-actions/post.yml.example`) |

Do not treat this as a production bot until live posting, secrets management, monitoring, and scheduling are finished and verified.

---

## Features

- Continuous year-progress percentage (2 decimal places)
- Leap-year aware (duration from Jan 1 → next Jan 1; no hard-coded year)
- Visual progress bar (`█` / `░`) consistent with the rounded percentage
- Rotating motivational messages (not the same line every time)
- Dry-run mode by default (safe local preview)
- Config-driven bar length, characters, timezone hints, and posting frequency metadata
- Example GitHub Actions schedule (disabled / commented) for future automation
- MIT licensed open source

---

## Example output

Conceptual post format (exact percent and message vary):

```text
2026 is 75.34% complete
███████████████░░░░░ 75.34%
Keep going — every percent counts.
```

Dry-run console output looks like:

```text
=== yearinpercent dry-run ===
2026 is 75.34% complete
███████████████░░░░░ 75.34%
Keep going — every percent counts.
=============================
DRY_RUN: post was composed but not sent to X.
```

---

## How it works

1. **Clock** — Use the current time in the desired timezone context (runtime `TZ` / host clock).
2. **Progress** — Compute `elapsedMs / totalYearDurationMs * 100`, round to 2 decimals.
3. **Bar** — Map that same rounded percent onto a fixed-length bar.
4. **Message** — Randomly (or otherwise) select a template from `config/messages.json`.
5. **Compose** — Join percent headline + bar line + message into one post body.
6. **Publish** — In dry-run, print the body. Live path (future): `POST https://api.x.com/2/tweets` with user-context OAuth.

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
                          (dry-run or future
                           OAuth 1.0a POST)
```

Modules are intentionally small and side-effect light so they are easy to unit test and to swap scheduling hosts later.

---

## Year-progress calculation

**Formula (continuous, not day-bucketed):**

```text
percent = (elapsedTimeMs / totalYearDurationMs) * 100
```

Then round to **exactly two decimal places** (e.g. `75.34`).

**Rules:**

- **No hard-coded year** — derive the year from the evaluation timestamp (`now`).
- **Year bounds** — `start = Jan 1 00:00:00.000` of that year; `end = Jan 1 00:00:00.000` of the next year.
- **Leap years** — `totalYearDurationMs` automatically includes Feb 29 when the year has 366 days.
- **Year boundaries** — each run recomputes from the current year, so Dec 31 → Jan 1 rolls cleanly without special cases beyond clamping elapsed time into `[0, totalMs]`.
- **Label** — always format with `toFixed(2)` (including `0.00` and `100.00`).

Reference implementation: `src/yearProgress.js`.

---

## Progress-bar design

| Setting | Default | Notes |
|---------|---------|--------|
| Length | `20` | Configurable in `config/default.json` |
| Filled char | `█` | U+2588 FULL BLOCK |
| Empty char | `░` | U+2591 LIGHT SHADE |

**Rounding consistency:** filled segment count is `round((percent / 100) * length)` using the **same** rounded percentage shown in the post, so the bar and the numeric label do not disagree.

Example at 50% with length 20:

```text
██████████░░░░░░░░░░
```

Reference implementation: `src/progressBar.js`.

---

## Bot personality

Tone: **motivational, brief, encouraging** — not spammy, not preachy.

- Messages live in `config/messages.json` as a **template collection**.
- Selection should vary across posts (default: random) so the bot is not stuck on one line.
- README / config samples are **tone examples only**; replace them to match your brand voice.

Examples (tone only):

- “Keep going — every percent counts.”
- “Small steps stack up. This year is still yours.”
- “Momentum beats perfection. Keep moving.”

---

## X API integration

Based on the current **X API v2** manage-Posts quickstart (confirm details in the official docs; tiers and pricing change).

| Item | Detail |
|------|--------|
| Create Post endpoint | `POST https://api.x.com/2/tweets` |
| Auth required | **User Context** — OAuth 1.0a (API key/secret + access token/secret) **or** OAuth 2.0 Authorization Code with PKCE (user access token) |
| App-only bearer | **Cannot** create posts |
| Body | JSON with at least `text` (or media) |
| Developer setup | Developer account → Project → App with **read and write** permissions |

**Official docs:**

- Manage Posts quickstart: [https://docs.x.com/x-api/posts/manage-tweets/quickstart](https://docs.x.com/x-api/posts/manage-tweets/quickstart)
- Developer Portal: [https://developer.x.com/](https://developer.x.com/)

**For a scheduled bot**, OAuth 1.0a user tokens are the practical default (long-lived). OAuth 2.0 + refresh tokens is a documented alternative if you prefer that flow.

**Rate limits:** vary by API access tier. Monitor response headers `x-rate-limit-remaining` and `x-rate-limit-reset`. On HTTP `429`, back off and retry according to reset timing. **Confirm current tier and rate limits in the Developer Portal** — they change over time.

Live HTTP posting is **not** implemented in this blueprint; see `src/xClient.js`.

---

## Authentication / security

- **Never commit** API keys, tokens, secrets, or `.env` files.
- Use `.env` locally (gitignored) and GitHub Actions **encrypted secrets** (or your host’s secret store) in CI.
- Grant the X app **read and write** only if you intend to post; review app permissions in the Developer Portal.
- Prefer least privilege on the GitHub side (workflow permissions, environment protection rules).
- App-only / bearer tokens are insufficient for posting; do not rely on `X_BEARER_TOKEN` alone.
- Rotate credentials if they leak; revoke old tokens in the Developer Portal.

---

## Environment variables

| Variable | Required for live post | Purpose |
|----------|------------------------|---------|
| `X_API_KEY` | Yes (OAuth 1.0a) | Consumer API key |
| `X_API_SECRET` | Yes (OAuth 1.0a) | Consumer API secret |
| `X_ACCESS_TOKEN` | Yes (OAuth 1.0a) | User access token |
| `X_ACCESS_TOKEN_SECRET` | Yes (OAuth 1.0a) | User access token secret |
| `X_BEARER_TOKEN` | No | Optional; **not sufficient alone for posting** |
| `DRY_RUN` | No (default `true`) | When not `false`, compose only — do not call X |
| `TZ` | No | Timezone for local clock behavior (e.g. `America/New_York`) |

See `.env.example` for placeholders. **Do not invent or commit real credentials.**

---

## Local development

Requirements: **Node.js 18+**.

```bash
git clone https://github.com/dyarawilliams/yearinpercent.git
cd yearinpercent
cp .env.example .env   # leave DRY_RUN=true; fill secrets only when implementing live post
npm test
npm run dry-run        # or: node src/index.js
```

Expected dry-run: printed composed post, no network call to X.

---

## Installation

```bash
npm install   # no runtime dependencies required for the current scaffold
```

This blueprint uses the Node.js built-in test runner (`node --test`) and ES modules. Add HTTP/OAuth libraries later when implementing live posting (for example an OAuth 1.0a signing helper).

---

## Configuration

Primary knobs:

| Concern | Where |
|---------|--------|
| Posting frequency / cron hint | `config/default.json` → `posting` |
| Timezone hint | `config/default.json` → `posting.timezone` and/or env `TZ` |
| Bar length / characters | `config/default.json` → `progressBar` |
| Dry-run default | `config/default.json` → `dryRun` and env `DRY_RUN` |
| Motivational lines | `config/messages.json` |

Adjust frequency to match your X access tier and audience expectations (daily is a reasonable default; confirm rate limits first).

---

## Testing

Run:

```bash
npm test
```

**Recommended cases** (several already covered under `tests/`):

| Area | Cases |
|------|--------|
| Year progress | Leap vs non-leap total duration; start / mid / end of year; `0.00%`; near-`100.00%`; 2-decimal rounding; no hard-coded year |
| Progress bar | Empty / full / mid; custom chars; clamp out-of-range; length consistency with percent |
| Messages | Load templates; deterministic pick with injected RNG; empty fallback |
| Compose | Headline + bar + message wiring; percent label appears in text |
| API / auth (future) | Missing secrets throw; dry-run never calls network; HTTP 429 backoff |
| Dry-run | `node src/index.js` prints only |

---

## Automation / scheduling

This project does **not** lock you into one host. Reasonable options:

1. **GitHub Actions** — scheduled workflow (see `docs/github-actions/post.yml.example`; fully commented, not enabled).
2. **Serverless cron** — AWS EventBridge + Lambda, Google Cloud Scheduler, etc.
3. **Cloud worker** — Cloudflare Workers cron triggers, Fly.io machines, a small always-on VPS with system cron.

**Recommendation:** start with GitHub Actions + `workflow_dispatch` + `DRY_RUN=true` for visibility, then enable schedule only after live posting and secrets are verified. Adjust cron for timezone / DST explicitly.

---

## Deployment considerations

- Keep secrets out of the repo and out of logs.
- Default to dry-run in new environments.
- Pin Node version in CI.
- Monitor X API errors, rate-limit headers, and failed workflow runs.
- Confirm your **current** X API access tier and pricing in the [Developer Portal](https://developer.x.com/) before enabling a frequent schedule.
- Respect X Automation / platform rules and applicable local laws.

---

## Project structure

```text
yearinpercent/
  README.md
  LICENSE
  .gitignore
  .env.example
  package.json
  config/
    default.json          # frequency, bar, timezone, dryRun
    messages.json         # motivational templates
  src/
    index.js              # entry — dry-run compose
    yearProgress.js       # year % calculation
    progressBar.js        # █ / ░ bar
    message.js            # template picker
    compose.js            # wires percent + bar + message
    xClient.js            # OAuth posting stub (dry-run / throws if live)
  tests/
    yearProgress.test.js
    progressBar.test.js
    message.test.js
    compose.test.js
  docs/
    github-actions/
      post.yml.example    # commented schedule example — copy to .github/workflows/post.yml when ready
```

> **Note:** An example workflow also belongs under `.github/workflows/` when enabling automation. Pushing files into `.github/workflows/` requires a GitHub token with the `workflow` scope; this scaffold keeps the example under `docs/github-actions/` so the initial commit can be pushed with standard `repo` scope. Copy/rename into `.github/workflows/` once that permission is available — and keep it disabled until secrets exist.


---

## API considerations

- Endpoint: `POST https://api.x.com/2/tweets` with JSON `{ "text": "..." }`.
- User-context auth only for create; bearer/app-only is not enough.
- OAuth 1.0a user tokens suit unattended bots; document OAuth 2.0 + refresh if you choose that path later.
- Text length must fit X’s post limits (validate before send).
- Idempotency: scheduled jobs can double-fire — consider “already posted today” guards later.
- Tier/rate limits and pricing change — **verify in the Developer Portal**, and handle `429` with backoff using `x-rate-limit-*` headers.
- Docs: [Manage Tweets quickstart](https://docs.x.com/x-api/posts/manage-tweets/quickstart) · [Developer Portal](https://developer.x.com/).

---

## Error handling

| Situation | Expected behavior |
|-----------|-------------------|
| Missing OAuth secrets on live path | Throw a clear error listing missing env var names |
| `DRY_RUN=true` | Never call X; print composed post |
| Live posting not implemented | Throw explicit “not implemented” after credential check |
| HTTP 429 (future) | Back off until `x-rate-limit-reset`; avoid tight retry loops |
| HTTP 4xx/5xx (future) | Log status/body safely (no secrets); fail the job |
| Invalid config / empty messages | Fall back to safe defaults where possible |

Avoid logging raw tokens or full `.env` contents.

---

## Future improvements

- Implement OAuth 1.0a signed `POST /2/tweets`
- Optional OAuth 2.0 PKCE + refresh-token path
- “Already posted today” deduplication
- Media / branded progress-bar images
- Richer message templates (time-of-year aware)
- Metrics / alerting on failed posts
- Multi-timezone or locale variants
- Harden CI with a real (non-example) workflow once secrets exist

---

## Contributing

Contributions that improve calculation accuracy, tests, docs, or safe automation are welcome.

1. Fork the repo and create a feature branch.
2. Keep secrets out of commits.
3. Add/adjust tests for behavior changes.
4. Open a pull request describing the change.

By contributing, you agree your work is licensed under the MIT License.

---

## License

This project is licensed under the **MIT License** — see [LICENSE](./LICENSE).

---

## Author / maintainer

**D'yara Williams**  
GitHub: [dyarawilliams](https://github.com/dyarawilliams)

---

*Blueprint scaffold — dry-run composition works today; live X posting is intentionally left for a follow-up implementation once Developer Portal credentials and app write permissions are in place.*
