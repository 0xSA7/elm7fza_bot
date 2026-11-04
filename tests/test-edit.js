// ═══ v40: اختبارات التعديل بالريبلاي + عداد القبض ═══

// ── تجهيز: رسالة أصلية فيها حركتين (زي "30ج مرواح + 200 ج كشف امي") ──
function seedOriginal(d, mid, date) {
  d.persistAndReply({ chat: { id: 'test' }, message_id: mid, text: '30ج مرواح\n200 ج كشف امي' },
    { transactions: [
      new Transaction({ date: date, amount: 30, kind: 'expense', category: 'Transport',
                        note: 'مرواح', rawText: '30ج مرواح + 200 ج كشف امي', messageId: mid }),
      new Transaction({ date: date, amount: 200, kind: 'expense', category: 'Health',
                        note: 'كشف امي', rawText: '30ج مرواح + 200 ج كشف امي', messageId: mid })
    ] });
}

test('Repo: findByMessageId بيلاقي صفوف الرسالة بأرقامها', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  seedOriginal(d, 9101, '2026-10-29');
  const found = repo.findByMessageId(9101);
  expect(found.length).toBe(2);
  expect(found[0].rowIndex).toBeGreaterThanOrEqual(2);
  expect(found[0].tx.amount).toBe(30);
  expect(found[1].tx.amount).toBe(200);
  expect(repo.findByMessageId(888888).length).toBe(0);
  expect(repo.findByMessageId('').length).toBe(0);
});

test('Repo: deleteRows بيشيل الصفوف الصح وبالمقلوب', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  seedOriginal(d, 9102, '2026-10-29');
  const before = repo.getAll().length;
  const found = repo.findByMessageId(9102);
  repo.deleteRows(found);
  expect(repo.getAll().length).toBe(before - 2);
  expect(repo.findByMessageId(9102).length).toBe(0);
});

test('التعديل: ريبلاي بصيغة سريعة بيبدّل القديم ويحافظ على التاريخ', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  seedOriginal(d, 9103, '2026-10-29');
  const before = repo.getAll().length;

  // ريبلاي: "600 دوا" → العقل المحلي بيفهمها Health 600
  const ret = d.handleEditReply({ chat: { id: 'test' }, message_id: 9104,
    reply_to_message: { message_id: 9103 }, text: '600 دوا' });

  expect(ret).toBe(true);
  const group = repo.findByMessageId(9103);          // المجموعة لسه مربوطة بالرسالة الأصلية
  expect(group.length).toBe(1);
  expect(group[0].tx.amount).toBe(600);
  expect(group[0].tx.category).toBe('Health');
  expect(group[0].tx.date).toBe('2026-10-29');       // 💬 تاريخ الأصل محفوظ
  expect(repo.findByMessageId(9104).length).toBe(0); // الريبلاي نفسه ما اتسجلش كرسالة جديدة
  expect(repo.getAll().length).toBe(before - 1);     // 2 اتشالوا و 1 اتحط
});

test('التعديل: ريبلاي بـ «امسح» بيشيل الحركات والفلوس ترجع', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  seedOriginal(d, 9105, '2026-10-30');
  const before = repo.getAll().length;

  const ret = d.handleEditReply({ chat: { id: 'test' }, message_id: 9106,
    reply_to_message: { message_id: 9105 }, text: 'امسح دي' });

  expect(ret).toBe(true);
  expect(repo.getAll().length).toBe(before - 2);
  expect(repo.findByMessageId(9105).length).toBe(0);
});

test('التعديل: «امسح» مع رقم = مش مسح (أمان: بتفضل تصحيح)', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  seedOriginal(d, 9107, '2026-10-30');
  const before = repo.getAll().length;

  // فيها رقم → مش مسح → مسار تصحيح الـ AI (في الاختبار الـ AI غير متاح
  // فيرجع "مش فاهم" والقديم يفضل زي ما هو بالظبط، مفيش حاجة تتشال بالغلط)
  d.handleEditReply({ chat: { id: 'test' }, message_id: 9108,
    reply_to_message: { message_id: 9107 }, text: 'امسح 65 مواصلات' });

  expect(repo.findByMessageId(9107).length).toBe(2);   // القديم ملمسوش
  expect(repo.getAll().length).toBe(before);           // ولا أي صف اتحرك
});

test('التعديل: إعادة نفس الريبلاي (إعادة محاولة) مش بتضاعف', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  seedOriginal(d, 9109, '2026-10-29');
  const reply = { chat: { id: 'test' }, message_id: 9110,
                  reply_to_message: { message_id: 9109 }, text: '600 دوا' };

  d.handleEditReply(reply);
  const after1 = repo.getAll().length;
  d.handleEditReply(reply);                           // 🔁 نفس الريبلاي تاني (طابور المحاولات)
  const after2 = repo.getAll().length;

  expect(after2).toBe(after1);
  expect(repo.findByMessageId(9109).length).toBe(1);
});

test('routeText: ريبلاي على رسالة مش مسجلة = إضافة عادية', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  const before = repo.getAll().length;

  d.routeText({ chat: { id: 'test' }, message_id: 9111,
    reply_to_message: { message_id: 7777777 }, text: '50 مواصلات' });

  expect(repo.getAll().length).toBe(before + 1);      // حركة جديدة عادي
  expect(repo.findByMessageId(9111).length).toBe(1);
});

test('routeText: من غير ريبلاي = المسار العادي', function () {
  const repo = AppContext.txRepo();
  const d = AppContext.dispatcher();
  const before = repo.getAll().length;
  d.routeText({ chat: { id: 'test' }, message_id: 9112, text: '70 اكل' });
  expect(repo.getAll().length).toBe(before + 1);
});

test('runwayStatus: القبض والصرف والبداية راجعين صح', function () {
  const repo = AppContext.txRepo();
  const fin = AppContext.finance();
  const rw = AppContext.runwayRepo();

  rw.set('2026-10-28', '2026-11-30', 0);
  repo.add(new Transaction({ date: '2026-10-28', amount: 5000, kind: 'income',
                             category: 'Salary', messageId: 9120 }));
  repo.add(new Transaction({ date: '2026-10-29', amount: 200, kind: 'expense',
                             category: 'Health', messageId: 9121 }));

  const st = fin.runwayStatus();
  expect(st).not.toBeNull();
  expect(st.start).toBe('2026-10-28');
  expect(st.end).toBe('2026-11-30');
  expect(st.inSince).toBe(5000);         // 💵 القبض في الفترة
  expect(st.spentSince >= 200).toBe(true);
  expect(st.remaining).toBe(5000 - st.spentSince);
});

test('RunwayRepository.refreshAmount بيكتب القبض الفعلي في عمود Amount', function () {
  const repo = AppContext.txRepo();
  const rw = AppContext.runwayRepo();

  const v = rw.refreshAmount(repo);
  expect(v).not.toBeNull();
  expect(v).toBeGreaterThanOrEqual(5000);             // كل دخل النافذة

  const rows = rw.readAll();
  let active = null;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (String(rows[i][0]) === 'active') { active = rows[i]; break; }
  }
  expect(active).not.toBeNull();
  expect(Number(active[3])).toBe(v);                  // العمود = القبض المحسوب بالظبط
});

test('runwayLine: سطر هادي من غير قبضت ومن غير سنة', function () {
  const EMDASH = String.fromCharCode(8212);   // علامة الشرطة الطويلة
  const line = String(AppContext.finance().runwayLine());
  expect(line.indexOf('باقي')).not.toBe(-1);
  expect(line.indexOf('سماحك')).not.toBe(-1);
  expect(line.indexOf('لحد 11-30')).not.toBe(-1);   // 📅 التاريخ من غير سنة
  expect(line.indexOf('قبضت')).toBe(-1);            // ✈️ القبض بقى في /runway بس
  expect(line.indexOf(EMDASH)).toBe(-1);            // مفيش شرطة طويلة في السطر
  expect(line.indexOf('2026')).toBe(-1);            // مفيش سنة خالص
});

test('isDeleteIntent: كلمات المسح بتتعرف صح ومش بتشتغل بالغلط', function () {
  expect(typeof isDeleteIntent).toBe('function');
  expect(isDeleteIntent('امسح')).toBe(true);
  expect(isDeleteIntent('امسح دي')).toBe(true);
  expect(isDeleteIntent('احذفها')).toBe(true);
  expect(isDeleteIntent('مكرر')).toBe(true);
  expect(isDeleteIntent('الغي')).toBe(true);
  expect(isDeleteIntent('delete')).toBe(true);
  expect(isDeleteIntent('امسح 65 مواصلات')).toBe(false);          // فيها رقم → تصحيح مش مسح
  expect(isDeleteIntent('كشف امي كان ب 600 مش 200')).toBe(false); // تصحيح
  expect(isDeleteIntent('ده كان غلط خلاص')).toBe(false);           // أول كلمة مش من القايمة
  expect(isDeleteIntent('')).toBe(false);
  expect(isDeleteIntent(null)).toBe(false);
});

test('IntelligenceService.processCorrection موجودة وبتقبل السياق', function () {
  expect(typeof AppContext.ai().processCorrection).toBe('function');
  expect(AppContext.ai().processCorrection.length).toBeGreaterThanOrEqual(3);
});
