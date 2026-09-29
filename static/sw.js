/**
 * Daily Activity Tracker service worker.
 *
 * Strategy (local-first, offline-friendly):
 *  - App shell (navigations): network-first, fall back to the cached shell when
 *    offline. This keeps the app usable with no connection while always trying
 *    to ship the freshest HTML when online.
 *  - Static assets (same-origin GET, non-navigation): stale-while-revalidate —
 *    serve from cache immediately and refresh in the background.
 *  - Everything else (non-GET, cross-origin, sync/API): pass through untouched
 *    so we never cache data requests or interfere with a future sync backend.
 *
 * The cache name embeds a version so a new deploy replaces stale assets.
 */

const CACHE_VERSION = 'v1';
const SHELL_CACHE = `daily-activity-shell-${CACHE_VERSION}`;
const ASSET_CACHE = `daily-activity-assets-${CACHE_VERSION}`;

/** URLs pre-cached on install so a first offline visit still works. */
const PRECACHE_URLS = ['/', '/planner', '/calendar', '/focus', '/habits', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
	event.waitUntil(
		(async () => {
			const cache = await caches.open(SHELL_CACHE);
			// Best-effort: a single failing URL must not abort the whole install.
			await Promise.allSettled(PRECACHE_URLS.map((url) => cache.add(new Request(url, { cache: 'reload' }))));
			await self.skipWaiting();
		})()
	);
});

self.addEventListener('activate', (event) => {
	event.waitUntil(
		(async () => {
			const keys = await caches.keys();
			await Promise.all(
				keys
					.filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
					.map((key) => caches.delete(key))
			);
			await self.clients.claim();
		})()
	);
});

self.addEventListener('message', (event) => {
	// Allow the page to trigger an immediate update.
	if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
	const request = event.request;

	// Only handle same-origin GET requests; never touch sync/API traffic.
	if (request.method !== 'GET') return;
	const url = new URL(request.url);
	if (url.origin !== self.location.origin) return;

	if (request.mode === 'navigate') {
		event.respondWith(handleNavigation(request));
		return;
	}

	event.respondWith(handleAsset(request));
});

async function handleNavigation(request) {
	const cache = await caches.open(SHELL_CACHE);
	try {
		const response = await fetch(request);
		// Cache a copy of successful navigations for offline use.
		if (response && response.ok) cache.put(request, response.clone());
		return response;
	} catch {
		const cached = (await cache.match(request)) || (await cache.match('/'));
		if (cached) return cached;
		return new Response('Offline dan halaman belum tersimpan di cache.', {
			status: 503,
			headers: { 'Content-Type': 'text/plain; charset=utf-8' }
		});
	}
}

async function handleAsset(request) {
	const cache = await caches.open(ASSET_CACHE);
	const cached = await cache.match(request);

	const network = fetch(request)
		.then((response) => {
			// Only cache successful same-origin basic responses.
			if (response && response.ok && response.type === 'basic') {
				cache.put(request, response.clone());
			}
			return response;
		})
		.catch(() => cached);

	return cached || network;
}
