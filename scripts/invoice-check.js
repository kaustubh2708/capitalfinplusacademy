/* node scripts/invoice-check.js — asserts the invoice money maths. */
const assert = require('assert');
const inv = require('../js/invoice.js');

// 860 + 18% GST = 1014.80 charged
let s = inv.split(1014.8);
assert.deepStrictEqual(s, { taxable: 860, gst: 154.8, total: 1014.8 });

// parts always add back to the total, even when it doesn't divide cleanly
for (const t of [1, 99.99, 5898.82, 28320, 7670, 0]) {
  s = inv.split(t);
  assert.strictEqual(Math.round((s.taxable + s.gst) * 100), Math.round(t * 100), 'split ' + t);
}

// GST added on top: 860 -> 154.80 -> 1014.80, matching the inclusive split
assert.deepStrictEqual(inv.fromTaxable(860), { taxable: 860, gst: 154.8, total: 1014.8 });
assert.deepStrictEqual(inv.fromTaxable(4999), { taxable: 4999, gst: 899.82, total: 5898.82 });

// financial year flips in April
assert.strictEqual(inv.financialYear('2026-03-31T10:00:00+05:30'), '2025-26');
assert.strictEqual(inv.financialYear('2026-04-01T10:00:00+05:30'), '2026-27');

assert.strictEqual(
  inv.invoiceNumber({ paymentRef: 'pay_Q1w2E3r4T5y6U7', createdAt: '2026-10-22' }),
  'CFA/2026-27/R4T5Y6U7'
);
console.log('invoice-check: ok');
