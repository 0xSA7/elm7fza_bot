// ═══════════════ منطق المالية — دخل حقيقي منفصل عن الديون ═══════════════
class FinanceService {
  constructor(txRepo, budgetRepo, langService) {
    this.tx = txRepo; this.budgets = budgetRepo; this.i18n = langService;
  }
  t(key, params) { return I18n.t(key, this.i18n.get(), params); }

  save(transactions) {
    transactions.forEach(t => this.tx.add(t));
    const lang = this.i18n.get();
    const head = transactions.length === 1
      ? this.t('savedOne') : this.t('savedMany', { n: transactions.length });
    let text = '✅ ' + head + ':\n' + transactions.map(t => t.displayLine(lang)).join('\n');
    const warn = this.budgetWarnings(transactions);
    return warn ? text + '\n\n' + warn : text;
  }

  // التحذيرات للمصاريف بس — السلف عمرها ما تنقص من الميزانية
  budgetWarnings(transactions) {
    const limits = this.budgets.getAll();
    if (!Object.keys(limits).length) return '';
    const prefix = DateUtils.month(), spent = {};
    this.tx.getAll().forEach(t => {
      if (t.kind === 'expense' && t.date.startsWith(prefix))
        spent[t.category] = (spent[t.category] || 0) + t.amount;
    });
    const warns = [];
    transactions.filter(t => t.kind === 'expense').forEach(t => {
      const limit = limits[t.category];
      if (!limit) return;
      const pct = (spent[t.category] || 0) / limit * 100;
      if (pct >= 100) warns.push('🚨 ' + t.category + ': ' + this.t('overBudget') + ' ' +
        TextUtils.fmt(spent[t.category]) + ' ' + this.t('of') + ' ' + TextUtils.fmt(limit));
      else if (pct >= 80) warns.push('⚠️ ' + t.category + ': ' + this.t('nearBudget') + ' ' +
        Math.round(pct) + '% ' + this.t('ofBudget') + ' ' + TextUtils.fmt(limit));
    });
    return warns.join('\n');
  }

  undo() {
    const tx = this.tx.deleteLast();
    if (!tx) return this.t('nothingToUndo');
    return '↩️ ' + this.t('undone') + ': ' + TextUtils.fmt(tx.amount) + ' ' +
           tx.currency + ' — ' + tx.category + (tx.note ? ' (' + tx.note + ')' : '');
  }

  // 💳 دفتر الديون — رصيد لكل شخص
  debtBook() {
    const owed = {}, due = {};
    this.tx.getAll().forEach(t => {
      if (t.kind === 'loan_in' || t.kind === 'loan_in_off') owed[t.category] = (owed[t.category] || 0) + t.amount;
      if (t.kind === 'repay_out') owed[t.category] = (owed[t.category] || 0) - t.amount;
      if (t.kind === 'loan_out' || t.kind === 'loan_out_off') due[t.category] = (due[t.category] || 0) + t.amount;
      if (t.kind === 'repay_in') due[t.category] = (due[t.category] || 0) - t.amount;
    });
    return { owed: owed, due: due };
  }

  debtsReport() {
    const book = this.debtBook();
    const fmtSide = (obj) => Object.keys(obj)
      .map(p => ({ p: p, v: obj[p] }))
      .filter(x => Math.abs(x.v) >= 0.5)
      .map(x => x.v <= 0
        ? '• ' + TextUtils.esc(x.p) + ' — ' + this.t('settledMark')
        : '• ' + TextUtils.esc(x.p) + ': ' + TextUtils.fmt(x.v) + ' EGP')
      .join('\n');
    const owedLines = fmtSide(book.owed);
    const dueLines = fmtSide(book.due);
    if (!owedLines && !dueLines) return this.t('noDebts');

    const owedTotal = Object.keys(book.owed).reduce((s, p) => s + Math.max(0, book.owed[p]), 0);
    const dueTotal  = Object.keys(book.due).reduce((s, p) => s + Math.max(0, book.due[p]), 0);

    let text = '💳 <b>Debt Book — ' +
      (this.i18n.get() === 'ar' ? 'دفتر الديون' : 'All time') + '</b>\n\n';
    text += this.t('owedTitle') + '\n' + (owedLines || '—') + '\n\n';
    text += this.t('dueTitle') + '\n' + (dueLines || '—') + '\n\n';
    if (owedTotal > dueTotal)
      text += this.t('netOwedMore') + ' ' + TextUtils.fmt(owedTotal - dueTotal) + ' EGP';
    else if (dueTotal > owedTotal)
      text += this.t('netDueMore') + ' ' + TextUtils.fmt(dueTotal - owedTotal) + ' EGP';
    else
      text += this.t('netBalanced');
    return text;
  }

  // التقرير العام — دخل حقيقي وصرف حقيقي، والديون حركة منفصلة
  report(label, matchFn) {
    const rows = this.tx.getAll().filter(t => matchFn(t.date));
    if (!rows.length) return label + '\n' + this.t('noData');
    let income = 0, expense = 0;
    let loanIn = 0, repayOut = 0, loanOut = 0, repayIn = 0;
    const byCat = {};
    rows.forEach(t => {
      if (t.kind === 'income') income += t.amount;
      else if (t.kind === 'expense') {
        expense += t.amount;
        byCat[t.category] = (byCat[t.category] || 0) + t.amount;
      }
      else if (t.kind === 'loan_in')   loanIn += t.amount;
      else if (t.kind === 'repay_out') repayOut += t.amount;
      else if (t.kind === 'loan_out')  loanOut += t.amount;
      else if (t.kind === 'repay_in')  repayIn += t.amount;
    });

    let out = '📊 ' + label + '\n\n' +
      this.t('income') + ': ' + TextUtils.fmt(income) + '\n' +
      this.t('expense') + ': ' + TextUtils.fmt(expense) + '\n' +
      (income - expense >= 0 ? '🟢 ' : '🔴 ') + this.t('net') + ': ' +
      (income - expense >= 0 ? '+' : '') + TextUtils.fmt(income - expense) + '\n';
    if (income > 0) out += '🏦 ' + this.t('savingRate') + ': ' +
                           Math.round((income - expense) / income * 100) + '%\n';

    if (loanIn + repayOut + loanOut + repayIn > 0) {
      out += '\n💳 ' + this.t('debtsPeriod') + '\n';
      if (loanIn)   out += '• ' + this.t('borrowed') + ': ' + TextUtils.fmt(loanIn) + '\n';
      if (repayOut) out += '• ' + this.t('repaid') + ': ' + TextUtils.fmt(repayOut) + '\n';
      if (loanOut)  out += '• ' + this.t('lent') + ': ' + TextUtils.fmt(loanOut) + '\n';
      if (repayIn)  out += '• ' + this.t('collected') + ': ' + TextUtils.fmt(repayIn) + '\n';
      out += this.t('debtsFull') + '\n';
    }

    const cats = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    if (cats.length) {
      out += '\n' + this.t('distribution') + ':\n';
      cats.forEach(c => out += '• ' + c + ': ' + TextUtils.fmt(byCat[c]) +
        (expense ? ' (' + Math.round(byCat[c] / expense * 100) + '%)' : '') + '\n');
    }
    return out;
  }

  today() { return this.report(this.t('today') + ' ' + DateUtils.today(), d => d === DateUtils.today()); }
  week()  { return this.report(this.t('last7'), d => d >= DateUtils.today(-6)); }
  month() { return this.report(this.t('thisMonth') + ' (' + DateUtils.month() + ')', d => d.startsWith(DateUtils.month())); }
  stats() { return this.monthlyTrend(3) + '\n\n' + this.report(this.t('thisMonth'), d => d.startsWith(DateUtils.month())); }

  monthlyTrend(n) {
    const data = this.tx.getAll(), lines = [];
    for (let i = n - 1; i >= 0; i--) {
      const p = DateUtils.month(-i);
      let inc = 0, exp = 0;
      data.forEach(t => {
        if (!t.date.startsWith(p)) return;
        if (t.kind === 'income') inc += t.amount;
        else if (t.kind === 'expense') exp += t.amount;
      });
      lines.push(p + ': 💰 ' + TextUtils.fmt(inc) + ' | 💸 ' + TextUtils.fmt(exp) +
                 ' | ' + this.t('net') + ' ' + TextUtils.fmt(inc - exp));
    }
    return '📈 ' + this.t('lastMonths', { n: n }) + ':\n' + lines.join('\n');
  }

  topExpenses() {
    const rows = this.tx.getAll().filter(t => t.kind === 'expense' && t.date.startsWith(DateUtils.month()));
    if (!rows.length) return this.t('noExpenses');
    const byCat = {};
    rows.forEach(t => { byCat[t.category] = (byCat[t.category] || 0) + t.amount; });
    const sorted = Object.keys(byCat).sort((a, b) => byCat[b] - byCat[a]);
    let text = '🔝 <b>' + TextUtils.esc(this.t('topItems')) + ':</b>\n\n';
    sorted.slice(0, 5).forEach((cat, i) => {
      text += (i + 1) + '. <b>' + TextUtils.esc(cat) + '</b>: ' + TextUtils.fmt(byCat[cat]) + ' EGP\n';
    });
    return text;
  }

  budgetReport() {
    const limits = this.budgets.getAll();
    const cats = Object.keys(limits);
    if (!cats.length) return this.t('noBudgets');
    const prefix = DateUtils.month(), spent = {};
    this.tx.getAll().forEach(t => {
      if (t.kind === 'expense' && t.date.startsWith(prefix))
        spent[t.category] = (spent[t.category] || 0) + t.amount;
    });
    let text = '💼 ' + this.t('budgetFor') + ' ' + prefix + ':\n\n';
    cats.forEach(cat => {
      const limit = limits[cat], s = spent[cat] || 0;
      const pct = Math.min(Math.round(s / limit * 100), 100);
      const bars = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
      const icon = pct >= 100 ? '🚨' : pct >= 80 ? '⚠️' : '✅';
      text += icon + ' ' + cat + '\n' + bars + ' ' + pct + '%\n' +
              TextUtils.fmt(s) + ' / ' + TextUtils.fmt(limit) + '\n\n';
    });
    return text;
  }

  search(query) {
    if (!query || !query.trim()) return this.t('searchUsage');
    const q = query.toLowerCase();
    const rows = this.tx.getAll().filter(t =>
      t.category.toLowerCase().indexOf(q) !== -1 ||
      t.note.toLowerCase().indexOf(q) !== -1 ||
      t.rawText.toLowerCase().indexOf(q) !== -1);
    if (!rows.length) return '🔍 ' + this.t('noResults') + ': "' + query + '"';
    let total = 0;
    let text = '🔍 <b>' + this.t('searchResults') + ' ("' + TextUtils.esc(query) + '"):</b>\n\n';
    rows.slice(-10).reverse().forEach(t => {
      total += t.amount;
      text += '• ' + t.date + ' [' + t.kind + '] ' + TextUtils.fmt(t.amount) + ' ' + t.currency +
              ' (' + TextUtils.esc(t.category) + ' - ' + TextUtils.esc(t.note || this.t('noNote')) + ')\n';
    });
    return text + '\n💰 <b>' + this.t('total') + ':</b> ' + TextUtils.fmt(total) + ' EGP';
  }

  lastFive() {
    const rows = this.tx.getAll();
    if (!rows.length) return this.t('noData');
    const lang = this.i18n.get();
    return this.t('last5') + ':\n' + rows.slice(-5).reverse().map(t => t.displayLine(lang)).join('\n');
  }

  toCsv() {
    const csv = this.tx.getAll().map(t =>
      [t.date, t.amount, t.currency, t.kind, t.category,
       '"' + String(t.note || '').replace(/"/g, '""') + '"'].join(','));
    return 'Date,Amount,Currency,Type,Category,Note\n' + csv.join('\n');
  }

  compactContextForAi() {
    const rows = this.tx.getAll().filter(t => t.date.startsWith(DateUtils.month()));
    let inc = 0, exp = 0;
    rows.forEach(t => {
      if (t.kind === 'income') inc += t.amount;
      else if (t.kind === 'expense') exp += t.amount;
    });
    let s = 'This month: real income ' + TextUtils.fmt(inc) + ', expenses ' + TextUtils.fmt(exp);
    const book = this.debtBook();
    const owed = Object.keys(book.owed).filter(p => book.owed[p] >= 0.5)
      .map(p => p + ' ' + TextUtils.fmt(book.owed[p])).join(', ');
    const due = Object.keys(book.due).filter(p => book.due[p] >= 0.5)
      .map(p => p + ' ' + TextUtils.fmt(book.due[p])).join(', ');
    if (owed) s += '. He owes: ' + owed;
    if (due) s += '. Owed to him: ' + due;
    return s + '.';
  }
}