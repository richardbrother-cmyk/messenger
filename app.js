// ============================================================
//  FAMILIA CHAT — app.js  (push + adjuntos + PERFIL + fix clic)
//  Reemplaza TODO tu app.js por este.
// ============================================================

// === CONFIG ===
const VAPID_PUBLIC = 'BFG1DmrLliLlDmMFJ7r67yJmgffaZBO5zi9ig0HSEwx41Xf6ip1lte_R9IeY9Nx-i5E3A0H2DnhACHyd3SEm9Pc';
const SUPABASE_URL = 'https://zgkcmxfwgxsvtqjteusi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2NteGZ3Z3hzdnRxanRldXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjQ3MTQsImV4cCI6MjA5NzE0MDcxNH0.icft1DynZVyDuIvyef_WxMB3qg20Pa1qYhJjWWU7qCo';
const EMAIL_DOMAIN = 'familia.local';
const MAX_FILE_BYTES = 10 * 1024 * 1024;   // 10 MB adjuntos
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;  // 2 MB avatar

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById('app');
let currentUser = null, currentProfile = null, activeChat = null, channel = null;
let pendingFile = null;
let pendingChat = null; // { id, name } chat a abrir cuando haya sesión
let activeIsGroup = false; // si la conversación abierta es un grupo
let memberNames = {};      // cache id->nombre para mostrar autores en grupos
let replyingTo = null;     // { id, preview, author } mensaje al que respondo
let msgCache = {};         // id -> mensaje (para reenviar/citar sin re-consultar)
let reactionsCache = {};   // msgId -> [{user_id, emoji}]
let modoSeleccion = false;
let seleccionados = new Set();
let listaChannel = null;   // canal de realtime para la lista de contactos

// Emojis más usados para el selector simple
const EMOJIS = ['😀','😂','🥰','😍','😘','😎','🤔','😴','😭','😡','👍','👎','👏','🙏','💪','🔥','🎉','❤️','💔','✨','⭐','🌟','💯','✅','❌','🤣','😅','😉','😊','🙂','😇','🤗','🤩','😋','😜','🤪','😏','🥺','😩','😤','👋','🤝','✌️','🤞','👌','🙌','💀','👀','💩','🥳','😱','😬','🤯','🫶','💕','💖','🎂','🍕','☕','🌹'];

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

const userToEmail = u => `${u.toLowerCase().trim()}@${EMAIL_DOMAIN}`;

// === AJUSTE DE ALTURA REAL (arregla compositor cortado / teclado) ===
// Mide la altura visible real y la expone como variable CSS --app-h.
function ajustarAltura() {
  const h = (window.visualViewport?.height) || window.innerHeight;
  document.documentElement.style.setProperty('--app-h', `${h}px`);
}
ajustarAltura();
window.addEventListener('resize', ajustarAltura);

// Al volver a primer plano, si tengo un chat abierto, marcar leídos
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') marcarLeidos();
});
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', ajustarAltura);
  window.visualViewport.addEventListener('scroll', ajustarAltura);
}

// === PUSH ===
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function setupPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') return;
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC)
      });
    }
    const { error } = await sb.from('push_subscriptions')
      .upsert({ user_id: currentUser.id, subscription: sub.toJSON() },
              { onConflict: 'user_id,subscription' });
    if (error) console.warn('No se pudo guardar la suscripción:', error);
  } catch (e) { console.warn('Push:', e); }
}

// === ABRIR CHAT DESDE NOTIFICACIÓN (robusto) ===
// Resuelve el nombre desde la BD si no viene, y reintenta hasta tener sesión.
async function abrirChatPorId(senderId, senderName) {
  if (!senderId) return;
  // espera a que haya sesión
  let intentos = 0;
  while (!currentUser && intentos < 40) { await sleep(150); intentos++; }
  if (!currentUser) { pendingChat = { id: senderId, name: senderName }; return; }
  // si no vino el nombre, búscalo
  let nombre = senderName;
  if (!nombre || nombre === 'Chat') {
    const { data } = await sb.from('profiles').select('display_name').eq('id', senderId).single();
    nombre = data?.display_name || 'Chat';
  }
  openChat(senderId, nombre);
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'open-chat' && event.data.senderId) {
      abrirChatPorId(event.data.senderId, event.data.senderName);
    }
    if (event.data?.type === 'incoming-call' && event.data.callerId) {
      // tocó la notificación de llamada: abrir el chat (la oferta llega por el inbox)
      abrirChatPorId(event.data.callerId, event.data.callerName);
    }
  });
}

function abrirChatDesdeURL() {
  const params = new URLSearchParams(location.search);
  const chatId = params.get('chat');
  const chatName = params.get('name');
  const callId = params.get('call');
  if (callId) {
    // vino desde una notificación de llamada (app estaba cerrada)
    const callName = params.get('name');
    history.replaceState({}, '', location.pathname);
    abrirChatPorId(callId, callName);
    // la oferta de llamada, si sigue activa, llegará por el inbox al suscribirse
    return;
  }
  if (!chatId) return;
  history.replaceState({}, '', location.pathname); // limpia la URL
  abrirChatPorId(chatId, chatName);
}

// === AUTH ===
async function init() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    await loadProfile();
    renderChats();
    setupPush();
    iniciarInbox();   // escuchar llamadas entrantes
    if (pendingChat) { abrirChatPorId(pendingChat.id, pendingChat.name); pendingChat = null; }
    abrirChatDesdeURL();
  } else {
    renderAuth();
  }
}

async function loadProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = data;
}

function renderAuth() {
  app.innerHTML = `
    <div class="auth">
      <h1>Familia Chat</h1>
      <input id="username" placeholder="Usuario" autocapitalize="off">
      <input id="password" type="password" placeholder="Contraseña">
      <input id="displayName" placeholder="Nombre (solo al registrarte)">
      <button id="loginBtn">Entrar</button>
      <button id="signupBtn" class="secondary">Crear usuario</button>
      <p id="msg" class="error"></p>
    </div>`;
  document.getElementById('loginBtn').onclick = login;
  document.getElementById('signupBtn').onclick = signup;
}

async function signup() {
  const u = val('username'), p = val('password'), name = val('displayName');
  if (!u || !p) return showMsg('Usuario y contraseña requeridos');
  const { data, error } = await sb.auth.signUp({ email: userToEmail(u), password: p });
  if (error) return showMsg(error.message);
  await sb.from('profiles').insert({ id: data.user.id, username: u, display_name: name || u });
  showMsg('¡Usuario creado! Ahora entra.', false);
}

async function login() {
  const u = val('username'), p = val('password');
  const { data, error } = await sb.auth.signInWithPassword({ email: userToEmail(u), password: p });
  if (error) return showMsg('Usuario o contraseña incorrectos');
  currentUser = data.user;
  await loadProfile();
  renderChats();
  setupPush();
  iniciarInbox();   // escuchar llamadas entrantes
  if (pendingChat) { abrirChatPorId(pendingChat.id, pendingChat.name); pendingChat = null; }
}

async function logout() { await sb.auth.signOut(); location.reload(); }

// === LISTA DE CONTACTOS Y GRUPOS ===
async function renderChats() {
  activeChat = null;        // ya no estoy dentro de un chat
  activeIsGroup = false;
  // Suscribe la LISTA al realtime: si llega un mensaje para mí mientras
  // estoy en la lista, recalcula los contadores sin entrar/salir.
  suscribirLista();
  const { data: profiles } = await sb.from('profiles').select('*').neq('id', currentUser.id).order('display_name');
  // grupos donde soy miembro
  const { data: myMemberships } = await sb.from('group_members').select('group_id').eq('user_id', currentUser.id);
  const groupIds = (myMemberships || []).map(m => m.group_id);
  let groups = [];
  if (groupIds.length) {
    const { data: gs } = await sb.from('groups').select('*').in('id', groupIds).order('name');
    groups = gs || [];
  }
  const myAvatar = avatarUrl(currentProfile);

  // === No leídos por contacto: mensajes hacia mí, sin leer, no borrados ===
  const unread = {};
  const { data: pendientes } = await sb.from('messages')
    .select('sender_id')
    .eq('recipient_id', currentUser.id)
    .is('read_at', null)
    .is('deleted_at', null);
  for (const row of (pendientes || [])) {
    unread[row.sender_id] = (unread[row.sender_id] || 0) + 1;
  }
  // Badge de la app = suma total de no leídos
  const totalNoLeidos = Object.values(unread).reduce((a, b) => a + b, 0);
  actualizarBadge(totalNoLeidos);

  // Ordenar contactos: primero los que tienen no leídos (más arriba), luego alfabético
  const contactos = [...(profiles || [])].sort((a, b) => {
    const ua = unread[a.id] || 0, ub = unread[b.id] || 0;
    if (ua !== ub) return ub - ua;                       // más no leídos primero
    return (a.display_name || '').localeCompare(b.display_name || '');
  });

  app.innerHTML = `
    <div class="header">
      <div class="me" id="openProfile">
        ${myAvatar
          ? `<img class="avatar-img" src="${esc(myAvatar)}" alt="yo">`
          : `<div class="avatar">${esc((currentProfile.display_name||'?')[0])}</div>`}
        <span>Hola, ${esc(currentProfile.display_name)}</span>
      </div>
      <button class="link" id="logoutBtn">Salir</button>
    </div>
    <div class="contacts">
      <div class="section-head">
        <span>Grupos</span>
        <button class="link" id="newGroupBtn" title="Crear grupo">＋</button>
      </div>
      ${groups.map(g => {
        const av = avatarUrl(g);
        return `<div class="contact group" data-gid="${g.id}" data-name="${esc(g.name)}" data-avatar="${esc(av)}">
          ${av ? `<img class="avatar-img" src="${esc(av)}" alt="">`
               : `<div class="avatar group-av">${esc((g.name||'?')[0])}</div>`}
          <span>${esc(g.name)}</span></div>`;
      }).join('') || '<p class="empty small">Sin grupos todavía.</p>'}

      <div class="section-head"><span>Contactos</span></div>
      ${contactos.map(p => {
        const av = avatarUrl(p);
        const n = unread[p.id] || 0;
        return `<div class="contact ${n ? 'has-unread' : ''}" data-id="${p.id}" data-name="${esc(p.display_name)}" data-avatar="${esc(av)}">
        ${av
          ? `<img class="avatar-img" src="${esc(av)}" alt="">`
          : `<div class="avatar">${esc((p.display_name||'?')[0])}</div>`}
        <span class="contact-name">${esc(p.display_name)}</span>
        ${n ? `<span class="unread-badge">${n > 99 ? '99+' : n}</span>` : ''}</div>`;
      }).join('') || '<p class="empty small">Aún no hay otros usuarios.</p>'}
    </div>`;

  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('openProfile').onclick = renderProfile;
  document.getElementById('newGroupBtn').onclick = renderCreateGroup;
  document.querySelectorAll('.contact:not(.group)').forEach(c =>
    c.onclick = () => openChat(c.dataset.id, c.dataset.name, c.dataset.avatar));
  document.querySelectorAll('.contact.group').forEach(c =>
    c.onclick = () => openGroup(c.dataset.gid, c.dataset.name, c.dataset.avatar));
}

// === CREAR GRUPO ===
async function renderCreateGroup() {
  const { data: profiles } = await sb.from('profiles').select('*').neq('id', currentUser.id).order('display_name');
  app.innerHTML = `
    <div class="header">
      <button class="link" id="backBtn">←</button>
      <span class="chat-title">Nuevo grupo</span>
    </div>
    <div class="profile">
      <label class="field-label">Nombre del grupo</label>
      <input id="groupName" placeholder="Ej. Familia">
      <label class="field-label">Miembros</label>
      <div class="member-list">
        ${profiles.map(p => `
          <label class="member-row">
            <input type="checkbox" class="memberChk" value="${p.id}" data-name="${esc(p.display_name)}">
            ${avatarUrl(p) ? `<img class="avatar-img sm" src="${esc(avatarUrl(p))}">`
                           : `<div class="avatar sm">${esc((p.display_name||'?')[0])}</div>`}
            <span>${esc(p.display_name)}</span>
          </label>`).join('') || '<p class="empty small">No hay otros usuarios para agregar.</p>'}
      </div>
      <button id="createGroupBtn">Crear grupo</button>
      <p id="groupMsg" class="error"></p>
    </div>`;
  document.getElementById('backBtn').onclick = renderChats;
  document.getElementById('createGroupBtn').onclick = crearGrupo;
}

async function crearGrupo() {
  const name = document.getElementById('groupName').value.trim();
  const checks = [...document.querySelectorAll('.memberChk:checked')];
  const msg = document.getElementById('groupMsg');
  if (!name) { msg.textContent = 'Ponle un nombre al grupo'; return; }
  if (checks.length === 0) { msg.textContent = 'Elige al menos un miembro'; return; }
  msg.className = 'ok'; msg.textContent = 'Creando…';
  try {
    // crear grupo
    const { data: g, error: gErr } = await sb.from('groups')
      .insert({ name, created_by: currentUser.id }).select().single();
    if (gErr) throw gErr;
    // agregar miembros (yo + seleccionados)
    const miembros = [{ group_id: g.id, user_id: currentUser.id }];
    for (const c of checks) miembros.push({ group_id: g.id, user_id: c.value });
    const { error: mErr } = await sb.from('group_members').insert(miembros);
    if (mErr) throw mErr;
    renderChats();
  } catch (err) {
    msg.className = 'error';
    msg.textContent = 'Error: ' + err.message;
  }
}

// === PANTALLA DE PERFIL ===
function renderProfile() {
  const av = avatarUrl(currentProfile);
  app.innerHTML = `
    <div class="header">
      <button class="link" id="backBtn">←</button>
      <span>Mi perfil</span>
    </div>
    <div class="profile">
      <div class="profile-avatar">
        ${av ? `<img class="avatar-lg" id="avatarPreview" src="${esc(av)}" alt="avatar">`
             : `<div class="avatar-lg placeholder" id="avatarPreview">${esc((currentProfile.display_name||'?')[0])}</div>`}
        <button class="link" id="changePhoto">Cambiar foto</button>
        <input id="avatarInput" type="file" accept="image/*" hidden>
      </div>

      <label class="field-label">Nombre</label>
      <input id="newName" value="${esc(currentProfile.display_name || '')}" placeholder="Tu nombre">
      <button id="saveName">Guardar nombre</button>

      <label class="field-label">Cambiar contraseña</label>
      <input id="newPass" type="password" placeholder="Nueva contraseña">
      <button id="savePass">Actualizar contraseña</button>

      <hr class="sep">
      <button id="deleteAccount" class="danger">Eliminar mi cuenta</button>

      <p id="profileMsg" class="ok"></p>
    </div>`;

  document.getElementById('backBtn').onclick = renderChats;
  document.getElementById('changePhoto').onclick = () => document.getElementById('avatarInput').click();
  document.getElementById('avatarInput').addEventListener('change', onAvatarPicked);
  document.getElementById('saveName').onclick = saveName;
  document.getElementById('savePass').onclick = savePassword;
  document.getElementById('deleteAccount').onclick = deleteAccount;
}

function profileMsg(t, ok = true) {
  const m = document.getElementById('profileMsg');
  if (m) { m.textContent = t; m.className = ok ? 'ok' : 'error'; }
}

async function onAvatarPicked(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return profileMsg('Debe ser una imagen', false);
  if (file.size > MAX_AVATAR_BYTES) return profileMsg('Máximo 2 MB', false);
  // En vez de subir directo, abrir el editor de recorte
  abrirEditorRecorte(file);
}

// === EDITOR DE RECORTE CIRCULAR (arrastrar + zoom slider/pinch) ===
function abrirEditorRecorte(file, onDone) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => montarEditor(img, onDone || subirAvatar);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function montarEditor(img, onDone) {
  const SIZE = 300;        // tamaño del lienzo de edición (px en pantalla)
  const OUT = 400;         // tamaño final de salida (px)

  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  overlay.innerHTML = `
    <div class="crop-box">
      <p class="crop-title">Ajusta tu foto</p>
      <div class="crop-stage" style="width:${SIZE}px;height:${SIZE}px;">
        <canvas id="cropCanvas" width="${SIZE}" height="${SIZE}"></canvas>
        <div class="crop-ring"></div>
      </div>
      <input id="cropZoom" type="range" min="1" max="4" step="0.01" value="1">
      <div class="crop-actions">
        <button class="secondary" id="cropCancel">Cancelar</button>
        <button id="cropSave">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const canvas = document.getElementById('cropCanvas');
  const ctx = canvas.getContext('2d');

  // Estado de la vista: escala y desplazamiento
  const baseScale = Math.max(SIZE / img.width, SIZE / img.height); // cubre el lienzo
  let zoom = 1;
  let scale = baseScale * zoom;
  let ox = (SIZE - img.width * scale) / 2;   // offset x
  let oy = (SIZE - img.height * scale) / 2;  // offset y

  function clamp() {
    scale = baseScale * zoom;
    const w = img.width * scale, h = img.height * scale;
    // que la imagen siempre cubra el lienzo
    if (ox > 0) ox = 0;
    if (oy > 0) oy = 0;
    if (ox < SIZE - w) ox = SIZE - w;
    if (oy < SIZE - h) oy = SIZE - h;
  }

  function draw() {
    clamp();
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(img, ox, oy, img.width * scale, img.height * scale);
  }
  draw();

  // --- Arrastrar (un dedo / mouse) ---
  let dragging = false, lastX = 0, lastY = 0;
  function start(x, y) { dragging = true; lastX = x; lastY = y; }
  function move(x, y) {
    if (!dragging) return;
    ox += x - lastX; oy += y - lastY;
    lastX = x; lastY = y; draw();
  }
  function end() { dragging = false; }

  canvas.addEventListener('mousedown', e => start(e.clientX, e.clientY));
  window.addEventListener('mousemove', e => move(e.clientX, e.clientY));
  window.addEventListener('mouseup', end);

  // --- Touch: arrastrar (1 dedo) + pellizco (2 dedos) ---
  let pinchDist = 0, pinchZoom = 1;
  canvas.addEventListener('touchstart', e => {
    if (e.touches.length === 1) start(e.touches[0].clientX, e.touches[0].clientY);
    else if (e.touches.length === 2) {
      pinchDist = dist(e.touches);
      pinchZoom = zoom;
    }
  }, { passive: false });

  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1) {
      move(e.touches[0].clientX, e.touches[0].clientY);
    } else if (e.touches.length === 2) {
      const d = dist(e.touches);
      zoom = Math.min(4, Math.max(1, pinchZoom * (d / pinchDist)));
      document.getElementById('cropZoom').value = zoom;
      draw();
    }
  }, { passive: false });

  canvas.addEventListener('touchend', end);

  function dist(t) {
    const dx = t[0].clientX - t[1].clientX, dy = t[0].clientY - t[1].clientY;
    return Math.hypot(dx, dy);
  }

  // --- Slider de zoom ---
  document.getElementById('cropZoom').addEventListener('input', e => {
    // mantener el centro al hacer zoom
    const cx = SIZE / 2, cy = SIZE / 2;
    const imgCx = (cx - ox) / scale, imgCy = (cy - oy) / scale;
    zoom = parseFloat(e.target.value);
    scale = baseScale * zoom;
    ox = cx - imgCx * scale;
    oy = cy - imgCy * scale;
    draw();
  });

  // --- Cancelar / Guardar ---
  document.getElementById('cropCancel').onclick = () => overlay.remove();
  document.getElementById('cropSave').onclick = () => {
    // Render final: recorta el lienzo a OUT x OUT (la porción visible)
    const out = document.createElement('canvas');
    out.width = OUT; out.height = OUT;
    const octx = out.getContext('2d');
    const ratio = OUT / SIZE;
    octx.drawImage(img, ox * ratio, oy * ratio, img.width * scale * ratio, img.height * scale * ratio);
    out.toBlob(blob => {
      overlay.remove();
      onDone(blob);
    }, 'image/jpeg', 0.9);
  };
}

async function subirAvatar(blob) {
  profileMsg('Subiendo foto…');
  try {
    const path = `${currentUser.id}/avatar.jpg`;
    const { error: upErr } = await sb.storage.from('avatars')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (upErr) throw upErr;
    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    const cleanUrl = data.publicUrl;
    const newVersion = Date.now(); // versión nueva = cambia el ?v= al renderizar
    const { error: updErr } = await sb.from('profiles')
      .update({ avatar_url: cleanUrl, avatar_version: newVersion })
      .eq('id', currentUser.id);
    if (updErr) throw updErr;
    currentProfile.avatar_url = cleanUrl;
    currentProfile.avatar_version = newVersion;
    const displayUrl = avatarUrl(currentProfile);
    const prev = document.getElementById('avatarPreview');
    if (prev) prev.outerHTML = `<img class="avatar-lg" id="avatarPreview" src="${displayUrl}" alt="avatar">`;
    profileMsg('Foto actualizada ✓');
  } catch (err) {
    profileMsg('Error al subir: ' + err.message, false);
  }
}

async function saveName() {
  const name = document.getElementById('newName').value.trim();
  if (!name) return profileMsg('El nombre no puede estar vacío', false);
  const { error } = await sb.from('profiles').update({ display_name: name }).eq('id', currentUser.id);
  if (error) return profileMsg('Error: ' + error.message, false);
  currentProfile.display_name = name;
  profileMsg('Nombre actualizado ✓');
}

async function savePassword() {
  const pass = document.getElementById('newPass').value;
  if (pass.length < 6) return profileMsg('La contraseña debe tener al menos 6 caracteres', false);
  const { error } = await sb.auth.updateUser({ password: pass });
  if (error) return profileMsg('Error: ' + error.message, false);
  document.getElementById('newPass').value = '';
  profileMsg('Contraseña actualizada ✓');
}

async function deleteAccount() {
  const sure = confirm('¿Eliminar tu cuenta? Se borrarán TODOS tus mensajes y archivos. Esta acción no se puede deshacer.');
  if (!sure) return;
  const sure2 = confirm('Última confirmación: esto es permanente. ¿Continuar?');
  if (!sure2) return;
  profileMsg('Eliminando cuenta…');
  try {
    const { data: sess } = await sb.auth.getSession();
    const token = sess.session?.access_token;
    const resp = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const out = await resp.json();
    if (!resp.ok || out.error) throw new Error(out.error || 'fallo al eliminar');
    alert('Tu cuenta fue eliminada.');
    await sb.auth.signOut();
    location.reload();
  } catch (err) {
    profileMsg('No se pudo eliminar: ' + err.message, false);
  }
}

// === CHAT (1-a-1 y GRUPO) ===
let activeChatName = '';

// Construye el HTML común del chat (header + mensajes + compositor con emojis)
function chatShell(titleHtml, withClear, conLlamadas) {
  return `
    <div class="header">
      <button class="link" id="backBtn">←</button>
      ${titleHtml}
      ${conLlamadas ? `<button class="link" id="callAudioBtn" title="Llamar">📞</button>
      <button class="link" id="callVideoBtn" title="Videollamada">📹</button>` : ''}
      <button class="link" id="searchBtn" title="Buscar">🔍</button>
      ${withClear ? `<button class="link" id="clearBtn" title="Limpiar conversación">🗑️</button>` : ''}
    </div>
    <div id="searchBar" class="search-bar hidden">
      <input id="searchInput" placeholder="Buscar en la conversación…" autocomplete="off">
      <span id="searchCount" class="search-count"></span>
      <button class="link" id="searchPrev" title="Anterior">▲</button>
      <button class="link" id="searchNext" title="Siguiente">▼</button>
      <button class="link" id="searchClose">✕</button>
    </div>
    <div class="messages" id="messages"></div>
    <div id="emojiPanel" class="emoji-panel hidden">
      ${EMOJIS.map(e => `<button class="emoji" type="button">${e}</button>`).join('')}
    </div>
    <div id="filePreview" class="file-preview hidden"></div>
    <div class="composer">
      <button id="emojiBtn" class="icon-btn" title="Emojis">😀</button>
      <button id="attachBtn" class="icon-btn" title="Adjuntar">📎</button>
      <input id="fileInput" type="file" hidden>
      <input id="msgInput" placeholder="Mensaje..." autocomplete="off">
      <button id="micBtn" class="icon-btn" title="Mantén presionado para grabar">🎤</button>
      <button id="sendBtn">Enviar</button>
    </div>
    <div id="recIndicator" class="rec-indicator hidden">
      <span class="rec-dot"></span>
      <span id="recTime">0:00</span>
      <span class="rec-hint">Suelta para enviar · desliza fuera para cancelar</span>
    </div>`;
}

function wireComposer() {
  document.getElementById('sendBtn').onclick = sendMessage;
  document.getElementById('attachBtn').onclick = () => document.getElementById('fileInput').click();
  document.getElementById('fileInput').addEventListener('change', onFilePicked);
  document.getElementById('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  // Emojis
  const panel = document.getElementById('emojiPanel');
  document.getElementById('emojiBtn').onclick = () => panel.classList.toggle('hidden');
  panel.querySelectorAll('.emoji').forEach(b =>
    b.onclick = () => {
      const input = document.getElementById('msgInput');
      input.value += b.textContent;
      input.focus();
    });
  // Búsqueda en conversación
  document.getElementById('searchBtn').onclick = abrirBusqueda;
  // "Está escribiendo…": emite señal al teclear (máx 1 cada 2s)
  document.getElementById('msgInput').addEventListener('input', emitirEscribiendo);
  // Notas de voz: mantener presionado el micrófono
  wireMicrofono();
}

// === NOTAS DE VOZ ===
let mediaRecorder = null, audioChunks = [], recTimer = null, recStart = 0;
let recCancelada = false, recMime = '';

function wireMicrofono() {
  const mic = document.getElementById('micBtn');
  if (!mic) return;

  const empezar = (e) => { e.preventDefault(); iniciarGrabacion(); };
  const terminar = (e) => { e.preventDefault(); detenerGrabacion(false); };
  // deslizar el dedo fuera del botón cancela
  const mover = (e) => {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
    const t = e.touches ? e.touches[0] : e;
    const r = mic.getBoundingClientRect();
    const fuera = t.clientX < r.left - 60 || t.clientX > r.right + 60 || t.clientY < r.top - 80;
    if (fuera) marcarCancelacion(true);
    else marcarCancelacion(false);
  };

  mic.addEventListener('touchstart', empezar, { passive: false });
  mic.addEventListener('touchend', terminar);
  mic.addEventListener('touchmove', mover, { passive: false });
  // soporte mouse (escritorio)
  mic.addEventListener('mousedown', empezar);
  window.addEventListener('mouseup', (e) => { if (mediaRecorder?.state === 'recording') terminar(e); });
}

function marcarCancelacion(cancel) {
  recCancelada = cancel;
  const ind = document.getElementById('recIndicator');
  if (ind) ind.classList.toggle('cancel', cancel);
}

async function iniciarGrabacion() {
  if (mediaRecorder && mediaRecorder.state === 'recording') return;
  if (!navigator.mediaDevices?.getUserMedia) {
    alert('Tu navegador no permite grabar audio.');
    return;
  }
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    // detectar formato soportado (Android suele preferir webm/opus)
    recMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus') ? 'audio/webm;codecs=opus'
            : MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm'
            : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4'
            : '';
    mediaRecorder = new MediaRecorder(stream, recMime ? { mimeType: recMime } : undefined);
    audioChunks = [];
    recCancelada = false;
    mediaRecorder.ondataavailable = (e) => { if (e.data.size > 0) audioChunks.push(e.data); };
    mediaRecorder.onstop = () => {
      stream.getTracks().forEach(t => t.stop()); // libera el micrófono
      finalizarGrabacion();
    };
    mediaRecorder.start();
    recStart = Date.now();
    mostrarIndicadorRec();
  } catch (err) {
    if (err.name === 'NotAllowedError') alert('Necesitas dar permiso de micrófono.');
    else alert('No se pudo iniciar la grabación: ' + err.message);
  }
}

function detenerGrabacion(cancelar) {
  if (cancelar) recCancelada = true;
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    mediaRecorder.stop(); // dispara onstop -> finalizarGrabacion
  }
  ocultarIndicadorRec();
}

function mostrarIndicadorRec() {
  const ind = document.getElementById('recIndicator');
  ind?.classList.remove('hidden', 'cancel');
  recTimer = setInterval(() => {
    const s = Math.floor((Date.now() - recStart) / 1000);
    const el = document.getElementById('recTime');
    if (el) el.textContent = `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
    if (s >= 300) detenerGrabacion(false); // tope 5 min
  }, 250);
}

function ocultarIndicadorRec() {
  document.getElementById('recIndicator')?.classList.add('hidden');
  clearInterval(recTimer);
}

async function finalizarGrabacion() {
  const dur = Math.round((Date.now() - recStart) / 1000);
  if (recCancelada || dur < 1 || !audioChunks.length) return; // muy corta o cancelada
  const blob = new Blob(audioChunks, { type: recMime || 'audio/webm' });
  await enviarNotaVoz(blob, dur);
}

async function enviarNotaVoz(blob, dur) {
  try {
    const ext = (recMime.includes('mp4')) ? 'm4a' : 'webm';
    const path = `${currentUser.id}/${Date.now()}-voz.${ext}`;
    const { error: upErr } = await sb.storage.from('attachments')
      .upload(path, blob, { contentType: blob.type });
    if (upErr) throw upErr;
    // tipo de audio robusto: si el blob no trae un audio/* claro, forzar uno
    let tipo = blob.type;
    if (!tipo || !tipo.startsWith('audio')) tipo = ext === 'm4a' ? 'audio/mp4' : 'audio/webm';
    const row = {
      sender_id: currentUser.id,
      content: null,
      attachment_path: path,
      attachment_name: `Nota de voz (${Math.floor(dur/60)}:${String(dur%60).padStart(2,'0')})`,
      attachment_type: tipo,
      attachment_size: blob.size
    };
    if (activeIsGroup) row.group_id = activeChat;
    else row.recipient_id = activeChat;
    const { data, error } = await sb.from('messages').insert(row).select().single();
    if (error) throw error;
    pintarMensajePropio(data); // se ve de inmediato, sin esperar al realtime
  } catch (err) {
    alert('No se pudo enviar la nota de voz: ' + err.message);
  }
}

// Pinta un mensaje propio recién insertado si no está ya en pantalla
function pintarMensajePropio(m) {
  if (!m) return;
  // ¿pertenece a la conversación abierta?
  const pertenece = activeIsGroup
    ? m.group_id === activeChat
    : (m.recipient_id === activeChat || m.sender_id === activeChat);
  if (!pertenece) return;
  if (document.querySelector(`.bubble[data-id="${m.id}"]`)) return; // ya está (realtime se adelantó)
  msgCache[m.id] = m;
  const box = document.getElementById('messages');
  if (!box) return;
  box.insertAdjacentHTML('beforeend', renderBubble(m));
  box.scrollTop = box.scrollHeight;
  hydrateAttachments(box);
  attachLongPress(box);
}

// === "ESTÁ ESCRIBIENDO…" ===
let typingLastSent = 0, typingHideTimer = null, channelReady = false;

function emitirEscribiendo() {
  const ahora = Date.now();
  if (ahora - typingLastSent < 2000) return; // no spamear
  if (!channel || !channelReady) return;     // canal aún no listo
  typingLastSent = ahora;
  channel.send({
    type: 'broadcast',
    event: 'typing',
    payload: { userId: currentUser.id, name: currentProfile?.display_name || 'Alguien' }
  }).catch(() => {}); // si falla, no romper
}

function mostrarEscribiendo(nombre) {
  let el = document.getElementById('typingInd');
  if (!el) {
    el = document.createElement('div');
    el.id = 'typingInd';
    el.className = 'typing-ind';
    const box = document.getElementById('messages');
    box?.parentNode.insertBefore(el, box.nextSibling);
  }
  el.textContent = activeIsGroup ? `${nombre} está escribiendo…` : 'escribiendo…';
  el.classList.remove('hidden');
  clearTimeout(typingHideTimer);
  typingHideTimer = setTimeout(() => el?.classList.add('hidden'), 3000);
}

function abrirBusqueda() {
  const bar = document.getElementById('searchBar');
  bar.classList.remove('hidden');
  const input = document.getElementById('searchInput');
  input.value = '';
  input.focus();
  document.getElementById('searchInput').oninput = (e) => ejecutarBusqueda(e.target.value);
  document.getElementById('searchNext').onclick = () => moverBusqueda(1);
  document.getElementById('searchPrev').onclick = () => moverBusqueda(-1);
  document.getElementById('searchClose').onclick = cerrarBusqueda;
}

function cerrarBusqueda() {
  document.getElementById('searchBar').classList.add('hidden');
  limpiarResaltado();
  searchMatches = []; searchIdx = -1;
  document.getElementById('searchCount').textContent = '';
}

function limpiarResaltado() {
  document.querySelectorAll('.bubble .text mark').forEach(m => {
    const parent = m.parentNode;
    parent.replaceChild(document.createTextNode(m.textContent), m);
    parent.normalize();
  });
  document.querySelectorAll('.bubble.search-active').forEach(b => b.classList.remove('search-active'));
}

function ejecutarBusqueda(term) {
  limpiarResaltado();
  searchMatches = []; searchIdx = -1;
  const q = term.trim().toLowerCase();
  const countEl = document.getElementById('searchCount');
  if (!q) { countEl.textContent = ''; return; }

  document.querySelectorAll('.bubble').forEach(bubble => {
    const textEl = bubble.querySelector('.text');
    if (!textEl) return;
    const txt = textEl.textContent;
    if (txt.toLowerCase().includes(q)) {
      // resaltar todas las apariciones dentro de esta burbuja
      const regex = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      textEl.innerHTML = esc(txt).replace(regex, '<mark>$1</mark>');
      searchMatches.push(bubble);
    }
  });

  if (searchMatches.length) {
    searchIdx = 0;
    irABusqueda();
  }
  countEl.textContent = searchMatches.length ? `1/${searchMatches.length}` : 'Sin resultados';
}

function moverBusqueda(dir) {
  if (!searchMatches.length) return;
  searchIdx = (searchIdx + dir + searchMatches.length) % searchMatches.length;
  irABusqueda();
  document.getElementById('searchCount').textContent = `${searchIdx + 1}/${searchMatches.length}`;
}

function irABusqueda() {
  document.querySelectorAll('.bubble.search-active').forEach(b => b.classList.remove('search-active'));
  const el = searchMatches[searchIdx];
  if (el) {
    el.classList.add('search-active');
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function openChat(otherId, otherName, otherAvatar) {
  activeChat = otherId;
  activeChatName = otherName;
  activeIsGroup = false;
  pendingFile = null; replyingTo = null; searchMatches = []; searchIdx = -1; modoSeleccion = false; seleccionados.clear();
  if (otherAvatar === undefined) {
    const { data } = await sb.from('profiles').select('avatar_url, avatar_version').eq('id', otherId).single();
    otherAvatar = avatarUrl(data);
  }
  const avatarHtml = otherAvatar
    ? `<img class="avatar-img chat-av" src="${esc(otherAvatar)}" alt="">`
    : `<div class="avatar chat-av">${esc((otherName||'?')[0])}</div>`;
  app.innerHTML = chatShell(`${avatarHtml}<span class="chat-title">${esc(otherName)}</span>`, true, true);
  document.getElementById('backBtn').onclick = () => { unsubscribe(); renderChats(); };
  document.getElementById('clearBtn').onclick = limpiarConversacion;
  document.getElementById('callAudioBtn').onclick = () => iniciarLlamada(otherId, otherName, otherAvatar, 'audio');
  document.getElementById('callVideoBtn').onclick = () => iniciarLlamada(otherId, otherName, otherAvatar, 'video');
  wireComposer();
  await loadMessages();
  subscribe();
}

async function openGroup(groupId, groupName, groupAvatar) {
  activeChat = groupId;
  activeChatName = groupName;
  activeIsGroup = true;
  pendingFile = null; replyingTo = null; searchMatches = []; searchIdx = -1; modoSeleccion = false; seleccionados.clear();
  // cargar nombres de miembros para mostrar autores
  memberNames = {};
  const { data: members } = await sb.from('group_members').select('user_id').eq('group_id', groupId);
  const ids = (members || []).map(m => m.user_id);
  if (ids.length) {
    const { data: profs } = await sb.from('profiles').select('id, display_name').in('id', ids);
    for (const p of profs || []) memberNames[p.id] = p.display_name;
  }
  const avatarHtml = groupAvatar
    ? `<img class="avatar-img chat-av" src="${esc(groupAvatar)}" alt="">`
    : `<div class="avatar chat-av group-av">${esc((groupName||'?')[0])}</div>`;
  app.innerHTML = chatShell(
    `${avatarHtml}<span class="chat-title">${esc(groupName)}</span>
     <button class="link" id="groupInfoBtn" title="Info del grupo">ⓘ</button>`, false);
  document.getElementById('backBtn').onclick = () => { unsubscribe(); renderChats(); };
  document.getElementById('groupInfoBtn').onclick = () => renderGroupInfo(groupId, groupName);
  wireComposer();
  await loadMessages();
  subscribe();
}

async function renderGroupInfo(groupId, groupName) {
  const { data: members } = await sb.from('group_members').select('user_id').eq('group_id', groupId);
  const ids = (members || []).map(m => m.user_id);
  let profs = [];
  if (ids.length) { const { data } = await sb.from('profiles').select('*').in('id', ids); profs = data || []; }
  const { data: g } = await sb.from('groups').select('*').eq('id', groupId).single();
  const gAvatar = avatarUrl(g);

  app.innerHTML = `
    <div class="header">
      <button class="link" id="backBtn">←</button>
      <span class="chat-title">Info del grupo</span>
    </div>
    <div class="profile">
      <div class="profile-avatar">
        ${gAvatar ? `<img class="avatar-lg" id="gAvatarPreview" src="${esc(gAvatar)}" alt="grupo">`
                  : `<div class="avatar-lg placeholder group-av" id="gAvatarPreview">${esc((g.name||'?')[0])}</div>`}
        <button class="link" id="changeGroupPhoto">Cambiar foto</button>
        <input id="groupAvatarInput" type="file" accept="image/*" hidden>
      </div>

      <label class="field-label">Nombre del grupo</label>
      <input id="gName" value="${esc(g.name || '')}" placeholder="Nombre del grupo">
      <button id="saveGroupName">Guardar nombre</button>

      <label class="field-label">Miembros (${profs.length})</label>
      <div class="member-list">
        ${profs.map(p => `<div class="member-row">
          ${avatarUrl(p) ? `<img class="avatar-img sm" src="${esc(avatarUrl(p))}">`
                         : `<div class="avatar sm">${esc((p.display_name||'?')[0])}</div>`}
          <span>${esc(p.display_name)}${p.id === currentUser.id ? ' (yo)' : ''}</span>
        </div>`).join('')}
      </div>

      <hr class="sep">
      <button id="leaveGroup" class="danger">Salir del grupo</button>
      <p id="giMsg" class="ok"></p>
    </div>`;

  document.getElementById('backBtn').onclick = () => openGroup(groupId, g.name, undefined);
  document.getElementById('saveGroupName').onclick = () => guardarNombreGrupo(groupId);
  document.getElementById('changeGroupPhoto').onclick = () => document.getElementById('groupAvatarInput').click();
  document.getElementById('groupAvatarInput').addEventListener('change', (e) => onGroupAvatarPicked(e, groupId));
  document.getElementById('leaveGroup').onclick = async () => {
    if (!confirm('¿Salir de este grupo? Dejarás de recibir sus mensajes.')) return;
    await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUser.id);
    renderChats();
  };
}

function giMsg(t, ok = true) {
  const m = document.getElementById('giMsg');
  if (m) { m.textContent = t; m.className = ok ? 'ok' : 'error'; }
}

async function guardarNombreGrupo(groupId) {
  const name = document.getElementById('gName').value.trim();
  if (!name) return giMsg('El nombre no puede estar vacío', false);
  const { error } = await sb.from('groups').update({ name }).eq('id', groupId);
  if (error) return giMsg('Error: ' + error.message, false);
  giMsg('Nombre actualizado ✓');
}

// Reusa el editor de recorte; al guardar sube a 'avatars' en carpeta del usuario
function onGroupAvatarPicked(e, groupId) {
  const file = e.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) return giMsg('Debe ser una imagen', false);
  if (file.size > MAX_AVATAR_BYTES) return giMsg('Máximo 2 MB', false);
  abrirEditorRecorte(file, (blob) => subirAvatarGrupo(blob, groupId));
}

async function subirAvatarGrupo(blob, groupId) {
  giMsg('Subiendo foto…');
  try {
    // se guarda en la carpeta del usuario (la policy de storage exige uid),
    // con nombre que incluye el grupo
    const path = `${currentUser.id}/group-${groupId}.jpg`;
    const { error: upErr } = await sb.storage.from('avatars')
      .upload(path, blob, { contentType: 'image/jpeg', upsert: true });
    if (upErr) throw upErr;
    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    const newVersion = Date.now();
    const { error: updErr } = await sb.from('groups')
      .update({ avatar_url: data.publicUrl, avatar_version: newVersion }).eq('id', groupId);
    if (updErr) throw updErr;
    giMsg('Foto del grupo actualizada ✓');
    const prev = document.getElementById('gAvatarPreview');
    if (prev) prev.outerHTML = `<img class="avatar-lg" id="gAvatarPreview" src="${data.publicUrl}?v=${newVersion}" alt="grupo">`;
  } catch (err) {
    giMsg('Error al subir: ' + err.message, false);
  }
}

// Limpiar conversación SOLO PARA MÍ (solo chats 1-a-1)
async function limpiarConversacion() {
  if (!confirm('¿Limpiar esta conversación? Solo se ocultará para ti; la otra persona conservará su copia.')) return;
  const { error } = await sb.from('chat_clears')
    .upsert({ user_id: currentUser.id, other_id: activeChat, cleared_at: new Date().toISOString() },
            { onConflict: 'user_id,other_id' });
  if (error) { alert('No se pudo limpiar: ' + error.message); return; }
  const box = document.getElementById('messages');
  if (box) box.innerHTML = '';
}

async function loadMessages() {
  let q = sb.from('messages').select('*').order('created_at');
  if (activeIsGroup) {
    q = q.eq('group_id', activeChat);
  } else {
    const { data: clear } = await sb.from('chat_clears')
      .select('cleared_at').eq('user_id', currentUser.id).eq('other_id', activeChat).maybeSingle();
    const clearedAt = clear?.cleared_at || null;
    q = q.or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${activeChat}),and(sender_id.eq.${activeChat},recipient_id.eq.${currentUser.id})`);
    if (clearedAt) q = q.gt('created_at', clearedAt);
  }
  const { data } = await q;

  // Mensajes que oculté "para mí" (no se muestran en mi vista)
  let ocultos = new Set();
  const ids0 = (data || []).map(m => m.id);
  if (ids0.length) {
    const { data: hides } = await sb.from('message_hides')
      .select('message_id').eq('user_id', currentUser.id).in('message_id', ids0);
    ocultos = new Set((hides || []).map(h => h.message_id));
  }
  const visibles = (data || []).filter(m => !ocultos.has(m.id));

  msgCache = {};
  for (const m of visibles) msgCache[m.id] = m;
  const box = document.getElementById('messages');
  box.innerHTML = '';
  for (const m of visibles) box.insertAdjacentHTML('beforeend', renderBubble(m));
  box.scrollTop = box.scrollHeight;
  hydrateAttachments(box);
  attachLongPress(box);
  marcarLeidos(); // marca como leídos los mensajes del otro
  await cargarReacciones();
  for (const id of Object.keys(msgCache)) repintarReacciones(id);
}

// === REACCIONES ===
async function cargarReacciones() {
  const ids = Object.keys(msgCache).map(Number);
  reactionsCache = {};
  if (!ids.length) return;
  const { data } = await sb.from('message_reactions').select('*').in('message_id', ids);
  for (const r of (data || [])) {
    (reactionsCache[r.message_id] = reactionsCache[r.message_id] || []).push(r);
  }
}

// Pinta/actualiza el bloque de reacciones bajo una burbuja
function repintarReacciones(msgId) {
  const bubble = document.querySelector(`.bubble[data-id="${msgId}"]`);
  if (!bubble) return;
  const reacts = reactionsCache[msgId] || [];
  let cont = bubble.querySelector('.reacts');
  if (!reacts.length) { if (cont) cont.remove(); return; }
  // agrupar por emoji con conteo
  const counts = {};
  let mine = null;
  for (const r of reacts) {
    counts[r.emoji] = (counts[r.emoji] || 0) + 1;
    if (r.user_id === currentUser.id) mine = r.emoji;
  }
  const html = Object.entries(counts).map(([e, n]) =>
    `<span class="react-chip ${mine === e ? 'mine' : ''}">${e}${n > 1 ? ' ' + n : ''}</span>`).join('');
  if (!cont) {
    cont = document.createElement('div');
    cont.className = 'reacts';
    bubble.appendChild(cont);
  }
  cont.innerHTML = html;
}

// Marca como leídos los mensajes que me envió el otro (solo 1-a-1)
// SOLO si la app está visible y tengo esa conversación abierta.
async function marcarLeidos() {
  if (activeIsGroup) return;
  if (document.visibilityState !== 'visible') return; // app en segundo plano: no marcar
  if (!document.getElementById('messages')) return;   // no estoy dentro de un chat
  await sb.from('messages')
    .update({ read_at: new Date().toISOString() })
    .eq('sender_id', activeChat)
    .eq('recipient_id', currentUser.id)
    .is('read_at', null);
}

function renderBubble(m) {
  const mine = m.sender_id === currentUser.id;

  // Mensaje eliminado: muestra placeholder, sin contenido
  if (m.deleted_at) {
    return `<div class="bubble ${mine ? 'mine' : 'theirs'} deleted" data-id="${m.id}">
      <div class="text"><em>🚫 Mensaje eliminado</em></div></div>`;
  }

  let inner = '';
  // Cita del mensaje al que responde
  if (m.reply_to && (m.reply_preview || m.reply_author)) {
    inner += `<div class="quote" data-target="${m.reply_to || ''}">
      <span class="quote-author">${esc(m.reply_author || '')}</span>
      <span class="quote-text">${esc(m.reply_preview || '')}</span>
    </div>`;
  }
  // En grupos, mostrar el autor encima (solo si no es mío)
  if (activeIsGroup && !mine) {
    const autor = memberNames[m.sender_id] || 'Alguien';
    inner += `<div class="author">${esc(autor)}</div>`;
  }
  if (m.attachment_path) {
    const type = m.attachment_type || '';
    const path = m.attachment_path || '';
    const isImage = type.startsWith('image/');
    // audio por mime O por extensión (blinda notas con tipo mal guardado)
    const isAudio = type.startsWith('audio/') || /\.(webm|m4a|mp3|ogg|wav|aac)$/i.test(path) || /voz/i.test(path);
    if (isImage) {
      inner += `<div class="attach-img" data-path="${esc(m.attachment_path)}"><span class="loading">Cargando imagen…</span></div>`;
    } else if (isAudio) {
      inner += `<div class="voice-note" data-path="${esc(m.attachment_path)}">
        <button class="voice-play" type="button">▶️</button>
        <span class="voice-label">🎙️ ${esc(m.attachment_name || 'Nota de voz')}</span>
      </div>`;
    } else {
      inner += `<a class="attach-file" data-path="${esc(m.attachment_path)}" href="#">📄 ${esc(m.attachment_name || 'archivo')} <small>${formatSize(m.attachment_size)}</small></a>`;
    }
  }
  if (m.content) inner += `<div class="text">${esc(m.content)}</div>`;

  // Pie del mensaje: "editado" + palomitas (solo mis mensajes 1-a-1)
  let meta = '';
  if (m.edited_at) meta += `<span class="edited">editado</span>`;
  if (mine && !activeIsGroup) {
    const tick = m.read_at ? '<span class="ticks read">✓✓</span>' : '<span class="ticks">✓✓</span>';
    meta += tick;
  }
  if (meta) inner += `<div class="meta">${meta}</div>`;

  return `<div class="bubble ${mine ? 'mine' : 'theirs'}" data-id="${m.id}">${inner}<button class="bubble-menu-btn" title="Acciones">▾</button></div>`;
}

// Detecta "mantener presionado" (y clic derecho en escritorio) sobre burbujas
function attachLongPress(box) {
  let timer = null;
  const start = (el) => {
    timer = setTimeout(() => {
      const id = el.dataset.id;
      if (id) abrirMenuMensaje(parseInt(id));
    }, 500);
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

  box.querySelectorAll('.bubble').forEach(el => {
    const id = el.dataset.id;
    // Flechita ▾ (visible en hover en web): abre el menú
    const menuBtn = el.querySelector('.bubble-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modoSeleccion) { toggleSeleccion(parseInt(id), el); return; }
        if (id) abrirMenuMensaje(parseInt(id));
      });
    }
    // En modo selección, un tap marca/desmarca
    el.addEventListener('click', (e) => {
      if (!modoSeleccion) return;
      e.stopPropagation();
      toggleSeleccion(parseInt(id), el);
    });
    el.addEventListener('touchstart', () => start(el), { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel);
    // escritorio: clic derecho
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (modoSeleccion) return;
      if (id) abrirMenuMensaje(parseInt(id));
    });
    // tocar la cita salta al mensaje original
    const quote = el.querySelector('.quote');
    if (quote && quote.dataset.target) {
      quote.addEventListener('click', (e) => {
        if (modoSeleccion) return;
        e.stopPropagation();
        cancel();
        saltarAMensaje(quote.dataset.target);
      });
    }
  });
}

// === MODO SELECCIÓN MÚLTIPLE ===
function entrarModoSeleccion(primerId) {
  modoSeleccion = true;
  seleccionados = new Set();
  if (primerId) {
    seleccionados.add(primerId);
    document.querySelector(`.bubble[data-id="${primerId}"]`)?.classList.add('selected');
  }
  mostrarBarraSeleccion();
}

function salirModoSeleccion() {
  modoSeleccion = false;
  seleccionados.clear();
  document.querySelectorAll('.bubble.selected').forEach(b => b.classList.remove('selected'));
  document.getElementById('selBar')?.remove();
}

function toggleSeleccion(id, el) {
  if (seleccionados.has(id)) { seleccionados.delete(id); el.classList.remove('selected'); }
  else { seleccionados.add(id); el.classList.add('selected'); }
  if (seleccionados.size === 0) { salirModoSeleccion(); return; }
  actualizarBarraSeleccion();
}

function mostrarBarraSeleccion() {
  let bar = document.getElementById('selBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'selBar';
    bar.className = 'sel-bar';
    const header = app.querySelector('.header');
    header.insertAdjacentElement('afterend', bar);
  }
  actualizarBarraSeleccion();
}

function actualizarBarraSeleccion() {
  const bar = document.getElementById('selBar');
  if (!bar) return;
  bar.innerHTML = `
    <button class="link" id="selCancel">✕</button>
    <span class="sel-count">${seleccionados.size} seleccionado(s)</span>
    <button class="link" id="selCopy" title="Copiar">📋</button>
    <button class="link" id="selForward" title="Reenviar">↪️</button>
    <button class="link" id="selDelete" title="Eliminar">🗑️</button>`;
  document.getElementById('selCancel').onclick = salirModoSeleccion;
  document.getElementById('selCopy').onclick = copiarSeleccionados;
  document.getElementById('selForward').onclick = reenviarSeleccionados;
  document.getElementById('selDelete').onclick = eliminarSeleccionados;
}

// Devuelve los mensajes seleccionados ordenados por fecha
function mensajesSeleccionados() {
  return [...seleccionados]
    .map(id => msgCache[id])
    .filter(Boolean)
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

async function copiarSeleccionados() {
  const txt = mensajesSeleccionados()
    .map(m => m.content || (m.attachment_name || '[adjunto]'))
    .join('\n');
  try {
    await navigator.clipboard.writeText(txt);
    alert('Copiado al portapapeles ✓');
  } catch (_) {
    alert('No se pudo copiar en este navegador.');
  }
  salirModoSeleccion();
}

async function reenviarSeleccionados() {
  const msgs = mensajesSeleccionados();
  if (!msgs.length) return;
  // reusa el diálogo de reenviar; al elegir destino, reenvía todos
  abrirReenviarMultiple(msgs);
}

async function eliminarSeleccionados() {
  const msgs = mensajesSeleccionados();
  if (!msgs.length) return;
  const todosMios = msgs.every(m => m.sender_id === currentUser.id);
  const overlay = document.createElement('div');
  overlay.className = 'msg-menu-overlay';
  overlay.innerHTML = `
    <div class="msg-menu">
      <p class="del-title">¿Eliminar ${msgs.length} mensaje(s)?</p>
      <button id="delMe">Eliminar para mí</button>
      ${todosMios ? `<button id="delAll" class="danger">Eliminar para todos</button>` : ''}
      <button id="delCancel" class="secondary">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById('delCancel').onclick = close;
  document.getElementById('delMe').onclick = async () => {
    close();
    const filas = msgs.map(m => ({ message_id: m.id, user_id: currentUser.id }));
    await sb.from('message_hides').upsert(filas, { onConflict: 'message_id,user_id' });
    msgs.forEach(m => document.querySelector(`.bubble[data-id="${m.id}"]`)?.remove());
    salirModoSeleccion();
  };
  const allBtn = document.getElementById('delAll');
  if (allBtn) allBtn.onclick = async () => {
    close();
    for (const m of msgs) {
      await sb.from('messages')
        .update({ deleted_at: new Date().toISOString(), content: null,
                  attachment_path: null, attachment_name: null,
                  attachment_type: null, attachment_size: null })
        .eq('id', m.id);
    }
    salirModoSeleccion();
  };
}

// Reenvío múltiple: elegir un destino y mandar todos los mensajes
async function abrirReenviarMultiple(msgs) {
  const { data: profiles } = await sb.from('profiles').select('id, display_name, avatar_url, avatar_version').neq('id', currentUser.id).order('display_name');
  const { data: myMem } = await sb.from('group_members').select('group_id').eq('user_id', currentUser.id);
  const gids = (myMem || []).map(x => x.group_id);
  let groups = [];
  if (gids.length) { const { data } = await sb.from('groups').select('id, name, avatar_url, avatar_version').in('id', gids); groups = data || []; }

  const overlay = document.createElement('div');
  overlay.className = 'fwd-overlay';
  overlay.innerHTML = `
    <div class="fwd-box">
      <p class="crop-title">Reenviar ${msgs.length} mensaje(s) a…</p>
      <div class="fwd-list">
        ${groups.map(g => `<div class="fwd-item" data-type="group" data-id="${g.id}">
          ${avatarUrl(g) ? `<img class="avatar-img sm" src="${esc(avatarUrl(g))}">` : `<div class="avatar sm group-av">${esc((g.name||'?')[0])}</div>`}
          <span>${esc(g.name)}</span></div>`).join('')}
        ${profiles.map(p => `<div class="fwd-item" data-type="user" data-id="${p.id}">
          ${avatarUrl(p) ? `<img class="avatar-img sm" src="${esc(avatarUrl(p))}">` : `<div class="avatar sm">${esc((p.display_name||'?')[0])}</div>`}
          <span>${esc(p.display_name)}</span></div>`).join('')}
      </div>
      <button id="fwdCancel" class="secondary">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById('fwdCancel').onclick = close;
  overlay.querySelectorAll('.fwd-item').forEach(it => {
    it.onclick = async () => {
      for (const m of msgs) await reenviarMensaje(m, it.dataset.type, it.dataset.id);
      close();
      salirModoSeleccion();
      alert('Mensajes reenviados ✓');
    };
  });
}

// Hace scroll y resalta brevemente el mensaje destino de una cita
function saltarAMensaje(targetId) {
  const box = document.getElementById('messages');
  const target = box?.querySelector(`.bubble[data-id="${targetId}"]`);
  if (!target) {
    // el original está más arriba de lo cargado o fue limpiado
    return;
  }
  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  target.classList.add('flash');
  setTimeout(() => target.classList.remove('flash'), 1200);
}

// Emojis rápidos para reaccionar (los primeros del set) + acceso a más
const REACT_QUICK = ['❤️','👍','😂','😮','😢','🙏'];

// Menú flotante con Reacciones + Responder / Reenviar / Editar / Borrar
function abrirMenuMensaje(msgId) {
  const m = msgCache[msgId];
  if (!m || m.deleted_at) return;
  const mine = m.sender_id === currentUser.id;
  const overlay = document.createElement('div');
  overlay.className = 'msg-menu-overlay';
  overlay.innerHTML = `
    <div class="msg-menu">
      <div class="react-row">
        ${REACT_QUICK.map(e => `<button class="react-emoji" data-e="${e}">${e}</button>`).join('')}
        <button class="react-emoji more" id="reactMore">➕</button>
      </div>
      <button id="mmReply">↩️ Responder</button>
      <button id="mmForward">↪️ Reenviar</button>
      <button id="mmSelect">☑️ Seleccionar</button>
      ${mine && m.content ? `<button id="mmEdit">✏️ Editar</button>` : ''}
      <button id="mmDelete" class="danger">🗑️ Borrar</button>
      <button id="mmCancel" class="secondary">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById('mmCancel').onclick = close;
  document.getElementById('mmReply').onclick = () => { close(); iniciarRespuesta(m); };
  document.getElementById('mmForward').onclick = () => { close(); abrirReenviar(m); };
  const editBtn = document.getElementById('mmEdit');
  if (editBtn) editBtn.onclick = () => { close(); editarMensaje(m); };
  const delBtn = document.getElementById('mmDelete');
  if (delBtn) delBtn.onclick = () => { close(); borrarMensaje(m); };
  document.getElementById('mmSelect').onclick = () => { close(); entrarModoSeleccion(m.id); };
  // Reacciones rápidas
  overlay.querySelectorAll('.react-emoji[data-e]').forEach(b =>
    b.onclick = () => { close(); reaccionar(m.id, b.dataset.e); });
  // "Más" emojis: abre una rejilla con todo el set
  document.getElementById('reactMore').onclick = () => {
    close();
    abrirSelectorReaccion(m.id);
  };
}

function abrirSelectorReaccion(msgId) {
  const overlay = document.createElement('div');
  overlay.className = 'msg-menu-overlay';
  overlay.innerHTML = `
    <div class="msg-menu">
      <div class="react-grid">
        ${EMOJIS.map(e => `<button class="emoji" data-e="${e}">${e}</button>`).join('')}
      </div>
      <button id="rsCancel" class="secondary">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById('rsCancel').onclick = close;
  overlay.querySelectorAll('.emoji[data-e]').forEach(b =>
    b.onclick = () => { close(); reaccionar(msgId, b.dataset.e); });
}

// Aplica/cambia/quita mi reacción a un mensaje
async function reaccionar(msgId, emoji) {
  // si ya tenía la misma reacción, la quito (toggle)
  const mis = reactionsCache[msgId]?.find(r => r.user_id === currentUser.id);
  if (mis && mis.emoji === emoji) {
    await sb.from('message_reactions').delete()
      .eq('message_id', msgId).eq('user_id', currentUser.id);
  } else {
    await sb.from('message_reactions')
      .upsert({ message_id: msgId, user_id: currentUser.id, emoji },
              { onConflict: 'message_id,user_id' });
  }
  await cargarReacciones();
  repintarReacciones(msgId);
}

// --- EDITAR ---
async function editarMensaje(m) {
  const nuevo = prompt('Editar mensaje:', m.content || '');
  if (nuevo === null) return;            // canceló
  const texto = nuevo.trim();
  if (!texto || texto === m.content) return;
  const { error } = await sb.from('messages')
    .update({ content: texto, edited_at: new Date().toISOString() })
    .eq('id', m.id);
  if (error) { alert('No se pudo editar: ' + error.message); return; }
  // el UPDATE en realtime refrescará la burbuja
}

// --- BORRAR (suave) ---
async function borrarMensaje(m) {
  const mine = m.sender_id === currentUser.id;
  // Diálogo con opciones: "para mí" siempre; "para todos" solo si es mío
  const overlay = document.createElement('div');
  overlay.className = 'msg-menu-overlay';
  overlay.innerHTML = `
    <div class="msg-menu">
      <p class="del-title">¿Eliminar mensaje?</p>
      <button id="delMe">Eliminar para mí</button>
      ${mine ? `<button id="delAll" class="danger">Eliminar para todos</button>` : ''}
      <button id="delCancel" class="secondary">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById('delCancel').onclick = close;

  // Eliminar para mí: lo oculto solo en mi vista
  document.getElementById('delMe').onclick = async () => {
    close();
    const { error } = await sb.from('message_hides')
      .upsert({ message_id: m.id, user_id: currentUser.id }, { onConflict: 'message_id,user_id' });
    if (error) { alert('No se pudo eliminar: ' + error.message); return; }
    document.querySelector(`.bubble[data-id="${m.id}"]`)?.remove();
  };

  // Eliminar para todos: borrado suave (lo ve borrado todo el mundo)
  const allBtn = document.getElementById('delAll');
  if (allBtn) allBtn.onclick = async () => {
    close();
    const { error } = await sb.from('messages')
      .update({ deleted_at: new Date().toISOString(), content: null,
                attachment_path: null, attachment_name: null,
                attachment_type: null, attachment_size: null })
      .eq('id', m.id);
    if (error) { alert('No se pudo borrar: ' + error.message); return; }
  };
}

// --- RESPONDER ---
function iniciarRespuesta(m) {
  const preview = m.content
    ? m.content.slice(0, 80)
    : (m.attachment_type?.startsWith('image/') ? '📷 Foto' : '📎 Archivo');
  const author = (m.sender_id === currentUser.id)
    ? 'Tú'
    : (memberNames[m.sender_id] || activeChatName || '');
  replyingTo = { id: m.id, preview, author };
  mostrarBarraRespuesta();
  document.getElementById('msgInput')?.focus();
}

function mostrarBarraRespuesta() {
  let bar = document.getElementById('replyBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'replyBar';
    bar.className = 'reply-bar';
    const composer = document.querySelector('.composer');
    composer.parentNode.insertBefore(bar, composer);
  }
  bar.innerHTML = `
    <div class="reply-bar-content">
      <span class="reply-bar-author">${esc(replyingTo.author)}</span>
      <span class="reply-bar-text">${esc(replyingTo.preview)}</span>
    </div>
    <button id="cancelReply" class="link">✕</button>`;
  document.getElementById('cancelReply').onclick = cancelarRespuesta;
}

function cancelarRespuesta() {
  replyingTo = null;
  document.getElementById('replyBar')?.remove();
}

// --- REENVIAR ---
async function abrirReenviar(m) {
  // lista de destinos: contactos + grupos
  const { data: profiles } = await sb.from('profiles').select('id, display_name, avatar_url, avatar_version').neq('id', currentUser.id).order('display_name');
  const { data: myMem } = await sb.from('group_members').select('group_id').eq('user_id', currentUser.id);
  const gids = (myMem || []).map(x => x.group_id);
  let groups = [];
  if (gids.length) { const { data } = await sb.from('groups').select('id, name, avatar_url, avatar_version').in('id', gids); groups = data || []; }

  const overlay = document.createElement('div');
  overlay.className = 'fwd-overlay';
  overlay.innerHTML = `
    <div class="fwd-box">
      <p class="crop-title">Reenviar a…</p>
      <div class="fwd-list">
        ${groups.map(g => `<div class="fwd-item" data-type="group" data-id="${g.id}">
          ${avatarUrl(g) ? `<img class="avatar-img sm" src="${esc(avatarUrl(g))}">` : `<div class="avatar sm group-av">${esc((g.name||'?')[0])}</div>`}
          <span>${esc(g.name)}</span></div>`).join('')}
        ${profiles.map(p => `<div class="fwd-item" data-type="user" data-id="${p.id}">
          ${avatarUrl(p) ? `<img class="avatar-img sm" src="${esc(avatarUrl(p))}">` : `<div class="avatar sm">${esc((p.display_name||'?')[0])}</div>`}
          <span>${esc(p.display_name)}</span></div>`).join('')}
      </div>
      <button id="fwdCancel" class="secondary">Cancelar</button>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById('fwdCancel').onclick = close;
  overlay.querySelectorAll('.fwd-item').forEach(it => {
    it.onclick = async () => {
      await reenviarMensaje(m, it.dataset.type, it.dataset.id);
      close();
      alert('Mensaje reenviado ✓');
    };
  });
}

async function reenviarMensaje(m, destType, destId) {
  // copia contenido y, si hay archivo, copia el archivo a una ruta nueva
  const row = { sender_id: currentUser.id, content: m.content || null };
  if (destType === 'group') row.group_id = destId;
  else row.recipient_id = destId;

  if (m.attachment_path) {
    try {
      // descarga el original y lo sube como archivo nuevo del usuario
      const { data: file } = await sb.storage.from('attachments').download(m.attachment_path);
      if (file) {
        const safeName = (m.attachment_name || 'archivo').replace(/[^\w.\-]/g, '_');
        const newPath = `${currentUser.id}/${Date.now()}-${safeName}`;
        await sb.storage.from('attachments').upload(newPath, file, { contentType: m.attachment_type || 'application/octet-stream' });
        row.attachment_path = newPath;
        row.attachment_name = m.attachment_name;
        row.attachment_type = m.attachment_type;
        row.attachment_size = m.attachment_size;
      }
    } catch (e) { console.warn('No se pudo copiar el archivo al reenviar:', e); }
  }
  const { data } = await sb.from('messages').insert(row).select().single();
  if (data) pintarMensajePropio(data);
}

async function hydrateAttachments(box) {
  for (const el of box.querySelectorAll('.attach-img')) {
    const path = el.dataset.path;
    const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      el.innerHTML = `<img src="${data.signedUrl}" alt="adjunto" loading="lazy">`;
      el.querySelector('img').onclick = () => window.open(data.signedUrl, '_blank');
    } else { el.innerHTML = '<span class="loading">No disponible</span>'; }
  }
  for (const el of box.querySelectorAll('.attach-file')) {
    const path = el.dataset.path;
    const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600);
    if (data?.signedUrl) { el.href = data.signedUrl; el.target = '_blank'; }
  }
  // Notas de voz: cargar URL y enganchar play/pausa
  for (const el of box.querySelectorAll('.voice-note')) {
    if (el.dataset.ready) continue;       // ya enganchada
    const path = el.dataset.path;
    const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600);
    if (!data?.signedUrl) continue;
    el.dataset.ready = '1';
    const audio = new Audio(data.signedUrl);
    const btn = el.querySelector('.voice-play');
    btn.onclick = () => {
      // pausa cualquier otra nota que esté sonando
      document.querySelectorAll('.voice-note').forEach(otra => {
        if (otra !== el && otra._audio && !otra._audio.paused) {
          otra._audio.pause();
          otra.querySelector('.voice-play').textContent = '▶️';
        }
      });
      if (audio.paused) { audio.play(); btn.textContent = '⏸️'; }
      else { audio.pause(); btn.textContent = '▶️'; }
    };
    audio.onended = () => { btn.textContent = '▶️'; };
    el._audio = audio;
  }
}

function onFilePicked(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > MAX_FILE_BYTES) {
    alert(`El archivo supera el máximo de 10 MB (pesa ${formatSize(file.size)}).`);
    e.target.value = ''; return;
  }
  pendingFile = file;
  const preview = document.getElementById('filePreview');
  preview.classList.remove('hidden');
  preview.innerHTML = `<span>📎 ${esc(file.name)} <small>${formatSize(file.size)}</small></span><button id="cancelFile" class="link">✕</button>`;
  document.getElementById('cancelFile').onclick = clearPendingFile;
}

function clearPendingFile() {
  pendingFile = null;
  const fi = document.getElementById('fileInput');
  if (fi) fi.value = '';
  const preview = document.getElementById('filePreview');
  if (preview) { preview.classList.add('hidden'); preview.innerHTML = ''; }
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const content = input.value.trim();
  if (!content && !pendingFile) return;
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  let attachment = null;
  if (pendingFile) {
    try {
      const safeName = pendingFile.name.replace(/[^\w.\-]/g, '_');
      const path = `${currentUser.id}/${Date.now()}-${safeName}`;
      const { error: upErr } = await sb.storage.from('attachments')
        .upload(path, pendingFile, { contentType: pendingFile.type || 'application/octet-stream' });
      if (upErr) throw upErr;
      attachment = {
        attachment_path: path, attachment_name: pendingFile.name,
        attachment_type: pendingFile.type || 'application/octet-stream', attachment_size: pendingFile.size
      };
    } catch (err) {
      alert('No se pudo subir el archivo: ' + err.message);
      sendBtn.disabled = false; return;
    }
  }

  input.value = '';
  const panel = document.getElementById('emojiPanel');
  if (panel) panel.classList.add('hidden');

  const row = {
    sender_id: currentUser.id,
    content: content || null,
    ...(attachment || {})
  };
  if (activeIsGroup) row.group_id = activeChat;
  else row.recipient_id = activeChat;

  // Si estoy respondiendo, adjunta la cita
  if (replyingTo) {
    row.reply_to = replyingTo.id;
    row.reply_preview = replyingTo.preview;
    row.reply_author = replyingTo.author;
  }

  const { data: inserted } = await sb.from('messages').insert(row).select().single();
  if (inserted) pintarMensajePropio(inserted);
  cancelarRespuesta();
  clearPendingFile();
  sendBtn.disabled = false;
}

// Realtime para la LISTA de contactos: refresca contadores al llegar mensajes
let listaRefreshTimer = null;
function refrescarListaPronto() {
  clearTimeout(listaRefreshTimer);
  listaRefreshTimer = setTimeout(() => { if (!activeChat) renderChats(); }, 400);
}

function suscribirLista() {
  cancelarLista();
  listaChannel = sb.channel('lista-' + currentUser.id)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const m = payload.new;
      if (m.recipient_id === currentUser.id && m.sender_id !== currentUser.id) {
        refrescarListaPronto();
      }
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, () => {
      refrescarListaPronto();
    })
    .subscribe();
}

function cancelarLista() {
  if (listaChannel) { sb.removeChannel(listaChannel); listaChannel = null; }
}

function subscribe() {  // Nombre de canal COMPARTIDO y CORTO. Concatenar dos UUIDs da un topic
  // muy largo que rompe postgres_changes; usamos un hash corto y estable.
  let canalNombre;
  if (activeIsGroup) {
    canalNombre = 'g' + hashCorto(activeChat);
  } else {
    const par = [currentUser.id, activeChat].sort();
    canalNombre = 'd' + hashCorto(par[0] + par[1]);
  }
  channel = sb.channel(canalNombre)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const m = payload.new;
      let relevant;
      if (activeIsGroup) {
        relevant = m.group_id === activeChat;
      } else {
        relevant = (m.sender_id === currentUser.id && m.recipient_id === activeChat) ||
                   (m.sender_id === activeChat && m.recipient_id === currentUser.id);
      }
      if (!relevant) return;
      if (document.querySelector(`.bubble[data-id="${m.id}"]`)) return; // ya pintado (yo lo envié)
      msgCache[m.id] = m;
      const box = document.getElementById('messages');
      box.insertAdjacentHTML('beforeend', renderBubble(m));
      box.scrollTop = box.scrollHeight;
      hydrateAttachments(box);
      attachLongPress(box);
      // si me lo enviaron a mí, marcarlo leído (estoy viendo el chat)
      if (!activeIsGroup && m.sender_id === activeChat) marcarLeidos();
    })
    // UPDATE: palomitas (read_at), ediciones y borrados en vivo
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, payload => {
      const m = payload.new;
      let relevant;
      if (activeIsGroup) relevant = m.group_id === activeChat;
      else relevant = (m.sender_id === currentUser.id && m.recipient_id === activeChat) ||
                      (m.sender_id === activeChat && m.recipient_id === currentUser.id);
      if (!relevant) return;
      msgCache[m.id] = m;
      // re-renderiza esa burbuja en su sitio
      const old = document.querySelector(`.bubble[data-id="${m.id}"]`);
      if (old) {
        const tmp = document.createElement('div');
        tmp.innerHTML = renderBubble(m);
        const nuevo = tmp.firstElementChild;
        old.replaceWith(nuevo);
        const box = document.getElementById('messages');
        hydrateAttachments(box);
        attachLongPress(box);
      }
    })
    // "Está escribiendo…" — señal efímera (no se guarda en base)
    .on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (payload.userId === currentUser.id) return; // no a mí mismo
      mostrarEscribiendo(payload.name);
    })
    // Reacciones en vivo: al cambiar message_reactions, recargar y repintar
    .on('postgres_changes', { event: '*', schema: 'public', table: 'message_reactions' }, async () => {
      await cargarReacciones();
      for (const id of Object.keys(msgCache)) repintarReacciones(id);
    })
    .subscribe((status) => {
      channelReady = (status === 'SUBSCRIBED');
    });
}

function unsubscribe() {
  if (channel) { sb.removeChannel(channel); channel = null; }
  channelReady = false;
  document.getElementById('typingInd')?.remove();
  clearTimeout(typingHideTimer);
}

// === HELPERS ===
const val = id => document.getElementById(id).value;
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
// Pone el número de no leídos en el ícono de la app (PWA instalada).
function actualizarBadge(n) {
  try {
    if (n > 0 && navigator.setAppBadge) navigator.setAppBadge(n);
    else if (navigator.clearAppBadge) navigator.clearAppBadge();
  } catch (_) { /* navegador sin soporte: ignorar */ }
}
// Hash corto y estable (para nombres de canal): convierte un texto largo
// en un número compacto en base36. Mismo input => mismo output en ambos lados.
function hashCorto(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h).toString(36);
}
// Arma la URL del avatar con ?v=version para evitar caché del navegador.
// Recibe el objeto de perfil (con avatar_url y avatar_version).
function avatarUrl(profile) {
  if (!profile?.avatar_url) return '';
  const v = profile.avatar_version || 0;
  return `${profile.avatar_url}?v=${v}`;
}
function showMsg(t, isError = true) { const m = document.getElementById('msg'); m.textContent = t; m.className = isError ? 'error' : 'ok'; }
function formatSize(bytes) {
  if (!bytes) return '';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

// ============================================================
//  LLAMADAS Y VIDEOLLAMADAS (WebRTC 1-a-1)
// ============================================================

// --- Configuración de servidores ICE ---
// STUN gratis (Google). El TURN lo necesitas para que funcione en datos
// móviles / redes difíciles. Pega aquí tus credenciales de Metered/Cloudflare.
const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  // === PEGA AQUÍ TUS CREDENCIALES TURN (ejemplo Metered) ===
  // { urls: 'turn:a.relay.metered.ca:80', username: 'hb.ricardo@outlook.com', credential: 'RicYes13#*' },
  // { urls: 'turn:a.relay.metered.ca:443', username: 'hb.ricardo@outlook.com', credential: 'RicYes13#*' },
  // { urls: 'turn:a.relay.metered.ca:443?transport=tcp', username: 'hb.ricardo@outlook.com', credential: 'RicYes13#*' },
];

let pc = null;                 // RTCPeerConnection actual
let localStream = null;        // mi cámara/micrófono
let remoteStream = null;       // el del otro
let callChannel = null;        // canal de señalización con el otro
let callPeerId = null;         // id del otro en la llamada
let callKind = 'audio';        // 'audio' | 'video'
let callRole = null;           // 'caller' | 'callee'
let callTimer = null, callSeconds = 0;
let callRingTimeout = null;
let ringAudio = null;

// Canal global del usuario para RECIBIR llamadas entrantes (siempre activo)
let inboxChannel = null;

function iniciarInbox() {
  if (inboxChannel || !currentUser) return;
  inboxChannel = sb.channel('inbox-' + currentUser.id)
    .on('broadcast', { event: 'call-offer' }, ({ payload }) => {
      // me están llamando
      if (pc) { // ya estoy en llamada: rechazar ocupado
        enviarSenal(payload.from, 'call-busy', {});
        return;
      }
      recibirLlamada(payload);
    })
    .subscribe();
}

function pararInbox() {
  if (inboxChannel) { sb.removeChannel(inboxChannel); inboxChannel = null; }
}

// Canal de señalización entre dos personas (nombre compartido por hash)
function abrirCanalSenal(otherId) {
  const par = [currentUser.id, otherId].sort();
  const nombre = 'call-' + hashCorto(par[0] + par[1]);
  callChannel = sb.channel(nombre);
  callChannel
    .on('broadcast', { event: 'call-answer' }, ({ payload }) => onAnswer(payload))
    .on('broadcast', { event: 'call-ice' }, ({ payload }) => onRemoteIce(payload))
    .on('broadcast', { event: 'call-reject' }, () => {
      // si yo era quien llamaba, registrar como perdida/rechazada
      if (callRole === 'caller') registrarPerdida(callPeerId);
      finalizarLlamada('rechazada');
    })
    .on('broadcast', { event: 'call-busy' }, () => { finalizarLlamada('ocupado'); })
    .on('broadcast', { event: 'call-end' }, () => { finalizarLlamada('colgó'); })
    .subscribe();
}

// Envía una señal puntual al inbox del otro (para la oferta inicial)
function enviarSenal(toUserId, event, payload) {
  const ch = sb.channel('inbox-' + toUserId);
  ch.subscribe((status) => {
    if (status === 'SUBSCRIBED') {
      ch.send({ type: 'broadcast', event, payload: { ...payload, from: currentUser.id } })
        .finally(() => setTimeout(() => sb.removeChannel(ch), 500));
    }
  });
}

function crearPeerConnection() {
  pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
  remoteStream = new MediaStream();

  pc.ontrack = (e) => {
    e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
    const rv = document.getElementById('remoteVideo');
    if (rv) rv.srcObject = remoteStream;
  };
  pc.onicecandidate = (e) => {
    if (e.candidate && callChannel) {
      callChannel.send({ type: 'broadcast', event: 'call-ice',
        payload: { candidate: e.candidate, from: currentUser.id } });
    }
  };
  pc.onconnectionstatechange = () => {
    if (pc && (pc.connectionState === 'failed' || pc.connectionState === 'disconnected')) {
      finalizarLlamada('conexión perdida');
    }
  };
}

async function obtenerMedios(kind) {
  const constraints = kind === 'video'
    ? { audio: true, video: { facingMode: 'user' } }
    : { audio: true, video: false };
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  return localStream;
}

// === INICIAR (yo llamo) ===
async function iniciarLlamada(otherId, otherName, otherAvatar, kind) {
  if (pc) { alert('Ya hay una llamada en curso.'); return; }
  callPeerId = otherId; callKind = kind; callRole = 'caller';
  try {
    await obtenerMedios(kind);
  } catch (err) {
    alert('Necesito permiso de ' + (kind === 'video' ? 'cámara y micrófono' : 'micrófono') + '.');
    return;
  }
  abrirCanalSenal(otherId);
  crearPeerConnection();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  mostrarPantallaLlamada(otherName, otherAvatar, 'Llamando…');
  sonarTono('saliente');

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  // mandar la oferta al inbox del otro (app abierta)
  enviarSenal(otherId, 'call-offer', {
    sdp: offer, kind, callerName: currentProfile?.display_name || 'Alguien',
    callerAvatar: otherAvatar || ''
  });

  // push de "llamada entrante" PRIMERO (por si tiene la app cerrada),
  // para que no dependa de que otras operaciones tengan éxito.
  try {
    const r = await fetch(`${SUPABASE_URL}/functions/v1/send-call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SUPABASE_KEY}` },
      body: JSON.stringify({ calleeId: otherId, callerId: currentUser.id,
        callerName: currentProfile?.display_name || 'Alguien', kind })
    });
    console.log('send-call status:', r.status, await r.clone().text());
  } catch (e) {
    console.error('Error enviando push de llamada:', e);
  }

  // registrar la llamada (historial) — si falla, no debe afectar la llamada
  try {
    await sb.from('calls').insert({ caller_id: currentUser.id, callee_id: otherId, kind, status: 'ringing' });
  } catch (e) {
    console.warn('No se pudo registrar la llamada en historial:', e);
  }

  // si en 35s no contestan, marcar perdida
  callRingTimeout = setTimeout(() => {
    if (pc && callRole === 'caller' && (!pc.remoteDescription)) {
      registrarPerdida(otherId);
      finalizarLlamada('sin respuesta');
    }
  }, 35000);
}

// === RECIBIR (me llaman) ===
function recibirLlamada(payload) {
  callPeerId = payload.from; callKind = payload.kind; callRole = 'callee';
  pendingOffer = payload.sdp;
  // Abrir YA el canal de señalización compartido, para poder responder
  // (aceptar o rechazar) por la misma vía que escucha quien llama.
  abrirCanalSenal(callPeerId);
  mostrarLlamadaEntrante(payload.callerName || 'Alguien', payload.kind);
  sonarTono('entrante');
}

let pendingOffer = null;

async function aceptarLlamada() {
  detenerTono();
  try {
    await obtenerMedios(callKind);
  } catch (err) {
    alert('Necesito permiso de micrófono/cámara.');
    rechazarLlamada();
    return;
  }
  // el canal ya se abrió en recibirLlamada; no reabrir
  if (!callChannel) abrirCanalSenal(callPeerId);
  crearPeerConnection();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));

  await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  callChannel.send({ type: 'broadcast', event: 'call-answer',
    payload: { sdp: answer, from: currentUser.id } });

  mostrarPantallaLlamada(document.getElementById('incomingName')?.textContent || 'Llamada', '', 'Conectando…');
  iniciarContador();
}

function rechazarLlamada() {
  detenerTono();
  // Enviar el rechazo y cerrar tras un pequeño margen para que la señal salga.
  const cerrar = () => cerrarTodoLlamada();
  if (callChannel && callChannel.state === 'joined') {
    callChannel.send({ type: 'broadcast', event: 'call-reject', payload: { from: currentUser.id } })
      .finally(() => setTimeout(cerrar, 150));
  } else if (callChannel) {
    // canal aún no listo: esperar a que se una y entonces enviar
    let intentos = 0;
    const t = setInterval(() => {
      intentos++;
      if (callChannel && callChannel.state === 'joined') {
        callChannel.send({ type: 'broadcast', event: 'call-reject', payload: { from: currentUser.id } })
          .finally(() => setTimeout(cerrar, 150));
        clearInterval(t);
      } else if (intentos > 8) { clearInterval(t); cerrar(); }
    }, 150);
  } else {
    cerrar();
  }
}

// El que llamó recibe la respuesta
async function onAnswer(payload) {
  detenerTono();
  if (callRingTimeout) { clearTimeout(callRingTimeout); callRingTimeout = null; }
  if (!pc) return;
  await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
  const estado = document.getElementById('callStatus');
  if (estado) estado.textContent = 'Conectado';
  iniciarContador();
}

// Registra una llamada perdida como mensaje en el chat
async function registrarPerdida(otherId) {
  try {
    await sb.from('messages').insert({
      sender_id: currentUser.id,
      recipient_id: otherId,
      content: callKind === 'video' ? '📹 Videollamada perdida' : '📞 Llamada perdida'
    });
  } catch (_) {}
}

async function onRemoteIce(payload) {
  if (payload.from === currentUser.id) return;
  if (!pc) return;
  try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); } catch (_) {}
}

// === COLGAR / FINALIZAR ===
function colgar() {
  if (callChannel && callChannel.state === 'joined') {
    callChannel.send({ type: 'broadcast', event: 'call-end', payload: { from: currentUser.id } })
      .finally(() => finalizarLlamada('terminada'));
    // por si el finally tarda, cerrar igual tras un margen
    setTimeout(() => finalizarLlamada('terminada'), 300);
  } else {
    finalizarLlamada('terminada');
  }
}

function finalizarLlamada(motivo) {
  detenerTono();
  cerrarTodoLlamada();
}

function cerrarTodoLlamada() {
  if (callTimer) { clearInterval(callTimer); callTimer = null; }
  if (callRingTimeout) { clearTimeout(callRingTimeout); callRingTimeout = null; }
  callSeconds = 0;
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (pc) { pc.close(); pc = null; }
  if (callChannel) { sb.removeChannel(callChannel); callChannel = null; }
  remoteStream = null; callPeerId = null; pendingOffer = null; callRole = null;
  document.getElementById('callOverlay')?.remove();
  document.getElementById('incomingOverlay')?.remove();
}

// === Tono de llamada ===
function sonarTono(tipo) {
  // beep simple generado, para no depender de archivos
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ringAudio = ctx;
    const beep = () => {
      if (!ringAudio) return;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.connect(g); g.connect(ctx.destination);
      o.frequency.value = tipo === 'entrante' ? 520 : 440;
      g.gain.value = 0.1;
      o.start(); o.stop(ctx.currentTime + 0.4);
    };
    beep();
    ringAudio._interval = setInterval(beep, 2000);
  } catch (_) {}
}

function detenerTono() {
  if (ringAudio) {
    clearInterval(ringAudio._interval);
    try { ringAudio.close(); } catch (_) {}
    ringAudio = null;
  }
}

function iniciarContador() {
  callSeconds = 0;
  callTimer = setInterval(() => {
    callSeconds++;
    const el = document.getElementById('callStatus');
    if (el) el.textContent = `${Math.floor(callSeconds/60)}:${String(callSeconds%60).padStart(2,'0')}`;
  }, 1000);
}

// === Pantallas ===
function mostrarLlamadaEntrante(nombre, kind) {
  const ov = document.createElement('div');
  ov.id = 'incomingOverlay';
  ov.className = 'call-overlay';
  ov.innerHTML = `
    <div class="call-box">
      <div class="call-avatar">${esc(nombre[0] || '?')}</div>
      <div class="call-name" id="incomingName">${esc(nombre)}</div>
      <div class="call-sub">${kind === 'video' ? '📹 Videollamada' : '📞 Llamada'} entrante…</div>
      <div class="call-actions">
        <button class="call-btn reject" id="incReject">📵 Rechazar</button>
        <button class="call-btn accept" id="incAccept">✅ Aceptar</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById('incAccept').onclick = () => { ov.remove(); aceptarLlamada(); };
  document.getElementById('incReject').onclick = () => { ov.remove(); rechazarLlamada(); };
}

function mostrarPantallaLlamada(nombre, avatar, estadoTxt) {
  document.getElementById('incomingOverlay')?.remove();
  const ov = document.createElement('div');
  ov.id = 'callOverlay';
  ov.className = 'call-overlay active';
  ov.innerHTML = `
    <div class="call-videos ${callKind === 'video' ? '' : 'audio-only'}">
      <video id="remoteVideo" autoplay playsinline></video>
      <video id="localVideo" autoplay playsinline muted></video>
      <div class="call-info">
        <div class="call-name">${esc(nombre)}</div>
        <div class="call-sub" id="callStatus">${esc(estadoTxt)}</div>
      </div>
    </div>
    <div class="call-controls">
      <button class="call-btn" id="btnMute" title="Silenciar">🎤</button>
      ${callKind === 'video' ? `<button class="call-btn" id="btnCam" title="Cámara">📹</button>` : ''}
      <button class="call-btn reject" id="btnHangup" title="Colgar">📴</button>
    </div>`;
  document.body.appendChild(ov);
  const lv = document.getElementById('localVideo');
  if (lv && localStream) lv.srcObject = localStream;
  document.getElementById('btnHangup').onclick = colgar;
  document.getElementById('btnMute').onclick = toggleMute;
  const camBtn = document.getElementById('btnCam');
  if (camBtn) camBtn.onclick = toggleCam;
}

function toggleMute() {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (track) { track.enabled = !track.enabled;
    document.getElementById('btnMute').classList.toggle('off', !track.enabled);
  }
}

function toggleCam() {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (track) { track.enabled = !track.enabled;
    document.getElementById('btnCam').classList.toggle('off', !track.enabled);
  }
}

init();
