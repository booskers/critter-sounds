// Critter Sounds: a desktop music player that plays live to a Critter table.
// The player page is served as app://music/; local sound files are served from app://music/media?p=<path>, with seeking.
const { app, BrowserWindow, Menu, protocol, net, shell, session, ipcMain, dialog, globalShortcut, webContents, utilityProcess, safeStorage } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const { pathToFileURL } = require('node:url');
const { Readable } = require('node:stream');

const WWW = path.join(__dirname, 'www');
const AUDIO = /\.(mp3|ogg|oga|opus|wav|flac|m4a|aac|webm|weba|mp4)$/i;
const MIME = { mp3: 'audio/mpeg', ogg: 'audio/ogg', oga: 'audio/ogg', opus: 'audio/ogg', wav: 'audio/wav', flac: 'audio/flac', m4a: 'audio/mp4', aac: 'audio/aac', webm: 'audio/webm', weba: 'audio/webm', mp4: 'audio/mp4' };
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }]);

let win = null, webWin = null, mini = false, normalBounds = null;
// CBM_USERDATA=<folder>: keep the library and settings somewhere else (for testing)
if (process.env.CBM_USERDATA) app.setPath('userData', process.env.CBM_USERDATA);
// the app was called Critter Music, and Critboard Music before that: keep using an older library if this one has none
else if (!fs.existsSync(path.join(app.getPath('userData'), 'library.json'))) { for (const name of ['Critter Music', 'Critboard Music']) { const old = path.join(app.getPath('appData'), name); if (fs.existsSync(path.join(old, 'library.json'))) { app.setPath('userData', old); break; } } }
const ICON = path.join(__dirname, 'assets', 'icon.png');
const LIB = () => path.join(app.getPath('userData'), 'library.json');
// Music\Critter Sounds: downloads, YouTube, soundscapes and their loops (CBM_MUSICDIR=<folder> puts it elsewhere, for testing)
// (Settings › Folders can move it: prefs.json in the app's data folder remembers where)
const PREFS = () => path.join(app.getPath('userData'), 'prefs.json');
let prefs = null;
const getPrefs = () => { if (!prefs) { try { prefs = JSON.parse(fs.readFileSync(PREFS(), 'utf8')); } catch { prefs = {}; } } return prefs; };
const savePrefs = () => fsp.writeFile(PREFS(), JSON.stringify(getPrefs(), null, 1)).catch(() => {});
const CS = (...p) => path.join(process.env.CBM_MUSICDIR || getPrefs().csDir || path.join(app.getPath('music'), 'Critter Sounds'), ...p);

/* ---------- files ---------- */
function serveMedia(req) {
  const file = new URL(req.url).searchParams.get('p') || '';
  if (!AUDIO.test(file) || !path.isAbsolute(file)) return new Response('Not a sound file', { status: 404 });
  let st; try { st = fs.statSync(file); } catch { return new Response('Missing', { status: 404 }); }
  if (!st.isFile()) return new Response('Missing', { status: 404 });
  const type = MIME[path.extname(file).slice(1).toLowerCase()] || 'application/octet-stream';
  // ranges, so the player can seek and read the length of long files without loading them whole
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.get('range') || '');
  if (m && st.size) {
    let start = m[1] ? +m[1] : Math.max(0, st.size - +m[2]), end = m[1] && m[2] ? Math.min(+m[2], st.size - 1) : st.size - 1;
    if (start >= st.size) return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${st.size}` } });
    return new Response(Readable.toWeb(fs.createReadStream(file, { start, end })), { status: 206, headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(end - start + 1), 'Content-Range': `bytes ${start}-${end}/${st.size}` } });
  }
  return new Response(Readable.toWeb(fs.createReadStream(file)), { status: 200, headers: { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': String(st.size) } });
}
/* ---------- cover art: app://music/cover?p=<path> ---------- */
// The picture inside the file (MP3's ID3 APIC, FLAC's PICTURE block, M4A's covr atom), else a cover image in the same
// folder, else, for a YouTube download (its name ends in [id]), the video's thumbnail. 404 when there's none.
const coverCache = new Map();
const IMG_RE = /^(cover|folder|front|album|albumart(small|large)?)\.(jpe?g|png|webp)$/i;
const sniff = b => (b[0] === 0xff && b[1] === 0xd8 ? 'image/jpeg' : b[0] === 0x89 && b[1] === 0x50 ? 'image/png' : b[0] === 0x52 && b[8] === 0x57 ? 'image/webp' : b[0] === 0x47 ? 'image/gif' : '');
function id3Cover(b) {
  if (b.toString('latin1', 0, 3) !== 'ID3') return null;
  const ver = b[3], size = ((b[6] & 127) << 21) | ((b[7] & 127) << 14) | ((b[8] & 127) << 7) | (b[9] & 127);
  let o = 10; const end = Math.min(b.length, 10 + size);
  while (o + 10 < end) {
    const id = b.toString('latin1', o, o + (ver === 2 ? 3 : 4)); if (!/^[A-Z0-9]{3,4}$/.test(id)) break;
    const n = ver === 2 ? (b[o + 3] << 16) | (b[o + 4] << 8) | b[o + 5] : ver === 4 ? ((b[o + 4] & 127) << 21) | ((b[o + 5] & 127) << 14) | ((b[o + 6] & 127) << 7) | (b[o + 7] & 127) : b.readUInt32BE(o + 4);
    const h = ver === 2 ? 6 : 10, s = o + h, e = s + n; if (n <= 0 || e > b.length) break;
    if (id === 'APIC' || id === 'PIC') {
      const enc = b[s]; let p = s + 1;
      if (id === 'PIC') p += 3; else { while (p < e && b[p]) p++; p++; } // the image format, or the mime type
      p++; // picture type
      if (enc === 1 || enc === 2) { while (p + 1 < e && (b[p] || b[p + 1])) p += 2; p += 2; } else { while (p < e && b[p]) p++; p++; }
      const img = b.subarray(p, e); if (sniff(img)) return img;
    }
    o = e;
  }
  return null;
}
function flacCover(b) {
  if (b.toString('latin1', 0, 4) !== 'fLaC') return null;
  let o = 4;
  for (let k = 0; k < 64 && o + 4 <= b.length; k++) {
    const last = b[o] & 128, type = b[o] & 127, n = (b[o + 1] << 16) | (b[o + 2] << 8) | b[o + 3], s = o + 4;
    if (type === 6 && s + n <= b.length) {
      let p = s + 4; const ml = b.readUInt32BE(p); p += 4 + ml; const dl = b.readUInt32BE(p); p += 4 + dl + 16; const il = b.readUInt32BE(p); p += 4;
      return b.subarray(p, p + il);
    }
    if (last) break; o = s + n;
  }
  return null;
}
function mp4Cover(b) {
  const i = b.indexOf('covr', 0, 'latin1'); if (i < 0) return null;
  const d = b.indexOf('data', i, 'latin1'); if (d < 0 || d - i > 16) return null;
  const n = b.readUInt32BE(d - 4) - 16; const img = b.subarray(d + 12, d + 12 + n);
  return sniff(img) ? img : null;
}
async function coverOf(file) {
  if (coverCache.has(file)) return coverCache.get(file);
  let out = null;
  try {
    const st = await fsp.stat(file);
    // tags sit at the start (ID3, FLAC); M4A's may be anywhere, so small files are read whole
    const fh = await fsp.open(file, 'r'); const n = /\.(m4a|mp4|aac)$/i.test(file) && st.size < 80e6 ? st.size : Math.min(st.size, 4e6);
    const b = Buffer.alloc(n); await fh.read(b, 0, n, 0); await fh.close();
    const img = id3Cover(b) || flacCover(b) || mp4Cover(b);
    if (img) out = { type: sniff(img) || 'image/jpeg', body: Buffer.from(img) };
    if (!out) {
      const dir = path.dirname(file), names = await fsp.readdir(dir).catch(() => []);
      const pic = names.find(x => IMG_RE.test(x)) || names.find(x => x.toLowerCase().startsWith(path.basename(file, path.extname(file)).toLowerCase()) && /\.(jpe?g|png|webp)$/i.test(x));
      if (pic) { const body = await fsp.readFile(path.join(dir, pic)); out = { type: sniff(body) || 'image/jpeg', body }; }
    }
    if (!out) {
      const yt = /\[([\w-]{11})\]\.[a-z0-9]+$/i.exec(file);
      if (yt) { const r = await net.fetch(`https://i.ytimg.com/vi/${yt[1]}/hqdefault.jpg`); if (r.ok) { const body = Buffer.from(await r.arrayBuffer()); out = { type: 'image/jpeg', body }; } }
    }
  } catch {}
  if (coverCache.size > 300) coverCache.delete(coverCache.keys().next().value);
  coverCache.set(file, out);
  return out;
}
async function serveCover(req) {
  const p = new URL(req.url).searchParams.get('p') || '';
  if (!path.isAbsolute(p)) return new Response('No', { status: 404 });
  const c = await coverOf(p);
  return c ? new Response(c.body, { status: 200, headers: { 'Content-Type': c.type, 'Cache-Control': 'max-age=3600' } }) : new Response('None', { status: 404 });
}
/* ---------- online sources ---------- */
// sound from the web is passed through app://music/remote?u=<url>, so the player may route it through Web Audio
// (those sites don't send the CORS headers it would need), with ranges for seeking
const UA = 'CritterSounds/1.0 (desktop music player for tabletop games)';
async function serveRemote(req) {
  const u = new URL(req.url).searchParams.get('u') || '';
  if (!/^https?:\/\//i.test(u)) return new Response('Bad address', { status: 400 });
  const headers = { 'User-Agent': UA };
  const range = req.headers.get('range'); if (range) headers.Range = range;
  try {
    const r = await net.fetch(u, { headers, redirect: 'follow' });
    const h = { 'Cache-Control': 'no-store' };
    for (const k of ['content-type', 'content-length', 'content-range', 'accept-ranges']) { const v = r.headers.get(k); if (v) h[k] = v; }
    // some hosts call every file application/octet-stream; the player wants to know it's sound
    if (!h['content-type'] || /octet-stream/.test(h['content-type'])) h['content-type'] = MIME[(u.split('?')[0].split('.').pop() || '').toLowerCase()] || 'audio/mpeg';
    return new Response(r.body, { status: r.status, headers: h });
  } catch (e) { return new Response('Could not reach it', { status: 502 }); }
}
// the catalogues the page may read, fetched here because those sites don't allow cross-site reads
const CATALOG_HOSTS = /^https:\/\/((www\.)?tabletopaudio\.com|incompetech\.com|api\.openverse\.org|freesound\.org)\//i;
async function getText(url, headers) {
  if (!CATALOG_HOSTS.test(url)) throw new Error('not an allowed address');
  const r = await net.fetch(url, { headers: { 'User-Agent': UA, ...(headers || {}) } });
  const text = await r.text();
  return { status: r.status, text, limit: r.headers.get('x-ratelimit-available-anon_burst') };
}
const CACHE = name => path.join(app.getPath('userData'), 'catalog-' + name + '.json');
async function cached(name, maxAgeH, make) {
  try { const st = await fsp.stat(CACHE(name)); if (Date.now() - st.mtimeMs < maxAgeH * 3600e3) return JSON.parse(await fsp.readFile(CACHE(name), 'utf8')); } catch {}
  try { const v = await make(); await fsp.writeFile(CACHE(name), JSON.stringify(v)); return v; }
  catch (e) { try { return JSON.parse(await fsp.readFile(CACHE(name), 'utf8')); } catch { throw e; } }
}
const unhtml = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '\'').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
// Tabletop Audio: the 10-minute ambiences listed on its home page (the free, Creative Commons ones)
async function tabletopAudio() {
  const { text } = await getText('https://tabletopaudio.com/');
  const out = [];
  for (const block of text.split('<!--song ').slice(1)) {
    const num = parseInt(block, 10), save = /saveAs\('([^']+)'\)/.exec(block);
    if (!num || !save) continue; // sneak peeks for patrons have no file yet
    const title = unhtml((/<h3[^>]*>([\s\S]*?)<\/h3>/.exec(block) || [])[1]);
    const kind = unhtml((/<i[^>]*>([\s\S]*?)<\/i>/.exec(block) || [])[1]);
    const tags = ((/class="col-md-3 mix ([^"]*)"/.exec(block) || [])[1] || '').split(/\s+/).filter(Boolean);
    const desc = unhtml((/<span class="white flavor">([\s\S]*?)<\/span>\s*<div/.exec(block) || [])[1]).replace(/\s*\[[^\]]*Patreon[^\]]*\]?\s*$/i, '');
    const img = (/data-src="([^"]+)"/.exec(block) || [])[1] || '';
    out.push({ id: 'tta' + num, n: num, title, kind, tags, desc, img, url: `https://sounds.tabletopaudio.com/${save[1]}.mp3` });
  }
  if (out.length < 50) throw new Error('Tabletop Audio\'s page has changed; only ' + out.length + ' tracks found');
  return out;
}
// Incompetech: Kevin MacLeod's whole catalogue, one JSON file
async function incompetech() {
  const { text } = await getText('https://incompetech.com/music/royalty-free/pieces.json');
  const sec = t => String(t || '').split(':').reduce((s, x) => s * 60 + (+x || 0), 0);
  return JSON.parse(text).filter(p => p && p.filename).map(p => ({ id: 'inc' + (p.isrc || p.filename), title: p.title, desc: p.description || '', feel: String(p.feel || '').split(',').map(s => s.trim()).filter(Boolean), instruments: p.instruments || '', bpm: +p.bpm || 0, dur: sec(p.length), uploaded: p.uploaded || '', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/' + encodeURIComponent(p.filename) }));
}

function serve(ses) {
  ses.protocol.handle('app', req => {
    const u = new URL(req.url);
    if (u.pathname === '/media') return serveMedia(req);
    if (u.pathname === '/remote') return serveRemote(req);
    if (u.pathname === '/cover') return serveCover(req);
    let p = decodeURIComponent(u.pathname); if (p === '/' || p === '') p = '/index.html';
    const file = path.normalize(path.join(WWW, p));
    if (!file.startsWith(WWW)) return new Response('Not found', { status: 404 });
    // never cached, so a rebuilt page shows on the next reload
    return net.fetch(pathToFileURL(file).toString()).then(r => new Response(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'text/plain', 'Cache-Control': 'no-store' } }));
  });
  // a web source's sound is captured from its window; nothing else may be captured
  ses.setDisplayMediaRequestHandler((req, cb) => {
    if (!webWin || webWin.isDestroyed()) { cb({}); return; }
    const f = webWin.webContents.mainFrame;
    cb({ video: f, audio: f });
  });
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(['media', 'display-capture', 'speaker-selection'].includes(perm)));
}
async function scan(dir, out = [], depth = 0) {
  if (depth > 10 || out.length >= 5000) return out;
  let ents; try { ents = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  ents.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  for (const e of ents) {
    if (out.length >= 5000) break;
    if (e.name.startsWith('.')) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await scan(p, out, depth + 1);
    else if (AUDIO.test(e.name)) out.push(p);
  }
  return out;
}

/* ---------- the web source window ---------- */
function sendWeb() {
  if (!win || win.isDestroyed()) return;
  const open = !!(webWin && !webWin.isDestroyed());
  win.webContents.send('web', open ? { open, url: webWin.webContents.getURL(), title: webWin.webContents.getTitle(), back: webWin.webContents.navigationHistory.canGoBack(), fwd: webWin.webContents.navigationHistory.canGoForward(), audible: webWin.webContents.isCurrentlyAudible() } : { open: false });
}
function openWeb(url) {
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
  if (!webWin || webWin.isDestroyed()) {
    webWin = new BrowserWindow({
      width: 1100, height: 760, title: 'Critter Sounds: web source', backgroundColor: '#0c0d10', autoHideMenuBar: true, icon: ICON,
      webPreferences: { partition: 'persist:web', contextIsolation: true, sandbox: true, autoplayPolicy: 'no-user-gesture-required' }
    });
    const wc = webWin.webContents;
    // pop-ups open in the same window, so the sound stays where it's captured
    wc.setWindowOpenHandler(({ url: u }) => { if (/^https?:/i.test(u)) wc.loadURL(u); return { action: 'deny' }; });
    for (const ev of ['did-navigate', 'did-navigate-in-page', 'page-title-updated', 'audio-state-changed']) wc.on(ev, sendWeb);
    webWin.on('closed', () => { webWin = null; sendWeb(); });
  }
  webWin.loadURL(url).catch(() => {});
  webWin.show(); sendWeb();
}
// pause or resume every video and sound on the web page
const WEB_MEDIA = play => `(() => { const all = [...document.querySelectorAll('video,audio')]; all.forEach(m => { try { ${play ? 'm.play()' : 'm.pause()'}; } catch {} }); return all.length; })()`;

/* ---------- the window: frameless, with Critter's kind of title bar drawn by the page itself ---------- */
function createWindow() {
  serve(session.defaultSession);
  win = new BrowserWindow({
    width: 1280, height: 820, minWidth: 400, minHeight: 174, backgroundColor: '#0c0d10', title: 'Critter Sounds', icon: ICON, frame: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false, autoplayPolicy: 'no-user-gesture-required', backgroundThrottling: false }
  });
  win.loadURL('app://music/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  // closing while music plays asks first; the page answers through 'quit-ok'
  let closing = false;
  win.on('close', e => { if (!closing) { e.preventDefault(); win.webContents.send('close-asked'); } });
  ipcMain.on('quit-ok', () => { closing = true; if (webWin && !webWin.isDestroyed()) webWin.destroy(); for (const w of editors.keys()) if (!w.isDestroyed()) w.destroy(); win.close(); });
  win.on('closed', () => { win = null; });
  // the title bar follows the window: maximized or not, in focus or not
  const state = () => { if (win && !win.isDestroyed()) win.webContents.send('win:state', { max: win.isMaximized(), focus: win.isFocused(), full: win.isFullScreen() }); };
  for (const ev of ['maximize', 'unmaximize', 'focus', 'blur', 'enter-full-screen', 'leave-full-screen']) win.on(ev, state);
  win.webContents.on('did-finish-load', state);
  // the menu's shortcuts, since a frameless window has no menu bar to carry them
  const wc = win.webContents;
  wc.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return;
    const k = i.key.toLowerCase(), c = i.control || i.meta, run = fn => { e.preventDefault(); fn(); };
    if (c && !i.shift && k === 'r') run(() => wc.reload());
    else if (k === 'f11') run(() => win.setFullScreen(!win.isFullScreen()));
    else if (c && i.shift && k === 'i') run(() => wc.toggleDevTools());
    else if (c && !i.shift && k === 'm') run(() => wc.send('key', 'mini'));
    else if (c && k === '0') run(() => wc.setZoomLevel(0));
    else if (c && (k === '=' || k === '+')) run(() => wc.setZoomLevel(wc.getZoomLevel() + 0.5));
    else if (c && k === '-') run(() => wc.setZoomLevel(wc.getZoomLevel() - 0.5));
  });
}
// the main process's own words (the menu, file dialogs), in the page's language
let LANG = 'en';
const DE = { 'Mini player': 'Mini-Player', 'Homebase…': 'Homebase…', 'Appearance…': 'Aussehen…', 'Settings…': 'Einstellungen…', 'Quick tour': 'Kurztour', 'Full tour': 'Komplette Tour', 'Setup…': 'Einrichtung…', 'View': 'Ansicht', 'Reload': 'Neu laden', 'Full screen': 'Vollbild', 'Actual size': 'Originalgröße', 'Zoom in': 'Vergrößern', 'Zoom out': 'Verkleinern', 'Developer tools': 'Entwicklertools', 'Quit Critter Sounds': 'Critter Sounds beenden', 'Open the Critter Sounds folder': 'Ordner von Critter Sounds öffnen',
  'Choose a music folder': 'Wähle einen Musikordner', 'Choose sound files': 'Wähle Klangdateien', 'Choose an impulse response (a short WAV recording of a space)': 'Wähle eine Impulsantwort (eine kurze WAV-Aufnahme eines Raums)', 'Sound files': 'Klangdateien', 'Bring in a soundscape': 'Klanglandschaft hereinholen', 'Soundscapes': 'Klanglandschaften', 'Choose where Critter Sounds keeps its files': 'Wähle, wo Critter Sounds seine Dateien ablegt', 'Back up the library': 'Bibliothek sichern', 'Library backup': 'Bibliothekssicherung', 'This soundscape has Script nodes, which run their own JavaScript.': 'Diese Klanglandschaft hat Skript-Knoten, die eigenes JavaScript ausführen.', 'Only keep the scripts if you trust whoever made this file. Without them, the rest of the soundscape still comes in.': 'Behalte die Skripte nur, wenn du der Person vertraust, die diese Datei gemacht hat. Ohne sie kommt der Rest der Klanglandschaft trotzdem herein.', 'Bring it in without the scripts': 'Ohne die Skripte hereinholen', 'Keep the scripts': 'Skripte behalten', 'Cancel': 'Abbrechen' };
const L = s => (LANG === 'de' && DE[s]) || s;
ipcMain.handle('sys-lang', () => { try { return (app.getPreferredSystemLanguages()[0] || app.getLocale() || 'en'); } catch { return app.getLocale() || 'en'; } });
ipcMain.handle('set-lang', (e, l) => { LANG = l === 'de' ? 'de' : 'en'; return LANG; });
// a new language: every window starts again in it
ipcMain.handle('reload-all', () => { for (const w of BrowserWindow.getAllWindows()) if (w !== webWin && !w.isDestroyed()) w.webContents.reload(); return true; });
function appMenu() {
  const wc = win && win.webContents;
  return Menu.buildFromTemplate([
    { label: L('Mini player'), accelerator: 'CmdOrCtrl+M', click: () => wc && wc.send('key', 'mini') },
    { label: L('Homebase…'), click: () => wc && wc.executeJavaScript('window.CRITBOARD_DESKTOP && window.CRITBOARD_DESKTOP.changeHomebase()') },
    { label: L('Appearance…'), click: () => wc && wc.send('key', 'appearance') },
    { label: L('Settings…'), accelerator: 'CmdOrCtrl+,', click: () => wc && wc.send('key', 'settings') },
    { label: L('Open the Critter Sounds folder'), click: () => { fs.mkdirSync(CS(), { recursive: true }); shell.openPath(CS()); } },
    { type: 'separator' },
    { label: L('Quick tour'), click: () => wc && wc.send('key', 'tour-basic') },
    { label: L('Full tour'), click: () => wc && wc.send('key', 'tour-full') },
    { label: L('Setup…'), click: () => wc && wc.send('key', 'setup') },
    { type: 'separator' },
    { label: L('View'), submenu: [
      { label: L('Reload'), accelerator: 'CmdOrCtrl+R', click: () => wc && wc.reload() },
      { label: L('Full screen'), accelerator: 'F11', click: () => win && win.setFullScreen(!win.isFullScreen()) },
      { type: 'separator' },
      { label: L('Actual size'), accelerator: 'CmdOrCtrl+0', click: () => wc && wc.setZoomLevel(0) },
      { label: L('Zoom in'), accelerator: 'CmdOrCtrl+=', click: () => wc && wc.setZoomLevel(wc.getZoomLevel() + 0.5) },
      { label: L('Zoom out'), accelerator: 'CmdOrCtrl+-', click: () => wc && wc.setZoomLevel(wc.getZoomLevel() - 0.5) },
      { type: 'separator' },
      { label: L('Developer tools'), accelerator: 'CmdOrCtrl+Shift+I', click: () => wc && wc.toggleDevTools() }
    ] },
    { type: 'separator' },
    { label: L('Quit Critter Sounds'), click: () => win && win.close() }
  ]);
}
// the title bar's buttons, for the main window and the soundscape editors alike
ipcMain.on('win:cmd', (e, cmd, arg) => {
  const w = BrowserWindow.fromWebContents(e.sender); if (!w || (w !== win && !editors.has(w))) return;
  if (cmd === 'min') w.minimize();
  else if (cmd === 'max') w.isMaximized() ? w.unmaximize() : w.maximize();
  else if (cmd === 'close') w.close();
  else if (cmd === 'menu' && w === win) appMenu().popup({ window: win, x: Math.round((arg && arg.x) || 8), y: Math.round((arg && arg.y) || 34) });
});
// the mini player: small and on top; its height follows what's open in it (Up next, pads)
function setMini(on, height) {
  if (!win) return;
  const hgt = Math.round(Math.min(900, Math.max(206, +height || 250)));
  if (on) {
    if (!mini) { normalBounds = win.getBounds(); if (win.isMaximized()) win.unmaximize(); win.setAlwaysOnTop(true, 'floating'); }
    mini = true; const b = win.getBounds(); win.setBounds({ x: b.x, y: b.y, width: 480, height: hgt });
  } else if (mini) { mini = false; win.setAlwaysOnTop(false); if (normalBounds) win.setBounds(normalBounds); }
}

/* ---------- what the page may ask for ---------- */
// a library that can't be read is set aside first, so the next save doesn't overwrite it
ipcMain.handle('lib-load', async () => {
  let text; try { text = await fsp.readFile(LIB(), 'utf8'); } catch { return null; }
  try { return JSON.parse(text.replace(/^﻿/, '')); }
  catch { await fsp.copyFile(LIB(), LIB().replace(/\.json$/, `.unreadable-${Date.now()}.json`)).catch(() => {}); return null; }
});
ipcMain.handle('lib-save', async (e, data) => { const tmp = LIB() + '.tmp'; await fsp.writeFile(tmp, JSON.stringify(data)); await fsp.rename(tmp, LIB()); return true; });
ipcMain.handle('pick-folder', async () => { const r = await dialog.showOpenDialog(win, { title: L('Choose a music folder'), properties: ['openDirectory', 'multiSelections'] }); return r.canceled ? [] : r.filePaths; });
ipcMain.handle('pick-files', async (e, kind) => {
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender) || win, { title: L(kind === 'ir' ? 'Choose an impulse response (a short WAV recording of a space)' : 'Choose sound files'), properties: kind === 'ir' ? ['openFile'] : ['openFile', 'multiSelections'], filters: [{ name: L('Sound files'), extensions: ['mp3', 'ogg', 'oga', 'opus', 'wav', 'flac', 'm4a', 'aac', 'webm'] }] });
  return r.canceled ? [] : r.filePaths;
});
ipcMain.handle('scan', async (e, paths) => {
  const out = [];
  for (const p of [].concat(paths || [])) {
    let st; try { st = await fsp.stat(p); } catch { continue; }
    if (st.isDirectory()) await scan(p, out); else if (AUDIO.test(p)) out.push(p);
  }
  return out;
});
ipcMain.handle('exists', async (e, paths) => Promise.all([].concat(paths || []).map(p => fsp.stat(p).then(s => s.isFile() ? s.size : 0, () => 0))));
ipcMain.handle('read-file', async (e, p) => { if (!AUDIO.test(p)) return null; const s = await fsp.stat(p); if (s.size > 40e6) return null; return new Uint8Array(await fsp.readFile(p)); });
ipcMain.handle('web-open', (e, url) => { openWeb(String(url || '')); return true; });
ipcMain.handle('web-nav', (e, cmd) => {
  if (!webWin || webWin.isDestroyed()) return false;
  const wc = webWin.webContents;
  if (cmd === 'back' && wc.navigationHistory.canGoBack()) wc.navigationHistory.goBack();
  else if (cmd === 'fwd' && wc.navigationHistory.canGoForward()) wc.navigationHistory.goForward();
  else if (cmd === 'reload') wc.reload();
  else if (cmd === 'show') webWin.show();
  else if (cmd === 'close') webWin.close();
  return true;
});
ipcMain.handle('web-media', async (e, play) => { if (!webWin || webWin.isDestroyed()) return 0; try { return await webWin.webContents.executeJavaScript(WEB_MEDIA(!!play), true); } catch { return 0; } });
ipcMain.handle('web-state', () => { sendWeb(); return true; });
ipcMain.handle('mini', (e, on, height) => { setMini(on, height); return mini; });
ipcMain.handle('catalog', async (e, name, fresh) => {
  if (fresh) await fsp.rm(CACHE(name), { force: true });
  if (name === 'tabletop') return cached('tabletop', 24, tabletopAudio);
  if (name === 'incompetech') return cached('incompetech', 72, incompetech);
  throw new Error('unknown catalogue');
});
ipcMain.handle('web-get', (e, url, headers) => getText(url, headers));
// keep an online track on this computer: Music\Critter Sounds\<source>\, with its credit noted in credits.txt
ipcMain.handle('download', async (e, { url, source, title, credit }) => {
  if (!/^https?:\/\//i.test(url)) throw new Error('bad address');
  // one folder inside Music\Critter Sounds, never a way out of it ("..")
  const dir = CS(String(source || 'Online').replace(/[<>:"/\\|?*\x00-\x1f]+/g, ' ').replace(/^[.\s]+|[.\s]+$/g, '').trim() || 'Online');
  await fsp.mkdir(dir, { recursive: true });
  const ext = (/\.(mp3|ogg|oga|opus|wav|flac|m4a|aac)(\?|$)/i.exec(url) || [, 'mp3'])[1].toLowerCase();
  const base = String(title || 'Track').replace(/[<>:"/\\|?*\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Track';
  let file = path.join(dir, base + '.' + ext);
  for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, `${base} (${i}).${ext}`);
  const r = await net.fetch(url, { headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('the site answered ' + r.status);
  await fsp.writeFile(file, Buffer.from(await r.arrayBuffer()));
  if (credit) await fsp.appendFile(path.join(dir, 'credits.txt'), `${path.basename(file)}: ${credit}\r\n`);
  return file;
});
/* ---------- YouTube, through yt-dlp (github.com/yt-dlp/yt-dlp), kept in the app's data folder ---------- */
// it's installed (and updated) only when asked, from yt-dlp's own GitHub releases; it runs without a shell,
// with the search words and links passed as plain arguments. Audio is downloaded as it is (m4a or webm), so no ffmpeg is needed.
const { spawn } = require('node:child_process');
const YTDLP = () => path.join(app.getPath('userData'), 'bin', 'yt-dlp.exe');
const YT_RELEASE = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
const ytJobs = new Map();
function ytRun(args, { onLine, job } = {}) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(YTDLP())) { reject(new Error('yt-dlp isn\'t installed yet')); return; }
    // UTF-8 both ways, or names like "Rain • Forest" come back garbled from the Windows console encoding
    const p = spawn(YTDLP(), ['--no-warnings', '--no-colors', ...args], { windowsHide: true, env: { ...process.env, PYTHONIOENCODING: 'utf-8', PYTHONUTF8: '1' } });
    if (job) ytJobs.set(job, p);
    let out = '', err = '', buf = '', ebuf = '';
    p.stdout.setEncoding('utf8'); p.stderr.setEncoding('utf8');
    p.stdout.on('data', d => { out += d; if (onLine) { buf += d; const lines = buf.split(/\r?\n/); buf = lines.pop(); lines.forEach(onLine); } });
    // progress can come on either stream, depending on how quiet yt-dlp is asked to be
    p.stderr.on('data', d => { err += d; if (onLine) { ebuf += d; const lines = ebuf.split(/\r?\n/); ebuf = lines.pop(); lines.forEach(l => { if (/^CSPROG/.test(l.trim())) onLine(l); }); } });
    p.on('error', reject);
    p.on('close', code => { if (job) ytJobs.delete(job); if (buf && onLine) onLine(buf); code === 0 ? resolve(out) : reject(new Error((err.trim().split('\n').pop() || 'yt-dlp stopped (' + code + ')').replace(/^ERROR:\s*/, ''))); });
  });
}
const ytVersion = async () => (fs.existsSync(YTDLP()) ? (await ytRun(['--version'])).trim() : '');
const isWebUrl = u => typeof u === 'string' && /^https?:\/\/\S+$/i.test(u) && u.length < 2000;
const ytEntry = e => ({ id: e.id, title: e.title || 'Untitled', url: e.webpage_url || e.url || (e.id ? 'https://www.youtube.com/watch?v=' + e.id : ''), dur: +e.duration || 0, by: e.channel || e.uploader || '', views: +e.view_count || 0, thumb: (e.thumbnails && e.thumbnails.length ? e.thumbnails[Math.min(1, e.thumbnails.length - 1)].url : (e.id ? `https://i.ytimg.com/vi/${e.id}/mqdefault.jpg` : '')) });
ipcMain.handle('yt-status', async () => { try { return { installed: fs.existsSync(YTDLP()), version: await ytVersion() }; } catch (e) { return { installed: fs.existsSync(YTDLP()), version: '', error: e.message }; } });
ipcMain.handle('yt-install', async e => {
  await fsp.mkdir(path.dirname(YTDLP()), { recursive: true });
  const r = await net.fetch(YT_RELEASE, { redirect: 'follow', headers: { 'User-Agent': UA } });
  if (!r.ok) throw new Error('GitHub answered ' + r.status);
  const total = +r.headers.get('content-length') || 0, tmp = YTDLP() + '.part', out = fs.createWriteStream(tmp);
  let got = 0;
  for await (const chunk of r.body) { out.write(chunk); got += chunk.length; if (!e.sender.isDestroyed()) e.sender.send('yt:progress', { job: 'install', pct: total ? got / total : 0 }); }
  await new Promise(res => out.end(res));
  if (got < 1e6) { await fsp.rm(tmp, { force: true }); throw new Error('the download was too small to be yt-dlp'); }
  await fsp.rename(tmp, YTDLP());
  return ytVersion();
});
ipcMain.handle('yt-update', async () => { await ytRun(['-U']); return ytVersion(); });
ipcMain.handle('yt-search', async (e, q, n) => {
  q = String(q || '').trim().slice(0, 200); if (!q) return [];
  const j = JSON.parse(await ytRun(['--flat-playlist', '-J', `ytsearch${Math.min(40, Math.max(1, +n || 20))}:${q}`]));
  return (j.entries || []).filter(x => x && x.id).map(ytEntry);
});
// a link: one video, or every video in a playlist
ipcMain.handle('yt-info', async (e, url) => {
  if (!isWebUrl(url)) throw new Error('that isn\'t a web address');
  const j = JSON.parse(await ytRun(['--flat-playlist', '-J', url]));
  return j.entries ? { title: j.title || 'Playlist', items: j.entries.filter(x => x && (x.id || x.url)).slice(0, 500).map(ytEntry) } : { title: j.title, items: [ytEntry(j)] };
});
// a short-lived address of the audio itself, for listening before downloading
ipcMain.handle('yt-stream', async (e, url) => { if (!isWebUrl(url)) throw new Error('bad address'); return (await ytRun(['-f', 'bestaudio', '-g', '--no-playlist', url])).trim().split('\n')[0]; });
ipcMain.handle('yt-download', async (e, { url, job }) => {
  if (!isWebUrl(url)) throw new Error('bad address');
  const dir = CS('YouTube');
  await fsp.mkdir(dir, { recursive: true });
  // --print makes yt-dlp quiet, so --progress keeps the progress lines coming; "download:" picks the stage, CSPROG marks the line
  const args = extra => ['-f', 'bestaudio[ext=m4a]/bestaudio[ext=webm]/bestaudio', '--no-playlist', '--no-simulate', '--progress', '--newline', '--retries', '3', '--fragment-retries', '3',
    '--progress-template', 'download:CSPROG %(progress._percent_str)s', ...extra,
    '-o', path.join(dir, '%(title).120B [%(id)s].%(ext)s'), '--print', 'after_move:filepath', url];
  let file = '';
  const opts = {
    job, onLine: line => {
      const m = /^CSPROG\s*([\d.]+)%/.exec(line.trim());
      if (m) { if (!e.sender.isDestroyed()) e.sender.send('yt:progress', { job, pct: +m[1] / 100 }); }
      else if (line.trim() && path.isAbsolute(line.trim())) file = line.trim();
    }
  };
  // YouTube sometimes refuses (403) for a while; once more, asking as other players do, before giving up
  try { await ytRun(args([]), opts); }
  catch (err) {
    if (!/403|Forbidden/i.test(err.message)) throw err;
    try { await ytRun(args(['--extractor-args', 'youtube:player_client=web_safari,mweb,tv']), opts); }
    catch (err2) { throw new Error(err2.message + ' (YouTube is refusing for now: try again in a while, or press Update)'); }
  }
  // if the name didn't come through, the video's id in brackets finds the file
  if (!file || !fs.existsSync(file)) {
    const id = String(job || '').replace(/[^\w-]/g, ''), hit = id && (await fsp.readdir(dir)).find(n => n.includes(`[${id}].`) && !/\.(part|ytdl)$/.test(n));
    file = hit ? path.join(dir, hit) : '';
  }
  if (!file || !fs.existsSync(file)) throw new Error('yt-dlp finished, but the file isn\'t there');
  return file;
});
ipcMain.handle('yt-cancel', (e, job) => { const p = ytJobs.get(job); if (p) { p.kill(); ytJobs.delete(job); } return !!p; });
ipcMain.handle('yt-folder', () => { const dir = CS('YouTube'); fs.mkdirSync(dir, { recursive: true }); shell.openPath(dir); return dir; });

/* ---------- soundscapes ---------- */
// Music\Critter Sounds\Soundscapes holds one <name>.soundscape.json per soundscape, Loops the rendered loops,
// Nodes any node types people write themselves (plain .js files, read when a window opens)
const SC_EXT = '.soundscape.json';
const fileName = s => String(s || '').replace(/[<>:"/\\|?*\x00-\x1f]+/g, ' ').replace(/\s+/g, ' ').trim().replace(/\.+$/, '').slice(0, 80);
async function scapeFiles() {
  const dir = CS('Soundscapes'); await fsp.mkdir(dir, { recursive: true });
  const out = [];
  for (const n of await fsp.readdir(dir)) {
    if (!n.toLowerCase().endsWith(SC_EXT)) continue;
    try { const doc = JSON.parse((await fsp.readFile(path.join(dir, n), 'utf8')).replace(/^﻿/, '')); if (doc && doc.id && Array.isArray(doc.nodes)) out.push({ file: path.join(dir, n), doc }); } catch {}
  }
  return out;
}
const validDoc = d => d && typeof d === 'object' && /^[\w-]{1,60}$/.test(d.id || '') && Array.isArray(d.nodes) && Array.isArray(d.edges) && JSON.stringify(d).length < 4e6;
// one save at a time, so two windows saving together don't trip over a rename
let scQ = Promise.resolve();
const scLocked = fn => (scQ = scQ.then(fn, fn));
async function writeScape(doc) {
  const all = await scapeFiles(), mine = all.find(x => x.doc.id === doc.id);
  const want = fileName(doc.name) || 'Untitled soundscape';
  let file = path.join(CS('Soundscapes'), want + SC_EXT);
  for (let i = 2; all.some(x => x.doc.id !== doc.id && x.file.toLowerCase() === file.toLowerCase()); i++) file = path.join(CS('Soundscapes'), `${want} (${i})${SC_EXT}`);
  doc.saved = Date.now();
  const tmp = file + '.tmp'; await fsp.writeFile(tmp, JSON.stringify(doc, null, 1)); await fsp.rename(tmp, file);
  if (mine && mine.file.toLowerCase() !== file.toLowerCase()) await fsp.rm(mine.file, { force: true });
  return file;
}
// tell every window but the one that saved
function scapeSaved(doc, from) { for (const w of [win, ...editors.keys()]) if (w && !w.isDestroyed() && w.webContents !== from) w.webContents.send('scape:saved', doc); }
ipcMain.handle('scape-list', async () => (await scapeFiles()).sort((a, b) => (a.doc.created || 0) - (b.doc.created || 0)).map(x => x.doc));
ipcMain.handle('scape-get', async (e, id) => { const x = (await scapeFiles()).find(f => f.doc.id === id); return x ? x.doc : null; });
ipcMain.handle('scape-save', (e, doc) => scLocked(async () => { if (!validDoc(doc)) throw new Error('that isn\'t a soundscape'); const file = await writeScape(doc); scapeSaved(doc, e.sender); return file; }));
// a few fields from the main window (name, icon, a macro's value), merged into what's on disk
ipcMain.handle('scape-patch', (e, id, patch) => scLocked(async () => {
  const x = (await scapeFiles()).find(f => f.doc.id === id); if (!x) return null;
  const d = x.doc;
  for (const k of ['name', 'icon', 'named', 'iconSet']) if (patch[k] !== undefined) d[k] = patch[k];
  if (patch.macro) { const n = d.nodes.find(m => m.id === patch.macro.node); if (n) { n.p = n.p || {}; n.p.v = +patch.macro.v; } }
  await writeScape(d); scapeSaved(d, e.sender); return d;
}));
ipcMain.handle('scape-delete', async (e, id) => {
  const x = (await scapeFiles()).find(f => f.doc.id === id); if (!x) return false;
  for (const [w, eid] of editors) if (eid === id && !w.isDestroyed()) w.destroy();
  await shell.trashItem(x.file); scapeSaved({ id, deleted: true }, e.sender); return true;
});
// a .soundscape.json from somewhere else: copied in, with an id of its own if that one is taken
ipcMain.handle('scape-import', async () => {
  const r = await dialog.showOpenDialog(win, { title: L('Bring in a soundscape'), filters: [{ name: L('Soundscapes'), extensions: ['json'] }], properties: ['openFile', 'multiSelections'] });
  const all = await scapeFiles(), got = [];
  for (const f of r.canceled ? [] : r.filePaths) {
    try {
      const d = JSON.parse((await fsp.readFile(f, 'utf8')).replace(/^﻿/, '')); if (!validDoc(d)) continue;
      // Script nodes run their own JavaScript: someone else's only runs when this person says so
      const scripts = d.nodes.filter(n => n && n.type === 'script' && n.p && typeof n.p.code === 'string' && n.p.code.trim());
      if (scripts.length) {
        const a = await dialog.showMessageBox(win, { type: 'warning', title: L('Bring in a soundscape'), message: L('This soundscape has Script nodes, which run their own JavaScript.'), detail: `${path.basename(f)}: ${scripts.length} ${scripts.length === 1 ? 'Script node' : 'Script nodes'}.\n\n` + L('Only keep the scripts if you trust whoever made this file. Without them, the rest of the soundscape still comes in.'), buttons: [L('Bring it in without the scripts'), L('Keep the scripts'), L('Cancel')], defaultId: 0, cancelId: 2, noLink: true });
        if (a.response === 2) continue;
        if (a.response === 0) for (const n of scripts) delete n.p.code;
      }
      if (all.some(x => x.doc.id === d.id)) d.id = 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); d.created = Date.now(); await scLocked(() => writeScape(d)); got.push(d); } catch {}
  }
  return got;
});
// the editor: a window of its own, one per soundscape
const editors = new Map(); // BrowserWindow -> soundscape id
function openEditor(id) {
  for (const [w, eid] of editors) if (eid === id && !w.isDestroyed()) { if (w.isMinimized()) w.restore(); w.focus(); return; }
  const w = new BrowserWindow({
    width: 1280, height: 800, minWidth: 640, minHeight: 420, backgroundColor: '#0c0d10', title: 'Soundscape editor', icon: ICON, frame: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, spellcheck: false, autoplayPolicy: 'no-user-gesture-required' }
  });
  editors.set(w, id);
  w.loadURL('app://music/scape.html?id=' + encodeURIComponent(id));
  w.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/i.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  w.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  const state = () => { if (!w.isDestroyed()) w.webContents.send('win:state', { max: w.isMaximized(), focus: w.isFocused(), full: w.isFullScreen() }); };
  for (const ev of ['maximize', 'unmaximize', 'focus', 'blur']) w.on(ev, state);
  w.webContents.on('did-finish-load', () => { state(); if (win && !win.isDestroyed()) win.webContents.send('scape:cmd', { op: 'hello' }); });
  w.webContents.on('before-input-event', (e, i) => {
    if (i.type !== 'keyDown') return; const k = i.key.toLowerCase(), c = i.control || i.meta;
    if (c && i.shift && k === 'i') { e.preventDefault(); w.webContents.toggleDevTools(); }
    else if (c && !i.shift && k === 'r') { e.preventDefault(); w.webContents.reload(); }
  });
  w.on('closed', () => editors.delete(w));
}
ipcMain.handle('scape-edit', (e, id) => { if (/^[\w-]{1,60}$/.test(id || '')) openEditor(id); return true; });
// the soundscape plays in the main window (so it goes to the table); the editors ask it to, and hear back what it's doing
ipcMain.on('scape:cmd', (e, msg) => { if (win && !win.isDestroyed() && e.sender !== win.webContents) win.webContents.send('scape:cmd', msg); });
ipcMain.on('scape:state', (e, st) => { if (!win || e.sender !== win.webContents) return; for (const w of editors.keys()) if (!w.isDestroyed()) w.webContents.send('scape:state', st); });
ipcMain.handle('scape-loop-save', async (e, name, bytes) => {
  if (!(bytes instanceof Uint8Array) || bytes.length < 44) throw new Error('nothing to save');
  const dir = CS('Loops'); await fsp.mkdir(dir, { recursive: true });
  const b = fileName(name) || 'Soundscape loop';
  let file = path.join(dir, b + '.wav'); for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, `${b} (${i}).wav`);
  await fsp.writeFile(file, bytes); return file;
});
ipcMain.handle('scape-nodes', async () => {
  const dir = CS('Nodes'), out = [];
  try { for (const n of (await fsp.readdir(dir)).sort()) if (/\.js$/i.test(n)) out.push({ file: n, code: await fsp.readFile(path.join(dir, n), 'utf8') }); } catch {}
  return out;
});
ipcMain.handle('cs-dir', () => ({ dir: CS(), custom: !!getPrefs().csDir, fixed: !!process.env.CBM_MUSICDIR, data: app.getPath('userData') }));
// a new place for downloads, YouTube, soundscapes and loops; what's already saved stays where it is
ipcMain.handle('cs-dir-pick', async (e, reset) => {
  if (reset) { delete getPrefs().csDir; await savePrefs(); makeFolders(); return CS(); }
  const r = await dialog.showOpenDialog(BrowserWindow.fromWebContents(e.sender) || win, { title: L('Choose where Critter Sounds keeps its files'), properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  getPrefs().csDir = r.filePaths[0]; await savePrefs(); makeFolders(); return CS();
});
ipcMain.handle('data-folder', () => { shell.openPath(app.getPath('userData')); return true; });
ipcMain.handle('lib-backup', async e => {
  const stamp = new Date().toISOString().slice(0, 10);
  const r = await dialog.showSaveDialog(BrowserWindow.fromWebContents(e.sender) || win, { title: L('Back up the library'), defaultPath: path.join(app.getPath('documents'), `Critter Sounds library ${stamp}.json`), filters: [{ name: L('Library backup'), extensions: ['json'] }] });
  if (r.canceled || !r.filePath) return null;
  await fsp.copyFile(LIB(), r.filePath); return r.filePath;
});
// the keyboard's media keys, for this app even in the background (Settings can switch that off)
const MEDIA = [['MediaPlayPause', 'toggle'], ['MediaNextTrack', 'next'], ['MediaPreviousTrack', 'prev'], ['MediaStop', 'stop']];
function mediaKeys(on) { for (const [acc] of MEDIA) { try { globalShortcut.unregister(acc); } catch {} } if (on) for (const [acc, cmd] of MEDIA) { try { globalShortcut.register(acc, () => win && win.webContents.send('key', cmd)); } catch {} } }
ipcMain.handle('media-keys', (e, on) => { mediaKeys(!!on); return true; });
ipcMain.handle('cs-folder', (e, sub) => { const dir = CS(...(['Soundscapes', 'Loops', 'Nodes', 'YouTube'].includes(sub) ? [sub] : [])); fs.mkdirSync(dir, { recursive: true }); shell.openPath(dir); return dir; });
/* ---------- voice bots: the table's mix into a Discord or Fluxer voice channel (bots/bot.js, in a process of its own) ---------- */
// Tokens are kept encrypted with the system's own protection (safeStorage) in bots.json, never shown to the page again.
const BOTS = () => path.join(app.getPath('userData'), 'bots.json');
const SVCS = ['discord', 'fluxer'];
let botP = null, botCfg = null;
function botsCfg() {
  if (!botCfg) { try { botCfg = JSON.parse(fs.readFileSync(BOTS(), 'utf8')); } catch { botCfg = {}; } for (const s of SVCS) botCfg[s] = botCfg[s] || {}; }
  return botCfg;
}
const saveBots = () => fsp.writeFile(BOTS(), JSON.stringify(botsCfg(), null, 1)).catch(() => {});
const toPage = (ch, m) => { if (win && !win.isDestroyed()) win.webContents.send(ch, m); };
function botProc() {
  if (botP) return botP;
  botP = utilityProcess.fork(path.join(__dirname, 'bots', 'bot.js'), [], { serviceName: 'Critter Sounds voice bots', stdio: 'pipe' });
  botP.stderr && botP.stderr.on('data', d => console.warn('[bots]', String(d).trim()));
  botP.on('message', m => toPage('bot:ev', m));
  botP.on('exit', code => { botP = null; for (const svc of SVCS) toPage('bot:ev', { ev: 'state', svc, state: 'off' }); if (code) toPage('bot:ev', { ev: 'error', svc: '', msg: 'The voice bots stopped (' + code + '). Connect again to restart them.' }); });
  for (const svc of SVCS) botP.postMessage({ op: 'notes', svc, on: !!botsCfg()[svc].notes });
  return botP;
}
const tokenOf = svc => { const t = botsCfg()[svc].tok; if (!t) return ''; try { return safeStorage.isEncryptionAvailable() && botsCfg()[svc].enc ? safeStorage.decryptString(Buffer.from(t, 'base64')) : Buffer.from(t, 'base64').toString('utf8'); } catch { return ''; } };
ipcMain.handle('bot-cfg', () => Object.fromEntries(SVCS.map(s => { const c = botsCfg()[s]; return [s, { saved: !!c.tok, guild: c.guild || '', channel: c.channel || '', notes: !!c.notes, origin: c.origin || '', auto: !!c.auto }]; })));
ipcMain.handle('bot-login', async (e, svc, token, origin) => {
  if (!SVCS.includes(svc)) throw new Error('unknown service');
  const c = botsCfg()[svc];
  token = String(token || '').trim().replace(/^Bot\s+/i, '');
  if (token) { const enc = safeStorage.isEncryptionAvailable(); c.tok = (enc ? safeStorage.encryptString(token) : Buffer.from(token, 'utf8')).toString('base64'); c.enc = enc; }
  if (origin !== undefined) c.origin = /^https?:\/\/[^\s]+$/i.test(String(origin || '').trim()) ? String(origin).trim().replace(/\/+$/, '') : '';
  await saveBots();
  const tok = tokenOf(svc); if (!tok) throw new Error('Paste the bot\'s token first.');
  botProc().postMessage({ op: 'login', svc, token: tok, origin: svc === 'fluxer' ? c.origin : '' });
  return true;
});
ipcMain.handle('bot-join', async (e, svc, guild, channel) => { if (!SVCS.includes(svc)) return false; Object.assign(botsCfg()[svc], { guild, channel }); await saveBots(); botProc().postMessage({ op: 'join', svc, guild, channel }); return true; });
ipcMain.handle('bot-leave', (e, svc) => { if (botP && SVCS.includes(svc)) botP.postMessage({ op: 'leave', svc }); return true; });
ipcMain.handle('bot-logout', async (e, svc, forget) => {
  if (!SVCS.includes(svc)) return false;
  if (botP) botP.postMessage({ op: 'logout', svc });
  if (forget) { botsCfg()[svc] = {}; await saveBots(); }
  return true;
});
ipcMain.handle('bot-set', async (e, svc, k, v) => {
  if (!SVCS.includes(svc) || !['notes', 'auto'].includes(k)) return false;
  botsCfg()[svc][k] = !!v; await saveBots();
  if (k === 'notes' && botP) botP.postMessage({ op: 'notes', svc, on: !!v });
  return true;
});
// the mix, in small chunks of 16-bit PCM, only while a bot is in a channel
ipcMain.on('bot-pcm', (e, buf) => { if (botP && buf instanceof Uint8Array) botP.postMessage({ op: 'pcm', data: buf }); });
ipcMain.handle('bot-check', () => { botProc().postMessage({ op: 'check' }); return true; });
ipcMain.on('bot-note', (e, text) => { if (botP && typeof text === 'string') botP.postMessage({ op: 'note', text: text.slice(0, 300) }); });

// Music\Critter Sounds and its folders, made at the start; the Nodes folder gets a guide and an example the first time
function makeFolders() {
  try {
    for (const d of ['YouTube', 'Soundscapes', 'Loops', 'Nodes']) fs.mkdirSync(CS(d), { recursive: true });
    const guide = path.join(__dirname, 'nodes-guide');
    if (fs.existsSync(guide) && !fs.readdirSync(CS('Nodes')).length) for (const n of fs.readdirSync(guide)) { const to = CS('Nodes', n); if (!fs.existsSync(to)) fs.copyFileSync(path.join(guide, n), to); }
  } catch (e) { console.warn('folders', e); }
}

ipcMain.handle('show-item', (e, p) => { if (typeof p === 'string' && path.isAbsolute(p)) shell.showItemInFolder(p); return true; });
ipcMain.handle('open-external', (e, url) => { if (/^https?:\/\//i.test(url)) shell.openExternal(url); return true; });

// no menu bar: the menu opens from the title bar's Critter Sounds button
function buildMenu() { Menu.setApplicationMenu(null); }

app.whenReady().then(() => {
  buildMenu(); makeFolders(); createWindow();
  // the keyboard's media keys work even when the app is in the background
  mediaKeys(true);
  // MUSIC_SELFTEST=<json>: drives the app for automated checks (used when building)
  if (process.env.MUSIC_SELFTEST) win.webContents.once('did-finish-load', () => win.webContents.executeJavaScript(`window.SELFTEST = ${JSON.stringify(JSON.parse(process.env.MUSIC_SELFTEST))};`));
});
app.on('will-quit', () => { globalShortcut.unregisterAll(); if (botP) { try { botP.kill(); } catch {} } });
app.on('window-all-closed', () => app.quit());
