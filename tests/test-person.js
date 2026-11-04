// ═══ v41/v43: اختبارات توحيد أسماء الناس في الدفتر ═══
// الأسماء بتيجي من Script Properties (PERSON_ALIASES) مش من الكود:
// الديون القديمة اتسجلت بالعربي والسداد اتهجّى بالإنجليزي
// → الدفتر حسبهم شخصين والرصيد اتظبط غلط. الأسماء كلها افتراضية هنا.

const ALIASES_JSON = JSON.stringify({ 'حسن': 'Hassan', 'حسني': 'Hassan' });

test('PERSON_ALIASES (Properties): حسن بتتوحد لـ Hassan بأي كتابة', function () {
  PropertiesService.getScriptProperties().setProperty('PERSON_ALIASES', ALIASES_JSON);
  __resetPersonCaches();
  expect(canonicalPerson('حسن')).toBe('Hassan');
  expect(canonicalPerson('حسني')).toBe('Hassan');
  expect(canonicalPerson('Hassan')).toBe('Hassan');
  expect(canonicalPerson('hassan')).toBe('Hassan');
});

test('من غير PERSON_ALIASES: الاسم الجديد بيعدي زي ما هو', function () {
  PropertiesService.getScriptProperties().deleteProperty('PERSON_ALIASES');
  __resetPersonCaches();
  expect(canonicalPerson('زبوون')).toBe('زبوون');
  // نرجّع الأسماء لباقي التيستات
  PropertiesService.getScriptProperties().setProperty('PERSON_ALIASES', ALIASES_JSON);
  __resetPersonCaches();
});

test('عيلتك لسه شغالة من PERSON_MAP جوه الكود (كلمات عامة)', function () {
  expect(canonicalPerson('امي')).toBe('Mother');
  expect(canonicalPerson('ماما')).toBe('Mother');
  expect(canonicalPerson('ابويا')).toBe('Father');
});

test('الشيت القديم: صفوف حسن العربية بتتوحد وقت القراءة من غير أي تعديل يدوي', function () {
  const repo = AppContext.txRepo();
  // ديون قديمة بالعربي + سداد جديد بالإنجليزي (نفس مشكلة الحقيقة، بأسماء افتراضية)
  repo.append(['2026-10-28', 2000, 'EGP', 'loan_in_off', 'حسن', 'دين قديم', 'raw', 9401, new Date()]);
  repo.append(['2026-10-28', 500, 'EGP', 'loan_in', 'حسن', 'شغل', 'raw', 9402, new Date()]);
  repo.append(['2026-11-03', 500, 'EGP', 'repay_out', 'Hassan', 'سداد', 'raw', 9403, new Date()]);
  repo._memo = null;   // الصفوف الخام اتكتبت على طول، لازم نفضّ الميمو

  const rows = repo.getAll().filter(function (t) {
    return Number(t.messageId) >= 9401 && Number(t.messageId) <= 9403;
  });
  expect(rows.length).toBe(3);
  rows.forEach(function (t) { expect(t.category).toBe('Hassan'); });
});

test('الدفتر: سداد 500 بيرجّع الرصيد الصح (2,000) ومفيش شخص منفصل', function () {
  const repo = AppContext.txRepo();
  // الشيت مشترك بين التيستات، ننضّف صفوف التيست اللي فات الأول
  [9401, 9402, 9403].forEach(function (mid) {
    const found = repo.findByMessageId(mid);
    if (found.length) repo.deleteRows(found);
  });

  repo.append(['2026-10-28', 2000, 'EGP', 'loan_in_off', 'حسن', 'دين قديم', 'raw', 9411, new Date()]);
  repo.append(['2026-10-28', 500, 'EGP', 'loan_in', 'حسن', 'شغل', 'raw', 9411, new Date()]);
  repo.append(['2026-11-03', 500, 'EGP', 'repay_out', 'Hassan', 'سداد', 'raw', 9412, new Date()]);
  repo._memo = null;

  const book = AppContext.finance().debtBook();
  expect(book.owed['Hassan']).toBe(2000);                    // ✅ 2500 - 500
  expect(Object.keys(book.owed).indexOf('حسن')).toBe(-1);    // مفيش «حسن» منفصل
  expect(Object.keys(book.owed).indexOf('Hassan')).not.toBe(-1);
});

test('حفظ جديد: AI رجّع «حسن» عربي → الصف بيتكتب Hassan موحّد', function () {
  const repo = AppContext.txRepo();
  const tx = Transaction.fromGemini(
    { amount: 300, kind: 'loan_in', category: 'حسن' }, 'استلفت من حسن', 9421);
  expect(tx.category).toBe('Hassan');
  repo.add(tx);
  const saved = repo.getAll().filter(function (t) { return Number(t.messageId) === 9421; });
  expect(saved.length).toBe(1);
  expect(saved[0].category).toBe('Hassan');
});

test('البرومبت: قايمة الناس بتمشي حتى لو الرسالة فيها أرقام', function () {
  // حالة السداد بالظبط: الرسالة فيها رقم فالسياق كله كان بيتشال قبل كده
  const line = AppContext.ai().contextLine('حولت 500ج لحسن', false);
  expect(String(line).indexOf('People already in the debt book')).not.toBe(-1);
  expect(String(line).indexOf('Hassan')).not.toBe(-1);
});

test('البرومبت الكامل: buildPrompt فيه قايمة الناس وقاعدة إعادة الاستخدام', function () {
  const p = String(AppContext.ai().buildPrompt('حولت 500ج لحسن'));
  expect(p.indexOf('People already in the debt book')).not.toBe(-1);
  expect(p.indexOf('reuse the exact spelling')).not.toBe(-1);
});

test('knownPeopleLine: بترجع string دايماً ومن غير ما تتكسر لو الدفتر فاضي', function () {
  expect(typeof AppContext.ai().knownPeopleLine()).toBe('string');
});

test('مسح السداد بالريبلاي بعد التوحيد: رصيد حسن بيرجع 2,500', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  // الرسالة الأصلية بتاعة السداد، مجموعة واحدة تحت msg 9431
  d.persistAndReply({ chat: { id: 'test' }, message_id: 9431, text: 'حولت 500ج لحسن' },
    { transactions: [new Transaction({ date: '2026-11-03', amount: 500, kind: 'repay_out',
                                       category: 'حسن', note: 'سداد', messageId: 9431 })] });
  expect(repo.findByMessageId(9431)[0].tx.category).toBe('Hassan');

  const before = AppContext.finance().debtBook().owed['Hassan'];

  // ريبلاي «امسح» على رسالة السداد → الفلوس ترجع
  d.handleEditReply({ chat: { id: 'test' }, message_id: 9432,
    reply_to_message: { message_id: 9431 }, text: 'امسح' });

  expect(repo.findByMessageId(9431).length).toBe(0);
  expect(AppContext.finance().debtBook().owed['Hassan']).toBe(before + 500);
});
