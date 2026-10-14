// ═══════════════ IntentRouter Tests ═══════════════
// أهم اختبارات في النظام — المُفكك المرن هو اللي بيوجه الرسايل

// ── Setup ──
var mockLang = {
  get: function() { return 'ar'; },
  set: function() {},
  detect: function(t) { return /[\u0600-\u06FF]/.test(String(t)) ? 'ar' : 'en'; }
};
var mockFinance = {
  today: function() { return 'today-report'; },
  month: function() { return 'month-report'; },
  debtsReport: function() { return 'debts-report'; },
  topExpenses: function() { return 'top-report'; },
  budgetReport: function() { return 'budget-report'; },
  lastFive: function() { return 'last-report'; },
  stats: function() { return 'stats-report'; },
  week: function() { return 'week-report'; }
};
var router = new IntentRouter(mockLang, mockFinance);

// ── norm() ──

test('norm: يحوّل الأرقام العربية (٢٠→20)', function() {
  expect(router.norm('٢٠ ج')).toBe('20 ج');
});

test('norm: يفصل "615ج" → "615 ج"', function() {
  expect(router.norm('615ج')).toBe('615 ج');
});

test('norm: يشيل التشكيل', function() {
  expect(router.norm('شكراً')).toBe('شكرا');
});

test('norm: يوحّد الألف (أكل→اكل)', function() {
  expect(router.norm('أكل')).toBe('اكل');
});

test('norm: يشيل علامات الترقيم', function() {
  expect(router.norm('كام اللي عليا؟')).toBe('كام اللي عليا');
});

// ── المُفكك المرن (الحالة الأهم!) ──

test('يفك: "صرفت 20 ج اكل"', function() {
  var r = router.try('صرفت 20 ج اكل');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].amount).toBe(20);
  expect(r.transactions[0].category).toBe('Food');
  expect(r.transactions[0].kind).toBe('expense');
});

test('يفك: "صرفت ٢٠ ج اكل" (أرقام عربية)', function() {
  var r = router.try('صرفت ٢٠ ج اكل');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].amount).toBe(20);
});

test('يفك: "دفعت 60 على المواصلات"', function() {
  var r = router.try('دفعت 60 على المواصلات');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].category).toBe('Transport');
});

test('يفك: "شريت 50 اكل"', function() {
  var r = router.try('شريت 50 اكل');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].category).toBe('Food');
});

test('يفك: "اكل 25 جنيه"', function() {
  var r = router.try('اكل 25 جنيه');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].amount).toBe(25);
  expect(r.transactions[0].category).toBe('Food');
});

test('يفك: "٦١٥ج" متصلة (يوم الشهادات)', function() {
  var r = router.try('دفعت ٦١٥ج');
  // "دفعت 615 ج" → number + verb = مفهومة... بس مفيش تصنيف!
  // مفروض ترجع null (تصنيف مفقود) → تروح للـ AI
  expect(r).toBeNull();
});

test('يرفض: رقمين في رسالة واحدة (متعددة المعاملات)', function() {
  var r = router.try('دفعت 60 و 615');
  expect(r).toBeNull();
});

test('يرفض: كلمة مش مفهومة', function() {
  var r = router.try('صرفت 20 ج حاجةعجيبةخالص');
  expect(r).toBeNull();
});

test('يرفض: سردية طويلة (تروح للـ AI)', function() {
  var r = router.try('روحت انهاردة الجامعة دفعت مواصلات 60ج ودفعت 615ج عشان الشهادات');
  expect(r).toBeNull();
});

// ── الأنماط القديمة (تأكيد إنها لسه شغالة) ──

test('يفك: "50 مواصلات" (النمط القديم)', function() {
  var r = router.try('50 مواصلات');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].category).toBe('Transport');
});

test('يفك: "كسبت 500" (دخل سريع)', function() {
  var r = router.try('كسبت 500');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].kind).toBe('income');
  expect(r.transactions[0].category).toBe('Free Money');
});

// ── التحيات ──

test('يتعرف على "شكرا" كتحية', function() {
  var r = router.try('شكرا');
  expect(r.type).toBe('greeting');
});

test('يتعرف على "thanks" كتحية', function() {
  var r = router.try('thanks');
  expect(r.type).toBe('greeting');
});

test('مش بيعتبر "شكرا على الاكل" تحية (فيها كلام تاني)', function() {
  var r = router.try('شكرا على الاكل');
  expect(r).toBeNull();
});

// ── أسئلة البيانات ──

test('سؤال "كام اللي عليا؟" → تقرير الديون', function() {
  var r = router.try('كام اللي عليا؟');
  expect(r.type).toBe('command');
  expect(r.cmd).toBe('debts');
});

test('سؤال "وريني مصاريف النهارده" → تقرير اليوم', function() {
  var r = router.try('وريني مصاريف النهارده');
  expect(r.type).toBe('command');
  expect(r.cmd).toBe('today');
});
test('يفك: "دفعت 60 على المواصلات" (بالـ "ال" التعريف)', function() {
  var r = router.try('دفعت 60 على المواصلات');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].category).toBe('Transport');
  expect(r.transactions[0].amount).toBe(60);
});

test('يفك: "شريت 50 على الاكل" (بالـ "ال")', function() {
  var r = router.try('شريت 50 على الاكل');
  expect(r.type).toBe('tx');
  expect(r.transactions[0].category).toBe('Food');
});

test('سؤال "قولي مصاريف النهارده" → تقرير اليوم (كلمة قولي)', function() {
  var r = router.try('قولي مصاريف النهارده');
  expect(r.type).toBe('command');
  expect(r.cmd).toBe('today');
});