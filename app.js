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
  });
}

function abrirChatDesdeURL() {
  const params = new URLSearchParams(location.search);
  const chatId = params.get('chat');
  const chatName = params.get('name');
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
  if (pendingChat) { abrirChatPorId(pendingChat.id, pendingChat.name); pendingChat = null; }
}

async function logout() { await sb.auth.signOut(); location.reload(); }

// === LISTA DE CONTACTOS Y GRUPOS ===
async function renderChats() {
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
      ${profiles.map(p => {
        const av = avatarUrl(p);
        return `<div class="contact" data-id="${p.id}" data-name="${esc(p.display_name)}" data-avatar="${esc(av)}">
        ${av
          ? `<img class="avatar-img" src="${esc(av)}" alt="">`
          : `<div class="avatar">${esc((p.display_name||'?')[0])}</div>`}
        <span>${esc(p.display_name)}</span></div>`;
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
function abrirEditorRecorte(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => montarEditor(img);
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function montarEditor(img) {
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
      subirAvatar(blob);
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
function chatShell(titleHtml, withClear) {
  return `
    <div class="header">
      <button class="link" id="backBtn">←</button>
      ${titleHtml}
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
      <button id="sendBtn">Enviar</button>
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
}

// === "ESTÁ ESCRIBIENDO…" ===
let typingLastSent = 0, typingHideTimer = null;

function emitirEscribiendo() {
  const ahora = Date.now();
  if (ahora - typingLastSent < 2000) return; // no spamear
  typingLastSent = ahora;
  if (channel) {
    channel.send({
      type: 'broadcast',
      event: 'typing',
      payload: { userId: currentUser.id, name: currentProfile?.display_name || 'Alguien' }
    });
  }
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
  pendingFile = null; replyingTo = null; searchMatches = []; searchIdx = -1;
  if (otherAvatar === undefined) {
    const { data } = await sb.from('profiles').select('avatar_url, avatar_version').eq('id', otherId).single();
    otherAvatar = avatarUrl(data);
  }
  const avatarHtml = otherAvatar
    ? `<img class="avatar-img chat-av" src="${esc(otherAvatar)}" alt="">`
    : `<div class="avatar chat-av">${esc((otherName||'?')[0])}</div>`;
  app.innerHTML = chatShell(`${avatarHtml}<span class="chat-title">${esc(otherName)}</span>`, true);
  document.getElementById('backBtn').onclick = () => { unsubscribe(); renderChats(); };
  document.getElementById('clearBtn').onclick = limpiarConversacion;
  wireComposer();
  await loadMessages();
  subscribe();
}

async function openGroup(groupId, groupName, groupAvatar) {
  activeChat = groupId;
  activeChatName = groupName;
  activeIsGroup = true;
  pendingFile = null; replyingTo = null; searchMatches = []; searchIdx = -1;
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
  const { data: g } = await sb.from('groups').select('created_by').eq('id', groupId).single();
  const soyCreador = g?.created_by === currentUser.id;

  app.innerHTML = `
    <div class="header">
      <button class="link" id="backBtn">←</button>
      <span class="chat-title">${esc(groupName)}</span>
    </div>
    <div class="profile">
      <label class="field-label">Miembros (${profs.length})</label>
      <div class="member-list">
        ${profs.map(p => `<div class="member-row">
          ${avatarUrl(p) ? `<img class="avatar-img sm" src="${esc(avatarUrl(p))}">`
                         : `<div class="avatar sm">${esc((p.display_name||'?')[0])}</div>`}
          <span>${esc(p.display_name)}${p.id === currentUser.id ? ' (yo)' : ''}</span>
        </div>`).join('')}
      </div>
      <button id="leaveGroup" class="danger">Salir del grupo</button>
      <p id="giMsg" class="ok"></p>
    </div>`;
  document.getElementById('backBtn').onclick = () => openGroup(groupId, groupName, undefined);
  document.getElementById('leaveGroup').onclick = async () => {
    if (!confirm('¿Salir de este grupo? Dejarás de recibir sus mensajes.')) return;
    await sb.from('group_members').delete().eq('group_id', groupId).eq('user_id', currentUser.id);
    renderChats();
  };
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
  msgCache = {};
  for (const m of data) msgCache[m.id] = m;
  const box = document.getElementById('messages');
  box.innerHTML = '';
  for (const m of data) box.insertAdjacentHTML('beforeend', renderBubble(m));
  box.scrollTop = box.scrollHeight;
  hydrateAttachments(box);
  attachLongPress(box);
  marcarLeidos(); // marca como leídos los mensajes del otro
}

// Marca como leídos los mensajes que me envió el otro (solo 1-a-1)
async function marcarLeidos() {
  if (activeIsGroup) return;
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
    const isImage = (m.attachment_type || '').startsWith('image/');
    if (isImage) {
      inner += `<div class="attach-img" data-path="${esc(m.attachment_path)}"><span class="loading">Cargando imagen…</span></div>`;
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

  return `<div class="bubble ${mine ? 'mine' : 'theirs'}" data-id="${m.id}">${inner}</div>`;
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
    el.addEventListener('touchstart', () => start(el), { passive: true });
    el.addEventListener('touchend', cancel);
    el.addEventListener('touchmove', cancel);
    // escritorio: clic derecho
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const id = el.dataset.id;
      if (id) abrirMenuMensaje(parseInt(id));
    });
    // tocar la cita salta al mensaje original
    const quote = el.querySelector('.quote');
    if (quote && quote.dataset.target) {
      quote.addEventListener('click', (e) => {
        e.stopPropagation();
        cancel(); // evita que se dispare el long-press
        saltarAMensaje(quote.dataset.target);
      });
    }
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

// Menú flotante con Responder / Reenviar / Editar / Borrar
function abrirMenuMensaje(msgId) {
  const m = msgCache[msgId];
  if (!m || m.deleted_at) return;
  const mine = m.sender_id === currentUser.id;
  const overlay = document.createElement('div');
  overlay.className = 'msg-menu-overlay';
  overlay.innerHTML = `
    <div class="msg-menu">
      <button id="mmReply">↩️ Responder</button>
      <button id="mmForward">↪️ Reenviar</button>
      ${mine && m.content ? `<button id="mmEdit">✏️ Editar</button>` : ''}
      ${mine ? `<button id="mmDelete" class="danger">🗑️ Borrar</button>` : ''}
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
  if (!confirm('¿Borrar este mensaje para todos?')) return;
  const { error } = await sb.from('messages')
    .update({ deleted_at: new Date().toISOString(), content: null,
              attachment_path: null, attachment_name: null,
              attachment_type: null, attachment_size: null })
    .eq('id', m.id);
  if (error) { alert('No se pudo borrar: ' + error.message); return; }
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
  await sb.from('messages').insert(row);
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

  await sb.from('messages').insert(row);
  cancelarRespuesta();
  clearPendingFile();
  sendBtn.disabled = false;
}

function subscribe() {
  channel = sb.channel('msgs-' + activeChat)
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
    .subscribe();
}

function unsubscribe() {
  if (channel) { sb.removeChannel(channel); channel = null; }
  document.getElementById('typingInd')?.remove();
  clearTimeout(typingHideTimer);
}

// === HELPERS ===
const val = id => document.getElementById(id).value;
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
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

init();
