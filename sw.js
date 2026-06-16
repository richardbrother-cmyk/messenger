const CACHE = 'familia-chat-v4';
const ASSETS = ['./index.html', './styles.css', './app.js', './manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ));
});

self.addEventListener('fetch', e => {
  if (e.request.url.includes('supabase.co')) return; // no cachear API
  e.respondWith(
    fetch(e.request).catch(() => caches.match(e.request))
  );
});
