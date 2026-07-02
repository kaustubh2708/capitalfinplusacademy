/* ==============================================
   Vercel Serverless Function — POST /api/notify-form
   Fire-and-forget handler for form submissions (booking, contact, masterclass).
   1. Sends admin alert to connect@capitalfinplusadvizors.com
   2. Sends confirmation email to the person who submitted
   Always returns 200.
   ============================================== */

const sendNotification = require('./send-notification');

const CONFIRMATION_SUBJECTS = {
  booking: 'We\'ve received your discovery call request — CFA Academy',
  contact: 'Thanks for reaching out — CFA Academy',
  masterclass: 'You\'re registered for the free masterclass — CFA Academy'
};

const CONFIRMATION_INTROS = {
  booking: 'We\'ve received your discovery call request and will get back to you within a few hours to confirm your slot.',
  contact: 'We\'ve received your message and will respond within one business day.',
  masterclass: 'You\'re registered for our free masterclass session. We\'ll send you the joining details closer to the date.'
};

function buildConfirmationHtml(type, name) {
  const firstName = String(name || '').trim().split(' ')[0] || 'there';
  const intro = CONFIRMATION_INTROS[type] || 'We\'ve received your submission and will be in touch shortly.';
  return `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0a02;color:#f0ead6;border-radius:12px;overflow:hidden;border:1px solid rgba(244,194,13,0.2);">
  <div style="height:4px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.15));"></div>
  <div style="padding:40px 40px 32px;">
    <div style="margin-bottom:24px;">
      <svg width="34" height="36" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <polygon points="20,39 3.8,27.2 10,7.5 30,7.5 36.2,27.2" fill="rgba(244,194,13,0.1)" stroke="#F4C20D" stroke-width="3" stroke-linejoin="round"/>
      </svg>
    </div>
    <p style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">CFA Academy</p>
    <h1 style="font-size:22px;font-weight:800;line-height:1.3;margin:0 0 18px;color:#ffffff;">Hi ${firstName}, we got your message.</h1>
    <p style="font-size:15px;line-height:1.75;color:rgba(240,234,214,0.75);margin:0 0 24px;">${intro}</p>
    <div style="background:rgba(255,255,255,0.03);border-left:3px solid #F4C20D;padding:16px 20px;border-radius:0 8px 8px 0;margin-bottom:28px;">
      <p style="font-size:14px;line-height:1.65;color:rgba(240,234,214,0.7);margin:0;">
        Need to reach us directly? Email <a href="mailto:connect@capitalfinplusadvizors.com" style="color:#F4C20D;text-decoration:none;">connect@capitalfinplusadvizors.com</a> or find us on WhatsApp from the website.
      </p>
    </div>
    <p style="font-size:14px;color:rgba(240,234,214,0.75);margin:0;">
      Warm regards,<br/>
      <strong style="color:#ffffff;">Pravesh Kumar</strong><br/>
      <span style="font-size:12px;color:rgba(240,234,214,0.45);">Founder, CFA Academy</span>
    </p>
  </div>
  <div style="padding:20px 40px;border-top:1px solid rgba(244,194,13,0.08);text-align:center;">
    <p style="font-size:11px;color:rgba(240,234,214,0.3);margin:0;">Capital Finplus Academy · Not SEBI investment advice.</p>
  </div>
</div>`.trim();
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { type, name, email, phone, message, experience } = req.body || {};
  const typeLabel = type ? String(type).charAt(0).toUpperCase() + String(type).slice(1) : 'Form';

  // Admin notification
  const rows = [
    ['Type', typeLabel],
    ['Name', name || '—'],
    ['Email', email || '—'],
    ['Phone', phone || '—'],
    experience ? ['Experience', experience] : null,
    message ? ['Message', message] : null,
    ['Time', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST']
  ].filter(Boolean);

  const adminHtml = `
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;min-width:400px;">
      ${rows.map(([k, v]) => `
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#555;background:#f9f9f9;border:1px solid #e0e0e0;white-space:nowrap;">${k}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;">${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        </tr>`).join('')}
    </table>`;

  sendNotification({ subject: `📋 New ${typeLabel} form — ${name || email || 'Unknown'}`, html: adminHtml }).catch(() => {});

  // Confirmation email to the user (fire-and-forget)
  const resendKey = process.env.RESEND_API_KEY;
  const userEmail = String(email || '').trim().toLowerCase();
  if (resendKey && userEmail && userEmail.includes('@')) {
    const subject = CONFIRMATION_SUBJECTS[String(type || '').toLowerCase()] || 'We\'ve received your enquiry — CFA Academy';
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CFA Academy <hello@capitalfinplusadvizors.com>',
        to: [userEmail],
        subject,
        html: buildConfirmationHtml(String(type || '').toLowerCase(), name)
      })
    }).catch(e => console.error('notify-form: confirmation email failed', e));
  }

  return res.status(200).json({ ok: true });
};
