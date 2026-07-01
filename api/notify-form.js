/* ==============================================
   Vercel Serverless Function — POST /api/notify-form
   Fire-and-forget admin notification for form submissions
   (booking, contact, masterclass). Always returns 200.
   ============================================== */

const sendNotification = require('./send-notification');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).end();
  }

  const { type, name, email, phone, message, experience } = req.body || {};
  const typeLabel = type ? String(type).charAt(0).toUpperCase() + String(type).slice(1) : 'Form';

  const rows = [
    ['Type', typeLabel],
    ['Name', name || '—'],
    ['Email', email || '—'],
    ['Phone', phone || '—'],
    experience ? ['Experience', experience] : null,
    message ? ['Message', message] : null,
    ['Time', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST']
  ].filter(Boolean);

  const html = `
    <table style="font-family:sans-serif;font-size:14px;border-collapse:collapse;min-width:400px;">
      ${rows.map(([k, v]) => `
        <tr>
          <td style="padding:8px 12px;font-weight:600;color:#555;background:#f9f9f9;border:1px solid #e0e0e0;white-space:nowrap;">${k}</td>
          <td style="padding:8px 12px;border:1px solid #e0e0e0;">${String(v).replace(/</g, '&lt;').replace(/>/g, '&gt;')}</td>
        </tr>`).join('')}
    </table>`;

  await sendNotification({ subject: `📋 New ${typeLabel} form — ${name || email || 'Unknown'}`, html });
  return res.status(200).json({ ok: true });
};
