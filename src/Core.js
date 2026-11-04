// ═══════════════ الأساس المشترك ═══════════════
// الطبقة: Kernel · أخطاء + أدوات تاريخ/نص + لغة + منع التكرار + إشعار النسخ
class BotError extends Error {
  constructor(message, userMsg) {
    super(message);
    this.name = 'BotError';
    this.userMsg = userMsg || 'حدث خطأ مؤقت. / Something went wrong.';
  }
}
class HighDemandError extends BotError {
  constructor(detail) {
    super('RESOURCE_EXHAUSTED: ' + detail, 'سيرفرات جيميناي عليها ضغط، ابعت رسالتك تاني / AI servers busy, try again shortly.');
    this.name = 'HighDemandError';
  }
}
class GeminiError extends BotError {
  constructor(status, detail) {
    super('Gemini_' + status + ': ' + detail, 'خطأ في الذكاء الاصطناعي / AI processing error.');
    this.name = 'GeminiError';
  }
}
class TelegramApiError extends BotError {
  constructor(method, status, body) {
    body = String(body);
    super('TG_' + method + '_HTTP' + status + ': ' + body.slice(0, 300), 'فشل التواصل مع تليجرام / Telegram API error.');
    this.name = 'TelegramApiError';
    this.isWebhookConflict = /while webhook is active/i.test(body);
    this.isConcurrentPoll = /terminated by other getUpdates/i.test(body);
  }
}
class FileDownloadError extends BotError {
  constructor(detail) {
    super('GETFILE_FAILED: ' + detail, 'مش قادر أوصل للملف / Could not download the file.');
    this.name = 'FileDownloadError';
  }
}
function isTransient(err) {
  if (err instanceof HighDemandError) return true;   // 429/503 ضغط على جيميناي
  if (err instanceof GeminiError) return true;       // أخطاء HTTP من جيميناي
  if (err instanceof BotError) return false;         // أخطاء منطقية عندنا
  return true;                                       // أخطاء شبكة خام (Address unavailable...)
}
// ── خدمة اللغة: كشف فوري + حفظ آخر لغة للمحادثة ──
class LanguageService {
  constructor(props) { this.props = props; }
  detect(text) { return /[\u0600-\u06FF]/.test(String(text || '')) ? 'ar' : 'en'; }
  set(lang) { try { this.props.setProperty('USER_LANG', lang); } catch (e) {} }
  get() {
    try { return this.props.getProperty('USER_LANG') || 'ar'; } catch (e) { return 'ar'; }
  }
}

const DateUtils = {
  tz: Session.getScriptTimeZone(),
  today(offsetDays) {
    const d = new Date();
    d.setDate(d.getDate() + (offsetDays || 0));
    return Utilities.formatDate(d, this.tz, 'yyyy-MM-dd');
  },
  month(offsetMonths) {
    const d = new Date();
    d.setMonth(d.getMonth() + (offsetMonths || 0));
    return Utilities.formatDate(d, this.tz, 'yyyy-MM');
  },
  now() { return Utilities.formatDate(new Date(), this.tz, 'yyyy-MM-dd HH:mm:ss'); },
  normalizeCell(value) {
    return value instanceof Date ? Utilities.formatDate(value, this.tz, 'yyyy-MM-dd') : String(value);
  },
  normalizeIso(s) {
    if (!s) return this.today();
    const m = String(s).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    return m ? m[1] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[3]).slice(-2) : this.today();
  },
  // 📅 تاريخ قصير من غير سنة للعرض بس (الشيت بيخزن yyyy-MM-dd كامل زي ما هو)
  shortDate(s) {
    const m = String(s || '').match(/\d{4}-(\d{1,2})-(\d{1,2})/);
    return m ? ('0' + m[1]).slice(-2) + '-' + ('0' + m[2]).slice(-2) : String(s || '');
  }
};

const TextUtils = {
  
  fmt(n) { return Math.round(Number(n) || 0).toLocaleString('en-US'); },
  esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  },
  safeJson(s) {
    if (!s) return {};
    try { return JSON.parse(s); } catch (e) {}
    const m = String(s).match(/\{[\s\S]*\}/);
    if (!m) return {};
    try { return JSON.parse(m[0]); } catch (e) { return {}; }
  },
  buttonKey(s) {
    return String(s).replace(/[^\p{L}\p{N}\s]/gu, '').replace(/\s+/g, ' ').trim();
  }
};/**
 * Canonical person name:
 *   1. Arabic family variants -> canonical (امي -> Mother) [كلمات عامة من CONFIG.PERSON_MAP]
 *   2. أسماء الأصحاب -> canonical من Script Properties (PERSON_ALIASES بصيغة JSON)
 *   3. Any casing of a canonical name -> canonical (mother -> Mother)
 * أي اسم جديد بيعدي زي ما هو. الأسماء الحقيقية عمرها ما تتكتب في الكود.
 */
// القراءة مرة واحدة لكل تنفيذ (الأسماء نادراً ما تتغير)؛
// التيستز بتنده __resetPersonCaches() بعد ما تغيّر PERSON_ALIASES.
let _personCache = { raw: null, map: null, ci: null, ciRaw: null };
function __resetPersonCaches() { _personCache = { raw: null, map: null, ci: null, ciRaw: null }; }

function _personAliases() {
  if (_personCache.raw !== null) return _personCache.map;
  let raw = '';
  try {
    raw = String(PropertiesService.getScriptProperties().getProperty('PERSON_ALIASES') || '');
  } catch (e) { raw = ''; }
  const parsed = raw ? TextUtils.safeJson(raw) : {};
  const map = {};
  Object.keys(parsed || {}).forEach(function (k) {
    const v = parsed[k];
    if (typeof v === 'string' && v.trim()) map[String(k).trim()] = v.trim();
  });
  _personCache.raw = raw;
  _personCache.map = map;
  return map;
}

function _personMap() {
  const base = (typeof PERSON_MAP !== 'undefined' && PERSON_MAP) ? PERSON_MAP
    : ((typeof CONFIG !== 'undefined' && CONFIG && CONFIG.PERSON_MAP) ? CONFIG.PERSON_MAP : {});
  const extra = _personAliases();
  if (!extra || !Object.keys(extra).length) return base;
  const merged = {};
  Object.keys(base).forEach(function (k) { merged[k] = base[k]; });
  Object.keys(extra).forEach(function (k) { merged[k] = extra[k]; });
  return merged;
}

function _personCiIndex() {
  _personAliases();                       // يخلي _personCache.raw جاهز للتحقق
  if (_personCache.ci && _personCache.ciRaw === _personCache.raw) return _personCache.ci;
  const map = _personMap();
  const idx = {};
  Object.keys(map).forEach(function (k) {
    idx[k.toLowerCase()] = map[k];
    idx[String(map[k]).toLowerCase()] = map[k];
  });
  _personCache.ci = idx;
  _personCache.ciRaw = _personCache.raw;
  return idx;
}

function canonicalPerson(raw) {
  if (raw === null || raw === undefined) return raw;
  const name = String(raw).trim();
  if (!name) return name;
  const map = _personMap();
  const normalized = (typeof norm === 'function') ? norm(name) : name;
  const direct = map[name] || map[normalized];
  if (direct) return direct;
  return _personCiIndex()[name.toLowerCase()] || name;
}
class UpdateDeduper {
  constructor(props) { this.props = props; }
  seen(updateId) {
    if (!updateId) return false;
    try {
      if (CacheService.getScriptCache().get('upd_' + updateId)) return true;
      const last = Number(this.props.getProperty('LAST_UPDATE_ID') || 0);
      return updateId < last;
    } catch (e) { return false; }
  }
  mark(updateId) {
    if (!updateId) return;
    try {
      CacheService.getScriptCache().put('upd_' + updateId, '1', 600);
      const last = Number(this.props.getProperty('LAST_UPDATE_ID') || 0);
      if (updateId > last) this.props.setProperty('LAST_UPDATE_ID', String(updateId));
    } catch (e) {}
  }
}

class VersionNotifier {
  constructor(props, telegram, chatId) {
    this.props = props; this.telegram = telegram; this.chatId = chatId;
  }
  maybeNotify() {
    try {
      const cache = CacheService.getScriptCache();
      const key = 'VER_OK_' + CONFIG.VERSION;
      if (cache.get(key)) return;
      this.syncMenu();          // 📋 اتأكد إن المنيو كامل، مرة واحدة مع كل نسخة جديدة
      const saved = Number(this.props.getProperty('STORED_VERSION') || 0);
      if (CONFIG.VERSION > saved) {
        const text = CHANGELOG[CONFIG.VERSION] || ('🚀 <b>Version ' + CONFIG.VERSION + '</b>');
        this.telegram.send(this.chatId, text, { parse_mode: 'HTML' });
      }
      this.props.setProperty('STORED_VERSION', String(CONFIG.VERSION));
      cache.put(key, '1', 21600);
    } catch (e) {}
  }

  // 📋 إصلاح ذاتي للمنيو: لو تليجرام شايل أوامر أقل من اللي في CONFIG → نسجلهم تاني
  //    (ده اللي بيمنع المنيو يفضل فاضي مهما حصل)
  syncMenu() {
    try {
      const list = CONFIG.COMMAND_MENU || [];
      if (!list.length) return;
      const cur = this.telegram.api('getMyCommands', {});
      const n = (cur && cur.result) ? cur.result.length : 0;
      if (n >= list.length) return;          // المنيو كامل، مفيش حاجة
      this.telegram.api('setMyCommands', { commands: list });
      this.telegram.send(this.chatId,
        '📋 المنيو اتصلاح واتسجل فيه ' + list.length + ' أمر ✅\nاكتب / أو افتح زرار الـ Menu وشوفها');
    } catch (e) {}
  }
}
