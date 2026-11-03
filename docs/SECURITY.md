# SECURITY · what's secret, what's public, what strangers can do

This is the honest threat model for a personal Telegram bot wired to your
Google account. Short version: the code is safe to publish as-is, the bot
ignores strangers by design, and the four real secrets never touch the repo.

## Threat model: who might care

| Actor | What they could want | Reality |
| --- | --- | --- |
| Random Telegram users | spam the bot, poison your data, burn your AI quota | **blocked at the gate** (below) |
| Repo viewers (if public) | find tokens, find your sheet, find your data | repo scanned: zero secrets, zero sheet URLs |
| Quota thieves | use your Gemini key | key only in Script Properties |
| Someone with your GitHub account | push code that CI deploys to your bot | protected by GitHub auth + CLASPRC_JSON secret |

## The gate: strangers get silence

Every update, from any entry point, passes one check first:

```javascript
// Router.js, UpdateDispatcher.process()
if (String(msg.chat.id) !== String(this.deps.chatId)) return;
```

`chatId` is `MY_CHAT_ID`, a Script Property only you set. If someone finds
your bot's username and sends it messages, commands, voice notes or photos:

- they get no reply, ever (not even an error)
- nothing is written to your Sheet
- no Gemini call is made (the gate runs before any dispatch)
- the only cost is a few bytes of Telegram API traffic on your free quota

The webhook entry (`doPost`) is gated twice: a `WEBHOOK_SECRET` parameter
check, then the same chat-id gate inside `process()`. There is no path to the
database that skips `MY_CHAT_ID`.

So: **publishing the code, and even the bot's username, is fine.** The bot is
a locked door that only opens for one chat id.

## What's secret and where it lives

| Secret | Where | Blast radius if leaked | Rotation |
| --- | --- | --- | --- |
| `BOT_TOKEN` | Script Properties + CI secret | full control of the bot: send as it, briefly read pending updates. **Cannot** touch your Sheet or Google account | BotFather → `/revoke`, then update both places |
| `GEMINI_API_KEY` | Script Properties | stolen compute quota on your account | new key in AI Studio, replace property |
| `CLASPRC_JSON` | CI secret only | **worst case**: deploy arbitrary code to your Apps Script project, which can read your Sheet | `clasp logout && clasp login` on a trusted machine, update the secret |
| `MY_CHAT_ID` | Script Properties + CI secret | near-zero alone; it's a number, not an access | change it (annoying, rarely needed) |
| Sheet URL | nowhere in the repo | if the sheet is also link-shared, data exposure | keep sharing on Restricted |

Verified by scanning every tracked file for token patterns, OAuth refresh
tokens (`1//...`), `ya29.` access tokens, `AIza...` keys and
`docs.google.com/spreadsheets` URLs: **all clean.** The only identifier in
the repo is `.clasp.json`'s `scriptId`, which is not a secret (it grants
nothing without OAuth credentials). Remove it from git if you prefer a
spotless public history; CI reads it from the repo, so keep it somewhere the
deploy runs from.

## Things that are private but not secrets

- The **Transactions and Log tabs** contain your real messages and spending.
  They live in your private Sheet and never in the repo. Keep it that way:
  no link-sharing, no screenshots in issues.
- Your **commit email** becomes public in a public repo. GitHub's advice:
  commit with `ID+login@users.noreply.github.com` (for this account:
  `109046494+0xSA7@users.noreply.github.com`) instead of a personal Gmail,
  which scrapers harvest. Set per-repo:
  `git config user.email "109046494+0xSA7@users.noreply.github.com"`.
- `appsscript.json` says `webapp.access: ANYONE_ANONYMOUS`. That only matters
  if a web deployment exists. The polling design needs no web deployment;
  `installPolling()` deletes conflicting webhooks, and `doPost` is
  secret-gated anyway. If you never deploy as web app, this line is inert.

## Going-public checklist

Before flipping the repo to public:

1. Run a secret scan over the whole history, not just HEAD:
   `git log -p | grep -E "(ya29\.|AIza[0-9A-Za-z_-]|1//|bot[0-9]+:)"` (this
   history is clean as of v41).
2. Confirm the Sheet sharing is **Restricted** (not "anyone with link").
3. Decide on `.clasp.json`: keep (harmless id) or strip it.
4. Switch commit identity to the noreply email above.
5. Double-check GitHub Actions secrets are set (they stay secret; workflow
   files reference names only).
6. Keep the Log sheet out of any published screenshots.
7. Add a LICENSE so people can actually reuse it.

## Known limitations (honesty section)

- **No rate limiting**: the chat-id gate makes it mostly moot, but a
  flood of stranger messages does consume poll cycles (bounded, harmless).
- **Single user by design**: multi-user would need a per-chat allowlist
  table; that's a deliberate non-goal for a personal wallet.
- **Prompt injection is you-only**: Gemini parses text/photos that only you
  can send (the gate guarantees it). The worst you can do is confuse
  yourself; extraction is schema-validated before anything is saved.
- **Token in getUpdates history**: if the token leaks, an attacker can read
  undelivered messages until offset advances. Rotate fast, as with any bot
  token.
- **The Sheet is the castle**: anyone with edit rights to the Sheet changes
  the bot's truth. Share with nobody.

## Hardening ideas (v42 candidates)

- Optional polite refusal for strangers («البوت ده خاص») instead of silence,
  toggled by a Script Property.
- `doctor()` warning when `BOT_TOKEN` or `GEMINI_API_KEY` is missing/revoked
  (it already checks triggers and menus).
- A periodic self-test message (`/ping` automation) to catch silent trigger
  death within a day instead of when you next need the bot.
