/* ==============================================
   Capital Finplus Academy — auth.js
   Thin wrapper around Supabase Auth. Depends on
   window.cfpSupabase (see supabase-client.js) being
   loaded first. Exposes window.cfpAuth.
   ============================================== */
(function () {
  function client() {
    if (!window.cfpSupabase) throw new Error('Supabase client not initialised — load supabase-client.js first');
    return window.cfpSupabase;
  }

  async function signup(email, password, fullName, phone) {
    const { data, error } = await client().auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName || '', phone: phone || '' } }
    });
    if (error) throw error;
    return data;
  }

  async function login(email, password) {
    const { data, error } = await client().auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function logout() {
    const { error } = await client().auth.signOut();
    if (error) throw error;
  }

  /* Returns the current user object, or null if not logged in. */
  async function getCurrentUser() {
    const { data: { session } } = await client().auth.getSession();
    return session?.user ?? null;
  }

  /* callback(event, session) — event is e.g. 'SIGNED_IN' / 'SIGNED_OUT'.
     Returns the subscription so the caller can unsubscribe() if needed. */
  function onAuthStateChange(callback) {
    const { data } = client().auth.onAuthStateChange((event, session) => {
      callback(event, session);
    });
    return data.subscription;
  }

  async function resetPassword(email) {
    const { error } = await client().auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/pages/account.html'
    });
    if (error) throw error;
  }

  /* Called after landing on account.html via a Supabase invite/recovery
     link (PASSWORD_RECOVERY event — see account.html) to set the user's
     first/new password. Supabase already has them in a temporary
     authenticated session at that point from the link itself. */
  async function setNewPassword(password) {
    const { error } = await client().auth.updateUser({ password });
    if (error) throw error;
  }

  window.cfpAuth = { signup, login, logout, getCurrentUser, onAuthStateChange, resetPassword, setNewPassword };
})();
