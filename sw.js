/* Offline support for Cholo Puran Dhaka.
   - Pages and places.json: network first (fresh when online), saved copy when offline or slow.
   - three.js from the CDN: saved once, the URL is versioned.
   - App files, icons, preview images, fonts: served from the saved copy, refreshed in the background.
   - Street-map tiles: the ones you have looked at are kept (up to MAX_TILES) so the map still works offline. */

const V = 'v8';
const CORE = `cpd-core-${V}`, RUN = `cpd-run-${V}`, CDN = 'cpd-cdn-1', TILES = 'cpd-tiles-1';
const MAX_TILES = 600, NET_TIMEOUT = 4000;
const THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';

const CORE_FILES = [
  './', 'index.html', 'places.json', 'manifest.webmanifest', 'docs/logo.svg', 'docs/profile.jpg',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png', 'place/', 'history/',
  'vendor/es-module-shims.js', 'vendor/leaflet/leaflet.js', 'vendor/leaflet/leaflet.css', 'vendor/leaflet/leaflet.markercluster.js', 'vendor/leaflet/MarkerCluster.css'
];
const CDN_FILES = [
  `${THREE}build/three.module.js`, `${THREE}examples/jsm/controls/OrbitControls.js`, `${THREE}examples/jsm/utils/BufferGeometryUtils.js`
];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    await (await caches.open(CORE)).addAll(CORE_FILES);
    // The CDN files are big and not essential to install; save what we can.
    const cdn = await caches.open(CDN);
    await Promise.allSettled(CDN_FILES.map(async u => { if (!(await cdn.match(u))) await cdn.add(new Request(u, { mode: 'cors' })); }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keep = [CORE, RUN, CDN, TILES];
    for (const k of await caches.keys()) if (k.startsWith('cpd-') && !keep.includes(k)) await caches.delete(k);
    await self.clients.claim();
  })());
});

const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const net = fetch(req).then(r => { if (r.ok) cache.put(req, r.clone()); return r; });
  try { return await timeout(net, NET_TIMEOUT); }
  catch {
    const hit = await cache.match(req, { ignoreSearch: true }) || await caches.match(req, { ignoreSearch: true });
    if (hit) return hit;
    try { return await net; } catch {}
    if (req.mode === 'navigate') {
      // A place page that was never opened: send them to the same place inside the saved app.
      const m = new URL(req.url).pathname.match(/\/place\/([a-z0-9-]+)\/?$/);
      if (m) return Response.redirect(new URL(`./#${m[1]}`, self.registration.scope).href, 302);
      return (await caches.match('index.html')) || Response.error();
    }
    return Response.error();
  }
}

async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req) || await caches.match(req);
  const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') cache.put(req, r.clone()); return r; }).catch(() => null);
  return hit || (await net) || Response.error();
}

async function cacheFirst(req, cacheName, max) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const r = await fetch(req);
  if (r.ok) {
    await cache.put(req, r.clone());
    if (max) {
      const keys = await cache.keys();
      for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]); // oldest first
    }
  }
  return r;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const u = new URL(req.url);

  if (u.origin === location.origin) {
    if (req.mode === 'navigate' || u.pathname.endsWith('/places.json')) { e.respondWith(networkFirst(req, RUN)); return; }
    if (u.pathname.endsWith('/sw.js')) return;
    e.respondWith(staleWhileRevalidate(req, RUN));
    return;
  }
  if (u.href.startsWith(THREE)) { e.respondWith(cacheFirst(req, CDN)); return; }
  if (u.hostname === 'tile.openstreetmap.org') { e.respondWith(cacheFirst(req, TILES, MAX_TILES).catch(() => Response.error())); return; }
  if (u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com') { e.respondWith(staleWhileRevalidate(req, CDN)); return; }
});
