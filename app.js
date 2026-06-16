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

// === LISTA DE CONTACTOS ===
async function renderChats() {
  const { data: profiles } = await sb.from('profiles').select('*').neq('id', currentUser.id).order('display_name');
  const myAvatar = currentProfile?.avatar_url;
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
      ${profiles.map(p => `<div class="contact" data-id="${p.id}" data-name="${esc(p.display_name)}" data-avatar="${esc(p.avatar_url || '')}">
        ${p.avatar_url
          ? `<img class="avatar-img" src="${esc(p.avatar_url)}" alt="">`
          : `<div class="avatar">${esc((p.display_name||'?')[0])}</div>`}
        <span>${esc(p.display_name)}</span></div>`).join('') || '<p class="empty">Aún no hay otros usuarios.</p>'}
    </div>`;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('openProfile').onclick = renderProfile;
  document.querySelectorAll('.contact').forEach(c =>
    c.onclick = () => openChat(c.dataset.id, c.dataset.name, c.dataset.avatar));
}

// === PANTALLA DE PERFIL ===
function renderProfile() {
  const av = currentProfile?.avatar_url;
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
  profileMsg('Subiendo foto…');
  try {
    const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
    const path = `${currentUser.id}/avatar.${ext}`;
    // upsert: reemplaza la foto anterior
    const { error: upErr } = await sb.storage.from('avatars')
      .upload(path, file, { contentType: file.type, upsert: true });
    if (upErr) throw upErr;
    // Guarda la URL LIMPIA en la base (sin ?t=), para que sirva como ícono de push.
    const { data } = sb.storage.from('avatars').getPublicUrl(path);
    const cleanUrl = data.publicUrl;
    const { error: updErr } = await sb.from('profiles').update({ avatar_url: cleanUrl }).eq('id', currentUser.id);
    if (updErr) throw updErr;
    currentProfile.avatar_url = cleanUrl;
    // En pantalla usamos cache-buster solo para forzar refresco visual.
    const displayUrl = `${cleanUrl}?t=${Date.now()}`;
    const prev = document.getElementById('avatarPreview');
    prev.outerHTML = `<img class="avatar-lg" id="avatarPreview" src="${displayUrl}" alt="avatar">`;
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

// === CHAT ===
let activeChatName = '';
async function openChat(otherId, otherName, otherAvatar) {
  activeChat = otherId;
  activeChatName = otherName;
  pendingFile = null;
  // si no llegó el avatar, intenta obtenerlo
  if (otherAvatar === undefined) {
    const { data } = await sb.from('profiles').select('avatar_url').eq('id', otherId).single();
    otherAvatar = data?.avatar_url || '';
  }
  const avatarHtml = otherAvatar
    ? `<img class="avatar-img chat-av" src="${esc(otherAvatar)}" alt="">`
    : `<div class="avatar chat-av">${esc((otherName||'?')[0])}</div>`;
  app.innerHTML = `
    <div class="header">
      <button class="link" id="backBtn">←</button>
      ${avatarHtml}
      <span class="chat-title">${esc(otherName)}</span>
      <button class="link" id="clearBtn" title="Limpiar conversación">🗑️</button>
    </div>
    <div class="messages" id="messages"></div>
    <div id="filePreview" class="file-preview hidden"></div>
    <div class="composer">
      <button id="attachBtn" class="icon-btn" title="Adjuntar">📎</button>
      <input id="fileInput" type="file" hidden>
      <input id="msgInput" placeholder="Mensaje..." autocomplete="off">
      <button id="sendBtn">Enviar</button>
    </div>`;
  document.getElementById('backBtn').onclick = () => { unsubscribe(); renderChats(); };
  document.getElementById('clearBtn').onclick = limpiarConversacion;
  document.getElementById('sendBtn').onclick = sendMessage;
  document.getElementById('attachBtn').onclick = () => document.getElementById('fileInput').click();
  document.getElementById('fileInput').addEventListener('change', onFilePicked);
  document.getElementById('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  await loadMessages();
  subscribe();
}

// Limpiar conversación SOLO PARA MÍ: guarda la fecha y oculta lo anterior.
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
  // ¿hasta qué fecha limpié este chat? (oculta lo anterior, solo para mí)
  const { data: clear } = await sb.from('chat_clears')
    .select('cleared_at').eq('user_id', currentUser.id).eq('other_id', activeChat).maybeSingle();
  const clearedAt = clear?.cleared_at || null;

  let q = sb.from('messages').select('*')
    .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${activeChat}),and(sender_id.eq.${activeChat},recipient_id.eq.${currentUser.id})`)
    .order('created_at');
  if (clearedAt) q = q.gt('created_at', clearedAt);

  const { data } = await q;
  const box = document.getElementById('messages');
  box.innerHTML = '';
  for (const m of data) box.insertAdjacentHTML('beforeend', renderBubble(m));
  box.scrollTop = box.scrollHeight;
  hydrateAttachments(box);
}

function renderBubble(m) {
  const mine = m.sender_id === currentUser.id;
  let inner = '';
  if (m.attachment_path) {
    const isImage = (m.attachment_type || '').startsWith('image/');
    if (isImage) {
      inner += `<div class="attach-img" data-path="${esc(m.attachment_path)}"><span class="loading">Cargando imagen…</span></div>`;
    } else {
      inner += `<a class="attach-file" data-path="${esc(m.attachment_path)}" href="#">📄 ${esc(m.attachment_name || 'archivo')} <small>${formatSize(m.attachment_size)}</small></a>`;
    }
  }
  if (m.content) inner += `<div class="text">${esc(m.content)}</div>`;
  return `<div class="bubble ${mine ? 'mine' : 'theirs'}">${inner}</div>`;
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
  await sb.from('messages').insert({
    sender_id: currentUser.id, recipient_id: activeChat,
    content: content || null, ...(attachment || {})
  });
  clearPendingFile();
  sendBtn.disabled = false;
}

function subscribe() {
  channel = sb.channel('msgs-' + activeChat)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, payload => {
      const m = payload.new;
      const relevant = (m.sender_id === currentUser.id && m.recipient_id === activeChat) ||
                       (m.sender_id === activeChat && m.recipient_id === currentUser.id);
      if (!relevant) return;
      const box = document.getElementById('messages');
      box.insertAdjacentHTML('beforeend', renderBubble(m));
      box.scrollTop = box.scrollHeight;
      hydrateAttachments(box);
    }).subscribe();
}

function unsubscribe() { if (channel) { sb.removeChannel(channel); channel = null; } }

// === HELPERS ===
const val = id => document.getElementById(id).value;
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));
function showMsg(t, isError = true) { const m = document.getElementById('msg'); m.textContent = t; m.className = isError ? 'error' : 'ok'; }
function formatSize(bytes) {
  if (!bytes) return '';
  const u = ['B', 'KB', 'MB', 'GB']; let i = 0, n = bytes;
  while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${u[i]}`;
}

init();
