// ============================================================
//  FAMILIA CHAT — sw.js  (notificaciones personalizadas)
//  Caché v4. Reemplaza tu sw.js por este.
// ============================================================
const CACHE = 'familia-chat-v6';
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

  e.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: data.icon || 'icon-192.png',
      badge: 'badge-96.png',
      vibrate: [200, 100, 200],          // patrón de vibración
      tag: data.senderId || 'familia',   // agrupa por remitente
      renotify: true,                    // vibra aunque ya haya una del mismo tag
      data: {
        senderId: data.senderId || null,
        senderName: data.senderName || null,
        url: './index.html'
      }
    })
  );
});

// === Al tocar: abrir la app y, si se puede, ese chat ===
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const senderId = e.notification.data?.senderId;
  const senderName = e.notification.data?.senderName;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      // Si la app ya está abierta, enfócala y dile qué chat abrir
      for (const c of list) {
        if ('focus' in c) {
          c.focus();
          if (senderId) c.postMessage({ type: 'open-chat', senderId, senderName });
          return;
        }
      }
      // Si no está abierta, ábrela con el chat en la URL
      const url = senderId
        ? `./index.html?chat=${senderId}&name=${encodeURIComponent(senderName || '')}`
        : './index.html';
      return clients.openWindow(url);
    })
  );
});
