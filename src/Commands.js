// ═══════════════ أوامر التليجرام ═══════════════
// الطبقة: Routing · تسجيل الأوامر الثلاثين + تقارير الحالة + أوامر الديون اليدوية
function registerCommands(registry) {
  const send = (d, m, text, extra) => d.telegram.send(m.chat.id, text, extra);
  const HTML = { parse_mode: 'HTML' };

  registry
    .register('start',  (d, m) => send(d, m, MESSAGES.HELP[d.lang.get()] || MESSAGES.HELP.ar,
                                       Object.assign({ reply_markup: KEYBOARD }, HTML)))
    .register('help',   (d, m) => send(d, m, MESSAGES.HELP[d.lang.get()] || MESSAGES.HELP.ar,
                                       Object.assign({ reply_markup: KEYBOARD }, HTML)))
    .register('ping',   (d, m) => send(d, m, '🏓 Pong!'))
    .register('lang',   (d, m, a) => {
      const l = (a || '').trim().toLowerCase();
      if (l === 'ar' || l === 'en') {
        d.lang.set(l);
        send(d, m, l === 'ar' ? 'تمام، هستخدم العربي ✅' : 'OK, switching to English ✅');
      } else send(d, m, 'Usage: <code>/lang ar</code> or <code>/lang en</code>', HTML);
    })
    .register('today',  (d, m) => send(d, m, d.finance.today()))
    .register('week',   (d, m) => send(d, m, d.finance.week()))
    .register('month',  (d, m) => send(d, m, d.finance.month()))
    .register('stats',  (d, m) => send(d, m, d.finance.stats()))
    .register('top',    (d, m) => send(d, m, d.finance.topExpenses(), HTML))
    .register('budget', (d, m) => send(d, m, d.finance.budgetReport()))
    .register('runway', (d, m, a) => {
      const parts = String(a || '').trim().split(/\s+/).filter(String);
      const lang = d.lang.get();
      if (!parts.length) {
        // 📊 تقرير كامل: القبض والصرف والباقي، والعمود بيتصلح لوحده
        try { d.runway.refreshAmount(d.txRepo); } catch (e) {}
        const st = d.finance.runwayStatus();
        if (!st) return send(d, m, I18n.t('runwayNone', lang), HTML);
        return send(d, m, I18n.t('runwayReport', lang, {
          start: DateUtils.shortDate(st.start), end: DateUtils.shortDate(st.end),
          in: TextUtils.fmt(st.inSince), out: TextUtils.fmt(st.spentSince),
          left: TextUtils.fmt(st.remaining), daily: TextUtils.fmt(st.allowed),
          n: st.daysLeft, icon: st.icon
        }), HTML);
      }
      if (['off', 'cancel', 'الغاء', 'إلغاء', 'وقف'].indexOf(parts[0].toLowerCase()) !== -1) {
        d.runway.closeAll();
        return send(d, m, I18n.t('runwayCancel', lang));
      }
      const end = DateUtils.normalizeIso(parts[parts.length - 1]);
      const start = parts.length > 1 ? DateUtils.normalizeIso(parts[0]) : DateUtils.today();
      d.runway.set(start, end, 0);
      try { d.runway.refreshAmount(d.txRepo); } catch (e) {}   // 💵 Amount = القبض الفعلي مش صفر
      send(d, m, '✈️ ' + I18n.t('runwaySet', lang, { end: DateUtils.shortDate(end) }));
    })
    .register('debts',  (d, m) => send(d, m, d.finance.debtsReport(), HTML))
    .register('last',   (d, m) => send(d, m, d.finance.lastFive()))
    .register('undo',   (d, m) => {
      send(d, m, d.finance.undo());
      try { d.backup.syncTransactions(); } catch (e) {}
    })
    .register('search', (d, m, a) => send(d, m, d.finance.search(a), HTML))
    .register('category', (d, m, a) => {
      const cat = (a || '').trim();
      if (!cat) return send(d, m, 'Usage: <code>/category Food</code> or <code>/category Other</code>', HTML);
      const rows = d.txRepo.getAll().filter(t =>
        t.category.toLowerCase().indexOf(cat.toLowerCase()) !== -1 &&
        t.date.startsWith(DateUtils.month()));
      if (!rows.length) return send(d, m, '📂 No transactions in "' + cat + '" this month');

      let total = 0;
      let text = '📂 <b>' + TextUtils.esc(cat) + ' · this month:</b>\n\n';
      rows.forEach(t => {
        total += t.amount;
        text += '• ' + t.date + ' · ' + TextUtils.fmt(t.amount) + ' ' + t.currency +
                (t.note ? ' (' + TextUtils.esc(t.note) + ')' : '') + '\n';
      });
      text += '\n💰 <b>Total:</b> ' + TextUtils.fmt(total) + ' EGP';
      send(d, m, text, HTML);
    })
    .register('dashboard', (d, m) => {
      const sh = d.dashboard.build();
      send(d, m, '📊 ' + (d.lang.get() === 'ar' ? 'الداشبورد اتحدّث' : 'Dashboard refreshed') +
        ' 👇\n' + d.sheetUrl + '#gid=' + sh.getSheetId() + '\n\n' + d.finance.month());
    })
    .register('backup', (d, m) => {
      const n = d.backup.syncTransactions();
      const clean = d.backup.cleanup();
      const s = d.backup.stats();
      send(d, m, '🗜️ DB synced (gzip): ' + n + ' transactions\n' +
        '🧹 Cleanup: ' + clean.removed + ' old files\n' +
        '📁 Drive: ' + s.files + ' files · ' + s.sizeKB + ' KB total');
    })
    .register('status', (d, m) => send(d, m, statusReport(d), HTML))
    .register('debug',  (d, m) => send(d, m, debugReport(d), HTML))
    .register('doctor', (d, m) => doctor())   // 🩺 الفحص الشامل بقى أمر تليجرام
    .register('export', (d, m) => d.telegram.sendDocument(
        m.chat.id, Utilities.newBlob('\uFEFF' + d.finance.toCsv(), 'text/csv', 'expenses.csv'), '📤 All transactions'))
    .register('getprompt', (d, m, a) => {
      const key = (a || '').trim() || CONFIG.PROMPT_KEY;
      let body = d.prompts.get(key, 'not found');
      if (body.length > 3500) body = body.slice(0, 3500) + '\n…';
      send(d, m, '📝 Prompt for <b>' + TextUtils.esc(key) + '</b>:\n\n<pre>' + TextUtils.esc(body) + '</pre>', HTML);
    })
    .register('setprompt', (d, m, a) => {
      if (!a || a.indexOf(' ') === -1) {
        send(d, m, 'Usage:\n<code>/setprompt ' + CONFIG.PROMPT_KEY + ' new instructions here</code>', HTML);
      } else {
        const k = a.split(' ')[0];
        d.prompts.set(k, a.substring(k.length + 1));
        send(d, m, '✅ Prompt <b>' + TextUtils.esc(k) + '</b> updated!', HTML);
      }
    })
    .register('lent',        (d, m, a) => recordDebt(d, m, a, 'loan_out'))
    .register('borrowed',    (d, m, a) => recordDebt(d, m, a, 'loan_in'))
    .register('repaid',      (d, m, a) => recordDebt(d, m, a, 'repay_out'))
    .register('collected',   (d, m, a) => recordDebt(d, m, a, 'repay_in'))
    .register('lentold',     (d, m, a) => recordDebt(d, m, a, 'loan_out_off'))
    .register('borrowedold', (d, m, a) => recordDebt(d, m, a, 'loan_in_off'));
}

function statusReport(d) {
  return '⚡ <b>System Status</b>\n\n' +
    '📌 Version: ' + CONFIG.VERSION + '\n' +
    '🤖 Model: ' + CONFIG.MODEL + '\n' +
    '📥 Mode: Polling (1 min + hot session)\n' +
    '🌐 Language: ' + d.lang.get() + '\n' +
    '📊 Transactions: ' + d.txRepo.getAll().length + '\n' +
    '📂 Log entries: ' + d.log.count() + '\n' +
    '💾 Drive DB: ' + (function () { const s = d.backup.stats(); return s.files + ' files, ' + s.sizeKB + ' KB'; })() + '\n' +
    '🕒 Timezone: ' + DateUtils.tz;
}

function debugReport(d) {
  let text = '🔧 <b>Debug · Version ' + CONFIG.VERSION + '</b>\n\n' +
    '🕒 ' + DateUtils.now() + '\n' +
    '📍 Offset: ' + (d.props.getProperty('POLL_OFFSET') || '0') + '\n' +
    '🌐 Lang: ' + d.lang.get() + '\n\n';
  try {
    const ok = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'pollUpdates');
    text += ok ? '⏰ Poll trigger: ON ✓\n' : '⚠️ Poll trigger missing, run installPolling\n';
  } catch (e) {}
  text += d.brain ? '🧠 Local brain: ON ✓\n' : '⚠️ Brain not wired\n';
  try {
    const wi = d.telegram.getWebhookInfo();
    text += (wi.result && wi.result.url) ? '⚠️ Webhook still active!\n' : '🌐 No webhook (correct) ✓\n';
  } catch (e) { text += '🌐 Webhook check failed\n'; }
  try { text += '📊 TX: ' + d.txRepo.getAll().length + ' ✓\n'; } catch (e) { text += '📊 Sheet read failed\n'; }
  const recent = d.log.recent(6);
  if (recent.length) {
    text += '\n📂 Last ' + recent.length + ' log events:\n';
    recent.forEach(r => {
      const t = (r[0] instanceof Date) ? Utilities.formatDate(r[0], DateUtils.tz, 'MM-dd HH:mm:ss') : String(r[0]);
      text += '• ' + t + ' [' + String(r[1]) + '] ' + TextUtils.esc(String(r[2]).slice(0, 40)) + '\n';
    });
  } else text += '\n📂 Log empty ✓\n';
  return text;
}

// ═══ أوامر الديون اليدوية ═══
const DEBT_CMDS = {
  loan_out: 'lent', loan_in: 'borrowed', repay_out: 'repaid', repay_in: 'collected',
  loan_out_off: 'lentold', loan_in_off: 'borrowedold'
};

function recordDebt(d, m, args, kind) {
  const entry = parseDebtEntry(args);
  if (!entry) {
    d.telegram.send(m.chat.id,
      I18n.t('debtCmdUsage', d.lang.get(), { cmd: '/' + DEBT_CMDS[kind] }),
      { parse_mode: 'HTML' });
    return;
  }
  // 🔒 نفس أمر الدين مش هيـتسجل مرتين (إعادة محاولة من الطابور مثلاً)
  if (d.txRepo.existsByMessageId(m.message_id)) {
    d.log.info('TX_DUP_SKIP', 'debt cmd message ' + m.message_id + ' متسجلة قبل كده', { updateId: m.message_id });
    return;
  }
  const tx = new Transaction({
    date: entry.date, amount: entry.amount, kind: kind,
    category: entry.name, rawText: m.text, messageId: m.message_id
  });
  d.telegram.send(m.chat.id, d.finance.save([tx]));
  d.backup.markDirty();
  d.log.info('DEBT_CMD', kind + ' | ' + entry.name + '=' + entry.amount + ' | ' + entry.date,
             { updateId: m.message_id, lang: d.lang.get() });
}

function parseDebtEntry(args) {
  const latin = String(args || '').replace(/[٠-٩]/g, function (c) {
    return String('٠١٢٣٤٥٦٧٨٩'.indexOf(c));
  });
  const tokens = latin.trim().split(/\s+/).filter(String);
  if (tokens.length < 2) return null;
  let name = [], amount = null, date = null;
  for (let i = 0; i < tokens.length; i++) {
    const tk = tokens[i];
    if (amount === null && /^\d+([.,]\d+)?$/.test(tk)) { amount = Number(tk.replace(',', '.')); continue; }
    if (amount !== null && /^\d{4}-\d{1,2}-\d{1,2}$/.test(tk)) { date = DateUtils.normalizeIso(tk); continue; }
    if (amount === null) name.push(tk);
    else return null;
  }
  if (!name.length || amount === null || amount <= 0) return null;
  return { name: name.join(' '), amount: amount, date: date || DateUtils.today() };
}
