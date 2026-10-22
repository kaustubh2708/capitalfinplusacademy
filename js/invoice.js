/* ==============================================
   Capital Finplus Academy — invoice helpers
   Pure functions, shared by pages/invoice.html and its node check
   (scripts/invoice-check.js).
   ============================================== */
(function (root) {
  var GST_RATE = 0.18;

  /* payments.amount is what the customer actually paid, GST included
     (create-order.js charges fee + 18%). Split it back out. Rounded to
     paise; GST is the remainder so the two always add up to the total. */
  function split(total) {
    total = Math.round((Number(total) || 0) * 100) / 100;
    var taxable = Math.round(total / (1 + GST_RATE) * 100) / 100;
    var gst = Math.round((total - taxable) * 100) / 100;
    return { taxable: taxable, gst: gst, total: total };
  }

  /* Indian financial year runs April–March: Oct 2026 → "2026-27". */
  function financialYear(date) {
    var d = new Date(date);
    var y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
    return y + '-' + String(y + 1).slice(-2);
  }

  /* ponytail: derived from the payment row, not a gap-free counter. GST
     prefers sequential numbers — swap for a DB sequence once a GSTIN is in use. */
  function invoiceNumber(payment) {
    var ref = String(payment.paymentRef || payment.id || '').replace(/^pay_/, '');
    return 'CFA/' + financialYear(payment.createdAt) + '/' + ref.slice(-8).toUpperCase();
  }

  var api = { split: split, financialYear: financialYear, invoiceNumber: invoiceNumber };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.cfpInvoice = api;
})(this);
