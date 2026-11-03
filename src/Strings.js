// ═══════════════ نصوص البوت ═══════════════
// الطبقة: Presentation · STR + MESSAGES + KEYBOARD + BUTTONS + I18n: كل ما البوت بيقوله
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
  aiBusyQueued: { ar: '⏳ سيرفرات الذكاء الاصطناعي عليها ضغط دلوقتي، مش محتاج تعمل أي حاجة، هحاول تلقائياً وأبلغك أول ما تنجح (لحد ١٢ ساعة).', en: '⏳ AI servers are busy right now; no action needed, I\'ll keep retrying and will confirm once it goes through (up to 12 hours).' },
  retryTimeout: { ar: '⏱️ سبت المحاولة بعد ١٢ ساعة والسيرفرات لسه مشغولة، ابعت الرسالة تاني في وقت تاني.', en: '⏱️ Gave up after 12 hours; servers still busy. Please resend later.' },
  dupSkipped:   { ar: 'الرسالة دي كانت اتسجلت خلاص، مش هتتكرر في الشيت 👌', en: 'Already saved before; it will never be saved twice 👌' },
  // 💳 الديون
  kIncome:      { ar: 'دخل حر', en: 'free money' },
  kExpense:     { ar: 'صرف', en: 'expense' },
  kLoanIn:      { ar: 'استلاف (لازم يُرَد)', en: 'borrowed (must repay)' },
  kRepayOut:    { ar: 'سداد دين', en: 'debt repayment' },
  kLoanOut:     { ar: 'سلفة (ليك عنده)', en: 'lent out' },
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
  kLoanOutOff: { ar: 'سلفة قديمة (فلوس خارج التتبع)', en: 'off-book loan (old untracked cash)' },
  kLoanInOff:  { ar: 'دين قديم (من قبل التتبع)', en: 'off-book debt (pre-tracking)' },
  debtCmdUsage: { ar: '⚠️ الصيغة: {cmd} &lt;الاسم&gt; &lt;المبلغ&gt; [التاريخ YYYY-MM-DD]\nمثال: <code>{cmd} صاحبي 200 2026-08-28</code>', en: '⚠️ Usage: {cmd} &lt;name&gt; &lt;amount&gt; [date YYYY-MM-DD]\nExample: <code>{cmd} John 200 2026-08-28</code>' },
  runwaySet:    { ar: 'العداد اشتغل · فلوسك محسوبة لحد {end}', en: 'Runway set until {end}' },
  runwayNone:   { ar: 'مفيش عداد شغال. شغّله: <code>/runway 2026-10-28 2026-11-30</code>', en: 'No active runway. Try <code>/runway 2026-10-28 2026-11-30</code>' },
  runwayCancel: { ar: '📴 العداد اتلغى', en: 'Runway cancelled' },
  runwayLine:   { ar: '✈️ باقي {left} · سماحك {daily} ج/يوم لحد {end} {icon}', en: '✈️ {left} left · {daily}/day until {end} {icon}' },
  runwayReport: { ar: '✈️ <b>العداد</b> · من {start} لحد {end}\n\n💵 القبض في الفترة: {in}ج\n💸 الصرف: {out}ج\n💰 الباقي: {left}ج\n🎯 سماح يومي: {daily}ج (لسه {n} يوم) {icon}', en: '✈️ <b>Runway</b> · {start} to {end}\n\n💵 Income in period: {in}\n💸 Spent: {out}\n💰 Left: {left}\n🎯 Daily allowance: {daily} ({n} days left) {icon}' },
  editDone:     { ar: 'اتعدلت بدل القديم: {n} حركة دلوقتي الصح', en: 'Edited in place: {n} now correct' },
  editDeleted:  { ar: 'اتمسحت كلها والفلوس رجعت في حساباتك', en: 'Deleted: money is back in your totals' },
  editUnclear:  { ar: 'مش فاهم التعديل، الرسالة القديمة زي ما هي ملمستهاش.\nاكتب التصحيح واضح (زي: «كشف امي كان ب ٦٠٠ مش ٢٠٠»)\nأو ابعت «امسح» لو عايز تمسحها خلاص.', en: 'Could not understand the edit; nothing was touched.\nWrite the fix clearly, or send "delete" to remove it.' },
  dSpent:    { ar: '· صرفت {v}ج',                              en: '· spent {v}' },
  dNoSpend:  { ar: '· من غير مصاريف 👏',                        en: '· no spending 👏' },
  dIncome:   { ar: '💵 دخل: {v}ج',                              en: '💵 Income: {v}' },
  dRemain:   { ar: '💰 فاضل معاك لحد {end}: {v}ج',              en: '💰 {v} left until {end}' },
  dAllow:    { ar: '🎯 ميزانية بكرة: {v}ج/يوم (لسه {n} يوم)',    en: '🎯 Tomorrow: {v}/day ({n} days left)' },
  dOnTrack:  { ar: '🟢 ماشي في السكة، كمل بنفس المعدل',         en: '🟢 On track; keep this pace' },
  dOverBurn: { ar: '🔴 معدلك {v}ج/يوم فوق ميزانيتك، رحّم بقية الشهر', en: '🔴 Burning {v}/day over budget; slow down' },
  dNoRunway: { ar: '💡 عايز ميزانية يومية؟ ابعت: /runway {today} 2026-11-30', en: '💡 Want a daily budget? Send: /runway {today} 2026-11-30' },
  catFood:          { ar: '🍔 أكل',     en: '🍔 Food' },
  catGroceries:     { ar: '🛒 سوق',     en: '🛒 Groceries' },
  catTransport:     { ar: '🚌 مواصلات', en: '🚌 Transport' },
  catUtilities:     { ar: '💡 فواتير',  en: '💡 Utilities' },
  catHome:          { ar: '🏠 بيت',     en: '🏠 Home' },
  catHealth:        { ar: '💊 صحة',     en: '💊 Health' },
  catEducation:     { ar: '📚 دراسة',   en: '📚 Education' },
  catOutings:       { ar: '☕ خروجات',  en: '☕ Outings' },
  catEntertainment: { ar: '🎬 ترفيه',   en: '🎬 Entertainment' },
  catClothes:       { ar: '👕 هدوم',    en: '👕 Clothes' },
  catGifts:         { ar: '🎁 هدايا',   en: '🎁 Gifts' },
  catPersonal:      { ar: '🧩 شخصي',   en: '🧩 Personal' },
  catOther:         { ar: '📦 غيره',    en: '📦 Other' },
  catSalary:        { ar: '💼 مرتب',   en: '💼 Salary' },
  catFreeMoney:     { ar: '💵 دخل حر', en: '💵 Free money' },
  catOwnMoney:      { ar: '💰 فلوسي',  en: '💰 Own money' },
};

const MESSAGES = {
  HELP: {
    ar: '🤖 <b>أوامر المحفظة:</b>\n\n' +
        '/today · مصاريف النهارده\n/month · الشهر\n/stats · إحصائيات\n/top · أعلى البنود\n' +
        '/debts · 💳 دفتر الديون (اللي عليا واللي ليا)\n/budget · الميزانية\n' +
        '/dashboard · لوحة التحليلات 📊\n/last · آخر ٥ حركات\n/undo · مسح آخر معاملة\n' +
        '/search كلمة · بحث\n/export · CSV\n/backup · مزامنة الداتابيز 💾\n' +
        '/status و /debug · حالة النظام\n/lang ar|en · اللغة\n\n' +
        '♻️ <b>عدّل أي حركة:</b> اعمل Reply على رسالتك القديمة واكتب التصحيح\n«كشف امي كان ب ٦٠٠ مش ٢٠٠» أو «امسح» لو عايز تشيلها\n\n' +
        'ابعتلي مصاريفك بأي لغة، وسلفك وسدادك كمان:\n"استلفت ٥٠٠ من صاحبي" · "سددت ١٠٠٠ لبويا" · "سلفت عمي ٢٠٠"'+
        '💳 تسجيل يدوي دقيق (بدون AI):\n/lent صاحبي 200 [2026-08-28] · سلفت لحد\n/borrowed اسم 500 · استلفت\n/repaid اسم 200 · سددت دين\n/collected اسم 200 · استردت سلفة\n'+
        '🔷 سلفة قديمة من فلوس خارج التتبع: /lentold صاحبي 200 2026-08-28\n🔶 دين قديم عليك: /borrowedold اسم 500\n',
    en: '🤖 <b>Wallet commands:</b>\n\n' +
        '/today · today\n/month · this month\n/stats · statistics\n/top · top categories\n' +
        '/debts · 💳 debt book (owed by/to me)\n/budget · budgets\n' +
        '/dashboard · analytics 📊\n/last · last 5\n/undo · remove last\n' +
        '/search word · search\n/export · CSV\n/backup · sync DB 💾\n' +
        '/status & /debug · system\n/lang ar|en · language\n\n' +
        '♻️ <b>Edit any entry:</b> Reply to your own old message with the fix\n"doctor was 600 not 200" or "delete" to remove it\n\n' +
        'Send expenses in any language, loans too:\n"borrowed 500 from Ali" · "repaid dad 1000"'+
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

// ── الترجمة: مفتاح → نص حسب اللغة ──
const I18n = {
  t(key, lang, params) {
    const entry = STR[key];
    let s = (entry && (entry[lang] || entry.ar)) || key;
    if (params) Object.keys(params).forEach(k => { s = s.replace('{' + k + '}', params[k]); });
    return s;
  }
};
