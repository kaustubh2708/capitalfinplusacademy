/* ==============================================
   Vercel Serverless Function — POST /api/upload-pdf
   Accepts a base64-encoded PDF from the admin panel and
   uploads it to the private Supabase Storage bucket.
   Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   ============================================== */

const { createClient } = require('@supabase/supabase-js');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({ error: 'Supabase service role env vars not configured.' });
  }

  const { fileBase64 } = req.body || {};
  if (!fileBase64) {
    return res.status(400).json({ error: 'No file data provided.' });
  }

  try {
    const buffer = Buffer.from(fileBase64, 'base64');
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { error } = await supabase.storage
      .from('course-materials')
      .upload('pdfs/cfa-framework.pdf', buffer, {
        contentType: 'application/pdf',
        upsert: true  // replace existing file
      });

    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('upload-pdf failed', err);
    return res.status(500).json({ error: err.message || 'Upload failed.' });
  }
};
