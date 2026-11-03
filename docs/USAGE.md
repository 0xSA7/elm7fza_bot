# USAGE · talking to المحفظة

Everything below is how you actually use the bot day to day. The examples are
real Egyptian Arabic; English works too (`/lang en`).

## The one habit

Send money events as you'd say them out loud. That's the whole product:

```
صرفت ٣٥ مواصلات
اكل 120
كشك 15 وب-extension بيبسي 20
قبضت 12750
سلفت شلبي 200
```

The bot answers with what it saved, plus a live runway line (if one is active):

```
✅ اتسجلت:
🔴 35 · مواصلات (TRANSPORT)

✈️ باقي 10,175 · سماحك 363 ج/يوم لحد 11-30 🔴
```

## Input modes

| Mode | Example | Path |
| --- | --- | --- |
| Quick text | «50 مواصلات», «اكل 120» | local brain, instant, zero AI |
| Narrative text | «اتغدت انا وصاحبي ودفعت 350 وبعدين شريت حاجة 80» | Gemini |
| Voice note | any length, Egyptian Arabic | Gemini (transcription + extraction) |
| Receipt photo | snap the receipt | Gemini (vision) |
| Correction | reply to an old message (below) | local or Gemini CORRECTION MODE |

Quick grammar for instant saves:

```
[number] [shortcut]          50 مواصلات
[verb] [number] [shortcut]   صرفت 120 اكل
[income verb] [number]       قبضت 12750
```

Shortcuts are configurable (`QUICK_MAP` in Config.js): اكل/غدا/فطار/سناكس →
Food, قهوة/شيشة/خروجة → Outings, سوق/بقالة → Groceries, مواصلات/ميكروباص/
اوبر/تاكسي/بنزين → Transport, كهربا/فاتورة/نت/غاز → Utilities, دوا/دكتور →
Health, دراسة/كتب → Education, هدوم → Clothes, ايجار → Home, and a few more.

Asking works in plain Arabic too, no slash needed: «كام صرفت النهارده؟» routes
to today's report; «وريني الديون» routes to `/debts`.

## Fixing mistakes: reply, don't retype

Every save remembers its Telegram message id, so you can reply to it:

**Edit:**

```
(you reply to the old "كشف امي 200" message)
كشف امي كان ب 600 مش 200
```

→ old row removed, corrected row written in its place, money totals move
accordingly, runway recomputed. «اتعدلت بدل القديم: 1 حركة دلوقتي الصح».

**Delete:**

```
(you reply to any old expense message)
امسح
```

→ rows deleted, «🗑️ اتمسحت كلها والفلوس رجعت في حساباتك». The money
genuinely returns: totals are computed from the sheet, not cached.

If the correction is unclear, the bot says so and touches nothing (safe
default: never guess with money).

## The runway (العداد)

The feature for «الفلوس دي لازم تكفيني لحد آخر الشهر».

```
/runway 2026-11-05 2026-11-30        ← set it (start end)
/runway                             ← full report
```

Report:

```
✈️ العداد · من 11-05 لحد 11-30

💵 القبض في الفترة: 12,750ج
💸 الصرف: 2,575ج
💰 الباقي: 10,175ج
🎯 سماح يومي: 363ج (لسه 28 يوم) 🔴
```

After every save/edit/delete you get the calm one-liner:

```
✈️ باقي 10,175 · سماحك 363 ج/يوم لحد 11-30 🔴
```

🟢 means today's burn is within allowance, 🔴 means you're over today's pace.
Saying «الفلوس دي لحد آخر الشهر» in a sentence also sets it via AI. Dates show
without the year; the sheet keeps full dates. `/runway cancel` ends it.

## The debt book (دفتر الديون)

Deterministic commands, no AI, optional date at the end:

```
/lent شلبي 200 [2026-08-28]      سلفت لحد
/borrowed اسم 500                 استلفت
/repaid اسم 200                   سددت دين
/collected اسم 200                استردت سلفة
/lentold اسم 200                  سلفة قديمة (خارج التتبع)
/borrowedold اسم 500              دين قديم (من قبل التتبع)
```

In free text these work too: «سددت 900 لشلبي» is parsed and applied to the
existing balance. `/debts` prints both books:

```
🟠 اللي عليا (لازم أرد):
شلبي: 2,600ج

🔵 اللي ليا (عندهم لي):
...

⚖️ مركزك من الديون متوازن
```

Repayments reduce the person's balance (they're `repay_out` rows, not new
people). Names unify automatically: «شلبي», «Shalaby», «SHALABY» are one
entry, and the AI is shown your known-people list on every message so it
reuses spellings instead of inventing new ones.

## Commands reference

**Money views**

| Command | What it does |
| --- | --- |
| `/today` | today's spending + income |
| `/week` | last 7 days |
| `/month` | this month |
| `/stats` | statistics and 3-month comparison |
| `/top` | highest spending items this month |
| `/budget` | budget status per category (Budgets tab holds the limits) |
| `/last` | last 5 transactions |
| `/search كلمة` | full-text search over notes and original messages |
| `/category مواصلات` | all transactions of one category |
| `/dashboard` | rebuilds and links the charts sheet |
| `/export` | CSV of everything |

**Runway and debts**

| Command | What it does |
| --- | --- |
| `/runway [start] [end]` | full report, or set the counter |
| `/debts` | the debt book |

**Editing**

| Command | What it does |
| --- | --- |
| reply + correction text | edit that transaction |
| reply + «امسح» | delete it, money returns |
| `/undo` | remove the most recent transaction |

**Ops and health**

| Command | What it does |
| --- | --- |
| `/status` | system status: version, offset, queue |
| `/debug` | deep diagnostic dump |
| `/doctor` | 🩺 full self-check: heals triggers, menu, prompts |
| `/ping` | is the bot alive |
| `/backup` | force a Drive backup sync now |

**Config**

| Command | What it does |
| --- | --- |
| `/lang ar` or `/lang en` | interface language |
| `/getprompt`, `/setprompt` | view / replace the AI extraction prompt live |
| `/start`, `/help` | onboarding and the manual |

## The daily digest

Every night at 23:30 you get a summary before bed: income, spending, whether
you're on pace for the runway, tomorrow's allowance. If AI servers were busy,
the queue message is honest about it and confirms on success (up to 12h later).

## Good habits

- Send events as they happen; the runway line is only as honest as the inputs.
- Fix mistakes by replying, never by deleting rows in the Sheet by hand (the
  bot can't know, though totals recompute anyway).
- When Gemini is slammed you'll see «⏳ سيرفرات الذكاء الاصطناعي عليها ضغط
  دلوقتي...». Do nothing. It will confirm when it lands.
- `/doctor` first when anything feels off; it fixes most things by itself.
- `/export` before any big experiment. The Drive backup runs daily at 4am too.
