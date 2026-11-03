// ═══════════════ توجيه الرسايل ═══════════════
// الطبقة: Routing · أزرار/أوامر/نص/صوت/صورة + محرك التعديل والمسح بالريبلاي
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
    // ✅ العلامة بعد نجاح المعالجة، لو المعالجة وقعت الرسالة بترجع تتسحب تاني
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

    if (msg.text) return this.routeText(msg);
    if (msg.voice) return this.handleVoice(msg);
    if (msg.photo) return this.handlePhoto(msg);
    this.deps.telegram.send(msg.chat.id, I18n.t('unsupported', lang));
  }

  // 🔄 إعادة معالجة من طابور المحاولات، بدون فحص تكرار
  processRetry(msg) {
    const button = this.deps.buttons.match(msg.text);
    if (button) return this.deps.commands.run(button, this.deps, msg, '');
    if (msg.text && msg.text[0] === '/') {
      const parts = msg.text.split(' ');
      const cmd = parts[0].split('@')[0].replace('/', '').toLowerCase();
      return this.deps.commands.run(cmd, this.deps, msg, parts.slice(1).join(' '));
    }
    if (msg.text) return this.routeText(msg);   // ♻️ التعديل بالريبلاي شغال من الطابور كمان
    if (msg.voice) return this.handleVoice(msg);
    if (msg.photo) return this.handlePhoto(msg);
  }

  // ♻️ مسار النص: ريبلاي على رسالة متسجلة عندك = تعديل/مسح، مش إضافة جديدة
  routeText(msg) {
    if (msg.reply_to_message &&
        this.deps.txRepo.findByMessageId(msg.reply_to_message.message_id).length)
      return this.handleEditReply(msg);
    return this.handleText(msg);
  }

  // ♻️♻️ التعديل بالريبلاي: Reply على رسالتك القديمة واكتب التصحيح:
  //    «كشف امي كان ب 600 مش 200» → الحركات القديمة تتشال والصح يتسجل مكانها،
  //    وريبلاي بـ «امسح» → الحركة تتشال خلاص والفلوس ترجع في كل الحسابات فوراً.
  //    الرسالة الأصلية (رقمها) تفضل هي مرجع المجموعة، فتنفع تعمل ريبلاي تاني وتعدل تاني.
  handleEditReply(msg) {
    const rootMid = msg.reply_to_message.message_id;
    const originals = this.deps.txRepo.findByMessageId(rootMid);
    if (!originals.length) return false;      // الرسالة دي مش مصدر حركات → مسار عادي
    const lang = this.deps.lang.get();

    this.deps.log.info('MSG_EDIT',
      String(msg.text).slice(0, 60) + ' ⇐ ' + originals.length + ' صفوف',
      { updateId: msg.message_id, lang: lang });

    // 🗑️ «امسح» بالريبلاي = شيل حركات الرسالة دي كلها
    if (isDeleteIntent(msg.text)) return this.applyDeleteReply(msg, originals);

    // 🧠 تصحيح بصيغة سريعة («600 دوا»)، صفر توكنز
    const intent = this.deps.brain ? this.deps.brain.try(msg.text) : null;
    if (intent && intent.type === 'tx' && intent.transactions.length) {
      const refDate = originals[originals.length - 1].tx.date;   // نحافظ على تاريخ الأصل
      intent.transactions.forEach(t => {
        t.date = refDate;
        t.messageId = rootMid;
        if (!t.rawText) t.rawText = this.editRawText(originals, msg);
      });
      this.deps.log.info('EDIT_LOCAL', String(msg.text).slice(0, 40), { updateId: msg.message_id });
      return this.applyEdit(msg, { transactions: intent.transactions }, originals);
    }

    // 🤖 تصحيح حر: AI بسياق الأصل كامل ببيحسب المجموعة الجديدة كاملة
    const result = this.deps.ai.processCorrection(
      msg.text,
      originals[0].tx.rawText || String(msg.reply_to_message.text || ''),
      originals.map(o => o.tx), msg.message_id);
    if (result.transactions.length) return this.applyEdit(msg, result, originals);

    // ⚠️ مفهوش تعديل واضح، القديم زي ما هو بالظبط (مفيش أي حاجة اتشالت)
    const note = result.reply ? String(result.reply).slice(0, 300) : I18n.t('editUnclear', lang);
    this.deps.telegram.send(msg.chat.id, '🤔 ' + note);
    return true;
  }

  editRawText(originals, msg) {
    const base = (originals[0] && originals[0].tx.rawText) ||
                 String(msg.reply_to_message.text || '');
    return String(base).slice(0, 200) + ' | تصحيح: ' + String(msg.text).slice(0, 120);
  }

  applyEdit(msg, result, originals) {
    const rootMid = msg.reply_to_message.message_id;
    const lang = this.deps.lang.get();
    result.transactions.forEach(t => {
      t.messageId = rootMid;                       // 💬 الأصل يفضل مرجع المجموعة
      if (!t.rawText) t.rawText = this.editRawText(originals, msg);
    });

    // 🔁 إعادة محاولة من الطابور؟ القديم الحالي هو نتيجة التعديل السابق:
    //    بنشيله وبنحط الجديد → نفس النتيجة مهما اتكرر (idempotent)
    this.deps.txRepo.deleteRows(this.deps.txRepo.findByMessageId(rootMid));

    result.transactions.forEach(t => this.deps.txRepo.add(t));

    let text = '♻️ ' + I18n.t('editDone', lang, { n: result.transactions.length }) + ':\n' +
      result.transactions.map(t => t.displayLine(lang)).join('\n');
    const rw = this.deps.finance.runwayLine();
    if (rw) text += '\n\n' + rw;
    this.deps.telegram.send(msg.chat.id, text);
    this.deps.log.info('TX_EDIT',
      result.transactions.map(t => t.category + '=' + t.amount).join(', '),
      { updateId: rootMid, lang: lang });
    this.deps.backup.markDirty();
    this.refreshRunwayAmount();
    return true;
  }

  applyDeleteReply(msg, originals) {
    const lang = this.deps.lang.get();
    this.deps.txRepo.deleteRows(originals);

    let text = '🗑️ ' + I18n.t('editDeleted', lang) + ':\n' +
      originals.map(o => o.tx.displayLine(lang)).join('\n');
    const rw = this.deps.finance.runwayLine();
    if (rw) text += '\n\n' + rw;
    this.deps.telegram.send(msg.chat.id, text);
    this.deps.log.info('TX_EDIT_DELETE', originals.length + ' صفوف اتشالت والفلوس رجعت',
      { updateId: msg.reply_to_message.message_id, lang: lang });
    this.deps.backup.markDirty();
    this.refreshRunwayAmount();
    return true;
  }

  // 💵 عمود Amount في شيت الـ Runway = القبض الفعلي بعد كل تغيير
  refreshRunwayAmount() {
    try { this.deps.runway.refreshAmount(this.deps.txRepo); } catch (e) {}
  }

  // 🛡️ هل الرسالة دي هتروح للـ AI؟ (صوت/صورة/نص العقل المحلي مش فاهمه)
  //    محرك السحب بيسأل قبل المعالجة عشان يحجز الرسالة في طابور المحاولات
  //    قبل النداء، فلو التنفيذ اتقتل عند حد الـ ٦ دقايق ماتضيعش
  needsSlowAi(update) {
    const msg = update && update.message;
    if (!msg) return false;
    if (String(msg.chat.id) !== String(this.deps.chatId)) return false;
    if (msg.voice || msg.photo) return true;              // 🎙️📸 دايماً AI
    if (!msg.text) return false;
    if (msg.text[0] === '/' || this.deps.buttons.match(msg.text)) return false;
    const intent = this.deps.brain ? this.deps.brain.try(msg.text) : null;
    return !intent;                                        // مش محلولة محلياً → AI
  }

  // 💾 مزامنة الدرايف مرة واحدة في آخر الدورة
  flushBackup() {
    try { this.deps.backup.flushIfDirty(); }
    catch (e) { this.deps.log.warn('BACKUP', 'flush failed: ' + e); }
  }

  persistAndReply(msg, result) {
    const mid = msg.message_id;
    result.transactions.forEach(t => { t.messageId = mid; });   // 🔁 نفس معرف الرسالة على كل الصفوف

    // 🔒 نفس الرسالة متتسجلش مرتين أبداً، مهما حصل إعادة محاولة من الطابور
    if (this.deps.txRepo.existsByMessageId(mid)) {
      this.deps.log.info('TX_DUP_SKIP', 'message ' + mid + ' متسجلة قبل كده، اتجاهلت عشان ميتكررش', { updateId: mid });
      this.deps.telegram.send(msg.chat.id, '✅ ' + I18n.t('dupSkipped', this.deps.lang.get()));
      return;
    }

    let text = this.deps.finance.save(result.transactions);
    if (result.runwayUntil) {                    // ✈️ عداد جاي مع معاملة دخل
      const end = DateUtils.normalizeIso(result.runwayUntil);
      const start = result.transactions.length ? result.transactions[0].date : DateUtils.today();
      this.deps.runway.set(start, end,
        result.transactions.filter(t => t.kind === 'income').reduce((s, t) => s + t.amount, 0));
      text += '\n\n✈️ ' + I18n.t('runwaySet', this.deps.lang.get(), { end: DateUtils.shortDate(end) });
    }
    this.deps.telegram.send(msg.chat.id, text);
    this.deps.log.info('TX_SAVED',
      result.transactions.map(t => t.category + '=' + t.amount).join(', '),
      { updateId: msg.message_id, lang: this.deps.lang.get() });
    this.deps.backup.markDirty();
    this.refreshRunwayAmount();   // 💵 القبض الفعلي يتكتب في شيت الـ Runway مع كل حفظ
  }

  handleText(msg) {
    // 🧠 الطبقة المحلية: صفر توكنز (بحماية: لو التوصيلة ناقصة البوت شغال عادي)
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
      this.deps.telegram.send(msg.chat.id, '✈️ ' + I18n.t('runwaySet', this.deps.lang.get(), { end: DateUtils.shortDate(end) }));
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

// 🗑️ هل الريبلاي طلب مسح؟ شرط صارم عشان مايمسحش بالغلط:
//    من غير أي أرقام + أول كلمة من كلمات المسح + كلام قصير (الباقي سيبه للـ AI)
const DELETE_WORDS = ['امسح', 'امسحي', 'امسحها', 'احذف', 'احذفي', 'احذفها', 'الغي', 'الغها',
  'الغاء', 'إلغاء', 'اسحب', 'اسحبها', 'كان غلط', 'غلطان', 'متسجلش', 'متبصش', 'مكرر', 'متكرر',
  'delete', 'remove', 'cancel', 'void'];

function isDeleteIntent(text) {
  const t = String(text || '')
    .trim().toLowerCase()
    .replace(/[!؟?\.،,:]/g, ' ')
    .replace(/\s+/g, ' ');
  if (!t || /[0-9٠-٩]/.test(t)) return false;   // فيه رقم → ده تصحيح مش مسح
  if (t.length > 40) return false;              // كلام طويل → يروح للـ AI يفهمه
  const first = t.split(' ')[0];
  return DELETE_WORDS.indexOf(first) !== -1 || DELETE_WORDS.indexOf(t) !== -1;
}

