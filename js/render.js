/* ==============================================
   Capital Finplus Academy — V5 render.js
   Renders index.html / blog.html from data.js
   (cfpLoadData) so the Admin Dashboard can edit
   hero copy, pricing, testimonials and blog posts
   and have it reflect live on the site.
   ============================================== */

(function () {
  if (typeof cfpLoadPublicData !== 'function') return;
  /* `let`, not `const` — assigned once cfpLoadPublicData() resolves (see the
     async block at the bottom). Every render function below is a closure
     over this binding, so they all see the real data once it loads; the
     two window.* handlers guard against being clicked in the brief window
     before that first resolves. */
  let DATA = null;

  function setText(id, html) {
    const el = document.getElementById(id);
    if (el && html != null) el.innerHTML = html;
  }

  /* ── HERO ── */
  function renderHero() {
    if (!document.getElementById('hero-headline')) return;
    setText('hero-badge-text', DATA.hero.badge);
    setText('hero-line1', DATA.hero.line1);
    setText('hero-accent', DATA.hero.accent);
    setText('hero-line3', DATA.hero.line3);
    setText('hero-sub', DATA.hero.sub);
    const cta1 = document.getElementById('hero-book-btn');
    if (cta1) cta1.textContent = DATA.hero.cta1;
    const cta2 = document.getElementById('hero-cta2-btn');
    if (cta2) cta2.textContent = DATA.hero.cta2;
    /* Reveal now that live copy is in — starts at opacity:0 so edited hero
       text never flashes the hardcoded fallback first. */
    const heroWrap = document.getElementById('hero-center');
    if (heroWrap) heroWrap.style.opacity = '1';
  }

  /* ── STATS (sets data-target so the existing counter animation still runs) ── */
  function renderStats() {
    const s = document.getElementById('stat-students');
    const e = document.getElementById('stat-experience');
    const r = document.getElementById('stat-rating');
    if (s) s.dataset.target = DATA.stats.students;
    if (e) e.dataset.target = DATA.stats.experience;
    if (r) r.dataset.target = DATA.stats.rating;
  }

  /* ── ABOUT ── */
  function renderAbout() {
    if (!document.getElementById('about-heading')) return;
    setText('about-heading', DATA.about.heading);
    setText('about-p1', DATA.about.p1);
    setText('about-p2', DATA.about.p2);
    const p3 = document.getElementById('about-p3');
    if (p3) {
      if (DATA.about.p3) { p3.innerHTML = DATA.about.p3; p3.style.display = ''; }
      else { p3.style.display = 'none'; }
    }
    setText('founder-name', DATA.about.founderName);
    setText('founder-title', DATA.about.founderTitle);
    setText('founder-bio', DATA.about.bio);
    const avatar = document.getElementById('founder-avatar');
    if (avatar) {
      if (DATA.about.founderPhoto) {
        avatar.classList.add('has-photo');
        avatar.innerHTML = `<img src="${DATA.about.founderPhoto}" alt="${DATA.about.founderName || 'Founder'}" />`;
      } else {
        avatar.classList.remove('has-photo');
        avatar.textContent = (DATA.about.founderName || 'P').charAt(0);
      }
    }
    const credWrap = document.getElementById('about-credentials');
    if (credWrap && DATA.about.credentials) {
      credWrap.innerHTML = DATA.about.credentials.map(c => `<span class="cred-badge"><span class="cred-badge-dot"></span>${c}</span>`).join('');
    }
    setText('f-stat-years', (DATA.stats.experience || '15') + '+');
  }

  /* ── COURSES ── */
  function courseCardHtml(c, i) {
    return `
      <div class="course-card reveal${i ? ' reveal-delay-' + Math.min(i, 3) : ''}">
        <div class="course-top-border"></div>
        <div class="course-body">
          <span class="course-level">${c.level}</span>
          <h3>${c.name}</h3>
          <div class="course-subtitle">${c.subtitle}</div>
          <p class="course-desc">${c.desc}</p>
          <div class="course-footer">
            <div>
              <div class="course-price">${c.price}</div>
              <div class="course-price-sub">${c.priceSub}</div>
            </div>
            <button type="button" class="course-enroll" onclick="openCourseFeatures('${c.id}')">
              ${c.ctaLabel}
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        </div>
      </div>`;
  }

  /* Plan-tier cards (Self-Study / Guided Learning / Mentorship) render into
     the pricing block above the table with no level/subtitle eyebrow — the
     name itself is the label, so repeating it as a tag looked redundant. */
  function planCardHtml(c, i) {
    return `
      <div class="course-card reveal${i ? ' reveal-delay-' + Math.min(i, 2) : ''}">
        <div class="course-top-border"></div>
        <div class="course-body">
          <h3>${c.name}</h3>
          <p class="course-desc">${c.desc}</p>
          <div class="course-footer">
            <div>
              <div class="course-price">${c.price}</div>
              <div class="course-price-sub">${c.priceSub}</div>
            </div>
            <button type="button" class="course-enroll" onclick="openCourseFeatures('${c.id}')">
              ${c.ctaLabel}
              <svg viewBox="0 0 24 24"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>
            </button>
          </div>
        </div>
      </div>`;
  }

  function renderPlans() {
    const grid = document.getElementById('plans-grid');
    if (!grid) return;
    if (DATA.courses) {
      const plans = DATA.courses.filter(c => c.planOnly);
      if (plans.length) grid.innerHTML = plans.map((c, i) => planCardHtml(c, i)).join('');
    }
    grid.style.opacity = '1';   // reveal — gated at opacity:0 so fallback cards don't flash
  }

  function renderCourses() {
    const grid = document.getElementById('courses-grid');
    if (!grid) return;
    if (!DATA.courses) { grid.style.opacity = '1'; return; }
    // The pricing table + plan cards above now cover the Self-Study /
    // Guided Learning / Mentorship tiers (flagged planOnly so they don't
    // duplicate here) — only the standalone course (Academy Framework)
    // renders below. The old Essentials/Edge+Precision pair is being
    // removed from the database (see supabase/remove-legacy-courses.sql);
    // excluded by name here too as a safety net in case that migration
    // hasn't run yet on whatever environment loads this.
    const LEGACY_HIDDEN = ['Essentials', 'Edge + Precision'];
    const rest = DATA.courses.filter(c => !c.planOnly && !LEGACY_HIDDEN.includes(c.name));
    let html = '';
    if (rest.length) {
      html += `<div class="courses-row courses-row-single">${rest.map((c, i) => courseCardHtml(c, i)).join('')}</div>`;
    }
    grid.innerHTML = html;
    grid.style.opacity = '1';   // reveal — gated at opacity:0 so fallback cards don't flash
  }

  /* ── PLAN COMPARISON TABLE (admin-editable via the Comparison Table panel) ── */
  function cfpEsc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }
  function cfpCompCell(val, colIdx) {
    const v = String(val == null ? '' : val).trim();
    const isCheck = v === '✓';
    const isDash = v === '' || v === '—';
    const bg = colIdx === 3 ? 'background:rgba(244,194,13,0.04);' : '';
    let color = 'var(--lilac)', size = '';
    if (isCheck) { color = 'var(--purple)'; size = 'font-size:1.1rem;'; }
    else if (isDash) { color = 'var(--muted)'; }
    return `<td style="padding:1.1rem 1.5rem;${bg}color:${color};${size}">${isDash ? '—' : cfpEsc(v)}</td>`;
  }
  function renderComparisonTable() {
    const tbody = document.getElementById('course-table-body');
    if (!tbody) return;
    const wrap = document.getElementById('course-compare-wrap');
    const comp = DATA.comparison;
    if (!comp || !comp.rows || !comp.columns) { if (wrap) wrap.style.opacity = '1'; return; }

    const head = tbody.parentElement.querySelector('thead tr');
    if (head) {
      head.innerHTML = comp.columns.map((c, i) => {
        if (i === 0) return `<th style="text-align:left;padding:1.25rem 1.5rem;color:var(--muted);font-weight:700;font-size:0.78rem;letter-spacing:0.06em;text-transform:uppercase;">${cfpEsc(c)}</th>`;
        const bg = i === 3 ? 'background:rgba(244,194,13,0.06);' : '';
        return `<th style="text-align:left;padding:1.25rem 1.5rem;${bg}color:var(--purple);font-weight:800;font-size:0.95rem;">${cfpEsc(c)}</th>`;
      }).join('');
    }
    tbody.innerHTML = comp.rows.map((row, ri) => {
      const border = ri === comp.rows.length - 1 ? '' : ' style="border-bottom:1px solid var(--border);"';
      const sub = row.sub ? `<span style="display:block;font-size:0.76rem;color:var(--muted);font-weight:400;margin-top:0.2rem;">${cfpEsc(row.sub)}</span>` : '';
      const feature = `<td style="padding:1.1rem 1.5rem;font-weight:700;color:#fff;">${cfpEsc(row.feature)}${sub}</td>`;
      const cells = (row.cells || []).map((v, ci) => cfpCompCell(v, ci + 1)).join('');
      return `<tr${border}>${feature}${cells}</tr>`;
    }).join('');
    if (wrap) wrap.style.opacity = '1';
  }

  /* ── COURSE FEATURES POPUP ──
     Supports two content formats:
     - c.features: flat array, one bullet per line (simple courses)
     - c.featuresRich: a string using a lightweight markup so admins can
       describe multi-section bundles (## Heading, plain intro lines,
       - bullet, > Outcome: ...). Parsed into named groups and rendered
       with real headings + an outcome callout instead of a flat list. */
  function cfpParseFeaturesRich(raw) {
    const groups = [];
    let current = null;
    (raw || '').split('\n').forEach(line => {
      const t = line.trim();
      if (!t) return;
      if (t.startsWith('## ')) {
        current = { heading: t.slice(3).trim(), intro: [], bullets: [], outcome: '' };
        groups.push(current);
      } else {
        if (!current) { current = { heading: '', intro: [], bullets: [], outcome: '' }; groups.push(current); }
        if (t.startsWith('- ') || t.startsWith('• ')) current.bullets.push(t.slice(2).trim());
        else if (/^>\s*/.test(t) || /^outcome:/i.test(t)) current.outcome = t.replace(/^>\s*/, '').replace(/^outcome:\s*/i, '').trim();
        else current.intro.push(t);
      }
    });
    return groups;
  }

  function cfpRenderFeatureGroup(g) {
    const heading = g.heading ? `<div class="course-features-group-heading">${g.heading}</div>` : '';
    const intro = g.intro.map((line, i) => `<p class="course-features-${i === 0 ? 'tagline' : 'intro'}">${line}</p>`).join('');
    const learnLabel = g.bullets.length ? '<div class="course-features-learn-label">Learn:</div>' : '';
    const bullets = g.bullets.length ? `<ul class="course-features">${g.bullets.map(b => `<li>${b}</li>`).join('')}</ul>` : '';
    const outcome = g.outcome ? `<div class="course-features-outcome"><strong>Outcome:</strong> ${g.outcome}</div>` : '';
    return `<div class="course-features-group">${heading}${intro}${learnLabel}${bullets}${outcome}</div>`;
  }

  /* Shared: build the 3-column ESSENTIALS/EDGE/PRECISION curriculum markup for
     a course. Same output the features modal uses — reused on the payment page
     ("View Course Content" accordion). Returns '' when there's no rich content. */
  window.cfpRenderCourseFeaturesRich = function (c) {
    if (!c || !(c.featuresRich || '').trim()) return '';
    const groups = cfpParseFeaturesRich(c.featuresRich);
    const closing = groups.length && /^final promise$/i.test(groups[groups.length - 1].heading) ? groups.pop() : null;
    const wide = groups.length >= 3;
    const columns = groups.map(cfpRenderFeatureGroup).join('');
    const closingHtml = closing ? `<div class="course-features-closing">${closing.intro.map(l => `<p>${l}</p>`).join('')}</div>` : '';
    return (wide ? `<div class="course-features-columns">${columns}</div>` : columns) + closingHtml;
  };

  /* Faux-document preview: teases the course PDF/curriculum without a real
     file — first 2 lines readable, rest blurred behind a lock overlay.
     Swap the line source for a real PDF render later without touching the
     surrounding popup markup. */
  function cfpDocPreviewHtml(c) {
    const bulletLines = (c.featuresRich || '').trim()
      ? cfpParseFeaturesRich(c.featuresRich).reduce((acc, g) => acc.concat(g.bullets), [])
      : (c.features || []);
    const lines = [c.desc].concat(bulletLines).filter(Boolean);
    const visible = lines.slice(0, 2);
    const blurred = lines.slice(2, 6);
    return `
      <div class="course-doc-preview">
        <div class="course-doc-page">
          <div class="course-doc-pagehead">${c.name} — Course Overview.pdf</div>
          ${visible.map(l => `<div class="course-doc-line">${l}</div>`).join('')}
          <div class="course-doc-blur-wrap">
            ${blurred.map(l => `<div class="course-doc-line">${l}</div>`).join('')}
            <div class="course-doc-lock-overlay">
              <span class="course-doc-lock-icon">🔒</span>
              <p>Full document unlocks instantly after enrollment</p>
            </div>
          </div>
        </div>
      </div>`;
  }

  window.openCourseFeatures = function (id) {
    if (!DATA) return;
    const modal = document.getElementById('course-features-modal');
    const modalEl = document.getElementById('course-features-modal-el');
    const content = document.getElementById('course-features-content');
    if (!modal || !content) return;
    const c = (DATA.courses || []).find(x => String(x.id) === String(id));
    if (!c) return;

    /* A trailing "Final Promise" section (e.g. the ESSENTIALS/EDGE/PRECISION
       curriculum) renders as a full-width closing tagline below the
       columns instead of becoming a 4th column. 3+ remaining sections lay
       out side by side and widen the modal to fit them. */
    let body;
    let wide = false;
    if ((c.featuresRich || '').trim()) {
      const groups = cfpParseFeaturesRich(c.featuresRich);
      const closing = groups.length && /^final promise$/i.test(groups[groups.length - 1].heading) ? groups.pop() : null;
      wide = groups.length >= 3;
      const columns = groups.map(cfpRenderFeatureGroup).join('');
      const closingHtml = closing ? `<div class="course-features-closing">${closing.intro.map(l => `<p>${l}</p>`).join('')}</div>` : '';
      body = (wide ? `<div class="course-features-columns">${columns}</div>` : columns) + closingHtml;
    } else {
      body = `<ul class="course-features">${(c.features || []).map(f => `<li>${f}</li>`).join('')}</ul>`;
    }

    if (modalEl) modalEl.classList.toggle('modal-wide', wide);
    const levelLine = (c.level && c.level !== c.name) ? `<div class="course-features-modal-level">${c.level}</div>` : '';
    const subLine = (c.subtitle && c.subtitle !== c.name) ? `<div class="course-features-modal-sub">${c.subtitle}</div>` : '';
    content.innerHTML = `
      <div class="course-features-modal-top"></div>
      <div class="course-features-modal-head">
        ${levelLine}
        <div class="course-features-modal-title">${c.name}</div>
        ${subLine}
      </div>
      ${body}
      ${cfpDocPreviewHtml(c)}
      <a href="${c.isModal ? 'javascript:void(0)' : c.ctaLink}" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:1rem;" onclick="closeCourseFeatures();${c.isModal ? ' if (typeof openModal === \'function\') openModal();' : ''}">${c.isModal ? c.ctaLabel : 'Proceed to Payment'} →</a>
    `;
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeCourseFeatures = function () {
    const modal = document.getElementById('course-features-modal');
    if (!modal) return;
    modal.classList.remove('active');
    document.body.style.overflow = '';
  };

  (function wireCourseFeaturesModal() {
    const modal = document.getElementById('course-features-modal');
    const closeBtn = document.getElementById('course-features-close');
    if (closeBtn) closeBtn.addEventListener('click', window.closeCourseFeatures);
    if (modal) modal.addEventListener('click', e => { if (e.target === modal) window.closeCourseFeatures(); });
  })();

  /* ── TESTIMONIALS (auto-scroll + manual drag/swipe) ── */
  function renderTestimonials() {
    const track = document.getElementById('marquee-track');
    const wrap = track && track.parentElement;
    if (!track || !wrap || !DATA.testimonials) return;
    const cardHtml = t => `
      <div class="t-card">
        <div class="t-stars" aria-label="${t.rating} stars">${'★'.repeat(t.rating)}${'☆'.repeat(5 - t.rating)}</div>
        <p class="t-quote">"${t.quote}"</p>
        <div class="t-author"><div class="t-avatar">${t.name.charAt(0)}</div><div><div class="t-name">${t.name}</div><div class="t-role">${t.role}</div></div></div>
      </div>`;
    track.innerHTML = DATA.testimonials.map(cardHtml).join('') + DATA.testimonials.map(cardHtml).join('');

    var autoSpeed = 0.5;
    var autoId = null;
    var userTimeout = null;
    var isDragging = false;
    var startX = 0;
    var scrollStart = 0;

    function autoScroll() {
      wrap.scrollLeft += autoSpeed;
      var half = track.scrollWidth / 2;
      if (wrap.scrollLeft >= half) wrap.scrollLeft -= half;
      autoId = requestAnimationFrame(autoScroll);
    }

    function startAuto() {
      if (!autoId) autoId = requestAnimationFrame(autoScroll);
    }

    function stopAuto() {
      if (autoId) { cancelAnimationFrame(autoId); autoId = null; }
    }

    function resumeAfterDelay() {
      clearTimeout(userTimeout);
      userTimeout = setTimeout(startAuto, 3000);
    }

    wrap.addEventListener('mousedown', function (e) {
      isDragging = true; startX = e.pageX; scrollStart = wrap.scrollLeft;
      track.classList.add('dragging'); stopAuto(); e.preventDefault();
    });
    window.addEventListener('mousemove', function (e) {
      if (!isDragging) return;
      wrap.scrollLeft = scrollStart - (e.pageX - startX);
    });
    window.addEventListener('mouseup', function () {
      if (!isDragging) return;
      isDragging = false; track.classList.remove('dragging'); resumeAfterDelay();
    });
    wrap.addEventListener('touchstart', function (e) {
      stopAuto(); startX = e.touches[0].pageX; scrollStart = wrap.scrollLeft;
    }, { passive: true });
    wrap.addEventListener('touchmove', function (e) {
      wrap.scrollLeft = scrollStart - (e.touches[0].pageX - startX);
    }, { passive: true });
    wrap.addEventListener('touchend', function () { resumeAfterDelay(); }, { passive: true });
    wrap.addEventListener('wheel', function () { stopAuto(); resumeAfterDelay(); }, { passive: true });

    startAuto();
  }

  /* ── BLOG PREVIEW (homepage, first 3 articles) ── */
  function renderBlogPreview() {
    const grid = document.getElementById('blog-preview-grid');
    if (!grid || !DATA.articles) return;
    /* Most-read articles surface first, but the preview still shows a mix
       so older articles don't disappear from the homepage entirely. */
    const featured = DATA.articles.filter(a => a.featured);
    const rest = DATA.articles.filter(a => !a.featured);
    const items = featured.concat(rest).slice(0, 6);
    grid.innerHTML = items.map((a, i) => {
      const icon = `<span style="color:${a.color}">${cfpArticleSvg(a.icon)}</span>`;
      const mostReadTag = a.featured ? '<span class="blog-tag tag-mostread">🔥 Most Read</span>' : '';
      if (cfpEffectiveAccess(a) === 'premium') {
        return `
        <article class="blog-card reveal${i ? ' reveal-delay-' + i : ''}" style="cursor:pointer;" onclick="openArticle('${a.id}')">
          <div class="blog-card-img" aria-hidden="true">${icon}</div>
          <div class="blog-card-body">
            <div class="blog-meta"><span class="blog-category">${a.category}</span><span class="blog-tag tag-premium">Premium</span>${mostReadTag}</div>
            <h3>${a.title}</h3>
            <div class="blog-card-locked" aria-hidden="true"><p>${a.excerpt}</p></div>
          </div>
          <div class="blog-lock-overlay">
            <div class="lock-icon" aria-hidden="true">🔒</div>
            <p style="font-size:0.78rem;color:rgba(255,255,255,0.7);text-align:center;margin-bottom:0.75rem;">Click to preview · Unlock with any paid course</p>
          </div>
        </article>`;
      }
      return `
        <article class="blog-card reveal${i ? ' reveal-delay-' + i : ''}">
          <div class="blog-card-img" aria-hidden="true">${icon}</div>
          <div class="blog-card-body">
            <div class="blog-meta"><span class="blog-category">${a.category}</span><span class="blog-tag tag-free">Free</span>${mostReadTag}</div>
            <h3>${a.title}</h3>
            <p>${a.excerpt}</p>
            <button class="blog-link" onclick="openArticle('${a.id}')">Read Article →</button>
          </div>
        </article>`;
    }).join('');
  }

  /* Maps the old emoji-icon keys used throughout data.js to the shared
     CFP_SVG_ICONS set (see data.js) — kept as a function so blog.js /
     backtesting.js can use the identical mapping. */
  const ARTICLE_ICON_KEY = {
    candlestick_chart: 'candlestick', shield: 'shield', psychology: 'message',
    description: 'filetext', auto_graph: 'activity', trending_up: 'trendingup'
  };
  function cfpArticleSvg(iconName) {
    const key = ARTICLE_ICON_KEY[iconName] || 'trendingup';
    return (typeof CFP_SVG_ICONS !== 'undefined' && CFP_SVG_ICONS[key]) || '';
  }

  /* ── ARTICLE MODAL (shared by homepage preview + full blog grid) ── */
  window.openArticle = function (id) {
    if (!DATA) return;
    const overlay = document.getElementById('article-modal-overlay');
    const content = document.getElementById('article-modal-content');
    if (!overlay || !content) return;
    const a = (DATA.articles || []).find(x => String(x.id) === String(id));
    if (!a) return;

    if (cfpEffectiveAccess(a) === 'premium') {
      content.innerHTML = `
        <div class="article-lock-modal">
          <div class="article-modal-top" style="height:2px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.05));border-radius:16px 16px 0 0;position:absolute;top:0;left:0;right:0;"></div>
          <div class="article-lock-icon">🔒</div>
          <div class="article-modal-cat" style="margin-bottom:0.6rem;">${a.category} · Premium</div>
          <div class="article-modal-title" style="margin-bottom:1.5rem;">${a.title}</div>
          <div class="article-lock-preview"><p>${a.excerpt}</p><div class="article-lock-gradient"></div></div>
          <p style="font-size:0.85rem;color:rgba(255,255,255,0.5);margin-bottom:1.75rem;">This article is outside the current free preview window — available exclusively to students enrolled in any paid course.</p>
          <a href="/pages/courses.html" class="btn btn-primary" style="display:inline-flex;margin-bottom:0.75rem;">Purchase Now →</a><br>
          <button class="btn btn-secondary" style="display:inline-flex;margin-top:0.5rem;" onclick="closeArticle()">Maybe Later</button>
        </div>`;
    } else {
      content.innerHTML = `
        <div class="article-modal-top"></div>
        <div class="article-modal-head">
          <div class="article-modal-cat">${a.category} · Free</div>
          <div class="article-modal-title">${a.title}</div>
        </div>
        <div class="article-modal-body">${a.body}</div>`;
    }
    overlay.classList.add('active');
    document.body.style.overflow = 'hidden';
  };

  window.closeArticle = function () {
    const overlay = document.getElementById('article-modal-overlay');
    if (!overlay) return;
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  };

  (function wireArticleModal() {
    const overlay = document.getElementById('article-modal-overlay');
    const closeBtn = document.getElementById('article-modal-close');
    if (closeBtn) closeBtn.addEventListener('click', window.closeArticle);
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) window.closeArticle(); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') window.closeArticle(); });
  })();

  /* ── FOOTER / CONTACT ── */
  function renderContact() {
    setText('contact-email-text', DATA.contact.email);
    setText('contact-whatsapp-text', DATA.contact.whatsapp);
    setText('contact-telegram-text', DATA.contact.telegram);
    setText('footer-disclaimer', '*' + DATA.legal.disclaimer);
    document.querySelectorAll('a[href^="mailto:hello@capitalfinplusadvizors.com"]:not(#contact-email-link)').forEach(a => {
      a.href = 'mailto:' + DATA.contact.email;
      a.textContent = DATA.contact.email;
    });

    const waDigits = (DATA.contact.whatsapp || '').replace(/[^\d]/g, '');
    const emailLink = document.getElementById('contact-email-link');
    if (emailLink) emailLink.href = 'mailto:' + DATA.contact.email;
    const waLink = document.getElementById('contact-whatsapp-link');
    if (waLink && waDigits) waLink.href = 'https://wa.me/' + waDigits;
    const tgLink = document.getElementById('contact-telegram-link');
    if (tgLink && DATA.contact.telegramUrl) tgLink.href = DATA.contact.telegramUrl;

    const fEmail = document.getElementById('footer-email');
    if (fEmail) { fEmail.href = 'mailto:' + DATA.contact.email; fEmail.textContent = DATA.contact.email; }
    const fWa = document.getElementById('footer-whatsapp');
    if (fWa && waDigits) fWa.href = 'https://wa.me/' + waDigits;
    const fTg = document.getElementById('footer-telegram');
    if (fTg && DATA.contact.telegramUrl) fTg.href = DATA.contact.telegramUrl;

    const socialMap = {
      'social-instagram': DATA.contact.instagramUrl,
      'social-youtube': DATA.contact.youtubeUrl,
      'social-telegram': DATA.contact.telegramUrl
    };
    Object.entries(socialMap).forEach(([id, url]) => {
      const a = document.getElementById(id);
      if (a && url) { a.href = url; a.target = '_blank'; a.rel = 'noopener'; }
    });

    /* Floating WhatsApp button (bottom-right, every page) */
    if (waDigits && !document.getElementById('wa-float-btn')) {
      const btn = document.createElement('a');
      btn.id = 'wa-float-btn';
      btn.href = 'https://wa.me/' + waDigits;
      btn.target = '_blank';
      btn.rel = 'noopener';
      btn.setAttribute('aria-label', 'Chat with us on WhatsApp');
      btn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" width="28" height="28"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-1.738-.868-2.876-1.552-4.02-3.521-.305-.523.305-.486.872-1.616.097-.198.05-.371-.05-.52-.099-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.67-.51-.173-.01-.371-.012-.57-.012-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.057 3.146 4.983 4.29 2.927 1.143 2.927.762 3.476.713.55-.05 1.758-.718 2.006-1.412.248-.694.248-1.289.173-1.412-.074-.124-.272-.198-.57-.347zM12.04 0C5.39 0 .04 5.348.04 12c0 2.124.553 4.117 1.523 5.85L0 24l6.323-1.514A11.93 11.93 0 0012.04 24c6.648 0 12-5.348 12-12S18.688 0 12.04 0zm0 21.937c-1.949 0-3.85-.524-5.495-1.514l-.394-.235-3.747.898.91-3.696-.258-.408A9.873 9.873 0 012.062 12c0-5.498 4.48-9.937 9.978-9.937 5.497 0 9.957 4.439 9.957 9.937 0 5.498-4.46 9.937-9.957 9.937z"/></svg>';
      document.body.appendChild(btn);
    }
  }

  /* ── FREE MASTERCLASS WIDGET ──
     A second floating circle above the WhatsApp button. Shakes briefly to
     draw the eye, then pops open a short name+email form inviting people
     to the weekly Saturday 11 AM masterclass. Captured leads go to the
     same Form Submissions panel as everything else (type: 'masterclass').
     Dismissing it (or submitting) means it won't auto-pop again on this
     browser, but the floating button stays clickable any time. */
  function nextSaturday11AM() {
    const now = new Date();
    const target = new Date(now);
    const daysUntilSat = (6 - now.getDay() + 7) % 7;
    target.setDate(now.getDate() + daysUntilSat);
    target.setHours(11, 0, 0, 0);
    if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 7);
    return target;
  }

  function formatMasterclassDate(d) {
    return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' }) + ' at 11:00 AM';
  }

  function renderMasterclassWidget() {
    if (document.getElementById('masterclass-float-btn')) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'masterclass-float-btn';
    btn.setAttribute('aria-label', 'Join our free masterclass');
    btn.innerHTML = '<svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" width="26" height="26"><path d="M2 9.5L12 5l10 4.5-10 4.5-10-4.5z"/><path d="M6 11.5V17c0 1.1 2.7 2.5 6 2.5s6-1.4 6-2.5v-5.5"/><path d="M21 9.5v6"/></svg>';
    btn.classList.add('mc-shake');
    document.body.appendChild(btn);

    const popup = document.createElement('div');
    popup.id = 'masterclass-popup';
    popup.innerHTML = `
      <button type="button" class="mc-popup-close" id="mc-popup-close" aria-label="Close">✕</button>
      <div id="mc-popup-pitch">
        <div class="mc-popup-title">Want to join our free masterclass?</div>
        <p class="mc-popup-sub">Live every Saturday, 11:00 AM. Next session: <strong>${formatMasterclassDate(nextSaturday11AM())}</strong>.</p>
        <div class="form-group"><label for="mc-name">Name</label><input class="form-input" id="mc-name" type="text" placeholder="Rahul Sharma" /></div>
        <div class="form-group"><label for="mc-email">Email</label><input class="form-input" id="mc-email" type="email" placeholder="rahul@example.com" /></div>
        <button type="button" class="btn btn-primary" id="mc-submit" style="width:100%;justify-content:center;">Reserve My Spot →</button>
      </div>
      <div id="mc-popup-success" style="display:none;">
        <div class="mc-popup-title">You're in! 🎉</div>
        <p class="mc-popup-sub">We'll send the joining link to your email and WhatsApp before <strong>${formatMasterclassDate(nextSaturday11AM())}</strong>.</p>
      </div>
    `;
    document.body.appendChild(popup);

    function openPopup() {
      popup.classList.add('open');
      btn.classList.remove('mc-shake');
      localStorage.setItem('cfp_masterclass_seen', '1');
    }
    function closePopup() { popup.classList.remove('open'); }

    btn.addEventListener('click', () => { popup.classList.contains('open') ? closePopup() : openPopup(); });
    document.getElementById('mc-popup-close').addEventListener('click', closePopup);

    document.getElementById('mc-submit').addEventListener('click', () => {
      const name = document.getElementById('mc-name').value.trim();
      const email = document.getElementById('mc-email').value.trim();
      if (!name || !email || !email.includes('@')) {
        popup.style.animation = 'shake 0.35s ease';
        setTimeout(() => { popup.style.animation = ''; }, 350);
        return;
      }
      const sessionDate = formatMasterclassDate(nextSaturday11AM());
      // TODO: once a backend/email service is wired up, actually send the
      // masterclass link via email + WhatsApp here. For now this is
      // captured exactly like every other lead, visible in the admin's
      // Form Submissions panel, with the computed session date attached.
      if (typeof cfpRecordSubmission === 'function') {
        cfpRecordSubmission({ type: 'masterclass', name, email, phone: '', experience: '', message: 'Free Masterclass — ' + sessionDate });
      }
      fetch('/api/notify-form', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type: 'masterclass', name, email, message: 'Free Masterclass — ' + sessionDate }) }).catch(() => {});
      localStorage.setItem('cfp_masterclass_submitted', '1');
      document.getElementById('mc-popup-pitch').style.display = 'none';
      document.getElementById('mc-popup-success').style.display = 'block';
      setTimeout(closePopup, 4000);
    });

    // Auto-open once per browser, a few seconds after the shake, unless
    // already seen or submitted before.
    if (!localStorage.getItem('cfp_masterclass_seen') && !localStorage.getItem('cfp_masterclass_submitted')) {
      setTimeout(openPopup, 6000);
    } else {
      btn.classList.remove('mc-shake');
    }
  }

  /* Runs synchronously — this script tag sits right after all the page's
     markup, so the DOM is already there. Must finish BEFORE script.js
     (loaded next) attaches its .open-modal / reveal / counter listeners,
     otherwise those listeners would bind to elements we just replaced. */
  /* ── BOOKING MODAL: Calendly embed vs. the static form ──
     Driven entirely by Admin Dashboard -> Contact & Integrations ->
     Calendly Booking URL. Empty = keep the existing lead-capture form
     (and it still gets logged to the admin's Form Submissions panel).
     Set = swap the modal to a real, embedded Calendly calendar — no
     other code change needed when the URL is filled in. */
  /* ── BOOKING MODAL: two-step flow ──
     Step 1 is always our own branded lead-capture form (name, phone,
     email, experience, goal) — Calendly's own form doesn't ask half of
     this, so we keep it regardless of whether Calendly is connected.
     Step 2 only exists once Admin -> Contact & Integrations -> Calendly
     Booking URL is filled in: after a successful Step 1 submit,
     script.js swaps to a Calendly inline widget (recolored to match the
     site, with name/email pre-filled) for just the date/time picker —
     Calendly doesn't expose an API to reserve a slot ourselves, so the
     calendar grid itself has to be theirs, but everything else stays ours.
     This function just stores the (recolored) URL on the widget element
     for script.js to use at submit time — it does NOT switch panels on
     page load anymore. */
  function renderBookingWidget() {
    const rawUrl = (DATA.contact.calendlyUrl || '').trim();
    if (!rawUrl) { window.cfpCalendlyUrl = null; return; }
    const separator = rawUrl.includes('?') ? '&' : '?';
    window.cfpCalendlyUrl = rawUrl + separator + 'background_color=120e02&text_color=ffffff&primary_color=F4C20D';
  }

  /* Blog/Backtesting standalone-page headers + the blog newsletter strip —
     guarded so this is a no-op on pages that don't have these elements. */
  function renderPageContent() {
    const pages = DATA.pages || {};
    const blog = pages.blog || {};
    const bt = pages.backtesting || {};
    const nl = pages.newsletter || {};

    setText('blog-page-tag', blog.tag);
    setText('blog-page-title', blog.title);
    setText('blog-page-sub', blog.sub);
    setText('blog-page-free-label', blog.freeLabel);
    setText('blog-page-premium-label', blog.premiumLabel);

    setText('bt-page-tag', bt.tag);
    setText('bt-page-title', bt.title);
    setText('bt-page-sub', bt.sub);
    setText('bt-page-free-label', bt.freeLabel);
    setText('bt-page-premium-label', bt.premiumLabel);

    setText('nl-tag', nl.tag);
    setText('nl-title', nl.title);
    setText('nl-sub', nl.sub);
    setText('nl-btn-label', nl.buttonLabel);

    /* Fade in hero content now that data is ready — heroes start at
       opacity:0 so there's no flash of stale hardcoded text. */
    const blogHero = document.getElementById('blog-hero-content');
    if (blogHero) blogHero.style.opacity = '1';
    const btHero = document.getElementById('bt-hero-content');
    if (btHero) btHero.style.opacity = '1';
  }

  (async function initRender() {
    DATA = await cfpLoadPublicData();
    renderHero();
    renderStats();
    renderAbout();
    renderPlans();
    renderCourses();
    renderComparisonTable();
    renderTestimonials();
    renderBlogPreview();
    renderContact();
    renderBookingWidget();
    renderMasterclassWidget();
    renderPageContent();

    window.CFP_RENDER_DATA = DATA;

    /* script.js's one-time .reveal sweep (on index.html, it loads right
       after this file) already ran before this async data finished, so
       the cards just inserted above (courses, blog preview, testimonials)
       were never observed — re-run it now so they actually fade in
       instead of sitting at opacity:0 forever. */
    if (typeof window.cfpObserveReveals === 'function') window.cfpObserveReveals();
  })();
})();
