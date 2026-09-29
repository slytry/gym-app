const CACHE_PREFIX = 'gym-log-pwa-';
const CACHE_NAME = `${CACHE_PREFIX}v14`;
const APP_SHELL = [
  './',
  './index.html',
  './styles.css?v=14',
  './app.js?v=14',
  './program.js?v=9',
  './state.js?v=14',
  './timer.js?v=9',
  './export.js?v=9',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './images/foot-ankle/heel-cord.webp',
  './images/foot-ankle/heel-cord-bent.webp',
  './images/foot-ankle/ball-roll.webp',
  './images/foot-ankle/towel-stretch.webp',
  './images/foot-ankle/calf-raises.webp',
  './images/foot-ankle/ankle-alphabet.webp',
  './images/foot-ankle/marble-pickup.webp',
  './images/foot-ankle/towel-curls.webp',
  './images/foot-ankle/ankle-band.webp',
  './images/foot-ankle/single-leg-balance.webp',
  './images/hands/wrist-extension.webp',
  './images/hands/wrist-flexion.webp',
  './images/hands/nerve-1.webp',
  './images/hands/nerve-2.webp',
  './images/hands/nerve-3.webp',
  './images/hands/nerve-4.webp',
  './images/hands/nerve-5.webp',
  './images/hands/nerve-6.webp',
  './images/hands/tendon-a-1.webp',
  './images/hands/tendon-a-2.webp',
  './images/hands/tendon-a-3.webp',
  './images/hands/tendon-b-1.webp',
  './images/hands/tendon-b-2.webp',
  './images/hands/tendon-b-3.webp'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((names) => Promise.all(
        names
          .filter((name) => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    fetch(request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)));
      }
      return response;
    }).catch(() => caches.match(request))
  );
});
