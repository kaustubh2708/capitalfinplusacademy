/* Internal helper — not a public endpoint. Import and call from other
   serverless functions. Silently skips if RESEND_API_KEY is not set
   so the site works in dev/staging without breaking anything. */

module.exports = async function sendNotification({ subject, html }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log('[notify] RESEND_API_KEY not set — skipping email:', subject);
    return;
  }
  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'CFA Academy <hello@capitalfinplusadvizors.com>',
        to: ['connect@capitalfinplusadvizors.com'],
        subject,
        html
      })
    });
  } catch (err) {
    console.error('[notify] Failed to send admin notification:', err);
  }
};
