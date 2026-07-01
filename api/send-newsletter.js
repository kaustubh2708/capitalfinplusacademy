const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = (req.headers['authorization'] || '').replace('Bearer ', '').trim();
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' });
  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return res.status(403).json({ error: 'Forbidden' });

  const { subject, html, audience } = req.body || {};
  if (!subject || !html) return res.status(400).json({ error: 'Missing subject or html' });

  if (!process.env.RESEND_API_KEY) {
    return res.status(500).json({ error: 'RESEND_API_KEY not configured in Vercel environment variables' });
  }

  let query = supabase.from('newsletter_subscribers').select('email, name');
  if (audience === 'signups') query = query.eq('source', 'signup');
  else if (audience === 'buyers') query = query.eq('source', 'purchase');

  const { data: subscribers, error: subErr } = await query;
  if (subErr) return res.status(500).json({ error: 'Could not fetch subscribers: ' + subErr.message });
  if (!subscribers || subscribers.length === 0) return res.json({ sent: 0, failed: 0 });

  const footer = `<hr style="margin:32px 0;border-color:#eee;border-style:solid;border-width:1px 0 0"><p style="font-size:12px;color:#999;line-height:1.6">You're receiving this because you subscribed to Capital Finplus Academy updates. Reply to this email to unsubscribe.</p>`;
  const fullHtml = html + footer;
  const FROM = 'Pravesh Kumar — CFA Academy <ceo@capitalfinplusadvizors.com>';

  let sent = 0;
  let failed = 0;

  // Chunk into batches of 100 (Resend batch limit)
  for (let i = 0; i < subscribers.length; i += 100) {
    const chunk = subscribers.slice(i, i + 100);
    const emails = chunk.map(s => ({ from: FROM, to: [s.email], subject, html: fullHtml }));
    try {
      const r = await fetch('https://api.resend.com/emails/batch', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(emails)
      });
      const data = await r.json();
      if (r.ok && data.data) { sent += data.data.length; failed += chunk.length - data.data.length; }
      else failed += chunk.length;
    } catch {
      failed += chunk.length;
    }
  }

  // Record send history (table may not exist yet — ignore error)
  await supabase.from('newsletter_sends').insert({
    subject, audience: audience || 'all', recipient_count: sent, sent_at: new Date().toISOString()
  }).catch(() => {});

  return res.json({ sent, failed });
};
