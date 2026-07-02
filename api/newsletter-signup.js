/* ==============================================
   Vercel Serverless Function — POST /api/newsletter-signup
   Inserts a newsletter subscriber and sends a welcome email via Resend.
   Always returns 200 so the browser can show success immediately.
   Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY
   ============================================== */

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { email, name } = req.body || {};
  const normalizedEmail = String(email || '').trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes('@')) {
    return res.status(400).json({ ok: false, reason: 'Invalid email.' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY } = process.env;
  let duplicate = false;

  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from('newsletter_subscribers').insert({
      email: normalizedEmail,
      name: String(name || '').trim(),
      source: 'signup'
    });
    if (error) {
      if (error.code === '23505') {
        duplicate = true; // already subscribed — still send success to the user
      } else {
        console.error('newsletter-signup: DB insert failed', error);
      }
    }
  }

  // Welcome email — fire-and-forget, never blocks the response
  if (RESEND_API_KEY && !duplicate) {
    const firstName = String(name || '').trim().split(' ')[0] || 'there';
    const html = `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0a02;color:#f0ead6;border-radius:12px;overflow:hidden;border:1px solid rgba(244,194,13,0.2);">
  <div style="height:4px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.15));"></div>
  <div style="padding:40px 40px 32px;">
    <div style="margin-bottom:24px;">
      <svg width="34" height="36" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="20,39 3.8,27.2 10,7.5 30,7.5 36.2,27.2" fill="rgba(244,194,13,0.1)" stroke="#F4C20D" stroke-width="3" stroke-linejoin="round"/>
      </svg>
    </div>
    <p style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">CFA Academy · Market Intelligence</p>
    <h1 style="font-size:24px;font-weight:800;line-height:1.25;margin:0 0 18px;color:#ffffff;">Welcome, ${firstName}. You're on the inside now.</h1>
    <p style="font-size:15px;line-height:1.75;color:rgba(240,234,214,0.75);margin:0 0 28px;">
      You've just joined a community of traders and investors who take the craft seriously. Every week we share real backtest data, market breakdowns, and honest insights — no noise, no promotions.
    </p>
    <div style="background:rgba(244,194,13,0.06);border:1px solid rgba(244,194,13,0.15);border-radius:10px;padding:24px 28px;margin-bottom:28px;">
      <p style="font-size:12px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(244,194,13,0.7);margin:0 0 14px;">What lands in your inbox</p>
      <ul style="margin:0;padding:0;list-style:none;">
        <li style="padding:6px 0;font-size:14px;color:rgba(240,234,214,0.8);"><span style="color:#F4C20D;font-weight:700;margin-right:10px;">→</span>Weekly market breakdowns &amp; sector analysis</li>
        <li style="padding:6px 0;font-size:14px;color:rgba(240,234,214,0.8);"><span style="color:#F4C20D;font-weight:700;margin-right:10px;">→</span>Backtesting results with raw numbers</li>
        <li style="padding:6px 0;font-size:14px;color:rgba(240,234,214,0.8);"><span style="color:#F4C20D;font-weight:700;margin-right:10px;">→</span>Strategy notes from Pravesh's live trades</li>
        <li style="padding:6px 0;font-size:14px;color:rgba(240,234,214,0.8);"><span style="color:#F4C20D;font-weight:700;margin-right:10px;">→</span>Early access to new course content &amp; offers</li>
      </ul>
    </div>
    <div style="background:rgba(255,255,255,0.03);border-left:3px solid #F4C20D;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:28px;">
      <p style="font-size:14px;line-height:1.65;color:rgba(240,234,214,0.7);margin:0;">
        Want to go deeper? <a href="https://capitalfinplusadvizors.com/pages/courses.html" style="color:#F4C20D;text-decoration:none;font-weight:600;">Explore our courses →</a>
        <br/>Free preview articles are available on the <a href="https://capitalfinplusadvizors.com/pages/blog.html" style="color:#F4C20D;text-decoration:none;">blog</a> right now.
      </p>
    </div>
    <p style="font-size:14px;color:rgba(240,234,214,0.75);margin:0;">
      Warm regards,<br/>
      <strong style="color:#ffffff;">Pravesh Kumar</strong><br/>
      <span style="font-size:12px;color:rgba(240,234,214,0.45);">Founder, CFA Academy</span>
    </p>
  </div>
  <div style="padding:20px 40px;border-top:1px solid rgba(244,194,13,0.08);text-align:center;">
    <p style="font-size:11px;color:rgba(240,234,214,0.3);margin:0;">
      You're receiving this because you signed up at capitalfinplusadvizors.com.<br/>
      To unsubscribe, reply with "unsubscribe" in the subject line.<br/>
      Capital Finplus Academy · Not SEBI investment advice.
    </p>
  </div>
</div>`.trim();

    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CFA Academy <hello@capitalfinplusadvizors.com>',
        to: [normalizedEmail],
        subject: 'You\'re in — welcome to CFA Academy 📬',
        html
      })
    }).catch(e => console.error('newsletter-signup: welcome email failed', e));
  }

  return res.status(200).json({ ok: true, duplicate });
};
