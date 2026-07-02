/* Capital Finplus Academy — Service Worker
   Minimal SW required for PWA installability.
   No aggressive caching — Supabase auth requires fresh network requests. */

const CACHE = 'cfp-shell-v1';
const SHELL = [
  '/',
  '/pages/account.html',
  '/css/styles.css',
  '/js/data.js',
  '/js/config.js',
  '/js/auth.js',
  '/js/premium-gate.js',
  '/js/auth-modal.js',
  '/favicon.svg',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* Network-first: always try network, fall back to cache for shell assets */
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  /* Skip non-GET, cross-origin (Supabase/Resend/etc), and API routes */
  if (e.request.method !== 'GET' || url.origin !== location.origin || url.pathname.startsWith('/api/')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});
