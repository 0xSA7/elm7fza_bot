// ═══════════════ Config Integrity Tests ═══════════════
// اتأكد إن كل المفاتيح المطلوبة موجودة قبل أي deploy

test('CONFIG فيه كل الأنواع الستة + off-book', function() {
  expect(CONFIG.KINDS.income).toBeTruthy();
  expect(CONFIG.KINDS.expense).toBeTruthy();
  expect(CONFIG.KINDS.loan_in).toBeTruthy();
  expect(CONFIG.KINDS.loan_out).toBeTruthy();
  expect(CONFIG.KINDS.repay_in).toBeTruthy();
  expect(CONFIG.KINDS.repay_out).toBeTruthy();
  expect(CONFIG.KINDS.loan_in_off).toBeTruthy();
  expect(CONFIG.KINDS.loan_out_off).toBeTruthy();
});

test('CONFIG: كل kind ليه icon و strKey', function() {
  Object.keys(CONFIG.KINDS).forEach(function(kind) {
    expect(CONFIG.KINDS[kind].icon).toBeTruthy();
    expect(CONFIG.KINDS[kind].strKey).toBeTruthy();
  });
});

test('CONFIG: BUTTONS كلها بتشاور على أوامر مسجلة', function() {
  // البوتونز لازم تكون قايمة صحيحة
  expect(Object.keys(BUTTONS).length).toBeGreaterThanOrEqual(8);
  Object.keys(BUTTONS).forEach(function(label) {
    expect(typeof BUTTONS[label]).toBe('string');
  });
});

test('CONFIG: STR فيه كل النصوص المطلوبة', function() {
  var required = ['income', 'expense', 'net', 'noData', 'savedOne', 'savedMany',
                  'unknownCmd', 'unsupported', 'greetingReply', 'fallbackReply',
                  'aiBusyQueued', 'retryTimeout', 'kLoanOutOff', 'debtCmdUsage'];
  required.forEach(function(key) {
    expect(STR[key]).toBeTruthy();
    expect(STR[key].ar).toBeTruthy();
    expect(STR[key].en).toBeTruthy();
  });
});

test('CONFIG: INTENTS فيه القوايم المطلوبة', function() {
  expect(Array.isArray(CONFIG.INTENTS.GREETINGS)).toBeTruthy();
  expect(Array.isArray(CONFIG.INTENTS.QUESTION_WORDS)).toBeTruthy();
  expect(Array.isArray(CONFIG.INTENTS.TOPICS)).toBeTruthy();
  expect(Array.isArray(CONFIG.INTENTS.SPEND_VERBS)).toBeTruthy();
  expect(Array.isArray(CONFIG.INTENTS.UNITS)).toBeTruthy();
  expect(Array.isArray(CONFIG.INTENTS.PREPS)).toBeTruthy();
});

test('CONFIG: GEMINI عنده fallback models', function() {
  expect(Array.isArray(CONFIG.GEMINI.FALLBACK_MODELS)).toBeTruthy();
});

test('CONFIG: DEFAULT_CATEGORIES فيها الأساسيات', function() {
  var cats = CONFIG.DEFAULT_CATEGORIES.join(',');
  expect(cats).toContain('Food');
  expect(cats).toContain('Transport');
  expect(cats).toContain('Outings');
  expect(cats).toContain('Free Money');
});

// ═══ v41: حارس الشرطة الطويلة، مفيش em dash في أي ملف كود ═══
test('الحارس: مفيش شرطة طويلة (em dash) في أي ملف كود', function () {
  var EMDASH = String.fromCharCode(8212);   // علامة الشرطة الطويلة
  expect(__repoFiles.length).toBeGreaterThanOrEqual(25);
  __repoFiles.forEach(function (f) {
    if (f.body.indexOf(EMDASH) !== -1)
      throw new Error(f.name + ' فيه شرطة طويلة em dash عند حرف ' + f.body.indexOf(EMDASH));
  });
});

test('DateUtils.shortDate: التاريخ من غير سنة', function () {
  expect(DateUtils.shortDate('2026-11-30')).toBe('11-30');
  expect(DateUtils.shortDate('2026-1-5')).toBe('01-05');
  expect(DateUtils.shortDate('')).toBe('');
});

test('runwayLine: القبض مش موجود في السطر اليومي', function () {
  // القالب نفسه مفيهوش {in} خالص
  expect(STR.runwayLine.ar.indexOf('{in}')).toBe(-1);
  expect(STR.runwayLine.ar.indexOf('قبضت')).toBe(-1);
  expect(STR.runwayLine.ar.indexOf('باقي {left}')).not.toBe(-1);
  expect(STR.runwayLine.en.indexOf('earned')).toBe(-1);
});