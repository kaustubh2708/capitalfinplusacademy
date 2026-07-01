/* ==============================================
   Vercel Serverless Function — POST /api/verify-payment
   Verifies the Razorpay payment signature server-side so a
   customer can't fake a "successful" payment from the browser.
   Requires these env vars on Vercel:
     RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

   After a verified payment, this also writes the payment +
   enrollment rows to Supabase using the service_role key
   (server-side only — never expose that key to the browser).
   user_id is read back from the Razorpay order's own notes
   (set server-side in create-order.js), not trusted from the
   client request body, so it can't be spoofed at verify time.

   For full production robustness, also add a Razorpay webhook
   endpoint that listens for `payment.captured` server-to-server —
   that covers cases like the customer closing the tab right after
   paying, before this browser-triggered call fires. Flagged as a
   pending task in Go_Live_Checklist.md.
   ============================================== */

const crypto = require('crypto');
const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay keys are not configured on the server yet.' });
  }

  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ verified: false, error: 'Missing payment fields.' });
  }

  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_KEY_SECRET)
    .update(razorpay_order_id + '|' + razorpay_payment_id)
    .digest('hex');

  const verified = expectedSignature === razorpay_signature;

  if (!verified) {
    return res.status(400).json({ verified: false, error: 'Signature mismatch.' });
  }

  /* Signature is good — the payment itself is genuine regardless of what
     happens below. DB bookkeeping failures must never turn this into a
     "payment failed" response to the customer; they're logged and
     surfaced via `dbError` instead, response status stays 200. */
  let enrollmentId = null;
  let dbError = null;

  try {
    if (!RAZORPAY_KEY_ID) throw new Error('RAZORPAY_KEY_ID not configured — cannot fetch order notes.');
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase service role env vars not configured.');

    const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
    const [order, payment] = await Promise.all([
      razorpay.orders.fetch(razorpay_order_id),
      razorpay.payments.fetch(razorpay_payment_id)
    ]);

    const notes = order.notes || {};
    const userId = notes.user_id || null;
    const courseId = notes.courseId || null;

    if (!userId) {
      dbError = 'No user_id on this order (guest checkout) — payment was not linked to an account.';
    } else if (!courseId) {
      dbError = 'No courseId on this order — payment was not linked to a course.';
    } else {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      const { data: paymentRow, error: paymentErr } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          course_id: courseId,
          razorpay_order_id,
          razorpay_payment_id,
          amount: (payment.amount || 0) / 100, // paise -> rupees
          status: 'captured',
          raw_response: payment
        })
        .select('id')
        .single();
      if (paymentErr) throw paymentErr;

      const { data: enrollmentRow, error: enrollErr } = await supabase
        .from('enrollments')
        .insert({
          user_id: userId,
          course_id: courseId,
          payment_id: paymentRow.id,
          status: 'active',
          purchased_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (enrollErr) throw enrollErr;

      enrollmentId = enrollmentRow.id;
    }
  } catch (err) {
    console.error('verify-payment: post-payment DB write failed', err);
    dbError = err.message || 'Could not record this payment in the database.';
  }

  return res.status(200).json({
    verified: true,
    success: true,
    paymentId: razorpay_payment_id,
    orderId: razorpay_order_id,
    enrollmentId,
    dbError
  });
};
