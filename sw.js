/* InAble — Service Worker
 * Minimal SW: enables PWA installability without aggressive caching.
 * API calls always go to the network; no coaching responses are cached.
 */
var CACHE_NAME = 'inable-shell-v2';
var SHELL_ASSETS = [
  '/',
  '/index.html'
];
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(SHELL_ASSETS).catch(function() {});
    })
  );
  self.skipWaiting();
});
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(keys) {
      return Promise.all(
        keys.filter(function(k) { return k !== CACHE_NAME; })
            .map(function(k) { return caches.delete(k); })
      );
    })
  );
  self.clients.claim();
});
self.addEventListener('fetch', function(e) {
  var url = e.request.url;
  if (
    url.indexOf('api.anthropic.com') !== -1 ||
    url.indexOf('buy.stripe.com') !== -1 ||
    url.indexOf('cdn.jsdelivr.net') !== -1 ||
    url.indexOf('fonts.googleapis.com') !== -1 ||
    url.indexOf('fonts.gstatic.com') !== -1
  ) {
    return;
  }
  // Never serve the HTML shell from cache, including bare "/" —
  // always hit the network so deploys (like footer/link changes)
  // show up immediately instead of being stuck on the first-install snapshot.
  var path = url.replace(self.location.origin, '');
  if (path === '/' || path === '' || path.indexOf('.html') !== -1) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(function(cached) {
      return cached || fetch(e.request);
    })
  );
});
