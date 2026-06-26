// ============================================================
//  FAMILIA CHAT — sw.js  (v8: app.js siempre de la red, sin caché viejo)
//  Reemplaza tu sw.js por este.
// ============================================================
const CACHE = 'familia-chat-v9';
// Solo cacheamos lo estático que casi no cambia. El CÓDIGO (app.js, styles.css,
// index.html) NO se precachea: siempre se baja fresco de la red, para evitar
// que el service worker sirva versiones viejas.
const ASSETS = ['./manifest.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('supabase.co')) return;
  // El código de la app SIEMPRE de la red (nunca caché), para que no quede viejo.
  if (url.includes('app.js') || url.includes('styles.css') || url.endsWith('/') || url.includes('index.html')) {
    e.respondWith(fetch(e.request, { cache: 'no-store' }).catch(() => caches.match(e.request)));
    return;
  }
  // El resto: red primero, caché de respaldo.
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

// === Recibir push personalizado ===
self.addEventListener('push', e => {
  let data = { title: 'Familia Chat', body: 'Nuevo mensaje' };
  try { data = e.data.json(); } catch {}

  // --- Llamada entrante: notificación especial ---
  if (data.isCall) {
    e.waitUntil(
      self.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || 'icon-192.png',
        badge: 'badge-96.png',
        vibrate: [300, 100, 300, 100, 300],
        tag: 'llamada-' + data.callerId,
        renotify: true,
        requireInteraction: true,   // se queda hasta que el usuario actúe
        data: {
          isCall: true,
          callerId: data.callerId,
          callerName: data.callerName,
          kind: data.kind,
          url: `./index.html?call=${data.callerId}&name=${encodeURIComponent(data.callerName || '')}&kind=${data.kind || 'audio'}`
        }
      })
    );
    return;
  }

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

// === Al tocar: abrir la app y, si se puede, ese chat o llamada ===
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const d = e.notification.data || {};

  // Llamada entrante
  if (d.isCall) {
    e.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
        for (const c of list) {
          if ('focus' in c) {
            c.focus();
            c.postMessage({ type: 'incoming-call', callerId: d.callerId, callerName: d.callerName, kind: d.kind });
            return;
          }
        }
        // app cerrada: abrir con parámetros de llamada en la URL
        const callUrl = `./index.html?incomingCall=1&callerId=${encodeURIComponent(d.callerId || '')}&callerName=${encodeURIComponent(d.callerName || '')}&kind=${encodeURIComponent(d.kind || 'audio')}`;
        return clients.openWindow(callUrl);
      })
    );
    return;
  }

  const senderId = d.senderId;
  const senderName = d.senderName;
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
