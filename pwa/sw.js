const SW_VERSION = 'statux-sw-v2';

const SHELL_CACHE = 'statux-shell-v2';
const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/styles.css',
  '/home.css',
  '/home.html',
  '/home.js',
  '/script.js',
  '/dashboard-loader.js',
  '/Dashboard/dashboard.html',
  '/Dashboard/dashboard.css',
  '/Dashboard/dashboard.js',
  '/Systux core/core.js',
  '/Systux core/core.css',
  '/data/cards.json',
  '/data/home-novedades.json',
  '/pwa/manifest.json',
  '/pwa/offline.html',
  '/pwa/modules.json',
  '/Ubuntu-Regular.woff2',
  '/Ubuntu-Regular.woff',
  '/Ubuntu-Bold.woff2',
  '/Ubuntu-Medium.woff2',
  '/Ubuntu-Light.woff2',
  '/Statux-logo(SVG).svg',
  '/Statux-Logo.png',
  '/Statux-logo(64px).png',
  '/Home.svg',
  '/Usuario.svg',
  '/Login.svg',
  '/Logout.svg',
  '/search.svg',
  '/Ebootux.svg',
  '/Plantitux.svg',
  '/Getux.svg',
  '/Movitux.svg',
  '/Mindtux.svg',
  '/Soundtux.svg',
  '/Tracktux.svg',
  '/Marketux.svg',
  '/Paquetux.svg',
  '/Afiliado.svg',
  '/Empaquetux.svg',
  '/content_copy.svg',
  '/check_circle.svg',
  '/candado.svg',
  '/card.jpg',
  '/fondo.de.la.web.jpeg',
  '/icon-youtube.svg',
  '/icon-tiktok.svg',
  '/icon-pinterest.svg',
  '/icon-instagram.svg',
  '/icono-de-boton-de-ensanche-de-barra-de-navegacion.svg',
  '/visibility_24dp_777777_FILL0_wght400_GRAD0_opsz24.svg',
  '/shopping_cart_24dp_777777.svg',
  '/download_24dp_00FFFF_FILL0_wght400_GRAD0_opsz24.svg',
  '/iconos/settings_24dp_00FFFF_FILL0_wght400_GRAD0_opsz24.svg',
  '/iconos/key_24dp_00FFFF_FILL0_wght400_GRAD0_opsz24.svg',
  '/iconos/delete_24dp_FF0000_FILL0_wght400_GRAD0_opsz24.svg',
  '/iconos/refresh_24dp_00FFFF_FILL0_wght400_GRAD0_opsz24.svg',
  '/iconos/settings_accessibility_24dp_00FFFF_FILL0_wght400_GRAD0_opsz24.svg',
  '/iconos/support_24dp_00FFFF_FILL0_wght400_GRAD0_opsz24.svg',
  '/favicoin.ico',
];

const DATA_CACHE = 'statux-data-v2';
const SYSTUX_CACHE = 'statux-modules';


// ════════════════════════════════════════════
// INSTALL
// ════════════════════════════════════════════
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn(`[SW] No se pudo cachear: ${url}`, err);
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});


// ════════════════════════════════════════════
// ACTIVATE
// ════════════════════════════════════════════
self.addEventListener('activate', (event) => {
  const VALID_CACHES = [SHELL_CACHE, DATA_CACHE, SYSTUX_CACHE];

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => !VALID_CACHES.includes(name))
          .map((name) => {
            console.log(`[SW] Borrando cache viejo: ${name}`);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
  );
});


// ════════════════════════════════════════════
// FETCH
// ════════════════════════════════════════════
const OFFLINE_URL = '/pwa/offline.html';
const IMAGE_FALLBACK = '/Statux-logo(SVG).svg';

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.headers.get('accept')?.includes('text/html');
}

function cacheNameFor(request) {
  const accept = request.headers.get('accept') || '';
  if (request.url.includes('/data/') || accept.includes('application/json')) return DATA_CACHE;
  return SHELL_CACHE;
}

function putInCache(cacheName, request, response) {
  if (!response || response.status !== 200 || response.type === 'opaque') return Promise.resolve();
  return caches.open(cacheName).then((cache) => cache.put(request, response.clone()));
}

async function networkFirst(request) {
  const cacheName = cacheNameFor(request);
  try {
    const networkResponse = await fetch(request);
    await putInCache(cacheName, request, networkResponse);
    return networkResponse;
  } catch (error) {
    const cachedResponse = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
    if (cachedResponse) return cachedResponse;
    if (isNavigationRequest(request)) {
      return caches.match('/index.html', { ignoreVary: true }) || caches.match(OFFLINE_URL, { ignoreVary: true });
    }
    if ((request.headers.get('accept') || '').includes('image/')) {
      return caches.match(IMAGE_FALLBACK, { ignoreVary: true });
    }
    return caches.match(OFFLINE_URL, { ignoreVary: true }) || Response.error();
  }
}

async function cacheFirstWithRefresh(event) {
  const { request } = event;
  const cachedResponse = await caches.match(request, { ignoreSearch: true, ignoreVary: true });
  const cacheName = cacheNameFor(request);

  const refresh = fetch(request)
    .then((networkResponse) => putInCache(cacheName, request, networkResponse).then(() => networkResponse))
    .catch(() => null);

  if (cachedResponse) {
    event.waitUntil(refresh);
    return cachedResponse;
  }

  const networkResponse = await refresh;
  if (networkResponse) return networkResponse;

  if (isNavigationRequest(request)) return caches.match('/index.html', { ignoreVary: true }) || caches.match(OFFLINE_URL, { ignoreVary: true });
  if ((request.headers.get('accept') || '').includes('image/')) return caches.match(IMAGE_FALLBACK, { ignoreVary: true });
  return caches.match(OFFLINE_URL, { ignoreVary: true }) || Response.error();
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  const EXTERNAL_NETWORK_ONLY = [
    'clarity.ms',
    'firebaseapp.com',
    'googleapis.com',
    'gstatic.com',
    'gumroad.com',
    'unsplash.com',
  ];

  if (url.origin !== self.location.origin) {
    if (EXTERNAL_NETWORK_ONLY.some((domain) => url.hostname.includes(domain))) return;
    event.respondWith(networkFirst(request));
    return;
  }

  if (url.pathname.includes('/data/') || request.headers.get('accept')?.includes('application/json')) {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(cacheFirstWithRefresh(event));
});

// ════════════════════════════════════════════
// MESSAGE
// ════════════════════════════════════════════
self.addEventListener('message', (event) => {
  const { type, payload } = event.data || {};

  if (type === 'SKIP_WAITING') {
    self.skipWaiting();
    return;
  }

  const reply = (message) => {
    if (event.ports?.[0]) event.ports[0].postMessage(message);
    else event.source?.postMessage(message);
  };

  if (type === 'GET_VERSION') {
    reply({ type: 'SW_VERSION', version: SW_VERSION });
    return;
  }

  if (type === 'CLEAR_CACHE' && payload?.cacheName) {
    caches.delete(payload.cacheName).then((deleted) => {
      reply({
        type: 'CACHE_CLEARED',
        cacheName: payload.cacheName,
        deleted
      });
    });
    return;
  }

  if (type === 'GET_CACHE_INFO') {
    caches.keys().then(async (cacheNames) => {
      const info = await Promise.all(
        cacheNames.map(async (name) => {
          const cache = await caches.open(name);
          const keys = await cache.keys();
          return { name, count: keys.length };
        })
      );
      reply({ type: 'CACHE_INFO', caches: info });
    });
    return;
  }
});
