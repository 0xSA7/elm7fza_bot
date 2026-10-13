// ═══════════════ طبقة التواصل مع جيميناي — مسؤوليتها الوحيدة: الـ API ═══════════════
class GeminiClient {
  constructor(apiKey, logRepo) {
    this.apiKey = apiKey;
    this.log = logRepo;
    this.url = 'https://generativelanguage.googleapis.com/v1beta/models/' + CONFIG.MODEL +
               ':generateContent?key=' + apiKey;
  }

  generate(parts, opts) {
    opts = opts || {};
    for (let attempt = 1; attempt <= CONFIG.GEMINI.RETRIES; attempt++) {
      const res = UrlFetchApp.fetch(this.url, {
        method: 'post', contentType: 'application/json',
        payload: JSON.stringify({
          contents: [{ parts: parts }],
          generationConfig: {
            temperature: CONFIG.GEMINI.TEMPERATURE,
            maxOutputTokens: CONFIG.GEMINI.MAX_OUTPUT_TOKENS,   
            responseMimeType: opts.plainText ? 'text/plain' : 'application/json'
          }
        }),
        muteHttpExceptions: true
      });

      const status = res.getResponseCode();
      const body = res.getContentText();

      if (status === 200) return this.extract(res, opts.plainText);

      const highDemand = status === 429 || status === 503 ||
                         body.indexOf('high demand') !== -1 ||
                         body.indexOf('RESOURCE_EXHAUSTED') !== -1;
      if (highDemand) {
        if (attempt < CONFIG.GEMINI.RETRIES) { Utilities.sleep(CONFIG.GEMINI.RETRY_DELAY_MS); continue; }
        this.log.error('HTTP_' + status + '_RESOURCE_EXHAUSTED', 'سيرفرات جيميناي عليها ضغط مؤقت', opts.context || '');
        throw new HighDemandError('HTTP ' + status);
      }

      const detail = (TextUtils.safeJson(body).error || {}).message || body.slice(0, 300);
      this.log.error('HTTP_' + status + '_' + detail, 'خطأ في معالجة الذكاء الاصطناعي', opts.context || '');
      throw new GeminiError(status, detail);
    }
    throw new GeminiError(0, 'unreachable');
  }

  extract(res, plainText) {
    const data = JSON.parse(res.getContentText());
    const cand = data.candidates && data.candidates[0];
    // 🩺 كشف القطع: لو الرد اتقص بحد التوكنز — يبان في اللوج فوراً
    if (cand && cand.finishReason === 'MAX_TOKENS') {
      this.log.warn('GEMINI_TRUNCATED', 'reply cut by maxOutputTokens — raise cap in CONFIG', '');
    }
    const part = cand && cand.content && cand.content.parts && cand.content.parts[0];
    const text = (part && part.text) || '';
    if (plainText) return text;
    const parsed = TextUtils.safeJson(text);
    // 🔍 لو الرد مفيهوش ولا معاملة ولا رد — نسجل النص الخام عشان التشخيص الفوري
    if (!parsed.is_transaction && !parsed.transactions && !parsed.reply) {
      this.log.warn('AI_EMPTY_RESULT', 'raw: ' + String(text).slice(0, 250), '');
    }
    return parsed;
  }
}