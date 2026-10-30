// ═══════════════ طابور المحاولات التلقائية ═══════════════
// لو جيميناي عليها ضغط (429/503): الرسالة بتتحفظ هنا بدل ما تفشل نهائياً،
// وبتتحاول تاني بتباعد تدريجي لحد ١٢ ساعة — والإشعار بيوصلك لوحده.
class RetryQueue extends SheetRepository {
  constructor(telegram, chatId, log, lang) {
    super(CONFIG.SHEETS.RETRY, CONFIG.RETRY_HEADERS);
    this.telegram = telegram;
    this.chatId = chatId;
    this.log = log;
    this.lang = lang;
  }

  // 🛡️ حجز مسبق قبل نداء الـ AI: الرسالة بتيجي هنا الأول قبل ما ندّي، ولو
  //    التنفيذ اتقتل عند حد الـ ٦ دقايق (جيميني معلّقة) الدورة الجاية
  //    بلاقيها هنا وبتحاولها تاني — يعني مفيش رسالة تموت في السكوت مهما حصل
  ensureRow(update) {
    try {
      if (this.findRow(update.update_id) !== -1) return;   // محجوزة قبل كده
      this.append([
        update.update_id,
        JSON.stringify(update.message),
        0,
        new Date(),
        new Date()          // معادها حالاً — أول دورة بعد أي موت مفاجئ بتشدّها
      ]);
      this.log.info('AI_PENDING', 'حجز مسبق — الرسالة في أمان لو التنفيذ وقع', { updateId: update.update_id });
    } catch (e) {
      this.log.error('AI_PENDING: ' + e, 'فشل الحجز المسبق', '');
    }
  }

  // ✅ المعالجة نجحت خلاص — نمسح الحجز (لو موجود) عشان الطابور ميتكدسش
  removeRow(updateId) {
    try {
      const row = this.findRow(updateId);
      if (row !== -1) this.open().deleteRow(row);
    } catch (e) {}
  }

  // إضافة رسالة فاشلة — مع إشعار واضح مرة واحدة بس
  enqueue(update, err) {
    try {
      const existing = this.findRow(update.update_id);
      if (existing === -1) {
        this.append([
          update.update_id,
          JSON.stringify(update.message),
          0,
          new Date(),
          new Date(Date.now() + CONFIG.RETRY.INTERVAL_MS)
        ]);
      } else {
        // 🛡️ الحجز المسبق موجود — المحاولة دي فشلت بسرعة (429/شبكة):
        //    نأجل معادها بمقدار الفترة الأساسية ونبعت الإشعار مرة واحدة
        this.open().getRange(existing, 5).setValue(new Date(Date.now() + CONFIG.RETRY.INTERVAL_MS));
      }
      const why = String((err && err.message) || err || 'unknown').slice(0, 120);
      this.log.warn('RETRY_QUEUED', 'اتأجّل: ' + why, { updateId: update.update_id });
      this.telegram.send(this.chatId, I18n.t('aiBusyQueued', this.lang.get()));
    } catch (e) {
      this.log.error('RETRY_ENQUEUE: ' + e, 'فشل الإضافة للطابور', '');
    }
  }

  findRow(updateId) {
    const rows = this.readAll();
    for (let i = 0; i < rows.length; i++) {
      if (Number(rows[i][0]) === Number(updateId)) return i + 2;
    }
    return -1;
  }

  // معالجة المستحق — بقفل عشان تنفيذين متوازيين ميعملوش نفس الرسالة مرتين
  processDue(dispatcher) {
    const lock = LockService.getScriptLock();
    if (!lock.tryLock(2000)) return;   // تنفيذ تاني شغّال فيها — تمام كده
    try {
      this.processDueLocked(dispatcher);
    } finally {
      lock.releaseLock();
    }
  }

  processDueLocked(dispatcher) {
    const sh = this.open();
    const last = sh.getLastRow();
    if (last < 2) return;
    const data = sh.getRange(2, 1, last - 1, this.headers.length).getValues();
    const now = Date.now();
    let handled = 0;

    // بالعكس من تحت لفوق — عشان المسح ميبوظش المؤشرات
    for (let i = data.length - 1; i >= 0 && handled < CONFIG.RETRY.MAX_PER_CYCLE; i--) {
      const rowIdx = i + 2;
      const updateId = Number(data[i][0]);
      const nextTry = new Date(data[i][4]).getTime();
      if (isNaN(nextTry) || nextTry > now) continue;       // لسه معادهاش

      const firstTry = new Date(data[i][3]).getTime();
      const attempts = Number(data[i][2]) || 0;
      handled++;

      // عدّى الـ ١٢ ساعة؟ نستلم ونبلغ
      if (now - firstTry > CONFIG.RETRY.MAX_WAIT_MS) {
        this.finishRow(rowIdx, 'RETRY_TIMEOUT', attempts);
        this.telegram.send(this.chatId, I18n.t('retryTimeout', this.lang.get()));
        continue;
      }

      try {
        dispatcher.processRetry(JSON.parse(String(data[i][1])));
        // ✅ نجحت — رسالة "اتسجلت" اتبعتت من مسار الحفظ نفسه
        this.finishRow(rowIdx, 'RETRY_DONE', attempts);
      } catch (err) {
        if (isTransient(err)) {
          if (now - firstTry > CONFIG.RETRY.MAX_WAIT_MS) {
            this.finishRow(rowIdx, 'RETRY_TIMEOUT', attempts);
            this.telegram.send(this.chatId, I18n.t('retryTimeout', this.lang.get()));
          } else {
            sh.getRange(rowIdx, 3).setValue(attempts + 1);
            // ⏱️ Exponential backoff: دقيقة، دقيقتين، 3، 4، ثم سقف ٣٠ دقيقة
            const backoffMs = Math.min(CONFIG.RETRY.INTERVAL_MS * (attempts + 1), 1800000);
            sh.getRange(rowIdx, 5).setValue(new Date(now + backoffMs));
          }
        } else {
          // خطأ حقيقي مختلف — مفيش إعادة محاولة
          this.finishRow(rowIdx, 'RETRY_FAILED', attempts);
          const userMsg = (err && err.userMsg) || 'حدث خطأ في المعالجة.';
          this.log.error((err && (err.stack || err.message)) || String(err),
                         'retry failed permanently', String(data[i][1]).slice(0, 200));
          this.telegram.send(this.chatId, '🚨 ' + userMsg);
        }
      }
    }
  }

  finishRow(rowIdx, event, attempts) {
    try { this.open().deleteRow(rowIdx); } catch (e) {}
    this.log.info(event, attempts + ' attempts');
  }
}