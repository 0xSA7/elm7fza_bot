// ═══════════════ الميجريشن ═══════════════
// الطبقة: Entry/one-time · تحويلات بيانات قديمة، بتشتغل يدوي مرة واحدة من المحرر
// 🔄 شغّلها مرة واحدة بعد التحديث، بتحوّل الداتا القديمة للإنجليزي
function migrateToEnglish() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1) الترانزاكشنز، الهيدرز + كل التصنيفات العربية (حتى اللي اتسجلت بعد ميجريشن سابق)
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
  //    (لو معدلتش الـ Prompt بإيدك، عادي شغلها)
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

// 💳 شغّلها مرة واحدة بعد التحديث، بتحوّل الداتا القديمة للنظام المحاسبي الجديد
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
      } else if (/هدية|هديه|gift/.test(text)) {
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
// ⚡ شغّلها مرة واحدة، بيمسح البرومبت الكبير القديم عشان يتولد المضغوط الجديد
function migrateToV28() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pr = ss.getSheetByName('Prompts');
  if (pr && pr.getLastRow() >= 2) {
    const data = pr.getRange(2, 1, pr.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === CONFIG.PROMPT_KEY) { pr.deleteRow(i + 2); break; }
    }
  }
  Logger.log('V28 done: البرومبت المضغوط هيتولد مع أول رسالة ✅');
}

// 🧠 شغّلها مرة بعد التحديث، بتمسح البرومبت المحفوظ عشان يتولد بالقواعد المقواة الجديدة
function migrateToV29() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pr = ss.getSheetByName('Prompts');
  if (pr && pr.getLastRow() >= 2) {
    const data = pr.getRange(2, 1, pr.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === CONFIG.PROMPT_KEY) { pr.deleteRow(i + 2); break; }
    }
  }
  Logger.log('V29 done: البرومبت المقوى هيتولد مع أول رسالة ✅');
}
// 🔧 شغّلها مرة واحدة، بتوحد أسماء العيلة في كل المعاملات القديمة
function fixPersonNames() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const tx = ss.getSheetByName('Transactions');
  if (!tx || tx.getLastRow() < 2) return;

  const last = tx.getLastRow();
  const data = tx.getRange(2, 1, last - 1, 9).getValues();
  let fixed = 0;

  for (let r = 0; r < data.length; r++) {
    const kind = String(data[r][3]);
    if (kind.indexOf('loan') !== -1 || kind.indexOf('repay') !== -1) {
      const old = String(data[r][4] || '').trim();
      const mapped = canonicalPerson(old);          // ✅ الاسم قاعد في data[r][4] مش row.person
      if (mapped && mapped !== old) { data[r][4] = mapped; fixed++; }
    }
  }
  if (fixed > 0) tx.getRange(2, 1, last - 1, 9).setValues(data);

  AppContext.backup().syncTransactions();
  AppContext.telegram().send(AppContext.secrets().chatId,
    '🔧 اتحول ' + fixed + ' اسم عيلة للإنجليزي (امي→Mother)\n/debts وشوف الدفتر الموحد 👀');
  Logger.log('Fixed ' + fixed + ' person names');
}

// ✈️ شغّلها مرة بعد التحديث، بيمسح البرومبت المخزن عشان يتولد بقاعدة العداد الجديدة
function migrateToV31() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const pr = ss.getSheetByName('Prompts');
  if (pr && pr.getLastRow() >= 2) {
    const data = pr.getRange(2, 1, pr.getLastRow() - 1, 2).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === CONFIG.PROMPT_KEY) { pr.deleteRow(i + 2); break; }
    }
  }
  Logger.log('V31 done: البرومبت بقاعدة العداد هيتولد مع أول رسالة ✅');
}

// 🔒 v43: تسجيل أسماء الأصحاب في Script Properties (بياناتك في حسابك بس، مش في الكود)
// شغّلها مرة واحدة من محرر Apps Script بعد ما تبدّل المثال بأسمائك الحقيقية.
// الصيغة: { "كل كتابة بالعربي": "الاسم الموحد اللي يتكتب في الشيت" }
// بعد أي تعديل بعدها مش محتاج تعمل حاجة: القراءة بتاعة الأسماء بتتحدث كل تنفيذ.
function setPersonAliases() {
  const aliases = {
    'مثال-بالعربي': 'Example',
    'مثال-تهجئة-تانية': 'Example'
  };
  PropertiesService.getScriptProperties().setProperty(
    'PERSON_ALIASES', JSON.stringify(aliases));
  Logger.log('PERSON_ALIASES saved: ' + Object.keys(aliases).length + ' spellings');
}
