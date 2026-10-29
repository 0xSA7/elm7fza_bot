// ═══════════════ طبقة التواصل مع جيميناي — مع Model Fallback ═══════════════
class GeminiClient {
  constructor(apiKey, logRepo) {
    this.apiKey = apiKey;
    this.log = logRepo;
    this.models = [CONFIG.MODEL].concat(CONFIG.GEMINI.FALLBACK_MODELS || []);
  }

  // يجرب كل موديل بالترتيب — لو واحد وقع (503/429) ينتقل للتاني فوراً
  generate(parts, opts) {
    opts = opts || {};
    let lastError = null;

    for (let m = 0; m < this.models.length; m++) {
      const model = this.models[m];
      try {
        return this.attemptWithModel(model, parts, opts);
      } catch (e) {
        if (e instanceof HighDemandError) {
          if (m < this.models.length - 1) {
            this.log.warn('MODEL_FALLBACK', model + ' مشغول (' + e.message + ') → تجربة ' + this.models[m + 1], '');          
          }
          lastError = e;
          continue;    // الموديل الجاي فوراً — من غير انتظار
        }
        throw e;       // خطأ حقيقي (مش ضغط) = وقف على طول
      }
    }
    throw lastError;   // كل الموديلات واقعة → الطابور بيتكفل بيها
  }

  attemptWithModel(model, parts, opts) {
    const url = 'https://generativelanguage.googleapis.com/v1beta/models/' +
                model + ':generateContent?key=' + this.apiKey;
    let res;
    try {
      res = UrlFetchApp.fetch(url, {
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
    } catch (netErr) {
      // 🌐 Address unavailable / DNS / قطع شبكة → كأنه ضغط → فولباك + طابور
      throw new HighDemandError('NET: ' + String((netErr && netErr.message) || netErr).slice(0, 80) + ' @ ' + model);
    }

    const status = res.getResponseCode();
    const body = res.getContentText();

    if (status === 200) return this.extract(res, opts.plainText);

    const highDemand = status === 429 || status === 500 || status === 502 ||
                       status === 503 || status === 504 ||
                       body.indexOf('high demand') !== -1 ||
                       body.indexOf('RESOURCE_EXHAUSTED') !== -1;
    if (highDemand) throw new HighDemandError('HTTP ' + status + ' @ ' + model);

    const detail = (TextUtils.safeJson(body).error || {}).message || body.slice(0, 300);
    this.log.error('HTTP_' + status + '@' + model + '_' + detail, 'خطأ في الذكاء الاصطناعي', opts.context || '');
    throw new GeminiError(status, detail);
  }

  extract(res, plainText) {
    const data = JSON.parse(res.getContentText());
    const cand = data.candidates && data.candidates[0];
    if (cand && cand.finishReason === 'MAX_TOKENS') {
      this.log.warn('GEMINI_TRUNCATED', 'reply cut by maxOutputTokens', '');
    }
    const part = cand && cand.content && cand.content.parts && cand.content.parts[0];
    const text = (part && part.text) || '';
    if (plainText) return text;
    const parsed = TextUtils.safeJson(text);
    if (!parsed.is_transaction && !parsed.transactions && !parsed.reply) {
      this.log.warn('AI_EMPTY_RESULT', 'raw: ' + String(text).slice(0, 250), '');
    }
    return parsed;
  }
}