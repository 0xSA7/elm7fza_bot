// ═══ v41: اختبارات توحيد أسماء الناس في الدفتر ═══
// قصة الباص: الديون القديمة اتسجلت «شلبي» بالعربي وسداد 900 اتهجّى «Shalaby»
// → الدفتر حسبهم شخصين → رصيد شلبي فضل 3,500 والسداد اختفى (سالب 900)

test('PERSON_MAP: شلبي بتتوحد لـ Shalaby بأي كتابة', function () {
  expect(canonicalPerson('شلبي')).toBe('Shalaby');
  expect(canonicalPerson('شلبى')).toBe('Shalaby');
  expect(canonicalPerson('Shalaby')).toBe('Shalaby');
  expect(canonicalPerson('shalaby')).toBe('Shalaby');
});

test('الشيت القديم: صفوف شلبي العربية بتتوحد وقت القراءة من غير أي تعديل يدوي', function () {
  const repo = AppContext.txRepo();
  // زي شيت المستخدم بالظبط: ديون قديمة بالعربي + سداد جديد بالإنجليزي
  repo.append(['2026-10-28', 2600, 'EGP', 'loan_in_off', 'شلبي', 'دين قديم', 'raw', 9401, new Date()]);
  repo.append(['2026-10-28', 900, 'EGP', 'loan_in', 'شلبي', 'ترجمة بيان الدرجات', 'raw', 9402, new Date()]);
  repo.append(['2026-11-03', 900, 'EGP', 'repay_out', 'Shalaby', 'سداد لشلبي', 'raw', 9403, new Date()]);
  repo._memo = null;   // الصفوف الخام اتكتبت على طول، لازم نفضّ الميمو

  const rows = repo.getAll().filter(function (t) {
    return Number(t.messageId) >= 9401 && Number(t.messageId) <= 9403;
  });
  expect(rows.length).toBe(3);
  rows.forEach(function (t) { expect(t.category).toBe('Shalaby'); });
});

test('الدفتر: سداد 900 بيرجّع الرصيد الصح (2,600) ومفيش شخص منفصل', function () {
  const repo = AppContext.txRepo();
  // الشيت مشترك بين التيستات، ننضّف صفوف التيست اللي فات الأول
  [9401, 9402, 9403].forEach(function (mid) {
    const found = repo.findByMessageId(mid);
    if (found.length) repo.deleteRows(found);
  });

  repo.append(['2026-10-28', 2600, 'EGP', 'loan_in_off', 'شلبي', 'دين قديم', 'raw', 9411, new Date()]);
  repo.append(['2026-10-28', 900, 'EGP', 'loan_in', 'شلبي', 'ترجمة', 'raw', 9411, new Date()]);
  repo.append(['2026-11-03', 900, 'EGP', 'repay_out', 'Shalaby', 'سداد', 'raw', 9412, new Date()]);
  repo._memo = null;

  const book = AppContext.finance().debtBook();
  expect(book.owed['Shalaby']).toBe(2600);                    // ✅ 3500 - 900
  expect(Object.keys(book.owed).indexOf('شلبي')).toBe(-1);   // مفيش «شلبي» منفصل
  expect(Object.keys(book.owed).indexOf('Shalaby')).not.toBe(-1);
});

test('حفظ جديد: AI رجّع «شلبي» عربي → الصف بيتكتب Shalaby موحّد', function () {
  const repo = AppContext.txRepo();
  const tx = Transaction.fromGemini(
    { amount: 500, kind: 'loan_in', category: 'شلبي' }, 'استلفت من شلبي', 9421);
  expect(tx.category).toBe('Shalaby');
  repo.add(tx);
  const saved = repo.getAll().filter(function (t) { return Number(t.messageId) === 9421; });
  expect(saved.length).toBe(1);
  expect(saved[0].category).toBe('Shalaby');
});

test('البرومبت: قايمة الناس بتمشي حتى لو الرسالة فيها أرقام', function () {
  // دي حالة السداد بالظبط، الرسالة فيها 900 فالسياق كله كان بيتشال قبل كده
  const line = AppContext.ai().contextLine('وريدت 900ج لشلبي', false);
  expect(String(line).indexOf('People already in the debt book')).not.toBe(-1);
  expect(String(line).indexOf('Shalaby')).not.toBe(-1);
});

test('البرومبت الكامل: buildPrompt فيه قايمة الناس وقاعدة إعادة الاستخدام', function () {
  const p = String(AppContext.ai().buildPrompt('وريدت 900ج لشلبي'));
  expect(p.indexOf('People already in the debt book')).not.toBe(-1);
  expect(p.indexOf('reuse the exact spelling')).not.toBe(-1);
});

test('knownPeopleLine: بترجع string دايماً ومن غير ما تتكسر لو الدفتر فاضي', function () {
  expect(typeof AppContext.ai().knownPeopleLine()).toBe('string');
});

test('مسح السداد بالريبلاي بعد التوحيد: رصيد شلبي بيرجع 3,500', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  // الرسالة الأصلية بتاعة السداد، مجموعة واحدة تحت msg 9431
  d.persistAndReply({ chat: { id: 'test' }, message_id: 9431, text: 'وريدت 900ج لشلبي' },
    { transactions: [new Transaction({ date: '2026-11-03', amount: 900, kind: 'repay_out',
                                       category: 'شلبي', note: 'سداد لشلبي', messageId: 9431 })] });
  expect(repo.findByMessageId(9431)[0].tx.category).toBe('Shalaby');

  const before = AppContext.finance().debtBook().owed['Shalaby'];

  // ريبلاي «امسح» على رسالة السداد → الفلوس ترجع
  d.handleEditReply({ chat: { id: 'test' }, message_id: 9432,
    reply_to_message: { message_id: 9431 }, text: 'امسح' });

  expect(repo.findByMessageId(9431).length).toBe(0);
  expect(AppContext.finance().debtBook().owed['Shalaby']).toBe(before + 900);
});
