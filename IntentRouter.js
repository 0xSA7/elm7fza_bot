// ═══════════════ IntentRouter.js — الطبقة المحلية (كامل) ═══════════════
// صفر توكنز — الحالات المؤكدة 100% بتعمل محلياً، وأي شك بيتسلم للـ AI

class IntentRouter {
    constructor(langService, finance) {
    this.lang = langService;
    this.finance = finance;
    this.greetings = CONFIG.INTENTS.GREETINGS.map(w => this.norm(w));
    this.qWords = CONFIG.INTENTS.QUESTION_WORDS.map(w => this.norm(w));
    this.topics = CONFIG.INTENTS.TOPICS.map(t => ({
      cmd: t.cmd, words: t.words.map(w => this.norm(w))
    }));
    this.quickMap = {};
    Object.keys(CONFIG.INTENTS.QUICK_MAP).forEach(k => {
      this.quickMap[this.norm(k)] = CONFIG.INTENTS.QUICK_MAP[k];
    });
    // 🔧 نطبّع قوايم الأفعال والوحدات بنفس norm() — عشان ى/ي و أي فروق
    this.spendVerbs = (CONFIG.INTENTS.SPEND_VERBS || []).map(w => this.norm(w));
    this.incomeVerbs = (CONFIG.INTENTS.INCOME_VERBS || []).map(w => this.norm(w));
    this.skipTokens = {};
    (CONFIG.INTENTS.UNITS || []).concat(CONFIG.INTENTS.PREPS || [])
      .forEach(w => { this.skipTokens[this.norm(w)] = true; });
    }

  // توحيد النص: أرقام عربية→لاتيني، شيل تشكيل، وحد ألف، افصل "615ج"→"615 ج"
  norm(s) {
    return String(s || '')
      .replace(/[٠-٩]/g, function (d) { return String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)); })
      .toLowerCase()
      .replace(/[\u064B-\u0652\u0640]/g, '')
      .replace(/[أإآ]/g, 'ا')
      .replace(/ى/g, 'ي')
      .replace(/(\d+(?:[.,]\d+)?)(ج|جنيه|egp)/g, '$1 $2')
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // مطابقة بالكلمات (كلمة أو كلمتين ورا بعض) — مش substring
  hasAny(tokens, list) {
    const set = {};
    list.forEach(w => { set[w] = true; });
    for (let i = 0; i < tokens.length; i++) {
      if (set[tokens[i]]) return true;
      if (i + 1 < tokens.length && set[tokens[i] + ' ' + tokens[i + 1]]) return true;
    }
    return false;
  }

  // المخرجات: null = سيبها للـ AI
  // {type:'greeting'} | {type:'command',cmd} | {type:'tx',transactions}
  try(text) {
    if (!text) return null;
    const raw = String(text).trim();
    const t = this.norm(raw);
    if (!t) return null;

    // 1️⃣ تحيات — تطابق كامل بس
    if (this.greetings.indexOf(t) !== -1) return { type: 'greeting' };

    // 2️⃣ أسئلة بيانات — من غير أرقام + كلمة استفهام + موضوع معروف
    if (!/[0-9]/.test(t)) {
      const tokens = t.split(' ');
      const hasQ = raw.indexOf('?') !== -1 || raw.indexOf('؟') !== -1 ||
                   this.hasAny(tokens, this.qWords);
      if (hasQ) {
        for (let i = 0; i < this.topics.length; i++) {
          if (this.hasAny(tokens, this.topics[i].words)) {
            return { type: 'command', cmd: this.topics[i].cmd };
          }
        }
      }
    }

    // 3️⃣ الإدخال السريع
    return this.quickEntry(t);
  }

  quickEntry(t) {
    // 🔥 المفكك المرن — "صرفت 20 ج اكل" / "دفعت 60 على المواصلات"
    const flexible = this.parseFlexibleExpense(t);
    if (flexible) return flexible;

    // دخل سريع: "كسبت 500" / "مرتب 8000"
    let m = t.match(/^(كسبت|حسنت|قبضت|مرتب|salary|earned)\s+(\d+(?:\.\d+)?)$/);
    if (m) return { type: 'tx', transactions: [new Transaction({
      date: DateUtils.today(), amount: Number(m[2]), kind: 'income',
      category: (m[1] === 'مرتب' || m[1] === 'salary') ? 'Salary' : 'Free Money'
    })] };

    // الصيغ القصيرة: "50 مواصلات" / "مواصلات 50"
    m = t.match(/^(\d+(?:\.\d+)?)\s+(\S+)$/);
    if (m) return this.expenseTx(Number(m[1]), m[2]);
    m = t.match(/^(\S+)\s+(\d+(?:\.\d+)?)$/);
    if (m) return this.expenseTx(Number(m[2]), m[1]);

    return null;
  }

  // شيل "ال" التعريف من أول الكلمة
  stripAl(w) {
    if (!w || w.length < 4) return w;
    if (w.indexOf('ال') === 0) return w.slice(2);
    return w;
  }

  // 🔥 المفكك المرن — يفهم صيغ المصاريف المصرية المتنوعة
    parseFlexibleExpense(t) {
    const tokens = t.split(' ').filter(Boolean);
    if (tokens.length < 2 || tokens.length > 6) return null;

    let amount = null, numCount = 0;
    for (const tk of tokens) {
      if (/^\d+([.,]\d+)?$/.test(tk)) {
        numCount++;
        if (numCount > 1) return null;
        amount = Number(tk.replace(',', '.'));
      }
    }
    if (!amount || amount <= 0) return null;

    let category = null;
    let isIncome = false;

    for (const tk of tokens) {
      if (/^\d+/.test(tk)) continue;
      if (this.spendVerbs.indexOf(tk) !== -1) continue;
      if (this.incomeVerbs.indexOf(tk) !== -1) { isIncome = true; continue; }
      if (this.skipTokens[tk]) continue;

      const stripped = this.stripAl(tk);
      let cat = this.quickMap[tk] || this.quickMap[stripped] || null;

      if (!cat) {
        for (let ci = 0; ci < CONFIG.DEFAULT_CATEGORIES.length; ci++) {
          const c = CONFIG.DEFAULT_CATEGORIES[ci];
          if (c.toLowerCase() === tk || c.toLowerCase() === stripped) {
            cat = c;
            break;
          }
        }
      }

      if (cat) {
        if (category) return null;
        category = cat;
      } else {
        return null;
      }
    }

    if (!category) return null;

    return { type: 'tx', transactions: [new Transaction({
      date: DateUtils.today(),
      amount: amount,
      kind: isIncome ? 'income' : 'expense',
      category: isIncome && (category === 'Food' || category === 'Other')
        ? 'Free Money' : category
    })] };
  }
  expenseTx(amount, word) {
    const cat = this.quickMap[word] ||
      CONFIG.DEFAULT_CATEGORIES.filter(c => c.toLowerCase() === word)[0] || null;
    if (!cat) return null;
    return { type: 'tx', transactions: [new Transaction({
      date: DateUtils.today(), amount: amount, kind: 'expense', category: cat
    })] };
  }
}