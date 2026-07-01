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

   api/razorpay-webhook.js now serves as the server-to-server safety
   net for this — it listens for Razorpay's `payment.captured` event
   directly, so a customer closing the tab right after paying (before
   this browser-triggered endpoint ever fires) still gets their
   payment/enrollment rows written. Both endpoints check for an
   existing payments row by razorpay_payment_id first, so whichever
   one runs first does the real work and the other just no-ops.
   ============================================== */

const crypto = require('crypto');
const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');
const sendNotification = require('./send-notification');

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
    const courseId = notes.courseId || null;
    const checkoutEmail = notes.email ? String(notes.email).trim().toLowerCase() : null;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    /* Idempotency: api/razorpay-webhook.js may already have processed this
       exact payment server-to-server (e.g. if the browser was slow to
       call this endpoint). Whichever of the two runs first does the real
       work; the other just reports the existing enrollment back. */
    const { data: existingPayment } = await supabase
      .from('payments')
      .select('id, enrollment:enrollments(id)')
      .eq('razorpay_payment_id', razorpay_payment_id)
      .maybeSingle();
    if (existingPayment) {
      const existingEnrollmentId = (existingPayment.enrollment && existingPayment.enrollment[0] && existingPayment.enrollment[0].id) || null;
      return res.status(200).json({
        verified: true,
        success: true,
        paymentId: razorpay_payment_id,
        orderId: razorpay_order_id,
        enrollmentId: existingEnrollmentId,
        dbError: null
      });
    }

    /* payments.course_id / enrollments.course_id are real uuid FKs to
       courses.id — courseId here is the data.js-style id ("4" etc.) used
       everywhere in URLs/order notes, NOT that uuid. Resolve the real
       uuid by course name before inserting, or those inserts throw a
       Postgres type error (caught below, surfaced as dbError, payment
       still reports success — but the enrollment silently never gets
       created). courseName comes straight from the order notes already;
       this id->name map is just a fallback if that's ever missing. */
    const COURSE_ID_TO_NAME = {
      '3': 'The CFA Academy Framework for Stock Investing',
      '4': 'Self-Study',
      '5': 'Guided Learning',
      '6': 'Mentorship Program'
    };
    let resolvedCourseId = null;
    if (courseId) {
      const lookupName = notes.courseName || COURSE_ID_TO_NAME[String(courseId)] || null;
      if (lookupName) {
        const { data: courseRow, error: courseLookupErr } = await supabase
          .from('courses')
          .select('id')
          .eq('name', lookupName)
          .maybeSingle();
        if (courseLookupErr) console.error('verify-payment: course lookup failed', courseLookupErr);
        else if (courseRow) resolvedCourseId = courseRow.id;
      }
    }

    /* Every paid-course buyer is automatically added to the newsletter list
       (source:'purchase') — independent of the enrollment flow below, and
       never allowed to fail the payment response. unique (email, source)
       on the table means a repeat buyer just no-ops here instead of
       erroring. */
    if (checkoutEmail) {
      await supabase.from('newsletter_subscribers').insert({
        email: checkoutEmail,
        name: notes.name || '',
        source: 'purchase',
        course_id: courseId,
        course_name: notes.courseName || ''
      }).then(res => {
        if (res.error && res.error.code !== '23505') console.error('verify-payment: newsletter insert failed', res.error);
      });
    }

    /* Every purchase results in an account, matched/created by the email
       typed at checkout — regardless of whether the buyer was logged in
       under a different email. New accounts get Supabase's built-in
       invite email (welcome + one-time set-password link); existing
       accounts are just matched by email so the enrollment attaches to
       them, no email needed since they already have a password. */
    let userId = null;
    if (checkoutEmail) {
      try {
        const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(checkoutEmail, {
          data: { full_name: notes.name || '' },
          redirectTo: (process.env.SITE_URL || 'https://capitalfinplusadvizors.com') + '/account.html'
        });
        if (!inviteErr && inviteData && inviteData.user) {
          userId = inviteData.user.id;
        } else if (inviteErr && /already (registered|exists)/i.test(inviteErr.message || '')) {
          const { data: existingUser, error: lookupErr } = await supabase.auth.admin.getUserByEmail(checkoutEmail);
          if (existingUser && existingUser.user) userId = existingUser.user.id;
          else console.error('verify-payment: could not resolve existing user id for', checkoutEmail, lookupErr);
        } else if (inviteErr) {
          console.error('verify-payment: inviteUserByEmail failed', inviteErr);
        }
      } catch (e) {
        console.error('verify-payment: account resolution failed', e);
      }
    }

    if (!userId) {
      dbError = 'Could not resolve or create an account for the checkout email — payment was not linked to an account.';
    } else if (!courseId) {
      dbError = 'No courseId on this order — payment was not linked to a course.';
    } else if (!resolvedCourseId) {
      dbError = 'Could not resolve the Supabase course row for courseId "' + courseId + '" — payment was not linked to a course.';
    } else {
      const { data: paymentRow, error: paymentErr } = await supabase
        .from('payments')
        .insert({
          user_id: userId,
          course_id: resolvedCourseId,
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
          course_id: resolvedCourseId,
          payment_id: paymentRow.id,
          status: 'active',
          purchased_at: new Date().toISOString()
        })
        .select('id')
        .single();
      if (enrollErr) throw enrollErr;

      enrollmentId = enrollmentRow.id;

      // Send welcome email to the student (fire-and-forget, never fails the response)
      try {
        const resendKey = process.env.RESEND_API_KEY;
        if (resendKey && checkoutEmail) {
          const studentName = notes.name ? String(notes.name).split(' ')[0] : 'there';
          const courseLabel = notes.courseName || COURSE_ID_TO_NAME[String(courseId)] || 'your course';
          const hasPdf = true;
          const hasVideos = ['Guided Learning', 'The CFA Academy Framework for Stock Investing', 'Mentorship Program'].includes(courseLabel);
          const welcomeHtml = `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0a02;color:#f0ead6;border-radius:12px;overflow:hidden;border:1px solid rgba(244,194,13,0.2);">
  <div style="height:4px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.2));"></div>
  <div style="padding:40px 40px 32px;">
    <div style="margin-bottom:28px;">
      <svg width="36" height="38" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="20,39 3.8,27.2 10,7.5 30,7.5 36.2,27.2" fill="rgba(244,194,13,0.1)" stroke="#F4C20D" stroke-width="3" stroke-linejoin="round"/>
      </svg>
    </div>
    <p style="font-size:13px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">Welcome to CFA Academy</p>
    <h1 style="font-size:26px;font-weight:800;line-height:1.2;margin:0 0 20px;color:#ffffff;">Hi ${studentName}, you're officially enrolled! 🎉</h1>
    <p style="font-size:15px;line-height:1.7;color:rgba(240,234,214,0.75);margin:0 0 24px;">
      Your enrolment in <strong style="color:#F4C20D;">${courseLabel}</strong> is confirmed. We're genuinely excited to have you — this is the start of something great.
    </p>
    <div style="background:rgba(244,194,13,0.06);border:1px solid rgba(244,194,13,0.18);border-radius:10px;padding:24px 28px;margin-bottom:28px;">
      <p style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(244,194,13,0.7);margin:0 0 14px;">What you now have access to</p>
      <ul style="margin:0;padding:0;list-style:none;">
        ${hasPdf ? `<li style="padding:6px 0;font-size:14px;color:rgba(240,234,214,0.8);display:flex;align-items:center;gap:10px;"><span style="color:#F4C20D;font-weight:700;">→</span> Course PDF &amp; study materials</li>` : ''}
        ${hasVideos ? `<li style="padding:6px 0;font-size:14px;color:rgba(240,234,214,0.8);display:flex;align-items:center;gap:10px;"><span style="color:#F4C20D;font-weight:700;">→</span> Full video lesson library</li>` : ''}
        <li style="padding:6px 0;font-size:14px;color:rgba(240,234,214,0.8);display:flex;align-items:center;gap:10px;"><span style="color:#F4C20D;font-weight:700;">→</span> Premium backtest data &amp; analysis</li>
        <li style="padding:6px 0;font-size:14px;color:rgba(240,234,214,0.8);display:flex;align-items:center;gap:10px;"><span style="color:#F4C20D;font-weight:700;">→</span> Blog articles &amp; research</li>
      </ul>
    </div>
    <div style="background:rgba(255,255,255,0.03);border-left:3px solid #F4C20D;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:28px;">
      <p style="font-size:14px;line-height:1.65;color:rgba(240,234,214,0.7);margin:0;">
        <strong style="color:#ffffff;">Next step:</strong> You'll receive a separate email from Supabase with a one-time link to set your password and log in to your dashboard. Check your spam folder if it doesn't arrive within a few minutes.
      </p>
    </div>
    <p style="font-size:14px;line-height:1.65;color:rgba(240,234,214,0.6);margin:0 0 32px;">
      Have a question? Just reply to this email or reach us at <a href="mailto:connect@capitalfinplusadvizors.com" style="color:#F4C20D;text-decoration:none;">connect@capitalfinplusadvizors.com</a> — we typically respond within a few hours.
    </p>
    <p style="font-size:14px;color:rgba(240,234,214,0.75);margin:0;">Warm regards,<br/><strong style="color:#ffffff;">Pravesh Kumar</strong><br/><span style="font-size:12px;color:rgba(240,234,214,0.45);">Founder, CFA Academy</span></p>
  </div>
  <div style="padding:20px 40px;border-top:1px solid rgba(244,194,13,0.1);text-align:center;">
    <p style="font-size:11px;color:rgba(240,234,214,0.3);margin:0;">Capital Finplus Academy · Educational platform only · Not SEBI investment advice</p>
  </div>
</div>`.trim();
          await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              from: 'CFA Academy <hello@capitalfinplusadvizors.com>',
              to: [checkoutEmail],
              subject: 'Welcome to CFA Academy — you\'re officially enrolled 🎉',
              html: welcomeHtml
            })
          });
        }
      } catch (welcomeErr) {
        console.error('verify-payment: welcome email failed (enrollment unaffected):', welcomeErr);
      }

      // Send admin notification (fire-and-forget, never fails the response)
      const amountRupees = (payment.amount || 0) / 100;
      const courseLabelForEmail = notes.courseName || COURSE_ID_TO_NAME[String(courseId)] || courseId || '—';
      const rows = [
        ['Name', notes.name || '—'],
        ['Email', checkoutEmail || '—'],
        ['Phone', notes.phone || '—'],
        ['Course', courseLabelForEmail],
        ['Amount', '₹' + amountRupees.toLocaleString('en-IN')],
        ['Payment ID', razorpay_payment_id],
        ['Time', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST']
      ];
      const emailHtml = `<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;min-width:400px;">${rows.map(([k, v]) => `<tr><td style="padding:8px 12px;font-weight:600;color:#555;background:#f9f9f9;border:1px solid #e0e0e0;white-space:nowrap;">${k}</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td></tr>`).join('')}</table>`;
      sendNotification({ subject: `💰 New Payment — ${courseLabelForEmail} (${notes.name || checkoutEmail || '?'})`, html: emailHtml }).catch(() => {});

      // Record coupon use if a code was applied — idempotent, never fails the payment
      const couponCode = notes.couponCode ? String(notes.couponCode).trim().toUpperCase() : null;
      if (couponCode && checkoutEmail) {
        try {
          const { data: couponRow } = await supabase
            .from('coupons')
            .select('id')
            .eq('code', couponCode)
            .maybeSingle();
          if (couponRow) {
            const { error: useErr } = await supabase
              .from('coupon_uses')
              .insert({ coupon_id: couponRow.id, email: checkoutEmail, course_id: String(courseId || '') });
            if (useErr && useErr.code !== '23505') {
              console.error('verify-payment: coupon_uses insert failed', useErr);
            }
          }
        } catch (e) {
          console.error('verify-payment: coupon recording failed', e);
        }
      }
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
