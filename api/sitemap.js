/* ==============================================
   Vercel Serverless Function — GET /sitemap.xml
   (rewritten here via vercel.json)

   Dynamic sitemap: the static page list + one /blog/<slug> URL per
   article, generated from Supabase — so every new article the admin
   publishes is submitted to Google automatically, no deploy needed.

   Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   ============================================== */

const { createClient } = require('@supabase/supabase-js');

const SITE = 'https://capitalfinplusadvizors.com';

const STATIC_URLS = [
  { loc: `${SITE}/`, changefreq: 'weekly', priority: '1.0' },
  { loc: `${SITE}/pages/courses`, changefreq: 'weekly', priority: '0.9' },
  { loc: `${SITE}/pages/blog`, changefreq: 'weekly', priority: '0.8' },
  { loc: `${SITE}/pages/backtesting`, changefreq: 'daily', priority: '0.7' },
  { loc: `${SITE}/pages/privacy-policy`, changefreq: 'yearly', priority: '0.2' },
  { loc: `${SITE}/pages/terms-and-conditions`, changefreq: 'yearly', priority: '0.2' },
  { loc: `${SITE}/pages/refund-policy`, changefreq: 'yearly', priority: '0.2' }
];

/* Must stay in sync with api/article.js and js/blog.js */
function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

module.exports = async (req, res) => {
  let articleUrls = [];
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: articles } = await supabase
        .from('articles')
        .select('title, updated_at, date')
        .order('date', { ascending: false });
      articleUrls = (articles || []).map(a => ({
        loc: `${SITE}/blog/${slugify(a.title)}`,
        lastmod: (a.updated_at || '').slice(0, 10) || undefined,
        changefreq: 'monthly',
        priority: '0.6'
      }));
    }
  } catch (err) {
    console.error('sitemap: article fetch failed (serving static URLs only)', err);
  }

  const urls = [...STATIC_URLS, ...articleUrls].map(u => `  <url>
    <loc>${u.loc}</loc>${u.lastmod ? `\n    <lastmod>${u.lastmod}</lastmod>` : ''}
    <changefreq>${u.changefreq}</changefreq>
    <priority>${u.priority}</priority>
  </url>`).join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');
  return res.status(200).send(xml);
};
