const CACHE_NAME = 'frosh-music-shell-v3';
const THUMB_CACHE = 'frosh-thumb-cache-v1';
const MAX_THUMBS = 150;
const APP_SHELL = ['/', '/library', '/search', '/stats', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter(
            (key) =>
              key !== CACHE_NAME &&
              key !== THUMB_CACHE &&
              key !== 'frosh-offline-art'
          )
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never intercept audio streams or API calls; IndexedDB handles offline audio
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // External cover art thumbnails: Cache-first with cap for instant mobile scrolling
  if (
    url.hostname.endsWith('googleusercontent.com') ||
    url.hostname.endsWith('ytimg.com') ||
    url.hostname.endsWith('ggpht.com')
  ) {
    event.respondWith(
      caches.open(THUMB_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request)
            .then((res) => {
              if (res.ok || res.type === 'opaque') {
                const copy = res.clone();
                cache.keys().then((keys) => {
                  if (keys.length >= MAX_THUMBS) {
                    cache.delete(keys[0]);
                  }
                  cache.put(request, copy);
                });
              }
              return res;
            })
            .catch(() => cached);
        })
      )
    );
    return;
  }

  // Static Next.js assets & icons: cache-first
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname === '/manifest.json'
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Navigation / app pages: Stale-While-Revalidate for instant Home Screen PWA launch
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((res) => {
              if (res.ok && !res.redirected && !url.pathname.startsWith('/login') && !url.pathname.startsWith('/signup')) {
                cache.put(request, res.clone());
              }
              return res;
            })
            .catch(() => cached || cache.match('/'));

          return cached || networkFetch;
        })
      )
    );
  }
});
