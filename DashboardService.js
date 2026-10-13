// ═══════════════ الداشبورد: جداول حية + Charts + دفتر ديون ═══════════════
class DashboardService {
  constructor(categoryRepo, txRepo) {
    this.categories = categoryRepo;
    this.tx = txRepo;
  }

  ensureSheet() {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sh = ss.getSheetByName(CONFIG.SHEETS.DASHBOARD);
    if (!sh) sh = ss.insertSheet(CONFIG.SHEETS.DASHBOARD);
    return sh;
  }

  build() {
    const sh = this.ensureSheet();
    const TX = CONFIG.SHEETS.TX;

    sh.clear();
    sh.getCharts().forEach(c => { try { sh.removeChart(c); } catch (e) {} });

    // ── Block 1: آخر ٦ شهور (دخل حقيقي وصرف حقيقي) ──
    sh.getRange(1, 1).setValue('📈 Monthly Summary (live)');
    const rows = [['Month', 'Income', 'Expense', 'Net']];
    for (let idx = 0; idx < 6; idx++) {
      const i = 5 - idx;
      const start = DateUtils.month(-i) + '-01';
      const end = (i === 0 ? DateUtils.month(1) : DateUtils.month(-i + 1)) + '-01';
      const r = idx + 3;
      rows.push([
        DateUtils.month(-i),
        '=SUMIFS(' + TX + '!$B:$B,' + TX + '!$D:$D,"income",' +
          TX + '!$A:$A,">=' + start + '",' + TX + '!$A:$A,"<' + end + '")',
        '=SUMIFS(' + TX + '!$B:$B,' + TX + '!$D:$D,"expense",' +
          TX + '!$A:$A,">=' + start + '",' + TX + '!$A:$A,"<' + end + '")',
        '=B' + r + '-C' + r
      ]);
    }
    sh.getRange(2, 1, rows.length, 4).setValues(rows);
    sh.getRange(2, 1, 1, 4).setFontWeight('bold');

    // ── Block 2: الشهر الحالي حسب التصنيف ──
    const cats = this.categories.getAll();
    if (cats.length) {
      sh.getRange(1, 7).setValue('🏷️ This Month by Category (live)');
      const mStart = DateUtils.month() + '-01';
      const catRows = [['Category', 'Spent']];
      cats.forEach(c => {
        catRows.push([c,
          '=SUMIFS(' + TX + '!$B:$B,' + TX + '!$E:$E,"' + String(c).replace(/"/g, '""') +
          '",' + TX + '!$D:$D,"expense",' + TX + '!$A:$A,">=' + mStart + '")']);
      });
      sh.getRange(2, 7, catRows.length, 2).setValues(catRows);
      sh.getRange(2, 7, 1, 2).setFontWeight('bold');
      this.addChart(sh, Charts.ChartType.PIE,
        sh.getRange(2, 7, catRows.length, 2), 'Spending by Category', 13, 7);
    }

    this.addChart(sh, Charts.ChartType.COLUMN,
      sh.getRange(2, 1, 7, 3), 'Monthly Trend', 13, 1);

    // ── Block 3: 💳 دفتر الديون — رصيد لكل شخص (live) ──
    const people = {};
    this.tx.getAll().forEach(t => {
      if (CONFIG.DEBT_KINDS.indexOf(t.kind) !== -1 || CONFIG.LOAN_KINDS.indexOf(t.kind) !== -1)
        people[t.category] = true;
    });
    const persons = Object.keys(people);
    if (persons.length) {
      sh.getRange(1, 11).setValue('💳 Debt Book (all time, live)');
      const dRows = [['Person', 'I Owe', 'Owed To Me']];
      persons.forEach(p => {
        const safe = String(p).replace(/"/g, '""');
        dRows.push([p,
          '=SUMIFS(' + TX + '!$B:$B,' + TX + '!$D:$D,"loan_in",' + TX + '!$E:$E,"' + safe + '")' +
          '-SUMIFS(' + TX + '!$B:$B,' + TX + '!$D:$D,"repay_out",' + TX + '!$E:$E,"' + safe + '")',
          '=SUMIFS(' + TX + '!$B:$B,' + TX + '!$D:$D,"loan_out",' + TX + '!$E:$E,"' + safe + '")' +
          '-SUMIFS(' + TX + '!$B:$B,' + TX + '!$D:$D,"repay_in",' + TX + '!$E:$E,"' + safe + '")'
        ]);
      });
      sh.getRange(2, 11, dRows.length, 3).setValues(dRows);
      sh.getRange(2, 11, 1, 3).setFontWeight('bold');
    }

    sh.setFrozenRows(2);
    return sh;
  }

  addChart(sh, type, range, title, row, col) {
    try {
      const chart = sh.newChart()
        .setChartType(type)
        .addRange(range)
        .setOption('title', title)
        .setPosition(row, col, 2, 2)
        .build();
      sh.insertChart(chart);
    } catch (e) {}
  }
}