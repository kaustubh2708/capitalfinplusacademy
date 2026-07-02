/* ==============================================
   Capital Finplus Academy — auth-modal.js
   Signup / login / reset-password dialog injected
   at runtime. Depends on window.cfpAuth (auth.js).
   ============================================== */
(function () {
  let dialogEl = null;

  const FIELD = 'width:100%;box-sizing:border-box;padding:0.7rem 0.85rem;background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.1);border-radius:8px;color:#f0ead6;font-size:0.875rem;font-family:inherit;outline:none;transition:border-color 0.15s;margin-bottom:0.6rem;display:block;';
  const BTN   = 'width:100%;padding:0.75rem;background:linear-gradient(135deg,#F4C20D,#d4a80a);border:none;border-radius:8px;color:#0a0701;font-weight:800;font-size:0.88rem;cursor:pointer;font-family:inherit;letter-spacing:0.02em;transition:opacity 0.15s,transform 0.1s;';

  const LOGO_SVG = `<svg width="28" height="30" viewBox="0 0 40 42" fill="none" xmlns="http://www.w3.org/2000/svg">
    <polygon points="20,39 3.8,27.2 10,7.5 30,7.5 36.2,27.2" fill="rgba(244,194,13,0.12)" stroke="#F4C20D" stroke-width="2.5" stroke-linejoin="round"/>
  </svg>`;

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = document.createElement('dialog');
    dialogEl.id = 'cfp-auth-dialog';
    /* position/inset/margin restores native <dialog> centering overridden
       by the site's global margin:0 reset. cursor:auto overrides the
       site-wide cursor:none so the pointer is visible in the top layer. */
    dialogEl.style.cssText = [
      'border:1px solid rgba(244,194,13,0.25)',
      'border-radius:14px',
      'background:#0d0a02',
      'color:#f0ead6',
      'padding:0',
      'max-width:400px',
      'width:92vw',
      'position:fixed',
      'inset:0',
      'margin:auto',
      'cursor:auto',
      'box-shadow:0 24px 64px rgba(0,0,0,0.7),0 0 0 1px rgba(244,194,13,0.08)',
      'overflow:hidden'
    ].join(';');

    dialogEl.innerHTML = `
      <div style="height:3px;background:linear-gradient(90deg,#F4C20D,rgba(244,194,13,0.2));"></div>
      <div style="padding:1.6rem 1.75rem 1.75rem;font-family:inherit;position:relative;">

        <button type="button" id="cfp-auth-close" aria-label="Close"
          style="position:absolute;top:1rem;right:1.1rem;background:none;border:none;color:rgba(240,234,214,0.35);font-size:1rem;cursor:pointer;line-height:1;padding:4px;border-radius:4px;transition:color 0.15s;">✕</button>

        <div style="display:flex;align-items:center;gap:0.65rem;margin-bottom:1.4rem;">
          ${LOGO_SVG}
          <span style="font-size:0.72rem;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:rgba(244,194,13,0.7);">CFA Academy</span>
        </div>

        <div id="cfp-auth-tabs" style="display:flex;gap:0;margin-bottom:1.4rem;border-bottom:1px solid rgba(255,255,255,0.07);">
          <button type="button" data-view="login"
            style="background:none;border:none;border-bottom:2px solid #F4C20D;color:#F4C20D;font-weight:700;cursor:pointer;padding:0 0 0.6rem;font-size:0.88rem;font-family:inherit;margin-right:1.5rem;transition:color 0.15s;">Log In</button>
          <button type="button" data-view="signup"
            style="background:none;border:none;border-bottom:2px solid transparent;color:rgba(240,234,214,0.4);font-weight:700;cursor:pointer;padding:0 0 0.6rem;font-size:0.88rem;font-family:inherit;transition:color 0.15s;">Sign Up</button>
        </div>

        <div id="cfp-auth-error" style="display:none;"></div>
        <div id="cfp-auth-success" style="display:none;"></div>

        <div id="cfp-auth-view-login">
          <input id="cfp-login-email" type="email" placeholder="Email address" autocomplete="email" style="${FIELD}" />
          <input id="cfp-login-password" type="password" placeholder="Password" autocomplete="current-password" style="${FIELD}margin-bottom:0.9rem;" />
          <button type="button" id="cfp-login-submit" style="${BTN}margin-bottom:0.75rem;">Log In</button>
          <button type="button" id="cfp-login-forgot"
            style="width:100%;background:none;border:none;color:rgba(240,234,214,0.4);font-size:0.76rem;cursor:pointer;padding:0.2rem;font-family:inherit;text-align:center;transition:color 0.15s;">Forgot password?</button>
        </div>

        <div id="cfp-auth-view-signup" style="display:none;">
          <input id="cfp-signup-name" type="text" placeholder="Full name" autocomplete="name" style="${FIELD}" />
          <input id="cfp-signup-phone" type="tel" placeholder="Phone (optional)" autocomplete="tel" style="${FIELD}" />
          <input id="cfp-signup-email" type="email" placeholder="Email address" autocomplete="email" style="${FIELD}" />
          <input id="cfp-signup-password" type="password" placeholder="Password (min 6 characters)" autocomplete="new-password" style="${FIELD}margin-bottom:0.9rem;" />
          <button type="button" id="cfp-signup-submit" style="${BTN}">Create Account</button>
        </div>

        <div id="cfp-auth-view-reset" style="display:none;">
          <p style="font-size:0.82rem;color:rgba(240,234,214,0.5);margin:0 0 1rem;line-height:1.6;">Enter your email and we'll send you a link to reset your password.</p>
          <input id="cfp-reset-email" type="email" placeholder="Email address" autocomplete="email" style="${FIELD}margin-bottom:0.9rem;" />
          <button type="button" id="cfp-reset-submit" style="${BTN}margin-bottom:0.75rem;">Send Reset Link</button>
          <button type="button" id="cfp-back-to-login"
            style="width:100%;background:none;border:none;color:rgba(240,234,214,0.4);font-size:0.76rem;cursor:pointer;padding:0.2rem;font-family:inherit;text-align:center;transition:color 0.15s;">← Back to Log In</button>
        </div>

      </div>
    `;

    document.body.appendChild(dialogEl);

    // Field focus ring
    dialogEl.querySelectorAll('input').forEach(inp => {
      inp.addEventListener('focus',  () => { inp.style.borderColor = 'rgba(244,194,13,0.5)'; inp.style.background = 'rgba(244,194,13,0.04)'; });
      inp.addEventListener('blur',   () => { inp.style.borderColor = 'rgba(255,255,255,0.1)'; inp.style.background = 'rgba(255,255,255,0.04)'; });
    });

    // Button hover
    dialogEl.querySelectorAll('button[id$="-submit"]').forEach(btn => {
      btn.addEventListener('mouseenter', () => { btn.style.opacity = '0.88'; btn.style.transform = 'translateY(-1px)'; });
      btn.addEventListener('mouseleave', () => { btn.style.opacity = '1'; btn.style.transform = 'none'; });
    });

    wire();
    return dialogEl;
  }

  function setView(view) {
    ['login', 'signup', 'reset'].forEach(v => {
      dialogEl.querySelector(`#cfp-auth-view-${v}`).style.display = v === view ? 'block' : 'none';
    });
    dialogEl.querySelectorAll('#cfp-auth-tabs button').forEach(b => {
      const active = b.dataset.view === view;
      b.style.color = active ? '#F4C20D' : 'rgba(240,234,214,0.4)';
      b.style.borderBottomColor = active ? '#F4C20D' : 'transparent';
    });
    // reset tab buttons hidden on reset view
    dialogEl.querySelector('#cfp-auth-tabs').style.display = view === 'reset' ? 'none' : 'flex';
    clearMessages();
  }

  function clearMessages() {
    showError('');
    showSuccess('');
  }

  function showError(msg) {
    const el = dialogEl.querySelector('#cfp-auth-error');
    if (!msg) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.innerHTML = `<div style="display:flex;align-items:flex-start;gap:0.6rem;padding:0.75rem 0.9rem;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);border-radius:8px;margin-bottom:1rem;">
      <span style="font-size:0.85rem;line-height:1;margin-top:1px;flex-shrink:0;">⚠️</span>
      <span style="font-size:0.81rem;line-height:1.5;color:rgba(252,165,165,0.95);">${msg}</span>
    </div>`;
    el.style.display = 'block';
  }

  function showSuccess(msg) {
    const el = dialogEl.querySelector('#cfp-auth-success');
    if (!msg) { el.style.display = 'none'; el.innerHTML = ''; return; }
    el.innerHTML = `<div style="display:flex;align-items:flex-start;gap:0.6rem;padding:0.75rem 0.9rem;background:rgba(34,197,94,0.08);border:1px solid rgba(34,197,94,0.25);border-radius:8px;margin-bottom:1rem;">
      <span style="font-size:0.85rem;line-height:1;margin-top:1px;flex-shrink:0;">✅</span>
      <span style="font-size:0.81rem;line-height:1.5;color:rgba(134,239,172,0.95);">${msg}</span>
    </div>`;
    el.style.display = 'block';
  }

  function setLoading(btn, loading, defaultLabel) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : defaultLabel;
    btn.style.opacity = loading ? '0.6' : '1';
    btn.style.cursor = loading ? 'not-allowed' : 'pointer';
  }

  function wire() {
    dialogEl.querySelector('#cfp-auth-close').addEventListener('click', () => dialogEl.close());
    dialogEl.addEventListener('click', e => { if (e.target === dialogEl) dialogEl.close(); });
    dialogEl.querySelectorAll('#cfp-auth-tabs button').forEach(b => {
      b.addEventListener('click', () => setView(b.dataset.view));
    });
    dialogEl.querySelector('#cfp-login-forgot').addEventListener('click', () => setView('reset'));
    dialogEl.querySelector('#cfp-back-to-login').addEventListener('click', () => setView('login'));

    // Enter key submits the active form
    dialogEl.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      const loginView = dialogEl.querySelector('#cfp-auth-view-login');
      const signupView = dialogEl.querySelector('#cfp-auth-view-signup');
      const resetView = dialogEl.querySelector('#cfp-auth-view-reset');
      if (loginView.style.display !== 'none') dialogEl.querySelector('#cfp-login-submit').click();
      else if (signupView.style.display !== 'none') dialogEl.querySelector('#cfp-signup-submit').click();
      else if (resetView.style.display !== 'none') dialogEl.querySelector('#cfp-reset-submit').click();
    });

    const loginBtn = dialogEl.querySelector('#cfp-login-submit');
    loginBtn.addEventListener('click', async () => {
      const email = dialogEl.querySelector('#cfp-login-email').value.trim();
      const password = dialogEl.querySelector('#cfp-login-password').value;
      if (!email || !password) return showError('Please enter your email and password.');
      clearMessages();
      setLoading(loginBtn, true, 'Log In');
      try {
        await window.cfpAuth.login(email, password);
        showSuccess('Logged in successfully — reloading…');
        setTimeout(() => window.location.reload(), 900);
      } catch (e) {
        const raw = e.message || '';
        const friendly = raw.includes('Invalid login') || raw.includes('invalid_credentials')
          ? 'Incorrect email or password. Please try again.'
          : raw.includes('Email not confirmed')
          ? 'Please confirm your email first — check your inbox.'
          : raw || 'Login failed. Please try again.';
        showError(friendly);
        setLoading(loginBtn, false, 'Log In');
      }
    });

    const signupBtn = dialogEl.querySelector('#cfp-signup-submit');
    signupBtn.addEventListener('click', async () => {
      const name     = dialogEl.querySelector('#cfp-signup-name').value.trim();
      const phone    = dialogEl.querySelector('#cfp-signup-phone').value.trim();
      const email    = dialogEl.querySelector('#cfp-signup-email').value.trim();
      const password = dialogEl.querySelector('#cfp-signup-password').value;
      if (!email || !password) return showError('Email and password are required.');
      if (password.length < 6)  return showError('Password must be at least 6 characters.');
      clearMessages();
      setLoading(signupBtn, true, 'Create Account');
      try {
        await window.cfpAuth.signup(email, password, name, phone);
        showSuccess('Account created! Check your email to confirm, then log in.');
        setLoading(signupBtn, false, 'Create Account');
      } catch (e) {
        const raw = e.message || '';
        const friendly = raw.includes('already registered') || raw.includes('already exists')
          ? 'This email is already registered. Try logging in instead.'
          : raw || 'Sign up failed. Please try again.';
        showError(friendly);
        setLoading(signupBtn, false, 'Create Account');
      }
    });

    const resetBtn = dialogEl.querySelector('#cfp-reset-submit');
    resetBtn.addEventListener('click', async () => {
      const email = dialogEl.querySelector('#cfp-reset-email').value.trim();
      if (!email) return showError('Please enter your email address.');
      clearMessages();
      setLoading(resetBtn, true, 'Send Reset Link');
      try {
        await window.cfpAuth.resetPassword(email);
        showSuccess('Reset link sent — check your inbox. It may take a minute to arrive.');
        setLoading(resetBtn, false, 'Send Reset Link');
      } catch (e) {
        showError(e.message || 'Could not send reset link. Please try again.');
        setLoading(resetBtn, false, 'Send Reset Link');
      }
    });
  }

  /* view: 'login' (default) | 'signup' | 'reset' */
  window.cfpOpenAuthModal = function (view) {
    const d = ensureDialog();
    setView(view || 'login');
    if (typeof d.showModal === 'function') d.showModal();
    else d.setAttribute('open', '');
  };
})();
