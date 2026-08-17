// KaizenLife Service Worker — App Shell Caching
// Bump CACHE_VERSION on every deploy to auto-invalidate stale caches.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `kaizenlife-${CACHE_VERSION}`;
const STATIC_ASSETS = [
  '/',
  '/favicon.svg',
  '/manifest.json',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg',
];

// Install — pre-cache app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

// Activate — delete ALL caches that don't match current version
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key)),
      ),
    ),
  );
  self.clients.claim();
});

// Helpers — only cache responses that are actually JS/CSS (not HTML fallbacks)
function isCacheableAsset(response, requestUrl) {
  const ct = response.headers.get('content-type') || '';
  if (requestUrl.pathname.startsWith('/_astro/')) {
    // Only cache JS and CSS — never cache HTML fallbacks from Cloudflare
    return ct.includes('javascript') || ct.includes('css');
  }
  return response.ok;
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET and API requests
  if (request.method !== 'GET') return;
  if (url.hostname === 'localhost') return;

  // Navigation requests: network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match('/'))),
    );
    return;
  }

  // _astro/ assets: stale-while-revalidate (never block on cache)
  if (url.pathname.startsWith('/_astro/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const fetchPromise = fetch(request).then((response) => {
          if (isCacheableAsset(response, url)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        }).catch(() => cached); // network failed → fall back to cache
        return cached || fetchPromise;
      }),
    );
    return;
  }

  // Other static assets: cache-first
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }),
  );
});
