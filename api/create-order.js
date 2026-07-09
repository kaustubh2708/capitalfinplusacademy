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

/* Fallback prices (rupees) used only when Supabase is unavailable.
   The live price is always read from the courses table first. */
const COURSE_PRICE_RUPEES = {
  '3': 4999,
  '4': 860,
  '5': 6500,
  '6': 24000
};

/* Fetch the admin-set price for a course from Supabase by matching the
   cta_link pattern (e.g. 'course=5'). Returns rupees as a number, or
   null if the row/price is not found. */
async function getCoursePriceFromSupabase(supabase, courseId) {
  const { data: course } = await supabase
    .from('courses')
    .select('price')
    .ilike('cta_link', `%course=${courseId}%`)
    .maybeSingle();
  if (!course || !course.price) return null;
  const n = parseFloat(String(course.price).replace(/[^\d.]/g, ''));
  return isNaN(n) || n <= 0 ? null : n;
}

async function computeUpgradeCredit(supabase, userId, courseId) {
  if (!userId) return 0;
  const [enrollRes, priceRes] = await Promise.all([
    supabase.from('enrollments').select('courses(name)').eq('user_id', userId).eq('status', 'active'),
    supabase.from('courses').select('name, price')
  ]);
  if (enrollRes.error || !enrollRes.data || !enrollRes.data.length) return 0;
  const names = enrollRes.data.map(e => e.courses && e.courses.name).filter(Boolean);
  const priceMap = {};
  (priceRes.data || []).forEach(r => {
    const n = parseFloat(String(r.price || '').replace(/[^\d.]/g, ''));
    if (!isNaN(n) && n > 0) priceMap[r.name] = n;
  });
  const fallback = { 'Self-Study': 860, 'Guided Learning': 6500, 'The CFA Academy Framework for Stock Investing': 4999 };
  const creditOf = name => priceMap[name] || fallback[name] || 0;
  if (String(courseId) === '5') return names.includes('Self-Study') ? creditOf('Self-Study') : 0;
  if (String(courseId) === '6') return names.reduce((max, n) => Math.max(max, creditOf(n)), 0);
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

  const fallbackPrice = COURSE_PRICE_RUPEES[String(courseId)];
  if (!fallbackPrice) {
    return res.status(400).json({ error: 'Unknown course.' });
  }

  try {
    /* Recompute the checkout amount from scratch, server-side:
       live Supabase price (or hardcoded fallback) -> minus upgrade credit
       -> minus coupon -> plus 18% GST. */
    let basePrice = fallbackPrice;
    let effectiveFee = basePrice;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const livePrice = await getCoursePriceFromSupabase(supabase, courseId);
      if (livePrice !== null) basePrice = livePrice;
      effectiveFee = basePrice;
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
    /* Razorpay SDK errors carry the useful message in err.error.description
       (e.g. key/account issues, amount limits) — surface it so checkout
       failures are diagnosable from the browser network tab. */
    const detail = (err && err.error && err.error.description) || (err && err.message) || null;
    return res.status(500).json({ error: 'Could not create Razorpay order.', detail });
  }
};
