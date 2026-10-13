// ═══════════════ الطبقة المحلية — صفر توكنز ═══════════════
// بنشتغل لوحنا في الحالات المؤكدة 100% بس — وأي شك بيسلم للـ AI
class IntentRouter {
  constructor(langService, finance) {
    this.lang = langService;
    this.finance = finance;
    // توحيد القوايم مرة واحدة وقت البناء
    this.greetings = CONFIG.INTENTS.GREETINGS.map(w => this.norm(w));
    this.qWords = CONFIG.INTENTS.QUESTION_WORDS.map(w => this.norm(w));
    this.topics = CONFIG.INTENTS.TOPICS.map(t => ({ cmd: t.cmd, words: t.words.map(w => this.norm(w)) }));
    this.quickMap = {};
    Object.keys(CONFIG.INTENTS.QUICK_MAP).forEach(k => {
      this.quickMap[this.norm(k)] = CONFIG.INTENTS.QUICK_MAP[k];
    });
  }

  // توحيد النص: تشكيل/تطويل شال، ألف موحدة، ي بدل ى، من غير علامات
  norm(s) {
    return String(s || '')
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // مطابقة بالكلمات (كلمة أو كلمتين ورا بعض) — مش substring عشان "كمان" متتلخبطش مع "كام"
  hasAny(tokens, list) {
    const set = {};
    list.forEach(w => { set[w] = true; });
    for (let i = 0; i < tokens.length; i++) {
      if (set[tokens[i]]) return true;
      if (i + 1 < tokens.length && set[tokens[i] + ' ' + tokens[i + 1]]) return true;
    }
    return false;
  }

  // المخرجات: null = سيبها للـ AI | {type:'greeting'} | {type:'command',cmd} | {type:'tx',transactions}
  try(text) {
    if (!text) return null;
    const raw = String(text).trim();
    const t = this.norm(raw);
    if (!t) return null;

    // 1️⃣ تحيات وشكر — تطابق كامل بس (آمنة تماماً)
    if (this.greetings.indexOf(t) !== -1) return { type: 'greeting' };

    // 2️⃣ أسئلة البيانات — بشرط: من غير أرقام + كلمة استفهام + موضوع معروف
    if (!/[0-9٠-٩]/.test(raw)) {
      const tokens = t.split(' ');
      const hasQ = raw.indexOf('?') !== -1 || raw.indexOf('؟') !== -1 ||
                   this.hasAny(tokens, this.qWords);
      if (hasQ) {
        for (let i = 0; i < this.topics.length; i++) {
          if (this.hasAny(tokens, this.topics[i].words)) {
            return { type: 'command', cmd: this.topics[i].cmd };
          }
        }
        // سؤال من غير موضوع واضح → الـ AI (عنده السياق جوه البرومبت)
      }
    }

    // 3️⃣ الإدخال السريع
    return this.quickEntry(t);
  }

  quickEntry(t) {
    // دخل سريع: "كسبت 500" / "مرتب 8000"
    let m = t.match(/^(كسبت|حسنت|قبضت|مرتب|salary|earned)\s+(\d+(?:\.\d+)?)$/);
    if (m) return { type: 'tx', transactions: [new Transaction({
      date: DateUtils.today(), amount: Number(m[2]), kind: 'income',
      category: (m[1] === 'مرتب' || m[1] === 'salary') ? 'Salary' : 'Free Money'
    })] };

    // صرف سريع: "50 مواصلات" أو "مواصلات 50" — كلمة واحدة معروفة بس
    m = t.match(/^(\d+(?:\.\d+)?)\s+(\S+)$/);
    if (m) return this.expenseTx(Number(m[1]), m[2]);
    m = t.match(/^(\S+)\s+(\d+(?:\.\d+)?)$/);
    if (m) return this.expenseTx(Number(m[2]), m[1]);
    return null;   // أي صيغة تانية → الـ AI أضمن
  }

  expenseTx(amount, word) {
    const cat = this.quickMap[word] ||
      CONFIG.DEFAULT_CATEGORIES.filter(c => c.toLowerCase() === word)[0] || null;
    if (!cat) return null;   // مش تصنيف معروف → سيبها للـ AI يفهمها صح
    return { type: 'tx', transactions: [new Transaction({
      date: DateUtils.today(), amount: amount, kind: 'expense', category: cat
    })] };
  }
}