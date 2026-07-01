/* ==============================================
   Capital Finplus Academy — auth-modal.js
   Minimal signup / login / reset-password dialog,
   built and injected into the page at runtime (no
   markup changes needed in the host HTML beyond a
   <script src="auth-modal.js"> tag and a trigger that
   calls window.cfpOpenAuthModal()). Uses a native
   <dialog> element, no external UI library. Styled
   inline to match the site's dark theme.
   Depends on window.cfpAuth (see auth.js).
   ============================================== */
(function () {
  let dialogEl = null;

  function fieldStyle() {
    return 'width:100%;margin-bottom:0.6rem;padding:0.65rem 0.8rem;background:#161616;border:1px solid #2a2a2a;border-radius:6px;color:#fff;font-size:0.88rem;font-family:inherit;';
  }
  function btnStyle() {
    return 'width:100%;padding:0.7rem;background:#e8b84b;border:none;border-radius:6px;color:#0a0a0a;font-weight:700;font-size:0.88rem;cursor:pointer;margin-bottom:0.5rem;font-family:inherit;';
  }

  function ensureDialog() {
    if (dialogEl) return dialogEl;
    dialogEl = document.createElement('dialog');
    dialogEl.id = 'cfp-auth-dialog';
    dialogEl.style.cssText = 'border:1px solid #e8b84b;border-radius:10px;background:#0a0a0a;color:#fff;padding:0;max-width:380px;width:90vw;';
    dialogEl.innerHTML = `
      <div style="padding:1.75rem;font-family:inherit;position:relative;">
        <button type="button" id="cfp-auth-close" aria-label="Close"
          style="position:absolute;top:0.9rem;right:1rem;background:none;border:none;color:#888;font-size:1.1rem;cursor:pointer;line-height:1;">✕</button>
        <div id="cfp-auth-tabs" style="display:flex;gap:1.25rem;margin-bottom:1.25rem;">
          <button type="button" data-view="login" style="background:none;border:none;color:#e8b84b;font-weight:700;cursor:pointer;padding:0;font-size:0.92rem;font-family:inherit;">Log In</button>
          <button type="button" data-view="signup" style="background:none;border:none;color:#888;font-weight:700;cursor:pointer;padding:0;font-size:0.92rem;font-family:inherit;">Sign Up</button>
        </div>
        <div id="cfp-auth-error" style="display:none;color:#ef4444;font-size:0.8rem;margin-bottom:0.75rem;"></div>
        <div id="cfp-auth-success" style="display:none;color:#4ade80;font-size:0.8rem;margin-bottom:0.75rem;"></div>

        <div id="cfp-auth-view-login">
          <input id="cfp-login-email" type="email" placeholder="Email" autocomplete="email" style="${fieldStyle()}" />
          <input id="cfp-login-password" type="password" placeholder="Password" autocomplete="current-password" style="${fieldStyle()}" />
          <button type="button" id="cfp-login-submit" style="${btnStyle()}">Log In</button>
          <button type="button" id="cfp-login-forgot" style="width:100%;background:none;border:none;color:#888;font-size:0.76rem;cursor:pointer;padding:0.25rem;font-family:inherit;">Forgot password?</button>
        </div>

        <div id="cfp-auth-view-signup" style="display:none;">
          <input id="cfp-signup-name" type="text" placeholder="Full name" autocomplete="name" style="${fieldStyle()}" />
          <input id="cfp-signup-phone" type="tel" placeholder="Phone (optional)" autocomplete="tel" style="${fieldStyle()}" />
          <input id="cfp-signup-email" type="email" placeholder="Email" autocomplete="email" style="${fieldStyle()}" />
          <input id="cfp-signup-password" type="password" placeholder="Password (min 6 characters)" autocomplete="new-password" style="${fieldStyle()}" />
          <button type="button" id="cfp-signup-submit" style="${btnStyle()}">Sign Up</button>
        </div>

        <div id="cfp-auth-view-reset" style="display:none;">
          <input id="cfp-reset-email" type="email" placeholder="Email" autocomplete="email" style="${fieldStyle()}" />
          <button type="button" id="cfp-reset-submit" style="${btnStyle()}">Send Reset Link</button>
        </div>
      </div>
    `;
    document.body.appendChild(dialogEl);
    wire();
    return dialogEl;
  }

  function setView(view) {
    dialogEl.querySelector('#cfp-auth-view-login').style.display = view === 'login' ? 'block' : 'none';
    dialogEl.querySelector('#cfp-auth-view-signup').style.display = view === 'signup' ? 'block' : 'none';
    dialogEl.querySelector('#cfp-auth-view-reset').style.display = view === 'reset' ? 'block' : 'none';
    dialogEl.querySelectorAll('#cfp-auth-tabs button').forEach(b => {
      b.style.color = b.dataset.view === view ? '#e8b84b' : '#888';
    });
    showError('');
    showSuccess('');
  }

  function showError(msg) {
    const el = dialogEl.querySelector('#cfp-auth-error');
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }
  function showSuccess(msg) {
    const el = dialogEl.querySelector('#cfp-auth-success');
    el.textContent = msg || '';
    el.style.display = msg ? 'block' : 'none';
  }

  function wire() {
    dialogEl.querySelector('#cfp-auth-close').addEventListener('click', () => dialogEl.close());
    dialogEl.addEventListener('click', e => { if (e.target === dialogEl) dialogEl.close(); });
    dialogEl.querySelectorAll('#cfp-auth-tabs button').forEach(b => {
      b.addEventListener('click', () => setView(b.dataset.view));
    });
    dialogEl.querySelector('#cfp-login-forgot').addEventListener('click', () => setView('reset'));

    dialogEl.querySelector('#cfp-login-submit').addEventListener('click', async () => {
      const email = dialogEl.querySelector('#cfp-login-email').value.trim();
      const password = dialogEl.querySelector('#cfp-login-password').value;
      if (!email || !password) return showError('Enter your email and password.');
      try {
        await window.cfpAuth.login(email, password);
        showSuccess('Logged in — reloading…');
        setTimeout(() => window.location.reload(), 600);
      } catch (e) {
        showError(e.message || 'Login failed.');
      }
    });

    dialogEl.querySelector('#cfp-signup-submit').addEventListener('click', async () => {
      const name = dialogEl.querySelector('#cfp-signup-name').value.trim();
      const phone = dialogEl.querySelector('#cfp-signup-phone').value.trim();
      const email = dialogEl.querySelector('#cfp-signup-email').value.trim();
      const password = dialogEl.querySelector('#cfp-signup-password').value;
      if (!email || !password) return showError('Email and password are required.');
      if (password.length < 6) return showError('Password must be at least 6 characters.');
      try {
        await window.cfpAuth.signup(email, password, name, phone);
        showSuccess('Account created! Check your email to confirm, then log in.');
      } catch (e) {
        showError(e.message || 'Sign up failed.');
      }
    });

    dialogEl.querySelector('#cfp-reset-submit').addEventListener('click', async () => {
      const email = dialogEl.querySelector('#cfp-reset-email').value.trim();
      if (!email) return showError('Enter your email.');
      try {
        await window.cfpAuth.resetPassword(email);
        showSuccess('Reset link sent — check your email.');
      } catch (e) {
        showError(e.message || 'Could not send reset link.');
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
