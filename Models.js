// ═══════════════ كائنات البيزنس — 6 أنواع حركة ═══════════════
class Transaction {
  constructor(f) {
    this.date = f.date;
    this.amount = Number(f.amount) || 0;
    this.currency = f.currency || 'EGP';
    this.kind = CONFIG.KINDS[f.kind] ? f.kind : 'expense';   // أي قيمة غريبة → expense
    this.person = canonicalPerson(f.person);                 // ✅ f.person مش rawPerson
    this.category = f.category || 'Other';
    if (this.kind.indexOf('loan') !== -1 || this.kind.indexOf('repay') !== -1) {
      this.category = canonicalPerson(this.category);        // ✅ أي casing + أي مكان للـ PERSON_MAP
    }
    this.note = f.note || '';
    this.rawText = f.rawText || '';
    this.messageId = f.messageId || '';
    this.createdAt = f.createdAt || new Date();
  }

  static fromGemini(data, rawText, messageId) {
    return new Transaction({
      date: DateUtils.normalizeIso(data.date),
      amount: data.amount, currency: data.currency, kind: data.kind,
      person: data.person,                     // ✅ جديد: لو جيميناي بعت person منفصل
      category: data.category, note: data.note,
      rawText: rawText, messageId: messageId
    });
  }

  static fromRow(row) {
    return new Transaction({
      date: DateUtils.normalizeCell(row[0]),
      amount: row[1], currency: row[2],
      kind: CONFIG.KINDS[row[3]] ? row[3] : 'expense',
      category: row[4], note: row[5], rawText: row[6],
      messageId: row[7], createdAt: row[8]
    });
  }

  get isCashIn()   { return CONFIG.KINDS[this.kind].cash > 0; }
  get isDebtOnMe() { return this.kind === 'loan_in' || this.kind === 'repay_out'; }

  displayLine(lang) {
    const k = CONFIG.KINDS[this.kind];
    let line = k.icon + ' ' + (k.sign ? k.sign + ' ' : '') +
               TextUtils.fmt(this.amount) + ' ' + this.currency + ' — ' + this.category;
    if (this.note) line += ' (' + this.note + ')';
    if (this.kind !== 'income' && this.kind !== 'expense')
      line += ' · ' + I18n.t(k.strKey, lang);
    if (this.date !== DateUtils.today()) line += ' 📅 ' + this.date;
    return line;
  }

  toRow() {
    return [this.date, this.amount, this.currency, this.kind, this.category,
            this.note, this.rawText, this.messageId, this.createdAt];
  }
}

class ExtractionResult {
  constructor(parsed, rawText, messageId) {
    parsed = parsed || {};
    this.isTransaction = !!parsed.is_transaction;
    this.reply = parsed.reply || '';
    this.runwayUntil = parsed.runway_until || null;   // ✈️ "لحد آخر الشهر الجاي"
    this.transactions = (parsed.transactions || [])
      .filter(t => t && Number(t.amount) > 0)
      .map(t => Transaction.fromGemini(t, rawText, messageId));
  }
}