// ═══════════════ الإعدادات — v27 ═══════════════
const CONFIG = {
  VERSION: 33,
  MODEL: 'gemini-3.8-flash',
  SHEETS: {
    TX: 'Transactions', CATEGORIES: 'Categories', BUDGETS: 'Budgets',
    LOG: 'Log', PROMPTS: 'Prompts', DASHBOARD: 'Dashboard',
    RETRY: 'RetryQueue'
  },
  TX_HEADERS: ['Date', 'Amount', 'Currency', 'Type', 'Category', 'Note',
               'Original Message', 'Message ID', 'Created At'],
  LOG_HEADERS: ['Timestamp', 'Level', 'Event', 'Status', 'Update ID', 'Lang', 'Details', 'Raw'],
  LOG_MAX_ROWS: 2000,
  LOG_TRIM_TO: 1500,
  RETRY_HEADERS: ['Update ID', 'Message JSON', 'Attempts', 'First Try At', 'Next Try At'],

  // تصنيفات مفصلة أكتر
  DEFAULT_CATEGORIES: [
    // مصاريف
    'Food', 'Groceries', 'Transport', 'Utilities', 'Home', 'Health',
    'Education', 'Outings', 'Entertainment', 'Clothes', 'Gifts', 'Personal', 'Other',
    // دخل
    'Salary', 'Free Money', 'Own Money'
  ],
  CATEGORY_AR_EN: {
    'طعام': 'Food', 'سوق': 'Groceries', 'مواصلات': 'Transport', 'فواتير': 'Utilities',
    'بيت': 'Home', 'صحة': 'Health', 'تعليم': 'Education', 'ترفيه': 'Outings',
    'ملابس': 'Clothes', 'هدايا': 'Gifts', 'شخصي': 'Personal', 'مرتب': 'Salary',
    'دخل إضافي': 'Free Money', 'غيره': 'Other'
  },
    PERSON_MAP: {
    'امي': 'Mother', 'والدتي': 'Mother', 'ماما': 'Mother', 'اميا': 'Mother',
    'ابويا': 'Father', 'والدي': 'Father', 'بابا': 'Father', 'ابي': 'Father',
    'اخويا': 'Brother', 'اختي': 'Sister'
  },

  // 🧠 العقل المحلي — الحالات المؤكدة اللي مش محتاجة AI
  INTENTS: {
    GREETINGS: ['شكرا','شكرا ليكم','تسلم','متشكر','جزاك الله خيرا','تمام','اوكي','اوك','ماشي',
                'اهلا','اهلا وسهلا','ازيك','ازيكم','صباح الخير','مساء الخير','السلام عليكم','سلام',
                'hi','hello','hey','thanks','thank you','thx','ok','okay'],
    QUESTION_WORDS: ['كام', 'كم', 'قديش', 'قد ايه', 'وريني', 'عرض', 'هات', 'ملخص', 'تفاصيل',
                     'قولي', 'متي', 'امتي', 'فين', 'ليه',
                     'how much', 'show', 'summary', 'details', 'what did', 'when did'],
    TOPICS: [
      { cmd: 'today',  words: ['النهارده','اليوم','today'] },
      { cmd: 'month',  words: ['الشهر','شهري','month'] },
      { cmd: 'debts',  words: ['الديون','دين','سلف','اللي عليا','اللي ليا','debt','owe','owed'] },
      { cmd: 'top',    words: ['الاعلى','اكتر','top'] },
      { cmd: 'budget', words: ['الميزانية','budget'] },
      { cmd: 'last',   words: ['اخر','الاخير','last'] },
      { cmd: 'stats',  words: ['احصائيات','stats','statistics'] }
    ],
    QUICK_MAP: {
      'اكل':'Food','غدا':'Food','عشا':'Food','فطار':'Food','سناكس':'Food','لنش':'Food','فود':'Food',
      'قهوة':'Outings','شيشة':'Outings','خروجة':'Outings','خروجات':'Outings',
      'سوق':'Groceries','سوبرماركت':'Groceries','بقالة':'Groceries',
      'مواصلات':'Transport','ميكروباص':'Transport','اوبر':'Transport','كريم':'Transport',
      'تاكسي':'Transport','بنزين':'Transport','توصيل':'Transport',
      'كهربا':'Utilities','فاتورة':'Utilities','فواتير':'Utilities','نت':'Utilities','غاز':'Utilities',
      'سينما':'Entertainment','العاب':'Entertainment',
      'هدوم':'Clothes','لبس':'Clothes',
      'دوا':'Health','دكتور':'Health','عيادة':'Health',
      'دراسة':'Education','كتب':'Education','مدرسة':'Education','جامعة':'Education',
      'شخصي':'Personal','ايجار':'Home','اثاث':'Home',
      'food':'Food','coffee':'Outings','transport':'Transport','lunch':'Food'
    },
    SPEND_VERBS: ['صرفت', 'صرفت', 'دفعت', 'شريت', 'ولعت', 'وليت', 'خدت', 'اخدت',
                  'spent', 'paid', 'bought'],
    INCOME_VERBS: ['كسبت', 'حسنت', 'قبضت', 'حصلت', 'استلمت'],
    UNITS: ['ج', 'جنيه', 'جنيها', 'جنيها', 'egp', ' leverage', 'pounds'],
    PREPS: ['على', 'في', 'فل', 'عشان', 'ب', 'بال', 'وب', 'من', 'on', 'for', 'with', 'from']
  },

  KINDS: {
    income:       { sign: '+', icon: '🟢', strKey: 'kIncome',     cash: 1 },
    loan_in:      { sign: '+', icon: '🟠', strKey: 'kLoanIn',     cash: 1 },
    loan_in_off:  { sign: '',  icon: '🔶', strKey: 'kLoanInOff',  cash: 0 },
    repay_in:     { sign: '+', icon: '🔵', strKey: 'kRepayIn',    cash: 1 },
    expense:      { sign: '−', icon: '🔴', strKey: 'kExpense',    cash: -1 },
    repay_out:    { sign: '−', icon: '🟠', strKey: 'kRepayOut',   cash: -1 },
    loan_out:     { sign: '−', icon: '🔵', strKey: 'kLoanOut',    cash: -1 },
    loan_out_off: { sign: '',  icon: '🔷', strKey: 'kLoanOutOff', cash: 0 }
  },
  DEBT_KINDS: ['loan_in', 'repay_out'],   // حركات الدين اللي عليا
  LOAN_KINDS: ['loan_out', 'repay_in'],   // حركات السلف اللي ليا

  GEMINI: { TEMPERATURE: 0.2, RETRIES: 1, RETRY_DELAY_MS: 3000, MAX_OUTPUT_TOKENS: 1500,FALLBACK_MODELS: [ 'gemini-flash-latest', 'gemini-3.5-flash' ] },
  POLLING: { LIMIT: 50, LONG_POLL_SEC: 20, MAX_SESSION_MS: 50000 },
  PROMPT_KEY: 'EXTRACT_PROMPT',
  RETRY: { MAX_WAIT_MS: 900000, INTERVAL_MS: 60000, MAX_PER_CYCLE: 5 },
  BACKUP: {
    FOLDER_NAME: 'WalletBot DB',
    TX_FILE: 'transactions.jsonl',
    META_FILE: 'meta.json',
    LOG_PREFIX: 'log_',
    LOG_ARCHIVE_MONTHS: 12,
    ARCHIVE_LEVELS: ['ERROR', 'WARN']
  }
};

const CHANGELOG = {
  30: '🔷 <b>Version 30 — السلف خارج الدفتر + إصلاح الوقفة</b>\n\n' +
      '• /lentold و /borrowedold — ديون من فلوس قديمة غير متتبعة.\n' +
      '• إصلاح: الرسايل النصية كانت بتهاجر (توصيلة العقل المحلي).\n' +
      '• إصلاح: رسالة تعليمات الأوامر لما الصيغة تغلط.\n' +
      '• setupMenuCommands — تسجيل كل الأوامر في منيو تليجرام 📋'
};

const STR = {
  income:       { ar: 'دخل حر (بدون السلف)', en: 'Real income' },
  expense:      { ar: 'صرف', en: 'Expenses' },
  net:          { ar: 'صافي', en: 'Net' },
  savingRate:   { ar: 'نسبة التوفير', en: 'Saving rate' },
  distribution: { ar: 'التوزيع', en: 'Breakdown' },
  noData:       { ar: 'مفيش حاجة مسجلة 🤷', en: 'Nothing recorded yet 🤷' },
  today:        { ar: 'النهارده', en: 'Today' },
  last7:        { ar: 'آخر ٧ أيام', en: 'Last 7 days' },
  thisMonth:    { ar: 'الشهر الحالي', en: 'Current month' },
  lastMonths:   { ar: 'آخر {n} شهور', en: 'Last {n} months' },
  topItems:     { ar: 'أعلى البنود استهلاكاً الشهر ده', en: 'Top spending this month' },
  noExpenses:   { ar: 'مفيش مصاريف مسجلة الشهر ده 🤷', en: 'No expenses this month 🤷' },
  noBudgets:    { ar: 'مفيش ميزانيات. حط صفوف في تاب Budgets: التصنيف | الحد الشهري', en: 'No budgets. Add rows in Budgets tab: Category | Monthly limit' },
  budgetFor:    { ar: 'ميزانية', en: 'Budget for' },
  of:           { ar: 'من', en: 'of' },
  overBudget:   { ar: 'عدّيت الميزانية! صرفت', en: 'Over budget! Spent' },
  nearBudget:   { ar: 'وصلت', en: 'Reached' },
  ofBudget:     { ar: 'من ميزانية', en: 'of budget' },
  searchUsage:  { ar: 'اكتب كلمة للبحث، مثال: /search موبايل', en: 'Type a word to search, e.g. /search phone' },
  searchResults:{ ar: 'نتائج البحث', en: 'Search results' },
  noResults:    { ar: 'مفيش أي نتائج بكلمة', en: 'No results for' },
  total:        { ar: 'الإجمالي', en: 'Total' },
  last5:        { ar: 'آخر ٥ حركات', en: 'Last 5 transactions' },
  noNote:       { ar: 'بدون ملاحظة', en: 'no note' },
  savedOne:     { ar: 'اتسجلت', en: 'Saved' },
  savedMany:    { ar: 'اتسجلت {n} حركات', en: '{n} transactions saved' },
  nothingToUndo:{ ar: 'مفيش حاجة أتمسحها', en: 'Nothing to undo' },
  undone:       { ar: 'مسحت', en: 'Removed' },
  unknownCmd:   { ar: 'ميعرفنيش الأمر ده 🤔 جرّب /help', en: 'Unknown command 🤔 try /help' },
  unsupported:  { ar: 'ابعتلي كتابة أو صوت أو صورة فاتورة 🙏', en: 'Send me text, voice, or a receipt photo 🙏' },
  aiBusyQueued: { ar: '⏳ سيرفرات الذكاء الاصطناعي عليها ضغط دلوقتي — مش محتاج تعمل أي حاجة، هحاول تلقائياً وأبلغك أول ما تنجح (لحد ١٥ دقيقة).', en: '⏳ AI servers are busy right now — no action needed, I\'ll keep retrying and will confirm once it goes through (up to 15 min).' },
  retryTimeout: { ar: '⏱️ سبت المحاولة بعد ١٥ دقيقة والسيرفرات لسه مشغولة — ابعت الرسالة تاني في وقت تاني.', en: '⏱️ Gave up after 15 minutes — servers still busy. Please resend later.' },
  // 💳 الديون
  kIncome:      { ar: 'دخل حر', en: 'free money' },
  kExpense:     { ar: 'صرف', en: 'expense' },
  kLoanIn:      { ar: 'استلاف — لازم يُرَد', en: 'borrowed — must repay' },
  kRepayOut:    { ar: 'سداد دين', en: 'debt repayment' },
  kLoanOut:     { ar: 'سلفة — ليك عنده', en: 'lent out' },
  kRepayIn:     { ar: 'استرداد سلفة', en: 'loan repaid to you' },
  owedTitle:    { ar: '🟠 اللي عليا (لازم أرد):', en: '🟠 What I owe:' },
  dueTitle:     { ar: '🔵 اللي ليا (عندهم لي):', en: '🔵 Owed to me:' },
  noDebts:      { ar: 'مفيش ديون مسجلة 🎉', en: 'No debts recorded 🎉' },
  settledMark:  { ar: '✅ سُدّدت بالكامل', en: '✅ fully settled' },
  netOwedMore:  { ar: '⚖️ عليك ديون أكتر من اللي ليك بـ', en: '⚖️ You owe more than you\'re owed by' },
  netDueMore:   { ar: '⚖️ ليك أكتر من اللي عليك بـ', en: '⚖️ You\'re owed more than you owe by' },
  netBalanced:  { ar: '⚖️ مركزك من الديون متوازن', en: '⚖️ Debt position balanced' },
  debtsPeriod:  { ar: 'حركة الديون في الفترة:', en: 'Debt movement in period:' },
  debtsFull:    { ar: '📋 الدفتر الكامل: /debts', en: '📋 Full debt book: /debts' },
  borrowed:     { ar: 'استلفت', en: 'Borrowed' },
  repaid:       { ar: 'سددت', en: 'Repaid' },
  lent:         { ar: 'سلّفت', en: 'Lent' },
  collected:    { ar: 'استردت', en: 'Collected' },
  greetingReply: { ar: 'العفو 🙌 ابعت أي مصروف أو سؤال وأنا معاك', en: 'Anytime 🙌 Send me any expense or question' },
  fallbackReply:  { ar: 'مش متأكد قصدك 🤔 ابعت المصروف مباشرة أو جرب /help', en: 'Not sure I got that 🤔 send the expense directly or try /help' },
  debtCmdUsage: { ar: '⚠️ الصيغة: {cmd} <الاسم> <المبلغ> [التاريخ YYYY-MM-DD]\nمثال: <code>{cmd} صاحبي 200 2026-08-28</code>', en: '⚠️ Usage: {cmd} <name> <amount> [date YYYY-MM-DD]\nExample: <code>{cmd} John 200 2026-08-28</code>' },
  kLoanOutOff: { ar: 'سلفة قديمة — من فلوس خارج التتبع', en: 'off-book loan (old untracked cash)' },
  kLoanInOff:  { ar: 'دين قديم — من قبل التتبع', en: 'off-book debt (pre-tracking)' },
  debtCmdUsage: { ar: '⚠️ الصيغة: {cmd} &lt;الاسم&gt; &lt;المبلغ&gt; [التاريخ YYYY-MM-DD]\nمثال: <code>{cmd} صاحبي 200 2026-08-28</code>', en: '⚠️ Usage: {cmd} &lt;name&gt; &lt;amount&gt; [date YYYY-MM-DD]\nExample: <code>{cmd} John 200 2026-08-28</code>' }
};

const MESSAGES = {
  HELP: {
    ar: '🤖 <b>أوامر المحفظة:</b>\n\n' +
        '/today — مصاريف النهارده\n/month — الشهر\n/stats — إحصائيات\n/top — أعلى البنود\n' +
        '/debts — 💳 دفتر الديون (اللي عليا واللي ليا)\n/budget — الميزانية\n' +
        '/dashboard — لوحة التحليلات 📊\n/last — آخر ٥ حركات\n/undo — مسح آخر معاملة\n' +
        '/search كلمة — بحث\n/export — CSV\n/backup — مزامنة الداتابيز 💾\n' +
        '/status و /debug — حالة النظام\n/lang ar|en — اللغة\n\n' +
        'ابعتلي مصاريفك بأي لغة — وسلفك وسدادك كمان:\n"استلفت ٥٠٠ من صاحبي" — "سددت ١٠٠٠ لبويا" — "سلفت عمي ٢٠٠"'+
        '💳 تسجيل يدوي دقيق (بدون AI):\n/lent صاحبي 200 [2026-08-28] — سلفت لحد\n/borrowed اسم 500 — استلفت\n/repaid اسم 200 — سددت دين\n/collected اسم 200 — استردت سلفة\n'+
        '🔷 سلفة قديمة من فلوس خارج التتبع: /lentold صاحبي 200 2026-08-28\n🔶 دين قديم عليك: /borrowedold اسم 500\n',
    en: '🤖 <b>Wallet commands:</b>\n\n' +
        '/today — today\n/month — this month\n/stats — statistics\n/top — top categories\n' +
        '/debts — 💳 debt book (owed by/to me)\n/budget — budgets\n' +
        '/dashboard — analytics 📊\n/last — last 5\n/undo — remove last\n' +
        '/search word — search\n/export — CSV\n/backup — sync DB 💾\n' +
        '/status & /debug — system\n/lang ar|en — language\n\n' +
        'Send expenses in any language — loans too:\n"borrowed 500 from Ali" — "repaid dad 1000"'+
        '💳 Manual debt entry (no AI):\n/lent John 200 [2026-08-28]\n/borrowed John 500\n/repaid John 200\n/collected John 200\n'
  }
};

const KEYBOARD = {
  keyboard: [
    ['📅 النهارده', '📅 الشهر'],
    ['📈 إحصائيات', '💳 الديون'],
    ['🔝 الأعلى', '📊 Dashboard'],
    ['↩️ تراجع', '❓ مساعدة']
  ],
  resize_keyboard: true
};

const BUTTONS = {
  '📅 النهارده': 'today',   '📅 الشهر': 'month',
  '📈 إحصائيات': 'stats',   '💳 الديون': 'debts',
  '🔝 الأعلى': 'top',       '📊 Dashboard': 'dashboard',
  '↩️ تراجع': 'undo',       '❓ مساعدة': 'help',
  'ℹ️ الحالة': 'status',    '↩️ Undo': 'undo', '❓ Help': 'help'
};

  // 📋 أوامر منيو تليجرام — عدّل فيها زي ما تحب
  COMMAND_MENU: [
    { command: 'start',        description: 'Start the wallet bot' },
    { command: 'help',         description: 'Show all commands' },
    { command: 'today',        description: "Today's spending" },
    { command: 'month',        description: "This month's summary" },
    { command: 'stats',        description: 'Statistics & 3-month trend' },
    { command: 'top',          description: 'Top spending categories' },
    { command: 'budget',       description: 'Budget status' },
    { command: 'debts',        description: 'Debt book — owed by/to me' },
    { command: 'last',         description: 'Last 5 transactions' },
    { command: 'undo',         description: 'Delete last transaction' },
    { command: 'search',       description: 'Search: /search word' },
    { command: 'export',       description: 'Export all data as CSV' },
    { command: 'dashboard',    description: 'Analytics & charts' },
    { command: 'backup',       description: 'Sync database to Drive' },
    { command: 'status',       description: 'System status' },
    { command: 'debug',        description: 'Detailed diagnostics' },
    { command: 'ping',         description: 'Check the bot is alive' },
    { command: 'lang',         description: 'Switch language: /lang ar|en' },
    { command: 'lent',         description: 'I lent money: /lent name 200 [date]' },
    { command: 'borrowed',     description: 'I borrowed: /borrowed name 500 [date]' },
    { command: 'repaid',       description: 'I repaid a debt: /repaid name 200' },
    { command: 'collected',    description: 'Debt repaid to me: /collected name 200' },
    { command: 'lentold',      description: 'Old off-book loan: /lentold name 200 [date]' },
    { command: 'borrowedold',  description: 'Old off-book debt: /borrowedold name 500' },
    { command: 'getprompt',    description: 'Show the stored AI prompt' },
    { command: 'setprompt',    description: 'Edit the AI prompt' }
  ]