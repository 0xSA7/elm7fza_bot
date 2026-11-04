// ═══════════════ الإعدادات ═══════════════
// الطبقة: Config · ثوابت التشغيل: تابات، تصنيفات، عقل محلي، أنواع حركات، سحب ومحاولات
const CONFIG = {
  VERSION: 43,
  MODEL: 'gemini-3.8-flash',
  SHEETS: {
    TX: 'Transactions', CATEGORIES: 'Categories', BUDGETS: 'Budgets',
    LOG: 'Log', PROMPTS: 'Prompts', DASHBOARD: 'Dashboard',
    RETRY: 'RetryQueue', RUNWAY: 'Runway',
  },
  RUNWAY_HEADERS: ['Status', 'Start', 'End', 'Amount', 'Updated At'],
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
  // 🧑‍🤝‍🧑 كلمات العيلة: عامة ومش بيانات شخصية.
  // أسماء الأصحاب (بيانات خاصة) عمرها ما تتكتب هنا: بتتقرا وقت التشغيل من
  // Script Properties (PERSON_ALIASES بصيغة {"الاسم":"Canonical"})
  // وشوف setPersonAliases() في Migrations.js و docs/USAGE.md.
  PERSON_MAP: {
    'امي': 'Mother', 'والدتي': 'Mother', 'ماما': 'Mother', 'اميا': 'Mother',
    'ابويا': 'Father', 'والدي': 'Father', 'بابا': 'Father', 'ابي': 'Father',
    'اخويا': 'Brother', 'اختي': 'Sister'
  },

  // 🧠 العقل المحلي: الحالات المؤكدة اللي مش محتاجة AI
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
  RETRY: { MAX_WAIT_MS: 43200000, INTERVAL_MS: 60000, MAX_PER_CYCLE: 5 },

  // 📋 أوامر منيو تليجرام، لازم تفضل جوه CONFIG عشان setupMenuCommands وdoctor يشوفوها
  COMMAND_MENU: [
    { command: 'start',        description: 'ابدأ وشوف كل الأوامر' },
    { command: 'help',         description: 'الشرح الكامل' },
    { command: 'today',        description: 'مصاريف النهارده' },
    { command: 'week',         description: 'آخر ٧ أيام' },
    { command: 'month',        description: 'الشهر ده' },
    { command: 'stats',        description: 'إحصائيات ومقارنة ٣ شهور' },
    { command: 'top',          description: 'أعلى بنود الصرف' },
    { command: 'budget',       description: 'الميزانية' },
    { command: 'runway',       description: '✈️ العداد: /runway 2026-10-28 2026-11-30' },
    { command: 'debts',        description: '💳 دفتر الديون' },
    { command: 'last',         description: 'آخر ٥ حركات' },
    { command: 'undo',         description: 'امسح آخر حركة' },
    { command: 'search',       description: 'بحث: /search كلمة' },
    { command: 'category',     description: 'حركات تصنيف معين' },
    { command: 'dashboard',    description: 'لوحة التحليلات 📊' },
    { command: 'export',       description: 'تصدير كل الداتا CSV' },
    { command: 'backup',      description: 'مزامنة الداتابيز 💾' },
    { command: 'status',       description: 'حالة النظام' },
    { command: 'debug',        description: 'تشخيص تفصيلي' },
    { command: 'doctor',       description: '🩺 فحص شامل، بيتصلح لوحده' },
    { command: 'ping',         description: 'البوت عايش؟' },
    { command: 'lang',         description: 'اللغة: /lang ar أو /lang en' },
    { command: 'lent',         description: 'سلفت فلوس: /lent اسم 200' },
    { command: 'borrowed',     description: 'استلفت: /borrowed اسم 500' },
    { command: 'repaid',       description: 'سددت دين: /repaid اسم 200' },
    { command: 'collected',    description: 'استردت سلفة: /collected اسم 200' },
    { command: 'lentold',      description: 'سلفة قديمة: /lentold اسم 200' },
    { command: 'borrowedold',  description: 'دين قديم: /borrowedold اسم 500' },
    { command: 'getprompt',    description: 'اعرض البرومبت' },
    { command: 'setprompt',    description: 'عدّل البرومبت' }
  ],

  BACKUP: {
    FOLDER_NAME: 'WalletBot DB',
    TX_FILE: 'transactions.jsonl',
    META_FILE: 'meta.json',
    LOG_PREFIX: 'log_',
    LOG_ARCHIVE_MONTHS: 12,
    ARCHIVE_LEVELS: ['ERROR', 'WARN']
  }
};
