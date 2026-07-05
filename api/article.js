/* ==============================================
   Vercel Serverless Function — GET /blog/<slug>
   (rewritten here via vercel.json: /blog/(.+) -> /api/article?slug=$1)

   Server-renders each blog article as a real HTML page with its own
   URL, unique <title>/meta description, Open Graph tags, canonical
   and Article structured data — so Google can crawl and rank every
   article individually. The in-page reader on /pages/blog is
   unchanged; these pages exist primarily for search + social.

   Free articles render their full body. Premium articles render the
   excerpt + a course CTA (the premium body is never baked into the
   public HTML). Free/premium mirrors data.js cfpEffectiveAccess():
   within the rolling free window -> free, otherwise the access flag.

   Env vars: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
   ============================================== */

const { createClient } = require('@supabase/supabase-js');

const SITE = 'https://capitalfinplusadvizors.com';

/* Must stay in sync with the copy in js/blog.js (cfpArticleSlug) */
function slugify(title) {
  return String(title)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

/* Mirrors data.js cfpEffectiveAccess() for articles: within the rolling
   free window -> free; outside it, the article's own access flag decides
   (defaulting to premium). Unparseable date -> access flag decides. */
function isFreeNow(article, freeDays) {
  const d = new Date(article.date);
  if (!isNaN(d.getTime())) {
    const ageDays = (Date.now() - d.getTime()) / 86400000;
    if (ageDays <= freeDays) return true;
    return (article.access || 'premium') === 'free';
  }
  return article.access === 'free';
}

function pageHtml(a, free, slug) {
  const url = `${SITE}/blog/${slug}`;
  const title = esc(a.title) + ' | Capital Finplus Academy';
  const desc = esc(String(a.excerpt || '').slice(0, 158));
  const published = !isNaN(new Date(a.date).getTime()) ? new Date(a.date).toISOString() : null;
  const modified = a.updated_at || published;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.excerpt || '',
    image: `${SITE}/assets/og-image.png`,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    author: { '@type': 'Organization', name: 'Capital Finplus Academy', url: SITE },
    publisher: {
      '@type': 'Organization',
      name: 'Capital Finplus Academy',
      logo: { '@type': 'ImageObject', url: `${SITE}/icons/icon-512.png` }
    }
  };
  if (published) ld.datePublished = published;
  if (modified) ld.dateModified = modified;

  const bodySection = free
    ? `<div class="article-body">${a.body || ''}</div>`
    : `<div class="article-body"><p>${esc(a.excerpt)}</p></div>
       <div class="paywall">
         <p class="paywall-title">🔒 This article is in the premium archive</p>
         <p class="paywall-sub">Articles outside the free preview window are reserved for enrolled students. Any course unlocks the full archive — premium articles, trade breakdowns and backtest history.</p>
         <a class="paywall-cta" href="/pages/courses">Explore Courses →</a>
       </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${title}</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="${url}" />
<meta property="og:type" content="article" />
<meta property="og:site_name" content="Capital Finplus Academy" />
<meta property="og:title" content="${esc(a.title)}" />
<meta property="og:description" content="${desc}" />
<meta property="og:url" content="${url}" />
<meta property="og:image" content="${SITE}/assets/og-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(a.title)}" />
<meta name="twitter:description" content="${desc}" />
<meta name="twitter:image" content="${SITE}/assets/og-image.png" />
<link rel="icon" type="image/svg+xml" href="/favicon.svg" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Source+Sans+3:wght@400;600&display=swap" rel="stylesheet" />
<script type="application/ld+json">${JSON.stringify(ld)}</script>
<style>
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
  body{background:#0a0701;color:#f0ead6;font-family:'Source Sans 3',sans-serif;line-height:1.75;min-height:100vh}
  a{color:#F4C20D}
  .top{border-bottom:1px solid rgba(244,194,13,0.14);background:rgba(10,7,1,0.9)}
  .top-inner{max-width:760px;margin:0 auto;padding:1rem 1.25rem;display:flex;align-items:center;gap:10px}
  .top-inner a{display:flex;align-items:center;gap:10px;text-decoration:none;color:#fff;font-family:'Manrope',sans-serif;font-weight:800;font-size:0.95rem}
  main{max-width:760px;margin:0 auto;padding:2.5rem 1.25rem 4rem}
  .crumb{font-size:0.8rem;margin-bottom:1.5rem}
  .crumb a{text-decoration:none;color:rgba(240,234,214,0.5)}
  .crumb a:hover{color:#F4C20D}
  .meta{display:flex;gap:10px;align-items:center;flex-wrap:wrap;font-size:0.78rem;color:rgba(240,234,214,0.5);margin-bottom:0.9rem}
  .chip{background:rgba(244,194,13,0.1);border:1px solid rgba(244,194,13,0.25);color:#F4C20D;padding:2px 10px;border-radius:999px;font-weight:600}
  h1{font-family:'Manrope',sans-serif;font-weight:800;font-size:1.75rem;line-height:1.3;color:#fff;letter-spacing:-0.02em;margin-bottom:1.75rem}
  .article-body{font-size:1.02rem;color:rgba(240,234,214,0.82)}
  .article-body h3{font-family:'Manrope',sans-serif;color:#fff;font-size:1.15rem;margin:1.75rem 0 0.6rem}
  .article-body p{margin-bottom:1rem}
  .article-body ul,.article-body ol{margin:0 0 1rem 1.4rem}
  .article-body img{max-width:100%;border-radius:8px}
  .paywall{margin-top:2rem;border:1px solid rgba(244,194,13,0.25);background:rgba(244,194,13,0.05);border-radius:12px;padding:1.75rem;text-align:center}
  .paywall-title{font-family:'Manrope',sans-serif;font-weight:800;color:#fff;margin-bottom:0.5rem}
  .paywall-sub{font-size:0.9rem;color:rgba(240,234,214,0.6);margin-bottom:1.2rem}
  .paywall-cta{display:inline-block;background:linear-gradient(135deg,#F4C20D,#d4a80a);color:#0a0701;font-weight:800;font-family:'Manrope',sans-serif;padding:0.7rem 1.5rem;border-radius:8px;text-decoration:none}
  .foot{margin-top:3rem;padding-top:1.5rem;border-top:1px solid rgba(244,194,13,0.12);display:flex;gap:1rem;flex-wrap:wrap;font-size:0.88rem}
  .foot a{text-decoration:none;font-weight:600}
  .disclaimer{margin-top:2rem;font-size:0.72rem;color:rgba(240,234,214,0.35)}
</style>
</head>
<body>
<header class="top"><div class="top-inner">
  <a href="/" aria-label="Capital Finplus Home">
    <svg width="26" height="28" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg"><polygon points="20,39 3.8,27.2 10,7.5 30,7.5 36.2,27.2" fill="rgba(244,194,13,0.07)" stroke="#F4C20D" stroke-width="3" stroke-linejoin="round"/></svg>
    Capital Finplus <span style="color:#F4C20D;">Academy</span>
  </a>
</div></header>
<main>
  <nav class="crumb"><a href="/">Home</a> · <a href="/pages/blog">Blog</a></nav>
  <div class="meta">
    <span class="chip">${esc(a.category || 'Article')}</span>
    <span>${esc(a.date || '')}</span>
    <span>${esc(a.readtime || '')}</span>
  </div>
  <h1>${esc(a.title)}</h1>
  ${bodySection}
  <div class="foot">
    <a href="/pages/blog">← All articles</a>
    <a href="/pages/blog?article=${encodeURIComponent(a.id)}">Open in reader</a>
    <a href="/pages/courses">Courses</a>
  </div>
  <p class="disclaimer">Capital Finplus Academy is an educational platform. Trading in securities involves risk of loss. All content is for educational purposes only and does not constitute investment advice. Please consult a SEBI-registered advisor before making investment decisions.</p>
</main>
</body>
</html>`;
}

module.exports = async (req, res) => {
  const debug = req.query && req.query.debug === '1';
  const slug = String((req.query && req.query.slug) || '').replace(/\/+$/, '').toLowerCase();
  if (!slug) {
    if (debug) return res.status(200).json({ step: 'no-slug', query: req.query || null });
    res.setHeader('Location', '/pages/blog');
    return res.status(302).end();
  }

  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    if (debug) return res.status(200).json({ step: 'no-env', hasUrl: !!SUPABASE_URL, hasKey: !!SUPABASE_SERVICE_ROLE_KEY });
    res.setHeader('Location', '/pages/blog');
    return res.status(302).end();
  }

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const [{ data: articles, error }, { data: settingsRow }] = await Promise.all([
      supabase.from('articles').select('id,title,excerpt,body,category,access,date,readtime,updated_at'),
      supabase.from('site_content').select('value').eq('key', 'premium').maybeSingle()
    ]);
    if (error) throw error;

    const article = (articles || []).find(a => slugify(a.title) === slug);
    if (!article) {
      /* Unknown slug: send humans (and crawlers) to the blog index. 404
         status so Google drops stale article URLs instead of indexing
         a soft redirect. */
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.status(404).send(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>Article not found</title><meta name="robots" content="noindex"></head><body style="background:#0a0701;color:#f0ead6;font-family:sans-serif;display:flex;min-height:100vh;align-items:center;justify-content:center;text-align:center;"><div><h1>Article not found</h1><p><a href="/pages/blog" style="color:#F4C20D;">Browse all articles →</a></p></div></body></html>`);
    }

    const freeDays = Number(settingsRow && settingsRow.value && settingsRow.value.freeDays) || 30;
    const free = isFreeNow(article, freeDays);

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    /* CDN-cache for 10 min; stale-while-revalidate keeps it fast after edits */
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=86400');
    return res.status(200).send(pageHtml(article, free, slug));
  } catch (err) {
    console.error('article render failed', err);
    if (debug) return res.status(200).json({ step: 'catch', error: (err && err.message) || String(err) });
    res.setHeader('Location', '/pages/blog');
    return res.status(302).end();
  }
};
