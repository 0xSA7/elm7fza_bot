// ═══════════════ نقاط الدخول ═══════════════
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
}
function stopPolling() {
  AppContext.polling().uninstall();
  ScriptApp.getProjectTriggers().forEach(t => {
    if (t.getHandlerFunction() === 'dailySync') ScriptApp.deleteTrigger(t);
  });
  Logger.log('Stopped ✅');
}

// 🔄 شغّلها مرة واحدة بعد التحديث — بتحوّل الداتا القديمة للإنجليزي
function migrateToEnglish() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) الترانزاكشنز — الهيدرز + كل التصنيفات العربية (حتى اللي اتسجلت بعد ميجريشن سابق)
  const tx = ss.getSheetByName('Transactions');
  if (tx) {
    if (String(tx.getRange(1, 1).getValue()).trim() === 'التاريخ') {
      tx.getRange(1, 1, 1, CONFIG.TX_HEADERS.length).setValues([CONFIG.TX_HEADERS]);
    }
    const last = tx.getLastRow();
    if (last >= 2) {
      const data = tx.getRange(2, 1, last - 1, 9).getValues();
      let changed = 0;
      for (let r = 0; r < data.length; r++) {
        const en = CONFIG.CATEGORY_AR_EN[String(data[r][4]).trim()];
        if (en) { data[r][4] = en; changed++; }
      }
      if (changed) {
        tx.getRange(2, 1, last - 1, 9).setValues(data);
        Logger.log('Translated ' + changed + ' categories → English');
      }
    }
  }

  // 2) التصنيفات والميزانيات
  ['Categories', 'Budgets'].forEach(function (name) {
    const sh = ss.getSheetByName(name);
    if (!sh || sh.getLastRow() < 2) return;
    const last = sh.getLastRow();
    const data = sh.getRange(2, 1, last - 1, 2).getValues();
    for (let r = 0; r < data.length; r++) {
      const en = CONFIG.CATEGORY_AR_EN[String(data[r][0]).trim()];
      if (en) data[r][0] = en;
    }
    sh.getRange(2, 1, last - 1, 2).setValues(data);
  });

  // 3) اللوق
  const log = ss.getSheetByName('Log');
  if (log) {
    if (log.getLastRow() > 1) log.deleteRows(2, log.getLastRow() - 1);
    log.getRange(1, 1, 1, CONFIG.LOG_HEADERS.length).setValues([CONFIG.LOG_HEADERS]);
  }

  // 4) مسح الـ Prompt العربي القديم عشان يتولد إنجليزي
  //    (لو معدلتش الـ Prompt بإيدك — عادي شغلها)
  const pr = ss.getSheetByName('Prompts');
  if (pr && pr.getLastRow() >= 2) {
    const data = pr.getRange(2, 1, pr.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === CONFIG.PROMPT_KEY) { pr.deleteRow(i + 2); break; }
    }
  }

  AppContext.dashboard().build();
  AppContext.backup().syncTransactions();
  Logger.log('Migration done ✅');
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

function migrateStorage() {
  const b = AppContext.backup();
  const clean = b.cleanup();        // بيشيل ملفات النسخة القديمة
  const n = b.syncTransactions();   // وبينشئ النسخة المضغوطة الجديدة
  const s = b.stats();
  Logger.log('Cleanup: ' + clean.removed + ' files (' + clean.freedKB + ' KB)');
  Logger.log('Synced: ' + n + ' tx');
  Logger.log('Folder now: ' + s.files + ' files, ' + s.sizeKB + ' KB');
  AppContext.telegram().send(AppContext.secrets().chatId,
    '🗜️ التخزين اتحول للنظام المضغوط ✅\n' +
    'اتمسح: ' + clean.removed + ' ملف قديم (' + clean.freedKB + ' KB)\n' +
    'المعاملات: ' + n + ' متزامنة\n' +
    'حجم الفولدر دلوقتي: ' + s.sizeKB + ' KB');
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

// 💳 شغّلها مرة واحدة بعد التحديث — بتحوّل الداتا القديمة للنظام المحاسبي الجديد
function migrateToV27() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tx = ss.getSheetByName('Transactions');
  let fixed = 0;

  if (tx && tx.getLastRow() >= 2) {
    const last = tx.getLastRow();
    const data = tx.getRange(2, 1, last - 1, 9).getValues();
    for (let r = 0; r < data.length; r++) {
      if (String(data[r][3]) !== 'income') continue;   // بنصلح الدخول بس
      const text = (String(data[r][5]) + ' ' + String(data[r][6])).toLowerCase();
      if (/والدي|ابي|ابويا|بويا|بابا|father|dad/.test(text)) {
        data[r][3] = 'loan_in'; data[r][4] = 'Father'; fixed++;
      } else if (/والدتي|امي|اميا|ماما|mother|mom/.test(text)) {
        data[r][3] = 'loan_in'; data[r][4] = 'Mother'; fixed++;
      } else if (/هدية|هديه|شعيب|gift/.test(text)) {
        data[r][4] = 'Free Money'; fixed++;
      } else if (/كارت|معايا قبل|رصيد|card/.test(text)) {
        data[r][4] = 'Own Money'; fixed++;
      }
    }
    tx.getRange(2, 1, last - 1, 9).setValues(data);
  }

  // التصنيفات الجديدة لو ناقصة
  const cats = ss.getSheetByName('Categories');
  if (cats) {
    const existing = cats.getLastRow() < 2 ? [] :
      cats.getRange(2, 1, cats.getLastRow() - 1, 1).getValues().map(r => String(r[0]).trim());
    CONFIG.DEFAULT_CATEGORIES.forEach(c => {
      if (existing.indexOf(c) === -1) cats.appendRow([c]);
    });
  }

  AppContext.dashboard().build();
  AppContext.backup().syncTransactions();
  Logger.log('V27 migration: ' + fixed + ' rows fixed ✅');
  AppContext.telegram().send(AppContext.secrets().chatId,
    '💳 <b>الميجريشن خلصت!</b>\n' + fixed + ' حركة اتعادلت (سلف والديك + الهدية + الرصيد).\n' +
    'ابعت /debts وشوف دفترك الجديد 👀', { parse_mode: 'HTML' });
}
// ⚡ شغّلها مرة واحدة — بيمسح البرومبت الكبير القديم عشان يتولد المضغوط الجديد
function migrateToV28() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pr = ss.getSheetByName('Prompts');
  if (pr && pr.getLastRow() >= 2) {
    const data = pr.getRange(2, 1, pr.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === CONFIG.PROMPT_KEY) { pr.deleteRow(i + 2); break; }
    }
  }
  Logger.log('V28 done — البرومبت المضغوط هيتولد مع أول رسالة ✅');
}

// 🧠 شغّلها مرة بعد التحديث — بتمسح البرومبت المحفوظ عشان يتولد بالقواعد المقواة الجديدة
function migrateToV29() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pr = ss.getSheetByName('Prompts');
  if (pr && pr.getLastRow() >= 2) {
    const data = pr.getRange(2, 1, pr.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === CONFIG.PROMPT_KEY) { pr.deleteRow(i + 2); break; }
    }
  }
  Logger.log('V29 done — البرومبت المقوى هيتولد مع أول رسالة ✅');
}
// 📋 شغّلها مرة واحدة — تسجيل كل الأوامر في منيو تليجرام
// (نفس اللي بتعمله يدوي من BotFather — بس أوتوماتيك)
function setupMenuCommands() {
  const res = AppContext.telegram().api('setMyCommands', { commands: CONFIG.COMMAND_MENU });
  Logger.log('setMyCommands: ' + JSON.stringify(res));
  if (res.ok) {
    AppContext.telegram().send(AppContext.secrets().chatId,
      '📋 كل الأوامر اتسجلت في منيو التليجرام ✅\nاكتب / أو افتح زرار الـ Menu وشوفها');
  }
}

// 🧠 شغّلها مرة بعد التحديث — مسح البرومبت المخزن عشان يتولد بالقواعد الجديدة
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
// 🩺 الفاحص الشامل — من دلوقتي دي أمر التحقق بعد أي تحديث
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
  check('تليجرام: إرسال رسالة', function () {
    AppContext.telegram().api('sendMessage', { chat_id: AppContext.secrets().chatId, text: '🔧 Doctor: send test' });
  });
  check('التريجر: pollUpdates', function () {
    const ok = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'pollUpdates'; });
    if (!ok) throw new Error('شغّل installPolling');
  });
  check('المنيو: مسجل عند تليجرام', function () {
    const res = AppContext.telegram().api('getMyCommands', {});
    if (!res.result || res.result.length < 20)
      throw new Error('مسجل ' + (res.result || []).length + ' بس');
  });

  const report = '🩺 <b>Doctor Report</b>\n\n' + lines.join('\n') + '\n\n' +
    (failed === 0 ? '🎉 كله سليم — قفل محادثة البوت وافتحها وابعت /ping'
                  : '⚠️ ' + failed + ' فشل — انسخ التقرير ده للمهندس');
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