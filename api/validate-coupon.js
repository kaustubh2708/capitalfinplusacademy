/* ==============================================
   Vercel Serverless Function — POST /api/validate-coupon
   Validates a promo code without recording a use.
   Use is recorded later in verify-payment.js after payment confirms.
   Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   ============================================== */

const { createClient } = require('@supabase/supabase-js');

// In-memory rate limiter — 10 attempts per IP per 60 s.
// Vercel may spin up multiple instances so this isn't global, but it
// stops a single-instance brute-force burst effectively.
const _rl = new Map();
const RL_MAX = 10;
const RL_WINDOW = 60_000;

function rateLimit(ip) {
  const now = Date.now();
  const e = _rl.get(ip);
  if (!e || now > e.r) { _rl.set(ip, { c: 1, r: now + RL_WINDOW }); return true; }
  if (e.c >= RL_MAX) return false;
  e.c++;
  return true;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ valid: false, reason: 'Method not allowed' });
  }

  const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
  if (!rateLimit(ip)) {
    return res.status(429).json({ valid: false, reason: 'Too many attempts. Please wait a minute and try again.' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ valid: false, reason: 'Server configuration error.' });
  }

  const { code, email, courseId } = req.body || {};
  if (!code || !email || !courseId) {
    return res.status(400).json({ valid: false, reason: 'Missing required fields.' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const normalizedCode = String(code).trim().toUpperCase();

  const { data: coupon, error } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', normalizedCode)
    .maybeSingle();

  if (error || !coupon) {
    return res.status(200).json({ valid: false, reason: 'Invalid code.' });
  }

  const now = new Date();
  if (coupon.valid_from && new Date(coupon.valid_from) > now) {
    return res.status(200).json({ valid: false, reason: 'This code is not yet active.' });
  }
  if (coupon.valid_until && new Date(coupon.valid_until) < now) {
    return res.status(200).json({ valid: false, reason: 'Code expired.' });
  }

  if (coupon.max_uses !== null) {
    const { count, error: countErr } = await supabase
      .from('coupon_uses')
      .select('id', { count: 'exact', head: true })
      .eq('coupon_id', coupon.id);
    if (!countErr && count >= coupon.max_uses) {
      return res.status(200).json({ valid: false, reason: 'This code has reached its usage limit.' });
    }
  }

  const normalizedEmail = String(email).trim().toLowerCase();
  const { data: existingUse } = await supabase
    .from('coupon_uses')
    .select('id')
    .eq('coupon_id', coupon.id)
    .eq('email', normalizedEmail)
    .maybeSingle();
  if (existingUse) {
    return res.status(200).json({ valid: false, reason: 'This code has already been used for your email.' });
  }

  // Compute discounted amount (base fee in rupees, no GST — GST is added after on the client)
  const { courseFeeRupees } = req.body || {};
  let discountedAmount = null;
  if (typeof courseFeeRupees === 'number' && courseFeeRupees > 0) {
    if (coupon.discount_type === 'percent') {
      discountedAmount = Math.round(courseFeeRupees * (1 - coupon.discount_value / 100));
    } else {
      discountedAmount = Math.max(1, courseFeeRupees - coupon.discount_value);
    }
  }

  return res.status(200).json({
    valid: true,
    discountType: coupon.discount_type,
    discountValue: Number(coupon.discount_value),
    discountedAmount
  });
};
