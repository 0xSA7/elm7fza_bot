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
    try {
      const started = Date.now();
      let offset = Number(this.props.getProperty('POLL_OFFSET') || 0);
      let timeoutSec = 0;   // أول فحص فوري — لو فاضي نقفل بسرعة

      for (;;) {
        const updates = this.telegram.getUpdates(offset, CONFIG.POLLING.LIMIT, timeoutSec);
        if (!updates.length) break;

        updates.forEach(upd => {
          try {
            this.dispatcher.process(upd);
          } catch (err) {
            if (isTransient(err)) {
              // ⏳ جيميناي overloaded → طابور، مش فشل نهائي
              this.retryQueue.enqueue(upd, err);
            } else {
              this.reportError(err, upd);
            }
          }
          offset = upd.update_id + 1;
          this.props.setProperty('POLL_OFFSET', String(offset));
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
      try { this.retryQueue.processDue(this.dispatcher); }
      catch (e) { this.log.error('RETRY_CYCLE: ' + e, 'خطأ في معالجة الطابور', ''); }
      this.dispatcher.flushBackup();   // 💾 مزامنة واحدة للدورة كلها
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