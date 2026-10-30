// ═══════════════ محرك السحب + الجلسة الساخنة + طابور المحاولات ═══════════════
class PollingEngine {
  constructor(props, telegram, dispatcher, log, chatId, retryQueue) {
    this.props = props;
    this.telegram = telegram;
    this.dispatcher = dispatcher;
    this.log = log;
    this.chatId = chatId;
    this.retryQueue = retryQueue;
  }

  poll() {
    // 🔒 قفل عالمي: دورة واحدة بس في نفس اللحظة — عشان الرسالة ماتتعالجش مرتين
    //    (الـ AI ممكن ياخد دقايق وهو مشغول — من غير القفل دورة تانية بترجع تسحب نفس الرسالة)
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(0)) return;   // في دورة شغالة بالفعل — نمشي في سلام
    try {
      const started = Date.now();
      let offset = Number(this.props.getProperty('POLL_OFFSET') || 0);
      let timeoutSec = 0;   // أول فحص فوري — لو فاضي نقفل بسرعة

      for (;;) {
        const updates = this.telegram.getUpdates(offset, CONFIG.POLLING.LIMIT, timeoutSec);
        if (!updates.length) break;

        updates.forEach(upd => {
          // 🔁 نأكد السحب ل تليجرام قبل المعالجة — أي دورة تانية متجيبش نفس الرسالة،
          //    ولو المعالجة وقعت الرسالة بتنزل الطابور (12 ساعة) مش بتضيع
          offset = upd.update_id + 1;
          this.props.setProperty('POLL_OFFSET', String(offset));

          // 🛡️ حجز مسبق قبل أي نداء AI — لو التنفيذ اتقتل عند حد الـ ٦ دقايق
          //    (جيميني معلّقة بدقايق) الرسالة بتفضل محفوظة في شيت الطابور،
          //    والدورة الجاية بتحاولها تاني — مفيش رسالة تموت في السكوت تاني
          const slowAi = this.dispatcher.needsSlowAi(upd);
          if (slowAi) this.retryQueue.ensureRow(upd);
          try {
            this.dispatcher.process(upd);
            if (slowAi) this.retryQueue.removeRow(upd.update_id);   // ✅ تمّت — نمسح الحجز
          } catch (err) {
            if (isTransient(err)) {
              // ⏳ جيميناي overloaded / شبكة → طابور، مش فشل نهائي
              this.retryQueue.enqueue(upd, err);
            } else {
              this.reportError(err, upd);
            }
          }
        });

        if (Date.now() - started >= CONFIG.POLLING.MAX_SESSION_MS) break;
        timeoutSec = CONFIG.POLLING.LONG_POLL_SEC;   // 🌡️ جلسة ساخنة
      }
    } catch (e) {
      if (e && e.isConcurrentPoll) return;
      if (e && e.isWebhookConflict) {
        try { this.telegram.deleteWebhook(false); } catch (x) {}
        return;
      }
      this.log.error('POLL: ' + ((e && e.message) || e), 'خطأ في دورة السحب', '');
    } finally {
      // ⏳ الطابور جوه نفس القفل — مفيش محاولتين متوازيتين على نفس الرسالة أبداً
      try { this.retryQueue.processDueLocked(this.dispatcher); }
      catch (e) { this.log.error('RETRY_CYCLE: ' + e, 'خطأ في معالجة الطابور', ''); }
      this.dispatcher.flushBackup();   // 💾 مزامنة واحدة للدورة كلها
      lock.releaseLock();             // 🔒 فتح القفل في كل الحالات
    }
  }

  reportError(err, upd) {
    const userMsg = (err && err.userMsg) || 'حدث خطأ مؤقت في المعالجة.';
    const tech = (err && err.userMsg) ? '' :
      '\n🔧 ' + String((err && err.message) || err).slice(0, 120);
    this.log.error((err && (err.stack || err.message)) || String(err), userMsg,
                   JSON.stringify(upd).slice(0, 300));
    try { this.telegram.send(this.chatId, '🚨 ' + userMsg + tech); } catch (x) {}
  }

  install() {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === 'pollUpdates') ScriptApp.deleteTrigger(t);
    });
    this.telegram.deleteWebhook(true);
    if (!this.props.getProperty('POLL_OFFSET')) this.props.setProperty('POLL_OFFSET', '0');
    ScriptApp.newTrigger('pollUpdates').timeBased().everyMinutes(1).create();
    this.telegram.send(this.chatId,
      '📥 <b>نظام السحب شغال ✅</b>\n+ طابور محاولات تلقائي لو الـ AI اتعطل.',
      { parse_mode: 'HTML' });
  }

  uninstall() {
    ScriptApp.getProjectTriggers().forEach(t => {
      if (t.getHandlerFunction() === 'pollUpdates') ScriptApp.deleteTrigger(t);
    });
  }
}