# SETUP · build your own instance from zero

Time budget: about an hour. Cost: $0 (everything runs inside free personal
quotas). You will end up with: a Telegram bot that only answers you, a Google
Sheet as its database, Gemini as its brain, and a GitHub repo that deploys it
on every push.

## Prerequisites

- A Google account (Sheets, Drive, Apps Script)
- A Telegram account
- Node.js locally (only to run the tests)
- Git + a GitHub account
- `clasp` (Google's Apps Script CLI): `npm install -g @google/clasp`

## Part A · create the assets

### 1. The Telegram bot

1. Talk to [@BotFather](https://t.me/BotFather), send `/newbot`, pick a name and
   a username (must end in `_bot`).
2. Copy the **bot token** it gives you (looks like
   `123456789:AA...`). This is a secret: anyone holding it controls the bot.
3. Get **your numeric chat id**: send any message to your new bot, then open

   ```
   https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates
   ```

   and read `"chat":{"id":...}` from the response. That number is the only
   chat the bot will ever respond to (see [SECURITY.md](SECURITY.md)).

### 2. The Gemini key

1. Go to Google AI Studio → “Get API key” → create a key.
2. Store it. Same rule: it is a secret, it burns quota if leaked.

### 3. The spreadsheet

1. Create a new Google Sheet. Copy its URL: the long id between `/d/` and `/edit`
   is the spreadsheet id.
2. From the Sheet: **Extensions → Apps Script**. This creates the Apps Script
   project bound to the sheet. This is where the code will live.
3. Keep the sheet sharing on **Restricted** (the default). Never turn on
   “anyone with the link”.

You do not need to create tabs by hand. The `setup()` function (Part D) creates
all 8 tabs with the right headers, and seeds the default categories.

## Part B · put the code on Google

Two options. The repo's CI uses the direct API, but locally `clasp` is the
friendliest:

```bash
git clone <your-fork-or-this-repo> elm7fza_bot
cd elm7fza_bot
clasp login                 # opens a browser, authorizes your account
clasp clone <SCRIPT_ID>     # or: clasp create --type sheets
```

Notes:

- `clasp clone` pulls the (empty) project into a folder; copy this repo's 16
  `.js` files + `appsscript.json` over it.
- `.clasp.json` in the repo root holds the `scriptId`. It is not a secret, but
  if you prefer not to publish your project id, keep it out of git and let CI
  read it from the repo you deploy from.

Push:

```bash
clasp push
```

You should now see the 16 files in the Apps Script editor.

## Part C · the secrets (Script Properties)

In the Apps Script editor: **Project Settings → Script Properties**, add:

| Property | Value | Notes |
| --- | --- | --- |
| `BOT_TOKEN` | the token from BotFather | required |
| `MY_CHAT_ID` | your numeric chat id | required, the allowlist |
| `GEMINI_API_KEY` | the AI Studio key | required |
| `WEBHOOK_SECRET` | any random string | optional, only if you use the webhook entry point |

Or set them from the editor's console once:

```javascript
PropertiesService.getScriptProperties().setProperties({
  BOT_TOKEN: 'xxx',
  MY_CHAT_ID: '123456789',
  GEMINI_API_KEY: 'AIza...'
});
```

Nothing secret ever goes into the repo. The code reads all four at runtime via
`AppContext.secrets()`.

## Part D · first run, from the Apps Script editor

Run these once from the editor (pick the function, click Run, approve the
permission prompts):

1. `setup()` · creates the 8 tabs, headers, default categories, dashboard.
2. `installPolling()` · installs the 1-minute polling trigger, the 4am backup
   sync, and the 23:30 daily digest, then sends you a “نظام السحب شغال ✅”
   message on Telegram.

Now send your bot: `50 مواصلات`. You should get a confirmation plus a runway
line (once a runway is set). If nothing happens, see the troubleshooting table
below.

## Part E · run the tests locally

The repo has a test harness that fakes the whole Apps Script runtime in a
Node `vm`:

```bash
cd elm7fza_bot
node tests/run.js
```

Expected: `78 passed | 0 failed`. If you changed nothing and something is red,
stop and fix before deploying: the deploy pipeline hard-stops on red tests.

## Part F · GitHub + CI deployment

1. Create a **private** GitHub repo and push the code.
2. Repo **Settings → Secrets and variables → Actions**, add three secrets:

   | Secret | Value |
   | --- | --- |
   | `CLASPRC_JSON` | the full JSON of `~/.clasprc.json` (clasp credentials, this is the deploy key) |
   | `BOT_TOKEN` | same token as the Script Property |
   | `MY_CHAT_ID` | your chat id |

3. Push to `main`. The workflow (`.github/workflows/deploy.yml`) runs: tests →
   auth → build payload → push to Google → verify byte-for-byte → bot health
   check → Telegram report. You should get a “✅ Deploy ناجح” message on
   Telegram within a couple of minutes.

From now on the loop is: edit code → `./deploy.sh "what changed"` → wait for
the Telegram confirmation. Details in [DEPLOYMENT.md](DEPLOYMENT.md).

### Where does CLASPRC_JSON come from?

After `clasp login`, your machine holds `~/.clasprc.json` with an OAuth refresh
token. The CI's `auth.sh` exchanges it for a short-lived access token and
pushes with the Apps Script API. To rotate it: `clasp logout && clasp login`
on a trusted machine, then update the secret.

## Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| Bot totally silent | trigger missing or died | run `installPolling()` again, or `/doctor` from Telegram |
| Bot answers others, not you | wrong `MY_CHAT_ID` | fix the Script Property |
| “مفيش عداد شغال” | no runway set yet | `/runway 2026-11-05 2026-11-30` |
| AI replies slow or queue messages | Gemini busy | normal, the queue retries for up to 12h |
| Deploy failed at tests | you broke a test | CI pushed nothing; fix locally with `node tests/run.js` |
| Deploy failed at verify | Google rejected the push | read the run log, usually a manifest issue |
| Duplicate rows | old version before v37 | update to latest; dedup is built in |

## What to customize first

- `CONFIG.DEFAULT_CATEGORIES` and `CATEGORY_AR_EN`: your own spending categories.
- `CONFIG.INTENTS.QUICK_MAP`: the Egyptian shortcuts you personally type most.
- `CONFIG.PERSON_MAP`: the people in your debt book, so spellings unify.
- The AI prompt: edit it live from Telegram with `/setprompt` (no redeploy), or
  see the `Prompts` tab.
- `STR` in Config.js: every sentence the bot says, Arabic and English.
