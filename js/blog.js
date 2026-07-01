/* ==============================================
   Capital Finplus Academy — blog.js
   Renders the blog grid + full-page article reader
   from Supabase (cfpLoadPublicData, see data.js),
   falling back to CFP_DEFAULT_DATA if Supabase isn't
   reachable, so this page never breaks.
   ============================================== */

const CFP_ICON_KEY_MAP = {
  candlestick_chart: 'candlestick', shield: 'shield', psychology: 'message',
  description: 'filetext', auto_graph: 'activity', trending_up: 'trendingup'
};
function cfpIconSvg(iconName) {
  const key = CFP_ICON_KEY_MAP[iconName] || 'trendingup';
  return (typeof CFP_SVG_ICONS !== 'undefined' && CFP_SVG_ICONS[key]) || '';
}

/* Populated once cfpLoadPublicData() resolves, in the async block at the
   bottom of this file — every function below reads it via closure, so it's
   fine that it starts empty. */
let CFP_ARTICLES = [];

function renderFilterBar() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const cats = [];
  CFP_ARTICLES.forEach(a => { if (!cats.find(c => c.cat === a.cat)) cats.push({ cat: a.cat, label: a.category }); });
  bar.innerHTML = '<button class="filter-btn active" data-filter="all">All Posts</button>' +
    cats.map(c => `<button class="filter-btn" data-filter="${c.cat}">${c.label}</button>`).join('');
  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const filter = this.dataset.filter;
      document.querySelectorAll('.post-card').forEach(card => {
        const match = filter === 'all' || card.dataset.category === filter;
        card.style.display = match ? 'flex' : 'none';
      });
    });
  });
}

function renderBlogGrid() {
  const grid = document.getElementById('blog-grid');
  if (!grid) return;
  /* Most-read articles surface first in the full listing too */
  const sorted = CFP_ARTICLES.slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
  grid.innerHTML = sorted.map(a => {
    const icon = cfpIconSvg(a.icon);
    const isFree = cfpEffectiveAccess(a) === 'free';
    const mostReadBadge = a.featured ? '<span class="post-tag-mostread">🔥 Most Read</span>' : '';
    return `
      <div class="post-card" data-category="${a.cat}" data-post="${a.id}" onclick="openArticle('${a.id}')">
        <div class="post-card-thumb" style="background:${a.bg}">
          <span class="thumb-icon" style="color:${a.color};">${icon}</span>
        </div>
        <div class="post-card-body">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="post-access-badge ${isFree ? 'badge-free' : 'badge-premium'}">${isFree ? '🔓 Free' : '🔒 Premium'}</span>
            <span class="post-card-category">${a.category}</span>
            ${mostReadBadge}
          </div>
          <p class="post-title">${a.title}</p>
          <p class="post-excerpt">${a.excerpt}</p>
          <div class="post-footer">
            <span class="post-date">${a.date}</span>
            <span class="post-read-time">${a.readtime} →</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* Set once on page load (see initPremiumGate below) — true if the logged-in
   user has at least one active enrollment, which unlocks all premium
   articles. Re-checked/re-rendered if it resolves while an article is open. */
let cfpUserHasPremiumAccess = false;
let cfpCurrentArticleId = null;
let cfpCurrentUser = null;

/* The paywall card's copy/buttons are identical whether or not the
   visitor is logged in by default — which reads exactly like "it's
   asking me to log in" even to someone who IS logged in but just
   doesn't have an active enrollment. Distinguish the two cases. */
function cfpUpdatePaywallCopy() {
  const loginPrompt = document.getElementById('paywall-login-prompt');
  const sub = document.getElementById('paywall-sub');
  if (!loginPrompt || !sub) return;
  if (cfpCurrentUser) {
    loginPrompt.style.display = 'none';
    sub.textContent = "You're logged in, but this content isn't included in your current plan. Purchase any course to unlock it.";
  } else {
    loginPrompt.style.display = '';
    sub.textContent = 'Articles outside the current free preview window are part of the premium archive. Purchase any course to unlock full access to all premium articles, trade breakdowns, and live session recordings.';
  }
}

function openArticle(id) {
  const a = CFP_ARTICLES.find(x => String(x.id) === String(id));
  if (!a) return;
  cfpCurrentArticleId = id;
  const icon = cfpIconSvg(a.icon);
  const isFree = cfpEffectiveAccess(a) === 'free';
  const unlocked = isFree || cfpUserHasPremiumAccess;

  const thumbEl = document.getElementById('article-thumb-area');
  thumbEl.style.background = a.bg;
  thumbEl.innerHTML = `<span style="color:${a.color};opacity:0.55;">${icon}</span>`;

  const badgeLabel = isFree ? '🔓 Free Article' : (cfpUserHasPremiumAccess ? '🔓 Premium · Unlocked' : '🔒 Premium');
  document.getElementById('article-header').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:0.75rem;flex-wrap:wrap;">
      <span class="post-access-badge ${isFree ? 'badge-free' : 'badge-premium'}">${badgeLabel}</span>
      <span class="post-card-category">${a.category}</span>
      ${a.featured ? '<span class="post-tag-mostread">🔥 Most Read</span>' : ''}
      <span class="article-date" style="margin-left:auto;">${a.date} · ${a.readtime}</span>
    </div>
    <h1 style="font-family:'Manrope',sans-serif;font-weight:800;font-size:1.4rem;color:#fff;line-height:1.35;letter-spacing:-0.02em;">${a.title}</h1>
  `;

  const premiumSection = document.getElementById('article-premium-section');
  if (isFree) {
    document.getElementById('article-free-content').innerHTML = a.body;
    premiumSection.style.display = 'none';
  } else {
    document.getElementById('article-free-content').innerHTML = `<p>${a.excerpt}</p>`;
    premiumSection.style.display = 'block';
    const premiumContentEl = document.getElementById('article-premium-content');
    premiumContentEl.innerHTML = a.body;
    premiumContentEl.classList.toggle('is-unlocked', unlocked);
    /* Unlocked: clear any inline override so the existing CSS/layout for the
       gate elements is untouched, just hidden. Locked: clear override too,
       so the original CSS-driven display value is restored (no guessing). */
    const paywallGate = premiumSection.querySelector('.paywall-gate');
    const paywallFade = premiumSection.querySelector('.paywall-fade');
    if (paywallGate) paywallGate.style.display = unlocked ? 'none' : '';
    if (paywallFade) paywallFade.style.display = unlocked ? 'none' : '';
    cfpUpdatePaywallCopy();
  }

  document.getElementById('article-overlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeArticle() {
  document.getElementById('article-overlay').classList.remove('open');
  document.body.style.overflow = '';
}

document.getElementById('article-overlay')?.addEventListener('click', function (e) { if (e.target === this) closeArticle(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeArticle(); });

function subscribeNewsletter() {
  const input = document.getElementById('nl-email');
  if (!input.value || !input.value.includes('@')) { input.style.borderColor = '#ef4444'; return; }
  const email = input.value;
  input.disabled = true;
  if (typeof cfpRecordNewsletterSignup === 'function') {
    cfpRecordNewsletterSignup(email).then(() => {
      document.getElementById('nl-success').style.display = 'block';
    });
  } else {
    document.getElementById('nl-success').style.display = 'block';
  }
}

/* ── INIT (async — Supabase fetch, then render) ── */
(async function initBlogPage() {
  CFP_ARTICLES = (typeof cfpLoadPublicData === 'function')
    ? (await cfpLoadPublicData()).articles || []
    : [];

  renderFilterBar();
  renderBlogGrid();

  // Auto-open article from URL query param: blog.html?article=<uuid>
  const params = new URLSearchParams(window.location.search);
  const articleId = params.get('article');
  if (articleId && CFP_ARTICLES.find(a => String(a.id) === articleId)) {
    setTimeout(() => openArticle(articleId), 200);
  }

  /* Premium unlock check — re-render the open article (if any) once it
     resolves, in case the user clicked into a premium article before this
     finished (default is locked, so the worst case is a brief flash of the
     paywall for an already-enrolled user, never an accidental unlock). */
  if (typeof window.cfpAuth !== 'undefined' && typeof window.canAccessPremium !== 'undefined') {
    try {
      const user = await window.cfpAuth.getCurrentUser();
      cfpCurrentUser = user || null;
      cfpUserHasPremiumAccess = user ? await window.canAccessPremium(user.id) : false;
    } catch (e) {
      cfpCurrentUser = null;
      cfpUserHasPremiumAccess = false;
    }
    if (cfpCurrentArticleId !== null) openArticle(cfpCurrentArticleId);
  }
})();
