// ═══════════════ الأساس: أخطاء + أدوات + لغة ═══════════════
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
// ── الترجمة: مفتاح → نص حسب اللغة ──
const I18n = {
  t(key, lang, params) {
    const entry = STR[key];
    let s = (entry && (entry[lang] || entry.ar)) || key;
    if (params) Object.keys(params).forEach(k => { s = s.replace('{' + k + '}', params[k]); });
    return s;
  }
};

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
 *   1. Arabic family variants -> canonical (امي -> Mother)
 *   2. Any casing of a canonical name -> canonical (mother -> Mother)
 * Non-family names pass through untouched (sensei stays sensei).
 * Works whether PERSON_MAP is top-level or CONFIG.PERSON_MAP.
 */
function _personMap() {
  if (typeof PERSON_MAP !== 'undefined' && PERSON_MAP) return PERSON_MAP;
  if (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.PERSON_MAP) return CONFIG.PERSON_MAP;
  return {};
}

let _personCiIndexCache = null;
function _personCiIndex() {
  if (_personCiIndexCache) return _personCiIndexCache;
  const map = _personMap();
  const idx = {};
  Object.keys(map).forEach(function (k) {
    idx[k.toLowerCase()] = map[k];
    idx[String(map[k]).toLowerCase()] = map[k];
  });
  _personCiIndexCache = idx;
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
      const saved = Number(this.props.getProperty('STORED_VERSION') || 0);
      if (CONFIG.VERSION > saved) {
        const text = CHANGELOG[CONFIG.VERSION] || ('🚀 <b>Version ' + CONFIG.VERSION + '</b>');
        this.telegram.send(this.chatId, text, { parse_mode: 'HTML' });
      }
      this.props.setProperty('STORED_VERSION', String(CONFIG.VERSION));
      cache.put(key, '1', 21600);
    } catch (e) {}
  }
}