// ============================================================
//  FAMILIA CHAT — sw.js  (v5: notificaciones + badge de no leídos)
//  Reemplaza tu sw.js por este.
// ============================================================
const CACHE = 'familia-chat-v5';
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
  if (e.request.url.includes('supabase.co')) return;
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// === Recibir push personalizado ===
self.addEventListener('push', e => {
  let data = { title: 'Familia Chat', body: 'Nuevo mensaje' };
  try { data = e.data.json(); } catch {}

  const acciones = (async () => {
    // Badge: número real de no leídos que mandó la Edge Function
    try {
      if (typeof data.badge === 'number' && self.registration.setAppBadge) {
        if (data.badge > 0) await self.registration.setAppBadge(data.badge);
        else if (self.registration.clearAppBadge) await self.registration.clearAppBadge();
      }
    } catch (_) {}

    await self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || 'icon-192.png',
      badge: 'badge-96.png',
      vibrate: [200, 100, 200],
      tag: data.senderId || 'familia',
      renotify: true,
      data: {
        senderId: data.senderId || null,
        senderName: data.senderName || null,
        url: './index.html'
      }
    });
  })();

  e.waitUntil(acciones);
});

// === Al tocar: abrir la app y, si se puede, ese chat ===
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const senderId = e.notification.data?.senderId;
  const senderName = e.notification.data?.senderName;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if ('focus' in c) {
          c.focus();
          if (senderId) c.postMessage({ type: 'open-chat', senderId, senderName });
          return;
        }
      }
      const url = senderId
        ? `./index.html?chat=${senderId}&name=${encodeURIComponent(senderName || '')}`
        : './index.html';
      return clients.openWindow(url);
    })
  );
});
