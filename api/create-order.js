/* ==============================================
   Vercel Serverless Function — POST /api/create-order
   Creates a Razorpay order server-side so the Key Secret
   never touches the browser.

   SECURITY: the order amount is computed entirely server-side
   from the course price map + enrollment upgrade credit + coupon
   (validated against Supabase here, not trusted from the client).
   The client's claimed amount is ignored — a tampered request
   cannot buy a course for less than its real price.

   Env vars required:
     RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
     SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  (credit + coupon lookups)
   ============================================== */

const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');

/* Course prices in rupees — single source of truth for checkout.
   MUST match data.js course cards. GST (18%) is added on top. */
const COURSE_PRICE_RUPEES = {
  '3': 4999,  // The CFA Academy Framework for Stock Investing
  '4': 860,   // Self-Study
  '5': 6500,  // Guided Learning
  '6': 24000  // Mentorship Program
};

/* Upgrade credit rules — mirror payment.html applyUpgradeCredit() */
const COURSE_CREDIT_MAP = {
  'Self-Study': 860,
  'Guided Learning': 6500,
  'The CFA Academy Framework for Stock Investing': 4999
};

async function computeUpgradeCredit(supabase, userId, courseId) {
  if (!userId) return 0;
  const { data: enrollments, error } = await supabase
    .from('enrollments')
    .select('courses(name)')
    .eq('user_id', userId)
    .eq('status', 'active');
  if (error || !enrollments || !enrollments.length) return 0;
  const names = enrollments.map(e => e.courses && e.courses.name).filter(Boolean);
  if (String(courseId) === '5') {
    return names.includes('Self-Study') ? 860 : 0;
  }
  if (String(courseId) === '6') {
    return names.reduce((max, n) => Math.max(max, COURSE_CREDIT_MAP[n] || 0), 0);
  }
  return 0;
}

/* Server-side coupon validation — same rules as validate-coupon.js
   (dates, max uses, one use per email). Returns discounted fee or
   the fee unchanged if the coupon is invalid. */
async function applyCoupon(supabase, code, email, feeRupees) {
  const normalizedCode = String(code).trim().toUpperCase();
  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle();
  if (error || !coupon) return feeRupees;

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) return feeRupees;
  if (coupon.valid_until && new Date(coupon.valid_until) < now) return feeRupees;

  if (coupon.max_uses !== null) {
    const { count } = await supabase
      .from('coupon_uses')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id);
    if (count >= coupon.max_uses) return feeRupees;
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const { data: existingUse } = await supabase
    .from('coupon_uses')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (existingUse) return feeRupees;

  if (coupon.discount_type === 'percent') {
    return Math.round(feeRupees * (1 - coupon.discount_value / 100));
  }
  return Math.max(1, feeRupees - coupon.discount_value);
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!RAZORPAY_KEY_ID || !RAZORPAY_KEY_SECRET) {
    return res.status(500).json({ error: 'Razorpay keys are not configured on the server yet.' });
  }

  const { amount, courseId, courseName, name, email, phone, user_id, couponCode } = req.body || {};

  if (!name || !email || !phone) {
    return res.status(400).json({ error: 'Name, email, and phone are required.' });
  }

  const basePrice = COURSE_PRICE_RUPEES[String(courseId)];
  if (!basePrice) {
    return res.status(400).json({ error: 'Unknown course.' });
  }

  try {
    /* Recompute the checkout amount from scratch, server-side:
       base price -> minus upgrade credit -> minus coupon -> plus 18% GST.
       Mirrors payment.html's display math exactly. */
    let effectiveFee = basePrice;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const credit = await computeUpgradeCredit(supabase, user_id || null, courseId);
      effectiveFee = Math.max(1, basePrice - credit);
      if (couponCode) {
        effectiveFee = await applyCoupon(supabase, couponCode, email, effectiveFee);
      }
    }

    const gst = Math.round(effectiveFee * 0.18);
    const serverAmountPaise = (effectiveFee + gst) * 100;

    /* The client sends its own computed amount for display; if it doesn't
       match what we computed, log it (tampering or a math drift bug) but
       always charge the server-side figure. */
    if (typeof amount === 'number' && amount !== serverAmountPaise) {
      console.warn(`create-order: client amount ${amount} != server amount ${serverAmountPaise} (course ${courseId}, email ${email})`);
    }

    const razorpay = new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });

    /* user_id rides along in Razorpay's own order notes so verify-payment
       can fetch it straight from Razorpay (trusted, since it was set here
       server-side) instead of trusting whatever the client claims at
       verification time. */
    const order = await razorpay.orders.create({
      amount: serverAmountPaise,
      currency: 'INR',
      receipt: 'cfa_' + Date.now(),
      notes: { courseId: String(courseId || ''), courseName: courseName || '', name, email, phone, user_id: user_id || '', couponCode: couponCode || '' }
    });

    return res.status(200).json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: RAZORPAY_KEY_ID // public key id — safe to send to the browser
    });
  } catch (err) {
    console.error('create-order failed', err);
    return res.status(500).json({ error: 'Could not create Razorpay order.' });
  }
};
