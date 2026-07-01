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

   Without these, saving a course/article/backtest with a
   non-numeric price or a "8 min read"-style readtime value
   will fail with a Postgres type error.
   ============================================== */

let state = { hero: {}, about: {}, stats: {}, contact: {}, legal: {}, courses: [], testimonials: [], articles: [], backtests: [] };
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

/* ── SITE CONTENT (hero/about/stats/contact/legal) ── */
const CFP_SITE_CONTENT_KEYS = ['hero', 'about', 'stats', 'contact', 'legal'];

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

/* ── LOGIN ── */
document.getElementById('login-btn').addEventListener('click', doLogin);
document.getElementById('login-pass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
document.getElementById('login-email').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });

async function doLogin() {
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  const email = document.getElementById('login-email').value.trim();
  const pw = document.getElementById('login-pass').value;
  if (!email || !pw) {
    errEl.textContent = 'Enter your email and password.';
    errEl.style.display = 'block';
    return;
  }
  try {
    const { data, error } = await window.cfpSupabase.auth.signInWithPassword({ email, password: pw });
    if (error) throw error;
    const userId = data.user.id;
    const { data: profile, error: profErr } = await window.cfpSupabase.from('profiles').select('is_admin').eq('id', userId).single();
    if (profErr || !profile || !profile.is_admin) {
      await window.cfpSupabase.auth.signOut();
      throw new Error('This account does not have admin access.');
    }
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    await init();
  } catch (e) {
    errEl.textContent = e.message || 'Incorrect email or password.';
    errEl.style.display = 'block';
  }
}

document.getElementById('logout-btn').addEventListener('click', async () => {
  await window.cfpSupabase.auth.signOut();
  document.getElementById('app').style.display = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('login-pass').value = '';
});

/* Restore an existing admin session on page reload, so the admin isn't
   forced to log in again every time this page is opened. */
(async function checkExistingSession() {
  if (typeof window.cfpSupabase === 'undefined') return;
  const { data } = await window.cfpSupabase.auth.getUser();
  const user = data && data.user;
  if (!user) return;
  const { data: profile } = await window.cfpSupabase.from('profiles').select('is_admin').eq('id', user.id).single();
  if (profile && profile.is_admin) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    await init();
  }
})();

/* ── NAV ── */
function switchPanel(id) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.getElementById('panel-' + id).classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.panel === id));
  const titles = { dashboard: 'Dashboard', hero: 'Hero Section', about: 'About / Founder', courses: 'Courses & Pricing', testimonials: 'Testimonials', 'blog-list': 'All Articles', 'blog-new': 'New Article', 'bt-list': 'All Backtests', 'bt-new': 'New Backtest', transactions: 'Transactions', submissions: 'Form Submissions', 'contact-info': 'Contact & Integrations' };
  document.getElementById('topbar-title').textContent = titles[id] || id;
  if (id === 'blog-list') renderBlogTable();
  if (id === 'testimonials') renderTestimonials();
  if (id === 'courses') renderCourses();
  if (id === 'transactions') renderTransactions();
  if (id === 'submissions') renderSubmissions();
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

  // Courses (collected from dynamically rendered inputs — ids are uuid
  // strings, or a temp marker for a course not yet saved)
  document.querySelectorAll('[data-course-id]').forEach(group => {
    const id = group.dataset.courseId;
    const course = state.courses.find(c => String(c.id) === id);
    if (!course) return;
    group.querySelectorAll('[data-field]').forEach(el => {
      const f = el.dataset.field;
      if (f === 'features') course.features = el.value.split('\n').map(s => s.trim()).filter(Boolean);
      else course[f] = el.value;
    });
  });
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
  const [paymentsRes, subCountRes, txCountRes] = await Promise.all([
    window.cfpSupabase.from('payments').select('amount').eq('status', 'captured'),
    window.cfpSupabase.from('form_submissions').select('id', { count: 'exact', head: true }),
    window.cfpSupabase.from('payments').select('id', { count: 'exact', head: true })
  ]);
  const captured = paymentsRes.data || [];
  const revenue = captured.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
  document.getElementById('stat-revenue').textContent = '₹' + revenue.toLocaleString('en-IN');
  document.getElementById('stat-revenue-sub').textContent = `from ${captured.length} captured payment${captured.length === 1 ? '' : 's'}`;
  document.getElementById('stat-leads').textContent = subCountRes.count || 0;
  document.getElementById('nav-tx-count').textContent = txCountRes.count || 0;
  document.getElementById('nav-sub-count').textContent = subCountRes.count || 0;
}

/* ── COURSES ── */
function renderCourses() {
  const wrap = document.getElementById('courses-edit');
  wrap.innerHTML = state.courses.map((c, i) => `
    <div class="card" data-course-id="${c.id}" id="course-card-${c.id}">
      <h3>📚 Course ${i + 1} <span class="tag">${escHtml(c.level)}</span>
        <button class="action-btn delete" style="margin-left:auto" onclick="deleteCourse('${c.id}')">🗑 Remove</button>
      </h3>
      <div class="form-row">
        <div class="form-group"><label class="form-label">Course Name</label><input class="form-input" data-field="name" value="${escAttr(c.name)}" /></div>
        <div class="form-group"><label class="form-label">Subtitle</label><input class="form-input" data-field="subtitle" value="${escAttr(c.subtitle)}" /></div>
      </div>
      <div class="form-group"><label class="form-label">Level Tag (e.g. "Free · Beginner")</label><input class="form-input" data-field="level" value="${escAttr(c.level)}" /></div>
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
  state.courses.push({ id: cfpTempId(), level: 'New · Tier', name: 'New Course', subtitle: 'Subtitle here', desc: 'Course description...', features: ['Feature one', 'Feature two'], featuresRich: '', price: '₹0', priceSub: '+ GST · One-time', ctaLabel: 'Enroll Now', ctaLink: 'payment.html', isModal: false });
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

  renderDashboard();
  renderBlogTable();
}
