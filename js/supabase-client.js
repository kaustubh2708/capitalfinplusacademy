/* ==============================================
   Capital Finplus Academy — Supabase client
   Single shared client instance, used by auth.js,
   premium-gate.js, account.html and the admin
   dashboard.

   Load order required on every page that uses this:
     1. config.js                              (sets window.SUPABASE_URL / SUPABASE_ANON_KEY)
     2. https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2   (exposes window.supabase.createClient)
     3. supabase-client.js                      (this file — creates window.cfpSupabase)
   ============================================== */
(function () {
  if (typeof window.supabase === 'undefined' || typeof window.supabase.createClient !== 'function') {
    console.error('Supabase CDN script not loaded before supabase-client.js');
    return;
  }
  if (!window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
    console.error('window.SUPABASE_URL / window.SUPABASE_ANON_KEY not set — load config.js first');
    return;
  }
  /* Stored as window.cfpSupabase (not window.supabase) so we don't clobber
     the CDN's own namespace if anything else on the page references it. */
  window.cfpSupabase = window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
})();
