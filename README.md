# elm7fza (المحفظة) 
### · an Egyptian-Arabic Telegram money bot

> A personal finance bot you talk to in Egyptian Arabic. It lives in your Telegram
> chat, thinks with Gemini, keeps its books in Google Sheets, and runs for $0/month
> on Google Apps Script.

**Bot:** @elm7fza_bot · **Stack:** Google Apps Script + Google Sheets + Gemini + Telegram Bot API + GitHub Actions · **Tests:** 78, all green · **Released versions:** 42 · **License:** MIT

This repo is fully documented: what the system is, how to use it, how every
piece works, and how to build your own from zero.

## Why it exists

- Expense apps want forms and categories. My brain at the kiosk speaks Egyptian
  Arabic: «صرفت ٣٥ مواصلات». Typing that into a chat window is the lowest-friction
  accounting that exists.
- A finance bot must never lie, never lose a message, and never double-count.
  Everything in this repo is in service of those three promises.
- Money data should live somewhere I can actually open and audit: a plain
  Google Sheet, one row per transaction, no vendor lock-in.

## Feature highlights

| Area | What you get |
| --- | --- |
| Input | Quick text («50 مواصلات»), free-form narrative, voice notes, receipt photos |
| Local brain | Common phrases and simple expenses parse instantly with zero AI calls |
| AI parsing | Gemini turns messy Egyptian Arabic into structured transactions |
| Correction | Reply to any old message to edit it, or say «امسح» to delete it and get your money back in the totals |
| Runway | «فلوسي لازم تكفيني لحد آخر الشهر»: live daily allowance and burn tracking |
| Debt book | What I owe, what I'm owed, repayments that actually reduce balances |
| Reports | today, week, month, 3-month stats, top items, budgets, dashboard with charts |
| Reliability | Global poll lock, ack-before-process, write-ahead retry queue (12h), dedup by update id |
| Ops | `/doctor` self-heals triggers and menus, `/status`, `/debug`, Drive backups, CSV export |
| Deploy | One command: tests, version bump, commit, push, CI ships to Google and reports on Telegram |

## Documentation index

| File | Contents |
| --- | --- |
| [docs/SETUP.md](docs/SETUP.md) | Build your own instance from zero: Telegram, Gemini, Sheet, clasp, CI |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Every file, the message lifecycle, idempotency design, data model, runway math |
| [docs/USAGE.md](docs/USAGE.md) | The full user manual with Egyptian Arabic examples for every command |
| [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) | deploy.sh gates, the GitHub Actions pipeline, secrets, rollback |
| [docs/TESTING.md](docs/TESTING.md) | The vm-based test harness, the 80 tests, how to add your own |
| [docs/SECURITY.md](docs/SECURITY.md) | Threat model, what is secret and where it lives, going-public checklist |

## Repository map

```
elm7fza_bot/
├── src/                       the bot: 20 modules + manifest, exactly what lands on Google
│   ├── App.js                 entry points: pollUpdates, doPost, setup, doctor
│   ├── Migrations.js          one-time data migrations, run manually from the editor
│   ├── AppContext.js          composition root: lazy singletons, secrets()
│   ├── Router.js              message gateway + reply-to-edit/delete engine
│   ├── Commands.js            the 30 Telegram commands + status/debug + manual debt entry
│   ├── FinanceService.js      reports, runway math, debt book, budget warnings
│   ├── IntentRouter.js        the local brain: quick parse, zero AI calls
│   ├── IntelligenceService.js Gemini prompt building, extraction, corrections
│   ├── GeminiClient.js        Gemini API wrapper with fallback models
│   ├── TelegramClient.js      Bot API wrapper
│   ├── PollingEngine.js       locked poll loop, offset ack, error triage
│   ├── RetryQueue.js          write-ahead retry sheet (12h, 60s interval)
│   ├── Repositories.js        sheet access layer for all 8 tabs
│   ├── BackupService.js       Drive folder backup: jsonl, meta, log archives
│   ├── DashboardService.js    builds the Dashboard sheet with charts
│   ├── Core.js                kernel: errors, date/text utils, dedup, notifier
│   ├── Models.js              Transaction, ExtractionResult
│   ├── Config.js              runtime constants: sheets, categories, intents, kinds
│   ├── Strings.js             every sentence the bot says: STR, MESSAGES, KEYBOARD, I18n
│   ├── Changelog.js           per-version welcome messages
│   └── appsscript.json        the manifest (Africa/Cairo, V8)
├── deploy.sh                  TESTS → BUMP → COMMIT → PUSH gate script
├── docs/                      this documentation set
├── tests/                     run.js harness + 8 suites (80 tests)
├── .ci/                       auth.sh, build-payload.py, push.sh, verify.sh, notify.sh
└── .github/workflows/         deploy.yml: the 7-stage pipeline
```

The layout note: GAS itself has no folders, so CI sends each file to Google by
its bare name (`src/App.js` becomes `App`). The folder structure is the repo's
to keep the engineering sane; the runtime stays flat. `src/` holds exactly
what ships to Google: the 20 modules plus `appsscript.json`, nothing else.
Every code file in `src/` carries a two-line header declaring its layer and
single responsibility.

## Quick facts

| Fact | Value |
| --- | --- |
| Source files | 20 JavaScript modules + appsscript.json in src/ (Apps Script V8, flat on GAS) |
| Storage | Google Sheets, 8 tabs: Transactions, Categories, Budgets, Log, Prompts, Dashboard, RetryQueue, Runway |
| AI model | gemini-3.8-flash (temperature 0.2, fallbacks: gemini-flash-latest, gemini-3.5-flash) |
| Polling | 1-minute time trigger, 20s long-poll hot session, capped at 50s per run |
| Retry budget | 12 hours, 60s between attempts, 5 per cycle |
| Monthly cost | $0 within personal-use quotas |
| Language of the UI | Egyptian Arabic (with English strings available via /lang) |

## Version history highlights

| Version | The story |
| --- | --- |
| v30 baseline | Text, voice and photo input, sheets storage, reports, dashboard, backups |
| v33 | Canonical person names + case folding for the debt book |
| v34 | Runway: set an end date, get a daily allowance, live line after each save |
| v35–v36 | Honest retry texts, 12h queue, menu fixes, runway sheet config |
| v37 | Global poll lock + save dedup + `/doctor` + menu self-heal (no double processing) |
| v39 | Write-ahead queue reservation before AI calls (no more silent message loss) |
| v40 | Reply-to-edit, delete-by-reply with money-back, live Runway amount column |
| v41 | Unified debt-book names (any spelling of a person = one entry), calm runway line, yearless dates, zero em dashes |
| v42 | Repository restructure: src/ layout, single-responsibility modules (Config/Strings/Changelog, Router/Commands, App/Migrations). Zero behavior change |
| v43 | Privacy pass: friend names live in the `PERSON_ALIASES` Script Property instead of code, all fixtures and doc examples are synthetic |

## Quick start

Want your own? Open [docs/SETUP.md](docs/SETUP.md) and follow it top to bottom:
about an hour of clicking spread over Telegram, Google AI Studio, one Sheet,
and one GitHub repo. MIT licensed: copy it, bend it, ship your own. A link
back is appreciated but not required.
