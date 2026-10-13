// ═══════════════ الداتابيز المضغوطة: gzip + المهم بس + Retention ═══════════════
class BackupService {
  constructor(txRepo, props) { this.tx = txRepo; this.props = props; }

  folder() {
    const id = this.props.getProperty('DB_FOLDER_ID');
    if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
    const it = DriveApp.getFoldersByName(CONFIG.BACKUP.FOLDER_NAME);
    const folder = it.hasNext() ? it.next() : DriveApp.createFolder(CONFIG.BACKUP.FOLDER_NAME);
    this.props.setProperty('DB_FOLDER_ID', folder.getId());
    return folder;
  }

  // كتابة مضغوطة: بترمي القديم وتكتب .gz جديد
  // (الشيت هو المصدر الحقيقي للداتا — فالاستبدال آمن 100%)
  writeCompressed(baseName, content) {
    const folder = this.folder();
    const gzName = baseName + '.gz';
    const it = folder.getFilesByName(gzName);
    while (it.hasNext()) it.next().setTrashed(true);
    const blob = Utilities.gzip(
      Utilities.newBlob(content, 'application/json', baseName), gzName);
    folder.createFile(blob);
  }

  writeFilePlain(name, content) {
    const folder = this.folder();
    const it = folder.getFilesByName(name);
    const file = it.hasNext() ? it.next() : folder.createFile(name, '', 'application/json');
    file.setContent(content);
  }

  // ── المعاملات: الداتا الكاملة — مضغوطة وبتتحدث مع كل عملية ──
  syncTransactions() {
    const rows = this.tx.getAll();
    const lines = rows.map(t => JSON.stringify(this.toRecord(t)));
    this.writeCompressed(CONFIG.BACKUP.TX_FILE, lines.join('\n'));
    this.writeFilePlain(CONFIG.BACKUP.META_FILE, JSON.stringify({
      last_sync: DateUtils.now(), transactions: rows.length, version: CONFIG.VERSION
    }, null, 2));
    return rows.length;
  }

  toRecord(t) {
    return {
      date: t.date, amount: t.amount, currency: t.currency, type: t.kind,
      category: t.category, note: t.note, original: t.rawText,
      message_id: t.messageId,
      created_at: t.createdAt instanceof Date
        ? Utilities.formatDate(t.createdAt, DateUtils.tz, "yyyy-MM-dd'T'HH:mm:ss")
        : String(t.createdAt)
    };
  }

  // ── أرشيف اللوق: المهم بس (ERROR/WARN) — ملف شهري واحد مضغوط ──
  // لو الدفعة كلها INFO → مفيش كتابة أصلاً
  archiveLog(rows) {
    try {
      const important = rows.filter(r => CONFIG.BACKUP.ARCHIVE_LEVELS.indexOf(r[1]) !== -1);
      if (!important.length) return;

      const baseName = CONFIG.BACKUP.LOG_PREFIX + DateUtils.month() + '.jsonl';
      let content = '';
      const it = this.folder().getFilesByName(baseName + '.gz');
      if (it.hasNext()) {
        content = Utilities.ungzip(it.next().getBlob()).getDataAsString();
        if (content) content += '\n';
      }

      const newLines = important.map(r => JSON.stringify({
        timestamp: r[0] instanceof Date
          ? Utilities.formatDate(r[0], DateUtils.tz, "yyyy-MM-dd'T'HH:mm:ss") : r[0],
        level: r[1], event: r[2], status: r[3],
        update_id: r[4], lang: r[5], details: r[6], raw: r[7]
      }));
      this.writeCompressed(baseName, content + newLines.join('\n'));
    } catch (e) { /* الأرشيف عمره ما يكسر التشغيل */ }
  }

  // ── التنظيف الدوري: أرشيف أقدم من سنة + ملفات النسخة القديمة غير المضغوطة ──
  cleanup() {
    try {
      const folder = this.folder();
      const cutoff = DateUtils.month(-CONFIG.BACKUP.LOG_ARCHIVE_MONTHS);
      let removed = 0, bytes = 0;
      const files = folder.getFiles();
      while (files.hasNext()) {
        const f = files.next();
        const name = f.getName();
        // 1) أرشيف لوق قديم (المقارنة النصية yyyy-MM شغالة صح)
        if (name.indexOf(CONFIG.BACKUP.LOG_PREFIX) === 0 && name.indexOf('.gz') !== -1) {
          const month = name.replace(CONFIG.BACKUP.LOG_PREFIX, '').replace('.jsonl.gz', '');
          if (month && month < cutoff) { bytes += f.getSize(); f.setTrashed(true); removed++; continue; }
        }
        // 2) ملفات النسخة القديمة (transactions.jsonl غير المضغوط + log_batch_*)
        if (name === CONFIG.BACKUP.TX_FILE ||
            (name.indexOf('log_batch_') === 0 && name.indexOf('.jsonl') !== -1)) {
          bytes += f.getSize(); f.setTrashed(true); removed++;
        }
      }
      return { removed: removed, freedKB: Math.round(bytes / 1024) };
    } catch (e) {
      return { removed: 0, freedKB: 0, error: String(e) };
    }
  }

  stats() {
    const files = this.folder().getFiles();
    let count = 0, bytes = 0;
    while (files.hasNext()) { const f = files.next(); count++; bytes += f.getSize(); }
    return { files: count, sizeKB: Math.round(bytes / 1024 * 10) / 10 };
  }
    // 💾 Debounce: علامة "في جديد" والمزامنة الحقيقية مرة واحدة في آخر الدورة
  markDirty() { this._dirty = true; }
  flushIfDirty() {
    if (!this._dirty) return;
    this._dirty = false;
    this.syncTransactions();
  }
}