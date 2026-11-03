# TESTING · 78 tests against a fake Apps Script

## The problem

Apps Script has no local runtime. You can't `npm test` code that calls
`SpreadsheetApp`, `LockService` or `UrlFetchApp`, and shipping to Google to
find out if you broke something is a terrible feedback loop (minutes per
iteration, and production is your test bench).

## The trick

`tests/run.js` builds a Node `vm` context that impersonates the entire Apps
Script runtime, then loads the 20 source files **in dependency order** exactly
as the real runtime would:

```
vm.createContext({
  console (muted), Logger, Session, Utilities,
  SpreadsheetApp, PropertiesService, CacheService,
  LockService, ScriptApp, DriveApp, UrlFetchApp, ContentService
})

```mermaid
flowchart LR
    config["Config"] --> strings["Strings"] --> changelog["Changelog"]
    changelog --> core["Core"] --> models["Models"] --> repositories["Repositories"]
    repositories --> intent["IntentRouter"] --> finance["FinanceService"]
    finance --> intelligence["IntelligenceService"] --> telegram["TelegramClient"]
    telegram --> gemini["GeminiClient"] --> router["Router"] --> commands["Commands"]
    commands --> retry["RetryQueue"] --> polling["PollingEngine"]
    polling --> dashboard["DashboardService"] --> backup["BackupService"]
    backup --> migrations["Migrations"] --> context["AppContext"] --> app["App"]
```

(order barely matters: GAS flattens every file into one global scope and
nothing executes top-level across files, but the harness keeps one canonical
order anyway)
```

The fakes are honest about behavior, not just shape: sheets store rows and
honor `deleteRow`; `Utilities.formatDate` formats real dates;
`LockService.tryLock` always succeeds (single-threaded by nature); properties
persist across calls within a run. UrlFetchApp returns canned Telegram/Gemini
responses, so tests never touch the network.

A tiny in-context framework (`test()`, `expect()` with `toBe/toEqual/toContain/
toBeTruthy/not`) runs the suites and exits 1 on any failure. That exit code is
the deploy gate, locally (`deploy.sh` Gate 1) and in CI (workflow stage 2).

## What the 78 tests cover

| Suite | Focus |
| --- | --- |
| `test-models.js` | Transaction sanitization, kind defaults, off-book loans, row round-trips, PERSON_MAP |
| `test-person.js` | name unification: «شلبي» = Shalaby in any spelling, old sheet rows normalize on read, repayment lands on the right balance, AI prompt carries the known-people line |
| `test-edit.js` | reply-to-edit idempotency, delete-by-reply money-back, runway line content (no income spam, yearless dates) |
| `test-queue.js` | write-ahead reservation, no duplicate rows, "execution killed" recovery, transient vs permanent error triage |
| `test-intent.js` | the local brain: quick formats, greetings, question routing |
| `test-config.js` | version parsing, i18n templates, `shortDate`, and the **repo-wide guards** |
| `test-dedup.js` | update_id dedup, mark-after-success semantics |
| `test-queue`/others | save guarantees, notification behavior |

### The guard tests (the ones that keep past mistakes dead)

One test reads **every file in the repo** (source, tests, `.ci`, workflow,
`deploy.sh`) into memory and fails if a single em dash (U+2014) appears
anywhere.
v41 removed them from every user-facing string; this test makes sure they
never come back. It's a silly little test that once caught a copy-paste
regression 40 seconds before it would have shipped.

The same pattern guards template integrity: the runway line template must not
contain `{in}` (v40's chatty income line stays dead), and `CHANGELOG` keys
must stay in sync with the version number.

## Adding your own test

1. Create `tests/test-anything.js`.
2. Use the in-context globals; the harness auto-discovers `test-*.js` files:

```javascript
test('my feature does the thing', function () {
  const d = harness();               // see existing suites for the helper
  const tx = d.parse('50 مواصلات');
  expect(tx.length).toBe(1);
  expect(tx[0].category).toBe('Transport');
});
```

3. `node tests/run.js` and watch it join the count.
4. If you touch Config strings or add files, the em-dash guard automatically
   scans them too: no registration needed.

## Rules the suite lives by

- **No network, no clock dependence.** All external services are faked; dates
  come through the mocked `Utilities`.
- **Behavior over coverage percentage.** Every test maps to a promise the bot
  makes (never double-save, never lose a message, never lie about balances).
- **The suite is the deploy gate.** Red tests equal no deploy, in both CI and
  the local script. There is no `--force`.
- **Regression tests for every scar.** Each production incident (double
  processing, silent loss, name forking) ended with a test that reproduces
  the exact failure mode before the fix.
