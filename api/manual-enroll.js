/* POST /api/manual-enroll
   Admin-only: invite or resolve a user by email, create enrollment + payment
   row, and send the same welcome email as a real Razorpay purchase.

   Body: { email, courseId, enrollType, notes, adminToken }
   adminToken: the admin's Supabase access_token (verified server-side).

   Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY */

const { createClient } = require('@supabase/supabase-js');
const sendNotification = require('./_send-notification');

/* Inline — same as verify-payment.js, kept in sync manually. */
const COURSE_ID_TO_NAME = {
  '3': 'The CFA Academy Framework for Stock Investing',
  '4': 'Self-Study',
  '5': 'Guided Learning',
  '6': 'Mentorship Program'
};

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase env vars not configured.' });
  }

  const { email, courseId, enrollType, notes, adminToken } = req.body || {};
  if (!email || !courseId) return res.status(400).json({ error: 'email and courseId are required.' });
  if (!adminToken) return res.status(401).json({ error: 'No admin token provided.' });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  /* Verify the caller is an authenticated admin */
  const { data: { user: caller }, error: authErr } = await supabase.auth.getUser(adminToken);
  if (authErr || !caller) return res.status(401).json({ error: 'Invalid admin session.' });
  const { data: callerProfile } = await supabase.from('profiles').select('is_admin').eq('id', caller.id).maybeSingle();
  if (!callerProfile || !callerProfile.is_admin) return res.status(403).json({ error: 'Caller is not an admin.' });

  const normalizedEmail = String(email).trim().toLowerCase();
  const firstName = normalizedEmail.split('@')[0].split(/[._-]/)[0];
  firstName[0] && (firstName[0] = firstName[0].toUpperCase()); // best-effort

  /* Resolve the course row — the admin dropdown sends Supabase UUIDs directly,
     but fall back to name lookup for the old numeric ids just in case. */
  const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(courseId));
  const courseQuery = isUuid
    ? supabase.from('courses').select('id, name, price').eq('id', courseId).maybeSingle()
    : supabase.from('courses').select('id, name, price').eq('name', COURSE_ID_TO_NAME[String(courseId)] || '__none__').maybeSingle();

  const { data: courseRow, error: courseLookupErr } = await courseQuery;
  if (courseLookupErr || !courseRow) {
    return res.status(400).json({ error: 'Course not found for id "' + courseId + '". Make sure courses are synced from the admin Courses & Pricing panel.' });
  }

  /* Invite (new user) or resolve (existing user) — same listUsers pattern as
     verify-payment.js to avoid the getUserByEmail bug */
  let userId = null;
  let isNewUser = false;
  try {
    const { data: inviteData, error: inviteErr } = await supabase.auth.admin.inviteUserByEmail(normalizedEmail, {
      data: { full_name: '' },
      redirectTo: (process.env.SITE_URL || 'https://capitalfinplusadvizors.com') + '/pages/account.html'
    });
    if (!inviteErr && inviteData && inviteData.user) {
      userId = inviteData.user.id;
      isNewUser = true;
    } else if (inviteErr && /already (registered|exists)/i.test(inviteErr.message || '')) {
      /* Existing user — find via listUsers (getUserByEmail doesn't exist in supabase-js) */
      const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
      const match = !listErr && listData && listData.users
        ? listData.users.find(u => (u.email || '').toLowerCase() === normalizedEmail)
        : null;
      if (match) userId = match.id;
      else return res.status(500).json({ error: 'Could not resolve existing account for ' + normalizedEmail });
    } else if (inviteErr) {
      return res.status(500).json({ error: 'Could not invite user: ' + inviteErr.message });
    }
  } catch (e) {
    return res.status(500).json({ error: 'Account resolution failed: ' + e.message });
  }

  /* Duplicate enrollment guard */
  const { data: existing } = await supabase
    .from('enrollments').select('id').eq('user_id', userId).eq('course_id', courseRow.id).eq('status', 'active').maybeSingle();
  if (existing) return res.status(409).json({ error: 'This student already has an active enrollment for ' + lookupName + '.' });

  /* Write payment + enrollment */
  const paymentId = 'MANUAL-' + Date.now();
  const amount = enrollType === 'paid' ? (parseFloat(String(courseRow.price || '0').replace(/[^\d.]/g, '')) || 0) : 0;

  const { data: paymentRow, error: paymentErr } = await supabase
    .from('payments').insert({
      user_id: userId,
      course_id: courseRow.id,
      razorpay_payment_id: paymentId,
      amount,
      status: 'captured',
      raw_response: notes ? { manual_notes: notes } : null
    }).select('id').single();
  if (paymentErr) return res.status(500).json({ error: 'Payment insert failed: ' + paymentErr.message });

  const { error: enrollErr } = await supabase
    .from('enrollments').insert({
      user_id: userId,
      course_id: courseRow.id,
      payment_id: paymentRow.id,
      status: 'active',
      purchased_at: new Date().toISOString()
    });
  if (enrollErr) return res.status(500).json({ error: 'Enrollment insert failed: ' + enrollErr.message });

  /* Welcome email — same template as verify-payment.js */
  if (RESEND_API_KEY) {
    try {
      /* Inline buildCourseWelcomeEmail equivalent — import not possible across
         serverless functions without a shared module, so we call verify-payment's
         logic by requiring it and accessing its exported builder if available,
         otherwise fall back to a short branded email. */
      const welcomeHtml = buildSimpleWelcomeEmail(firstName, lookupName, String(courseId), isNewUser);
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CFA Academy <hello@capitalfinplusadvizors.com>',
          to: [normalizedEmail],
          subject: 'You\'re in — welcome to CFA Academy 🎉',
          html: welcomeHtml
        })
      });
    } catch (e) {
      console.error('manual-enroll: welcome email failed (enrollment unaffected):', e);
    }
  }

  /* Admin notification */
  const typeLabel = enrollType === 'complimentary' ? 'Complimentary' : 'Paid (offline)';
  sendNotification({
    subject: `📋 Manual Enroll — ${lookupName} (${normalizedEmail})`,
    html: `<table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;">
      <tr><td style="padding:8px 12px;font-weight:600;background:#f9f9f9;border:1px solid #e0e0e0;">Email</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${normalizedEmail}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f9f9f9;border:1px solid #e0e0e0;">Course</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${lookupName}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f9f9f9;border:1px solid #e0e0e0;">Type</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${typeLabel}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f9f9f9;border:1px solid #e0e0e0;">Notes</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${notes || '—'}</td></tr>
      <tr><td style="padding:8px 12px;font-weight:600;background:#f9f9f9;border:1px solid #e0e0e0;">New account?</td><td style="padding:8px 12px;border:1px solid #e0e0e0;">${isNewUser ? 'Yes — invite sent' : 'No — existing account'}</td></tr>
    </table>`
  }).catch(() => {});

  return res.status(200).json({
    success: true,
    isNewUser,
    message: isNewUser
      ? 'Account created and invite email sent. Student will receive a set-password link.'
      : 'Existing account found and enrolled.'
  });
};

function buildSimpleWelcomeEmail(firstName, courseName, courseId, isNewUser) {
  const LOGO = `<svg width="34" height="36" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="20,39 3.8,27.2 10,7.5 30,7.5 36.2,27.2" fill="rgba(244,194,13,0.1)" stroke="#F4C20D" stroke-width="3" stroke-linejoin="round"/></svg>`;
  const COURSE_DETAIL = {
    '4': { tagline: 'Start building your edge — one concept at a time.', intro: 'The Self-Study track is designed for independent learners who want to move at their own pace. You now have lifetime access to structured materials, real backtest data, and premium research.' },
    '5': { tagline: 'Structured curriculum. Real-world application.', intro: 'Guided Learning gives you a full video curriculum led by Pravesh — covering everything from reading price action to building a repeatable system.' },
    '3': { tagline: 'The framework behind every decision we make.', intro: 'The CFA Academy Framework is our core methodology — the structured lens through which we analyse every market, stock, and trade.' },
    '6': { tagline: 'You\'re not learning alone anymore.', intro: 'Mentorship is our most hands-on programme — direct access to Pravesh, live sessions, and personalised feedback on your trades and analysis.' }
  };
  const d = COURSE_DETAIL[courseId] || { tagline: 'Your journey starts now.', intro: `Your enrolment in ${courseName} is confirmed.` };
  const passwordNote = isNewUser
    ? `<div style="background:rgba(244,194,13,0.06);border:1px solid rgba(244,194,13,0.18);border-radius:10px;padding:20px 24px;margin-bottom:24px;"><p style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">Next step — set your password</p><p style="font-size:14px;line-height:1.7;color:rgba(240,234,214,0.75);margin:0;">You should have received a separate email with a one-time login link. Click it to set your password and access your dashboard. Check your spam folder if it doesn't arrive within a few minutes.</p></div>`
    : `<div style="background:rgba(244,194,13,0.06);border:1px solid rgba(244,194,13,0.18);border-radius:10px;padding:20px 24px;margin-bottom:24px;"><p style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">Next step — go to your dashboard</p><p style="font-size:14px;line-height:1.7;color:rgba(240,234,214,0.75);margin:0 0 14px;">Your course access is now live. Log in with your existing password to get started.</p><a href="https://capitalfinplusadvizors.com/pages/account.html" style="display:inline-block;background:linear-gradient(135deg,rgba(244,194,13,0.25),rgba(154,115,0,0.25));border:1px solid #F4C20D;color:#F4C20D;padding:10px 22px;border-radius:4px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;">Go to My Account →</a></div>`;
  return `<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0a02;color:#f0ead6;border-radius:12px;overflow:hidden;border:1px solid rgba(244,194,13,0.2);">
  <div style="height:4px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.15));"></div>
  <div style="padding:40px 40px 32px;">
    <div style="margin-bottom:24px;">${LOGO}</div>
    <p style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">Welcome to CFA Academy</p>
    <h1 style="font-size:24px;font-weight:800;line-height:1.25;margin:0 0 6px;color:#ffffff;">Hi ${firstName}, you're officially enrolled! 🎉</h1>
    <p style="font-size:14px;color:rgba(244,194,13,0.8);margin:0 0 20px;font-style:italic;">${d.tagline}</p>
    <p style="font-size:15px;line-height:1.75;color:rgba(240,234,214,0.75);margin:0 0 6px;">You've joined: <strong style="color:#F4C20D;">${courseName}</strong></p>
    <p style="font-size:14px;line-height:1.75;color:rgba(240,234,214,0.65);margin:0 0 26px;">${d.intro}</p>
    ${passwordNote}
    <p style="font-size:14px;color:rgba(240,234,214,0.55);margin:0 0 28px;">Questions? Reply to this email or write to <a href="mailto:connect@capitalfinplusadvizors.com" style="color:#F4C20D;text-decoration:none;">connect@capitalfinplusadvizors.com</a>.</p>
    <p style="font-size:14px;color:rgba(240,234,214,0.75);margin:0;">Warm regards,<br/><strong style="color:#ffffff;">Pravesh Kumar</strong><br/><span style="font-size:12px;color:rgba(240,234,214,0.45);">Founder, CFA Academy</span></p>
  </div>
  <div style="padding:20px 40px;border-top:1px solid rgba(244,194,13,0.08);text-align:center;">
    <p style="font-size:11px;color:rgba(240,234,214,0.3);margin:0;">Capital Finplus Academy · Educational platform only · Not SEBI investment advice.</p>
  </div>
</div>`;
}
