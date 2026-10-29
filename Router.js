// ═══════════════ Router.gs — التوجيه + الأوامر (كامل — V30) ═══════════════
class ButtonRouter {
  constructor() {
    this.aliases = {};
    Object.keys(BUTTONS).forEach(k => { this.aliases[TextUtils.buttonKey(k)] = BUTTONS[k]; });
  }
  match(text) {
    if (!text) return null;
    const key = TextUtils.buttonKey(text);
    return Object.prototype.hasOwnProperty.call(this.aliases, key) ? this.aliases[key] : null;
  }
}

class CommandRegistry {
  constructor() { this.map = {}; }
  register(name, handler) { this.map[name] = handler; return this; }
  run(name, deps, msg, args) {
    const handler = this.map[name];
    if (!handler) {
      deps.telegram.send(msg.chat.id, I18n.t('unknownCmd', deps.lang.get()));
      deps.log.warn('COMMAND_UNKNOWN', name);
      return;
    }
    handler(deps, msg, args);
    deps.log.info('COMMAND', name + (args ? ' ' + args : ''),
      { updateId: msg.message_id, lang: deps.lang.get() });
  }
}

class UpdateDispatcher {
  constructor(deps) { this.deps = deps; }

  process(update) {
    const msg = update.message;
    if (!msg) return;
    if (String(msg.chat.id) !== String(this.deps.chatId)) return;
    if (this.deps.deduper.seen(update.update_id)) return;

    this.dispatch(msg, update.update_id);
    // ✅ العلامة بعد نجاح المعالجة — لو المعالجة وقعت، الرسالة بترجع تتسحب تاني
    this.deps.deduper.mark(update.update_id);
  }

  dispatch(msg, updateId) {
    this.deps.notifier.maybeNotify();

    const button = this.deps.buttons.match(msg.text);
    const kind = (msg.text && msg.text[0] === '/') ? 'command'
                : button ? 'button' : msg.text ? 'text'
                : msg.voice ? 'voice' : msg.photo ? 'photo' : 'other';

    if (kind === 'text' || kind === 'voice' || kind === 'photo') {
      this.deps.lang.set(this.deps.lang.detect(msg.text || msg.caption || ''));
    }
    const lang = this.deps.lang.get();

    this.deps.log.info('MSG_' + kind.toUpperCase(),
      String(msg.text || msg.caption || kind).slice(0, 80),
      { updateId: updateId, lang: lang });

    if (button) return this.deps.commands.run(button, this.deps, msg, '');

    if (msg.text && msg.text[0] === '/') {
      const parts = msg.text.split(' ');
      const cmd = parts[0].split('@')[0].replace('/', '').toLowerCase();
      return this.deps.commands.run(cmd, this.deps, msg, parts.slice(1).join(' '));
    }

    if (msg.text) return this.handleText(msg);
    if (msg.voice) return this.handleVoice(msg);
    if (msg.photo) return this.handlePhoto(msg);
    this.deps.telegram.send(msg.chat.id, I18n.t('unsupported', lang));
  }

  // 🔄 إعادة معالجة من طابور المحاولات — بدون فحص تكرار
  processRetry(msg) {
    const button = this.deps.buttons.match(msg.text);
    if (button) return this.deps.commands.run(button, this.deps, msg, '');
    if (msg.text && msg.text[0] === '/') {
      const parts = msg.text.split(' ');
      const cmd = parts[0].split('@')[0].replace('/', '').toLowerCase();
      return this.deps.commands.run(cmd, this.deps, msg, parts.slice(1).join(' '));
    }
    if (msg.text) return this.handleText(msg);
    if (msg.voice) return this.handleVoice(msg);
    if (msg.photo) return this.handlePhoto(msg);
  }

  // 💾 مزامنة الدرايف مرة واحدة في آخر الدورة
  flushBackup() {
    try { this.deps.backup.flushIfDirty(); }
    catch (e) { this.deps.log.warn('BACKUP', 'flush failed: ' + e); }
  }

  persistAndReply(msg, result) {
    const mid = msg.message_id;
    result.transactions.forEach(t => { t.messageId = mid; });   // 🔁 نفس معرف الرسالة على كل الصفوف

    // 🔒 نفس الرسالة متتسجلش مرتين أبداً — مهما حصل إعادة محاولة من الطابور
    if (this.deps.txRepo.existsByMessageId(mid)) {
      this.deps.log.info('TX_DUP_SKIP', 'message ' + mid + ' — متسجلة قبل كده، اتجاهلت عشان ميتكررش', { updateId: mid });
      this.deps.telegram.send(msg.chat.id, '✅ ' + I18n.t('dupSkipped', this.deps.lang.get()));
      return;
    }

    let text = this.deps.finance.save(result.transactions);
    if (result.runwayUntil) {                    // ✈️ عداد جاي مع معاملة دخل
      const end = DateUtils.normalizeIso(result.runwayUntil);
      const start = result.transactions.length ? result.transactions[0].date : DateUtils.today();
      this.deps.runway.set(start, end,
        result.transactions.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0));
      text += '\n\n✈️ ' + I18n.t('runwaySet', this.deps.lang.get(), { end: end });
    }
    this.deps.telegram.send(msg.chat.id, text);
    this.deps.log.info('TX_SAVED',
      result.transactions.map(t => t.category + '=' + t.amount).join(', '),
      { updateId: msg.message_id, lang: this.deps.lang.get() });
    this.deps.backup.markDirty();
  }

  handleText(msg) {
    // 🧠 الطبقة المحلية — صفر توكنز (بحماية: لو التوصيلة ناقصة البوت شغال عادي)
    const intent = this.deps.brain ? this.deps.brain.try(msg.text) : null;
    if (intent) {
      if (intent.type === 'greeting') {
        this.deps.telegram.send(msg.chat.id, I18n.t('greetingReply', this.deps.lang.get()));
        this.deps.log.info('LOCAL_GREETING', String(msg.text).slice(0, 40), { updateId: msg.message_id });
        return;
      }
      if (intent.type === 'command') {
        this.deps.log.info('LOCAL_REPORT', '→ /' + intent.cmd, { updateId: msg.message_id });
        return this.deps.commands.run(intent.cmd, this.deps, msg, '');
      }
      if (intent.type === 'tx') {
        intent.transactions.forEach(t => {
          if (!t.rawText) t.rawText = msg.text;
          t.messageId = msg.message_id;
        });
        this.deps.log.info('LOCAL_QUICK', String(msg.text).slice(0, 40), { updateId: msg.message_id });
        return this.persistAndReply(msg, { transactions: intent.transactions });
      }
    }

    // 🤖 نداء AI واحد شامل
    const result = this.deps.ai.processText(msg.text, msg.message_id);
    if (result.isTransaction && result.transactions.length) return this.persistAndReply(msg, result);
    if (result.runwayUntil) {                    // ✈️ جملة عداد من غير معاملة
      const end = DateUtils.normalizeIso(result.runwayUntil);
      this.deps.runway.set(DateUtils.today(), end, 0);
      this.deps.telegram.send(msg.chat.id, '✈️ ' + I18n.t('runwaySet', this.deps.lang.get(), { end: end }));
      return;
    }
    this.deps.telegram.send(msg.chat.id, result.reply || I18n.t('fallbackReply', this.deps.lang.get()));
    this.deps.log.info('AI_ANSWER', '', { updateId: msg.message_id, lang: this.deps.lang.get() });
  }

  handleVoice(msg) {
    // 🎙️ نداء واحد: تفريغ + استخراج مع بعض
    const out = this.deps.ai.processVoice(msg.voice.file_id, msg.message_id);
    msg.text = out.transcript || '[voice]';
    if (out.result.isTransaction && out.result.transactions.length) return this.persistAndReply(msg, out.result);
    if (!out.transcript) throw new BotError('EMPTY_AUDIO', 'لم أستطع قراءة الصوت / Could not read the voice.');
    this.deps.telegram.send(msg.chat.id, out.result.reply || I18n.t('fallbackReply', this.deps.lang.get()));
  }

  handlePhoto(msg) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    const result = this.deps.ai.extractReceipt(fileId, msg.caption, msg.message_id);
    if (result.transactions.length) return this.persistAndReply(msg, result);
    this.deps.telegram.send(msg.chat.id, result.reply || 'No clear amounts found 🤔');
  }
}

// ═══ تسجيل كل الأوامر ═══
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
        const line = d.finance.runwayLine();
        return send(d, m, line || I18n.t('runwayNone', lang), HTML);
      }
      if (['off', 'cancel', 'الغاء', 'إلغاء', 'وقف'].indexOf(parts[0].toLowerCase()) !== -1) {
        d.runway.closeAll();
        return send(d, m, I18n.t('runwayCancel', lang));
      }
      const end = DateUtils.normalizeIso(parts[parts.length - 1]);
      const start = parts.length > 1 ? DateUtils.normalizeIso(parts[0]) : DateUtils.today();
      d.runway.set(start, end, 0);
      send(d, m, '✈️ ' + I18n.t('runwaySet', lang, { end: end }));
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
      let text = '📂 <b>' + TextUtils.esc(cat) + ' — this month:</b>\n\n';
      rows.forEach(t => {
        total += t.amount;
        text += '• ' + t.date + ' — ' + TextUtils.fmt(t.amount) + ' ' + t.currency +
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
        '📁 Drive: ' + s.files + ' files — ' + s.sizeKB + ' KB total');
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
  let text = '🔧 <b>Debug — Version ' + CONFIG.VERSION + '</b>\n\n' +
    '🕒 ' + DateUtils.now() + '\n' +
    '📍 Offset: ' + (d.props.getProperty('POLL_OFFSET') || '0') + '\n' +
    '🌐 Lang: ' + d.lang.get() + '\n\n';
  try {
    const ok = ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'pollUpdates');
    text += ok ? '⏰ Poll trigger: ON ✓\n' : '⚠️ Poll trigger missing — run installPolling\n';
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
    d.log.info('TX_DUP_SKIP', 'debt cmd message ' + m.message_id + ' — متسجلة قبل كده', { updateId: m.message_id });
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