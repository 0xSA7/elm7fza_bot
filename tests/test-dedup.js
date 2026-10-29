// ═══ v37: اختبارات منع التكرار + المنيو + القفل ═══

test('Config: COMMAND_MENU موجودة جوه الإعدادات', function () {
  expect(Array.isArray(CONFIG.COMMAND_MENU)).toBe(true);
  expect(CONFIG.COMMAND_MENU.length).toBeGreaterThanOrEqual(20);
  CONFIG.COMMAND_MENU.forEach(function (c) {
    if (!/^[a-z0-9_]{1,32}$/.test(c.command)) throw new Error('اسم أمر غلط: "' + c.command + '"');
    if (!c.description) throw new Error('وصف ناقص للأمر: ' + c.command);
  });
});

test('Config: المنيو فيه doctor وrunway', function () {
  expect(CONFIG.COMMAND_MENU.some(function (c) { return c.command === 'doctor'; })).toBe(true);
  expect(CONFIG.COMMAND_MENU.some(function (c) { return c.command === 'runway'; })).toBe(true);
});

test('Repo: existsByMessageId بيلاقي الرسالة المتسجلة', function () {
  const repo = AppContext.txRepo();
  repo.add(new Transaction({ date: DateUtils.today(), amount: 15, kind: 'expense',
                             category: 'Food', messageId: 4242 }));
  expect(repo.existsByMessageId(4242)).toBe(true);
  expect(repo.existsByMessageId(999999)).toBe(false);
  expect(repo.existsByMessageId('')).toBe(false);
});

test('persistAndReply: نفس الرسالة متتسجلش مرتين', function () {
  const d = AppContext.dispatcher();
  const fakeMsg = { chat: { id: 'test' }, message_id: 42666, text: '50 مواصلات' };
  const mkTx = function () {
    return new Transaction({ date: DateUtils.today(), amount: 50, kind: 'expense',
                             category: 'Transport', messageId: 42666 });
  };
  d.persistAndReply(fakeMsg, { transactions: [mkTx()] });
  const afterFirst = AppContext.txRepo().getAll().length;

  // نفس الرسالة تاني — لازم تترفض من غير أي صف جديد
  d.persistAndReply(fakeMsg, { transactions: [mkTx()] });
  const afterSecond = AppContext.txRepo().getAll().length;

  expect(afterSecond).toBe(afterFirst);
});

test('persistAndReply: رسالة جديدة بتتسجل عادي', function () {
  const d = AppContext.dispatcher();
  const before = AppContext.txRepo().getAll().length;
  d.persistAndReply({ chat: { id: 'test' }, message_id: 42777, text: '30 قهوة' },
    { transactions: [new Transaction({ date: DateUtils.today(), amount: 30, kind: 'expense',
                                      category: 'Outings', messageId: 42777 })] });
  expect(AppContext.txRepo().getAll().length).toBe(before + 1);
});

test('PollingEngine: الدورة بتشتغل بالقفل من غير أخطاء', function () {
  AppContext.polling().poll();   // قفل + دورة فاضية + طابور + فتح القفل
});

test('VersionNotifier: syncMenu موجودة', function () {
  expect(typeof AppContext.notifier().syncMenu).toBe('function');
});
