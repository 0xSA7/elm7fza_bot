// ═══════════════ طبقة التواصل مع تليجرام — مسؤوليتها الوحيدة: الـ API ═══════════════
class TelegramClient {
  constructor(token, logRepo) {
    this.token = token;
    this.log = logRepo;
    this.baseUrl = 'https://api.telegram.org/bot' + token + '/';
    this.fileUrl = 'https://api.telegram.org/file/bot' + token + '/';
  }

  request(method, payload) {
    return UrlFetchApp.fetch(this.baseUrl + method, {
      method: 'post', contentType: 'application/json',
      payload: JSON.stringify(payload || {}), muteHttpExceptions: true
    });
  }

  api(method, payload) {
    const res = this.request(method, payload);
    const code = res.getResponseCode();
    const body = res.getContentText();
    if (code !== 200) throw new TelegramApiError(method, code, body);
    return TextUtils.safeJson(body);
  }

  send(chatId, text, extra) {
    try {
      this.api('sendMessage', Object.assign({ chat_id: chatId, text: text }, extra || {}));
    } catch (e) {
      this.log.error(e.message, 'فشل في إرسال رسالة تليجرام', '');
    }
  }

  sendDocument(chatId, blob, caption) {
    const res = UrlFetchApp.fetch(this.baseUrl + 'sendDocument', {
      method: 'post',
      payload: { chat_id: chatId, document: blob, caption: caption || '' },
      muteHttpExceptions: true
    });
    if (res.getResponseCode() !== 200) {
      this.log.error('EXPORT_HTTP' + res.getResponseCode(), 'فشل إرسال ملف', res.getContentText().slice(0, 300));
    }
  }

  getUpdates(offset, limit, timeoutSec) {
    const data = this.api('getUpdates', { offset: offset, limit: limit, timeout: timeoutSec || 0 });
    return data.result || [];
  }

  downloadFile(fileId) {
    const data = this.api('getFile', { file_id: fileId });
    if (!data.ok || !data.result || !data.result.file_path) {
      throw new FileDownloadError(JSON.stringify(data).slice(0, 200));
    }
    return UrlFetchApp.fetch(this.fileUrl + data.result.file_path).getBlob();
  }

  getWebhookInfo() { return this.api('getWebhookInfo', {}); }
  deleteWebhook(dropPending) { return this.api('deleteWebhook', { drop_pending_updates: !!dropPending }); }
}