// ═══════════════ الذكاء الاصطناعي — نداء واحد شامل، برومبت مضغوط ═══════════════
class IntelligenceService {
  constructor(gemini, promptRepo, categoryRepo, telegram, finance, langService) {
    this.gemini = gemini;
    this.prompts = promptRepo;
    this.categories = categoryRepo;
    this.telegram = telegram;
    this.finance = finance;
    this.lang = langService;
  }


    template() {
    if (this._tpl) return this._tpl;
    const cats = this.categories.getAll().join(',') || 'Food,Other';
    this._tpl =
      'Smart bilingual finance accountant (Egyptian Arabic / MSA / English). Today: {TODAY} ({DAY}).\n' +
      '{CONTEXT}\n' +
      'Return ONLY JSON: {"is_transaction":true,"transactions":[{"amount":0,"currency":"EGP","kind":"expense","category":"","date":"YYYY-MM-DD","note":""}],"reply":""}\n' +
      'kind: expense=صرفت/شريت/دفعت | income=money he keeps (كسبت/مرتب/هدية kept) | loan_in=سلفة he must repay (parents\' money=loan_in unless explicitly هدية he keeps) | repay_out=he repaid debt (سددت/رجعت لبويا) | loan_out=he lent someone (سلفت) | repay_in=he was repaid (ردوا له)\n' +
      'category: expense→[' + cats + '] | income→Salary|Free Money|Own Money|Other | loan/repay kinds→the person in ENGLISH always: Father, Mother, Brother, Sister, or friend\'s name as written. (Father=والدي/ابويا/بابا, Mother=امي/والدتي/ماما, Brother=اخويا) \n' +
      'hints: أكل/غدا/عشا→Food سوق→Groceries مواصلات/أوبر/بنزين→Transport كهربا/نت→Utilities خروجة/قهوة/شيشة→Outings سينما→Entertainment هدوم→Clothes دوا→Health دراسة→Education إيجار→Home\n' +
      'rules: EGP default; date≤today (امبارح=yesterday, اول الشهر=1st, month names = this year); word-numbers→digits (تلتمية=300); split multi-transactions; amounts>0; reply in user\'s language, confirmations ≤10 words\n' +
      'hist: record past-dated transactions with their REAL dates. Loans from OLD untracked cash (فلوس قديمة/خارج المحاسبة) → loan_out_off (debt book only, zero financial effect). Old pre-tracking debts on him → loan_in_off\n' +
      'ex: "كان معايا فلوس قديمة ومنها سلفت صاحبي ٢٠٠ يوم ٢٨ أغسطس" → loan_out_off, category صاحبي, correct past date\n' +
      'if no transaction (question/chat): transactions=[] and reply=answer from the Context above. For questions about specific spending (what did I spend on X, when did I buy Y), quote the actual transactions from Context with dates and notes. If data is insufficient, say so briefly and suggest /search or /last.\n';
    return this._tpl;
  }

  buildPrompt(text, opts) {
    opts = opts || {};
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const tpl = this.prompts.get(CONFIG.PROMPT_KEY, this.template());
    let p = tpl
      .replace('{TODAY}', DateUtils.today())
      .replace('{DAY}', days[new Date().getDay()])
      .replace('{CONTEXT}', this.contextLine(text, !!opts.voice));
    if (!opts.voice) p += '\nUser message: ' + text;
    return p;
  }

  // لو الرسالة فيها أرقام → غالباً معاملة → بنوفر توكنز السياق
  // الصوت مستحنب مسبقاً → السياق موجود دايماً
  contextLine(text, isVoice) {
    if (!isVoice && text && /[0-9٠-٩]/.test(text))
      return 'Context: (transaction expected — no data context needed)';
    return 'Context: ' + this.finance.compactContextForAi();
  }

  // 📝 نص: نداء واحد — معاملة أو إجابة سؤال
  processText(text, messageId) {
    const parsed = this.gemini.generate([{ text: this.buildPrompt(text) }], { context: text });
    return new ExtractionResult(parsed, text, messageId);
  }

  // 🎙️ صوت: تفريغ + استخراج في نداء واحد (كانوا اتنين)
  processVoice(fileId, messageId) {
    const b64 = Utilities.base64Encode(this.telegram.downloadFile(fileId).getBytes());
    const parsed = this.gemini.generate([
      { inline_data: { mime_type: 'audio/ogg', data: b64 } },
      { text: 'Input is a VOICE message. Add "transcript":"<verbatim transcript in its language>" to the JSON, then extract transactions from the transcript.\n\n' +
              this.buildPrompt('', { voice: true }) }
    ], { context: '[Voice]' });
    const transcript = String(parsed.transcript || '').trim();
    return {
      transcript: transcript,
      result: new ExtractionResult(parsed, transcript || '[voice]', messageId)
    };
  }

  // 📸 صورة: زي ما هي — نداء واحد
  extractReceipt(fileId, caption, messageId) {
    const b64 = Utilities.base64Encode(this.telegram.downloadFile(fileId).getBytes());
    const parsed = this.gemini.generate([
      { inline_data: { mime_type: 'image/jpeg', data: b64 } },
      { text: this.buildPrompt('(receipt photo attached)') + '\nExtract the receipt items as transactions.' }
    ], { context: caption || '[Receipt]' });
    return new ExtractionResult(parsed, caption || '[receipt photo]', messageId);
  }
}