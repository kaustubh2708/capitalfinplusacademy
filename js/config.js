/* ==============================================
   Capital Finplus Academy — runtime config
   No build step on this site, so env values can't be
   injected at build time. The publishable key is meant
   to be public (Supabase protects data via RLS, not key
   secrecy) so it's safe to ship in this file.
   This uses Supabase's newer key system: the publishable
   key here is the direct replacement for the old "anon"
   key. NEVER put the secret key here — that's the new
   replacement for "service_role", and it stays server-side
   only, in Vercel's environment variables.
   ============================================== */
window.SUPABASE_URL = 'https://zzqjylcftdzsfesupldn.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_criWDD8OU2lRyeMXH-Cwdg_gwpC3bXz';
