// ═══ v39: اختبارات الحجز المسبق — مفيش رساية AI تموت في السكوت ═══

test('needsSlowAi: الأوامر والإدخال السريع والتحيات محليين (مفيش حجز)', function () {
  const d = AppContext.dispatcher();
  const chatId = d.deps.chatId;
  const mk = function (msg) { return { update_id: 900001, message: msg }; };
  expect(d.needsSlowAi(mk({ chat: { id: chatId }, message_id: 1, text: '/ping' }))).toBe(false);
  expect(d.needsSlowAi(mk({ chat: { id: chatId }, message_id: 1, text: '50 مواصلات' }))).toBe(false);
  expect(d.needsSlowAi(mk({ chat: { id: chatId }, message_id: 1, text: 'شكرا' }))).toBe(false);
  expect(d.needsSlowAi({})).toBe(false);
});

test('needsSlowAi: السردية المتعددة والصوت والصورة بيدوا AI (حجز)', function () {
  const d = AppContext.dispatcher();
  const chatId = d.deps.chatId;
  const mk = function (msg) { return { update_id: 900002, message: msg }; };
  expect(d.needsSlowAi(mk({ chat: { id: chatId }, message_id: 1,
    text: 'يوم 28/10 صرفت 20ج تصليح ماسورة و 30ج مواصلات للبيت' }))).toBe(true);
  expect(d.needsSlowAi(mk({ chat: { id: chatId }, message_id: 1, voice: { file_id: 'v' } }))).toBe(true);
  expect(d.needsSlowAi(mk({ chat: { id: chatId }, message_id: 1, photo: [{ file_id: 'p' }] }))).toBe(true);
});

test('ensureRow: الرساية بتتحجز مرة واحدة بس (مفيش صفوف متكررة)', function () {
  const q = AppContext.retryQueue();
  const upd = { update_id: 910001, message: { chat: { id: 1 }, message_id: 71, text: 'سردية بتروح للـ AI' } };
  q.ensureRow(upd);
  expect(q.findRow(910001)).not.toBe(-1);
  q.ensureRow(upd);   // تاني — لازم تفضل صف واحد
  const rows = q.readAll().filter(function (r) { return Number(r[0]) === 910001; });
  expect(rows.length).toBe(1);
  q.removeRow(910001);   // 🧹 تنظيف
  expect(q.findRow(910001)).toBe(-1);
});

test('الضمانة الكبرى: التنفيذ "اتقتل" — الرساية بتتعالج من الطابور وبتتمسح', function () {
  const q = AppContext.retryQueue();
  const d = AppContext.dispatcher();
  const upd = { update_id: 910002, message: { chat: { id: d.deps.chatId }, message_id: 72,
    text: 'يوم 28/10 صرفت 20ج تصليح ماسورة و 30ج مواصلات للبيت' } };
  q.ensureRow(upd);   // 🛡️ الحجز قبل النداء
  // 💀 التنفيذ "اتقتل" في نص نداء الـ AI: مفيش process ومفيش removeRow
  q.processDueLocked(d);   // الدورة الجاية بتحاولها من الطابور
  expect(q.findRow(910002)).toBe(-1);   // اتعالجت واتمسحت ✅
});

test('enqueue: على رساية محجوزة بتأجل المعاد وتبعت الإشعار من غير تكرار', function () {
  const q = AppContext.retryQueue();
  const upd = { update_id: 910003, message: { chat: { id: 1 }, message_id: 73, text: 'رساية' } };
  q.ensureRow(upd);
  q.enqueue(upd, new HighDemandError('HTTP 429'));   // فشلت بسرعة → تأجيل + إشعار
  const rows = q.readAll().filter(function (r) { return Number(r[0]) === 910003; });
  expect(rows.length).toBe(1);   // صف واحد — مش اتنين
  q.removeRow(910003);
  expect(q.findRow(910003)).toBe(-1);
});
