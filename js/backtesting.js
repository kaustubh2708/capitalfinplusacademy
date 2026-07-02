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
    const isUnlocked = !isFree && cfpUserHasPremiumAccess && cfpWithinTierCutoff(b.date);
    const badgeClass = isFree ? 'badge-free' : (isUnlocked ? 'badge-free' : 'badge-premium');
    const badgeLabel = isFree ? '🔓 Free' : (isUnlocked ? '🔓 Unlocked' : '🔒 Premium');
    const resultBadge = b.result ? `<span class="post-tag-mostread" style="background:${b.result === 'Win' ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.12)'};color:${b.result === 'Win' ? '#4ade80' : '#fb7185'};">${b.result === 'Win' ? '✅' : '❌'} ${b.result}</span>` : '';
    const accessible = isFree || isUnlocked;
    let thumbContent;
    if (b.chartImage) {
      if (accessible) {
        thumbContent = `<img src="${b.chartImage}" alt="${b.title}" style="width:100%;height:100%;object-fit:cover;" draggable="false" />`;
      } else {
        // Locked: blur via background-image so the URL isn't in a plain <img>
        // and can't be right-clicked or dragged. An overlay lock icon sits on top.
        thumbContent = `<div style="position:absolute;inset:0;background:url('${b.chartImage}') center/cover;filter:blur(14px) brightness(0.35);pointer-events:none;" oncontextmenu="return false;"></div>`
          + `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;pointer-events:none;">`
          + `<span style="font-size:1.6rem;line-height:1;filter:drop-shadow(0 2px 6px rgba(0,0,0,0.9));">🔒</span>`
          + `<span style="font-size:0.65rem;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.55);">Premium</span>`
          + `</div>`;
      }
    } else {
      thumbContent = `<span class="thumb-icon" style="color:${b.color};">${icon}</span>`;
    }
    return `
      <div class="post-card" data-category="${b.instrument}" data-post="${b.id}" onclick="openBacktest('${b.id}')">
        <div class="post-card-thumb" style="background:${b.bg};position:relative;overflow:hidden;">
          ${thumbContent}
        </div>
        <div class="post-card-body">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
            <span class="post-access-badge ${badgeClass}">${badgeLabel}</span>
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

/* Set once on page load (see init below) — true if the logged-in user has
   at least one active enrollment, which unlocks premium backtests, but
   only up to cfpBacktestCutoffDate (null = unlimited) — the tiered access
   promised on the comparison table (1mo/3mo/full by course). Re-checked/
   re-rendered if it resolves while one is open. */
let cfpUserHasPremiumAccess = false;
let cfpBacktestCutoffDate = null;
let cfpCurrentBacktestId = null;
let cfpCurrentUser = null;

/* See the matching function in blog.js — same reasoning: the paywall
   card's default copy reads like "log in" even to a visitor who already
   is logged in but just isn't covered by their plan/tier. */
function cfpUpdatePaywallCopy() {
  const loginPrompt = document.getElementById('paywall-login-prompt');
  const sub = document.getElementById('paywall-sub');
  if (!loginPrompt || !sub) return;
  if (cfpCurrentUser) {
    loginPrompt.style.display = 'none';
    sub.textContent = "You're logged in, but this entry is outside your current plan's access window. Upgrade your course to unlock it.";
  } else {
    loginPrompt.style.display = '';
    sub.textContent = 'Backtests outside the current free preview window move to the premium archive. Purchase any course to unlock the full history.';
  }
}

function cfpWithinTierCutoff(dateStr) {
  if (!cfpBacktestCutoffDate) return true;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return true;
  return d >= cfpBacktestCutoffDate;
}

function openBacktest(id) {
  const b = CFP_BACKTESTS.find(x => String(x.id) === String(id));
  if (!b) return;
  cfpCurrentBacktestId = id;
  const icon = cfpBtIconSvg(b.icon);
  const isFree = cfpEffectiveAccess(b) === 'free';
  const unlocked = isFree || (cfpUserHasPremiumAccess && cfpWithinTierCutoff(b.date));

  const thumbEl = document.getElementById('article-thumb-area');
  thumbEl.style.background = b.bg;
  thumbEl.style.position = 'relative';
  thumbEl.style.overflow = 'hidden';
  if (b.chartImage) {
    if (unlocked) {
      // Full reader: uncropped chart at its own aspect ratio
      thumbEl.style.height = 'auto';
      thumbEl.innerHTML = `<img src="${b.chartImage}" alt="${b.title}" style="width:100%;height:auto;display:block;object-fit:contain;" draggable="false" />`;
    } else {
      // Locked: heavy blur so the chart is not readable, lock overlay on top
      thumbEl.style.height = '220px';
      thumbEl.innerHTML = `<div style="position:absolute;inset:0;background:url('${b.chartImage}') center/cover;filter:blur(20px) brightness(0.3);pointer-events:none;" oncontextmenu="return false;"></div>`
        + `<div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;">`
        + `<span style="font-size:2.2rem;filter:drop-shadow(0 2px 8px rgba(0,0,0,0.9));">🔒</span>`
        + `<span style="font-size:0.7rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(255,255,255,0.5);">Purchase a course to view this chart</span>`
        + `</div>`;
    }
  } else {
    thumbEl.style.height = '';
    thumbEl.innerHTML = `<span style="color:${b.color};opacity:0.55;">${icon}</span>`;
  }

  const badgeLabel = isFree ? '🔓 Free' : (unlocked ? '🔓 Premium · Unlocked' : '🔒 Premium');
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
    const premiumContentEl = document.getElementById('article-premium-content');
    premiumContentEl.innerHTML = b.body;
    premiumContentEl.classList.toggle('is-unlocked', unlocked);
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

/* ── INIT (async — Supabase fetch, then render) ── */
(async function initBacktestingPage() {
  CFP_BACKTESTS = (typeof cfpLoadPublicData === 'function')
    ? (await cfpLoadPublicData()).backtests || []
    : [];

  /* Anonymous visitors get a 7-day free window; signed-in users get the
     full configured window (default 30 days, or their plan's tier). */
  window.CFP_FREE_WINDOW_DAYS = 7;

  renderBtFilterBar();
  renderBtGrid();

  // Auto-open entry from URL query param: backtesting.html?entry=<uuid>
  const params = new URLSearchParams(window.location.search);
  const entryId = params.get('entry');
  if (entryId && CFP_BACKTESTS.find(b => String(b.id) === entryId)) {
    setTimeout(() => openBacktest(entryId), 200);
  }

  /* Premium unlock check — re-render the grid + open entry (if any) once
     it resolves, in case the user clicked into a premium entry before this
     finished (default is locked, so the worst case is a brief flash of the
     paywall for an already-enrolled user, never an accidental unlock). */
  if (typeof window.cfpAuth !== 'undefined' && typeof window.canAccessPremium !== 'undefined') {
    try {
      const user = await window.cfpAuth.getCurrentUser();
      cfpCurrentUser = user || null;
      cfpUserHasPremiumAccess = user ? await window.canAccessPremium(user.id) : false;
      cfpBacktestCutoffDate = (user && typeof window.getBacktestCutoffDate === 'function')
        ? await window.getBacktestCutoffDate(user.id)
        : null;
      /* Restore the full free window for signed-in users (data.js sets this
         from Supabase config when it loads; fall back to the module default). */
      if (cfpCurrentUser) {
        window.CFP_FREE_WINDOW_DAYS = CFP_FREE_WINDOW_DAYS;
      }
    } catch (e) {
      cfpCurrentUser = null;
      cfpUserHasPremiumAccess = false;
      cfpBacktestCutoffDate = null;
    }
    renderAccessTierLabel();
    renderBtGrid();
    if (cfpCurrentBacktestId !== null) openBacktest(cfpCurrentBacktestId);
  }
})();

/* Small visible label on the page showing what the logged-in visitor's
   current backtest access tier actually is. */
function renderAccessTierLabel() {
  const el = document.getElementById('bt-access-tier');
  if (!el) return;
  if (!cfpUserHasPremiumAccess) { el.style.display = 'none'; return; }
  let label;
  if (!cfpBacktestCutoffDate) {
    label = 'Your access: All backtests';
  } else {
    const days = Math.round((Date.now() - cfpBacktestCutoffDate.getTime()) / 86400000);
    label = days >= 80 ? 'Your access: Last 3 months' : days >= 25 ? 'Your access: Last 1 month' : `Your access: Last ${days} days`;
  }
  el.textContent = label;
  el.style.display = 'inline-block';
}
