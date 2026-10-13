// ═══════════════ طبقة التخزين — التعامل مع الشيت بس ═══════════════
class SheetRepository {
  constructor(name, headers) { this.name = name; this.headers = headers; }
  open() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(this.name);
    if (!sh) {
      sh = ss.insertSheet(this.name);
      sh.appendRow(this.headers);
      sh.setFrozenRows(1);
    }
    return sh;
  }
  readAll() {
    const sh = this.open(), last = sh.getLastRow();
    return last < 2 ? [] : sh.getRange(2, 1, last - 1, this.headers.length).getValues();
  }
  append(row) { this.open().appendRow(row); }
  lastRow() { return this.open().getLastRow(); }
}

class TransactionRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.TX, CONFIG.TX_HEADERS); this._memo = null; }
  getAll() {
    if (this._memo) return this._memo;
    this._memo = this.readAll().map(r => Transaction.fromRow(r));
    return this._memo;
  }
  add(tx) { this.append(tx.toRow()); this._memo = null; }
  deleteLast() {
    const sh = this.open();
    if (sh.getLastRow() < 2) return null;
    const tx = Transaction.fromRow(sh.getRange(sh.getLastRow(), 1, 1, 9).getValues()[0]);
    sh.deleteRow(sh.getLastRow());
    this._memo = null;
    return tx;
  }
}

class CategoryRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.CATEGORIES, ['Category']); this._memo = null; }
  getAll() {
    if (this._memo) return this._memo;
    this._memo = this.readAll().map(r => String(r[0]).trim()).filter(String);
    return this._memo;
  }
}

class BudgetRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.BUDGETS, ['Category', 'Monthly Limit']); }
  getAll() {
    const limits = {};
    this.readAll().forEach(r => { if (r[0] && Number(r[1]) > 0) limits[String(r[0]).trim()] = Number(r[1]); });
    return limits;
  }
}

class PromptRepository extends SheetRepository {
  constructor() { super(CONFIG.SHEETS.PROMPTS, ['Key', 'Prompt']); }
  get(key, fallback) {
    const rows = this.readAll();
    for (let i = 0; i < rows.length; i++) {
      if (String(rows[i][0]).trim() === key) return String(rows[i][1]);
    }
    this.append([key, fallback]);
    return fallback;
  }
  set(key, value) {
    const sh = this.open(), last = sh.getLastRow();
    if (last >= 2) {
      const data = sh.getRange(2, 1, last - 1, 2).getValues();
      for (let i = 0; i < data.length; i++) {
        if (String(data[i][0]).trim() === key) {
          sh.getRange(i + 2, 2).setValue(value);
          return true;
        }
      }
    }
    this.append([key, value]);
    return true;
  }
}

// 📝 اللوق الجديد: structured + بيسجل كل حاجة + Rotation بأرشفة في درايف
class LogRepository extends SheetRepository {
  constructor() {
    super(CONFIG.SHEETS.LOG, CONFIG.LOG_HEADERS);
    this.backup = null;              // بتتوصل متأخر (عشان مفيش دايرة تعريف)
  }
  attachBackup(backup) { this.backup = backup; }

  info(event, details, opts) { this.write('INFO',  event, 'OK',   details, opts); }
  warn(event, details, opts) { this.write('WARN',  event, 'WARN', details, opts); }
  // نفس توقيع النسخة القديمة — عشان الكلاينتس القديمة تشتغل زي ما هي
  error(eng, userMsg, orig) {
    this.write('ERROR', 'ERROR', 'FAIL', String(eng) + ' | ' + String(userMsg), { raw: orig });
  }

  write(level, event, status, details, opts) {
    opts = opts || {};
    try {
      this.append([
        new Date(), level, event, status,
        opts.updateId || '', opts.lang || '',
        String(details || '').slice(0, 300),
        String(opts.raw || '').slice(0, 300)
      ]);
    } catch (x) {}
    this.trim();
  }

  // ♻️ Rotation: الشيت بيفضل خفيف — والأقدم بيتأرشف في درايف قبل مسحه
  trim() {
    try {
      const sh = this.open(), last = sh.getLastRow();
      if (last <= CONFIG.LOG_MAX_ROWS) return;
      const removeCount = last - CONFIG.LOG_TRIM_TO;
      const old = sh.getRange(2, 1, removeCount, this.headers.length).getValues();
      if (this.backup) this.backup.archiveLog(old);
      sh.deleteRows(2, removeCount);
    } catch (x) {}
  }

  clear() {
    const sh = this.open();
    if (sh.getLastRow() > 1) sh.deleteRows(2, sh.getLastRow() - 1);
  }
  count() { return Math.max(0, this.lastRow() - 1); }
  recent(n) {
    const sh = this.open(), last = sh.getLastRow();
    if (last < 2) return [];
    const size = Math.min(n, last - 1);
    return sh.getRange(last - size + 1, 1, size, 3).getValues().reverse();
  }
}