// ═══════════════ نقاط الدخول ═══════════════
// الطبقة: Entry · تريجرات جوجل + setup + doctor: البوابة الوحيدة بين جوجل وباقي النظام
function pollUpdates() { AppContext.polling().poll(); }

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) return ContentService.createTextOutput('ok');
    const s = AppContext.secrets().secret;
    if (s && (!e.parameter || e.parameter.secret !== s)) return ContentService.createTextOutput('no');
    AppContext.dispatcher().process(JSON.parse(e.postData.contents));
  } catch (err) {
    AppContext.logRepo().error(err.stack || String(err), 'webhook error',
      String((e && e.postData && e.postData.contents) || '').slice(0, 300));
  }
  return ContentService.createTextOutput('ok');
}

// ── تشغّلها من المحرر ──
function installPolling() {
  AppContext.polling().install();
  // تريجر المزامنة اليومية الساعة 4 صباحاً (ضمانة إن الداتابيز دايماً fresh)
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'dailySync') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailySync').timeBased().atHour(4).everyDays(1).create();
  // 🌙 تريجر الديجست اليومي 23:30، التقرير قبل النوم
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'dailySummary') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('dailySummary').timeBased().atHour(23).nearMinute(30).everyDays(1).create();
}
function stopPolling() {
  AppContext.polling().uninstall();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'dailySync') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Stopped ✅');
}

function setup() {
  AppContext.txRepo().open();
  AppContext.promptRepo().open();
  AppContext.budgetRepo().open();
  AppContext.logRepo().open();
  const cats = AppContext.categoryRepo();
  cats.open();
  if (cats.lastRow() < 2) CONFIG.DEFAULT_CATEGORIES.forEach(c => cats.append([c]));
  AppContext.dashboard().build();
  Logger.log('Setup complete ✅');
}

function clearLog() { AppContext.logRepo().clear(); Logger.log('Log cleared ✅'); }

// 💾 المزامنة اليومية (التريجر بيناديها الساعة 4 صباحاً)
function dailySync() {
  const n = AppContext.backup().syncTransactions();
  const clean = AppContext.backup().cleanup();
  AppContext.logRepo().info('BACKUP', 'daily sync: ' + n + ' tx | cleanup: ' + clean.removed + ' files');
}

function dailySummary() {
  const lang = AppContext.lang().get();
  AppContext.telegram().send(AppContext.secrets().chatId,
    (lang === 'ar' ? '🌙 قبل ما تنام:\n\n' : '🌙 End of day:\n\n') + AppContext.finance().today());
}
function monthlyReport() {
  const lang = AppContext.lang().get();
  AppContext.telegram().send(AppContext.secrets().chatId,
    (lang === 'ar' ? '📅 بداية شهر جديد!\n\n' : '📅 New month!\n\n') +
    AppContext.finance().report(lang === 'ar' ? 'الشهر اللي فات' : 'Last month',
      d => d.startsWith(DateUtils.month(-1))));
}

// 📋 شغّلها مرة واحدة، تسجيل كل الأوامر في منيو تليجرام
// (نفس اللي بتعمله يدوي من BotFather، بس أوتوماتيك)
function setupMenuCommands() {
  if (!CONFIG.COMMAND_MENU || !CONFIG.COMMAND_MENU.length) {
    Logger.log('setupMenuCommands: CONFIG.COMMAND_MENU ناقص، المنيو مش اتسجل');
    AppContext.telegram().send(AppContext.secrets().chatId,
      '❌ المنيو مش اتسجل، بلوك COMMAND_MENU ناقص في Config.js');
    return;
  }
  const res = AppContext.telegram().api('setMyCommands', { commands: CONFIG.COMMAND_MENU });
  Logger.log('setMyCommands: ' + JSON.stringify(res));
  if (res.ok) {
    AppContext.telegram().send(AppContext.secrets().chatId,
      '📋 اتسجل ' + CONFIG.COMMAND_MENU.length + ' أمر في منيو التليجرام ✅\nاكتب / أو افتح زرار الـ Menu وشوفها');
  }
}

// 🧠 شغّلها مرة بعد التحديث، مسح البرومبت المخزن عشان يتولد بالقواعد الجديدة
function migrateToV30() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pr = ss.getSheetByName('Prompts');
  if (pr && pr.getLastRow() >= 2) {
    const data = pr.getRange(2, 1, pr.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === CONFIG.PROMPT_KEY) { pr.deleteRow(i + 2); break; }
    }
  }
  Logger.log('V30 done ✅');
}
// 🩺 الفاحص الشامل، من دلوقتي دي أمر التحقق بعد أي تحديث
function doctor() {
  const lines = [];
  let failed = 0;
  const check = function (name, fn) {
    try { fn(); lines.push('✅ ' + name); }
    catch (e) { failed++; lines.push('❌ ' + name + ' → ' + String(e && e.message ? e.message : e).slice(0, 90)); }
  };

  check('Config: KINDS فيها loan_out_off', function () {
    if (!CONFIG.KINDS.loan_out_off) throw new Error('بلوك KINDS بتاع V30 ناقص');
  });
  check('Config: COMMAND_MENU', function () {
    if (!CONFIG.COMMAND_MENU || !CONFIG.COMMAND_MENU.length) throw new Error('بلوك COMMAND_MENU ناقص');
  });
  check('Wiring: brain()', function () { AppContext.brain(); });
  check('Wiring: dispatcher()', function () { AppContext.dispatcher(); });
  check('Wiring: polling()', function () { AppContext.polling(); });
  check('Wiring: finance() بترجع FinanceService', function () {
    const f = AppContext.finance();
    if (typeof f.today !== 'function' || typeof f.runwayStatus !== 'function')
      throw new Error('finance() راجع ' + ((f && f.constructor && f.constructor.name) || 'حاجة غلط'));
  });
  check('العقل المحلي: تحية', function () {
    const r = AppContext.brain().try('شكرا');
    if (!r || r.type !== 'greeting') throw new Error('رجع ' + JSON.stringify(r));
  });
  check('العقل المحلي: إدخال سريع', function () {
    const r = AppContext.brain().try('50 مواصلات');
    if (!r || r.type !== 'tx' || r.transactions[0].category !== 'Transport')
      throw new Error('رجع ' + JSON.stringify(r));
  });
  check('العقل المحلي: سؤال ديون', function () {
    const r = AppContext.brain().try('كام اللي عليا؟');
    if (!r || r.type !== 'command' || r.cmd !== 'debts') throw new Error('رجع ' + JSON.stringify(r));
  });
  check('البرومبت: قواعد V30', function () {
    if (AppContext.ai().buildPrompt('test').indexOf('loan_out_off') === -1)
      throw new Error('شغّل migrateToV30 تاني');
  });
  check('الشيت: قراءة المعاملات', function () { AppContext.txRepo().getAll(); });
  check('الحفظ: مانع التكرار (messageId)', function () {
    if (typeof AppContext.txRepo().existsByMessageId !== 'function')
      throw new Error('existsByMessageId ناقصة، شغّل آخر نسخة من الكود');
  });
  check('الحماية: حجز مسبق قبل نداء الـ AI', function () {
    // 🛡️ اللي بيميّت السقوط الصامت: كل رساية AI بتتحجز في الطابور قبل النداء
    if (typeof AppContext.dispatcher().needsSlowAi !== 'function' ||
        typeof AppContext.retryQueue().ensureRow !== 'function')
      throw new Error('الحجز المسبق ناقص، شغّل آخر نسخة من الكود');
  });
  check('التعديل: محرك الريبلاي (findByMessageId/deleteRows)', function () {
    if (typeof AppContext.txRepo().findByMessageId !== 'function' ||
        typeof AppContext.txRepo().deleteRows !== 'function' ||
        typeof AppContext.ai().processCorrection !== 'function')
      throw new Error('محرك التعديل بالريبلاي ناقص، شغّل آخر نسخة من الكود');
  });
  check('العداد: Amount بيتحدث من القبض الفعلي', function () {
    // 💵 إصلاح ذاتي: عمود Amount في شيت الـ Runway بيتكتب من شيت المعاملات
    const v = AppContext.runwayRepo().refreshAmount(AppContext.txRepo());
    if (v === undefined) throw new Error('refreshAmount ناقصة، شغّل آخر نسخة من الكود');
  });
  check('تليجرام: إرسال رسالة', function () {
    AppContext.telegram().api('sendMessage', { chat_id: AppContext.secrets().chatId, text: '🔧 Doctor: send test' });
  });
  check('التريجر: pollUpdates', function () {
    const ok = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'pollUpdates'; });
    if (!ok) throw new Error('شغّل installPolling');
  });
  check('التريجر: dailySummary', function () {
    const ok = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'dailySummary'; });
    if (!ok) {   // 🌙 ناقص؟ هنعمله هنا، عشان الديجست اليومي مايفوتش أبداً
      ScriptApp.newTrigger('dailySummary').timeBased().atHour(23).nearMinute(30).everyDays(1).create();
      AppContext.logRepo().info('TRIGGER_CREATED', 'dailySummary 23:30');
    }
  });
  check('المنيو: مسجل عند تليجرام', function () {
    AppContext.notifier().syncMenu();   // 📋 لو ناقص بيتسجل قبل الفحص، إصلاح ذاتي
    const res = AppContext.telegram().api('getMyCommands', {});
    if (!res.result || res.result.length < 20)
      throw new Error('مسجل ' + (res.result || []).length + ' بس');
  });

  const report = '🩺 <b>Doctor Report</b>\n\n' + lines.join('\n') + '\n\n' +
    (failed === 0 ? '🎉 كله سليم، قفل محادثة البوت وافتحها وابعت /ping'
                  : '⚠️ ' + failed + ' فشل، انسخ التقرير ده للمهندس');
  try {
    AppContext.telegram().send(AppContext.secrets().chatId, report, { parse_mode: 'HTML' });
    Logger.log('Doctor: تم الإرسال ✅');
  } catch (e) {
    Logger.log('Doctor فشل في الإرسال: ' + e + '\n\n' + report);
  }
}

function testFlow() {
  const ctx = AppContext, tg = ctx.telegram();
  Logger.log('1) TG send: ' + tg.api('sendMessage', { chat_id: ctx.secrets().chatId, text: '🔧 Test ✅' }).ok);
  Logger.log('2) TX count: ' + ctx.txRepo().getAll().length);
  Logger.log('3) Lang detect "صرفت 50" → ' + ctx.lang().detect('صرفت 50'));
  Logger.log('4) Backup: ' + ctx.backup().syncTransactions() + ' tx synced');
  ctx.dashboard().build();
  Logger.log('5) Dashboard rebuilt');
  Logger.log('6) Month report:\n' + ctx.finance().month());
}
