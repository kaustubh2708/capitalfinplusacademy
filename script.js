/* ==============================================
   Capital Finplus Academy — V5 script.js
   Galaxy Canvas (Milky Way) + Full interactivity
   ============================================== */

/* ─── CUSTOM CURSOR ──────────────────────────── */
(function initCursor() {
  const cursor = document.getElementById('cursor');
  const ring   = document.getElementById('cursor-ring');
  if (!cursor || !ring) return;
  let rx = 0, ry = 0;
  document.addEventListener('mousemove', e => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top  = e.clientY + 'px';
  });
  function animRing() {
    const cx = parseFloat(cursor.style.left) || 0;
    const cy = parseFloat(cursor.style.top)  || 0;
    rx += (cx - rx) * 0.22;
    ry += (cy - ry) * 0.22;
    ring.style.left = rx + 'px';
    ring.style.top  = ry + 'px';
    requestAnimationFrame(animRing);
  }
  animRing();
  document.querySelectorAll('a,button,.course-enroll,.blog-link').forEach(el => {
    el.addEventListener('mouseenter', () => { cursor.style.width='18px'; cursor.style.height='18px'; ring.style.width='52px'; ring.style.height='52px'; });
    el.addEventListener('mouseleave', () => { cursor.style.width='10px'; cursor.style.height='10px'; ring.style.width='36px'; ring.style.height='36px'; });
  });
})();

/* ─── MILKY WAY GALAXY CANVAS ────────────────── */
(function initGalaxy() {
  const canvas = document.getElementById('galaxy-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, time = 0;
  let stars = [], nebulae = [], shootingStars = [], orbits = [];
  let mouseX = 0, mouseY = 0, targetX = 0, targetY = 0;
  let scrollY = 0;

  const COLORS = {
    core:   ['#ffffff', '#fff4d6', '#ffe9a8', '#FFE066', '#FFD24D'],
    mid:    ['#ffffff', '#fff1cf', '#FFE066', '#F4C20D'],
    edge:   ['#cfc9b8', '#9a9484', '#ffffff'],
    gold:   ['#F4C20D', '#FFB300', '#9A7300'],
  };

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }

  function rand(a, b) { return a + Math.random() * (b - a); }

  /* Milky Way band: arc of dense stars across the screen */
  function isMilkyWay(x, y) {
    /* band runs from top-right to bottom-left, ~35% of height offset */
    const cx = W * 0.5, cy = H * 0.5;
    const angle = -Math.PI * 0.18; /* ~32 degrees, mirrored */
    const rotX = (x - cx) * Math.cos(-angle) - (y - cy) * Math.sin(-angle);
    const rotY = (x - cx) * Math.sin(-angle) + (y - cy) * Math.cos(-angle);
    const bandWidth = H * 0.28;
    return Math.abs(rotY) < bandWidth;
  }

  function milkyWayDensity(x, y) {
    const cx = W * 0.5, cy = H * 0.5;
    const angle = -Math.PI * 0.18;
    const rotX = (x - cx) * Math.cos(-angle) - (y - cy) * Math.sin(-angle);
    const rotY = (x - cx) * Math.sin(-angle) + (y - cy) * Math.cos(-angle);
    const bandWidth = H * 0.28;
    const dist = Math.abs(rotY) / bandWidth;
    return Math.max(0, 1 - dist);
  }

  function initStars() {
    stars = [];
    const total = Math.min(Math.floor(W * H / 2800), 700);
    for (let i = 0; i < total; i++) {
      const x = Math.random() * W;
      const y = Math.random() * H;
      const inBand = isMilkyWay(x, y);
      const density = milkyWayDensity(x, y);
      /* Only add non-band stars with probability, band stars always */
      if (!inBand && Math.random() > 0.35) { i--; continue; }
      const isCore = density > 0.7;
      const colorSet = isCore ? COLORS.core : (inBand ? COLORS.mid : COLORS.edge);
      stars.push({
        x, y,
        baseX: x, baseY: y,
        r: inBand ? rand(0.25, isCore ? 2.2 : 1.4) : rand(0.2, 1.0),
        color: colorSet[Math.floor(Math.random() * colorSet.length)],
        alpha: inBand ? rand(0.3, isCore ? 1.0 : 0.75) : rand(0.1, 0.45),
        baseAlpha: 0,
        twinkle: Math.random() > 0.45,
        twinkleSpeed: rand(0.008, 0.035),
        twinklePhase: Math.random() * Math.PI * 2,
        drift: { x: rand(-0.015, 0.015), y: rand(-0.008, 0.008) },
        parallax: rand(0.005, 0.05),
        isCore,
        density,
      });
      stars[stars.length-1].baseAlpha = stars[stars.length-1].alpha;
    }
  }

  function initNebulae() {
    nebulae = [
      { cx: 0.5,  cy: 0.5,  rx: 0.55, ry: 0.12, color: '244,194,13', opacity: 0.07, pulse: 0.003, phase: 0 },
      { cx: 0.35, cy: 0.4,  rx: 0.22, ry: 0.09, color: '184,134,11', opacity: 0.06, pulse: 0.005, phase: 1.5 },
      { cx: 0.65, cy: 0.6,  rx: 0.22, ry: 0.08, color: '255,210,77', opacity: 0.05, pulse: 0.004, phase: 3 },
      { cx: 0.2,  cy: 0.7,  rx: 0.18, ry: 0.06, color: '255,179,0',  opacity: 0.04, pulse: 0.006, phase: 4.5 },
      { cx: 0.8,  cy: 0.3,  rx: 0.18, ry: 0.06, color: '244,194,13', opacity: 0.04, pulse: 0.007, phase: 2 },
    ];
  }

  /* Orbit system: a glowing core with rings of particles revolving around
     it, Framer-style. Centered on the hero, tilted to match the Milky Way
     band so it reads as one cohesive scene rather than two effects. */
  function initOrbits() {
    orbits = [
      { rx: 0.16, ry: 0.16 * 0.38, speed: 0.0009, count: 3, size: [1.4, 2.4], offset: 0 },
      { rx: 0.27, ry: 0.27 * 0.38, speed: -0.0006, count: 4, size: [1.1, 2.0], offset: 1.1 },
      { rx: 0.39, ry: 0.39 * 0.38, speed: 0.00042, count: 5, size: [0.9, 1.6], offset: 2.4 },
      { rx: 0.52, ry: 0.52 * 0.38, speed: -0.0003, count: 6, size: [0.7, 1.3], offset: 0.6 },
    ].map(ring => ({
      ...ring,
      angle: ring.offset,
      particles: Array.from({ length: ring.count }, (_, i) => ({
        a: (Math.PI * 2 / ring.count) * i,
        r: rand(ring.size[0], ring.size[1]),
        twinklePhase: Math.random() * Math.PI * 2,
      })),
    }));
  }

  function drawOrbits() {
    const cx = W * 0.5, cy = (W < 768 ? H * 0.37 : H * 0.44) + scrollY * 0.04;
    const tilt = -Math.PI * 0.18;

    /* Central glowing core (sun) */
    const corePulse = 0.85 + 0.15 * Math.sin(time * 0.02);
    const coreR = Math.min(W, H) * 0.018 * corePulse;
    const coreGlow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreR * 6);
    coreGlow.addColorStop(0,   'rgba(255,221,128,0.9)');
    coreGlow.addColorStop(0.3, 'rgba(244,194,13,0.35)');
    coreGlow.addColorStop(1,   'rgba(244,194,13,0)');
    ctx.beginPath();
    ctx.arc(cx, cy, coreR * 6, 0, Math.PI * 2);
    ctx.fillStyle = coreGlow;
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.fillStyle = '#fff4d6';
    ctx.shadowBlur = 18;
    ctx.shadowColor = '#FFD24D';
    ctx.fill();
    ctx.shadowBlur = 0;

    orbits.forEach(ring => {
      ring.angle += ring.speed;
      const a = Math.min(W, H);
      const rx = a * ring.rx, ry = a * ring.ry;

      /* Faint ring path */
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(tilt);
      ctx.strokeStyle = 'rgba(244,194,13,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.ellipse(0, 0, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();

      ring.particles.forEach(p => {
        const ang = p.a + ring.angle;
        const lx = Math.cos(ang) * rx;
        const ly = Math.sin(ang) * ry;
        const px = cx + lx * Math.cos(tilt) - ly * Math.sin(tilt);
        const py = cy + lx * Math.sin(tilt) + ly * Math.cos(tilt);
        /* depth cue: particles on the "near" half of the ellipse are bigger/brighter */
        const depth = 0.6 + 0.4 * Math.sin(ang);
        p.twinklePhase += 0.02;
        const tw = 0.7 + 0.3 * Math.sin(p.twinklePhase);
        ctx.beginPath();
        ctx.arc(px, py, p.r * depth, 0, Math.PI * 2);
        ctx.fillStyle = '#FFE066';
        ctx.globalAlpha = depth * tw;
        ctx.shadowBlur = 6 * depth;
        ctx.shadowColor = '#F4C20D';
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.globalAlpha = 1;
      });
    });
  }

  function spawnShooting() {
    if (shootingStars.length > 3) return;
    shootingStars.push({
      x: rand(W * 0.3, W), y: rand(0, H * 0.35),
      len: rand(120, 240), speed: rand(7, 16),
      angle: Math.PI - rand(18, 42) * Math.PI / 180,
      life: 1, decay: rand(0.01, 0.022),
    });
  }

  function drawNebulae() {
    nebulae.forEach(n => {
      const pulse = Math.sin(time * n.pulse + n.phase);
      const op = n.opacity + pulse * 0.018;
      const angle = -Math.PI * 0.18;
      ctx.save();
      ctx.translate(n.cx * W, n.cy * H + scrollY * 0.03);
      ctx.rotate(angle);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(n.rx * W, n.ry * H));
      grad.addColorStop(0,   `rgba(${n.color},${op})`);
      grad.addColorStop(0.5, `rgba(${n.color},${op * 0.3})`);
      grad.addColorStop(1,   `rgba(${n.color},0)`);
      ctx.scale(n.rx * W / (n.ry * H), 1);
      ctx.beginPath();
      ctx.arc(0, 0, n.ry * H, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.restore();
    });
  }

  function drawStars() {
    stars.forEach(s => {
      s.twinklePhase += s.twinkleSpeed;
      const twinkle = s.twinkle ? 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(s.twinklePhase)) : 1;
      const alpha = s.baseAlpha * twinkle;
      s.x += s.drift.x;
      s.y += s.drift.y;
      if (s.x < -5) s.x = W + 5;
      if (s.x > W + 5) s.x = -5;
      if (s.y < -5) s.y = H + 5;
      if (s.y > H + 5) s.y = -5;
      const px = s.x + mouseX * s.parallax;
      const py = s.y + mouseY * s.parallax + scrollY * s.parallax * 0.2;
      ctx.beginPath();
      ctx.arc(px % W, ((py % H) + H) % H, s.r, 0, Math.PI * 2);
      ctx.fillStyle = s.color;
      ctx.globalAlpha = alpha;
      ctx.fill();
      /* Glow for brighter/core stars */
      if (s.isCore && s.r > 1.2 && alpha > 0.5) {
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#F4C20D';
        ctx.fill();
        ctx.shadowBlur = 0;
      }
      ctx.globalAlpha = 1;
    });
  }

  function drawShootingStars() {
    shootingStars.forEach((ss, i) => {
      const tx = ss.x - Math.cos(ss.angle) * ss.len;
      const ty = ss.y - Math.sin(ss.angle) * ss.len;
      const grad = ctx.createLinearGradient(tx, ty, ss.x, ss.y);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.7, `rgba(255,224,102,${ss.life * 0.5})`);
      grad.addColorStop(1, `rgba(255,255,255,${ss.life})`);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ss.x, ss.y);
      ctx.stroke();
      ss.x += Math.cos(ss.angle) * ss.speed;
      ss.y += Math.sin(ss.angle) * ss.speed;
      ss.life -= ss.decay;
      if (ss.life <= 0) shootingStars.splice(i, 1);
    });
  }

  function loop() {
    if (document.hidden) { requestAnimationFrame(loop); return; }
    time++;
    ctx.clearRect(0, 0, W, H);
    mouseX += (targetX - mouseX) * 0.04;
    mouseY += (targetY - mouseY) * 0.04;
    drawNebulae();
    drawOrbits();
    drawStars();
    drawShootingStars();
    if (Math.random() < 0.004 && shootingStars.length < 3) spawnShooting();
    requestAnimationFrame(loop);
  }

  document.addEventListener('mousemove', e => {
    targetX = (e.clientX - W / 2) * 0.5;
    targetY = (e.clientY - H / 2) * 0.5;
  });
  window.addEventListener('scroll', () => { scrollY = window.scrollY; }, { passive: true });
  window.addEventListener('resize', () => { resize(); initStars(); initOrbits(); });
  resize(); initStars(); initNebulae(); initOrbits(); loop();
})();

/* ─── NAVBAR SCROLL ──────────────────────────── */
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 40);
}, { passive: true });

/* ─── HAMBURGER MENU ─────────────────────────── */
const hamburger = document.getElementById('hamburger');
const mobileNav = document.getElementById('mobile-nav');
if (hamburger && mobileNav) {
  hamburger.addEventListener('click', () => {
    const open = mobileNav.classList.toggle('open');
    hamburger.setAttribute('aria-expanded', open);
  });
  mobileNav.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => mobileNav.classList.remove('open'));
  });
}

/* ─── KNOWLEDGE NAV DROPDOWN (click — hover alone doesn't work on touch) ─── */
document.querySelectorAll('.nav-dropdown').forEach(dd => {
  const toggle = dd.querySelector('.nav-dropdown-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', e => {
    e.preventDefault();
    e.stopPropagation();
    const isOpen = dd.classList.contains('open');
    document.querySelectorAll('.nav-dropdown.open').forEach(o => o.classList.remove('open'));
    dd.classList.toggle('open', !isOpen);
  });
});
document.addEventListener('click', e => {
  document.querySelectorAll('.nav-dropdown.open').forEach(dd => {
    if (!dd.contains(e.target)) dd.classList.remove('open');
  });
});

/* ─── MODAL ──────────────────────────────────── */
const modalOverlay  = document.getElementById('modal-overlay');
const modalClose    = document.getElementById('modal-close');
const bookingForm   = document.getElementById('booking-form');
const modalSuccess  = document.getElementById('modal-success');
const modalFormBody = document.getElementById('modal-form-body');

function openModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.add('active');
  document.body.style.overflow = 'hidden';
}
function closeModal() {
  if (!modalOverlay) return;
  modalOverlay.classList.remove('active');
  document.body.style.overflow = '';
  setTimeout(() => {
    // Always reset back to Step 1 (our form) for next time
    const calBody = document.getElementById('modal-calendly-body');
    const modalEl = document.querySelector('#modal-overlay .modal');
    if (modalFormBody) modalFormBody.style.display = 'block';
    if (calBody) calBody.style.display = 'none';
    if (modalEl) modalEl.classList.remove('modal-calendly');
    if (modalSuccess)  modalSuccess.classList.remove('show');
    if (bookingForm)   bookingForm.reset();
    const goalOtherWrap = document.getElementById('f-goal-other-wrap');
    if (goalOtherWrap) goalOtherWrap.style.display = 'none';
  }, 400);
}

document.querySelectorAll('.open-modal').forEach(el => {
  el.addEventListener('click', e => { e.preventDefault(); openModal(); });
});
if (modalClose)   modalClose.addEventListener('click', closeModal);
if (modalOverlay) modalOverlay.addEventListener('click', e => { if (e.target === modalOverlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

if (bookingForm) {
  bookingForm.addEventListener('submit', e => {
    e.preventDefault();
    const name  = document.getElementById('f-name')?.value.trim();
    const phone = document.getElementById('f-phone')?.value.trim();
    const email = document.getElementById('f-email')?.value.trim();
    if (!name || !phone || !email) {
      bookingForm.style.animation = 'shake 0.35s ease';
      setTimeout(() => bookingForm.style.animation = '', 350);
      return;
    }
    const goalSelect = document.getElementById('f-goal');
    const goalOther = document.getElementById('f-goal-other');
    const goalMessage = (goalSelect && goalSelect.value === 'other')
      ? (goalOther?.value.trim() || 'Something else')
      : (goalSelect?.value || '');

    if (typeof cfpRecordSubmission === 'function') {
      cfpRecordSubmission({
        type: 'booking', name, phone, email,
        experience: document.getElementById('f-exp')?.value || '',
        message: goalMessage
      });
    }
    if (modalFormBody) modalFormBody.style.display = 'none';

    // Step 2: if Calendly is connected, swap to the (recolored,
    // pre-filled) calendar for picking a time. Otherwise, show the plain
    // success message as before.
    const calEl = document.getElementById('calendly-widget');
    const calBody = document.getElementById('modal-calendly-body');
    const calUrl = calEl && calEl.getAttribute('data-url');
    if (calUrl && calBody) {
      const modalEl = document.querySelector('#modal-overlay .modal');
      if (modalEl) modalEl.classList.add('modal-calendly');
      calBody.style.display = 'block';
      calEl.innerHTML = '';
      let attempts = 0;
      (function initWhenReady() {
        if (window.Calendly && typeof window.Calendly.initInlineWidget === 'function') {
          window.Calendly.initInlineWidget({
            url: calUrl,
            parentElement: calEl,
            prefill: { name, email }
          });
        } else if (attempts++ < 25) {
          setTimeout(initWhenReady, 200); // Calendly's widget.js loads async — poll briefly until it's ready
        }
      })();
    } else if (modalSuccess) {
      modalSuccess.classList.add('show');
    }
  });
}

/* Show the free-text box only when "Something else" is selected */
document.querySelectorAll('#f-goal').forEach(sel => {
  sel.addEventListener('change', () => {
    const wrap = document.getElementById('f-goal-other-wrap');
    if (wrap) wrap.style.display = sel.value === 'other' ? 'block' : 'none';
  });
});

/* ─── SCROLL REVEAL ──────────────────────────── */
const revealIO = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add('visible'); revealIO.unobserve(e.target); }
  });
}, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
/* render.js builds course/blog-preview/testimonial cards from an async
   Supabase fetch, so they land in the DOM after this script's initial
   synchronous sweep — without re-running this, those .reveal elements
   would never get observed and would sit at opacity:0 forever. Marked
   with data-reveal-bound so re-running this is always safe to call again. */
function cfpObserveReveals() {
  document.querySelectorAll('.reveal').forEach(el => {
    if (el.dataset.revealBound) return;
    el.dataset.revealBound = '1';
    revealIO.observe(el);
  });
}
cfpObserveReveals();
window.cfpObserveReveals = cfpObserveReveals;

/* ─── COUNTER ANIMATION ──────────────────────── */
const counterIO = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (!entry.isIntersecting) return;
    entry.target.querySelectorAll('[data-target]').forEach(el => {
      const target  = parseFloat(el.dataset.target);
      const prefix  = el.dataset.prefix  || '';
      const suffix  = el.dataset.suffix  || '';
      const isFloat = target % 1 !== 0;
      const dur     = 2000;
      const start   = performance.now();
      function tick(now) {
        const p = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = prefix + (isFloat ? (eased*target).toFixed(1) : Math.floor(eased*target).toLocaleString('en-IN')) + suffix;
        if (p < 1) requestAnimationFrame(tick);
      }
      requestAnimationFrame(tick);
    });
    counterIO.unobserve(entry.target);
  });
}, { threshold: 0.4 });
const statsSection = document.getElementById('stats');
if (statsSection) counterIO.observe(statsSection);

/* ─── CONTACT FORM ───────────────────────────── */
const contactForm    = document.getElementById('contact-form');
const contactSuccess = document.getElementById('contact-success');
if (contactForm) {
  contactForm.addEventListener('submit', e => {
    e.preventDefault();
    let valid = true;
    ['c-name','c-email'].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const bad = !el.value.trim() || (id==='c-email' && !el.value.includes('@'));
      el.style.borderColor = bad ? '#ef4444' : '';
      el.style.boxShadow   = bad ? '0 0 0 3px rgba(239,68,68,0.12)' : '';
      if (bad) valid = false;
    });
    if (!valid) return;
    if (typeof cfpRecordSubmission === 'function') {
      cfpRecordSubmission({
        type: 'contact',
        name: document.getElementById('c-name')?.value.trim() || '',
        email: document.getElementById('c-email')?.value.trim() || '',
        phone: document.getElementById('c-phone')?.value.trim() || '',
        experience: '',
        message: document.getElementById('c-message')?.value.trim() || ''
      });
    }
    contactForm.style.display = 'none';
    if (contactSuccess) contactSuccess.classList.add('show');
  });
}

/* ─── SHAKE ANIMATION ────────────────────────── */
const shakeCSS = document.createElement('style');
shakeCSS.textContent = `
  @keyframes shake {
    0%,100%{transform:translateX(0)} 20%{transform:translateX(-6px)}
    40%{transform:translateX(6px)}   60%{transform:translateX(-4px)}
    80%{transform:translateX(4px)}
  }
`;
document.head.appendChild(shakeCSS);

/* ─── HERO LOAD REVEAL ───────────────────────── */
window.addEventListener('load', () => {
  setTimeout(() => {
    document.querySelectorAll('#hero .reveal').forEach((el, i) => {
      setTimeout(() => el.classList.add('visible'), i * 150);
    });
  }, 300);
});
