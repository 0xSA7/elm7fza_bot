// ═══════════════ Transaction Model Tests ═══════════════

test('Transaction: fromGemini يطبّع البيانات', function() {
  var tx = Transaction.fromGemini(
    { amount: 100, kind: 'expense', category: 'Food', date: '2026-10-13', note: 'غدا', currency: 'EGP' },
    'صرفت 100 على الغدا', 123
  );
  expect(tx.amount).toBe(100);
  expect(tx.kind).toBe('expense');
  expect(tx.category).toBe('Food');
  expect(tx.date).toBe('2026-10-13');
  expect(tx.rawText).toBe('صرفت 100 على الغدا');
  expect(tx.isCashIn).toBe(false);
});

test('Transaction: kind غير صالح يرجع expense', function() {
  var tx = Transaction.fromGemini({ amount: 50, kind: 'نonsense' }, 'test', 1);
  expect(tx.kind).toBe('expense');
});

test('Transaction: off-book loan بدون علامة سالب', function() {
  var tx = Transaction.fromGemini({ amount: 200, kind: 'loan_out_off', category: 'ghan dy' }, 'test', 1);
  expect(tx.kind).toBe('loan_out_off');
  var line = tx.displayLine('ar');
  expect(line).toContain('🔷');
  expect(line).not.toContain('−'); // مفيش سالب!
});

test('Transaction: loan_out ليه علامة سالب', function() {
  var tx = Transaction.fromGemini({ amount: 200, kind: 'loan_out', category: 'sensei' }, 'test', 1);
  var line = tx.displayLine('ar');
  expect(line).toContain('−');
});

test('Transaction: fromRow/toRow round-trip', function() {
  var original = Transaction.fromGemini(
    { amount: 75, kind: 'income', category: 'Free Money', date: '2026-10-13' }, 'test', 999
  );
  var row = original.toRow();
  var restored = Transaction.fromRow(row);
  expect(restored.amount).toBe(original.amount);
  expect(restored.kind).toBe(original.kind);
  expect(restored.category).toBe(original.category);
});

test('ExtractionResult: يفلتر المعاملات الفاضية', function() {
  var result = new ExtractionResult({
    is_transaction: true,
    transactions: [
      { amount: 100, kind: 'expense', category: 'Food' },
      { amount: 0, kind: 'expense' },       // صفر → يتشال
      { amount: -50, kind: 'expense' },     // سالب → يتشال
      null                                    // فاضي → يتشال
    ]
  }, 'test', 1);
  expect(result.transactions.length).toBe(1);
});

test('PERSON_MAP: "امي" تتحول لـ Mother في المعاملات', function() {
  var tx = Transaction.fromGemini(
    { amount: 2000, kind: 'loan_in', category: 'امي' }, 'test', 1
  );
  expect(tx.category).toBe('Mother');
});

test('PERSON_MAP: أسماء الأصحاب مبتتغيرش', function() {
  var tx = Transaction.fromGemini(
    { amount: 200, kind: 'loan_out', category: 'ghan dy' }, 'test', 1
  );
  expect(tx.category).toBe('ghan dy');
});