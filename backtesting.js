/* ==============================================
   Capital Finplus Academy — backtesting.js
   Renders the daily chart-trend / backtesting log
   from Supabase (cfpLoadPublicData, see data.js),
   falling back to CFP_DEFAULT_DATA if Supabase isn't
   reachable. Free for the first 30 days
   (cfpEffectiveAccess), then rolls to the premium
   archive — same pattern as blog.js.
   ============================================== */

const CFP_BT_ICON_KEY_MAP = {
  candlestick_chart: 'candlestick', shield: 'shield', psychology: 'message',
  description: 'filetext', auto_graph: 'activity', trending_up: 'trendingup'
};
function cfpBtIconSvg(iconName) {
  const key = CFP_BT_ICON_KEY_MAP[iconName] || 'trendingup';
  return (typeof CFP_SVG_ICONS !== 'undefined' && CFP_SVG_ICONS[key]) || '';
}

/* Populated once cfpLoadPublicData() resolves, in the async block at the
   bottom of this file — every function below reads it via closure. */
let CFP_BACKTESTS = [];

function renderBtFilterBar() {
  const bar = document.getElementById('filter-bar');
  if (!bar) return;
  const instruments = [];
  CFP_BACKTESTS.forEach(b => { if (instruments.indexOf(b.instrument) === -1) instruments.push(b.instrument); });
  bar.innerHTML = '<button class="filter-btn active" data-filter="all">All Posts</button>' +
    instruments.map(i => `<button class="filter-btn" data-filter="${i}">${i}</button>`).join('');
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

function renderBtGrid() {
  const grid = document.getElementById('backtest-grid');
  if (!grid) return;
  const sorted = CFP_BACKTESTS.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  grid.innerHTML = sorted.map(b => {
    const icon = cfpBtIconSvg(b.icon);
    const isFree = cfpEffectiveAccess(b) === 'free';
    const resultBadge = b.result ? `<span class="post-tag-mostread" style="background:${b.result === 'Win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};color:${b.result === 'Win' ? '#4ade80' : '#fb7185'};">${b.result === 'Win' ? '✅' : '❌'} ${b.result}</span>` : '';
    const thumbContent = b.chartImage
      ? `<img src="${b.chartImage}" alt="${b.title}" style="width:100%;height:100%;object-fit:cover;" />`
      : `<span class="thumb-icon" style="color:${b.color};">${icon}</span>`;
    return `
      <div class="post-card" data-category="${b.instrument}" data-post="${b.id}" onclick="openBacktest('${b.id}')">
        <div class="post-card-thumb" style="background:${b.bg}">
          ${thumbContent}
        </div>
        <div class="post-card-body">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="post-access-badge ${isFree ? 'badge-free' : 'badge-premium'}">${isFree ? '🔓 Free' : '🔒 Premium'}</span>
            <span class="post-card-category">${b.instrument} · ${b.timeframe}</span>
            ${resultBadge}
          </div>
          <p class="post-title">${b.title}</p>
          <p class="post-excerpt">${b.excerpt}</p>
          <div class="post-footer">
            <span class="post-date">${b.date}</span>
            <span class="post-read-time">${b.readtime} →</span>
          </div>
        </div>
      </div>`;
  }).join('');
}

/* Set once on page load (see initPremiumGate below) — true if the logged-in
   user has at least one active enrollment, which unlocks all premium
   backtests. Re-checked/re-rendered if it resolves while one is open. */
let cfpUserHasPremiumAccess = false;
let cfpCurrentBacktestId = null;

function openBacktest(id) {
  const b = CFP_BACKTESTS.find(x => String(x.id) === String(id));
  if (!b) return;
  cfpCurrentBacktestId = id;
  const icon = cfpBtIconSvg(b.icon);
  const isFree = cfpEffectiveAccess(b) === 'free';
  const unlocked = isFree || cfpUserHasPremiumAccess;

  const thumbEl = document.getElementById('article-thumb-area');
  thumbEl.style.background = b.bg;
  thumbEl.innerHTML = b.chartImage
    ? `<img src="${b.chartImage}" alt="${b.title}" style="width:100%;height:100%;object-fit:cover;" />`
    : `<span style="color:${b.color};opacity:0.55;">${icon}</span>`;

  const badgeLabel = isFree ? '🔓 Free' : (cfpUserHasPremiumAccess ? '🔓 Premium · Unlocked' : '🔒 Premium');
  document.getElementById('article-header').innerHTML = `
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:0.75rem;flex-wrap:wrap;">
      <span class="post-access-badge ${isFree ? 'badge-free' : 'badge-premium'}">${badgeLabel}</span>
      <span class="post-card-category">${b.instrument} · ${b.timeframe}</span>
      ${b.result ? `<span class="post-tag-mostread" style="background:${b.result === 'Win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};color:${b.result === 'Win' ? '#4ade80' : '#fb7185'};">${b.result === 'Win' ? '✅' : '❌'} ${b.result}</span>` : ''}
      <span class="article-date" style="margin-left:auto;">${b.date} · ${b.readtime}</span>
    </div>
    <h1 style="font-family:'Manrope',sans-serif;font-weight:800;font-size:1.4rem;color:#fff;line-height:1.35;letter-spacing:-0.02em;">${b.title}</h1>
  `;

  const premiumSection = document.getElementById('article-premium-section');
  if (isFree) {
    document.getElementById('article-free-content').innerHTML = b.body;
    premiumSection.style.display = 'none';
  } else {
    document.getElementById('article-free-content').innerHTML = `<p>${b.excerpt}</p>`;
    premiumSection.style.display = 'block';
    document.getElementById('article-premium-content').innerHTML = b.body;
    const paywallGate = premiumSection.querySelector('.paywall-gate');
    const paywallFade = premiumSection.querySelector('.paywall-fade');
    if (paywallGate) paywallGate.style.display = unlocked ? 'none' : '';
    if (paywallFade) paywallFade.style.display = unlocked ? 'none' : '';
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

/* ── INIT (async — Supabase fetch, then render) ── */
(async function initBacktestingPage() {
  CFP_BACKTESTS = (typeof cfpLoadPublicData === 'function')
    ? (await cfpLoadPublicData()).backtests || []
    : [];

  renderBtFilterBar();
  renderBtGrid();

  // Auto-open entry from URL query param: backtesting.html?entry=<uuid>
  const params = new URLSearchParams(window.location.search);
  const entryId = params.get('entry');
  if (entryId && CFP_BACKTESTS.find(b => String(b.id) === entryId)) {
    setTimeout(() => openBacktest(entryId), 200);
  }

  /* Premium unlock check — re-render the open entry (if any) once it
     resolves, in case the user clicked into a premium entry before this
     finished (default is locked, so the worst case is a brief flash of the
     paywall for an already-enrolled user, never an accidental unlock). */
  if (typeof window.cfpAuth !== 'undefined' && typeof window.canAccessPremium !== 'undefined') {
    try {
      const user = await window.cfpAuth.getCurrentUser();
      cfpUserHasPremiumAccess = user ? await window.canAccessPremium(user.id) : false;
    } catch (e) {
      cfpUserHasPremiumAccess = false;
    }
    if (cfpCurrentBacktestId !== null) openBacktest(cfpCurrentBacktestId);
  }
})();
