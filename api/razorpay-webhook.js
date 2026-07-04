/* ==============================================
   Vercel Serverless Function — POST /api/razorpay-webhook
   Server-to-server safety net for api/verify-payment.js: if a buyer
   closes their tab right after paying, the browser never calls
   verify-payment.js, so no payment/enrollment row ever gets written.
   Razorpay calls this endpoint directly from its own servers on the
   `payment.captured` event regardless of what the buyer's browser does.

   Requires these env vars on Vercel:
     RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
     RAZORPAY_WEBHOOK_SECRET   (separate from the API key secret — set
                                 this in Razorpay Dashboard -> Settings ->
                                 Webhooks when you add this endpoint URL,
                                 then copy the same value into Vercel)
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

   Configure in Razorpay Dashboard -> Settings -> Webhooks:
     URL: https://<your-domain>/api/razorpay-webhook
     Active events: payment.captured

   Idempotency: this and verify-payment.js both check for an existing
   payments row by razorpay_payment_id before writing anything, so
   whichever one runs first does the real work — the other just no-ops.
   This endpoint ALWAYS returns 200 (even on internal errors) because a
   non-200 response makes Razorpay retry the webhook on a schedule,
   which isn't useful once we've already logged the failure ourselves.
   ============================================== */

const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

/* courseId here is the data.js-style id ("4" etc.) used everywhere in
   URLs/order notes — payments.course_id / enrollments.course_id are
   real uuid FKs to courses.id, so it has to be resolved by name before
   inserting (see the matching comment in verify-payment.js). */
const COURSE_ID_TO_NAME = {
  '3': 'The CFA Academy Framework for Stock Investing',
  '4': 'Self-Study',
  '5': 'Guided Learning',
  '6': 'Mentorship Program'
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

/* Shared write sequence: newsletter -> resolve/invite account -> payments
   -> enrollments. Mirrors verify-payment.js's logic exactly (duplicated
   on purpose rather than importing from it, to keep this endpoint fully
   self-contained and verify-payment.js untouched apart from its own
   matching idempotency check). Returns { enrollmentId, dbError }. */
async function recordVerifiedPayment(supabase, { razorpayOrderId, razorpayPaymentId, amountPaise, notes, rawPaymentEntity }) {
  const courseId = notes.courseId || null;
  const checkoutEmail = (notes.email || rawPaymentEntity.email || '').toString().trim().toLowerCase() || null;

  if (checkoutEmail) {
    await supabase.from('newsletter_subscribers').insert({
      email: checkoutEmail,
      name: notes.name || '',
      source: 'purchase',
      course_id: courseId,
      course_name: notes.courseName || ''
    }).then(r => {
      if (r.error && r.error.code !== '23505') console.error('razorpay-webhook: newsletter insert failed', r.error);
    });
  }

  let userId = null;
  if (checkoutEmail) {
    try {
      const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(checkoutEmail, {
        data: { full_name: notes.name || '' },
        redirectTo: (process.env.SITE_URL || 'https://capitalfinplusadvizors.com') + '/pages/account.html'
      });
      if (!inviteErr && inviteData && inviteData.user) {
        userId = inviteData.user.id;
      } else if (inviteErr && /already (registered|exists)/i.test(inviteErr.message || '')) {
        const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
        const match = !listErr && listData && listData.users
          ? listData.users.find(u => (u.email || '').toLowerCase() === checkoutEmail)
          : null;
        if (match) userId = match.id;
        else console.error('razorpay-webhook: could not resolve existing user id for', checkoutEmail, listErr);
      } else if (inviteErr) {
        console.error('razorpay-webhook: inviteUserByEmail failed', inviteErr);
      }
    } catch (e) {
      console.error('razorpay-webhook: account resolution failed', e);
    }
  }

  if (!userId) return { enrollmentId: null, dbError: 'Could not resolve or create an account for the checkout email.' };
  if (!courseId) return { enrollmentId: null, dbError: 'No courseId on this order notes.' };

  let resolvedCourseId = null;
  const lookupName = notes.courseName || COURSE_ID_TO_NAME[String(courseId)] || null;
  if (lookupName) {
    const { data: courseRow, error: courseLookupErr } = await supabase
      .from('courses')
      .select('id')
      .eq('name', lookupName)
      .maybeSingle();
    if (courseLookupErr) console.error('razorpay-webhook: course lookup failed', courseLookupErr);
    else if (courseRow) resolvedCourseId = courseRow.id;
  }
  if (!resolvedCourseId) return { enrollmentId: null, dbError: 'Could not resolve the Supabase course row for courseId "' + courseId + '".' };

  const { data: paymentRow, error: paymentErr } = await supabase
    .from('payments')
    .insert({
      user_id: userId,
      course_id: resolvedCourseId,
      razorpay_order_id: razorpayOrderId,
      razorpay_payment_id: razorpayPaymentId,
      amount: (amountPaise || 0) / 100,
      status: 'captured',
      raw_response: rawPaymentEntity
    })
    .select('id')
    .single();
  if (paymentErr) return { enrollmentId: null, dbError: paymentErr.message };

  const { data: enrollmentRow, error: enrollErr } = await supabase
    .from('enrollments')
    .insert({
      user_id: userId,
      course_id: resolvedCourseId,
      payment_id: paymentRow.id,
      status: 'active',
      purchased_at: new Date().toISOString()
    })
    .select('id')
    .single();
  if (enrollErr) return { enrollmentId: null, dbError: enrollErr.message };

  return { enrollmentId: enrollmentRow.id, dbError: null };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { RAZORPAY_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (e) {
    console.error('razorpay-webhook: failed to read raw body', e);
    return res.status(200).json({ received: true });
  }

  if (!RAZORPAY_WEBHOOK_SECRET) {
    console.error('razorpay-webhook: RAZORPAY_WEBHOOK_SECRET not configured on the server.');
    return res.status(400).json({ error: 'Webhook secret not configured.' });
  }

  const signature = req.headers['x-razorpay-signature'];
  const expectedSignature = crypto
    .createHmac('sha256', RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest('hex');

  /* timingSafeEqual prevents timing side-channel attacks on the compare;
     requires equal-length buffers, so length is checked first. */
  const sigBuf = Buffer.from(String(signature || ''));
  const expBuf = Buffer.from(expectedSignature);
  if (!signature || sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return res.status(400).json({ error: 'Invalid webhook signature.' });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch (e) {
    console.error('razorpay-webhook: could not parse JSON body', e);
    return res.status(200).json({ received: true });
  }

  // Only payment.captured is handled — return 200 for everything else so
  // Razorpay doesn't keep retrying events we deliberately ignore.
  if (event.event !== 'payment.captured') {
    return res.status(200).json({ received: true });
  }

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) throw new Error('Supabase service role env vars not configured.');

    const paymentEntity = (event.payload && event.payload.payment && event.payload.payment.entity) || {};
    const razorpayPaymentId = paymentEntity.id;
    const razorpayOrderId = paymentEntity.order_id;
    const notes = paymentEntity.notes || {};

    if (!razorpayPaymentId || !razorpayOrderId) {
      console.error('razorpay-webhook: payload missing payment id/order id', event);
      return res.status(200).json({ received: true });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Idempotency — verify-payment.js (browser-triggered) may have already
    // processed this exact payment before this webhook call arrived.
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id')
      .eq('razorpay_payment_id', razorpayPaymentId)
      .maybeSingle();
    if (existingPayment) {
      return res.status(200).json({ received: true, alreadyProcessed: true });
    }

    const { enrollmentId, dbError } = await recordVerifiedPayment(supabase, {
      razorpayOrderId,
      razorpayPaymentId,
      amountPaise: paymentEntity.amount,
      notes,
      rawPaymentEntity: paymentEntity
    });

    if (dbError) console.error('razorpay-webhook: DB write incomplete —', dbError);
    return res.status(200).json({ received: true, enrollmentId, dbError });
  } catch (err) {
    console.error('razorpay-webhook: unexpected error', err);
    return res.status(200).json({ received: true });
  }
};

module.exports.config = {
  api: {
    bodyParser: false
  }
};
