// === CONFIG: reemplaza con tus credenciales de Supabase ===
const VAPID_PUBLIC = 'BFG1DmrLliLlDmMFJ7r67yJmgffaZBO5zi9ig0HSEwx41Xf6ip1lte_R9IeY9Nx-i5E3A0H2DnhACHyd3SEm9Pc';
const SUPABASE_URL = 'https://zgkcmxfwgxsvtqjteusi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpna2NteGZ3Z3hzdnRxanRldXNpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE1NjQ3MTQsImV4cCI6MjA5NzE0MDcxNH0.icft1DynZVyDuIvyef_WxMB3qg20Pa1qYhJjWWU7qCo';
const EMAIL_DOMAIN = 'familia.local'; // usuario -> usuario@familia.local

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
const app = document.getElementById('app');
let currentUser = null, currentProfile = null, activeChat = null, channel = null;

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

const userToEmail = u => `${u.toLowerCase().trim()}@${EMAIL_DOMAIN}`;

// === NOTIFICACIONES PUSH ===
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - base64.length % 4) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(b64);
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

async function setupPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
  if (VAPID_PUBLIC.startsWith('TU_')) return; // aún no configuras la clave
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
    // guardar (upsert evita duplicados)
    const { error } = await sb.from('push_subscriptions')
      .upsert({ user_id: currentUser.id, subscription: sub.toJSON() },
              { onConflict: 'user_id,subscription' });
    if (error) console.warn('No se pudo guardar la suscripción:', error);
    else console.log('Suscripción push guardada ✓');
  } catch (e) {
    console.warn('No se pudo configurar push:', e);
  }
}

// === AUTH ===
async function init() {
  const { data } = await sb.auth.getSession();
  if (data.session) {
    currentUser = data.session.user;
    await loadProfile();
    renderChats();
    setupPush();
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
}

async function logout() { await sb.auth.signOut(); location.reload(); }

// === LISTA DE CONTACTOS ===
async function renderChats() {
  const { data: profiles } = await sb.from('profiles').select('*').neq('id', currentUser.id).order('display_name');
  app.innerHTML = `
    <div class="header">
      <span>Hola, ${esc(currentProfile.display_name)}</span>
      <button class="link" id="logoutBtn">Salir</button>
    </div>
    <div class="contacts">
      ${profiles.map(p => `<div class="contact" data-id="${p.id}" data-name="${esc(p.display_name)}">
        <div class="avatar">${esc(p.display_name[0] || '?')}</div>
        <span>${esc(p.display_name)}</span></div>`).join('') || '<p class="empty">Aún no hay otros usuarios.</p>'}
    </div>`;
  document.getElementById('logoutBtn').onclick = logout;
  document.querySelectorAll('.contact').forEach(c =>
    c.onclick = () => openChat(c.dataset.id, c.dataset.name));
}

// === CHAT ===
async function openChat(otherId, otherName) {
  activeChat = otherId;
  app.innerHTML = `
    <div class="header">
      <button class="link" id="backBtn">←</button>
      <span>${esc(otherName)}</span>
    </div>
    <div class="messages" id="messages"></div>
    <div class="composer">
      <input id="msgInput" placeholder="Mensaje..." autocomplete="off">
      <button id="sendBtn">Enviar</button>
    </div>`;
  document.getElementById('backBtn').onclick = () => { unsubscribe(); renderChats(); };
  document.getElementById('sendBtn').onclick = sendMessage;
  document.getElementById('msgInput').addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  await loadMessages();
  subscribe();
}

async function loadMessages() {
  const { data } = await sb.from('messages').select('*')
    .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${activeChat}),and(sender_id.eq.${activeChat},recipient_id.eq.${currentUser.id})`)
    .order('created_at');
  const box = document.getElementById('messages');
  box.innerHTML = data.map(renderBubble).join('');
  box.scrollTop = box.scrollHeight;
}

function renderBubble(m) {
  const mine = m.sender_id === currentUser.id;
  return `<div class="bubble ${mine ? 'mine' : 'theirs'}">${esc(m.content)}</div>`;
}

async function sendMessage() {
  const input = document.getElementById('msgInput');
  const content = input.value.trim();
  if (!content) return;
  input.value = '';
  await sb.from('messages').insert({ sender_id: currentUser.id, recipient_id: activeChat, content });
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
    }).subscribe();
}

function unsubscribe() { if (channel) { sb.removeChannel(channel); channel = null; } }

// === HELPERS ===
const val = id => document.getElementById(id).value;
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function showMsg(t, isError = true) { const m = document.getElementById('msg'); m.textContent = t; m.className = isError ? 'error' : 'ok'; }

init();
