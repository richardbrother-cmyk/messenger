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
let pendingFiles = [];
let pendingChat = null; // { id, name } chat a abrir cuando haya sesión
let activeIsGroup = false; // si la conversación abierta es un grupo
let memberNames = {};      // cache id->nombre para mostrar autores en grupos
let replyingTo = null;     // { id, preview, author } mensaje al que respondo
let editandoMsg = null;    // mensaje que se está editando inline
let msgCache = {};         // id -> mensaje (para reenviar/citar sin re-consultar)
let reactionsCache = {};   // msgId -> [{user_id, emoji}]
let modoSeleccion = false;
let seleccionados = new Set();
let listaChannel = null;   // canal de realtime para la lista de contactos

// Emojis más usados para el selector simple
// Lista corta para el selector de reacciones
const EMOJIS = ['😀','😂','🥰','😍','😘','😎','🤔','😴','😭','😡','👍','👎','👏','🙏','💪','🔥','🎉','❤️','💔','✨','⭐','🌟','💯','✅','❌','🤣','😅','😉','😊','🙂','😇','🤗','🤩','😋','😜','🤪','😏','🥺','😩','😤','👋','🤝','✌️','🤞','👌','🙌','💀','👀','💩','🥳','😱','😬','🤯','🫶','💕','💖','🎂','🍕','☕','🌹'];

// Catálogo completo de emojis por categoría (para el panel del compositor)
const EMOJI_CATS = [
  { id: 'recent', ico: '🕘', label: 'Recientes' },
  { id: 'caras', ico: '😀', label: 'Caras', list: '😀 😃 😄 😁 😆 😅 🤣 😂 🙂 🙃 🫠 😉 😊 😇 🥰 😍 🤩 😘 😗 ☺️ 😚 😙 🥲 😋 😛 😜 🤪 😝 🤑 🤗 🤭 🫢 🫣 🤫 🤔 🫡 🤐 🤨 😐 😑 😶 🫥 😶‍🌫️ 😏 😒 🙄 😬 😮‍💨 🤥 🫨 😌 😔 😪 🤤 😴 😷 🤒 🤕 🤢 🤮 🤧 🥵 🥶 🥴 😵 😵‍💫 🤯 🤠 🥳 🥸 😎 🤓 🧐 😕 🫤 😟 🙁 ☹️ 😮 😯 😲 😳 🥺 🥹 😦 😧 😨 😰 😥 😢 😭 😱 😖 😣 😞 😓 😩 😫 🥱 😤 😡 😠 🤬 😈 👿 💀 ☠️ 💩 🤡 👹 👺 👻 👽 👾 🤖 😺 😸 😹 😻 😼 😽 🙀 😿 😾 🙈 🙉 🙊' },
  { id: 'gestos', ico: '👍', label: 'Gestos y personas', list: '👋 🤚 🖐️ ✋ 🖖 🫱 🫲 🫳 🫴 🫷 🫸 👌 🤌 🤏 ✌️ 🤞 🫰 🤟 🤘 🤙 👈 👉 👆 🖕 👇 ☝️ 🫵 👍 👎 ✊ 👊 🤛 🤜 👏 🙌 🫶 👐 🤲 🤝 🙏 ✍️ 💅 🤳 💪 🦾 🦿 🦵 🦶 👂 🦻 👃 🧠 🫀 🫁 🦷 🦴 👀 👁️ 👅 👄 🫦 👶 🧒 👦 👧 🧑 👱 👨 🧔 👩 🧓 👴 👵 🙍 🙎 🙅 🙆 💁 🙋 🧏 🙇 🤦 🤷 👮 🕵️ 💂 🥷 👷 🫅 🤴 👸 👳 👲 🧕 🤵 👰 🤰 🫃 🫄 🤱 👼 🎅 🤶 🦸 🦹 🧙 🧚 🧛 🧜 🧝 🧞 🧟 🧌 💆 💇 🚶 🧍 🧎 🏃 💃 🕺 🕴️ 👯 🧖 🧗 🤺 🏇 ⛷️ 🏂 🏌️ 🏄 🚣 🏊 ⛹️ 🏋️ 🚴 🚵 🤸 🤼 🤽 🤾 🤹 🧘 🛀 🛌 👭 👫 👬 💏 💑 👪 👨‍👩‍👧 👨‍👩‍👧‍👦 👨‍👩‍👦‍👦 👨‍👩‍👧‍👧 🗣️ 👤 👥 🫂' },
  { id: 'animales', ico: '🐶', label: 'Animales y naturaleza', list: '🐶 🐱 🐭 🐹 🐰 🦊 🐻 🐼 🐻‍❄️ 🐨 🐯 🦁 🐮 🐷 🐽 🐸 🐵 🐒 🐔 🐧 🐦 🐤 🐣 🐥 🦆 🦅 🦉 🦇 🐺 🐗 🐴 🦄 🐝 🪱 🐛 🦋 🐌 🐞 🐜 🪰 🪲 🪳 🦟 🦗 🕷️ 🕸️ 🦂 🐢 🐍 🦎 🦖 🦕 🐙 🦑 🦐 🦞 🦀 🐡 🐠 🐟 🐬 🐳 🐋 🦈 🐊 🐅 🐆 🦓 🦍 🦧 🦣 🐘 🦛 🦏 🐪 🐫 🦒 🦘 🦬 🐃 🐂 🐄 🐎 🐖 🐏 🐑 🦙 🐐 🦌 🐕 🐩 🦮 🐕‍🦺 🐈 🐈‍⬛ 🪶 🐓 🦃 🦤 🦚 🦜 🦢 🦩 🕊️ 🐇 🦝 🦨 🦡 🦫 🦦 🦥 🐁 🐀 🐿️ 🦔 🐾 🐉 🐲 🌵 🎄 🌲 🌳 🌴 🪵 🌱 🌿 ☘️ 🍀 🎍 🪴 🎋 🍃 🍂 🍁 🍄 🐚 🪸 🪨 🌾 💐 🌷 🪷 🌹 🥀 🌺 🌸 🌼 🌻 🌞 🌝 🌛 🌜 🌚 🌕 🌖 🌗 🌘 🌑 🌒 🌓 🌔 🌙 🌎 🌍 🌏 🪐 💫 ⭐ 🌟 ✨ ⚡ ☄️ 💥 🔥 🌪️ 🌈 ☀️ 🌤️ ⛅ 🌥️ ☁️ 🌦️ 🌧️ ⛈️ 🌩️ 🌨️ ❄️ ☃️ ⛄ 🌬️ 💨 💧 💦 🫧 ☔ ☂️ 🌊 🌫️' },
  { id: 'comida', ico: '🍔', label: 'Comida y bebida', list: '🍏 🍎 🍐 🍊 🍋 🍌 🍉 🍇 🍓 🫐 🍈 🍒 🍑 🥭 🍍 🥥 🥝 🍅 🍆 🥑 🥦 🥬 🥒 🌶️ 🫑 🌽 🥕 🫒 🧄 🧅 🥔 🍠 🫚 🥐 🥯 🍞 🥖 🥨 🧀 🥚 🍳 🧈 🥞 🧇 🥓 🥩 🍗 🍖 🌭 🍔 🍟 🍕 🫓 🥪 🥙 🧆 🌮 🌯 🫔 🥗 🥘 🫕 🥫 🍝 🍜 🍲 🍛 🍣 🍱 🥟 🦪 🍤 🍙 🍚 🍘 🍥 🥠 🥮 🍢 🍡 🍧 🍨 🍦 🥧 🧁 🍰 🎂 🍮 🍭 🍬 🍫 🍿 🍩 🍪 🌰 🥜 🫘 🍯 🥛 🍼 🫖 ☕ 🍵 🧃 🥤 🧋 🍶 🍺 🍻 🥂 🍷 🥃 🍸 🍹 🧉 🍾 🧊 🥄 🍴 🍽️ 🥣 🥡 🥢 🧂' },
  { id: 'actividades', ico: '⚽', label: 'Actividades', list: '⚽ 🏀 🏈 ⚾ 🥎 🎾 🏐 🏉 🥏 🎱 🪀 🏓 🏸 🏒 🏑 🥍 🏏 🪃 🥅 ⛳ 🪁 🏹 🎣 🤿 🥊 🥋 🎽 🛹 🛼 🛷 ⛸️ 🥌 🎿 🪂 🏆 🥇 🥈 🥉 🏅 🎖️ 🏵️ 🎗️ 🎫 🎟️ 🎪 🎭 🩰 🎨 🎬 🎤 🎧 🎼 🎹 🥁 🪘 🎷 🎺 🪗 🎸 🪕 🎻 🎲 ♟️ 🎯 🎳 🎮 🕹️ 🎰 🧩 🎉 🎊 🎈 🎁 🎀 🪅 🪩 🎏 🎐 🧧 🎎 🎑 🎃 🎄 🎆 🎇 🧨' },
  { id: 'viajes', ico: '🚗', label: 'Viajes y lugares', list: '🚗 🚕 🚙 🚌 🚎 🏎️ 🚓 🚑 🚒 🚐 🛻 🚚 🚛 🚜 🦯 🦽 🦼 🛴 🚲 🛵 🏍️ 🛺 🚨 🚔 🚍 🚘 🚖 🛞 🚡 🚠 🚟 🚃 🚋 🚞 🚝 🚄 🚅 🚈 🚂 🚆 🚇 🚊 🚉 ✈️ 🛫 🛬 🛩️ 💺 🛰️ 🚀 🛸 🚁 🛶 ⛵ 🚤 🛥️ 🛳️ ⛴️ 🚢 ⚓ 🛟 ⛽ 🚧 🚦 🚥 🚏 🗺️ 🗿 🗽 🗼 🏰 🏯 🏟️ 🎡 🎢 🎠 ⛲ ⛱️ 🏖️ 🏝️ 🏜️ 🌋 ⛰️ 🏔️ 🗻 🏕️ ⛺ 🛖 🏠 🏡 🏘️ 🏚️ 🏗️ 🏭 🏢 🏬 🏣 🏤 🏥 🏦 🏨 🏪 🏫 🏩 💒 🏛️ ⛪ 🕌 🕍 🛕 🕋 ⛩️ 🛤️ 🛣️ 🗾 🏞️ 🌅 🌄 🌠 🌇 🌆 🏙️ 🌃 🌌 🌉 🌁' },
  { id: 'objetos', ico: '💡', label: 'Objetos', list: '⌚ 📱 📲 💻 ⌨️ 🖥️ 🖨️ 🖱️ 🖲️ 💽 💾 💿 📀 📼 📷 📸 📹 🎥 📽️ 🎞️ 📞 ☎️ 📟 📠 📺 📻 🎙️ 🎚️ 🎛️ 🧭 ⏱️ ⏲️ ⏰ 🕰️ ⌛ ⏳ 📡 🔋 🪫 🔌 💡 🔦 🕯️ 🪔 🧯 🛢️ 💸 💵 💴 💶 💷 🪙 💰 💳 🧾 💎 ⚖️ 🪜 🧰 🪛 🔧 🔨 ⚒️ 🛠️ ⛏️ 🪚 🔩 ⚙️ 🪤 🧱 ⛓️ 🧲 🔫 💣 🪓 🔪 🗡️ ⚔️ 🛡️ 🚬 ⚰️ 🪦 ⚱️ 🏺 🔮 📿 🧿 🪬 💈 ⚗️ 🔭 🔬 🕳️ 🩹 🩺 🩻 🩼 💊 💉 🩸 🧬 🦠 🧫 🧪 🌡️ 🧹 🪠 🧺 🧻 🚽 🚰 🚿 🛁 🧼 🪥 🪒 🧽 🪣 🧴 🛎️ 🔑 🗝️ 🚪 🪑 🛋️ 🛏️ 🧸 🪆 🖼️ 🪞 🪟 🛍️ 🛒 🪄 🏮 ✉️ 📩 📨 📧 💌 📥 📤 📦 🏷️ 🪧 📪 📫 📬 📭 📮 📯 📜 📃 📄 📑 📊 📈 📉 🗒️ 🗓️ 📆 📅 🗑️ 📇 🗃️ 🗳️ 🗄️ 📋 📁 📂 🗂️ 🗞️ 📰 📓 📔 📒 📕 📗 📘 📙 📚 📖 🔖 🧷 🔗 📎 🖇️ 📐 📏 🧮 📌 📍 ✂️ 🖊️ 🖋️ ✒️ 🖌️ 🖍️ 📝 ✏️ 🔍 🔎 🔏 🔐 🔒 🔓 👓 🕶️ 🥽 🥼 🦺 👔 👕 👖 🧣 🧤 🧥 🧦 👗 👘 🥻 🩱 🩲 🩳 👙 👚 🪭 👛 👜 👝 🎒 🩴 👞 👟 🥾 🥿 👠 👡 👢 👑 👒 🎩 🎓 🧢 🪖 ⛑️ 💄 💍 💼' },
  { id: 'simbolos', ico: '❤️', label: 'Símbolos', list: '❤️ 🩷 🧡 💛 💚 💙 🩵 💜 🖤 🩶 🤍 🤎 💔 ❤️‍🔥 ❤️‍🩹 ❣️ 💕 💞 💓 💗 💖 💘 💝 💟 ☮️ ✝️ ☪️ 🕉️ ☸️ ✡️ 🔯 🕎 ☯️ ☦️ 🛐 ⛎ ♈ ♉ ♊ ♋ ♌ ♍ ♎ ♏ ♐ ♑ ♒ ♓ 🆔 ⚛️ ☢️ ☣️ 📴 📳 🆚 💮 🅰️ 🅱️ 🆎 🆑 🅾️ 🆘 ❌ ⭕ 🛑 ⛔ 📛 🚫 💯 💢 ♨️ 🚷 🚯 🚳 🚱 🔞 📵 🚭 ❗ ❕ ❓ ❔ ‼️ ⁉️ 🔅 🔆 〽️ ⚠️ 🚸 🔱 ⚜️ 🔰 ♻️ ✅ 💹 ❇️ ✳️ ❎ 🌐 💠 Ⓜ️ 🌀 💤 🏧 🚾 ♿ 🅿️ 🛗 🛂 🛃 🛄 🛅 🚹 🚺 🚼 ⚧️ 🚻 🚮 🎦 📶 🔣 ℹ️ 🔤 🔡 🔠 🆖 🆗 🆙 🆒 🆕 🆓 0️⃣ 1️⃣ 2️⃣ 3️⃣ 4️⃣ 5️⃣ 6️⃣ 7️⃣ 8️⃣ 9️⃣ 🔟 🔢 #️⃣ *️⃣ ⏏️ ▶️ ⏸️ ⏯️ ⏹️ ⏺️ ⏭️ ⏮️ ⏩ ⏪ ⏫ ⏬ ◀️ 🔼 🔽 ➡️ ⬅️ ⬆️ ⬇️ ↗️ ↘️ ↙️ ↖️ ↕️ ↔️ ↪️ ↩️ ⤴️ ⤵️ 🔀 🔁 🔂 🔄 🔃 🎵 🎶 ➕ ➖ ➗ ✖️ 🟰 ♾️ 💲 💱 ™️ ©️ ®️ 〰️ ➰ ➿ 🔚 🔙 🔛 🔝 🔜 ✔️ ☑️ 🔘 🔴 🟠 🟡 🟢 🔵 🟣 ⚫ ⚪ 🟤 🔺 🔻 🔸 🔹 🔶 🔷 🔳 🔲 ▪️ ▫️ ◾ ◽ ◼️ ◻️ 🟥 🟧 🟨 🟩 🟦 🟪 ⬛ ⬜ 🟫 🔈 🔇 🔉 🔊 🔔 🔕 📣 📢 💬 💭 🗯️ ♠️ ♣️ ♥️ ♦️ 🃏 🎴 🀄 🕐 🕑 🕒 🕓 🕔 🕕 🕖 🕗 🕘 🕙 🕚 🕛' },
  { id: 'banderas', ico: '🏳️', label: 'Banderas', list: '🏳️ 🏴 🏁 🚩 🏳️‍🌈 🏳️‍⚧️ 🏴‍☠️ 🇲🇽 🇺🇸 🇨🇦 🇪🇸 🇦🇷 🇧🇷 🇨🇱 🇨🇴 🇵🇪 🇻🇪 🇪🇨 🇧🇴 🇺🇾 🇵🇾 🇨🇷 🇵🇦 🇬🇹 🇭🇳 🇸🇻 🇳🇮 🇨🇺 🇩🇴 🇵🇷 🇯🇲 🇭🇹 🇧🇸 🇧🇿 🇹🇹 🇬🇾 🇸🇷 🇫🇷 🇩🇪 🇮🇹 🇬🇧 🇵🇹 🇳🇱 🇧🇪 🇨🇭 🇦🇹 🇸🇪 🇳🇴 🇩🇰 🇫🇮 🇮🇸 🇮🇪 🇵🇱 🇨🇿 🇭🇺 🇷🇴 🇧🇬 🇬🇷 🇭🇷 🇷🇸 🇸🇰 🇸🇮 🇱🇹 🇱🇻 🇪🇪 🇺🇦 🇧🇾 🇷🇺 🇹🇷 🇬🇪 🇦🇲 🇰🇿 🇮🇱 🇸🇦 🇦🇪 🇶🇦 🇮🇷 🇮🇶 🇯🇵 🇨🇳 🇰🇷 🇹🇼 🇭🇰 🇮🇳 🇵🇰 🇧🇩 🇱🇰 🇳🇵 🇹🇭 🇻🇳 🇵🇭 🇮🇩 🇲🇾 🇸🇬 🇲🇲 🇰🇭 🇱🇦 🇲🇳 🇦🇺 🇳🇿 🇿🇦 🇪🇬 🇲🇦 🇩🇿 🇹🇳 🇳🇬 🇰🇪 🇪🇹 🇬🇭 🇸🇳 🇨🇮 🇨🇲 🇦🇴 🇹🇿 🇺🇬 🇲🇿 🇺🇳 🇪🇺' },
];
const RECIENTES_KEY = 'emojiRecientes';

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js');

// === TEMA CLARO / OSCURO ===
// Preferencia guardada: 'light', 'dark' o 'system' (default).
function temaGuardado() {
  try { return localStorage.getItem('tema') || 'system'; } catch (_) { return 'system'; }
}
function aplicarTema(pref) {
  const root = document.documentElement;
  let efectivo = pref;
  if (pref === 'system') {
    efectivo = window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
  }
  if (efectivo === 'light') root.setAttribute('data-theme', 'light');
  else root.removeAttribute('data-theme');
  // actualizar el color de la barra del navegador
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', efectivo === 'light' ? '#FFFFFF' : '#111B21');
}
function guardarTema(pref) {
  try { localStorage.setItem('tema', pref); } catch (_) {}
  aplicarTema(pref);
}
// aplicar al cargar
aplicarTema(temaGuardado());
// si está en "system", reaccionar a cambios del sistema en vivo
window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => {
  if (temaGuardado() === 'system') aplicarTema('system');
});

// === ICONOS SVG (estilizados, heredan color via currentColor) ===
const ICON = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 7l-7 5 7 5V7z"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>',
  reply: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 17l-5-5 5-5"/><path d="M4 12h11a5 5 0 0 1 5 5v1"/></svg>',
  forward: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 17l5-5-5-5"/><path d="M20 12H9a5 5 0 0 0-5 5v1"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg>',
  select: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6L6 18M6 6l12 12"/></svg>',
  emoji: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>',
  sticker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h6"/><path d="M20 12h-4a4 4 0 0 0-4 4v4"/><path d="M20 12c0 4-4 8-8 8"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="14" y1="9" x2="14.01" y2="9"/></svg>',
  attach: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.4 11.05l-9.19 9.19a5 5 0 0 1-7.07-7.07l9.19-9.19a3.33 3.33 0 0 1 4.71 4.71l-9.2 9.19a1.67 1.67 0 0 1-2.36-2.36l8.49-8.48"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 4 20 12 6 20 6 4"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  hangup: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/><line x1="1" y1="1" x2="23" y2="23"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  group: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  key: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-7.6 7.6a5 5 0 1 0-7 7 5 5 0 0 0 7-7zm0 0L15 8m0 0l3 3 3-3-3-3"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>',
  images: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="9" cy="9" r="2"/><path d="M21 15l-5-5L5 21"/></svg>',
  callLog: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  callIn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="7 3 7 9 1 9"/><path d="M16 21a10 10 0 0 1-9-9"/><path d="M7 9L21 3"/></svg>',
  callOut: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="17 3 23 3 23 9"/><path d="M8 3a10 10 0 0 0 9 9"/><path d="M23 3L9 17"/></svg>',
  speaker: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  speakerOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>',
  more: '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  chats: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/></svg>',
  chatsFill: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.6-1.2A9 9 0 1 0 12 3z"/></svg>',
  newChat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.4A8 8 0 1 1 21 12z"/><line x1="12" y1="8.5" x2="12" y2="15.5"/><line x1="8.5" y1="12" x2="15.5" y2="12"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  starFill: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  backspace: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/><line x1="18" y1="9" x2="12" y2="15"/><line x1="12" y1="9" x2="18" y2="15"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  music: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
  scissors: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>',
  wand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 4V2M15 16v-2M8 9h2M20 9h2M17.8 11.8L19 13M15 9h.01M17.8 6.2L19 5M3 21l9-9M12.2 6.2L11 5"/></svg>',
  undo: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>',
  moon: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>',
};
function svgBtn(name, id, cls, title) {
  return `<button class="${cls || 'icon-btn'}" ${id ? `id="${id}"` : ''} ${title ? `title="${title}"` : ''} type="button">${ICON[name] || ''}</button>`;
}

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
      // tocó la notificación de llamada: mostrar pantalla de aceptar (recupera la oferta)
      recuperarLlamadaPendiente(event.data.callerId, event.data.callerName);
    }
  });
}

function abrirChatDesdeURL() {
  const params = new URLSearchParams(location.search);
  // ¿vino de una notificación de llamada (app cerrada)?
  if (params.get('incomingCall') === '1') {
    const callerId = params.get('callerId');
    const callerName = params.get('callerName');
    history.replaceState({}, '', location.pathname);
    if (callerId) recuperarLlamadaPendiente(callerId, callerName);
    return;
  }
  if (params.get('share') === '1') {
    history.replaceState({}, '', location.pathname);
    recibirCompartido();
    return;
  }
  const chatId = params.get('chat');
  const chatName = params.get('name');
  const callId = params.get('call');
  if (callId) {
    const callName = params.get('name');
    history.replaceState({}, '', location.pathname);
    recuperarLlamadaPendiente(callId, callName);
    return;
  }
  if (!chatId) return;
  history.replaceState({}, '', location.pathname); // limpia la URL
  abrirChatPorId(chatId, chatName);
}

// Al abrir desde la notificación: buscar si hay una llamada entrante activa
// y, si la oferta está guardada, mostrar la pantalla de aceptar/rechazar.
async function recuperarLlamadaPendiente(callerId, callerName) {
  // dar un momento a que la sesión esté lista
  for (let i = 0; i < 20 && !currentUser; i++) await sleep(150);
  if (!currentUser) return;
  try {
    const { data } = await sb.from('calls')
      .select('*')
      .eq('callee_id', currentUser.id)
      .eq('caller_id', callerId)
      .eq('status', 'ringing')
      .order('started_at', { ascending: false })
      .limit(1);
    const llamada = data && data[0];
    if (llamada && llamada.offer_sdp) {
      // ¿sigue vigente? (menos de 60s desde que empezó)
      const edad = (Date.now() - new Date(llamada.started_at).getTime()) / 1000;
      if (edad < 60) {
        recibirLlamada({
          from: callerId, sdp: llamada.offer_sdp,
          kind: llamada.offer_kind || 'audio',
          callerName: callerName || 'Alguien'
        });
        return;
      }
    }
    // no hay oferta vigente: solo abrir el chat
    abrirChatPorId(callerId, callerName);
  } catch (e) {
    abrirChatPorId(callerId, callerName);
  }
}

// === RECIBIR "COMPARTIR" DESDE OTRAS APPS (Web Share Target) ===
// El service worker guarda el texto/archivos en la caché 'share-inbox' y abre
// la app con ?share=1. Aquí se lee, se elige el chat destino y se deja listo
// en el compositor para enviar.
let compartidoPendiente = null;   // { texto, files } a la espera de sesión
async function leerCompartido() {
  if (!('caches' in window)) return null;
  try {
    const cache = await caches.open('share-inbox');
    const metaResp = await cache.match('/share-inbox/meta');
    if (!metaResp) return null;
    const meta = await metaResp.json();
    const files = [];
    for (const a of (meta.archivos || [])) {
      const r = await cache.match(`/share-inbox/${a.i}`);
      if (!r) continue;
      const blob = await r.blob();
      files.push(new File([blob], a.name, { type: a.type || blob.type }));
    }
    // limpiar la bandeja
    const keys = await cache.keys();
    await Promise.all(keys.map(k => cache.delete(k)));
    if (!meta.texto && !files.length) return null;
    return { texto: meta.texto || '', files };
  } catch (err) { console.warn('No se pudo leer lo compartido:', err); return null; }
}
async function recibirCompartido() {
  const datos = await leerCompartido();
  if (!datos) return;
  if (!currentUser) { compartidoPendiente = datos; return; }
  abrirElegirDestinoCompartido(datos);
}
// Hoja "Compartir con…": contactos y grupos
async function abrirElegirDestinoCompartido(datos) {
  const { data: profiles } = await sb.from('profiles').select('*').neq('id', currentUser.id).order('display_name');
  const { data: myMem } = await sb.from('group_members').select('group_id').eq('user_id', currentUser.id);
  const gids = (myMem || []).map(x => x.group_id);
  let groups = [];
  if (gids.length) { const { data } = await sb.from('groups').select('*').in('id', gids).order('name'); groups = data || []; }
  const n = datos.files.length;
  const resumen = [n ? `${n} archivo${n > 1 ? 's' : ''}` : '', datos.texto ? `“${datos.texto.slice(0, 60)}${datos.texto.length > 60 ? '…' : ''}”` : ''].filter(Boolean).join(' · ');
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay overlay-bottom';
  ov.innerHTML = `
    <div class="sheet sheet-bottom">
      <div class="sheet-head"><h3>Compartir con…</h3><button class="sheet-close" type="button">${ICON.close}</button></div>
      <div class="sheet-body">
        <p class="share-resumen">${ICON.share}<span>${esc(resumen)}</span></p>
        ${groups.length ? '<div class="section-head"><span>Grupos</span></div>' : ''}
        ${groups.map(g => `<button class="contact-pick" data-type="group" data-id="${g.id}" data-name="${esc(g.name || '')}" data-avatar="${esc(avatarUrl(g))}" type="button">
            ${avatarHtml(avatarUrl(g), g.name, 'sm group-av')}<span class="cp-name">${esc(g.name)}</span></button>`).join('')}
        <div class="section-head"><span>Contactos</span></div>
        ${(profiles || []).map(p => `<button class="contact-pick" data-type="user" data-id="${p.id}" data-name="${esc(p.display_name || p.username || 'Usuario')}" data-avatar="${esc(avatarUrl(p))}" type="button">
            ${avatarHtml(avatarUrl(p), p.display_name, 'sm')}<span class="cp-name">${esc(p.display_name || p.username || 'Usuario')}</span></button>`).join('') || '<p class="empty small">Aún no hay otros usuarios.</p>'}
      </div>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => ov.remove();
  ov.querySelector('.sheet-close').onclick = cerrar;
  ov.onclick = (e) => { if (e.target === ov) cerrar(); };
  ov.querySelectorAll('.contact-pick').forEach(b => {
    b.onclick = async () => {
      cerrar();
      if (b.dataset.type === 'group') await openGroup(b.dataset.id, b.dataset.name, b.dataset.avatar);
      else await openChat(b.dataset.id, b.dataset.name, b.dataset.avatar);
      // dejar el contenido listo en el compositor (el usuario revisa y pulsa enviar)
      const validos = datos.files.filter(f => f.size <= MAX_FILE_BYTES).slice(0, MAX_ADJUNTOS);
      if (validos.length < datos.files.length) toast('Algunos archivos superan 10 MB y no se adjuntaron');
      pendingFiles = validos;
      renderPreviewAdjuntos();
      const input = document.getElementById('msgInput');
      if (input) { input.value = datos.texto; input.focus(); }
      actualizarBotonEnviar();
    };
  });
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
    iniciarPresencia();
    if (pendingChat) { abrirChatPorId(pendingChat.id, pendingChat.name); pendingChat = null; }
    abrirChatDesdeURL();
  } else {
    renderAuth();
    if (new URLSearchParams(location.search).get('share') === '1') {
      history.replaceState({}, '', location.pathname);
      recibirCompartido();   // se guarda hasta que inicie sesión
    }
  }
}

async function loadProfile() {
  const { data } = await sb.from('profiles').select('*').eq('id', currentUser.id).single();
  currentProfile = data;
}

function renderAuth() {
  app.innerHTML = `
    <div class="auth">
      <div class="auth-logo">${ICON.chatsFill}</div>
      <h1>Familia Chat</h1>
      <p class="auth-sub">Mensajes, fotos, stickers y llamadas con tu familia.</p>
      <input id="username" placeholder="Usuario" autocapitalize="off">
      <input id="password" type="password" placeholder="Contraseña">
      <input id="displayName" placeholder="Nombre (solo al registrarte)">
      <button id="loginBtn" type="button">Entrar</button>
      <button id="signupBtn" class="secondary" type="button">Crear usuario</button>
      <p id="msg" class="error"></p>
      <p class="auth-foot">${ICON.lock} Chat privado solo para la familia</p>
    </div>`;
  document.getElementById('loginBtn').onclick = login;
  document.getElementById('signupBtn').onclick = signup;
  document.getElementById('password').addEventListener('keydown', e => { if (e.key === 'Enter') login(); });
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
  iniciarPresencia();
  if (pendingChat) { abrirChatPorId(pendingChat.id, pendingChat.name); pendingChat = null; }
  if (compartidoPendiente) { const d = compartidoPendiente; compartidoPendiente = null; abrirElegirDestinoCompartido(d); }
}

async function logout() { await sb.auth.signOut(); location.reload(); }

// === LISTA DE CHATS (estilo WhatsApp: grupos y contactos juntos, por actividad) ===
let listaFiltro = '';

// Barra de navegación inferior (Chats / Llamadas / Ajustes)
function bottomNavHtml(activo) {
  const item = (id, ico, label) =>
    `<button class="nav-item ${activo === id ? 'active' : ''}" data-nav="${id}" type="button">
       <span class="nav-ico">${ico}</span><span>${label}</span></button>`;
  return `<nav class="bottom-nav">
    ${item('chats', activo === 'chats' ? ICON.chatsFill : ICON.chats, 'Chats')}
    ${item('llamadas', ICON.phone, 'Llamadas')}
    ${item('ajustes', ICON.settings, 'Ajustes')}
  </nav>`;
}
function wireBottomNav() {
  document.querySelectorAll('.bottom-nav .nav-item').forEach(b => {
    b.onclick = () => {
      const nav = b.dataset.nav;
      if (nav === 'chats') renderChats();
      else if (nav === 'llamadas') renderLlamadas();
      else if (nav === 'ajustes') renderProfile();
    };
  });
}

// Menú desplegable (los tres puntos) anclado a un botón
function abrirMenuPopup(anchorBtn, items) {
  document.getElementById('popMenu')?.remove();
  const menu = document.createElement('div');
  menu.id = 'popMenu';
  menu.className = 'pop-menu';
  menu.innerHTML = items.map((it, i) =>
    `<button class="pop-item ${it.danger ? 'danger-text' : ''}" data-i="${i}" type="button">${it.icon ? ICON[it.icon] : ''}<span>${esc(it.label)}</span></button>`).join('');
  document.body.appendChild(menu);
  const r = anchorBtn.getBoundingClientRect();
  menu.style.top = `${r.bottom + 4}px`;
  menu.style.right = `${Math.max(8, window.innerWidth - r.right)}px`;
  const cerrar = () => { menu.remove(); document.removeEventListener('click', onDoc, true); };
  const onDoc = (ev) => { if (!menu.contains(ev.target)) cerrar(); };
  setTimeout(() => document.addEventListener('click', onDoc, true), 0);
  menu.querySelectorAll('.pop-item').forEach(b => {
    b.onclick = (ev) => { ev.stopPropagation(); cerrar(); items[+b.dataset.i].onClick(); };
  });
}

// Avatar (imagen o inicial) como HTML
function avatarHtml(av, nombre, extraClass = '') {
  return av
    ? `<img class="avatar-img ${extraClass}" src="${esc(av)}" alt="">`
    : `<div class="avatar ${extraClass}">${esc((nombre || '?')[0])}</div>`;
}

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
  const nombres = { [currentUser.id]: 'Tú' };
  for (const p of (profiles || [])) nombres[p.id] = p.display_name;

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

  // === Último mensaje por contacto y por grupo (para vista previa) ===
  const ultimoMsg = {};   // otherId | 'g:'+groupId -> { texto, hora, ts, mine, read, autor }
  const { data: recientes } = await sb.from('messages')
    .select('sender_id, recipient_id, content, attachment_type, attachment_name, created_at, deleted_at, read_at')
    .or(`sender_id.eq.${currentUser.id},recipient_id.eq.${currentUser.id}`)
    .is('group_id', null)
    .order('created_at', { ascending: false })
    .limit(300);
  for (const m of (recientes || [])) {
    const otro = m.sender_id === currentUser.id ? m.recipient_id : m.sender_id;
    if (!otro || ultimoMsg[otro]) continue;  // ya tengo el más nuevo de este contacto
    ultimoMsg[otro] = {
      texto: previewTexto(m), hora: horaLista(m.created_at),
      ts: new Date(m.created_at).getTime(),
      mine: m.sender_id === currentUser.id, read: !!m.read_at, deleted: !!m.deleted_at
    };
  }
  if (groupIds.length) {
    const { data: recG } = await sb.from('messages')
      .select('group_id, sender_id, content, attachment_type, attachment_name, created_at, deleted_at')
      .in('group_id', groupIds)
      .order('created_at', { ascending: false })
      .limit(200);
    for (const m of (recG || [])) {
      const k = 'g:' + m.group_id;
      if (ultimoMsg[k]) continue;
      ultimoMsg[k] = {
        texto: previewTexto(m), hora: horaLista(m.created_at),
        ts: new Date(m.created_at).getTime(),
        mine: m.sender_id === currentUser.id, autor: nombres[m.sender_id] || 'Alguien', deleted: !!m.deleted_at
      };
    }
  }

  // Filas unificadas (grupos + contactos), ordenadas como WhatsApp: por actividad
  const filas = [
    ...groups.map(g => ({ tipo: 'group', id: g.id, nombre: g.name || 'Grupo', avatar: avatarUrl(g), last: ultimoMsg['g:' + g.id], unread: 0 })),
    ...(profiles || []).map(p => ({ tipo: 'user', id: p.id, nombre: p.display_name || p.username || 'Usuario', avatar: avatarUrl(p), last: ultimoMsg[p.id], unread: unread[p.id] || 0 })),
  ].sort((a, b) => {
    const ta = a.last?.ts || 0, tb = b.last?.ts || 0;
    if (ta !== tb) return tb - ta;                        // conversación más reciente arriba
    if (a.unread !== b.unread) return b.unread - a.unread;
    return a.nombre.localeCompare(b.nombre);
  });

  const filaHtml = (f) => {
    const last = f.last;
    let preview = '';
    if (last) {
      if (last.mine && f.tipo === 'user' && !last.deleted) preview += `<span class="ticks ${last.read ? 'read' : ''}">${ticksSvg()}</span>`;
      if (f.tipo === 'group' && last.autor && !last.deleted) preview += `<span class="prev-autor">${esc(last.mine ? 'Tú' : last.autor)}:</span> `;
      preview += esc(last.texto);
    } else {
      preview = f.tipo === 'group' ? 'Toca para ver el grupo' : 'Toca para empezar a chatear';
    }
    return `<div class="contact ${f.unread ? 'has-unread' : ''}" data-type="${f.tipo}" data-id="${f.id}" data-name="${esc(f.nombre)}" data-avatar="${esc(f.avatar)}">
      ${avatarHtml(f.avatar, f.nombre, f.tipo === 'group' ? 'group-av' : '')}
      <div class="contact-main">
        <div class="contact-top">
          <span class="contact-name">${esc(f.nombre)}</span>
          ${last ? `<span class="contact-time">${esc(last.hora)}</span>` : ''}
        </div>
        <div class="contact-bottom">
          <span class="contact-preview">${preview}</span>
          ${f.unread ? `<span class="unread-badge">${f.unread > 99 ? '99+' : f.unread}</span>` : ''}
        </div>
      </div></div>`;
  };

  app.innerHTML = `
    <div class="header list-header">
      <span class="app-title">Familia Chat</span>
      <div class="header-actions">
        ${svgBtn('camera', 'listCamBtn', 'link', 'Cámara')}
        ${svgBtn('search', 'listSearchBtn', 'link', 'Buscar')}
        ${svgBtn('more', 'listMenuBtn', 'link', 'Menú')}
      </div>
    </div>
    <div id="listSearch" class="search-bar hidden">
      ${svgBtn('back', 'listSearchClose', 'link')}
      <input id="listSearchInput" placeholder="Buscar…" autocomplete="off">
    </div>
    <div class="contacts" id="chatList">
      ${filas.map(filaHtml).join('') || `<div class="empty-state">${ICON.chats}<p>Aún no hay conversaciones.</p><p class="small">Toca el botón verde para empezar un chat.</p></div>`}
      <div class="list-lock"><span>${ICON.lock}</span> Chat privado solo para la familia</div>
    </div>
    <button class="fab" id="newChatBtn" title="Nuevo chat" type="button">${ICON.newChat}</button>
    ${bottomNavHtml('chats')}`;

  wireBottomNav();
  document.querySelectorAll('.contact').forEach(c => {
    c.onclick = () => c.dataset.type === 'group'
      ? openGroup(c.dataset.id, c.dataset.name, c.dataset.avatar)
      : openChat(c.dataset.id, c.dataset.name, c.dataset.avatar);
  });
  document.getElementById('newChatBtn').onclick = abrirNuevoChat;
  document.getElementById('listCamBtn').onclick = abrirNuevoChat;
  document.getElementById('listMenuBtn').onclick = (ev) => abrirMenuPopup(ev.currentTarget, [
    { label: 'Nuevo grupo', icon: 'group', onClick: renderCreateGroup },
    { label: 'Perfil', icon: 'user', onClick: renderProfile },
    { label: 'Cerrar sesión', icon: 'logout', danger: true, onClick: logout },
  ]);
  // Búsqueda en la lista (filtra por nombre y vista previa)
  const barra = document.getElementById('listSearch');
  const inp = document.getElementById('listSearchInput');
  const filtrar = () => {
    listaFiltro = inp.value.trim().toLowerCase();
    document.querySelectorAll('#chatList .contact').forEach(c => {
      const txt = (c.dataset.name + ' ' + (c.querySelector('.contact-preview')?.textContent || '')).toLowerCase();
      c.classList.toggle('hidden', !!listaFiltro && !txt.includes(listaFiltro));
    });
  };
  document.getElementById('listSearchBtn').onclick = () => {
    barra.classList.remove('hidden');
    document.querySelector('.list-header').classList.add('hidden');
    inp.focus();
  };
  document.getElementById('listSearchClose').onclick = () => {
    barra.classList.add('hidden');
    document.querySelector('.list-header').classList.remove('hidden');
    inp.value = ''; filtrar();
  };
  inp.oninput = filtrar;
}

// Hora para la lista: hora si es hoy, "Ayer", o fecha corta
function horaLista(iso) {
  const d = new Date(iso), hoy = new Date();
  const mismo = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismo(d, hoy)) return formatHora(iso);
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  if (mismo(d, ayer)) return 'Ayer';
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`;
}

// Hoja "Nuevo chat": lista de contactos + acceso a crear grupo
async function abrirNuevoChat() {
  const { data: profiles } = await sb.from('profiles').select('*').neq('id', currentUser.id).order('display_name');
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay overlay-bottom';
  ov.innerHTML = `
    <div class="sheet sheet-bottom">
      <div class="sheet-head"><h3>Nuevo chat</h3><button class="sheet-close" type="button">${ICON.close}</button></div>
      <div class="sheet-body">
        <button class="contact-pick" id="ncGroup" type="button">
          <span class="cp-avatar cp-green">${ICON.group}</span><span class="cp-name">Nuevo grupo</span>
        </button>
        <div class="section-head"><span>Contactos</span></div>
        ${(profiles || []).map(p => `
          <button class="contact-pick" data-id="${p.id}" data-name="${esc(p.display_name || p.username || 'Usuario')}" data-avatar="${esc(avatarUrl(p))}" type="button">
            ${avatarHtml(avatarUrl(p), p.display_name, 'sm')}
            <span class="cp-name">${esc(p.display_name || p.username || 'Usuario')}</span>
          </button>`).join('') || '<p class="empty small">Aún no hay otros usuarios.</p>'}
      </div>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => ov.remove();
  ov.querySelector('.sheet-close').onclick = cerrar;
  ov.onclick = (e) => { if (e.target === ov) cerrar(); };
  document.getElementById('ncGroup').onclick = () => { cerrar(); renderCreateGroup(); };
  ov.querySelectorAll('.contact-pick[data-id]').forEach(b => {
    b.onclick = () => { cerrar(); openChat(b.dataset.id, b.dataset.name, b.dataset.avatar); };
  });
}

// === PESTAÑA DE LLAMADAS (historial global) ===
async function renderLlamadas() {
  activeChat = null; activeIsGroup = false;
  cancelarLista();
  const { data: profiles } = await sb.from('profiles').select('id, display_name, avatar_url, avatar_version').neq('id', currentUser.id);
  const perf = {};
  for (const p of (profiles || [])) perf[p.id] = p;
  const { data: calls } = await sb.from('calls')
    .select('*')
    .or(`caller_id.eq.${currentUser.id},callee_id.eq.${currentUser.id}`)
    .order('started_at', { ascending: false })
    .limit(100);

  const filas = (calls || []).map(c => {
    const saliente = c.caller_id === currentUser.id;
    const otroId = saliente ? c.callee_id : c.caller_id;
    const p = perf[otroId] || {};
    const nombre = p.display_name || 'Usuario';
    const av = avatarUrl(p);
    const perdida = c.status === 'missed' || c.status === 'rejected' || (c.status === 'ringing' && !c.duration_seconds);
    return `<div class="contact call-item ${perdida ? 'missed' : ''}" data-id="${otroId}" data-name="${esc(nombre)}" data-avatar="${esc(av)}" data-kind="${c.kind || 'audio'}">
      ${avatarHtml(av, nombre)}
      <div class="contact-main">
        <div class="contact-top"><span class="contact-name">${esc(nombre)}</span></div>
        <div class="contact-bottom">
          <span class="contact-preview"><span class="call-dir">${saliente ? ICON.callOut : ICON.callIn}</span> ${esc(formatFechaHora(c.started_at))}</span>
        </div>
      </div>
      <button class="link call-back" type="button" title="Llamar">${c.kind === 'video' ? ICON.video : ICON.phone}</button>
    </div>`;
  }).join('');

  app.innerHTML = `
    <div class="header list-header">
      <span class="app-title plain">Llamadas</span>
      <div class="header-actions">${svgBtn('more', 'listMenuBtn', 'link', 'Menú')}</div>
    </div>
    <div class="contacts">
      <div class="section-head"><span>Recientes</span></div>
      ${filas || '<div class="empty-state">' + ICON.phone + '<p>No hay llamadas todavía.</p><p class="small">Llama a un contacto desde su chat.</p></div>'}
    </div>
    <button class="fab" id="newCallBtn" title="Nueva llamada" type="button">${ICON.phone}</button>
    ${bottomNavHtml('llamadas')}`;
  wireBottomNav();
  document.getElementById('listMenuBtn').onclick = (ev) => abrirMenuPopup(ev.currentTarget, [
    { label: 'Perfil', icon: 'user', onClick: renderProfile },
    { label: 'Cerrar sesión', icon: 'logout', danger: true, onClick: logout },
  ]);
  document.getElementById('newCallBtn').onclick = abrirNuevoChat;
  document.querySelectorAll('.call-item').forEach(row => {
    const abrir = () => openChat(row.dataset.id, row.dataset.name, row.dataset.avatar);
    row.onclick = abrir;
    row.querySelector('.call-back').onclick = (e) => {
      e.stopPropagation();
      iniciarLlamada(row.dataset.id, row.dataset.name, row.dataset.avatar, row.dataset.kind);
    };
  });
}

// === CREAR GRUPO ===
async function renderCreateGroup() {
  cancelarLista();
  const { data: profiles } = await sb.from('profiles').select('*').neq('id', currentUser.id).order('display_name');
  app.innerHTML = `
    <div class="header">
      ${svgBtn('back', 'backBtn', 'link')}
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
      <button id="createGroupBtn" class="btn-ico">${ICON.group}<span>Crear grupo</span></button>
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
  activeChat = null; activeIsGroup = false;
  cancelarLista();
  const av = avatarUrl(currentProfile);
  app.innerHTML = `
    <div class="header list-header">
      <span class="app-title plain">Ajustes</span>
    </div>
    <div class="profile">
      <div class="profile-card">
        ${av ? `<img class="avatar-lg" id="avatarPreview" src="${esc(av)}" alt="avatar">`
             : `<div class="avatar-lg placeholder" id="avatarPreview">${esc((currentProfile.display_name||'?')[0])}</div>`}
        <div class="profile-card-text">
          <div class="profile-name">${esc(currentProfile.display_name || '')}</div>
          <div class="profile-user">@${esc(currentProfile.username || '')}</div>
        </div>
        <button class="link with-text" id="changePhoto" type="button">${ICON.camera}<span>Foto</span></button>
        <input id="avatarInput" type="file" accept="image/*" hidden>
      </div>

      <div class="settings-section">
        <div class="settings-title">${ICON.user}<span>Cuenta</span></div>
        <label class="field-label">Nombre</label>
        <input id="newName" value="${esc(currentProfile.display_name || '')}" placeholder="Tu nombre">
        <button id="saveName" class="btn-ico" type="button">${ICON.check}<span>Guardar nombre</span></button>

        <label class="field-label">Cambiar contraseña</label>
        <input id="newPass" type="password" placeholder="Nueva contraseña">
        <button id="savePass" class="btn-ico" type="button">${ICON.key}<span>Actualizar contraseña</span></button>
      </div>

      <div class="settings-section">
        <div class="settings-title">${ICON.moon}<span>Tema</span></div>
        <div class="theme-options" id="themeOptions">
          <button class="theme-opt" data-tema="system" type="button">Sistema</button>
          <button class="theme-opt" data-tema="light" type="button">Claro</button>
          <button class="theme-opt" data-tema="dark" type="button">Oscuro</button>
        </div>
      </div>

      <div class="settings-section">
        <button id="logoutBtn" class="secondary btn-ico" type="button">${ICON.logout}<span>Cerrar sesión</span></button>
        <button id="deleteAccount" class="danger btn-ico" type="button">${ICON.trash}<span>Eliminar mi cuenta</span></button>
      </div>

      <p id="profileMsg" class="ok"></p>
    </div>
    ${bottomNavHtml('ajustes')}`;

  wireBottomNav();
  document.getElementById('changePhoto').onclick = () => document.getElementById('avatarInput').click();
  document.getElementById('avatarInput').addEventListener('change', onAvatarPicked);
  document.getElementById('saveName').onclick = saveName;
  document.getElementById('savePass').onclick = savePassword;
  document.getElementById('logoutBtn').onclick = logout;
  document.getElementById('deleteAccount').onclick = deleteAccount;
  // selector de tema
  const actual = temaGuardado();
  document.querySelectorAll('.theme-opt').forEach(b => {
    if (b.dataset.tema === actual) b.classList.add('active');
    b.onclick = () => {
      guardarTema(b.dataset.tema);
      document.querySelectorAll('.theme-opt').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    };
  });
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
  const pn = document.querySelector('.profile-name');
  if (pn) pn.textContent = name;
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
let chatSubDefault = '';   // subtítulo normal del encabezado ("toca para ver info", miembros…)

// Construye el HTML común del chat (header + mensajes + compositor con emojis)
function chatShell({ avatar, titulo, sub, conLlamadas }) {
  return `
    <div class="header chat-header" id="chatHeader">
      <div class="chat-head-info" id="peerHead">
        ${svgBtn('back', 'backBtn', 'link back-btn')}
        ${avatar}
        <div class="chat-head-text">
          <span class="chat-title">${esc(titulo)}</span>
          <span class="chat-sub" id="chatSub">${esc(sub || '')}</span>
        </div>
      </div>
      <div class="header-actions">
        ${conLlamadas ? svgBtn('video', 'callVideoBtn', 'link', 'Videollamada') + svgBtn('phone', 'callAudioBtn', 'link', 'Llamar') : ''}
        ${svgBtn('more', 'chatMenuBtn', 'link', 'Más opciones')}
      </div>
    </div>
    <div class="header action-header hidden" id="actionHeader">
      ${svgBtn('close', 'actClose', 'link', 'Cerrar')}
      <span class="action-spacer"></span>
      ${svgBtn('reply', 'actReply', 'link', 'Responder')}
      ${svgBtn('forward', 'actForward', 'link', 'Reenviar')}
      ${svgBtn('share', 'actShare', 'link', 'Compartir')}
      ${svgBtn('edit', 'actEdit', 'link', 'Editar')}
      ${svgBtn('select', 'actSelect', 'link', 'Seleccionar')}
      ${svgBtn('trash', 'actDelete', 'link danger-ico', 'Eliminar')}
    </div>
    <div id="searchBar" class="search-bar hidden">
      ${svgBtn('back', 'searchClose', 'link')}
      <input id="searchInput" placeholder="Buscar…" autocomplete="off">
      <span id="searchCount" class="search-count"></span>
      <button class="link" id="searchPrev" title="Anterior" type="button">▲</button>
      <button class="link" id="searchNext" title="Siguiente" type="button">▼</button>
    </div>
    <div class="messages-wrap">
      <div class="day-float hidden" id="dayFloat"><span></span></div>
      <div class="messages" id="messages"></div>
    </div>
    <div id="filePreview" class="file-preview hidden"></div>
    <div class="composer">
      <div class="composer-pill">
        ${svgBtn('emoji', 'emojiBtn', 'icon-btn', 'Emojis y stickers')}
        <input id="msgInput" placeholder="Mensaje" autocomplete="off">
        ${svgBtn('attach', 'attachBtn', 'icon-btn', 'Adjuntar')}
        ${svgBtn('camera', 'cameraBtn', 'icon-btn', 'Cámara')}
      </div>
      <input id="fileInputGallery" type="file" accept="image/*,video/*" multiple hidden>
      <input id="fileInputCamera" type="file" accept="image/*" capture="environment" hidden>
      <input id="fileInputDoc" type="file" multiple hidden>
      <input id="fileInputAudio" type="file" accept="audio/*" multiple hidden>
      <input id="stickerInput" type="file" accept="image/*" hidden>
      ${svgBtn('mic', 'micBtn', 'icon-btn send-btn', 'Mantén presionado para grabar')}
      ${svgBtn('send', 'sendBtn', 'icon-btn send-btn hidden', 'Enviar')}
    </div>
    <div id="emojiPanel" class="emoji-panel hidden">
      <div class="ep-tabs" id="epTabs">
        ${EMOJI_CATS.map(c => `<button class="ep-tab" data-cat="${c.id}" title="${esc(c.label)}" type="button">${c.ico}</button>`).join('')}
      </div>
      <div class="ep-body" id="epBody"></div>
      <div class="ep-bottom">
        <button class="ep-mode active" data-mode="emoji" title="Emojis" type="button">${ICON.emoji}</button>
        <button class="ep-mode" data-mode="stickers" title="Stickers" type="button">${ICON.sticker}</button>
        <span class="ep-spacer"></span>
        <button class="ep-backspace" id="epBackspace" title="Borrar" type="button">${ICON.backspace}</button>
      </div>
    </div>
    <div id="recIndicator" class="rec-indicator hidden">
      <span class="rec-dot"></span>
      <span id="recTime">0:00</span>
      <span class="rec-hint">Suelta para enviar · desliza fuera para cancelar</span>
    </div>`;
}

// === PANEL DE EMOJIS (categorías + recientes) ===
function leerRecientes() {
  try { return JSON.parse(localStorage.getItem(RECIENTES_KEY) || '[]'); } catch (_) { return []; }
}
function guardarReciente(e) {
  const rec = leerRecientes().filter(x => x !== e);
  rec.unshift(e);
  try { localStorage.setItem(RECIENTES_KEY, JSON.stringify(rec.slice(0, 32))); } catch (_) {}
}
function mostrarCategoriaEmoji(catId) {
  const body = document.getElementById('epBody');
  if (!body) return;
  document.querySelectorAll('.ep-tab').forEach(t => t.classList.toggle('active', t.dataset.cat === catId));
  const cat = EMOJI_CATS.find(c => c.id === catId);
  const lista = catId === 'recent' ? leerRecientes() : (cat?.list || '').split(' ').filter(Boolean);
  if (!lista.length) {
    body.className = 'ep-body';
    body.innerHTML = '<p class="ep-empty">Aún no hay emojis recientes.</p>';
    return;
  }
  body.className = 'ep-body ep-grid';
  body.innerHTML = lista.map(e => `<button class="emoji" type="button" data-e="${e}">${e}</button>`).join('');
  body.scrollTop = 0;
}
// Inserta el emoji en la posición del cursor del input
function insertarEmoji(e) {
  const input = document.getElementById('msgInput');
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  input.value = input.value.slice(0, start) + e + input.value.slice(end);
  const pos = start + e.length;
  input.focus();
  input.setSelectionRange(pos, pos);
  guardarReciente(e);
  actualizarBotonEnviar();
}
// Borra el último carácter (o la selección) del input, como la tecla ⌫ del teclado de emojis
function borrarUltimoCaracter() {
  const input = document.getElementById('msgInput');
  if (!input) return;
  const start = input.selectionStart ?? input.value.length;
  const end = input.selectionEnd ?? input.value.length;
  let pos = start;
  if (start !== end) {
    input.value = input.value.slice(0, start) + input.value.slice(end);
  } else if (start > 0) {
    const antes = Array.from(input.value.slice(0, start));
    antes.pop();
    const nuevo = antes.join('');
    input.value = nuevo + input.value.slice(start);
    pos = nuevo.length;
  }
  input.focus();
  input.setSelectionRange(pos, pos);
  actualizarBotonEnviar();
}
// Cambia entre Emojis y Stickers dentro del panel
function mostrarModoPanel(modo) {
  const panel = document.getElementById('emojiPanel');
  if (!panel) return;
  panel.dataset.mode = modo;
  panel.querySelectorAll('.ep-mode').forEach(b => b.classList.toggle('active', b.dataset.mode === modo));
  document.getElementById('epTabs')?.classList.toggle('hidden', modo !== 'emoji');
  document.getElementById('epBackspace')?.classList.toggle('hidden', modo !== 'emoji');
  if (modo === 'stickers') { renderStickers(); return; }
  const activa = document.querySelector('.ep-tab.active')?.dataset.cat;
  mostrarCategoriaEmoji(activa || (leerRecientes().length ? 'recent' : 'caras'));
}

// Muestra "enviar" cuando hay algo que mandar y "micrófono" cuando no (como WhatsApp)
function actualizarBotonEnviar() {
  const input = document.getElementById('msgInput');
  const send = document.getElementById('sendBtn');
  const mic = document.getElementById('micBtn');
  if (!input || !send || !mic) return;
  const hay = input.value.trim().length > 0 || pendingFiles.length > 0 || !!editandoMsg;
  send.classList.toggle('hidden', !hay);
  mic.classList.toggle('hidden', hay);
}

// Respuesta háptica (Android; iOS no lo soporta y se ignora)
const VIBRA = { toque: 25, listo: [30, 50, 30], error: 90 };
function vibrar(patron) {
  try { if (navigator.vibrate) navigator.vibrate(patron); } catch (_) {}
}

// Aviso breve en pantalla (en vez de alert)
function toast(texto) {
  document.getElementById('toast')?.remove();
  const t = document.createElement('div');
  t.id = 'toast'; t.className = 'toast'; t.textContent = texto;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2200);
}

// === STICKERS ===
// Los stickers se guardan en el bucket 'attachments' bajo <uid>/stickers/ y
// se registran en la tabla 'stickers' (owner_id, path). Se envían como
// mensaje con attachment_type = 'sticker'. Recientes y favoritos viven en
// este dispositivo (localStorage), como en WhatsApp.
let misStickers = null;          // caché [{id, path}]
let modoEditarStickers = false;
const stickerUrlCache = {};      // path -> { url, exp }
const STICKER_REC_KEY = 'stickerRecientes';
const STICKER_FAV_KEY = 'stickerFavoritos';
const STICKER_EMOJI_SUBIDOS_KEY = 'stickerEmojiSubidos';
// Pack integrado: emojis grandes que se convierten en sticker al elegirlos
const STICKER_EMOJI_PACK = ['😂','🥰','😍','😎','🤣','😭','😡','🥺','🤔','😴','🥳','😱','🤯','😇','🙄','😏','🤗','😘','🤪','🫠','👍','👎','👏','🙏','💪','👋','🤝','🫶','❤️','💔','🔥','🎉','✨','💯','✅','❌','🎂','🍕','☕','🌹','🐶','🐱','🦄','🌞','🌈','⭐','🎁','🏆'];

function leerLista(key) { try { return JSON.parse(localStorage.getItem(key) || '[]'); } catch (_) { return []; } }
function guardarLista(key, arr) { try { localStorage.setItem(key, JSON.stringify(arr)); } catch (_) {} }
function registrarStickerReciente(path) {
  const l = leerLista(STICKER_REC_KEY).filter(p => p !== path);
  l.unshift(path);
  guardarLista(STICKER_REC_KEY, l.slice(0, 24));
}
function esFavorito(path) { return leerLista(STICKER_FAV_KEY).includes(path); }
function toggleFavorito(path) {
  let l = leerLista(STICKER_FAV_KEY);
  if (l.includes(path)) l = l.filter(p => p !== path); else l.unshift(path);
  guardarLista(STICKER_FAV_KEY, l.slice(0, 60));
  return l.includes(path);
}
function quitarStickerLocal(path) {
  guardarLista(STICKER_REC_KEY, leerLista(STICKER_REC_KEY).filter(p => p !== path));
  guardarLista(STICKER_FAV_KEY, leerLista(STICKER_FAV_KEY).filter(p => p !== path));
}

async function urlSticker(path) {
  const c = stickerUrlCache[path];
  if (c && c.exp > Date.now()) return c.url;
  const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600);
  if (!data?.signedUrl) return null;
  stickerUrlCache[path] = { url: data.signedUrl, exp: Date.now() + 50 * 60 * 1000 };
  return data.signedUrl;
}
// Varias URLs firmadas de una vez (una sola petición)
async function urlsStickers(paths) {
  const out = {};
  const faltan = [];
  for (const p of paths) {
    const c = stickerUrlCache[p];
    if (c && c.exp > Date.now()) out[p] = c.url; else faltan.push(p);
  }
  if (faltan.length) {
    try {
      const { data } = await sb.storage.from('attachments').createSignedUrls(faltan, 3600);
      for (const r of (data || [])) {
        if (r.signedUrl && r.path) {
          out[r.path] = r.signedUrl;
          stickerUrlCache[r.path] = { url: r.signedUrl, exp: Date.now() + 50 * 60 * 1000 };
        }
      }
    } catch (_) {
      for (const p of faltan) out[p] = await urlSticker(p);
    }
  }
  return out;
}

async function cargarMisStickers(force) {
  if (misStickers && !force) return misStickers;
  const { data } = await sb.from('stickers').select('id, path').eq('owner_id', currentUser.id).order('created_at', { ascending: false });
  misStickers = data || [];
  return misStickers;
}

async function renderStickers() {
  const body = document.getElementById('epBody');
  if (!body) return;
  body.className = 'ep-body ep-stickers';
  body.innerHTML = '<p class="ep-empty">Cargando stickers…</p>';
  const mios = await cargarMisStickers();
  if (!document.getElementById('epBody') || body.className !== 'ep-body ep-stickers') return; // cambió de modo mientras cargaba
  const recientes = leerLista(STICKER_REC_KEY);
  const favs = leerLista(STICKER_FAV_KEY);
  const item = (path, extra = '') =>
    `<div class="sticker-item" data-path="${esc(path)}" ${extra}><img alt="" loading="lazy" draggable="false"></div>`;
  const seccion = (titulo, htmlItems) =>
    `<div class="st-section"><div class="st-section-title">${esc(titulo)}</div><div class="st-grid">${htmlItems}</div></div>`;

  let html = `<div class="st-head">
    <button id="stickerAdd" class="st-add" type="button">${ICON.plus}<span>Crear</span></button>
    <span class="st-title">Stickers</span>
    ${mios.length ? `<button id="stickerEdit" class="link st-edit" type="button">${modoEditarStickers ? 'Listo' : 'Editar'}</button>` : ''}
  </div>`;
  if (recientes.length) html += seccion('Recientes', recientes.map(p => item(p)).join(''));
  if (favs.length) html += seccion('Favoritos', favs.map(p => item(p)).join(''));
  html += seccion('Mis stickers', mios.length
    ? mios.map(s => item(s.path, `data-id="${s.id}" ${modoEditarStickers ? 'data-edit="1"' : ''}`)
        .replace('</div>', modoEditarStickers ? `<button class="sticker-del" data-id="${s.id}" type="button" title="Quitar">✕</button></div>` : '</div>')).join('')
    : `<p class="ep-empty st-empty">Aún no tienes stickers.<br>Toca <b>Crear</b> y elige una foto, o guarda los que te envíen.</p>`);
  html += seccion('Emojis', STICKER_EMOJI_PACK.map(e => `<button class="sticker-emoji" type="button" data-e="${e}">${e}</button>`).join(''));
  body.innerHTML = html;

  // cargar imágenes (URLs firmadas en lote)
  const items = [...body.querySelectorAll('.sticker-item')];
  const paths = [...new Set(items.map(i => i.dataset.path))];
  const urls = await urlsStickers(paths);
  for (const it of items) {
    const url = urls[it.dataset.path];
    const img = it.querySelector('img');
    if (url && img) img.src = url; else it.classList.add('broken');
  }
}

// Elegir imagen -> abrir el editor de stickers
function crearStickerDesdeImagen(e) {
  const file = e.target.files && e.target.files[0];
  e.target.value = '';
  if (!file) return;
  if (!file.type.startsWith('image/')) { toast('Elige una imagen'); return; }
  abrirEditorSticker(file);
}

// Editor de sticker: encuadre cuadrado (arrastrar + zoom) y texto opcional
function abrirEditorSticker(file) {
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => montarEditorSticker(img);
    img.onerror = () => toast('Imagen no válida');
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

function montarEditorSticker(imgOriginal) {
  const SIZE = Math.min(280, Math.floor(window.innerWidth * 0.78));
  const OUT = 512;
  // Trabajar con una copia reducida (máx. 1024 px): más rápido y suficiente para 512x512
  const img = reducirImagen(imgOriginal, 1024);

  const overlay = document.createElement('div');
  overlay.className = 'crop-overlay';
  overlay.innerHTML = `
    <div class="crop-box sticker-box">
      <p class="crop-title">Nuevo sticker</p>
      <div class="st-tools">
        <button class="st-tool active" data-tool="move" type="button">${ICON.move}<span>Encuadrar</span></button>
        <button class="st-tool" data-tool="lasso" type="button">${ICON.scissors}<span>Recortar</span></button>
        <button class="st-tool" data-tool="auto" type="button">${ICON.wand}<span>Quitar fondo</span></button>
        <button class="st-tool" data-tool="reset" type="button" disabled>${ICON.undo}<span>Deshacer</span></button>
      </div>
      <div class="crop-stage sticker-stage" style="width:${SIZE}px;height:${SIZE}px;">
        <canvas id="stCanvas" width="${SIZE}" height="${SIZE}"></canvas>
        <div class="st-busy hidden" id="stBusy"><span class="st-spinner"></span><span id="stBusyText">Quitando fondo…</span></div>
      </div>
      <p class="st-hint" id="stHint">Mantén presionado sobre algo para recortarlo · arrastra para encuadrar</p>
      <input id="stText" placeholder="Texto (opcional)" maxlength="40" autocomplete="off">
      <input id="stZoom" type="range" min="1" max="4" step="0.01" value="1">
      <div class="crop-actions">
        <button class="secondary" id="stCancel" type="button">Cancelar</button>
        <button id="stSave" type="button">Guardar</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  const canvas = document.getElementById('stCanvas');
  const ctx = canvas.getContext('2d');
  const textInput = document.getElementById('stText');
  const zoomInput = document.getElementById('stZoom');
  const hint = document.getElementById('stHint');
  const busy = document.getElementById('stBusy');
  const stage = overlay.querySelector('.sticker-stage');

  // --- Estado ---
  let tool = 'move';
  let mask = null;        // canvas (tamaño de img) con alfa = zona que se conserva; null = sin recorte
  let fuente = img;       // lo que se dibuja (img o el recorte con borde blanco)
  let baseScale = 1, zoom = 1, scale = 1, ox = 0, oy = 0;
  let lassoPts = [];      // puntos del lazo en coordenadas del lienzo
  let dibujandoLazo = false;

  function encuadrar(modo) {
    // 'cover' llena el cuadro (foto completa); 'contain' muestra todo el recorte
    baseScale = modo === 'cover'
      ? Math.max(SIZE / fuente.width, SIZE / fuente.height)
      : Math.min(SIZE / fuente.width, SIZE / fuente.height);
    zoom = 1; zoomInput.value = 1;
    scale = baseScale;
    ox = (SIZE - fuente.width * scale) / 2;
    oy = (SIZE - fuente.height * scale) / 2;
  }
  function clamp() {
    scale = baseScale * zoom;
    const w = fuente.width * scale, h = fuente.height * scale;
    const minX = Math.min(0, SIZE - w), maxX = Math.max(0, SIZE - w);
    const minY = Math.min(0, SIZE - h), maxY = Math.max(0, SIZE - h);
    ox = Math.max(minX, Math.min(maxX, ox));
    oy = Math.max(minY, Math.min(maxY, oy));
  }
  function draw() {
    clamp();
    ctx.clearRect(0, 0, SIZE, SIZE);
    ctx.drawImage(fuente, ox, oy, fuente.width * scale, fuente.height * scale);
    dibujarTextoSticker(ctx, textInput.value, SIZE);
    if (lassoPts.length > 1) {
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(lassoPts[0].x, lassoPts[0].y);
      for (const p of lassoPts) ctx.lineTo(p.x, p.y);
      if (!dibujandoLazo) ctx.closePath();
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.stroke();
      ctx.lineWidth = 2; ctx.setLineDash([6, 5]); ctx.strokeStyle = '#fff'; ctx.stroke();
      ctx.restore();
    }
  }
  // Recalcula lo que se dibuja a partir de la máscara y reencuadra
  function actualizarFuente() {
    if (!mask) { fuente = img; encuadrar('cover'); }
    else {
      const recorte = aplicarMascaraSticker(img, mask);
      fuente = recorte ? conBordeSticker(recorte) : img;
      encuadrar('contain');
    }
    overlay.querySelector('[data-tool="reset"]').disabled = !mask;
    draw();
  }
  function setTool(t) {
    tool = t;
    overlay.querySelectorAll('.st-tool').forEach(b => b.classList.toggle('active', b.dataset.tool === t));
    stage.classList.toggle('lasso', t === 'lasso');
    hint.textContent = t === 'lasso'
      ? 'Dibuja el contorno con el dedo: se conserva lo de dentro'
      : 'Mantén presionado sobre algo para recortarlo · arrastra para encuadrar';
  }
  function ocupado(si, texto) {
    busy.classList.toggle('hidden', !si);
    if (texto) document.getElementById('stBusyText').textContent = texto;
    overlay.querySelectorAll('.st-tool, #stSave').forEach(b => b.disabled = si);
    if (!si) overlay.querySelector('[data-tool="reset"]').disabled = !mask;
  }

  encuadrar('cover');
  draw();

  // --- Herramientas ---
  overlay.querySelectorAll('.st-tool').forEach(b => b.onclick = async () => {
    const t = b.dataset.tool;
    if (t === 'reset') { mask = null; lassoPts = []; actualizarFuente(); setTool('move'); return; }
    if (t === 'auto') {
      ocupado(true, 'Quitando fondo…');
      try {
        const m = await quitarFondoAuto(img);
        mask = m; lassoPts = [];
        actualizarFuente();
        setTool('move');
        vibrar(VIBRA.listo);
      } catch (err) {
        console.warn('Quitar fondo:', err);
        vibrar(VIBRA.error);
        toast('No se pudo quitar el fondo automáticamente. Prueba a recortar con el dedo.');
      } finally { ocupado(false); }
      return;
    }
    setTool(t);
  });

  // --- Gestos sobre el lienzo ---
  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const t = e.touches ? e.touches[0] : e;
    return { x: (t.clientX - r.left) * (SIZE / r.width), y: (t.clientY - r.top) * (SIZE / r.height) };
  };
  let dragging = false, lastX = 0, lastY = 0;
  let pinchDist = 0, pinchZoom = 1;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);

  // Pulsación larga (como en WhatsApp / Google Fotos / Galaxy): recorta el objeto tocado
  let pressTimer = null, pressPt = null;
  function cancelarPress() { if (pressTimer) { clearTimeout(pressTimer); pressTimer = null; } }
  async function recortarObjetoEn(p) {
    const org = fuente._origen || { x: 0, y: 0 };
    const ix = (p.x - ox) / scale + org.x, iy = (p.y - oy) / scale + org.y;
    if (ix < 0 || iy < 0 || ix >= img.width || iy >= img.height) return;
    vibrar(VIBRA.toque);
    const marca = document.createElement('div');
    marca.className = 'st-touch';
    marca.style.left = `${(p.x / SIZE) * 100}%`; marca.style.top = `${(p.y / SIZE) * 100}%`;
    stage.appendChild(marca);
    ocupado(true, 'Recortando…');
    try {
      const m = await mascaraObjeto(img, ix / img.width, iy / img.height);
      if (!m) { vibrar(VIBRA.error); toast('No se reconoció ningún objeto ahí. Prueba con el lazo.'); return; }
      mask = m; lassoPts = [];
      actualizarFuente();
      setTool('move');
      vibrar(VIBRA.listo);
    } catch (err) {
      console.warn('Recorte de objeto:', err);
      vibrar(VIBRA.error);
      toast('No se pudo recortar automáticamente. Prueba con el lazo.');
    } finally { ocupado(false); marca.remove(); }
  }

  function inicio(e) {
    const p = pos(e);
    if (tool === 'lasso') { dibujandoLazo = true; lassoPts = [p]; draw(); return; }
    dragging = true; lastX = p.x; lastY = p.y;
    pressPt = p; cancelarPress();
    pressTimer = setTimeout(() => { pressTimer = null; dragging = false; recortarObjetoEn(p); }, 450);
  }
  function mover(e) {
    const p = pos(e);
    if (tool === 'lasso') {
      if (!dibujandoLazo) return;
      const u = lassoPts[lassoPts.length - 1];
      if (Math.hypot(p.x - u.x, p.y - u.y) > 2) { lassoPts.push(p); draw(); }
      return;
    }
    if (pressTimer && pressPt && Math.hypot(p.x - pressPt.x, p.y - pressPt.y) > 8) cancelarPress();
    if (!dragging) return;
    ox += p.x - lastX; oy += p.y - lastY; lastX = p.x; lastY = p.y; draw();
  }
  function fin() {
    cancelarPress();
    dragging = false;
    if (tool === 'lasso' && dibujandoLazo) {
      dibujandoLazo = false;
      if (lassoPts.length >= 3) aplicarLazo();
      lassoPts = [];
      draw();
    }
  }
  // Convierte el lazo (coordenadas del lienzo) a coordenadas de la imagen y lo aplica a la máscara
  function aplicarLazo() {
    // origen de 'fuente' respecto a la imagen original (el recorte se ajusta a su caja + borde)
    const org = fuente._origen || { x: 0, y: 0 };
    const poly = lassoPts.map(p => ({ x: (p.x - ox) / scale + org.x, y: (p.y - oy) / scale + org.y }));
    const nueva = document.createElement('canvas');
    nueva.width = img.width; nueva.height = img.height;
    const mctx = nueva.getContext('2d');
    mctx.fillStyle = '#fff';
    mctx.beginPath();
    mctx.moveTo(poly[0].x, poly[0].y);
    for (const p of poly) mctx.lineTo(p.x, p.y);
    mctx.closePath();
    mctx.fill();
    if (mask) { mctx.globalCompositeOperation = 'destination-in'; mctx.drawImage(mask, 0, 0); }
    mask = suavizarMascara(nueva);
    actualizarFuente();
    setTool('move');
    vibrar(VIBRA.listo);
  }

  canvas.addEventListener('mousedown', e => { e.preventDefault(); inicio(e); });
  const onMove = e => mover(e);
  window.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', fin);
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    if (e.touches.length === 1) inicio(e);
    else if (e.touches.length === 2 && tool !== 'lasso') { cancelarPress(); dragging = false; pinchDist = dist(e.touches); pinchZoom = zoom; }
  }, { passive: false });
  canvas.addEventListener('contextmenu', e => e.preventDefault());
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    if (e.touches.length === 1) mover(e);
    else if (e.touches.length === 2 && tool !== 'lasso') {
      zoom = Math.min(4, Math.max(1, pinchZoom * (dist(e.touches) / pinchDist)));
      zoomInput.value = zoom;
      draw();
    }
  }, { passive: false });
  canvas.addEventListener('touchend', fin);
  zoomInput.addEventListener('input', e => {
    const cx = SIZE / 2, cy = SIZE / 2;
    const imgCx = (cx - ox) / scale, imgCy = (cy - oy) / scale;
    zoom = parseFloat(e.target.value);
    scale = baseScale * zoom;
    ox = cx - imgCx * scale; oy = cy - imgCy * scale;
    draw();
  });
  textInput.addEventListener('input', draw);

  const cerrar = () => { overlay.remove(); window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', fin); };
  document.getElementById('stCancel').onclick = cerrar;
  document.getElementById('stSave').onclick = () => {
    const out = document.createElement('canvas');
    out.width = OUT; out.height = OUT;
    const octx = out.getContext('2d');
    const ratio = OUT / SIZE;
    octx.drawImage(fuente, ox * ratio, oy * ratio, fuente.width * scale * ratio, fuente.height * scale * ratio);
    dibujarTextoSticker(octx, textInput.value, OUT);
    const listo = (blob) => { cerrar(); if (blob) subirSticker(blob); else toast('No se pudo procesar la imagen'); };
    out.toBlob(b => b ? listo(b) : out.toBlob(listo, 'image/png'), 'image/webp', 0.9);
  };
}

// Reduce una imagen a un canvas de como máximo `max` px por lado
function reducirImagen(img, max) {
  const r = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.width * r));
  c.height = Math.max(1, Math.round(img.height * r));
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c;
}

// Aplica la máscara (alfa) a la imagen y recorta a la caja del contenido.
// Devuelve un canvas con _origen = posición de ese canvas dentro de la imagen.
function aplicarMascaraSticker(img, mask) {
  const c = document.createElement('canvas');
  c.width = img.width; c.height = img.height;
  const x = c.getContext('2d');
  x.drawImage(img, 0, 0);
  x.globalCompositeOperation = 'destination-in';
  x.drawImage(mask, 0, 0, img.width, img.height);
  // caja del contenido visible
  const d = x.getImageData(0, 0, c.width, c.height).data;
  let minX = c.width, minY = c.height, maxX = -1, maxY = -1;
  for (let y = 0; y < c.height; y++) {
    for (let xx = 0; xx < c.width; xx++) {
      if (d[(y * c.width + xx) * 4 + 3] > 16) {
        if (xx < minX) minX = xx; if (xx > maxX) maxX = xx;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;   // máscara vacía
  const out = document.createElement('canvas');
  out.width = maxX - minX + 1; out.height = maxY - minY + 1;
  out.getContext('2d').drawImage(c, minX, minY, out.width, out.height, 0, 0, out.width, out.height);
  out._origen = { x: minX, y: minY };
  return out;
}

// Borde blanco alrededor del recorte (como los stickers de WhatsApp)
function conBordeSticker(recorte) {
  const r = Math.max(3, Math.round(Math.max(recorte.width, recorte.height) * 0.025));
  const out = document.createElement('canvas');
  out.width = recorte.width + r * 2; out.height = recorte.height + r * 2;
  const x = out.getContext('2d');
  // silueta blanca: la forma desplazada en todas direcciones
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    x.drawImage(recorte, r + Math.cos(a) * r, r + Math.sin(a) * r);
  }
  x.globalCompositeOperation = 'source-in';
  x.fillStyle = '#fff';
  x.fillRect(0, 0, out.width, out.height);
  x.globalCompositeOperation = 'source-over';
  x.drawImage(recorte, r, r);
  out._origen = { x: recorte._origen.x - r, y: recorte._origen.y - r };
  return out;
}

// Suaviza el borde de la máscara (pluma de ~1 px)
function suavizarMascara(mask) {
  const c = document.createElement('canvas');
  c.width = mask.width; c.height = mask.height;
  const x = c.getContext('2d');
  try { x.filter = 'blur(0.6px)'; } catch (_) {}
  x.drawImage(mask, 0, 0);
  return c;
}

// === QUITAR FONDO AUTOMÁTICO ===
// 1) Segmentación con IA en el navegador (MediaPipe, modelo de personas, ~250 KB).
// 2) Si no se puede cargar o no detecta a nadie, relleno desde los bordes (fondos lisos).
const MP_BASE = window.MP_BASE || 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.21';
const MP_MODEL = window.MP_MODEL || 'https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite';
// Modelo "Magic Touch" (~6 MB): devuelve la silueta del objeto que hay en el punto tocado
const MP_MAGIC = window.MP_MAGIC || 'https://storage.googleapis.com/mediapipe-models/interactive_segmenter/magic_touch/float32/latest/magic_touch.tflite';
let segmentadorPromesa = null;
let segInteractivoPromesa = null;
let visionPromesa = null;
function cargarVision() {
  if (!visionPromesa) {
    visionPromesa = (async () => {
      const vision = await import(`${MP_BASE}/vision_bundle.mjs`);
      const files = await vision.FilesetResolver.forVisionTasks(`${MP_BASE}/wasm`);
      return { vision, files };
    })().catch(err => { visionPromesa = null; throw err; });
  }
  return visionPromesa;
}
function cargarSegmentadorInteractivo() {
  if (!segInteractivoPromesa) {
    const limite = new Promise((_, rej) => setTimeout(() => rej(new Error('tiempo agotado cargando el modelo')), 40000));
    segInteractivoPromesa = Promise.race([limite, (async () => {
      const { vision, files } = await cargarVision();
      return vision.InteractiveSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: MP_MAGIC },
        outputCategoryMask: false, outputConfidenceMasks: true,
      });
    })()]).catch(err => { segInteractivoPromesa = null; throw err; });
  }
  return segInteractivoPromesa;
}

// Máscara del objeto que hay en el punto (nx, ny) normalizado [0..1]. null si no hay nada.
async function mascaraObjeto(img, nx, ny) {
  const seg = await cargarSegmentadorInteractivo();
  const entrada = reducirImagen(img, 512);
  let elegido = null, mejorValor = -1, total = 0;
  // Con callback, las máscaras solo son válidas dentro de él: copiar los datos ahí mismo
  const procesar = (res) => {
    const masks = res.confidenceMasks || [];
    total = masks.length;
    for (const m of masks) {
      const a = m.getAsFloat32Array();
      const w = m.width, h = m.height;
      const px = Math.min(w - 1, Math.round(nx * w)), py = Math.min(h - 1, Math.round(ny * h));
      const v = a[py * w + px];
      if (v > mejorValor) { mejorValor = v; elegido = { a: Float32Array.from(a), w, h }; }
    }
    try { res.close && res.close(); } catch (_) {}
  };
  const ret = seg.segment(entrada, { keypoint: { x: nx, y: ny } }, procesar);
  if (ret && !elegido) procesar(ret);
  if (!elegido) return null;
  // una sola máscara y el punto tocado sale "bajo": la máscara es del fondo, invertir
  const invertir = total === 1 && mejorValor < 0.5;
  const r = mascaraDesdeConfianza(elegido.a, elegido.w, elegido.h, invertir);
  console.info('[sticker] objeto: máscaras', total, 'confianza', mejorValor.toFixed(2), 'cobertura', Math.round(r.cobertura * 100) + '%');
  return r.cobertura > 0.004 ? r.canvas : null;
}

// Convierte un mapa de confianza [0..1] en un canvas de máscara (alfa), con contraste en el borde
function mascaraDesdeConfianza(a, w, h, invertir) {
  let cubierto = 0;
  const id = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    let v = invertir ? 1 - a[i] : a[i];
    v = v < 0.35 ? 0 : v > 0.65 ? 1 : (v - 0.35) / 0.3;
    const p = i * 4;
    id.data[p] = id.data[p + 1] = id.data[p + 2] = 255;
    id.data[p + 3] = Math.round(v * 255);
    if (v > 0.5) cubierto++;
  }
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(id, 0, 0);
  return { canvas: c, cobertura: cubierto / (w * h) };
}
function cargarSegmentador() {
  if (!segmentadorPromesa) {
    // si en 25 s no cargó (sin red / red lenta), se usa el método de relleno
    const limite = new Promise((_, rej) => setTimeout(() => rej(new Error('tiempo agotado cargando el modelo')), 25000));
    segmentadorPromesa = Promise.race([limite, (async () => {
      const { vision, files } = await cargarVision();
      return vision.ImageSegmenter.createFromOptions(files, {
        baseOptions: { modelAssetPath: MP_MODEL },
        runningMode: 'IMAGE', outputCategoryMask: false, outputConfidenceMasks: true,
      });
    })()]).catch(err => { segmentadorPromesa = null; throw err; });
  }
  return segmentadorPromesa;
}

async function quitarFondoAuto(img) {
  let mask = null;
  try {
    mask = await mascaraIA(img);
  } catch (err) {
    console.warn('Segmentación IA no disponible:', err);
  }
  if (!mask) mask = mascaraRelleno(img);
  if (!mask) throw new Error('sin resultado');
  return suavizarMascara(mask);
}

// Máscara con IA. Devuelve null si no detecta nada útil.
async function mascaraIA(img) {
  const seg = await cargarSegmentador();
  const entrada = reducirImagen(img, 512);
  const res = seg.segment(entrada);
  const masks = res.confidenceMasks || [];
  let mejor = null, mejorBorde = Infinity;
  for (const m of masks) {
    const a = m.getAsFloat32Array();
    const w = m.width, h = m.height;
    // la persona casi no toca los bordes; el fondo sí
    let suma = 0, n = 0;
    for (let x = 0; x < w; x++) { suma += a[x] + a[(h - 1) * w + x]; n += 2; }
    for (let y = 0; y < h; y++) { suma += a[y * w] + a[y * w + w - 1]; n += 2; }
    const borde = suma / n;
    if (borde < mejorBorde) { mejorBorde = borde; mejor = { a, w, h }; }
  }
  try { res.close && res.close(); } catch (_) {}
  if (!mejor) return null;
  const { a, w, h } = mejor;
  const invertir = masks.length === 1 && mejorBorde > 0.5;   // una sola máscara y es el fondo
  const r = mascaraDesdeConfianza(a, w, h, invertir);
  console.info('[sticker] IA: máscaras', masks.length, 'cobertura', Math.round(r.cobertura * 100) + '%');
  return r.cobertura < 0.02 ? null : r.canvas;   // no hay persona: usar el otro método
}

// Máscara por relleno desde los bordes: quita todo lo que se parece al color
// del borde (fondos lisos, paredes, cielo...). Devuelve null si borraría casi todo.
function mascaraRelleno(img, tol = 34) {
  const src = reducirImagen(img, 400);
  const w = src.width, h = src.height;
  const d = src.getContext('2d').getImageData(0, 0, w, h).data;
  const fondo = new Uint8Array(w * h);
  const cola = new Int32Array(w * h);
  const tol2 = tol * tol;
  const semilla = (i) => {
    if (fondo[i]) return;
    const r0 = d[i * 4], g0 = d[i * 4 + 1], b0 = d[i * 4 + 2];
    let head = 0, tail = 0;
    cola[tail++] = i; fondo[i] = 1;
    while (head < tail) {
      const j = cola[head++];
      const x = j % w, y = (j / w) | 0;
      const vecinos = [j - 1, j + 1, j - w, j + w];
      for (let k = 0; k < 4; k++) {
        const v = vecinos[k];
        if (v < 0 || v >= w * h || fondo[v]) continue;
        if ((k === 0 && x === 0) || (k === 1 && x === w - 1)) continue;
        const dr = d[v * 4] - r0, dg = d[v * 4 + 1] - g0, db = d[v * 4 + 2] - b0;
        if (dr * dr + dg * dg + db * db <= tol2) { fondo[v] = 1; cola[tail++] = v; }
      }
    }
  };
  for (let x = 0; x < w; x++) { semilla(x); semilla((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { semilla(y * w); semilla(y * w + w - 1); }
  let quedan = 0;
  const id = new ImageData(w, h);
  for (let i = 0; i < w * h; i++) {
    const p = i * 4;
    id.data[p] = id.data[p + 1] = id.data[p + 2] = 255;
    id.data[p + 3] = fondo[i] ? 0 : 255;
    if (!fondo[i]) quedan++;
  }
  if (quedan / (w * h) < 0.02) return null;
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').putImageData(id, 0, 0);
  return c;
}

// Texto estilo "meme" (blanco con borde negro) en la parte inferior del sticker
function dibujarTextoSticker(ctx, texto, S) {
  texto = (texto || '').trim();
  if (!texto) return;
  const fs = Math.round(S * 0.12);
  ctx.save();
  ctx.font = `900 ${fs}px "Arial Black", Impact, "Segoe UI", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
  ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(2, fs * 0.16);
  ctx.strokeStyle = '#000'; ctx.fillStyle = '#fff';
  // partir en líneas para que quepa
  const palabras = texto.toUpperCase().split(/\s+/);
  const lineas = [];
  let actual = '';
  for (const p of palabras) {
    const prueba = actual ? actual + ' ' + p : p;
    if (ctx.measureText(prueba).width > S * 0.92 && actual) { lineas.push(actual); actual = p; }
    else actual = prueba;
  }
  if (actual) lineas.push(actual);
  let y = S - fs * 0.45;
  for (let i = lineas.length - 1; i >= 0; i--) {
    ctx.strokeText(lineas[i], S / 2, y);
    ctx.fillText(lineas[i], S / 2, y);
    y -= fs * 1.1;
  }
  ctx.restore();
}

// Sube el sticker (webp 512x512), lo registra y abre el panel para verlo
async function subirSticker(blob) {
  try {
    const path = `${currentUser.id}/stickers/${Date.now()}.webp`;
    const { error: upErr } = await sb.storage.from('attachments').upload(path, blob, { contentType: blob.type || 'image/webp' });
    if (upErr) throw upErr;
    const { error: insErr } = await sb.from('stickers').insert({ owner_id: currentUser.id, path });
    if (insErr) throw insErr;
    await cargarMisStickers(true);
    toast('Sticker creado ✓');
    const panel = document.getElementById('emojiPanel');
    if (panel) { panel.classList.remove('hidden'); mostrarModoPanel('stickers'); }
  } catch (err) {
    alert('No se pudo crear el sticker: ' + (err.message || err));
  }
}

// Convierte un emoji del pack integrado en sticker (imagen 512x512)
function emojiASticker(e) {
  return new Promise((resolve, reject) => {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = S; c.height = S;
    const ctx = c.getContext('2d');
    ctx.font = `${Math.round(S * 0.72)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", "Twemoji Mozilla", sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e, S / 2, S / 2 + S * 0.04);
    c.toBlob(b => b ? resolve(b) : reject(new Error('No se pudo generar el sticker')), 'image/webp', 0.92);
  });
}
async function enviarStickerEmoji(e) {
  const nombre = [...e].map(ch => ch.codePointAt(0).toString(16)).join('-');
  const path = `${currentUser.id}/stickers/emoji-${nombre}.webp`;
  const subidos = leerLista(STICKER_EMOJI_SUBIDOS_KEY);
  if (!subidos.includes(path)) {
    try {
      const blob = await emojiASticker(e);
      const { error } = await sb.storage.from('attachments').upload(path, blob, { contentType: 'image/webp' });
      if (error && !/exist|duplicate|409/i.test(error.message || '')) throw error;
      subidos.push(path);
      guardarLista(STICKER_EMOJI_SUBIDOS_KEY, subidos);
    } catch (err) {
      alert('No se pudo enviar el sticker: ' + (err.message || err));
      return;
    }
  }
  enviarSticker(path);
}

async function enviarSticker(path) {
  if (!activeChat) return;
  const row = {
    sender_id: currentUser.id, content: null,
    attachment_path: path, attachment_name: 'sticker.webp',
    attachment_type: 'sticker', attachment_size: 0
  };
  if (activeIsGroup) row.group_id = activeChat; else row.recipient_id = activeChat;
  if (replyingTo) { row.reply_to = replyingTo.id; row.reply_preview = replyingTo.preview; row.reply_author = replyingTo.author; }
  const { data: inserted, error } = await sb.from('messages').insert(row).select().single();
  if (error) { alert('No se pudo enviar el sticker: ' + error.message); return; }
  if (inserted) pintarMensajePropio(inserted);
  cancelarRespuesta();
  registrarStickerReciente(path);
  // refrescar la fila de "Recientes" si el panel sigue abierto en stickers
  const panel = document.getElementById('emojiPanel');
  if (panel && !panel.classList.contains('hidden') && panel.dataset.mode === 'stickers') renderStickers();
}

async function borrarSticker(id) {
  const s = (misStickers || []).find(x => x.id === id);
  await sb.from('stickers').delete().eq('id', id).eq('owner_id', currentUser.id);
  // borrar el archivo solo si es mío (si lo guardé de otro, la ruta es ajena)
  if (s && s.path.startsWith(currentUser.id + '/')) {
    try { await sb.storage.from('attachments').remove([s.path]); } catch (_) {}
    quitarStickerLocal(s.path);
  }
  await cargarMisStickers(true);
  if (!misStickers.length) modoEditarStickers = false;
  renderStickers();
}

// Guardar en mi colección un sticker que recibí
async function guardarStickerRecibido(path) {
  const lista = await cargarMisStickers();
  if (lista.some(s => s.path === path)) { toast('Ese sticker ya está en tu colección'); return; }
  const { error } = await sb.from('stickers').insert({ owner_id: currentUser.id, path });
  if (error) { alert('No se pudo guardar: ' + error.message); return; }
  await cargarMisStickers(true);
  toast('Sticker guardado en tu colección ✓');
}

// Hoja de opciones al tocar un sticker del chat (favorito, guardar, responder, reenviar)
async function abrirMenuSticker(msgId, path) {
  const m = msgCache[msgId];
  const mios = await cargarMisStickers();
  const enMios = mios.some(s => s.path === path);
  const fav = esFavorito(path);
  const url = await urlSticker(path);
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay overlay-bottom';
  ov.innerHTML = `
    <div class="sheet sheet-bottom">
      <div class="sheet-head"><h3>Sticker</h3><button class="sheet-close" type="button">${ICON.close}</button></div>
      <div class="sheet-body sticker-sheet">
        <div class="sticker-big">${url ? `<img src="${esc(url)}" alt="">` : ''}</div>
        <button class="file-act" id="stFav" type="button"><span class="fa-ico">${fav ? ICON.starFill : ICON.star}</span><span>${fav ? 'Quitar de favoritos' : 'Agregar a favoritos'}</span></button>
        ${!enMios ? `<button class="file-act" id="stSaveMine" type="button"><span class="fa-ico">${ICON.download}</span><span>Guardar en mis stickers</span></button>` : ''}
        ${m && !modoSeleccion ? `<button class="file-act" id="stReply" type="button"><span class="fa-ico">${ICON.reply}</span><span>Responder</span></button>
        <button class="file-act" id="stFwd" type="button"><span class="fa-ico">${ICON.forward}</span><span>Reenviar</span></button>` : ''}
        <button class="file-act" id="stShare" type="button"><span class="fa-ico">${ICON.share}</span><span>Compartir</span></button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => ov.remove();
  ov.querySelector('.sheet-close').onclick = cerrar;
  ov.onclick = (e) => { if (e.target === ov) cerrar(); };
  document.getElementById('stFav').onclick = () => {
    const ahora = toggleFavorito(path);
    cerrar();
    toast(ahora ? 'Agregado a favoritos ★' : 'Quitado de favoritos');
  };
  const save = document.getElementById('stSaveMine');
  if (save) save.onclick = () => { cerrar(); guardarStickerRecibido(path); };
  const rep = document.getElementById('stReply');
  if (rep) rep.onclick = () => { cerrar(); iniciarRespuesta(m); };
  const fwd = document.getElementById('stFwd');
  if (fwd) fwd.onclick = () => { cerrar(); abrirReenviar(m); };
  document.getElementById('stShare').onclick = () => { cerrar(); compartirArchivos([{ path, nombre: 'sticker.webp', tipo: 'image/webp' }]); };
}

// Hoja de adjuntos tipo WhatsApp (Documento, Cámara, Galería, Audio, Contacto, Sticker)
function abrirMenuAdjuntos() {
  const ops = [
    { act: 'document', label: 'Documento', icon: 'file',    color: '#7F66FF' },
    { act: 'camera',   label: 'Cámara',    icon: 'camera',  color: '#FF2E74' },
    { act: 'gallery',  label: 'Galería',   icon: 'images',  color: '#BF59CF' },
    { act: 'audio',    label: 'Audio',     icon: 'music',   color: '#F96533' },
    { act: 'contact',  label: 'Contacto',  icon: 'user',    color: '#009DE2' },
    { act: 'sticker',  label: 'Sticker',   icon: 'sticker', color: '#00A884' },
  ];
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay overlay-bottom';
  ov.innerHTML = `
    <div class="sheet sheet-bottom attach-sheet">
      <div class="attach-grid">
        ${ops.map(o => `<button class="attach-opt" data-act="${o.act}" type="button">
          <span class="ao-ico" style="background:${o.color}">${ICON[o.icon]}</span><span>${o.label}</span></button>`).join('')}
      </div>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) cerrar(); };
  ov.querySelectorAll('.attach-opt').forEach(b => {
    b.onclick = () => {
      const act = b.dataset.act;
      cerrar();
      if (act === 'gallery') document.getElementById('fileInputGallery').click();
      else if (act === 'camera') document.getElementById('fileInputCamera').click();
      else if (act === 'document') document.getElementById('fileInputDoc').click();
      else if (act === 'audio') document.getElementById('fileInputAudio').click();
      else if (act === 'contact') elegirContacto();
      else if (act === 'sticker') document.getElementById('stickerInput').click();
    };
  });
}

function wireComposer() {
  const input = document.getElementById('msgInput');
  document.getElementById('sendBtn').onclick = sendMessage;
  document.getElementById('attachBtn').onclick = abrirMenuAdjuntos;
  document.getElementById('cameraBtn').onclick = () => document.getElementById('fileInputCamera').click();
  for (const id of ['fileInputGallery', 'fileInputCamera', 'fileInputDoc', 'fileInputAudio']) {
    document.getElementById(id).addEventListener('change', onFilesPicked);
  }
  document.getElementById('stickerInput').addEventListener('change', crearStickerDesdeImagen);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') sendMessage(); });
  // "Está escribiendo…" + alternar mic/enviar
  input.addEventListener('input', () => { emitirEscribiendo(); actualizarBotonEnviar(); });

  // Panel de emojis / stickers
  const panel = document.getElementById('emojiPanel');
  document.getElementById('emojiBtn').onclick = () => {
    const abrir = panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !abrir);
    if (abrir) mostrarModoPanel(panel.dataset.mode || 'emoji');
  };
  document.getElementById('epTabs').addEventListener('click', (ev) => {
    const tab = ev.target.closest('.ep-tab');
    if (tab) mostrarCategoriaEmoji(tab.dataset.cat);
  });
  panel.querySelectorAll('.ep-mode').forEach(b => b.onclick = () => mostrarModoPanel(b.dataset.mode));
  document.getElementById('epBackspace').onclick = borrarUltimoCaracter;
  document.getElementById('epBody').addEventListener('click', (ev) => {
    const e = ev.target.closest('.emoji');
    if (e) { insertarEmoji(e.dataset.e); return; }
    const del = ev.target.closest('.sticker-del');
    if (del) { ev.stopPropagation(); borrarSticker(del.dataset.id); return; }
    const st = ev.target.closest('.sticker-item');
    if (st) { if (!st.dataset.edit && !st.classList.contains('broken')) enviarSticker(st.dataset.path); return; }
    const se = ev.target.closest('.sticker-emoji');
    if (se) { enviarStickerEmoji(se.dataset.e); return; }
    if (ev.target.closest('#stickerAdd')) { document.getElementById('stickerInput').click(); return; }
    if (ev.target.closest('#stickerEdit')) { modoEditarStickers = !modoEditarStickers; renderStickers(); return; }
  });
  // Notas de voz: mantener presionado el micrófono
  wireMicrofono();
  actualizarBotonEnviar();
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
  appendMensaje(box, m);
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

let typingActivo = false;
function mostrarEscribiendo(nombre) {
  const sub = document.getElementById('chatSub');
  if (!sub) return;
  typingActivo = true;
  sub.textContent = activeIsGroup ? `${nombre} está escribiendo…` : 'escribiendo…';
  sub.classList.add('typing');
  clearTimeout(typingHideTimer);
  typingHideTimer = setTimeout(() => {
    typingActivo = false;
    sub.classList.remove('typing');
    actualizarSubtituloChat();
  }, 3000);
}

// === PRESENCIA ("en línea") ===
// Canal compartido de presencia: cada usuario conectado se anuncia con su id.
let presenceChannel = null;
let onlineIds = new Set();
function iniciarPresencia() {
  if (presenceChannel || !currentUser) return;
  try {
    presenceChannel = sb.channel('online-users', { config: { presence: { key: currentUser.id } } });
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        onlineIds = new Set(Object.keys(presenceChannel.presenceState() || {}));
        actualizarSubtituloChat();
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          try { await presenceChannel.track({ online_at: new Date().toISOString() }); } catch (_) {}
        }
      });
  } catch (e) { console.warn('Presencia:', e); }
}
// Subtítulo del chat 1-a-1: "en línea" si el otro está conectado; si no, el texto normal
function actualizarSubtituloChat() {
  const sub = document.getElementById('chatSub');
  if (!sub || !activeChat || typingActivo) return;
  if (activeIsGroup) { sub.textContent = chatSubDefault; return; }
  const online = onlineIds.has(activeChat);
  sub.textContent = online ? 'en línea' : chatSubDefault;
  sub.classList.toggle('online', online);
}

function abrirBusqueda() {
  const bar = document.getElementById('searchBar');
  bar.classList.remove('hidden');
  document.getElementById('chatHeader')?.classList.add('hidden');
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
  document.getElementById('chatHeader')?.classList.remove('hidden');
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
  pendingFiles = []; replyingTo = null; editandoMsg = null; searchMatches = []; searchIdx = -1; modoSeleccion = false; seleccionados.clear();
  typingActivo = false;
  if (otherAvatar === undefined) {
    const { data } = await sb.from('profiles').select('avatar_url, avatar_version').eq('id', otherId).single();
    otherAvatar = avatarUrl(data);
  }
  chatSubDefault = 'toca para ver info';
  app.innerHTML = chatShell({ avatar: avatarHtml(otherAvatar, otherName, 'chat-av'), titulo: otherName, sub: chatSubDefault, conLlamadas: true });
  document.getElementById('backBtn').onclick = (e) => { e.stopPropagation(); unsubscribe(); renderChats(); };
  document.getElementById('peerHead').onclick = () => verPerfilUsuario(otherId, otherName, otherAvatar);
  document.getElementById('callAudioBtn').onclick = () => iniciarLlamada(otherId, otherName, otherAvatar, 'audio');
  document.getElementById('callVideoBtn').onclick = () => iniciarLlamada(otherId, otherName, otherAvatar, 'video');
  document.getElementById('chatMenuBtn').onclick = (ev) => abrirMenuPopup(ev.currentTarget, [
    { label: 'Ver contacto', icon: 'user', onClick: () => verPerfilUsuario(otherId, otherName, otherAvatar) },
    { label: 'Fotos compartidas', icon: 'images', onClick: () => verGaleria(otherId, otherName) },
    { label: 'Buscar', icon: 'search', onClick: abrirBusqueda },
    { label: 'Limpiar chat', icon: 'trash', danger: true, onClick: limpiarConversacion },
  ]);
  wireComposer();
  await loadMessages();
  subscribe();
  actualizarSubtituloChat();
}

async function openGroup(groupId, groupName, groupAvatar) {
  activeChat = groupId;
  activeChatName = groupName;
  activeIsGroup = true;
  pendingFiles = []; replyingTo = null; editandoMsg = null; searchMatches = []; searchIdx = -1; modoSeleccion = false; seleccionados.clear();
  typingActivo = false;
  // cargar nombres de miembros para mostrar autores
  memberNames = {};
  const { data: members } = await sb.from('group_members').select('user_id').eq('group_id', groupId);
  const ids = (members || []).map(m => m.user_id);
  if (ids.length) {
    const { data: profs } = await sb.from('profiles').select('id, display_name').in('id', ids);
    for (const p of profs || []) memberNames[p.id] = p.display_name;
  }
  if (groupAvatar === undefined) {
    const { data: g } = await sb.from('groups').select('avatar_url, avatar_version').eq('id', groupId).single();
    groupAvatar = avatarUrl(g);
  }
  // subtítulo: "Tú, Ana, Luis…" como en WhatsApp
  const otros = Object.entries(memberNames).filter(([id]) => id !== currentUser.id).map(([, n]) => n);
  chatSubDefault = ['Tú', ...otros].join(', ');
  app.innerHTML = chatShell({ avatar: avatarHtml(groupAvatar, groupName, 'chat-av group-av'), titulo: groupName, sub: chatSubDefault, conLlamadas: false });
  document.getElementById('backBtn').onclick = (e) => { e.stopPropagation(); unsubscribe(); renderChats(); };
  document.getElementById('peerHead').onclick = () => renderGroupInfo(groupId, groupName);
  document.getElementById('chatMenuBtn').onclick = (ev) => abrirMenuPopup(ev.currentTarget, [
    { label: 'Info del grupo', icon: 'group', onClick: () => renderGroupInfo(groupId, groupName) },
    { label: 'Buscar', icon: 'search', onClick: abrirBusqueda },
  ]);
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
      ${svgBtn('back', 'backBtn', 'link')}
      <span class="chat-title">Info del grupo</span>
    </div>
    <div class="profile">
      <div class="profile-avatar">
        ${gAvatar ? `<img class="avatar-lg" id="gAvatarPreview" src="${esc(gAvatar)}" alt="grupo">`
                  : `<div class="avatar-lg placeholder group-av" id="gAvatarPreview">${esc((g.name||'?')[0])}</div>`}
        <button class="link with-text" id="changeGroupPhoto">${ICON.camera}<span>Cambiar foto</span></button>
        <input id="groupAvatarInput" type="file" accept="image/*" hidden>
      </div>

      <label class="field-label">Nombre del grupo</label>
      <input id="gName" value="${esc(g.name || '')}" placeholder="Nombre del grupo">
      <button id="saveGroupName" class="btn-ico">${ICON.check}<span>Guardar nombre</span></button>

      <label class="field-label">Miembros (${profs.length})</label>
      <div class="member-list">
        ${profs.map(p => `<div class="member-row">
          ${avatarUrl(p) ? `<img class="avatar-img sm" src="${esc(avatarUrl(p))}">`
                         : `<div class="avatar sm">${esc((p.display_name||'?')[0])}</div>`}
          <span>${esc(p.display_name)}${p.id === currentUser.id ? ' (yo)' : ''}</span>
        </div>`).join('')}
      </div>

      <hr class="sep">
      <button id="leaveGroup" class="danger btn-ico">${ICON.logout}<span>Salir del grupo</span></button>
      <p id="giMsg" class="ok"></p>
    </div>`;

  document.getElementById('backBtn').onclick = () => openGroup(groupId, g.name, avatarUrl(g));
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
  scrollDiaEnganchado = false; // re-enganchar scroll del chat nuevo
  let diaPrevio = null;
  for (const m of visibles) {
    const dia = claveDia(m.created_at);
    if (dia !== diaPrevio) {
      box.insertAdjacentHTML('beforeend', separadorDiaHtml(m.created_at));
      diaPrevio = dia;
    }
    box.insertAdjacentHTML('beforeend', renderBubble(m));
    aplicarCola(box.lastElementChild);
  }
  box.scrollTop = box.scrollHeight;
  hydrateAttachments(box);
  attachLongPress(box);
  marcarLeidos(); // marca como leídos los mensajes del otro
  await cargarReacciones();
  for (const id of Object.keys(msgCache)) repintarReacciones(id);
  actualizarDiaFlotante(); // posiciona la etiqueta flotante
}

// HTML del separador de día
function separadorDiaHtml(iso) {
  return `<div class="day-sep" data-day="${claveDia(iso)}"><span>${esc(etiquetaDia(iso))}</span></div>`;
}

// Inserta un mensaje al final, anteponiendo separador de día si cambió la fecha
function appendMensaje(box, m) {
  const dia = claveDia(m.created_at);
  // último separador presente
  const seps = box.querySelectorAll('.day-sep');
  const ultimoDia = seps.length ? seps[seps.length - 1].dataset.day : null;
  if (dia !== ultimoDia) {
    box.insertAdjacentHTML('beforeend', separadorDiaHtml(m.created_at));
  }
  box.insertAdjacentHTML('beforeend', renderBubble(m));
  aplicarCola(box.lastElementChild);
}

// === ETIQUETA DE DÍA FLOTANTE (al hacer scroll, estilo WhatsApp) ===
let scrollDiaEnganchado = false, ocultarFloatTimer = null;

function actualizarDiaFlotante() {
  const box = document.getElementById('messages');
  const float = document.getElementById('dayFloat');
  if (!box || !float) return;

  // engancha el listener de scroll una sola vez
  if (!scrollDiaEnganchado) {
    box.addEventListener('scroll', onScrollDia, { passive: true });
    scrollDiaEnganchado = true;
  }
  // fija el texto inicial según el primer separador visible
  posicionarFloat();
}

function onScrollDia() {
  posicionarFloat();
  const float = document.getElementById('dayFloat');
  const box = document.getElementById('messages');
  if (!float || !box) return;
  // arriba del todo ya se ve el primer separador: no duplicarlo
  if (box.scrollTop < 24) { float.classList.add('hidden'); clearTimeout(ocultarFloatTimer); return; }
  // mostrar mientras se hace scroll, ocultar tras una pausa
  float.classList.remove('hidden');
  clearTimeout(ocultarFloatTimer);
  ocultarFloatTimer = setTimeout(() => float.classList.add('hidden'), 1400);
}

function posicionarFloat() {
  const box = document.getElementById('messages');
  const float = document.getElementById('dayFloat');
  if (!box || !float) return;
  const seps = [...box.querySelectorAll('.day-sep')];
  if (!seps.length) { float.classList.add('hidden'); return; }
  const topBox = box.getBoundingClientRect().top;
  // el último separador que ya pasó por arriba del viewport marca el día actual
  let actual = seps[0];
  for (const s of seps) {
    if (s.getBoundingClientRect().top - topBox <= 8) actual = s;
    else break;
  }
  float.querySelector('span').textContent = actual.querySelector('span').textContent;
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
    return `<div class="bubble ${mine ? 'mine' : 'theirs'} deleted" data-id="${m.id}" data-sender="${m.sender_id}">
      <div class="text"><em>🚫 ${mine ? 'Eliminaste este mensaje' : 'Este mensaje fue eliminado'}</em></div></div>`;
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
    inner += `<div class="author" style="color:${colorAutor(m.sender_id)}">${esc(autor)}</div>`;
  }
  if (m.attachment_path) {
    const type = m.attachment_type || '';
    const path = m.attachment_path || '';
    const isSticker = type === 'sticker';
    const isImage = type.startsWith('image/');
    const isAudio = type.startsWith('audio/') || /\.(webm|m4a|mp3|ogg|wav|aac)$/i.test(path) || /voz/i.test(path);
    const fwd = `<button class="obj-forward" title="Reenviar">${ICON.forward}</button>`;
    if (isSticker) {
      inner += `<div class="attach-wrap"><div class="attach-sticker" data-path="${esc(m.attachment_path)}" data-mine="${mine ? 1 : 0}"></div>${fwd}</div>`;
    } else if (isImage) {
      inner += `<div class="attach-wrap"><div class="attach-img" data-path="${esc(m.attachment_path)}"><span class="loading">Cargando imagen…</span></div>${fwd}</div>`;
    } else if (isAudio) {
      // 28 barras de onda (placeholder; se rellenan al cargar el audio)
      const barras = Array.from({length: 28}, () => '<span class="wf-bar"></span>').join('');
      inner += `<div class="attach-wrap"><div class="voice-note" data-path="${esc(m.attachment_path)}">
        <button class="voice-play" type="button">${ICON.play}</button>
        <div class="voice-body">
          <div class="waveform">${barras}</div>
          <div class="voice-meta"><span class="voice-time">0:00</span></div>
        </div>
        <button class="voice-speed" type="button" title="Velocidad">1x</button>
      </div>${fwd}</div>`;
    } else {
        inner += `<div class="attach-wrap"><a class="attach-file" data-path="${esc(m.attachment_path)}" data-name="${esc(m.attachment_name || 'archivo')}" href="#"><span class="file-ico">${ICON.file}</span><span class="file-info"><span class="file-name">${esc(m.attachment_name || 'archivo')}</span><small>${formatSize(m.attachment_size)}</small></span></a>${fwd}</div>`;
    }
  }
  if (m.content) inner += `<div class="text">${linkify(m.content)}</div>`;

  // Pie del mensaje: hora + "editado" + palomitas
  let meta = '<span class="hora">' + esc(formatHora(m.created_at)) + '</span>';
  if (m.edited_at) meta += `<span class="edited">editado</span>`;
  if (mine && !activeIsGroup) {
    meta += `<span class="ticks ${m.read_at ? 'read' : ''}">${ticksSvg()}</span>`;
  }
  inner += `<div class="meta">${meta}</div>`;

  const esSticker = m.attachment_type === 'sticker' ? ' sticker-bubble' : '';
  return `<div class="bubble ${mine ? 'mine' : 'theirs'}${esSticker}" data-id="${m.id}" data-sender="${m.sender_id}">${inner}<button class="bubble-menu-btn" title="Acciones" type="button">${ICON.forward}</button></div>`;
}

// Color estable por autor (nombres en grupos, como WhatsApp)
const AUTHOR_COLORS = ['#E542A3', '#00A884', '#F5A623', '#6BCBEF', '#FA6533', '#B38BFA', '#35CD96', '#D9A300', '#59B4E0', '#E86A7B'];
function colorAutor(id) {
  let h = 0;
  for (const c of String(id || '')) h = (h * 31 + c.charCodeAt(0)) | 0;
  return AUTHOR_COLORS[Math.abs(h) % AUTHOR_COLORS.length];
}

// "Cola" de la burbuja solo en el primer mensaje de una racha del mismo autor
function aplicarCola(el) {
  if (!el || !el.classList.contains('bubble')) return;
  const prev = el.previousElementSibling;
  const cola = !prev || !prev.classList.contains('bubble') || prev.dataset.sender !== el.dataset.sender;
  el.classList.toggle('tail', cola);
}

// Doble palomita SVG
function ticksSvg() {
  return '<svg viewBox="0 0 28 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 9l4 4 9-11"/><path d="M11 13l1.5 1.5L22 3"/></svg>';
}

// Hora en formato 12h (ej. "2:32 PM")
function formatHora(iso) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12; if (h === 0) h = 12;
  return `${h}:${m} ${ampm}`;
}

// Etiqueta de día: "Hoy", "Ayer" o fecha (ej. "12 de junio de 2026")
const MESES = ['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function etiquetaDia(iso) {
  const d = new Date(iso);
  const hoy = new Date();
  const ayer = new Date(); ayer.setDate(hoy.getDate() - 1);
  const mismaFecha = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (mismaFecha(d, hoy)) return 'Hoy';
  if (mismaFecha(d, ayer)) return 'Ayer';
  const año = d.getFullYear() === hoy.getFullYear() ? '' : ` de ${d.getFullYear()}`;
  return `${d.getDate()} de ${MESES[d.getMonth()]}${año}`;
}

// Clave de día para comparar (YYYY-MM-DD en hora local)
function claveDia(iso) {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

// Texto de vista previa para la lista de contactos
function previewTexto(m) {
  if (m.deleted_at) return 'Mensaje eliminado';
  if (m.content) return m.content;
  const t = m.attachment_type || '';
  if (t === 'sticker') return '🎟️ Sticker';
  if (t.startsWith('image/')) return '📷 Foto';
  if (t.startsWith('audio/') || /voz/i.test(m.attachment_name || '')) return '🎤 Nota de voz';
  if (t.startsWith('video/')) return '🎥 Video';
  if (m.attachment_name) return '📎 ' + m.attachment_name;
  return '';
}

// Detecta "mantener presionado" (y clic derecho en escritorio) sobre burbujas
function attachLongPress(box) {
  let timer = null;
  const start = (el) => {
    timer = setTimeout(() => {
      const id = el.dataset.id;
      if (id && !modoSeleccion) activarAcciones(parseInt(id), el);
    }, 450);
  };
  const cancel = () => { if (timer) { clearTimeout(timer); timer = null; } };

  box.querySelectorAll('.bubble').forEach(el => {
    const id = el.dataset.id;
    // Flechita ▾ (visible en hover en web): activa acciones
    const menuBtn = el.querySelector('.bubble-menu-btn');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (modoSeleccion) { toggleSeleccion(parseInt(id), el); return; }
        if (id) activarAcciones(parseInt(id), el);
      });
    }
    // Flechita de reenvío rápido en objetos (voz/imagen/video/archivo)
    const fwdBtn = el.querySelector('.obj-forward');
    if (fwdBtn) {
      fwdBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const m = msgCache[id];
        if (m) abrirReenviar(m);
      });
    }
    // En modo selección, un tap marca/desmarca
    el.addEventListener('click', (e) => {
      if (!modoSeleccion) return;
      e.stopPropagation();
      toggleSeleccion(parseInt(id), el);
    });
    // Gestos táctiles: long-press (acciones) + swipe horizontal (responder)
    let sx = 0, sy = 0, swiping = false, swiped = false;
    el.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      sx = t.clientX; sy = t.clientY; swiping = false; swiped = false;
      start(el);
    }, { passive: true });
    el.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      const dx = t.clientX - sx, dy = t.clientY - sy;
      // si el movimiento es claramente horizontal hacia la derecha, es swipe-responder
      if (!swiped && Math.abs(dx) > Math.abs(dy) && dx > 10) {
        cancel();              // no es long-press
        swiping = true;
        const desp = Math.min(dx, 80);
        el.style.transform = `translateX(${desp}px)`;
        el.classList.add('swiping');
        if (dx > 55 && !swiped) {
          swiped = true;        // umbral alcanzado: responder
          if (navigator.vibrate) navigator.vibrate(15);
        }
      } else if (Math.abs(dy) > 10) {
        cancel();              // se está desplazando vertical (scroll)
      }
    }, { passive: true });
    el.addEventListener('touchend', () => {
      cancel();
      if (swiping) {
        el.style.transform = '';
        el.classList.remove('swiping');
        if (swiped && !modoSeleccion) {
          const m = msgCache[id];
          if (m && !m.deleted_at) iniciarRespuesta(m);
        }
      }
    });
    // escritorio: clic derecho
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      if (modoSeleccion) return;
      if (id) activarAcciones(parseInt(id), el);
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

// === ACCIONES SOBRE UN MENSAJE (emojis + barra en el encabezado) ===
let mensajeActivo = null;

function activarAcciones(msgId, el) {
  const m = msgCache[msgId];
  if (!m || m.deleted_at) return;
  mensajeActivo = m;

  // resaltar el mensaje activo
  document.querySelectorAll('.bubble.action-target').forEach(b => b.classList.remove('action-target'));
  el?.classList.add('action-target');

  // 1) mostrar la barra de emojis de reacción rápida
  mostrarBarraEmojis(msgId);

  // 2) cambiar el encabezado a modo acciones para ESTE mensaje
  const mine = m.sender_id === currentUser.id;
  document.getElementById('chatHeader')?.classList.add('hidden');
  const ah = document.getElementById('actionHeader');
  if (ah) {
    ah.classList.remove('hidden');
    // editar solo en mis mensajes con texto
    const editBtn = document.getElementById('actEdit');
    if (editBtn) editBtn.style.display = (mine && m.content) ? '' : 'none';
    document.getElementById('actClose').onclick = cerrarAcciones;
    document.getElementById('actReply').onclick = () => { cerrarAcciones(); iniciarRespuesta(m); };
    document.getElementById('actForward').onclick = () => { cerrarAcciones(); abrirReenviar(m); };
    document.getElementById('actShare').onclick = () => { cerrarAcciones(); compartirMensajes([m]); };
    if (editBtn) editBtn.onclick = () => { cerrarAcciones(); editarMensaje(m); };
    document.getElementById('actSelect').onclick = () => { cerrarAcciones(); entrarModoSeleccion(m.id); };
    document.getElementById('actDelete').onclick = () => { cerrarAcciones(); borrarMensaje(m); };
  }
}

function cerrarAcciones() {
  mensajeActivo = null;
  document.querySelectorAll('.bubble.action-target').forEach(b => b.classList.remove('action-target'));
  document.getElementById('reactStrip')?.remove();
  document.getElementById('actionHeader')?.classList.add('hidden');
  document.getElementById('chatHeader')?.classList.remove('hidden');
}

// Barra flotante de emojis de reacción rápida (estilo WhatsApp)
function mostrarBarraEmojis(msgId) {
  document.getElementById('reactStrip')?.remove();
  const bubble = document.querySelector(`.bubble[data-id="${msgId}"]`);
  if (!bubble) return;
  const strip = document.createElement('div');
  strip.id = 'reactStrip';
  strip.className = 'react-strip';
  strip.innerHTML =
    REACT_QUICK.map(e => `<button class="react-q" data-e="${e}">${e}</button>`).join('') +
    `<button class="react-q more" id="reactStripMore">${ICON.plus}</button>`;
  // posicionar sobre la burbuja
  bubble.insertAdjacentElement('beforebegin', strip);
  strip.querySelectorAll('.react-q[data-e]').forEach(b =>
    b.onclick = () => { const e = b.dataset.e; cerrarAcciones(); reaccionar(msgId, e); });
  document.getElementById('reactStripMore').onclick = () => { cerrarAcciones(); abrirSelectorReaccion(msgId); };
  // tocar fuera cierra todo
  setTimeout(() => {
    const onDoc = (ev) => {
      if (!ev.target.closest('#reactStrip') && !ev.target.closest('#actionHeader')) {
        cerrarAcciones();
        document.removeEventListener('click', onDoc, true);
      }
    };
    document.addEventListener('click', onDoc, true);
  }, 50);
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
    <button class="link" id="selCancel" type="button">${ICON.close}</button>
    <span class="sel-count">${seleccionados.size}</span>
    <button class="link" id="selCopy" title="Copiar" type="button">${ICON.copy}</button>
    <button class="link" id="selForward" title="Reenviar" type="button">${ICON.forward}</button>
    <button class="link" id="selShare" title="Compartir" type="button">${ICON.share}</button>
    <button class="link" id="selDelete" title="Eliminar" type="button">${ICON.trash}</button>`;
  document.getElementById('selCancel').onclick = salirModoSeleccion;
  document.getElementById('selCopy').onclick = copiarSeleccionados;
  document.getElementById('selForward').onclick = reenviarSeleccionados;
  document.getElementById('selShare').onclick = () => { const msgs = mensajesSeleccionados(); salirModoSeleccion(); compartirMensajes(msgs); };
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
    toast('Copiado al portapapeles ✓');
  } catch (_) {
    toast('No se pudo copiar en este navegador');
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
        ${groups.map(g => `<div class="fwd-item" data-type="group" data-id="${g.id}" data-name="${esc(g.name||'')}">
          ${avatarUrl(g) ? `<img class="avatar-img sm" src="${esc(avatarUrl(g))}">` : `<div class="avatar sm group-av">${esc((g.name||'?')[0])}</div>`}
          <span>${esc(g.name)}</span></div>`).join('')}
        ${profiles.map(p => `<div class="fwd-item" data-type="user" data-id="${p.id}" data-name="${esc(p.display_name||'')}">
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
      const tipo = it.dataset.type, id = it.dataset.id, nombre = it.dataset.name;
      for (const m of msgs) await reenviarMensaje(m, tipo, id);
      close();
      salirModoSeleccion();
      // llevar directo a la conversación destino (sin alert)
      if (tipo === 'group') openGroup(id, nombre);
      else openChat(id, nombre);
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
function editarMensaje(m) {
  // Carga el texto en el compositor y muestra una barra "Editando"
  editandoMsg = m;
  replyingTo = null; // no se puede responder y editar a la vez
  document.getElementById('replyBar')?.remove();
  const input = document.getElementById('msgInput');
  if (input) { input.value = m.content || ''; input.focus(); }
  mostrarBarraEdicion();
  actualizarBotonEnviar();
}

function mostrarBarraEdicion() {
  let bar = document.getElementById('editBar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'editBar';
    bar.className = 'reply-bar edit-bar';
    const composer = document.querySelector('.composer');
    composer.parentNode.insertBefore(bar, composer);
  }
  bar.innerHTML = `
    <div class="reply-bar-content">
      <span class="reply-bar-author">${ICON.edit}<span>Editando mensaje</span></span>
      <span class="reply-bar-text">${esc((editandoMsg.content || '').slice(0, 80))}</span>
    </div>
    <button id="cancelEdit" class="link">${ICON.close}</button>`;
  document.getElementById('cancelEdit').onclick = cancelarEdicion;
}

function cancelarEdicion() {
  editandoMsg = null;
  document.getElementById('editBar')?.remove();
  const input = document.getElementById('msgInput');
  if (input) input.value = '';
  actualizarBotonEnviar();
}

async function guardarEdicion() {
  const input = document.getElementById('msgInput');
  const texto = (input?.value || '').trim();
  const m = editandoMsg;
  if (!m) return;
  if (!texto) { // si lo dejó vacío, cancelar
    cancelarEdicion();
    return;
  }
  if (texto === m.content) { cancelarEdicion(); return; }
  const { error } = await sb.from('messages')
    .update({ content: texto, edited_at: new Date().toISOString() })
    .eq('id', m.id);
  if (error) { alert('No se pudo editar: ' + error.message); return; }
  cancelarEdicion(); // limpia barra y campo; el UPDATE en realtime refresca la burbuja
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
  const preview = m.content ? m.content.slice(0, 80) : previewTexto(m);
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
    <button id="cancelReply" class="link" type="button">${ICON.close}</button>`;
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
        ${groups.map(g => `<div class="fwd-item" data-type="group" data-id="${g.id}" data-name="${esc(g.name||'')}">
          ${avatarUrl(g) ? `<img class="avatar-img sm" src="${esc(avatarUrl(g))}">` : `<div class="avatar sm group-av">${esc((g.name||'?')[0])}</div>`}
          <span>${esc(g.name)}</span></div>`).join('')}
        ${profiles.map(p => `<div class="fwd-item" data-type="user" data-id="${p.id}" data-name="${esc(p.display_name||'')}">
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
      const tipo = it.dataset.type, id = it.dataset.id, nombre = it.dataset.name;
      await reenviarMensaje(m, tipo, id);
      close();
      // llevar directo a la conversación destino (sin alert)
      if (tipo === 'group') openGroup(id, nombre);
      else openChat(id, nombre);
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
        const ct = m.attachment_type === 'sticker' ? 'image/webp' : (m.attachment_type || 'application/octet-stream');
        await sb.storage.from('attachments').upload(newPath, file, { contentType: ct });
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

// Menú al tocar un archivo adjunto: Abrir o Descargar
function abrirMenuArchivo(path, nombre, tipo) {
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay overlay-bottom';
  ov.innerHTML = `
    <div class="sheet sheet-bottom">
      <div class="sheet-head"><h3>${esc(nombre)}</h3><button class="sheet-close">✕</button></div>
      <div class="sheet-body">
        <button class="file-act" id="fileOpen"><span class="fa-ico">${ICON.file}</span><span>Abrir</span></button>
        <button class="file-act" id="fileDownload"><span class="fa-ico">${ICON.download}</span><span>Descargar</span></button>
        <button class="file-act" id="fileShare"><span class="fa-ico">${ICON.share}</span><span>Compartir</span></button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const cerrar = () => ov.remove();
  ov.querySelector('.sheet-close').onclick = cerrar;
  ov.onclick = (e) => { if (e.target === ov) cerrar(); };

  document.getElementById('fileOpen').onclick = async () => {
    cerrar();
    const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener');
    else alert('No se pudo abrir el archivo.');
  };
  document.getElementById('fileShare').onclick = () => { cerrar(); compartirArchivos([{ path, nombre, tipo }]); };
  document.getElementById('fileDownload').onclick = async () => {
    cerrar();
    // URL firmada con descarga forzada (el navegador lo baja en vez de mostrarlo)
    const { data } = await sb.storage.from('attachments')
      .createSignedUrl(path, 3600, { download: nombre });
    if (data?.signedUrl) {
      const a = document.createElement('a');
      a.href = data.signedUrl;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } else {
      alert('No se pudo descargar el archivo.');
    }
  };
}

async function hydrateAttachments(box) {
  for (const el of box.querySelectorAll('.attach-sticker')) {
    if (el.dataset.ready) continue;
    el.dataset.ready = '1';
    const path = el.dataset.path;
    const url = await urlSticker(path);
    if (!url) { el.innerHTML = '<span class="loading">No disponible</span>'; continue; }
    el.innerHTML = `<img src="${url}" alt="sticker" loading="lazy" draggable="false">`;
    // tocar un sticker → favoritos / guardar / responder / reenviar
    const msgId = parseInt(el.closest('.bubble')?.dataset.id);
    el.querySelector('img').onclick = (ev) => {
      if (modoSeleccion) return;
      ev.stopPropagation();
      abrirMenuSticker(msgId, path);
    };
  }
  for (const el of box.querySelectorAll('.attach-img')) {
    if (el.dataset.ready) continue;
    el.dataset.ready = '1';
    const path = el.dataset.path;
    const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600);
    if (data?.signedUrl) {
      el.innerHTML = `<img src="${data.signedUrl}" alt="adjunto" loading="lazy">`;
      const m = msgCache[el.closest('.bubble')?.dataset.id];
      el.querySelector('img').onclick = () => {
        if (modoSeleccion) return;
        verImagenCompleta(data.signedUrl, { path, nombre: m?.attachment_name || 'foto.jpg', tipo: m?.attachment_type });
      };
    } else { el.innerHTML = '<span class="loading">No disponible</span>'; }
  }
  for (const el of box.querySelectorAll('.attach-file')) {
    if (el.dataset.ready) continue;
    el.dataset.ready = '1';
    const path = el.dataset.path;
    const nombre = el.dataset.name || 'archivo';
    const tipo = msgCache[el.closest('.bubble')?.dataset.id]?.attachment_type;
    el.addEventListener('click', (ev) => {
      ev.preventDefault();
      abrirMenuArchivo(path, nombre, tipo);
    });
  }
  // Notas de voz: reproductor con onda, tiempo y velocidad
  for (const el of box.querySelectorAll('.voice-note')) {
    if (el.dataset.ready) continue;       // ya enganchada
    const path = el.dataset.path;
    const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600);
    if (!data?.signedUrl) continue;
    el.dataset.ready = '1';
    const audio = new Audio(data.signedUrl);
    audio.preload = 'metadata';
    const btn = el.querySelector('.voice-play');
    const timeEl = el.querySelector('.voice-time');
    const speedBtn = el.querySelector('.voice-speed');
    const bars = [...el.querySelectorAll('.wf-bar')];

    // alturas pseudo-aleatorias pero estables (según la ruta) para la onda
    let seed = 0; for (const c of path) seed = (seed * 31 + c.charCodeAt(0)) | 0;
    bars.forEach((b, i) => {
      const v = Math.abs(Math.sin(seed + i * 1.7)) * 0.7 + 0.3; // 0.3–1.0
      b.style.height = `${Math.round(v * 100)}%`;
    });

    const fmt = (s) => isFinite(s) ? `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,'0')}` : '0:00';
    audio.onloadedmetadata = () => { if (timeEl) timeEl.textContent = fmt(audio.duration); };
    audio.ontimeupdate = () => {
      if (timeEl) timeEl.textContent = fmt(audio.currentTime || 0);
      const prog = audio.duration ? audio.currentTime / audio.duration : 0;
      const activas = Math.round(prog * bars.length);
      bars.forEach((b, i) => b.classList.toggle('played', i < activas));
    };

    btn.onclick = () => {
      document.querySelectorAll('.voice-note').forEach(otra => {
        if (otra !== el && otra._audio && !otra._audio.paused) {
          otra._audio.pause();
          otra.querySelector('.voice-play').innerHTML = ICON.play;
        }
      });
      if (audio.paused) { audio.play(); btn.innerHTML = ICON.pause; }
      else { audio.pause(); btn.innerHTML = ICON.play; }
    };
    audio.onended = () => {
      btn.innerHTML = ICON.play;
      bars.forEach(b => b.classList.remove('played'));
      if (timeEl) timeEl.textContent = fmt(audio.duration);
    };

    // botón de velocidad: 1x → 1.5x → 2x → 1x
    const velocidades = [1, 1.5, 2];
    let vi = 0;
    if (speedBtn) speedBtn.onclick = () => {
      vi = (vi + 1) % velocidades.length;
      audio.playbackRate = velocidades[vi];
      speedBtn.textContent = velocidades[vi] + 'x';
    };

    // tocar la onda para saltar a una posición
    const wf = el.querySelector('.waveform');
    if (wf) wf.onclick = (e) => {
      const r = wf.getBoundingClientRect();
      const prog = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
      if (audio.duration) audio.currentTime = prog * audio.duration;
    };

    el._audio = audio;
  }
}

const MAX_ADJUNTOS = 20;
function onFilesPicked(e) {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  for (const file of files) {
    if (pendingFiles.length >= MAX_ADJUNTOS) {
      alert(`Máximo ${MAX_ADJUNTOS} adjuntos a la vez.`);
      break;
    }
    if (file.size > MAX_FILE_BYTES) {
      alert(`"${file.name}" supera el máximo de 10 MB (pesa ${formatSize(file.size)}).`);
      continue;
    }
    pendingFiles.push(file);
  }
  e.target.value = '';
  renderPreviewAdjuntos();
}

function renderPreviewAdjuntos() {
  const preview = document.getElementById('filePreview');
  if (!preview) return;
  actualizarBotonEnviar();
  if (!pendingFiles.length) {
    preview.classList.add('hidden');
    preview.innerHTML = '';
    return;
  }
  preview.classList.remove('hidden');
  const items = pendingFiles.map((f, i) => {
    const esImg = (f.type || '').startsWith('image/');
    const thumb = esImg
      ? `<img src="${URL.createObjectURL(f)}" alt="">`
      : `<span class="ap-ico">${ICON.file}</span>`;
    return `<div class="attach-pill" data-i="${i}">
      <div class="ap-thumb">${thumb}</div>
      <span class="ap-name">${esc(f.name)}</span>
      <button class="ap-x" data-i="${i}" title="Quitar">✕</button>
    </div>`;
  }).join('');
  const total = pendingFiles.length;
  preview.innerHTML = `<div class="ap-head">${total} adjunto${total>1?'s':''}${total>=MAX_ADJUNTOS?' (máx)':''}<button id="apClear" class="link">Quitar todos</button></div><div class="ap-list">${items}</div>`;
  preview.querySelectorAll('.ap-x').forEach(b => {
    b.onclick = () => { pendingFiles.splice(+b.dataset.i, 1); renderPreviewAdjuntos(); };
  });
  document.getElementById('apClear').onclick = clearPendingFiles;
}

function clearPendingFiles() {
  pendingFiles = [];
  renderPreviewAdjuntos();
}

// Compartir un contacto: elige un usuario y lo envía como mensaje
async function elegirContacto() {
  const { data: profiles } = await sb.from('profiles').select('*').neq('id', currentUser.id).order('display_name');
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay overlay-bottom';
  ov.innerHTML = `
    <div class="sheet sheet-bottom">
      <div class="sheet-head"><h3>Compartir contacto</h3><button class="sheet-close">✕</button></div>
      <div class="sheet-body">
        ${(profiles || []).map(p => `
          <button class="contact-pick" data-name="${esc(p.display_name || p.username || 'Usuario')}" data-user="${esc(p.username || '')}">
            <span class="cp-avatar">${esc((p.display_name || '?')[0])}</span>
            <span class="cp-name">${esc(p.display_name || p.username || 'Usuario')}</span>
          </button>`).join('') || '<p class="empty small">No hay contactos para compartir.</p>'}
      </div>
    </div>`;
  document.body.appendChild(ov);
  ov.querySelector('.sheet-close').onclick = () => ov.remove();
  ov.onclick = (e) => { if (e.target === ov) ov.remove(); };
  ov.querySelectorAll('.contact-pick').forEach(b => {
    b.onclick = async () => {
      const nombre = b.dataset.name;
      const user = b.dataset.user;
      ov.remove();
      const texto = `👤 Contacto: ${nombre}${user ? ' (@' + user + ')' : ''}`;
      const row = { sender_id: currentUser.id, content: texto };
      if (activeIsGroup) row.group_id = activeChat; else row.recipient_id = activeChat;
      const { data: inserted } = await sb.from('messages').insert(row).select().single();
      if (inserted) pintarMensajePropio(inserted);
    };
  });
}

async function sendMessage() {
  // Si estoy editando un mensaje, el "enviar" guarda la edición
  if (editandoMsg) { guardarEdicion(); return; }
  const input = document.getElementById('msgInput');
  const content = input.value.trim();
  if (!content && !pendingFiles.length) return;
  const sendBtn = document.getElementById('sendBtn');
  sendBtn.disabled = true;

  const baseRow = {};
  if (activeIsGroup) baseRow.group_id = activeChat;
  else baseRow.recipient_id = activeChat;
  if (replyingTo) {
    baseRow.reply_to = replyingTo.id;
    baseRow.reply_preview = replyingTo.preview;
    baseRow.reply_author = replyingTo.author;
  }

  // Copia de los adjuntos a enviar y limpieza inmediata de la UI
  const archivos = pendingFiles.slice();
  const texto = content;
  input.value = '';
  clearPendingFiles();
  cancelarRespuesta();
  actualizarBotonEnviar();

  try {
    // Enviar cada adjunto como su propio mensaje (como WhatsApp)
    for (let i = 0; i < archivos.length; i++) {
      const f = archivos[i];
      const safeName = f.name.replace(/[^\w.\-]/g, '_');
      const path = `${currentUser.id}/${Date.now()}-${i}-${safeName}`;
      const { error: upErr } = await sb.storage.from('attachments')
        .upload(path, f, { contentType: f.type || 'application/octet-stream' });
      if (upErr) throw upErr;
      const row = {
        sender_id: currentUser.id,
        content: null,
        attachment_path: path,
        attachment_name: f.name,
        attachment_type: f.type || 'application/octet-stream',
        attachment_size: f.size,
        ...baseRow
      };
      const { data: inserted } = await sb.from('messages').insert(row).select().single();
      if (inserted) pintarMensajePropio(inserted);
    }
    // Enviar el texto (si lo hay) como mensaje aparte
    if (texto) {
      const row = { sender_id: currentUser.id, content: texto, ...baseRow };
      const { data: inserted } = await sb.from('messages').insert(row).select().single();
      if (inserted) pintarMensajePropio(inserted);
    }
  } catch (err) {
    alert('No se pudo enviar un adjunto: ' + (err.message || err));
  }

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
      appendMensaje(box, m);
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
        if (old.classList.contains('tail')) nuevo.classList.add('tail');
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
  typingActivo = false;
  clearTimeout(typingHideTimer);
}

// === HELPERS ===
const val = id => document.getElementById(id).value;
const esc = s => (s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Convierte URLs del texto en enlaces clicables. Escapa primero (seguridad),
// luego detecta http(s):// y www. y los envuelve en <a>.
function linkify(text) {
  const escaped = esc(text);
  const urlRe = /\b((?:https?:\/\/|www\.)[^\s<]+)/gi;
  return escaped.replace(urlRe, (url) => {
    let href = url;
    if (/^www\./i.test(href)) href = 'https://' + href;
    // no incluir signos de puntuación finales en el enlace
    let trail = '';
    const m = url.match(/[.,;:!?)]+$/);
    if (m) { trail = url.slice(url.length - m[0].length); href = href.slice(0, href.length - m[0].length); url = url.slice(0, url.length - m[0].length); }
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="msg-link">${url}</a>${trail}`;
  });
}
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
//  PERFIL DE OTRO USUARIO (solo lectura)
// ============================================================
async function verPerfilUsuario(otherId, otherName, otherAvatar) {
  // refrescar datos por si cambió foto/nombre
  let prof = { display_name: otherName, avatar_url: null, avatar_version: 0 };
  try {
    const { data } = await sb.from('profiles').select('*').eq('id', otherId).single();
    if (data) prof = data;
  } catch (_) {}
  const av = avatarUrl(prof) || otherAvatar;
  const nombre = prof.display_name || otherName || 'Usuario';

  const overlay = document.createElement('div');
  overlay.id = 'peerProfileOverlay';
  overlay.className = 'peer-profile-overlay';
  overlay.innerHTML = `
    <div class="peer-profile">
      <button class="link peer-close" id="peerClose">${ICON.close}</button>
      ${av
        ? `<img class="peer-avatar" id="peerAvatarImg" src="${esc(av)}" alt="${esc(nombre)}">`
        : `<div class="peer-avatar placeholder">${esc((nombre||'?')[0])}</div>`}
      <div class="peer-name">${esc(nombre)}</div>
      <div class="peer-actions">
        <button class="peer-act" id="peerCallAudio">${ICON.phone}<span>Llamar</span></button>
        <button class="peer-act" id="peerCallVideo">${ICON.video}<span>Video</span></button>
      </div>
      <div class="peer-links">
        <button class="peer-link" id="peerGallery">${ICON.images}<span>Fotos compartidas</span></button>
        <button class="peer-link" id="peerCalls">${ICON.callLog}<span>Historial de llamadas</span></button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const close = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.getElementById('peerClose').onclick = close;
  document.getElementById('peerCallAudio').onclick = () => { close(); iniciarLlamada(otherId, nombre, av, 'audio'); };
  document.getElementById('peerCallVideo').onclick = () => { close(); iniciarLlamada(otherId, nombre, av, 'video'); };
  document.getElementById('peerGallery').onclick = () => { close(); verGaleria(otherId, nombre); };
  document.getElementById('peerCalls').onclick = () => { close(); verHistorialLlamadas(otherId, nombre); };
  // tocar la foto la muestra a tamaño completo
  const img = document.getElementById('peerAvatarImg');
  if (img) img.onclick = () => verImagenCompleta(av);
}

// Muestra una imagen a pantalla completa (reusable)
function verImagenCompleta(url, archivo) {
  if (!url) return;
  const ov = document.createElement('div');
  ov.className = 'img-full-overlay';
  ov.innerHTML = `<img src="${esc(url)}" alt="">
    <div class="img-full-bar">
      ${archivo ? `<button class="link img-full-btn" id="imgShare" title="Compartir" type="button">${ICON.share}</button>
                   <button class="link img-full-btn" id="imgDownload" title="Descargar" type="button">${ICON.download}</button>` : ''}
      <button class="link img-full-btn img-full-close" type="button">${ICON.close}</button>
    </div>`;
  document.body.appendChild(ov);
  const close = () => ov.remove();
  ov.onclick = (e) => { if (!e.target.closest('.img-full-bar')) close(); };
  ov.querySelector('.img-full-close').onclick = close;
  if (archivo) {
    document.getElementById('imgShare').onclick = () => { close(); compartirArchivos([archivo]); };
    document.getElementById('imgDownload').onclick = () => { close(); descargarArchivo(archivo.path, archivo.nombre); };
  }
}

// === COMPARTIR A OTRAS APPS (hoja nativa del sistema) ===
// Usa la Web Share API. Si no está disponible (escritorio), copia el texto o descarga el archivo.
function puedeCompartir() { return typeof navigator.share === 'function'; }

async function compartirTexto(texto) {
  if (!texto) return;
  if (puedeCompartir()) {
    try { await navigator.share({ text: texto }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  try { await navigator.clipboard.writeText(texto); toast('Texto copiado al portapapeles'); }
  catch (_) { toast('No se pudo compartir en este navegador'); }
}

// archivos: [{ path, nombre, tipo }] del bucket 'attachments'; texto opcional que acompaña
async function compartirArchivos(archivos, texto) {
  toast('Preparando…');
  const files = [];
  for (const a of archivos) {
    try {
      const { data: blob } = await sb.storage.from('attachments').download(a.path);
      if (!blob) continue;
      const tipo = a.tipo === 'sticker' ? 'image/webp' : (a.tipo || blob.type || 'application/octet-stream');
      let nombre = (a.nombre || 'archivo').replace(/[\\/:*?"<>|]/g, '_');
      if (!/\.[a-z0-9]{2,5}$/i.test(nombre)) nombre += extensionPorTipo(tipo);
      files.push(new File([blob], nombre, { type: tipo }));
    } catch (err) { console.warn('No se pudo descargar para compartir:', err); }
  }
  if (!files.length) { toast('No se pudo obtener el archivo'); return; }
  if (puedeCompartir() && navigator.canShare && navigator.canShare({ files })) {
    try { await navigator.share({ files, text: texto || undefined }); return; }
    catch (err) { if (err.name === 'AbortError') return; console.warn('share:', err); }
  }
  // sin hoja nativa: descargar (uno por uno)
  for (const f of files) {
    const url = URL.createObjectURL(f);
    const el = document.createElement('a');
    el.href = url; el.download = f.name;
    document.body.appendChild(el); el.click(); el.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
  toast(files.length > 1 ? 'Archivos descargados' : 'Archivo descargado');
}

function extensionPorTipo(tipo) {
  const t = (tipo || '').toLowerCase();
  if (t.includes('webp')) return '.webp';
  if (t.includes('jpeg') || t.includes('jpg')) return '.jpg';
  if (t.includes('png')) return '.png';
  if (t.includes('gif')) return '.gif';
  if (t.includes('mp4')) return t.startsWith('audio') ? '.m4a' : '.mp4';
  if (t.includes('webm')) return '.webm';
  if (t.includes('pdf')) return '.pdf';
  return '';
}

// Comparte uno o varios mensajes: el texto se junta; los adjuntos van como archivos
async function compartirMensajes(msgs) {
  const lista = (msgs || []).filter(m => m && !m.deleted_at);
  if (!lista.length) return;
  const textos = lista.filter(m => m.content).map(m => m.content);
  const archivos = lista.filter(m => m.attachment_path).map(m => ({
    path: m.attachment_path, nombre: m.attachment_name, tipo: m.attachment_type,
  }));
  const texto = textos.join('\n');
  if (archivos.length) await compartirArchivos(archivos, texto);
  else await compartirTexto(texto);
}

async function descargarArchivo(path, nombre) {
  const { data } = await sb.storage.from('attachments').createSignedUrl(path, 3600, { download: nombre });
  if (!data?.signedUrl) { toast('No se pudo descargar'); return; }
  const a = document.createElement('a');
  a.href = data.signedUrl; a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
}

// ============================================================
//  GALERÍA DE FOTOS COMPARTIDAS (de una conversación 1-a-1)
// ============================================================
async function verGaleria(otherId, nombre) {
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay';
  ov.innerHTML = `
    <div class="sheet">
      <div class="sheet-head">
        <button class="link" id="galClose">${ICON.back}</button>
        <span class="sheet-title">Fotos con ${esc(nombre)}</span>
      </div>
      <div class="gallery-grid" id="galGrid"><p class="empty small">Cargando…</p></div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById('galClose').onclick = () => ov.remove();

  // traer mensajes con imagen de esta conversación
  const { data } = await sb.from('messages')
    .select('attachment_path, attachment_type, created_at')
    .or(`and(sender_id.eq.${currentUser.id},recipient_id.eq.${otherId}),and(sender_id.eq.${otherId},recipient_id.eq.${currentUser.id})`)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const imgs = (data || []).filter(m => (m.attachment_type || '').startsWith('image/') && m.attachment_path);
  const grid = document.getElementById('galGrid');
  if (!imgs.length) { grid.innerHTML = '<p class="empty small">No hay fotos compartidas todavía.</p>'; return; }

  grid.innerHTML = '';
  for (const m of imgs) {
    const cell = document.createElement('div');
    cell.className = 'gallery-cell';
    cell.innerHTML = `<div class="gallery-loading"></div>`;
    grid.appendChild(cell);
    // url firmada
    const { data: signed } = await sb.storage.from('attachments').createSignedUrl(m.attachment_path, 3600);
    if (signed?.signedUrl) {
      cell.innerHTML = `<img src="${esc(signed.signedUrl)}" loading="lazy" alt="">`;
      cell.querySelector('img').onclick = () => verImagenCompleta(signed.signedUrl);
    }
  }
}

// ============================================================
//  HISTORIAL DE LLAMADAS (de una conversación 1-a-1)
// ============================================================
async function verHistorialLlamadas(otherId, nombre) {
  const ov = document.createElement('div');
  ov.className = 'sheet-overlay';
  ov.innerHTML = `
    <div class="sheet">
      <div class="sheet-head">
        <button class="link" id="clClose">${ICON.back}</button>
        <span class="sheet-title">Llamadas con ${esc(nombre)}</span>
      </div>
      <div class="call-log" id="clList"><p class="empty small">Cargando…</p></div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById('clClose').onclick = () => ov.remove();

  const { data } = await sb.from('calls')
    .select('*')
    .or(`and(caller_id.eq.${currentUser.id},callee_id.eq.${otherId}),and(caller_id.eq.${otherId},callee_id.eq.${currentUser.id})`)
    .order('started_at', { ascending: false })
    .limit(100);

  const list = document.getElementById('clList');
  if (!data || !data.length) { list.innerHTML = '<p class="empty small">No hay llamadas registradas.</p>'; return; }

  list.innerHTML = data.map(c => {
    const saliente = c.caller_id === currentUser.id;
    const perdida = c.status === 'missed' || c.status === 'rejected' || (c.status === 'ringing' && !c.duration_seconds);
    const icono = saliente ? ICON.callOut : ICON.callIn;
    const tipo = c.kind === 'video' ? ICON.video : ICON.phone;
    const fecha = formatFechaHora(c.started_at);
    let detalle;
    if (perdida) detalle = saliente ? 'Sin respuesta' : 'Perdida';
    else if (c.duration_seconds) detalle = `${Math.floor(c.duration_seconds/60)}:${String(c.duration_seconds%60).padStart(2,'0')}`;
    else detalle = saliente ? 'Saliente' : 'Entrante';
    return `<div class="call-row ${perdida ? 'missed' : ''}">
      <span class="call-dir">${icono}</span>
      <div class="call-info-row">
        <span class="call-detail">${tipo} ${detalle}</span>
        <span class="call-date">${esc(fecha)}</span>
      </div>
    </div>`;
  }).join('');
}

// Fecha + hora legible para el historial
function formatFechaHora(iso) {
  const d = new Date(iso);
  const dia = etiquetaDia(iso); // Hoy / Ayer / fecha
  return `${dia}, ${formatHora(iso)}`;
}

// ============================================================
//  LLAMADAS Y VIDEOLLAMADAS (WebRTC 1-a-1)
// ============================================================

// --- Configuración de servidores ICE ---
// STUN gratis (Google). El TURN lo necesitas para que funcione en datos
// móviles / redes difíciles. Pega aquí tus credenciales de Metered/Cloudflare.
const ICE_SERVERS = [
  { urls: 'stun:stun.relay.metered.ca:80' },
  // Solo el TURN verificado en Trickle ICE (generó candidato relay real)
  { urls: 'turn:global.relay.metered.ca:443',
    username: 'b291766bde5645c8a116d4ae', credential: 'P5i0Hx7sseoLtuF/' },
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
let callChannelListo = false;
let iceQueue = [];   // candidatos ICE en espera de que el canal esté listo
function abrirCanalSenal(otherId) {
  const par = [currentUser.id, otherId].sort();
  const nombre = 'call-' + hashCorto(par[0] + par[1]);
  callChannelListo = false;
  callChannel = sb.channel(nombre, {
    config: { broadcast: { self: false, ack: true } }
  });
  callChannel
    .on('broadcast', { event: 'call-answer' }, ({ payload }) => onAnswer(payload))
    .on('broadcast', { event: 'call-ice' }, ({ payload }) => onRemoteIce(payload))
    .on('broadcast', { event: 'call-reject' }, () => {
      if (callRole === 'caller') registrarPerdida(callPeerId);
      finalizarLlamada('rechazada');
    })
    .on('broadcast', { event: 'call-busy' }, () => { finalizarLlamada('ocupado'); })
    .on('broadcast', { event: 'call-end' }, () => { finalizarLlamada('colgó'); })
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        callChannelListo = true;
        vaciarColaIce();   // enviar candidatos que se acumularon antes de estar listo
      }
    });
}

// Todos los candidatos ICE que genero (se conservan para reenviar)
let misCandidatos = [];
let yaReenvie = false;
function enviarIceSalida(candidate) {
  misCandidatos.push(candidate);   // guardar SIEMPRE (para poder reenviar)
  if (callChannel && callChannelListo) {
    callChannel.send({ type: 'broadcast', event: 'call-ice',
      payload: { candidate, from: currentUser.id } });
  }
}
// Reenvía TODOS mis candidatos (cuando sé que el otro ya está escuchando)
function reenviarTodosLosCandidatos() {
  if (!callChannel || !callChannelListo) return;
  console.log('[CALL] reenviando', misCandidatos.length, 'candidatos al otro lado');
  for (const c of misCandidatos) {
    callChannel.send({ type: 'broadcast', event: 'call-ice',
      payload: { candidate: c, from: currentUser.id } });
  }
}
function vaciarColaIce() {
  // al suscribirse, mandar lo que ya tengamos acumulado
  reenviarTodosLosCandidatos();
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

// Cola de candidatos ICE (declaración arriba, junto a las funciones de envío)

function crearPeerConnection() {
  pc = new RTCPeerConnection({
    iceServers: ICE_SERVERS,
    iceTransportPolicy: 'relay',   // solo relay: conexión más rápida y estable entre redes
    bundlePolicy: 'max-bundle',
  });
  remoteStream = new MediaStream();

  pc.ontrack = (e) => {
    e.streams[0].getTracks().forEach(t => remoteStream.addTrack(t));
    // El video muestra la imagen (su audio va silenciado).
    const rv = document.getElementById('remoteVideo');
    if (rv) {
      rv.srcObject = remoteStream;
      rv.muted = true;
      rv.volume = 0;
      rv.play?.().catch(()=>{});
    }
    // El SONIDO sale por un elemento <audio> dedicado. En varios móviles (p.ej.
    // Samsung con Chrome), el audio de un <video> no se enruta al altavoz, pero
    // el de un <audio> sí. Esto hace que la llamada se oiga de forma confiable.
    let ra = document.getElementById('audioOut');
    if (!ra) {
      ra = document.createElement('audio');
      ra.id = 'audioOut';
      ra.autoplay = true;
      document.body.appendChild(ra);
    }
    ra.srcObject = remoteStream;
    ra.muted = false;
    ra.volume = 1.0;
    ra.play?.().catch(()=>{});
  };
  pc.onicecandidate = (e) => {
    if (e.candidate) {
      const tipo = e.candidate.type || (e.candidate.candidate.split(' ')[7]) || '?';
      console.log('[CALL] candidato:', tipo, e.candidate.candidate.includes('relay') ? '(RELAY ok)' : '');
      enviarIceSalida(e.candidate);
    } else {
      console.log('[CALL] fin de candidatos (null)');
    }
  };
  pc.onicegatheringstatechange = () => {
    console.log('[CALL] gathering:', pc?.iceGatheringState);
  };
  pc.oniceconnectionstatechange = () => {
    const st = pc?.iceConnectionState;
    console.log('[CALL] ICE:', st);
    if (st === 'failed') {
      // intentar reiniciar ICE una vez antes de rendirse
      console.log('[CALL] ICE failed -> restartIce');
      try { pc.restartIce?.(); } catch (_) {}
    }
  };
  pc.onconnectionstatechange = () => {
    const st = pc?.connectionState;
    console.log('[CALL] conn:', st);
    if (st === 'failed') {
      // solo cerrar si falla de forma definitiva
      finalizarLlamada('conexión perdida');
    } else if (st === 'disconnected') {
      // 'disconnected' suele ser temporal: dar margen para reconectar
      clearTimeout(reconnTimer);
      reconnTimer = setTimeout(() => {
        if (pc && pc.connectionState === 'disconnected') finalizarLlamada('conexión perdida');
      }, 6000);
    } else if (st === 'connected') {
      clearTimeout(reconnTimer);
    }
  };
}
let reconnTimer = null;

// Sube el bitrate del video saliente para mejor calidad
async function subirCalidadVideo() {
  if (!pc) return;
  const sender = pc.getSenders().find(s => s.track && s.track.kind === 'video');
  if (!sender) return;
  try {
    const params = sender.getParameters();
    if (!params.encodings || !params.encodings.length) params.encodings = [{}];
    params.encodings[0].maxBitrate = 1_200_000; // ~1.2 Mbps (mejor calidad)
    params.encodings[0].maxFramerate = 30;
    await sender.setParameters(params);
  } catch (e) {
    console.log('[CALL] no se pudo subir calidad:', e.name);
  }
}

async function obtenerMedios(kind) {
  const constraints = kind === 'video'
    ? { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } }
    : { audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false };
  localStream = await navigator.mediaDevices.getUserMedia(constraints);
  const at = localStream.getAudioTracks()[0];
  console.log('[CALL][mic] capturado:', at ? `${at.label} (${at.readyState}, enabled=${at.enabled}, muted=${at.muted})` : 'SIN MICRÓFONO');
  return localStream;
}

// === INICIAR (yo llamo) ===
async function iniciarLlamada(otherId, otherName, otherAvatar, kind) {
  if (pc) { alert('Ya hay una llamada en curso.'); return; }
  prepararAudioRemoto(); // desbloquear audio dentro del gesto (móvil)
  callPeerId = otherId; callKind = kind; callRole = 'caller';
  try {
    await obtenerMedios(kind);
  } catch (err) {
    alert('Necesito permiso de ' + (kind === 'video' ? 'cámara y micrófono' : 'micrófono') + '.');
    return;
  }
  abrirCanalSenal(otherId);

  // mostrar la pantalla (crea #remoteVideo) ANTES de crear la conexión,
  // para que el elemento exista cuando llegue el audio remoto (ontrack)
  mostrarPantallaLlamada(otherName, otherAvatar, 'Llamando…');

  crearPeerConnection();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  if (kind === 'video') subirCalidadVideo();

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
    if (!r.ok) console.warn('send-call status:', r.status);
  } catch (e) {
    console.error('Error enviando push de llamada:', e);
  }

  // registrar la llamada (historial) + guardar la oferta para arranque en frío
  try {
    await sb.from('calls').insert({
      caller_id: currentUser.id, callee_id: otherId, kind, status: 'ringing',
      offer_sdp: offer, offer_kind: kind
    });
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

  // capturar el nombre antes de que se quite el overlay entrante
  const nombreLlamante = document.getElementById('incomingName')?.textContent || 'Llamada';

  // IMPORTANTE: mostrar la pantalla (que crea #remoteVideo) ANTES de crear la
  // conexión, para que el elemento exista cuando llegue el audio remoto (ontrack).
  mostrarPantallaLlamada(nombreLlamante, '', 'Conectando…');

  crearPeerConnection();
  localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  if (callKind === 'video') subirCalidadVideo();

  await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
  remoteDescLista = true;
  await aplicarIceEnEspera();
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);

  // enviar la respuesta cuando el canal esté listo (evita perderla en arranque en frío)
  enviarAnswerConReintento(answer, 0);

  // marcar la llamada como aceptada
  try {
    await sb.from('calls').update({ status: 'accepted' })
      .eq('callee_id', currentUser.id).eq('caller_id', callPeerId).eq('status', 'ringing');
  } catch (_) {}

  iniciarContador();
}

function enviarAnswerConReintento(answer, intento) {
  if (!callChannel || intento > 10) return;
  if (callChannel.state === 'joined') {
    callChannel.send({ type: 'broadcast', event: 'call-answer',
      payload: { sdp: answer, from: currentUser.id } });
  } else {
    setTimeout(() => enviarAnswerConReintento(answer, intento + 1), 200);
  }
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
  remoteDescLista = true;
  await aplicarIceEnEspera();   // aplicar candidatos que llegaron antes
  reenviarTodosLosCandidatos(); // el callee ya escucha: reenviar mis candidatos
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

// Candidatos remotos que llegan antes de tener remoteDescription se guardan
let iceEntrantesEnEspera = [], remoteDescLista = false;
async function onRemoteIce(payload) {
  if (payload.from === currentUser.id) return;
  if (!pc) return;
  const esRelay = payload.candidate?.candidate?.includes('relay');
  console.log('[CALL] RECIBIDO candidato remoto', esRelay ? '(RELAY)' : '', remoteDescLista ? '' : '(encolado)');
  // primera vez que sé que el otro está en el canal: reenviar los míos
  if (!yaReenvie) { yaReenvie = true; reenviarTodosLosCandidatos(); }
  if (!remoteDescLista || !pc.remoteDescription) {
    iceEntrantesEnEspera.push(payload.candidate);   // aún no se puede aplicar: encolar
    return;
  }
  try { await pc.addIceCandidate(new RTCIceCandidate(payload.candidate)); }
  catch (err) { console.log('[CALL] error addIceCandidate:', err.message); }
}
async function aplicarIceEnEspera() {
  console.log('[CALL] aplicando', iceEntrantesEnEspera.length, 'candidatos en espera');
  while (iceEntrantesEnEspera.length) {
    const c = iceEntrantesEnEspera.shift();
    try { await pc.addIceCandidate(new RTCIceCandidate(c)); }
    catch (err) { console.log('[CALL] error addIceCandidate espera:', err.message); }
  }
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
  if (reconnTimer) { clearTimeout(reconnTimer); reconnTimer = null; }
  if (callRingTimeout) { clearTimeout(callRingTimeout); callRingTimeout = null; }
  callSeconds = 0;
  if (localStream) { localStream.getTracks().forEach(t => t.stop()); localStream = null; }
  if (pc) { pc.close(); pc = null; }
  if (callChannel) { sb.removeChannel(callChannel); callChannel = null; }
  remoteStream = null; callPeerId = null; pendingOffer = null; callRole = null;
  iceQueue = []; iceEntrantesEnEspera = []; remoteDescLista = false; callChannelListo = false;
  misCandidatos = []; yaReenvie = false;
  document.getElementById('callOverlay')?.remove();
  document.getElementById('audioOut')?.remove();
  document.getElementById('incomingOverlay')?.remove();
  altavozActivo = true;
}

// === Tono de llamada ===
function sonarTono(tipo) {
  // Timbre clásico "ring-ring": dos tonos alternados con envolvente suave,
  // agrupados y con pausa entre repeticiones. Generado, sin archivos.
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    ringAudio = ctx;

    // Un "ring" = dos frecuencias que suenan juntas (como el timbre analógico),
    // con fade-in/out para que no suene brusco.
    const ring = (t0, dur) => {
      const f1 = tipo === 'entrante' ? 480 : 440;
      const f2 = tipo === 'entrante' ? 620 : 480;
      [f1, f2].forEach(freq => {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'sine';
        o.frequency.value = freq;
        o.connect(g); g.connect(ctx.destination);
        // envolvente suave: sube y baja el volumen en vez de cortar seco
        g.gain.setValueAtTime(0.0001, t0);
        g.gain.exponentialRampToValueAtTime(0.15, t0 + 0.04);
        g.gain.setValueAtTime(0.15, t0 + dur - 0.06);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.start(t0);
        o.stop(t0 + dur + 0.02);
      });
    };

    // Patrón "ring-ring": dos rings cortos seguidos, luego pausa.
    const patron = () => {
      if (!ringAudio) return;
      const now = ctx.currentTime;
      ring(now, 0.4);          // primer "ring"
      ring(now + 0.6, 0.4);    // segundo "ring"
    };

    patron();
    // repetir el par cada 3 segundos (0.4+0.2+0.4 de sonido, resto en silencio)
    ringAudio._interval = setInterval(patron, 3000);
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
        <button class="call-btn reject" id="incReject">${ICON.hangup}<span>Rechazar</span></button>
        <button class="call-btn accept" id="incAccept">${ICON.phone}<span>Aceptar</span></button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  document.getElementById('incAccept').onclick = () => {
    // PREPARAR el audio dentro del gesto del usuario (clave en móvil):
    // crear y "desbloquear" el elemento de audio AHORA, antes de los await.
    prepararAudioRemoto();
    ov.remove();
    aceptarLlamada();
  };
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
      <button class="call-btn" id="btnMute" title="Silenciar">${ICON.mic}</button>
      <button class="call-btn" id="btnSpeaker" title="Altavoz">${ICON.speaker}</button>
      ${callKind === 'video' ? `<button class="call-btn" id="btnCam" title="Cámara">${ICON.video}</button>` : ''}
      <button class="call-btn reject" id="btnHangup" title="Colgar">${ICON.hangup}</button>
    </div>`;
  document.body.appendChild(ov);
  const lv = document.getElementById('localVideo');
  if (lv && localStream) lv.srcObject = localStream;
  document.getElementById('btnHangup').onclick = colgar;
  document.getElementById('btnMute').onclick = toggleMute;
  const spkBtn = document.getElementById('btnSpeaker');
  if (spkBtn) spkBtn.onclick = toggleAltavoz;
  const camBtn = document.getElementById('btnCam');
  if (camBtn) camBtn.onclick = toggleCam;
  // En móvil el audio puede estar bloqueado: cualquier toque en la pantalla
  // de llamada lo desbloquea (gesto del usuario).
  ov.addEventListener('click', desbloquearAudioRemoto, { once: false });
  desbloquearAudioRemoto();
}

// Fuerza la reproducción del audio remoto (necesario en móvil por autoplay)
function desbloquearAudioRemoto() {
  const rv = document.getElementById('remoteVideo');
  if (rv) {
    rv.muted = false;
    rv.volume = 1;
    const p = rv.play?.();
    if (p) p.catch(() => {
      const reintento = () => { rv.play?.().catch(()=>{}); document.removeEventListener('touchend', reintento); document.removeEventListener('click', reintento); };
      document.addEventListener('touchend', reintento, { once: true });
      document.addEventListener('click', reintento, { once: true });
    });
  }
}

// Reservado: con el enfoque de reproducir por <video>, no se necesita
// preparar un elemento de audio aparte. Se mantiene como no-op seguro.
function prepararAudioRemoto() {
  // Desbloquear la salida de audio del móvil reproduciendo un sonido silencioso
  // DENTRO del gesto del usuario. Esto autoriza a Chrome Android a reproducir
  // el audio remoto después, aunque llegue fuera de un gesto.
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      if (!window._unlockCtx) window._unlockCtx = new AC();
      const ctx = window._unlockCtx;
      if (ctx.state === 'suspended') ctx.resume();
      // tono inaudible de 0.1s para "armar" la salida de audio
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.1);
    }
  } catch (_) {}
}

function toggleMute() {
  if (!localStream) return;
  const track = localStream.getAudioTracks()[0];
  if (track) { track.enabled = !track.enabled;
    document.getElementById('btnMute').classList.toggle('off', !track.enabled);
  }
}

// Alterna salida de audio entre altavoz y auricular (donde el navegador lo permita)
let altavozActivo = true;
async function toggleAltavoz() {
  const ra = document.getElementById('remoteVideo');
  const btn = document.getElementById('btnSpeaker');
  if (!ra) return;
  altavozActivo = !altavozActivo;
  if (btn) btn.innerHTML = altavozActivo ? ICON.speaker : ICON.speakerOff;
  try {
    if (typeof ra.setSinkId === 'function') {
      const dispositivos = await navigator.mediaDevices.enumerateDevices();
      const salidas = dispositivos.filter(d => d.kind === 'audiooutput');
      if (altavozActivo) {
        const spk = salidas.find(d => /speaker|altavoz/i.test(d.label)) || salidas.find(d => d.deviceId === 'default') || salidas[0];
        if (spk) await ra.setSinkId(spk.deviceId);
      } else {
        const ear = salidas.find(d => /earpiece|headset|headphone|auricular/i.test(d.label));
        if (ear) await ra.setSinkId(ear.deviceId);
      }
    }
  } catch (e) {
    console.log('[CALL] setSinkId no soportado:', e.name);
  }
  ra.volume = altavozActivo ? 1.0 : 0.7;
}

function toggleCam() {
  if (!localStream) return;
  const track = localStream.getVideoTracks()[0];
  if (track) { track.enabled = !track.enabled;
    document.getElementById('btnCam').classList.toggle('off', !track.enabled);
  }
}

init();
