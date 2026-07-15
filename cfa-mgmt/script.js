/* ==============================================
   Capital Finplus Academy — Admin script.js
   Reads/writes Supabase directly (courses, articles,
   backtests, testimonials, site_content). Auth is real
   Supabase Auth, gated by profiles.is_admin. Transactions
   (payments) and Form Submissions are fetched live from
   Supabase each time their panel is opened — they are not
   part of the cached `state` object.

   NOTE — required one-time SQL fixes before this works:
   the original schema typed a few columns to match the
   literal task spec, but this app's real data shapes are
   text labels, not numbers. Run these once in Supabase's
   SQL editor before using this dashboard:

     alter table public.courses alter column price type text;
     alter table public.articles alter column readtime type text;
     alter table public.backtests alter column readtime type text;
     alter table public.articles add column if not exists cat text;
     alter table public.courses add column if not exists plan_only boolean not null default false;

   Without these, saving a course/article/backtest with a
   non-numeric price or a "8 min read"-style readtime value
   will fail with a Postgres type error.
   ============================================== */

let state = { hero: {}, about: {}, stats: {}, contact: {}, legal: {}, premium: {}, pages: { blog: {}, backtesting: {}, newsletter: {} }, courses: [], testimonials: [], articles: [], backtests: [] };
let editingArticleId = null;
let editingBtId = null;
let cfpLastUpdated = null;


/* ID helpers (cfpIsUuid, cfpTempId) and the row<->local mapper functions
   (cfpCourseToRow/cfpRowToCourse, etc.) live in ../data.js — shared with
   cfpLoadPublicData() so the admin's write-side mapping and the public
   site's read-side mapping can never drift apart. */

/* ── GENERIC COLLECTION SYNC ──
   Reconciles a local array (with possible temp ids for new rows) against
   its Supabase table: updates rows that already exist, inserts rows that
   don't (backfilling the real uuid onto the local item), and deletes rows
   that exist in the DB but were removed locally. */
async function cfpSyncCollection(table, localArray, mapToRow) {
  const { data: existing, error: selErr } = await window.cfpSupabase.from(table).select('id');
  if (selErr) { console.error('sync select failed', table, selErr); throw selErr; }
  const existingIds = new Set((existing || []).map(r => r.id));
  const keepIds = new Set();

  for (let i = 0; i < localArray.length; i++) {
    const item = localArray[i];
    const row = mapToRow(item, i);
    if (cfpIsUuid(item.id) && existingIds.has(item.id)) {
      keepIds.add(item.id);
      const { error } = await window.cfpSupabase.from(table).update(row).eq('id', item.id);
      if (error) throw error;
    } else {
      const { data, error } = await window.cfpSupabase.from(table).insert(row).select('id').single();
      if (error) throw error;
      item.id = data.id;
      keepIds.add(data.id);
    }
  }

  const toDelete = [...existingIds].filter(id => !keepIds.has(id));
  if (toDelete.length) {
    const { error } = await window.cfpSupabase.from(table).delete().in('id', toDelete);
    if (error) throw error;
  }
}

/* ── SITE CONTENT (hero/about/stats/contact/legal/premium/pages) ── */
const CFP_SITE_CONTENT_KEYS = ['hero', 'about', 'stats', 'contact', 'legal', 'premium', 'pages', 'comparison'];

async function cfpSaveSiteContent() {
  const rows = CFP_SITE_CONTENT_KEYS.map(key => ({ key, value: state[key] }));
  const { error } = await window.cfpSupabase.from('site_content').upsert(rows);
  if (error) throw error;
}

async function cfpLoadSiteContent() {
  const { data, error } = await window.cfpSupabase.from('site_content').select('key, value');
  if (error) { console.error('site_content load failed', error); return {}; }
  const map = {};
  (data || []).forEach(r => { map[r.key] = r.value; });
  return map;
}

/* ── LOAD / PERSIST ── */
async function cfpAdminLoadData() {
  const defaults = (typeof CFP_DEFAULT_DATA !== 'undefined') ? CFP_DEFAULT_DATA : {};
  const siteMap = await cfpLoadSiteContent();

  const [coursesRes, testRes, artRes, btRes] = await Promise.all([
    window.cfpSupabase.from('courses').select('*').order('sort_order', { ascending: true }),
    window.cfpSupabase.from('testimonials').select('*').order('sort_order', { ascending: true }),
    window.cfpSupabase.from('articles').select('*').order('date', { ascending: false }),
    window.cfpSupabase.from('backtests').select('*').order('date', { ascending: false })
  ]);

  return {
    hero: siteMap.hero || defaults.hero || {},
    about: siteMap.about || defaults.about || {},
    stats: siteMap.stats || defaults.stats || {},
    contact: siteMap.contact || defaults.contact || {},
    legal: siteMap.legal || defaults.legal || {},
    premium: siteMap.premium || defaults.premium || { anonDays: 7, selfStudyDays: 30, guidedDays: 90 },
    pages: siteMap.pages || defaults.pages || {},
    comparison: siteMap.comparison || defaults.comparison || { columns: ['Features', 'Self-Study', 'Guided Learning', 'Mentorship Program'], rows: [] },
    courses: (coursesRes.data || []).map(cfpRowToCourse),
    testimonials: (testRes.data || []).map(cfpRowToTestimonial),
    articles: (artRes.data || []).map(cfpRowToArticle),
    backtests: (btRes.data || []).map(cfpRowToBacktest)
  };
}

async function persist() {
  try {
    await cfpSaveSiteContent();
    await cfpSyncCollection('courses', state.courses, cfpCourseToRow);
    await cfpSyncCollection('testimonials', state.testimonials, cfpTestimonialToRow);
    await cfpSyncCollection('articles', state.articles, cfpArticleToRow);
    await cfpSyncCollection('backtests', state.backtests || [], cfpBacktestToRow);
    cfpLastUpdated = new Date().toLocaleString('en-IN');
    const tag = document.getElementById('last-updated-tag');
    if (tag) tag.textContent = cfpLastUpdated;
  } catch (e) {
    console.error('persist failed', e);
    showToast('⚠️ Save failed — check your connection and try again');
    throw e;
  }
}

/* ── AUTH GATE ── */
/* No login form here — admins sign in via account.html which redirects
   them to this page. Anyone arriving without a valid admin session is
   sent back to account.html to log in. */
document.getElementById('logout-btn').addEventListener('click', async () => {
  await window.cfpSupabase.auth.signOut();
  window.location.href = '/pages/account.html';
});

(async function checkExistingSession() {
  if (typeof window.cfpSupabase === 'undefined') {
    window.location.href = '/pages/account.html';
    return;
  }
  const { data } = await window.cfpSupabase.auth.getUser();
  const user = data && data.user;
  if (!user) {
    window.location.href = '/pages/account.html';
    return;
  }
  const { data: profile } = await window.cfpSupabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile || !profile.is_admin) {
    window.location.href = '/pages/account.html';
    return;
  }
  document.getElementById('app').style.display = 'flex';
  await init();
})();

/* ── NAV ── */
function switchPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.panel === id));
  const titles = { dashboard: 'Dashboard', hero: 'Hero Section', about: 'About / Founder', courses: 'Courses & Pricing', comparison: 'Comparison Table', testimonials: 'Testimonials', 'blog-list': 'All Articles', 'blog-new': 'New Article', 'bt-list': 'All Backtests', 'bt-new': 'New Backtest', students: 'Students', 'manual-enroll': 'Manual Enroll', transactions: 'Transactions', submissions: 'Form Submissions', 'contact-info': 'Contact & Integrations', 'page-content': 'Blog & Backtesting Pages', newsletter: 'Newsletter', 'send-newsletter': 'Send Newsletter', 'playlist-videos': 'Playlist Videos', coupons: 'Coupons', 'academy-pdf': 'Academy PDF' };
  document.getElementById('topbar-title').textContent = titles[id] || id;
  if (id === 'blog-list') renderBlogTable();
  if (id === 'testimonials') renderTestimonials();
  if (id === 'courses') renderCourses();
  if (id === 'comparison') renderComparison();
  if (id === 'students') renderStudents();
  if (id === 'manual-enroll') renderManualEnroll();
  if (id === 'transactions') renderTransactions();
  if (id === 'submissions') renderSubmissions();
  if (id === 'newsletter') renderNewsletter();
  if (id === 'send-newsletter') renderSendNewsletter();
  if (id === 'playlist-videos') renderPlaylistVideos();
  if (id === 'coupons') renderCoupons();
  if (id === 'academy-pdf') initAcademyPdfPanel();
  if (id === 'blog-new' && !editingArticleId) resetEditor();
  if (id === 'bt-list') renderBtTable();
  if (id === 'bt-new' && !editingBtId) resetBtEditor();
}
document.querySelectorAll('.nav-item').forEach(item => item.addEventListener('click', () => switchPanel(item.dataset.panel)));

/* ── GLOBAL SAVE ── */
document.getElementById('global-save').addEventListener('click', saveAll);
async function saveAll() {
  collectFormData();
  try {
    await persist();
    renderDashboard();
    showToast('✅ All changes saved — live on the site now');
  } catch (e) {
    // persist() already surfaced an error toast
  }
}

function collectFormData() {
  state.hero.line1 = val('hero-line1');
  state.hero.accent = val('hero-accent');
  state.hero.line3 = val('hero-line3');
  state.hero.sub = val('hero-sub');
  state.hero.cta1 = val('hero-cta1');
  state.hero.cta2 = val('hero-cta2');
  state.hero.badge = val('hero-badge');
  state.stats.students = val('stat-students-input');
  state.stats.experience = val('stat-experience-input');
  state.stats.rating = val('stat-rating-input');

  state.about.founderName = val('founder-name-input');
  state.about.founderTitle = val('founder-title-input');
  state.about.heading = val('about-heading-input');
  state.about.p1 = val('about-p1-input');
  state.about.p2 = val('about-p2-input');
  state.about.bio = val('founder-bio-input');
  state.about.credentials = val('about-credentials-input').split(',').map(s => s.trim()).filter(Boolean);

  state.contact.whatsapp = val('contact-wa');
  state.contact.email = val('contact-email-input');
  state.contact.telegram = val('contact-telegram-input');
  state.contact.instagram = val('contact-insta');
  state.contact.youtube = val('contact-youtube');
  state.contact.twitter = val('contact-twitter');
  state.contact.calendlyUrl = val('contact-calendly');
  state.contact.razorpayKeyId = val('contact-razorpay');
  state.legal.disclaimer = val('legal-disclaimer-input');
  state.premium.anonDays = Number(val('premium-free-days')) || 7;
  state.premium.selfStudyDays = Number(val('premium-self-study-days')) || 30;
  state.premium.guidedDays = Number(val('premium-guided-days')) || 90;

  state.pages.blog.tag = val('pc-blog-tag');
  state.pages.blog.title = val('pc-blog-title');
  state.pages.blog.sub = val('pc-blog-sub');
  state.pages.blog.freeLabel = val('pc-blog-free-label');
  state.pages.blog.premiumLabel = val('pc-blog-premium-label');

  state.pages.backtesting.tag = val('pc-bt-tag');
  state.pages.backtesting.title = val('pc-bt-title');
  state.pages.backtesting.sub = val('pc-bt-sub');
  state.pages.backtesting.freeLabel = val('pc-bt-free-label');
  state.pages.backtesting.premiumLabel = val('pc-bt-premium-label');

  state.pages.newsletter.tag = val('pc-nl-tag');
  state.pages.newsletter.title = val('pc-nl-title');
  state.pages.newsletter.sub = val('pc-nl-sub');
  state.pages.newsletter.buttonLabel = val('pc-nl-btn');

  // Courses (collected from dynamically rendered inputs — ids are uuid
  // strings, or a temp marker for a course not yet saved)
  document.querySelectorAll('[data-course-id]').forEach(group => {
    const id = group.dataset.courseId;
    const course = state.courses.find(c => String(c.id) === id);
    if (!course) return;
    group.querySelectorAll('[data-field]').forEach(el => {
      const f = el.dataset.field;
      if (f === 'features') course.features = el.value.split('\n').map(s => s.trim()).filter(Boolean);
      else if (el.type === 'checkbox') course[f] = el.checked;
      else course[f] = el.value;
    });
  });

  // Comparison table (collected from its own panel's inputs, if present)
  collectComparison();
}

function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }

/* ── TOAST ── */
function showToast(msg = '✅ Changes saved') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), 3000);
}

/* ── DASHBOARD ── */
function renderDashboard() {
  const free = state.articles.filter(a => a.access === 'free').length;
  const premium = state.articles.length - free;
  document.getElementById('stat-articles').textContent = state.articles.length;
  document.getElementById('stat-articles-sub').textContent = `${free} free · ${premium} premium`;
  document.getElementById('stat-courses').textContent = state.courses.length;

  document.getElementById('nav-article-count').textContent = state.articles.length;
  document.getElementById('nav-bt-count').textContent = (state.backtests || []).length;

  if (cfpLastUpdated) document.getElementById('last-updated-tag').textContent = cfpLastUpdated;

  // Revenue + lead counts live in Supabase (payments / form_submissions),
  // not in `state` — fetched here so the dashboard cards show real numbers.
  cfpLoadDashboardStats();
}

async function cfpLoadDashboardStats() {
  const [paymentsRes, subCountRes, txCountRes, nlCountRes, studentsCountRes, bookingsRes, activeStudentsRes] = await Promise.all([
    window.cfpSupabase.from('payments').select('amount').eq('status', 'captured'),
    window.cfpSupabase.from('form_submissions').select('id', { count: 'exact', head: true }),
    window.cfpSupabase.from('payments').select('id', { count: 'exact', head: true }),
    window.cfpSupabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true }),
    window.cfpSupabase.from('enrollments').select('id', { count: 'exact', head: true }),
    window.cfpSupabase.from('form_submissions').select('id', { count: 'exact', head: true }).eq('type', 'booking'),
    window.cfpSupabase.from('enrollments').select('user_id', { count: 'exact', head: true }).eq('status', 'active')
  ]);
  const captured = paymentsRes.data || [];
  const revenue = captured.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  document.getElementById('stat-revenue').textContent = '₹' + revenue.toLocaleString('en-IN');
  document.getElementById('stat-revenue-sub').textContent = `from ${captured.length} captured payment${captured.length === 1 ? '' : 's'}`;
  document.getElementById('stat-leads').textContent = subCountRes.count || 0;
  document.getElementById('nav-tx-count').textContent = txCountRes.count || 0;
  document.getElementById('nav-sub-count').textContent = subCountRes.count || 0;
  document.getElementById('nav-nl-count').textContent = nlCountRes.count || 0;
  document.getElementById('nav-students-count').textContent = studentsCountRes.count || 0;

  // Funnel
  const callsCount = bookingsRes.count || 0;
  const paymentsCount = txCountRes.count || 0;
  const activeCount = activeStudentsRes.count || 0;
  document.getElementById('funnel-calls').textContent = callsCount;
  document.getElementById('funnel-payments').textContent = paymentsCount;
  document.getElementById('funnel-students').textContent = activeCount;
  if (callsCount > 0) document.getElementById('funnel-payments-pct').textContent = Math.round(paymentsCount / callsCount * 100) + '% of calls';
  if (paymentsCount > 0) document.getElementById('funnel-students-pct').textContent = Math.round(activeCount / paymentsCount * 100) + '% of payments';

  // Charts — lazy-load Chart.js then render
  cfpLoadChartJs(() => { cfpRenderRevenueChart(); cfpRenderSignupsChart(); });
}

/* ── CHART.JS LAZY LOADER ── */
let cfpChartJsPending = [];
function cfpLoadChartJs(cb) {
  if (window.Chart) { cb(); return; }
  cfpChartJsPending.push(cb);
  if (cfpChartJsPending.length > 1) return;
  const s = document.createElement('script');
  s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4/dist/chart.umd.min.js';
  s.onload = () => { cfpChartJsPending.forEach(fn => fn()); cfpChartJsPending = []; };
  document.head.appendChild(s);
}

let cfpRevenueChart = null;
let cfpSignupsChart = null;

async function cfpRenderRevenueChart() {
  const { data } = await window.cfpSupabase.from('payments').select('amount, courses(name)').eq('status', 'captured');
  const totals = {};
  (data || []).forEach(p => {
    const name = (p.courses && p.courses.name) || 'Unknown';
    totals[name] = (totals[name] || 0) + Number(p.amount || 0);
  });
  const labels = Object.keys(totals);
  const values = Object.values(totals);
  const ctx = document.getElementById('chart-revenue');
  if (!ctx) return;
  if (cfpRevenueChart) cfpRevenueChart.destroy();
  cfpRevenueChart = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: '#F4C20D', borderRadius: 6, barThickness: 28 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: c => '₹' + Number(c.raw).toLocaleString('en-IN') } } },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.55)', callback: v => '₹' + Number(v).toLocaleString('en-IN') }, grid: { color: 'rgba(244,194,13,0.08)' } },
        y: { ticks: { color: 'rgba(255,255,255,0.7)' }, grid: { display: false } }
      }
    }
  });
}

async function cfpRenderSignupsChart() {
  const { data } = await window.cfpSupabase.from('newsletter_subscribers').select('subscribed_at').order('subscribed_at', { ascending: true });
  const now = new Date();
  const weekStarts = [];
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weekStarts.push(d);
  }
  const labels = weekStarts.map(d => {
    const month = d.toLocaleString('en-IN', { month: 'short' });
    return `${month} W${Math.ceil(d.getDate() / 7)}`;
  });
  const counts = new Array(12).fill(0);
  (data || []).forEach(row => {
    const d = new Date(row.subscribed_at);
    for (let i = 0; i < 12; i++) {
      const start = new Date(weekStarts[i]); start.setDate(start.getDate() - 3);
      const end = new Date(weekStarts[i]); end.setDate(end.getDate() + 4);
      if (d >= start && d < end) { counts[i]++; break; }
    }
  });
  const ctx = document.getElementById('chart-signups');
  if (!ctx) return;
  if (cfpSignupsChart) cfpSignupsChart.destroy();
  cfpSignupsChart = new Chart(ctx, {
    type: 'line',
    data: { labels, datasets: [{ data: counts, borderColor: '#F4C20D', backgroundColor: 'rgba(244,194,13,0.12)', fill: true, tension: 0.4, pointBackgroundColor: '#F4C20D' }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: 'rgba(255,255,255,0.55)', maxRotation: 45 }, grid: { color: 'rgba(244,194,13,0.08)' } },
        y: { ticks: { color: 'rgba(255,255,255,0.55)' }, grid: { color: 'rgba(244,194,13,0.08)' }, beginAtZero: true }
      }
    }
  });
}

/* ── COURSES ── */
function renderCourses() {
  const wrap = document.getElementById('courses-edit');
  wrap.innerHTML = state.courses.map((c, i) => `
    <div class="card" data-course-id="${c.id}" id="course-card-${c.id}">
      <h3>📚 Course ${i + 1} ${c.planOnly ? '<span class="tag" style="background:rgba(244,194,13,0.18);">Pricing Tier</span>' : ''} <span class="tag">${escHtml(c.level)}</span>
        <button class="action-btn delete" style="margin-left:auto" onclick="deleteCourse('${c.id}')">🗑 Remove</button>
      </h3>
      <div class="form-group">
        <label class="form-label" style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
          <input type="checkbox" data-field="planOnly" ${c.planOnly ? 'checked' : ''} />
          Pricing-tier card (shows in the 3-column pricing block above the table, not the full course grid)
        </label>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Course Name</label><input class="form-input" data-field="name" value="${escAttr(c.name)}" /></div>
        <div class="form-group"><label class="form-label">Subtitle</label><input class="form-input" data-field="subtitle" value="${escAttr(c.subtitle)}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Level Tag (e.g. "Free · Beginner") — hidden on pricing-tier cards</label><input class="form-input" data-field="level" value="${escAttr(c.level)}" /></div>
      <div class="form-group"><label class="form-label">Description</label><textarea class="form-textarea" data-field="desc">${escHtml(c.desc)}</textarea></div>
      <div class="form-row-3">
        <div class="form-group"><label class="form-label">Price label (e.g. ₹24,999 / FREE)</label><input class="form-input" data-field="price" value="${escAttr(c.price)}" /></div>
        <div class="form-group"><label class="form-label">Price sub-label</label><input class="form-input" data-field="priceSub" value="${escAttr(c.priceSub)}" /></div>
        <div class="form-group"><label class="form-label">Button Label</label><input class="form-input" data-field="ctaLabel" value="${escAttr(c.ctaLabel)}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Button Link (use payment.html?course=ID for paid courses, javascript:void(0) to open the booking modal)</label><input class="form-input" data-field="ctaLink" value="${escAttr(c.ctaLink)}" /></div>
      <div class="form-group"><label class="form-label">Includes / Features (one per line) — used unless "Advanced Sections" below is filled in</label><textarea class="form-textarea" data-field="features" style="min-height:90px">${(c.features || []).join('\n')}</textarea></div>
      <div class="form-group">
        <label class="form-label">Advanced Sections (optional — for bundles with multiple named modules, e.g. EDGE + PRECISION)</label>
        <p class="form-hint">Start a section with <code>## Heading</code>, plain lines become intro text, <code>- bullet</code> for a point, and <code>&gt; Outcome: ...</code> for the highlighted summary at the end of each section. Leave blank to just use the simple list above.</p>
        <textarea class="form-textarea" data-field="featuresRich" style="min-height:220px;font-family:monospace;font-size:0.8rem;" placeholder="## EDGE
Develop a Structured &amp; Repeatable Trading Process
Learn the complete CFA Trading System and the logic behind every trade.
- The complete CFA Trading System
- Chart setup and workspace configuration
&gt; Outcome: Develop a repeatable framework that helps identify high-probability trading opportunities.

## PRECISION
Master Option Buying and Selling Through Premium Charts
- Understanding option premium behaviour
&gt; Outcome: Learn to execute trades with greater precision and improved risk management.">${escHtml(c.featuresRich || '')}</textarea>
      </div>
    </div>
  `).join('') || '<div class="empty-state">No courses yet — click "Add Course" below.</div>';
  document.getElementById('course-count-badge').textContent = state.courses.length + ' total';
}

document.getElementById('add-course').addEventListener('click', () => {
  state.courses.push({ id: cfpTempId(), level: 'New · Tier', name: 'New Course', subtitle: 'Subtitle here', desc: 'Course description...', features: ['Feature one', 'Feature two'], featuresRich: '', price: '₹0', priceSub: '+ GST · One-time', ctaLabel: 'Enroll Now', ctaLink: '/pages/payment.html', isModal: false });
  renderCourses();
  showToast('✅ Course added — fill in the details and Save Changes');
});

async function deleteCourse(id) {
  if (!confirm('Remove this course? This cannot be undone.')) return;
  state.courses = state.courses.filter(c => c.id !== id);
  try {
    await persist();
    renderCourses();
    renderDashboard();
    showToast('🗑 Course removed');
  } catch (e) { /* persist() already toasted the error */ }
}

/* ── COMPARISON TABLE (the "Designed for Every Stage" plan grid) ── */
function renderComparison() {
  const wrap = document.getElementById('comparison-edit');
  if (!wrap) return;
  if (!state.comparison || !Array.isArray(state.comparison.columns)) {
    state.comparison = { columns: ['Features', 'Self-Study', 'Guided Learning', 'Mentorship Program'], rows: [] };
  }
  const comp = state.comparison;
  const colInputs = comp.columns.map((c, i) => `
    <div class="form-group" style="flex:1;min-width:150px;">
      <label class="form-label">${i === 0 ? 'Row-header column' : 'Plan column ' + i}</label>
      <input class="form-input" data-comp-col="${i}" value="${escAttr(c)}" />
    </div>`).join('');
  const planCols = comp.columns.slice(1);
  const rowsHtml = (comp.rows || []).map((row, ri) => `
    <div class="card" data-comp-row="${ri}" style="padding:1rem 1.25rem;">
      <div style="display:flex;align-items:center;gap:0.75rem;margin-bottom:0.75rem;">
        <strong style="font-size:0.85rem;color:var(--text-sec);">Row ${ri + 1}</strong>
        <button class="action-btn delete" style="margin-left:auto" onclick="cfpRemoveComparisonRow(${ri})">🗑 Remove</button>
      </div>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Feature (row heading)</label><input class="form-input" data-comp-field="feature" value="${escAttr(row.feature)}" /></div>
        <div class="form-group"><label class="form-label">Sub-label (optional grey text)</label><input class="form-input" data-comp-field="sub" value="${escAttr(row.sub || '')}" /></div>
      </div>
      <div class="form-row-3">
        ${planCols.map((pc, ci) => `<div class="form-group"><label class="form-label">${escHtml(pc)}</label><input class="form-input" data-comp-cell="${ci}" value="${escAttr((row.cells && row.cells[ci]) || '')}" /></div>`).join('')}
      </div>
    </div>`).join('') || '<div class="empty-state">No rows yet — click "Add Row".</div>';

  wrap.innerHTML = `
    <div class="card">
      <h3>Column Headings</h3>
      <p class="form-hint">The first column is the row-header column ("Features"). The other three are your plan tiers — keep these matching the plan names above.</p>
      <div class="form-row">${colInputs}</div>
    </div>
    <div class="card">
      <h3>Rows <span class="tag">${(comp.rows || []).length}</span></h3>
      <p class="form-hint">Type <code>✓</code> for a checkmark, <code>—</code> (or leave blank) for a dash, or any text for a plan cell. Click <strong>Save Changes</strong> at the top when done.</p>
      <div id="comparison-rows">${rowsHtml}</div>
      <button class="btn-accent" id="add-comparison-row" style="margin-top:1rem;">+ Add Row</button>
    </div>`;

  document.getElementById('add-comparison-row').addEventListener('click', () => {
    collectComparison();
    const n = Math.max(1, state.comparison.columns.length - 1);
    state.comparison.rows.push({ feature: 'New feature', sub: '', cells: Array(n).fill('—') });
    renderComparison();
    showToast('✅ Row added — fill it in and Save Changes');
  });
}

function collectComparison() {
  const wrap = document.getElementById('comparison-edit');
  if (!wrap || !state.comparison) return;
  const colEls = [...wrap.querySelectorAll('[data-comp-col]')].sort((a, b) => a.dataset.compCol - b.dataset.compCol);
  if (colEls.length) state.comparison.columns = colEls.map(el => el.value);
  state.comparison.rows = [...wrap.querySelectorAll('[data-comp-row]')].map(rowEl => {
    const feature = rowEl.querySelector('[data-comp-field="feature"]');
    const sub = rowEl.querySelector('[data-comp-field="sub"]');
    const cells = [...rowEl.querySelectorAll('[data-comp-cell]')]
      .sort((a, b) => a.dataset.compCell - b.dataset.compCell).map(el => el.value);
    return { feature: feature ? feature.value : '', sub: sub ? sub.value : '', cells };
  });
}

function cfpRemoveComparisonRow(ri) {
  collectComparison();
  state.comparison.rows.splice(ri, 1);
  renderComparison();
  showToast('🗑 Row removed');
}

/* ── TESTIMONIALS ── */
function renderTestimonials() {
  const grid = document.getElementById('testimonials-edit');
  grid.innerHTML = state.testimonials.map((t, i) => `
    <div class="item-edit-card">
      <div class="item-header"><span class="item-num">Testimonial ${i + 1}</span>
        <button class="action-btn delete" onclick="deleteTestimonial('${t.id}')">🗑</button>
      </div>
      <div class="form-group"><label class="form-label">Name</label><input class="form-input" value="${escAttr(t.name)}" oninput="updateTestimonial('${t.id}','name',this.value)" /></div>
      <div class="form-group"><label class="form-label">Role / City</label><input class="form-input" value="${escAttr(t.role)}" oninput="updateTestimonial('${t.id}','role',this.value)" /></div>
      <div class="form-group"><label class="form-label">Quote</label><textarea class="form-textarea" oninput="updateTestimonial('${t.id}','quote',this.value)">${escHtml(t.quote)}</textarea></div>
      <div class="form-group"><label class="form-label">Star Rating</label>
        <select class="form-select" onchange="updateTestimonial('${t.id}','rating',parseInt(this.value))">
          <option value="5" ${t.rating == 5 ? 'selected' : ''}>5</option><option value="4" ${t.rating == 4 ? 'selected' : ''}>4</option><option value="3" ${t.rating == 3 ? 'selected' : ''}>3</option>
        </select>
      </div>
    </div>
  `).join('') || '<div class="empty-state">No testimonials yet.</div>';
  document.getElementById('testimonial-count-badge').textContent = state.testimonials.length + ' active';
}

function updateTestimonial(id, field, value) {
  const t = state.testimonials.find(x => x.id === id);
  if (t) t[field] = value;
}

async function deleteTestimonial(id) {
  state.testimonials = state.testimonials.filter(t => t.id !== id);
  try {
    await persist();
    renderTestimonials();
    showToast('🗑 Testimonial removed');
  } catch (e) { /* persist() already toasted the error */ }
}

document.getElementById('add-testimonial').addEventListener('click', () => {
  state.testimonials.push({ id: cfpTempId(), name: 'Student Name', role: 'City, Profession', rating: 5, quote: 'Enter testimonial quote here...' });
  renderTestimonials();
  showToast('✅ Testimonial added — fill in the details and save');
});

/* ── BLOG TABLE ── */
function renderBlogTable() {
  const tbody = document.getElementById('blog-table-body');
  tbody.innerHTML = state.articles.map(a => `
    <tr>
      <td style="color:var(--text);font-weight:500;max-width:300px">${escHtml(a.title)}${a.featured ? ' <span class="badge badge-premium" style="margin-left:6px;">🔥 Most Read</span>' : ''}</td>
      <td>${escHtml(a.category)}</td>
      <td><span class="badge badge-${a.access}">${a.access}</span></td>
      <td>${escHtml(a.date)}</td>
      <td><div class="actions-cell">
        <button class="action-btn" onclick="toggleFeatured('${a.id}')">${a.featured ? '⭐ Unmark' : '🔥 Mark Most Read'}</button>
        <button class="action-btn" onclick="editArticle('${a.id}')">✏️ Edit</button>
        <button class="action-btn delete" onclick="deleteArticle('${a.id}')">🗑 Delete</button>
      </div></td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">No articles yet.</td></tr>';
  document.getElementById('article-count-badge').textContent = state.articles.length + ' total';
  document.getElementById('stat-articles').textContent = state.articles.length;
}

async function toggleFeatured(id) {
  const a = state.articles.find(x => x.id === id);
  if (!a) return;
  a.featured = !a.featured;
  try {
    await persist();
    renderBlogTable();
    showToast(a.featured ? '🔥 Marked as Most Read' : '⭐ Removed from Most Read');
  } catch (e) { /* persist() already toasted the error */ }
}

async function deleteArticle(id) {
  if (!confirm('Delete this article? This cannot be undone.')) return;
  state.articles = state.articles.filter(a => a.id !== id);
  try {
    await persist();
    renderBlogTable();
    renderDashboard();
    showToast('🗑 Article deleted');
  } catch (e) { /* persist() already toasted the error */ }
}

function editArticle(id) {
  const a = state.articles.find(x => x.id === id);
  if (!a) return;
  editingArticleId = id;
  document.getElementById('edit-art-title').value = a.title;
  document.getElementById('edit-art-cat').value = a.category;
  document.getElementById('edit-art-access').value = a.access;
  document.getElementById('edit-art-excerpt').value = a.excerpt;
  document.getElementById('edit-art-featured').checked = !!a.featured;
  document.getElementById('edit-modal').classList.add('open');
}

document.getElementById('edit-modal-save').addEventListener('click', async () => {
  const a = state.articles.find(x => x.id === editingArticleId);
  if (!a) return;
  a.title = document.getElementById('edit-art-title').value;
  a.category = document.getElementById('edit-art-cat').value;
  a.access = document.getElementById('edit-art-access').value;
  a.excerpt = document.getElementById('edit-art-excerpt').value;
  a.featured = document.getElementById('edit-art-featured').checked;
  try {
    await persist();
    renderBlogTable();
    document.getElementById('edit-modal').classList.remove('open');
    showToast('✅ Article updated');
    editingArticleId = null;
  } catch (e) { /* persist() already toasted the error */ }
});
document.getElementById('edit-modal-close').addEventListener('click', () => document.getElementById('edit-modal').classList.remove('open'));
document.getElementById('edit-modal-cancel').addEventListener('click', () => document.getElementById('edit-modal').classList.remove('open'));

/* ── BLOG EDITOR (new article) ── */
function fmt(cmd) { document.execCommand(cmd, false, null); document.getElementById('article-body').focus(); }
function fmtBlock(tag) { document.execCommand('formatBlock', false, tag); document.getElementById('article-body').focus(); }

function resetEditor() {
  editingArticleId = null;
  document.getElementById('blog-editor-title').textContent = 'New Article';
  document.getElementById('article-title').value = '';
  document.getElementById('article-cat-label').value = '';
  document.getElementById('article-cat-slug').value = '';
  document.getElementById('article-access').value = 'free';
  document.getElementById('article-readtime').value = '';
  document.getElementById('article-icon').value = 'trending_up';
  document.getElementById('article-color').value = '#F4C20D';
  document.getElementById('article-excerpt').value = '';
  document.getElementById('article-body').innerHTML = '';
  document.getElementById('article-featured').checked = false;
}

document.getElementById('publish-article').addEventListener('click', async () => {
  const title = document.getElementById('article-title').value.trim();
  if (!title) { showToast('⚠️ Please add a title'); return; }
  const now = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const newArt = {
    id: cfpTempId(),
    title,
    category: document.getElementById('article-cat-label').value || 'General',
    cat: document.getElementById('article-cat-slug').value || 'general',
    access: document.getElementById('article-access').value,
    date: now,
    readtime: document.getElementById('article-readtime').value || '5 min read',
    icon: document.getElementById('article-icon').value || 'trending_up',
    color: document.getElementById('article-color').value || '#F4C20D',
    bg: 'linear-gradient(135deg,#2a2008 0%,#4a3508 100%)',
    excerpt: document.getElementById('article-excerpt').value,
    body: document.getElementById('article-body').innerHTML,
    featured: document.getElementById('article-featured').checked
  };
  state.articles.unshift(newArt);
  try {
    await persist();
    resetEditor();
    renderDashboard();
    showToast('🎉 Article published!');
    switchPanel('blog-list');
  } catch (e) { /* persist() already toasted the error */ }
});

document.getElementById('cancel-edit').addEventListener('click', () => { resetEditor(); switchPanel('blog-list'); });

/* ── BACKTESTING ── */
function renderBtTable() {
  const tbody = document.getElementById('bt-table-body');
  const list = (state.backtests || []).slice().sort((a, b) => new Date(b.date) - new Date(a.date));
  tbody.innerHTML = list.map(b => `
    <tr>
      <td style="color:var(--text);font-weight:500;max-width:280px">${escHtml(b.title)}</td>
      <td>${escHtml(b.instrument)} · ${escHtml(b.timeframe)}</td>
      <td>${b.result ? `<span class="badge ${b.result === 'Win' ? 'badge-free' : 'badge-failed'}">${escHtml(b.result)}</span>` : '—'}</td>
      <td>${escHtml(b.date)}</td>
      <td><div class="actions-cell">
        <button class="action-btn" onclick="editBacktest('${b.id}')">✏️ Edit</button>
        <button class="action-btn delete" onclick="deleteBacktest('${b.id}')">🗑 Delete</button>
      </div></td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">No backtests posted yet — click "Post Today\'s Backtest" to add your first one.</td></tr>';
  document.getElementById('bt-count-badge').textContent = (state.backtests || []).length + ' total';
}

async function deleteBacktest(id) {
  if (!confirm('Delete this backtest entry? This cannot be undone.')) return;
  state.backtests = (state.backtests || []).filter(b => b.id !== id);
  try {
    await persist();
    renderBtTable();
    renderDashboard();
    showToast('🗑 Backtest deleted');
  } catch (e) { /* persist() already toasted the error */ }
}

/* ── BACKTEST CHART IMAGE ──
   Uploaded to the `backtest-charts` Supabase Storage bucket (not stored
   inline like the founder photo) since these accumulate daily and a
   bucket scales better than base64-in-jsonb. btChartImageFile holds a
   newly-picked File pending upload; btChartImageUrl holds the current
   (already-uploaded) public URL, if any. */
let btChartImageFile = null;
let btChartImageUrl = '';

function renderBtChartPreview(url) {
  const img = document.getElementById('bt-chart-img');
  const placeholder = document.getElementById('bt-chart-placeholder');
  if (url) {
    img.src = url;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    img.removeAttribute('src');
    placeholder.style.display = 'block';
  }
}

document.getElementById('bt-chart-pick').addEventListener('click', () => {
  document.getElementById('bt-chart-input').click();
});

document.getElementById('bt-chart-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  btChartImageFile = file;
  const reader = new FileReader();
  reader.onload = (ev) => renderBtChartPreview(ev.target.result);
  reader.readAsDataURL(file);
  e.target.value = '';
});

document.getElementById('bt-chart-remove').addEventListener('click', () => {
  btChartImageFile = null;
  btChartImageUrl = '';
  renderBtChartPreview('');
});

function editBacktest(id) {
  const b = (state.backtests || []).find(x => x.id === id);
  if (!b) return;
  editingBtId = id;
  document.getElementById('bt-editor-title').textContent = 'Edit Backtest';
  document.getElementById('bt-title').value = b.title;
  document.getElementById('bt-instrument').value = b.instrument;
  document.getElementById('bt-timeframe').value = b.timeframe;
  document.getElementById('bt-result').value = b.result || '';
  document.getElementById('bt-date').value = cfpToDateInputValue(b.date);
  document.getElementById('bt-readtime').value = b.readtime || '';
  document.getElementById('bt-icon').value = b.icon || 'candlestick_chart';
  document.getElementById('bt-excerpt').value = b.excerpt || '';
  document.getElementById('bt-body').innerHTML = b.body || '';
  btChartImageFile = null;
  btChartImageUrl = b.chartImage || '';
  renderBtChartPreview(btChartImageUrl);
  switchPanel('bt-new');
}

function resetBtEditor() {
  editingBtId = null;
  document.getElementById('bt-editor-title').textContent = 'New Backtest';
  document.getElementById('bt-title').value = '';
  document.getElementById('bt-instrument').value = '';
  document.getElementById('bt-timeframe').value = '';
  document.getElementById('bt-result').value = 'Win';
  document.getElementById('bt-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('bt-readtime').value = '';
  document.getElementById('bt-icon').value = 'candlestick_chart';
  document.getElementById('bt-excerpt').value = '';
  document.getElementById('bt-body').innerHTML = '';
  btChartImageFile = null;
  btChartImageUrl = '';
  renderBtChartPreview('');
}

function cfpToDateInputValue(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return new Date().toISOString().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

const CFP_BT_COLORS = { candlestick_chart: '#F4C20D', shield: '#22c55e', psychology: '#e879f9', description: '#38bdf8', auto_graph: '#fbbf24', trending_up: '#fbbf24' };
const CFP_BT_BGS = {
  candlestick_chart: 'linear-gradient(135deg,#2a2008 0%,#4a3508 100%)',
  shield: 'linear-gradient(135deg,#0a2a1a 0%,#0d4a2a 100%)',
  psychology: 'linear-gradient(135deg,#2a0f18 0%,#4a1c30 100%)',
  description: 'linear-gradient(135deg,#0a1a2e 0%,#102a50 100%)',
  auto_graph: 'linear-gradient(135deg,#2e2208 0%,#56400a 100%)',
  trending_up: 'linear-gradient(135deg,#261c06 0%,#46320c 100%)'
};

document.getElementById('publish-bt').addEventListener('click', async () => {
  const title = document.getElementById('bt-title').value.trim();
  if (!title) { showToast('⚠️ Please add a title'); return; }
  const dateVal = document.getElementById('bt-date').value;
  const dateFormatted = dateVal
    ? new Date(dateVal + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const icon = document.getElementById('bt-icon').value.trim() || 'candlestick_chart';

  let chartImage = btChartImageUrl;
  if (btChartImageFile) {
    try {
      const path = Date.now() + '-' + btChartImageFile.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const { error: uploadErr } = await window.cfpSupabase.storage.from('backtest-charts').upload(path, btChartImageFile, { upsert: true });
      if (uploadErr) throw uploadErr;
      const { data: urlData } = window.cfpSupabase.storage.from('backtest-charts').getPublicUrl(path);
      chartImage = urlData.publicUrl;
    } catch (err) {
      console.error('chart image upload failed', err);
      showToast('⚠️ Chart image upload failed — publishing without it');
      chartImage = btChartImageUrl;
    }
  }

  const entry = {
    id: editingBtId || cfpTempId(),
    title,
    instrument: document.getElementById('bt-instrument').value.trim() || 'NIFTY 50',
    timeframe: document.getElementById('bt-timeframe').value.trim() || 'Daily',
    result: document.getElementById('bt-result').value,
    date: dateFormatted,
    readtime: document.getElementById('bt-readtime').value.trim() || '4 min read',
    icon,
    color: CFP_BT_COLORS[icon] || '#F4C20D',
    bg: CFP_BT_BGS[icon] || CFP_BT_BGS.candlestick_chart,
    excerpt: document.getElementById('bt-excerpt').value.trim(),
    body: document.getElementById('bt-body').innerHTML,
    chartImage
  };

  state.backtests = state.backtests || [];
  if (editingBtId) {
    const idx = state.backtests.findIndex(b => b.id === editingBtId);
    if (idx !== -1) state.backtests[idx] = entry;
  } else {
    state.backtests.unshift(entry);
  }
  try {
    await persist();
    resetBtEditor();
    renderDashboard();
    showToast('🎉 Backtest published!');
    switchPanel('bt-list');
  } catch (e) { /* persist() already toasted the error */ }
});

document.getElementById('cancel-bt-edit').addEventListener('click', () => { resetBtEditor(); switchPanel('bt-list'); });

/* ── STUDENTS (live from Supabase `enrollments`, joined to profiles/courses) ──
   Grouped by user — one row per student, all their courses shown as badges.
   Edit panel expands inline to add/revoke courses or delete the student. */
let cfpStudentGroups = [];
let cfpStudentsFilter = 'all';
let cfpStudentEditingId = null; // userId whose edit row is currently open

async function renderStudents() {
  const tbody = document.getElementById('students-table-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Loading…</td></tr>';
  // Refresh live course list for the add-course dropdown in manage panels
  if (!cfpLiveCourses.length) {
    const { data: courses } = await window.cfpSupabase
      .from('courses').select('id, name').order('sort_order', { ascending: true });
    cfpLiveCourses = courses || [];
  }
  const { data, error } = await window.cfpSupabase
    .from('enrollments')
    .select('id, user_id, course_id, status, purchased_at, profiles(full_name, email), courses(name)')
    .order('purchased_at', { ascending: false });
  if (error) {
    console.error('renderStudents failed', error);
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Could not load students.</td></tr>';
    return;
  }

  // Group flat enrollment rows by user_id
  const map = new Map();
  (data || []).forEach(r => {
    const uid = r.user_id;
    if (!map.has(uid)) map.set(uid, {
      userId: uid,
      name: (r.profiles && r.profiles.full_name) || '—',
      email: (r.profiles && r.profiles.email) || '—',
      enrollments: [],
      latestAt: r.purchased_at || ''
    });
    const g = map.get(uid);
    g.enrollments.push({ id: r.id, courseId: r.course_id, courseName: (r.courses && r.courses.name) || 'Unknown', status: r.status, purchasedAt: r.purchased_at });
    if ((r.purchased_at || '') > g.latestAt) g.latestAt = r.purchased_at;
  });
  cfpStudentGroups = Array.from(map.values());
  document.getElementById('nav-students-count').textContent = cfpStudentGroups.length;

  // Filter chips from all distinct program names
  const bar = document.getElementById('students-filter-bar');
  const programs = [];
  (data || []).forEach(r => { const n = (r.courses && r.courses.name) || 'Unknown'; if (!programs.includes(n)) programs.push(n); });
  bar.innerHTML = '<button class="filter-btn active" data-students-filter="all">All Programs</button>' +
    programs.map(p => `<button class="filter-btn" data-students-filter="${escAttr(p)}">${escHtml(p)}</button>`).join('');
  bar.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      bar.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cfpStudentsFilter = btn.dataset.studentsFilter;
      cfpRenderStudentsTable();
    });
  });

  cfpStudentsFilter = 'all';
  cfpStudentEditingId = null;
  cfpRenderStudentsTable();
}

function cfpRenderStudentsTable() {
  const tbody = document.getElementById('students-table-body');
  const groups = cfpStudentsFilter === 'all'
    ? cfpStudentGroups
    : cfpStudentGroups.filter(g => g.enrollments.some(e => e.courseName === cfpStudentsFilter));

  if (!groups.length) {
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">No students yet — they appear here automatically once a course purchase is verified.</td></tr>';
    return;
  }

  const BADGE_COLORS = {
    'Self-Study': 'badge-booking',
    'Guided Learning': 'badge-premium',
    'The CFA Academy Framework for Stock Investing': 'badge-published',
    'Mentorship Program': 'badge-booking'
  };

  tbody.innerHTML = groups.map(g => {
    const courseBadges = g.enrollments.map(e =>
      `<span class="badge ${BADGE_COLORS[e.courseName] || 'badge-draft'}" style="margin:2px 3px 2px 0;">${escHtml(e.courseName)}</span>`
    ).join('');
    const editOpen = cfpStudentEditingId === g.userId;

    const mainRow = `<tr>
      <td>${escHtml(g.email)}</td>
      <td>${escHtml(g.name)}</td>
      <td style="max-width:280px;">${courseBadges}</td>
      <td>${g.latestAt ? new Date(g.latestAt).toLocaleDateString('en-IN') : '—'}</td>
      <td><button class="btn-sm" onclick="cfpToggleStudentEdit('${escAttr(g.userId)}')" style="background:var(--surface-2);border:1px solid var(--border);color:var(--text);padding:0.3rem 0.75rem;border-radius:6px;cursor:pointer;font-size:0.78rem;font-weight:600;">${editOpen ? '✕ Close' : '⚙ Manage'}</button></td>
    </tr>`;

    if (!editOpen) return mainRow;

    const enrolledNames = g.enrollments.map(e => e.courseName);
    const availableCourses = cfpLiveCourses.map(c => c.name).filter(n => !enrolledNames.includes(n));

    const enrollmentRows = g.enrollments.map(e => `
      <div style="display:flex;align-items:center;justify-content:space-between;padding:0.5rem 0;border-bottom:1px solid rgba(255,255,255,0.05);">
        <div>
          <span class="badge ${BADGE_COLORS[e.courseName] || 'badge-draft'}">${escHtml(e.courseName)}</span>
          <span style="font-size:0.73rem;color:var(--text-muted);margin-left:0.5rem;">${e.purchasedAt ? new Date(e.purchasedAt).toLocaleDateString('en-IN') : ''}</span>
        </div>
        <button onclick="cfpRevokeEnrollment('${escAttr(e.id)}','${escAttr(g.userId)}')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);color:#ef4444;padding:0.25rem 0.6rem;border-radius:5px;cursor:pointer;font-size:0.72rem;font-weight:700;">✕ Revoke</button>
      </div>`).join('');

    const addCourseHtml = availableCourses.length ? `
      <div style="display:flex;gap:0.6rem;margin-top:0.75rem;align-items:center;flex-wrap:wrap;">
        <select id="add-course-${escAttr(g.userId)}" class="form-select" style="flex:1;min-width:180px;padding:0.4rem 0.6rem;font-size:0.82rem;">
          <option value="">Select course to add…</option>
          ${availableCourses.map(c => `<option value="${escAttr(c)}">${escHtml(c)}</option>`).join('')}
        </select>
        <button onclick="cfpAddEnrollment('${escAttr(g.userId)}')" style="background:var(--accent);color:#fff;border:none;padding:0.4rem 0.9rem;border-radius:6px;cursor:pointer;font-size:0.8rem;font-weight:700;">+ Add Course</button>
      </div>` : `<p style="font-size:0.78rem;color:var(--text-muted);margin-top:0.6rem;">Enrolled in all available courses.</p>`;

    const editRow = `<tr id="student-edit-${escAttr(g.userId)}">
      <td colspan="5" style="background:var(--surface-2);padding:1rem 1.25rem;border-bottom:2px solid var(--accent);">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
          <div style="flex:1;min-width:220px;">
            <p style="font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.1em;margin-bottom:0.6rem;">Current Enrollments</p>
            ${enrollmentRows || '<p style="font-size:0.8rem;color:var(--text-muted);">No enrollments.</p>'}
            ${addCourseHtml}
            <div id="student-edit-msg-${escAttr(g.userId)}" style="font-size:0.78rem;margin-top:0.5rem;min-height:1rem;"></div>
          </div>
          <div style="display:flex;flex-direction:column;gap:0.5rem;align-items:flex-end;">
            <button onclick="cfpDeleteStudent('${escAttr(g.userId)}')" style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.35);color:#ef4444;padding:0.45rem 1rem;border-radius:7px;cursor:pointer;font-size:0.8rem;font-weight:700;white-space:nowrap;">🗑 Delete Student</button>
          </div>
        </div>
      </td>
    </tr>`;

    return mainRow + editRow;
  }).join('');
}

function cfpToggleStudentEdit(userId) {
  cfpStudentEditingId = (cfpStudentEditingId === userId) ? null : userId;
  cfpRenderStudentsTable();
}

async function cfpAdminFetch(action, payload) {
  const { data: { session } } = await window.cfpSupabase.auth.getSession();
  const res = await fetch('/api/manual-enroll', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, adminToken: session?.access_token || '', ...payload })
  });
  return res.json();
}

async function cfpRevokeEnrollment(enrollmentId, userId) {
  if (!confirm('Revoke this course enrollment? The student will immediately lose access.')) return;
  const msg = document.getElementById('student-edit-msg-' + userId);
  if (msg) { msg.style.color = 'var(--text-muted)'; msg.textContent = 'Revoking…'; }
  const result = await cfpAdminFetch('revoke', { enrollmentId });
  if (result.error) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Failed: ' + result.error; }
    return;
  }
  await renderStudents();
  cfpStudentEditingId = userId;
  cfpRenderStudentsTable();
}

async function cfpAddEnrollment(userId) {
  const sel = document.getElementById('add-course-' + userId);
  const courseName = sel && sel.value;
  if (!courseName) return;
  const msg = document.getElementById('student-edit-msg-' + userId);
  if (msg) { msg.style.color = 'var(--text-muted)'; msg.textContent = 'Adding…'; }
  const result = await cfpAdminFetch('add-enrollment', { userId, courseName });
  if (result.error) {
    if (msg) { msg.style.color = 'var(--red)'; msg.textContent = 'Failed: ' + result.error; }
    return;
  }
  await renderStudents();
  cfpStudentEditingId = userId;
  cfpRenderStudentsTable();
}

async function cfpDeleteStudent(userId) {
  if (!confirm('Delete this student? This will remove ALL their enrollments. Their Supabase Auth account and profile will remain — only enrollments are deleted.')) return;
  const result = await cfpAdminFetch('delete-student', { userId });
  if (result.error) { alert('Failed to delete: ' + result.error); return; }
  await renderStudents();
}

/* ── TRANSACTIONS (live from Supabase `payments`, joined to profiles/courses) ── */
async function renderTransactions() {
  const tbody = document.getElementById('tx-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Loading…</td></tr>';
  const { data, error } = await window.cfpSupabase
    .from('payments')
    .select('*, profiles(full_name, email), courses(name)')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('renderTransactions failed', error);
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Could not load transactions.</td></tr>';
    return;
  }
  const txs = data || [];
  tbody.innerHTML = txs.map(t => {
    const method = (t.raw_response && t.raw_response.method) || '—';
    const customerName = (t.profiles && t.profiles.full_name) || '—';
    const customerEmail = (t.profiles && t.profiles.email) || '—';
    const courseName = (t.courses && t.courses.name) || '—';
    return `
    <tr>
      <td class="mono">${escHtml(t.razorpay_payment_id || '—')}</td>
      <td>${escHtml(customerName)}<br><span style="font-size:0.74rem;color:var(--text-muted)">${escHtml(customerEmail)}</span></td>
      <td>${escHtml(courseName)}</td>
      <td>₹${Number(t.amount || 0).toLocaleString('en-IN')}</td>
      <td>${escHtml(method)}</td>
      <td><span class="badge badge-${t.status}">${escHtml(t.status)}</span></td>
      <td>${t.created_at ? new Date(t.created_at).toLocaleString('en-IN') : ''}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="7" class="empty-state">No transactions yet. Once a customer pays via Razorpay, it will appear here automatically.</td></tr>';
}

/* ── FORM SUBMISSIONS (live from Supabase `form_submissions`) ── */
async function renderSubmissions() {
  const tbody = document.getElementById('sub-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Loading…</td></tr>';
  const { data, error } = await window.cfpSupabase
    .from('form_submissions')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('renderSubmissions failed', error);
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Could not load submissions.</td></tr>';
    return;
  }
  const subs = data || [];
  tbody.innerHTML = subs.map(s => `
    <tr>
      <td><span class="badge badge-${s.type}">${escHtml(s.type)}</span></td>
      <td>${escHtml(s.name)}</td>
      <td>${escHtml(s.email)}<br><span style="font-size:0.74rem;color:var(--text-muted)">${escHtml(s.phone || '')}</span></td>
      <td>${escHtml((s.metadata && s.metadata.experience) || '—')}</td>
      <td style="max-width:260px">${escHtml(s.message || '—')}</td>
      <td>${s.created_at ? new Date(s.created_at).toLocaleString('en-IN') : ''}</td>
      <td><button class="action-btn" onclick="cfpCycleSubmissionStatus('${s.id}','${s.status}')">${cfpSubmissionStatusBadge(s.status)}</button></td>
    </tr>
  `).join('') || '<tr><td colspan="7" class="empty-state">No leads yet. Every booking/contact form submission on the live site lands here.</td></tr>';
}

/* ── NEWSLETTER (live from Supabase `newsletter_subscribers`) ──
   Two sources land in the same table: 'signup' (blog page form) and
   'purchase' (auto-added on every verified payment, see verify-payment.js). */
let cfpNewsletterRows = [];
let cfpNewsletterFilter = 'all';

async function renderNewsletter() {
  const tbody = document.getElementById('nl-table-body');
  tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Loading…</td></tr>';
  const { data, error } = await window.cfpSupabase
    .from('newsletter_subscribers')
    .select('*')
    .order('subscribed_at', { ascending: false });
  if (error) {
    console.error('renderNewsletter failed', error);
    tbody.innerHTML = '<tr><td colspan="5" class="empty-state">Could not load newsletter subscribers.</td></tr>';
    return;
  }
  cfpNewsletterRows = data || [];
  document.getElementById('nav-nl-count').textContent = cfpNewsletterRows.length;
  cfpRenderNewsletterTable();
}

function cfpRenderNewsletterTable() {
  const tbody = document.getElementById('nl-table-body');
  const rows = cfpNewsletterFilter === 'all' ? cfpNewsletterRows : cfpNewsletterRows.filter(r => r.source === cfpNewsletterFilter);
  tbody.innerHTML = rows.map(r => `
    <tr>
      <td>${escHtml(r.email)}</td>
      <td>${escHtml(r.name || '—')}</td>
      <td><span class="badge ${r.source === 'purchase' ? 'badge-published' : 'badge-booking'}">${r.source === 'purchase' ? '💳 Course Buyer' : '📧 Signup'}</span></td>
      <td>${escHtml(r.course_name || '—')}</td>
      <td>${r.subscribed_at ? new Date(r.subscribed_at).toLocaleString('en-IN') : ''}</td>
    </tr>
  `).join('') || '<tr><td colspan="5" class="empty-state">No subscribers yet.</td></tr>';
}

document.querySelectorAll('#nl-filter-bar .filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#nl-filter-bar .filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cfpNewsletterFilter = btn.dataset.nlFilter;
    cfpRenderNewsletterTable();
  });
});

function cfpSubmissionStatusBadge(status) {
  const map = { new: { label: '🆕 New', cls: 'badge-failed' }, read: { label: '👀 Read', cls: 'badge-booking' }, actioned: { label: '✅ Actioned', cls: 'badge-published' } };
  const s = map[status] || map.new;
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

async function cfpCycleSubmissionStatus(id, current) {
  const next = current === 'new' ? 'read' : (current === 'read' ? 'actioned' : 'new');
  const { error } = await window.cfpSupabase.from('form_submissions').update({ status: next }).eq('id', id);
  if (error) { showToast('⚠️ Could not update status'); return; }
  renderSubmissions();
}

/* ── COUPONS ── */
async function renderCoupons() {
  const tbody = document.getElementById('coupons-table-body');
  tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Loading…</td></tr>';

  const { data: coupons, error: cErr } = await window.cfpSupabase
    .from('coupons').select('*').order('created_at', { ascending: false });
  if (cErr) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Could not load coupons.</td></tr>';
    return;
  }

  const { data: uses } = await window.cfpSupabase.from('coupon_uses').select('coupon_id');
  const useCounts = {};
  (uses || []).forEach(u => { useCounts[u.coupon_id] = (useCounts[u.coupon_id] || 0) + 1; });

  document.getElementById('nav-coupons-count').textContent = (coupons || []).length;

  if (!coupons || coupons.length === 0) {
    tbody.innerHTML = '<tr><td colspan="7" class="empty-state">No coupons yet.</td></tr>';
    return;
  }

  const fmtDt = v => v ? new Date(v).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

  tbody.innerHTML = coupons.map(c => {
    const count = useCounts[c.id] || 0;
    const canDelete = count === 0;
    const typeLabel = c.discount_type === 'percent' ? `${c.discount_value}%` : `₹${c.discount_value}`;
    return `<tr>
      <td><strong>${escHtml(c.code)}</strong></td>
      <td>${c.discount_type === 'percent' ? 'Percentage' : 'Fixed ₹'}</td>
      <td>${typeLabel}</td>
      <td style="font-size:0.78rem;">${fmtDt(c.valid_from)}</td>
      <td style="font-size:0.78rem;">${fmtDt(c.valid_until)}</td>
      <td>${count}${c.max_uses !== null ? ' / ' + c.max_uses : ''}</td>
      <td>
        <button class="btn-outline" style="font-size:0.72rem;padding:0.25rem 0.6rem;${canDelete ? '' : 'opacity:0.35;cursor:not-allowed;'}"
          ${canDelete ? `onclick="deleteCoupon('${c.id}')"` : 'disabled title="Has been used — cannot delete"'}>Delete</button>
      </td>
    </tr>`;
  }).join('');
}

async function deleteCoupon(id) {
  if (!confirm('Delete this coupon? This cannot be undone.')) return;
  const { error } = await window.cfpSupabase.from('coupons').delete().eq('id', id);
  if (error) { showToast('⚠️ Could not delete coupon'); return; }
  showToast('✅ Coupon deleted');
  renderCoupons();
}

(function initCouponForm() {
  const fromEl = document.getElementById('coupon-new-valid-from');
  if (fromEl && !fromEl.value) {
    const now = new Date();
    now.setSeconds(0, 0);
    fromEl.value = now.toISOString().slice(0, 16);
  }

  document.getElementById('coupon-clear-until').addEventListener('click', () => {
    document.getElementById('coupon-new-valid-until').value = '';
  });

  document.getElementById('coupon-new-code').addEventListener('input', function () {
    this.value = this.value.toUpperCase();
  });

  document.getElementById('coupon-save-btn').addEventListener('click', async () => {
    const msgEl = document.getElementById('coupon-save-msg');
    msgEl.style.display = 'none';
    const code = document.getElementById('coupon-new-code').value.trim().toUpperCase();
    const type = document.getElementById('coupon-new-type').value;
    const value = parseFloat(document.getElementById('coupon-new-value').value);
    const maxUsesRaw = document.getElementById('coupon-new-max-uses').value.trim();
    const validFrom = document.getElementById('coupon-new-valid-from').value;
    const validUntil = document.getElementById('coupon-new-valid-until').value;

    if (!code) { msgEl.textContent = 'Code is required.'; msgEl.style.color = '#fb7185'; msgEl.style.display = 'block'; return; }
    if (!value || value <= 0) { msgEl.textContent = 'Discount value must be a positive number.'; msgEl.style.color = '#fb7185'; msgEl.style.display = 'block'; return; }

    const row = {
      code,
      discount_type: type,
      discount_value: value,
      valid_from: validFrom ? new Date(validFrom).toISOString() : new Date().toISOString(),
      valid_until: validUntil ? new Date(validUntil).toISOString() : null,
      max_uses: maxUsesRaw ? parseInt(maxUsesRaw, 10) : null
    };

    const { error } = await window.cfpSupabase.from('coupons').insert(row);
    if (error) {
      msgEl.textContent = error.code === '23505' ? 'A coupon with that code already exists.' : 'Could not save coupon: ' + error.message;
      msgEl.style.color = '#fb7185';
      msgEl.style.display = 'block';
      return;
    }
    msgEl.textContent = '✅ Coupon saved.';
    msgEl.style.color = '#4ade80';
    msgEl.style.display = 'block';
    document.getElementById('coupon-new-code').value = '';
    document.getElementById('coupon-new-value').value = '';
    document.getElementById('coupon-new-max-uses').value = '';
    document.getElementById('coupon-new-valid-until').value = '';
    renderCoupons();
  });
})();

/* ── ACADEMY PDF UPLOAD ── */
function initAcademyPdfPanel() {
  const statusEl  = document.getElementById('pdf-current-status');
  const fileInput = document.getElementById('pdf-file-input');
  const fileLabel = document.getElementById('pdf-file-name');
  const uploadBtn = document.getElementById('pdf-upload-btn');
  const progressWrap = document.getElementById('pdf-upload-progress');
  const progressFill = document.getElementById('pdf-progress-fill');
  const progressLabel = document.getElementById('pdf-progress-label');
  const msgEl     = document.getElementById('pdf-upload-msg');

  // Check whether a file already exists by trying to generate a signed URL
  (async () => {
    const { data } = await window.cfpSupabase.storage
      .from('course-materials')
      .createSignedUrl('pdfs/cfa-framework.pdf', 60);
    statusEl.textContent = data && data.signedUrl
      ? '✅ A PDF is currently live for students.'
      : '⚠️ No PDF uploaded yet — students will see an unavailable message.';
  })();

  fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    fileLabel.textContent = file.name + ' (' + (file.size / 1024 / 1024).toFixed(2) + ' MB)';
    uploadBtn.disabled = false;
    msgEl.style.display = 'none';
  });

  uploadBtn.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    uploadBtn.disabled = true;
    progressWrap.style.display = 'block';
    progressFill.style.width = '0%';
    progressLabel.textContent = 'Reading file…';
    msgEl.style.display = 'none';

    try {
      // Read file as base64
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          progressFill.style.width = '30%';
          progressLabel.textContent = 'Uploading…';
          // strip the data URL prefix ("data:application/pdf;base64,")
          resolve(reader.result.split(',')[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      const { data: { session: pdfSession } } = await window.cfpSupabase.auth.getSession();
      const res = await fetch('/api/upload-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (pdfSession?.access_token || '') },
        body: JSON.stringify({ fileBase64: base64 })
      });

      progressFill.style.width = '100%';
      const data = await res.json();

      if (!res.ok || !data.ok) throw new Error(data.error || 'Upload failed');

      progressLabel.textContent = 'Done';
      msgEl.textContent = '✅ PDF uploaded successfully. Students will see the new version on their next session.';
      msgEl.style.color = '#4ade80';
      msgEl.style.display = 'block';
      statusEl.textContent = '✅ A PDF is currently live for students.';
      fileInput.value = '';
      fileLabel.textContent = 'No file chosen';
      uploadBtn.disabled = true;
    } catch (err) {
      progressFill.style.width = '0%';
      progressLabel.textContent = '';
      progressWrap.style.display = 'none';
      msgEl.textContent = '⚠️ Upload failed: ' + (err.message || 'Unknown error');
      msgEl.style.color = '#fb7185';
      msgEl.style.display = 'block';
      uploadBtn.disabled = false;
    }
  });
}

/* ── PLAYLIST VIDEOS ── */
let cfpPlaylistVideos = [];
let cfpEditingVideoId = null;

async function renderPlaylistVideos() {
  const tbody = document.getElementById('pv-table-body');
  tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Loading…</td></tr>';
  const { data, error } = await window.cfpSupabase
    .from('playlist_videos').select('*')
    .order('playlist_key', { ascending: true })
    .order('sort_order', { ascending: true });
  if (error) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">Could not load videos — run add-playlist-videos.sql migration first.</td></tr>'; return; }
  cfpPlaylistVideos = data || [];
  cfpEditingVideoId = null;
  cfpRenderPlaylistTable();
  document.getElementById('pv-thumb-preview').style.display = 'none';
}

function cfpRenderPlaylistTable() {
  const tbody = document.getElementById('pv-table-body');
  if (!cfpPlaylistVideos.length) { tbody.innerHTML = '<tr><td colspan="6" class="empty-state">No videos yet — add one above.</td></tr>'; return; }
  tbody.innerHTML = cfpPlaylistVideos.map(v => {
    if (v.id === cfpEditingVideoId) {
      return `<tr>
        <td><img src="https://img.youtube.com/vi/${escAttr(v.video_id)}/default.jpg" width="80" style="border-radius:4px"></td>
        <td><input class="form-input" id="pv-edit-title-${v.id}" value="${escAttr(v.title)}" style="min-width:160px" /></td>
        <td><select class="form-select" id="pv-edit-playlist-${v.id}" style="width:140px">
          <option value="guided" ${v.playlist_key==='guided'?'selected':''}>Guided</option>
          <option value="framework" ${v.playlist_key==='framework'?'selected':''}>Framework</option>
        </select></td>
        <td><input class="form-input" id="pv-edit-order-${v.id}" type="number" value="${v.sort_order}" style="width:70px" /></td>
        <td><input class="form-input" id="pv-edit-vid-${v.id}" value="${escAttr(v.video_id)}" style="width:130px" /></td>
        <td><div class="actions-cell">
          <button class="action-btn" onclick="cfpSaveVideoEdit('${v.id}')">✅ Save</button>
          <button class="action-btn" onclick="cfpCancelVideoEdit()">Cancel</button>
        </div></td>
      </tr>`;
    }
    return `<tr>
      <td><img src="https://img.youtube.com/vi/${escAttr(v.video_id)}/default.jpg" width="80" style="border-radius:4px"></td>
      <td style="color:var(--text);font-weight:500;max-width:220px">${escHtml(v.title)}</td>
      <td><span class="badge ${v.playlist_key==='guided'?'badge-booking':'badge-premium'}">${v.playlist_key==='guided'?'Guided':'Framework'}</span></td>
      <td>${v.sort_order}</td>
      <td class="mono">${escHtml(v.video_id)}</td>
      <td><div class="actions-cell">
        <button class="action-btn" onclick="cfpEditVideo('${v.id}')">✏️ Edit</button>
        <button class="action-btn delete" onclick="cfpDeleteVideo('${v.id}')">🗑 Delete</button>
      </div></td>
    </tr>`;
  }).join('');
}

function cfpEditVideo(id) { cfpEditingVideoId = id; cfpRenderPlaylistTable(); }
function cfpCancelVideoEdit() { cfpEditingVideoId = null; cfpRenderPlaylistTable(); }

async function cfpSaveVideoEdit(id) {
  const title = document.getElementById(`pv-edit-title-${id}`).value.trim();
  const playlist_key = document.getElementById(`pv-edit-playlist-${id}`).value;
  const sort_order = parseInt(document.getElementById(`pv-edit-order-${id}`).value) || 1;
  const video_id = document.getElementById(`pv-edit-vid-${id}`).value.trim();
  if (!title || !video_id) { showToast('⚠️ Title and Video ID are required'); return; }
  const { error } = await window.cfpSupabase.from('playlist_videos').update({ title, playlist_key, sort_order, video_id }).eq('id', id);
  if (error) { showToast('⚠️ Could not save: ' + error.message); return; }
  cfpEditingVideoId = null;
  showToast('✅ Video updated');
  renderPlaylistVideos();
}

async function cfpDeleteVideo(id) {
  if (!confirm('Delete this video?')) return;
  const { error } = await window.cfpSupabase.from('playlist_videos').delete().eq('id', id);
  if (error) { showToast('⚠️ Could not delete video'); return; }
  showToast('🗑 Video deleted');
  renderPlaylistVideos();
}

(function initPlaylistVideoForm() {
  document.getElementById('pv-video-id').addEventListener('input', function () {
    const v = this.value.trim();
    const preview = document.getElementById('pv-thumb-preview');
    if (v.length >= 11) { preview.src = `https://img.youtube.com/vi/${v}/default.jpg`; preview.style.display = 'block'; }
    else preview.style.display = 'none';
  });

  document.getElementById('pv-add-btn').addEventListener('click', async () => {
    const playlist_key = document.getElementById('pv-playlist').value;
    const video_id = document.getElementById('pv-video-id').value.trim();
    const title = document.getElementById('pv-title').value.trim();
    const description = document.getElementById('pv-description').value.trim();
    const sort_order = parseInt(document.getElementById('pv-sort-order').value) || 1;
    if (!video_id || !title) { showToast('⚠️ Video ID and title are required'); return; }
    const { error } = await window.cfpSupabase.from('playlist_videos').insert({ playlist_key, video_id, title, description: description || null, sort_order });
    if (error) { showToast('⚠️ Could not add video: ' + error.message); return; }
    document.getElementById('pv-video-id').value = '';
    document.getElementById('pv-title').value = '';
    document.getElementById('pv-description').value = '';
    document.getElementById('pv-sort-order').value = '1';
    document.getElementById('pv-thumb-preview').style.display = 'none';
    showToast('✅ Video added');
    renderPlaylistVideos();
  });
})();

/* ── MANUAL ENROLL ── */
let cfpLiveCourses = [];

async function renderManualEnroll() {
  const courseSelect = document.getElementById('me-course');
  courseSelect.innerHTML = '<option value="">Loading courses…</option>';
  const { data: courses } = await window.cfpSupabase
    .from('courses').select('id, name, price').order('sort_order', { ascending: true });
  cfpLiveCourses = courses || [];
  courseSelect.innerHTML = cfpLiveCourses.map(c =>
    `<option value="${escAttr(c.id)}">${escHtml(c.name)}${c.price ? ' — ' + escHtml(c.price) : ''}</option>`
  ).join('') || '<option value="">No courses found</option>';
  await cfpRenderManualEnrollHistory();
}

async function cfpRenderManualEnrollHistory() {
  const tbody = document.getElementById('me-history-body');
  tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Loading…</td></tr>';
  const { data } = await window.cfpSupabase
    .from('payments').select('*, profiles(email), courses(name)')
    .like('razorpay_payment_id', 'MANUAL-%')
    .order('created_at', { ascending: false }).limit(20);
  if (!data || !data.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No manual enrollments yet.</td></tr>'; return; }
  tbody.innerHTML = data.map(p => {
    const email = (p.profiles && p.profiles.email) || '—';
    const course = (p.courses && p.courses.name) || '—';
    const type = Number(p.amount) === 0 ? 'Complimentary' : 'Paid (offline)';
    return `<tr>
      <td>${escHtml(email)}</td>
      <td>${escHtml(course)}</td>
      <td>${p.created_at ? new Date(p.created_at).toLocaleDateString('en-IN') : '—'}</td>
      <td><span class="badge ${type === 'Complimentary' ? 'badge-booking' : 'badge-published'}">${type}</span></td>
    </tr>`;
  }).join('');
}

(function initManualEnrollForm() {
  document.getElementById('me-enroll-btn').addEventListener('click', async () => {
    const email = document.getElementById('me-email').value.trim();
    const name = document.getElementById('me-name').value.trim();
    const courseId = document.getElementById('me-course').value;
    const enrollType = document.querySelector('input[name="me-type"]:checked')?.value || 'paid';
    const notes = document.getElementById('me-notes').value.trim();
    const msgEl = document.getElementById('me-msg');
    const btn = document.getElementById('me-enroll-btn');
    msgEl.style.display = 'none';

    if (!email || !courseId) {
      msgEl.textContent = 'Email and course are required.';
      msgEl.style.color = '#fb7185'; msgEl.style.display = 'block'; return;
    }

    btn.disabled = true; btn.textContent = 'Enrolling…';
    try {
      const { data: { session } } = await window.cfpSupabase.auth.getSession();
      const res = await fetch('/api/manual-enroll', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, courseId, enrollType, notes, adminToken: session?.access_token || '' })
      });
      const json = await res.json();
      if (!res.ok) {
        msgEl.textContent = '❌ ' + (json.error || 'Enroll failed.');
        msgEl.style.color = '#fb7185';
      } else {
        msgEl.textContent = '✅ ' + json.message;
        msgEl.style.color = '#4ade80';
        document.getElementById('me-email').value = '';
        document.getElementById('me-name').value = '';
        document.getElementById('me-notes').value = '';
        cfpRenderManualEnrollHistory();
      }
    } catch (e) {
      msgEl.textContent = '❌ Network error — check console.';
      msgEl.style.color = '#fb7185';
    } finally {
      btn.disabled = false; btn.textContent = 'Enroll Student';
      msgEl.style.display = 'block';
    }
  });
})();

/* ── SEND NEWSLETTER ── */
async function renderSendNewsletter() {
  await Promise.all([cfpUpdateRecipientCount(), cfpRenderSendHistory()]);
  const btn = document.getElementById('welcome-batch-btn');
  const resultEl = document.getElementById('welcome-batch-result');
  if (!btn || btn._cfpWelcomeListenerAttached) return;
  btn._cfpWelcomeListenerAttached = true;
  btn.addEventListener('click', async () => {
    const hours = Number(document.getElementById('welcome-hours').value) || 24;
    btn.disabled = true; btn.textContent = 'Sending…';
    resultEl.style.display = 'none';
    try {
      const { data: { session: wbSession } } = await window.cfpSupabase.auth.getSession();
      const r = await fetch('/api/send-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (wbSession?.access_token || '') },
        body: JSON.stringify({ action: 'welcome-batch', hours })
      });
      const json = await r.json();
      resultEl.textContent = r.ok
        ? `✅ Sent ${json.sent} of ${json.total} welcome emails.`
        : `❌ ${json.error || 'Failed'}`;
    } catch (e) {
      resultEl.textContent = '❌ Network error — check console.';
    }
    resultEl.style.display = 'block';
    btn.disabled = false; btn.textContent = 'Send Welcome Emails';
  });
}

async function cfpUpdateRecipientCount() {
  const audience = document.querySelector('input[name="nl-audience"]:checked')?.value || 'all';
  let query = window.cfpSupabase.from('newsletter_subscribers').select('id', { count: 'exact', head: true });
  if (audience === 'signups') query = query.eq('source', 'signup');
  else if (audience === 'buyers') query = query.eq('source', 'purchase');
  const { count } = await query;
  const el = document.getElementById('nl-recipient-count');
  if (el) el.textContent = `${count || 0} recipients selected`;
}

async function cfpRenderSendHistory() {
  const tbody = document.getElementById('nl-sends-body');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="4" class="empty-state">Loading…</td></tr>';
  const { data, error } = await window.cfpSupabase
    .from('newsletter_sends').select('*').order('sent_at', { ascending: false }).limit(20);
  if (error || !data || !data.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="empty-state">No emails sent yet.</td></tr>'; return;
  }
  tbody.innerHTML = data.map(s => `
    <tr>
      <td style="color:var(--text);font-weight:500;max-width:300px">${escHtml(s.subject)}</td>
      <td><span class="badge badge-booking">${escHtml(s.audience || 'all')}</span></td>
      <td>${s.recipient_count}</td>
      <td>${s.sent_at ? new Date(s.sent_at).toLocaleString('en-IN') : '—'}</td>
    </tr>
  `).join('');
}

(function initSendNewsletterForm() {
  document.querySelectorAll('input[name="nl-audience"]').forEach(r => r.addEventListener('change', cfpUpdateRecipientCount));

  document.getElementById('nl-preview-btn').addEventListener('click', () => {
    const html = document.getElementById('nl-body').value;
    document.getElementById('nl-preview-iframe').srcdoc = html;
    document.getElementById('nl-preview-modal').classList.add('open');
  });
  document.getElementById('nl-preview-close').addEventListener('click', () => {
    document.getElementById('nl-preview-modal').classList.remove('open');
  });

  function cfpUpdateSendBtn() {
    const ok = document.getElementById('nl-subject').value.trim() && document.getElementById('nl-body').value.trim();
    document.getElementById('nl-send-btn').disabled = !ok;
  }
  document.getElementById('nl-subject').addEventListener('input', cfpUpdateSendBtn);
  document.getElementById('nl-body').addEventListener('input', cfpUpdateSendBtn);

  document.getElementById('nl-send-btn').addEventListener('click', async () => {
    const subject = document.getElementById('nl-subject').value.trim();
    const html = document.getElementById('nl-body').value.trim();
    const audience = document.querySelector('input[name="nl-audience"]:checked')?.value || 'all';
    const countText = document.getElementById('nl-recipient-count').textContent;
    if (!confirm(`Send "${subject}" to ${countText}? This cannot be undone.`)) return;
    const btn = document.getElementById('nl-send-btn');
    btn.disabled = true; btn.textContent = 'Sending…';
    try {
      const { data: { session } } = await window.cfpSupabase.auth.getSession();
      const res = await fetch('/api/send-newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + (session?.access_token || '') },
        body: JSON.stringify({ subject, html, audience })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Send failed');
      showToast(`✅ Sent to ${data.sent} recipients.`);
      document.getElementById('nl-subject').value = '';
      document.getElementById('nl-body').value = '';
      cfpUpdateSendBtn();
      cfpRenderSendHistory();
    } catch (e) {
      showToast('⚠️ Send failed: ' + e.message);
    } finally {
      btn.disabled = false; btn.textContent = 'Send Newsletter';
    }
  });
})();

/* ── ESCAPING HELPERS ── */
function escHtml(str) { return (str || '').toString().replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])); }
function escAttr(str) { return escHtml(str).replace(/"/g, '&quot;'); }

/* ── FOUNDER PHOTO UPLOAD ── */
function renderFounderPhotoPreview(src) {
  const img = document.getElementById('founder-photo-img');
  const placeholder = document.getElementById('founder-photo-placeholder');
  if (src) {
    img.src = src;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.style.display = 'none';
    img.removeAttribute('src');
    placeholder.style.display = 'block';
  }
}

document.getElementById('founder-photo-pick').addEventListener('click', () => {
  document.getElementById('founder-photo-input').click();
});

document.getElementById('founder-photo-input').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = async () => {
      // Crop to a centered square, then downscale to keep the row small.
      const side = Math.min(img.width, img.height);
      const sx = (img.width - side) / 2;
      const sy = (img.height - side) / 2;
      const outSize = 480;
      const canvas = document.createElement('canvas');
      canvas.width = outSize;
      canvas.height = outSize;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, sx, sy, side, side, 0, 0, outSize, outSize);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      state.about.founderPhoto = dataUrl;
      try {
        await persist();
        renderFounderPhotoPreview(dataUrl);
        showToast('✅ Founder photo updated — live on the site now');
      } catch (err) { /* persist() already toasted the error */ }
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  e.target.value = '';
});

document.getElementById('founder-photo-remove').addEventListener('click', async () => {
  if (!state.about.founderPhoto) return;
  if (!confirm('Remove the founder photo? The site will fall back to the initial-letter avatar.')) return;
  state.about.founderPhoto = '';
  try {
    await persist();
    renderFounderPhotoPreview('');
    showToast('🗑 Founder photo removed');
  } catch (e) { /* persist() already toasted the error */ }
});

/* ── INIT ── */
async function init() {
  state = await cfpAdminLoadData();

  // Hero
  document.getElementById('hero-line1').value = state.hero.line1 || '';
  document.getElementById('hero-accent').value = state.hero.accent || '';
  document.getElementById('hero-line3').value = state.hero.line3 || '';
  document.getElementById('hero-sub').value = state.hero.sub || '';
  document.getElementById('hero-cta1').value = state.hero.cta1 || '';
  document.getElementById('hero-cta2').value = state.hero.cta2 || '';
  document.getElementById('hero-badge').value = state.hero.badge || '';
  document.getElementById('stat-students-input').value = state.stats.students || '';
  document.getElementById('stat-experience-input').value = state.stats.experience || '';
  document.getElementById('stat-rating-input').value = state.stats.rating || '';

  // About
  document.getElementById('founder-name-input').value = state.about.founderName || '';
  document.getElementById('founder-title-input').value = state.about.founderTitle || '';
  document.getElementById('about-heading-input').value = state.about.heading || '';
  document.getElementById('about-p1-input').value = state.about.p1 || '';
  document.getElementById('about-p2-input').value = state.about.p2 || '';
  document.getElementById('founder-bio-input').value = state.about.bio || '';
  document.getElementById('about-credentials-input').value = (state.about.credentials || []).join(', ');
  renderFounderPhotoPreview(state.about.founderPhoto);

  // Contact
  document.getElementById('contact-wa').value = state.contact.whatsapp || '';
  document.getElementById('contact-email-input').value = state.contact.email || '';
  document.getElementById('contact-telegram-input').value = state.contact.telegram || '';
  document.getElementById('contact-insta').value = state.contact.instagram || '';
  document.getElementById('contact-youtube').value = state.contact.youtube || '';
  document.getElementById('contact-twitter').value = state.contact.twitter || '';
  document.getElementById('contact-calendly').value = state.contact.calendlyUrl || '';
  document.getElementById('contact-razorpay').value = state.contact.razorpayKeyId || '';
  document.getElementById('legal-disclaimer-input').value = state.legal.disclaimer || '';
  document.getElementById('premium-free-days').value = (state.premium && state.premium.anonDays != null ? state.premium.anonDays : 7);
  document.getElementById('premium-self-study-days').value = (state.premium && state.premium.selfStudyDays) || 30;
  document.getElementById('premium-guided-days').value = (state.premium && state.premium.guidedDays) || 90;

  state.pages = state.pages || {};
  state.pages.blog = state.pages.blog || {};
  state.pages.backtesting = state.pages.backtesting || {};
  state.pages.newsletter = state.pages.newsletter || {};
  document.getElementById('pc-blog-tag').value = state.pages.blog.tag || '';
  document.getElementById('pc-blog-title').value = state.pages.blog.title || '';
  document.getElementById('pc-blog-sub').value = state.pages.blog.sub || '';
  document.getElementById('pc-blog-free-label').value = state.pages.blog.freeLabel || '';
  document.getElementById('pc-blog-premium-label').value = state.pages.blog.premiumLabel || '';
  document.getElementById('pc-bt-tag').value = state.pages.backtesting.tag || '';
  document.getElementById('pc-bt-title').value = state.pages.backtesting.title || '';
  document.getElementById('pc-bt-sub').value = state.pages.backtesting.sub || '';
  document.getElementById('pc-bt-free-label').value = state.pages.backtesting.freeLabel || '';
  document.getElementById('pc-bt-premium-label').value = state.pages.backtesting.premiumLabel || '';
  document.getElementById('pc-nl-tag').value = state.pages.newsletter.tag || '';
  document.getElementById('pc-nl-title').value = state.pages.newsletter.title || '';
  document.getElementById('pc-nl-sub').value = state.pages.newsletter.sub || '';
  document.getElementById('pc-nl-btn').value = state.pages.newsletter.buttonLabel || '';

  renderDashboard();
  renderBlogTable();
}
