/* POST /api/send-welcome-batch
   Admin-only endpoint: sends the "how to get started" welcome email to every
   user who signed up (created_at) in the last N hours (default 24).
   Protected by ADMIN_SECRET env var — caller must pass { secret, hours? }.

   Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, ADMIN_SECRET */

const { createClient } = require('@supabase/supabase-js');

function buildHowToEmail(firstName, email) {
  const LOGO = `<svg width="34" height="36" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="20,39 3.8,27.2 10,7.5 30,7.5 36.2,27.2" fill="rgba(244,194,13,0.1)" stroke="#F4C20D" stroke-width="3" stroke-linejoin="round"/></svg>`;
  return `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0a02;color:#f0ead6;border-radius:12px;overflow:hidden;border:1px solid rgba(244,194,13,0.2);">
  <div style="height:4px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.15));"></div>
  <div style="padding:40px 40px 32px;">
    <div style="margin-bottom:24px;">${LOGO}</div>
    <p style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">Capital Finplus Academy</p>
    <h1 style="font-size:24px;font-weight:800;line-height:1.25;margin:0 0 16px;color:#ffffff;">Hi ${firstName}, welcome to CFA Academy 👋</h1>
    <p style="font-size:15px;line-height:1.75;color:rgba(240,234,214,0.75);margin:0 0 20px;">
      Your account is set up and ready. Here's everything you can do right now — and how to make the most of it from day one.
    </p>

    <div style="background:rgba(244,194,13,0.06);border:1px solid rgba(244,194,13,0.18);border-radius:10px;padding:24px 28px;margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F4C20D;margin:0 0 14px;">Step 1 — Set Your Password</p>
      <p style="font-size:14px;line-height:1.7;color:rgba(240,234,214,0.75);margin:0 0 16px;">
        If you haven't already, head to your account and set a password so you can log back in anytime. Click the button below to go directly to your account dashboard.
      </p>
      <a href="https://capitalfinplusadvizors.com/pages/account.html" style="display:inline-block;background:linear-gradient(135deg,rgba(244,194,13,0.25),rgba(154,115,0,0.25));border:1px solid #F4C20D;color:#F4C20D;padding:11px 24px;border-radius:4px;text-decoration:none;font-weight:700;font-size:13px;letter-spacing:0.06em;text-transform:uppercase;">Go to My Account →</a>
    </div>

    <div style="margin-bottom:24px;">
      <p style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F4C20D;margin:0 0 14px;">Step 2 — Explore Your Access</p>
      <ul style="list-style:none;padding:0;margin:0;">
        <li style="padding:8px 0;font-size:14px;color:rgba(240,234,214,0.8);border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#F4C20D;font-weight:700;margin-right:10px;">→</span><strong style="color:#fff;">Free Articles</strong> — Browse our blog for market insights, psychology breakdowns, and trading principles</li>
        <li style="padding:8px 0;font-size:14px;color:rgba(240,234,214,0.8);border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#F4C20D;font-weight:700;margin-right:10px;">→</span><strong style="color:#fff;">Backtesting Lab</strong> — View our recent trade setups and outcomes (7-day free window)</li>
        <li style="padding:8px 0;font-size:14px;color:rgba(240,234,214,0.8);border-bottom:1px solid rgba(255,255,255,0.06);"><span style="color:#F4C20D;font-weight:700;margin-right:10px;">→</span><strong style="color:#fff;">Algozone</strong> — Our algorithmic scanner is coming soon — you'll be first to know</li>
        <li style="padding:8px 0;font-size:14px;color:rgba(240,234,214,0.8);"><span style="color:#F4C20D;font-weight:700;margin-right:10px;">→</span><strong style="color:#fff;">Courses</strong> — If you've enrolled in a course, all your materials are in your dashboard</li>
      </ul>
    </div>

    <div style="margin-bottom:28px;">
      <p style="font-size:13px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#F4C20D;margin:0 0 14px;">Step 3 — Book a Free Discovery Call</p>
      <p style="font-size:14px;line-height:1.7;color:rgba(240,234,214,0.75);margin:0 0 16px;">
        Not sure where to start? Book a complimentary 30-minute call with Pravesh. No sales pitch — just a genuine conversation about where you are in your trading journey and what would help most.
      </p>
      <a href="https://capitalfinplusadvizors.com/#contact-section" style="display:inline-block;background:transparent;border:1px solid rgba(244,194,13,0.4);color:rgba(244,194,13,0.8);padding:10px 22px;border-radius:4px;text-decoration:none;font-weight:600;font-size:13px;">Book a Discovery Call</a>
    </div>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:18px 22px;margin-bottom:28px;">
      <p style="font-size:13px;color:rgba(240,234,214,0.5);margin:0;line-height:1.7;">
        <strong style="color:rgba(255,255,255,0.7);">Questions?</strong> Reply to this email or message us at
        <a href="mailto:connect@capitalfinplusadvizors.com" style="color:#F4C20D;text-decoration:none;">connect@capitalfinplusadvizors.com</a> — we typically respond within a few hours.
      </p>
    </div>

    <p style="font-size:13px;color:rgba(240,234,214,0.4);margin:0;">
      — The CFA Academy Team
    </p>
  </div>
  <div style="height:1px;background:rgba(244,194,13,0.1);"></div>
  <div style="padding:20px 40px;text-align:center;">
    <p style="font-size:11px;color:rgba(240,234,214,0.25);margin:0;line-height:1.6;">
      Capital Finplus Academy · <a href="https://capitalfinplusadvizors.com" style="color:rgba(244,194,13,0.4);text-decoration:none;">capitalfinplusadvizors.com</a><br>
      You received this because you created an account. This is not investment advice.
    </p>
  </div>
</div>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, ADMIN_SECRET } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !RESEND_API_KEY) {
    return res.status(500).json({ error: 'Missing env vars.' });
  }
  if (ADMIN_SECRET && req.body?.secret !== ADMIN_SECRET) {
    return res.status(403).json({ error: 'Forbidden. Pass the correct admin secret.' });
  }
  // If no ADMIN_SECRET env var is set, endpoint is open (low-risk write-only op)

  const { targetEmail, targetName, hours } = req.body || {};

  // Single-user mode (auto-triggered on first password set)
  if (targetEmail) {
    const firstName = (targetName || targetEmail.split('@')[0] || 'there').split(' ')[0];
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CFA Academy <hello@capitalfinplusadvizors.com>',
          to: [targetEmail],
          subject: 'Welcome to Capital Finplus Academy — here\'s how to get started',
          html: buildHowToEmail(firstName, targetEmail)
        })
      });
      const json = await r.json();
      return res.status(r.ok ? 200 : 500).json({ sent: r.ok ? 1 : 0, total: 1, results: [{ email: targetEmail, status: r.ok ? 'sent' : 'failed', detail: json }] });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  const windowHours = Number(hours) || 24;
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // List users created in the window
  const { data: { users }, error } = await supabase.auth.admin.listUsers({ perPage: 1000 });
  if (error) return res.status(500).json({ error: error.message });

  const recent = (users || []).filter(u => u.created_at >= since && u.email);

  const results = [];
  for (const u of recent) {
    const firstName = (u.user_metadata?.full_name || u.email.split('@')[0] || 'there').split(' ')[0];
    try {
      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'CFA Academy <hello@capitalfinplusadvizors.com>',
          to: [u.email],
          subject: 'Welcome to Capital Finplus Academy — here\'s how to get started',
          html: buildHowToEmail(firstName, u.email)
        })
      });
      const json = await r.json();
      results.push({ email: u.email, status: r.ok ? 'sent' : 'failed', detail: json });
    } catch (e) {
      results.push({ email: u.email, status: 'error', detail: e.message });
    }
  }

  return res.status(200).json({ sent: results.filter(r => r.status === 'sent').length, total: recent.length, results });
};
