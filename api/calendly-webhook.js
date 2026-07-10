/* POST /api/calendly-webhook
   Receives Calendly webhook events and sends booking confirmation emails:
   - To the invitee (from hello@capitalfinplusadvizors.com)
   - To connect@capitalfinplusadvizors.com

   Set up in Calendly: Developer → Webhooks → Create Webhook
   Scope: User, Event: invitee.created
   URL: https://capitalfinplusadvizors.com/api/calendly-webhook

   Env vars: RESEND_API_KEY, CALENDLY_WEBHOOK_SECRET (optional, for signature verification) */

const crypto = require('crypto');

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata', weekday: 'long', year: 'numeric',
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit'
  }) + ' IST';
}

function buildInviteeEmail(name, eventName, startTime, meetingUrl) {
  const LOGO = `<svg width="34" height="36" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="20,39 3.8,27.2 10,7.5 30,7.5 36.2,27.2" fill="rgba(244,194,13,0.1)" stroke="#F4C20D" stroke-width="3" stroke-linejoin="round"/></svg>`;
  const firstName = (name || 'there').split(' ')[0];
  return `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0a02;color:#f0ead6;border-radius:12px;overflow:hidden;border:1px solid rgba(244,194,13,0.2);">
  <div style="height:4px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.15));"></div>
  <div style="padding:40px 40px 32px;">
    <div style="margin-bottom:24px;">${LOGO}</div>
    <p style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">Capital Finplus Academy</p>
    <h1 style="font-size:24px;font-weight:800;line-height:1.25;margin:0 0 16px;color:#ffffff;">Your call is confirmed, ${firstName} ✅</h1>
    <p style="font-size:15px;line-height:1.75;color:rgba(240,234,214,0.75);margin:0 0 24px;">
      We've received your booking for a <strong style="color:#fff;">${eventName || 'Discovery Call'}</strong> with Pravesh. Here are your details:
    </p>

    <div style="background:rgba(244,194,13,0.06);border:1px solid rgba(244,194,13,0.18);border-radius:10px;padding:24px 28px;margin-bottom:28px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:8px 0;font-size:13px;color:rgba(240,234,214,0.5);width:100px;">Event</td><td style="padding:8px 0;font-size:14px;color:#fff;font-weight:600;">${eventName || 'Discovery Call'}</td></tr>
        <tr><td style="padding:8px 0;font-size:13px;color:rgba(240,234,214,0.5);">Date & Time</td><td style="padding:8px 0;font-size:14px;color:#fff;font-weight:600;">${formatDate(startTime)}</td></tr>
        ${meetingUrl ? `<tr><td style="padding:8px 0;font-size:13px;color:rgba(240,234,214,0.5);">Join Link</td><td style="padding:8px 0;"><a href="${meetingUrl}" style="color:#F4C20D;font-weight:700;font-size:14px;text-decoration:none;">Join Meeting →</a></td></tr>` : ''}
      </table>
    </div>

    <p style="font-size:14px;line-height:1.75;color:rgba(240,234,214,0.7);margin:0 0 24px;">
      This is a complimentary 30-minute conversation — no sales pressure. Pravesh will walk you through where you are in your trading journey and what would genuinely help most.
    </p>

    <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);border-radius:8px;padding:18px 22px;margin-bottom:28px;">
      <p style="font-size:13px;color:rgba(240,234,214,0.5);margin:0;line-height:1.7;">
        Need to reschedule? Reply to this email or reach us at
        <a href="mailto:connect@capitalfinplusadvizors.com" style="color:#F4C20D;text-decoration:none;">connect@capitalfinplusadvizors.com</a>
      </p>
    </div>

    <p style="font-size:13px;color:rgba(240,234,214,0.4);margin:0;">— The CFA Academy Team</p>
  </div>
  <div style="height:1px;background:rgba(244,194,13,0.1);"></div>
  <div style="padding:20px 40px;text-align:center;">
    <p style="font-size:11px;color:rgba(240,234,214,0.25);margin:0;line-height:1.6;">
      Capital Finplus Academy · <a href="https://capitalfinplusadvizors.com" style="color:rgba(244,194,13,0.4);text-decoration:none;">capitalfinplusadvizors.com</a>
    </p>
  </div>
</div>`;
}

function buildAdminEmail(inviteeName, inviteeEmail, eventName, startTime, meetingUrl) {
  return `
<div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;max-width:600px;margin:0 auto;background:#0d0a02;color:#f0ead6;border-radius:12px;overflow:hidden;border:1px solid rgba(244,194,13,0.2);">
  <div style="height:4px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.15));"></div>
  <div style="padding:32px 40px;">
    <p style="font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#F4C20D;margin:0 0 10px;">New Booking</p>
    <h1 style="font-size:22px;font-weight:800;margin:0 0 20px;color:#ffffff;">Discovery Call Booked</h1>
    <div style="background:rgba(244,194,13,0.06);border:1px solid rgba(244,194,13,0.18);border-radius:10px;padding:20px 24px;margin-bottom:20px;">
      <table style="width:100%;border-collapse:collapse;">
        <tr><td style="padding:6px 0;font-size:13px;color:rgba(240,234,214,0.5);width:120px;">Name</td><td style="padding:6px 0;font-size:14px;color:#fff;font-weight:600;">${inviteeName || '—'}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:rgba(240,234,214,0.5);">Email</td><td style="padding:6px 0;font-size:14px;color:#F4C20D;">${inviteeEmail || '—'}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:rgba(240,234,214,0.5);">Event</td><td style="padding:6px 0;font-size:14px;color:#fff;">${eventName || '—'}</td></tr>
        <tr><td style="padding:6px 0;font-size:13px;color:rgba(240,234,214,0.5);">Time</td><td style="padding:6px 0;font-size:14px;color:#fff;">${formatDate(startTime)}</td></tr>
        ${meetingUrl ? `<tr><td style="padding:6px 0;font-size:13px;color:rgba(240,234,214,0.5);">Link</td><td style="padding:6px 0;"><a href="${meetingUrl}" style="color:#F4C20D;font-weight:700;font-size:13px;">${meetingUrl}</a></td></tr>` : ''}
      </table>
    </div>
  </div>
</div>`;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { RESEND_API_KEY, CALENDLY_WEBHOOK_SECRET } = process.env;
  if (!RESEND_API_KEY) return res.status(500).json({ error: 'RESEND_API_KEY not set' });

  // Optional signature verification
  if (CALENDLY_WEBHOOK_SECRET) {
    const sig = req.headers['calendly-webhook-signature'];
    if (sig) {
      const m = sig.match(/t=(\d+),v1=([^,\s]+)/);
      const [, ts, v1] = m || [];
      if (ts && v1) {
        const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
        const expected = crypto.createHmac('sha256', CALENDLY_WEBHOOK_SECRET)
          .update(ts + '.' + rawBody).digest('hex');
        if (expected !== v1) return res.status(401).json({ error: 'Invalid signature' });
      }
    }
  }

  const body = req.body || {};
  if (body.event !== 'invitee.created') return res.status(200).json({ ok: true, skipped: true });

  const payload = body.payload || {};
  const inviteeName = payload.invitee?.name || '';
  const inviteeEmail = payload.invitee?.email || '';
  const eventName = payload.event_type?.name || 'Discovery Call';
  const startTime = payload.event?.start_time || null;
  const meetingUrl = payload.invitee?.text_reminder_number
    ? null
    : (payload.event?.location?.join_url || payload.invitee?.event?.location?.join_url || null);

  if (!inviteeEmail) return res.status(400).json({ error: 'No invitee email in payload' });

  const sendEmail = (to, subject, html) =>
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'CFA Academy <hello@capitalfinplusadvizors.com>', to: [to], subject, html })
    }).then(r => r.json());

  const [inviteeResult, adminResult] = await Promise.allSettled([
    sendEmail(
      inviteeEmail,
      `Your Discovery Call is confirmed — ${eventName}`,
      buildInviteeEmail(inviteeName, eventName, startTime, meetingUrl)
    ),
    sendEmail(
      'connect@capitalfinplusadvizors.com',
      `New booking: ${inviteeName || inviteeEmail} — ${eventName}`,
      buildAdminEmail(inviteeName, inviteeEmail, eventName, startTime, meetingUrl)
    )
  ]);

  return res.status(200).json({
    ok: true,
    invitee: inviteeResult.status,
    admin: adminResult.status
  });
};
