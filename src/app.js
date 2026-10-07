/* Critter Sounds: plays local playlists, free online libraries and web pages to a Critter VTT table, live.
   The sound is mixed here (two decks for crossfades, one for a web page, one for sound pads), then sent over WebRTC
   to every Critter VTT page in the lobby. The effects run on each player's computer (musicfx.js, copied from Critter VTT).
   The screen is a canvas of windows that split, resize and dock together; the queue sits on the right. */
'use strict';
const $ = (s, r = document) => r.querySelector(s);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false || k === 'icon' || k === 'gicon') continue;
    if (k === 'class') e.className = v; else if (k === 'text') { if (tag === 'button') setLabel(e, v); else e.textContent = v; }
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  if (props && (props.icon || props.gicon)) e.prepend(props.gicon ? gi(props.gicon) : ico(props.icon));
  // the design standard: every button has an icon; a text button without one gets one that fits its first word
  if (tag === 'button' && (e.classList.contains('btn') || e.parentElement?.classList.contains('seg')) && !e.querySelector('svg,.ico,.gi,img') && e.textContent.trim()) e.prepend(ico(autoIcon(e.textContent)));
  // an icon-only button says what it does, to the pointer (tooltip) and to screen readers
  if (tag === 'button' && !e.getAttribute('aria-label') && e.title && !e.textContent.replace(/[^p{L}p{N}]/gu, '')) e.setAttribute('aria-label', e.title);
  if (tag === 'button' && e.classList.contains('icon-only') && !e.getAttribute('aria-label')) { const l = e.title || ICON_LABEL[(e.querySelector('.ico') || {}).dataset?.i] || ''; if (l) { e.setAttribute('aria-label', l); if (!e.title) e.title = l; } }
  return e;
}
const AUTO_ICON = [[/^(cancel|close|no thanks|skip setup)/i, 'x'], [/^(ok|done|got it|keep|yes|all set)/i, 'check'], [/^(save|back up)/i, 'save'], [/^(connect|sign|reconnect|homebase)/i, 'link'], [/^(join|play|start|run|listen|hear|quick tour|let's go)/i, 'play'], [/^(leave|stop)/i, 'stop'],
  [/^(search|find)/i, 'search'], [/^(install|download|bring in|render|import)/i, 'download'], [/^(update|reset|reload|refresh|try again|load|look for)/i, 'refresh'], [/^(remove|delete|forget|clear)/i, 'trash'], [/^(rename|change|edit)/i, 'edit'],
  [/^(add|new|make|invite|create|＋)/i, 'plus'], [/^(choose|open|show|folder|📂)/i, 'folder'], [/^(back|previous)/i, 'back'], [/^(next|skip|more|continue)/i, 'fwd'], [/^(copy)/i, 'list'], [/^(help|how|\?)/i, 'help'], [/^(full tour|tour)/i, 'list'], [/^(settings)/i, 'gear']];
const autoIcon = s => { s = String(s).trim(); for (const [re, ic] of AUTO_ICON) if (re.test(s)) return ic; return 'arrow'; };
const ICON_LABEL = { x: 'Close', more: 'More', trash: 'Remove', edit: 'Edit', play: 'Play', stop: 'Stop', folder: 'Open the folder', search: 'Search', plus: 'Add', refresh: 'Refresh', help: 'Help', gear: 'Settings' };
/* ---------- line icons: drawn on a 24 x 24 grid, in the text's own colour ---------- */
const F = 'fill="currentColor" stroke="none"';
const ICONS = {
  play: `<path d="M8 5.5v13l10.5-6.5z" ${F}/>`, pause: `<rect x="6.5" y="5" width="4" height="14" rx="1.2" ${F}/><rect x="13.5" y="5" width="4" height="14" rx="1.2" ${F}/>`,
  stop: `<rect x="6" y="6" width="12" height="12" rx="2.5" ${F}/>`, next: `<path d="M6 6v12l8.5-6z" ${F}/><path d="M17.5 6v12"/>`, prev: `<path d="M18 6v12l-8.5-6z" ${F}/><path d="M6.5 6v12"/>`,
  shuffle: '<path d="M3 7h3.5c2 0 3.2.8 4.3 2.4l2.4 3.6c1.1 1.6 2.3 2.4 4.3 2.4H21M3 17h3.5c1.4 0 2.4-.4 3.2-1.2M14.5 8.2c.8-.8 1.8-1.2 3.1-1.2H21M18 4l3 3-3 3M18 12.4l3 3-3 3"/>',
  repeat: '<path d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20M17 3.5l3 3-3 3M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4M7 20.5l-3-3 3-3"/>',
  repeat1: '<path d="M4 11.5V10a3.5 3.5 0 0 1 3.5-3.5H20M17 3.5l3 3-3 3M20 12.5V14a3.5 3.5 0 0 1-3.5 3.5H4M7 20.5l-3-3 3-3M11 10.8l1.6-1.1v4.8"/>',
  arrow: '<path d="M4 12h15M14 7l5 5-5 5"/>',
  list: `<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.1" ${F}/><circle cx="4.5" cy="12" r="1.1" ${F}/><circle cx="4.5" cy="18" r="1.1" ${F}/>`,
  music: '<path d="M9 18V5.5l11-2V16"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z"/>',
  web: `<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="M3 9h18"/><circle cx="6.3" cy="6.8" r=".7" ${F}/><circle cx="8.6" cy="6.8" r=".7" ${F}/>`,
  youtube: `<rect x="2.5" y="5.5" width="19" height="13" rx="4"/><path d="M10.2 9.3v5.4l4.6-2.7z" ${F}/>`,
  pads: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  clapper: '<rect x="3" y="9.5" width="18" height="10.5" rx="2"/><path d="M3.5 9.5 3 6.6a1.5 1.5 0 0 1 1.2-1.7l13.8-2.4a1.5 1.5 0 0 1 1.7 1.2l.5 2.9M8 4.2l2.3 3.5M13 3.4l2.3 3.5"/>',
  sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  wave: '<path d="M3 15c2.5 0 3-9 6-9s3.5 12 6 12 3.5-6 6-6"/>',
  help: `<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.8" r=".8" ${F}/>`,
  plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>', check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  splitR: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M12 4.5v15"/>', splitD: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M3.5 12h17"/>',
  swap: '<path d="M7 7.5h12.5M16.5 4.5l3 3-3 3M17 16.5H4.5M7.5 13.5l-3 3 3 3"/>',
  headphones: '<path d="M4 15v-2.5a8 8 0 0 1 16 0V15"/><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16" y="14" width="4.5" height="6.5" rx="1.5"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>', queue: '<path d="M4 6h11M4 12h11M4 18h7M18 14v7M14.5 17.5h7"/>',
  folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.8l2 2h7.2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  more: `<circle cx="6" cy="12" r="1.4" ${F}/><circle cx="12" cy="12" r="1.4" ${F}/><circle cx="18" cy="12" r="1.4" ${F}/>`,
  grip: `<circle cx="9" cy="7" r="1.2" ${F}/><circle cx="15" cy="7" r="1.2" ${F}/><circle cx="9" cy="12" r="1.2" ${F}/><circle cx="15" cy="12" r="1.2" ${F}/><circle cx="9" cy="17" r="1.2" ${F}/><circle cx="15" cy="17" r="1.2" ${F}/>`,
  layout: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M10 4.5v15M10 12h10.5"/>', window: '<rect x="3.5" y="4.5" width="17" height="15" rx="2.5"/><path d="M12 9v6M9 12h6"/>',
  mini: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><rect x="11.5" y="11.5" width="6.5" height="5" rx="1"/>',
  palette: `<path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4C21 6.6 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.1" ${F}/><circle cx="10" cy="7.3" r="1.1" ${F}/><circle cx="14.5" cy="7.3" r="1.1" ${F}/>`,
  home: '<path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z"/>',
  trash: '<path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 12.5h9l1-12.5"/>', edit: '<path d="M15.5 4.5l4 4L8.5 19.5H4.5v-4z"/>',
  refresh: '<path d="M20 11a8 8 0 0 0-14.3-4.4M4 4v4h4M4 13a8 8 0 0 0 14.3 4.4M20 20v-4h-4"/>',
  github: '<path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2"/>', sort: '<path d="M7 4v16M4 7l3-3 3 3M17 20V4M14 17l3 3 3-3"/>',
  credit: '<circle cx="12" cy="12" r="9"/><path d="M14.8 9.5a3.5 3.5 0 1 0 0 5"/>', playnext: `<path d="M4 6h10M4 12h7M4 18h7"/><path d="M14 11v8l6-4z" ${F}/>`,
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  square: '<rect x="5" y="5" width="14" height="14" rx="2.5"/>', star: '<path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6L12 16.7l-5.1 2.7 1-5.6-4.1-4 5.7-.8z"/>',
  save: '<path d="M5 4h11l3 3v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1z"/><path d="M8 4v5h7V4M8 20v-6h8v6"/>', search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.3-4.3"/>',
  back: '<path d="M15 5l-7 7 7 7"/>', fwd: '<path d="M9 5l7 7-7 7"/>', clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>',
  moon: '<path d="M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5z"/>', font: '<path d="M5 19 10.5 5h3L19 19M7.5 13h9"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>', drop: '<path d="M12 3.5c3.5 4.3 6 7.6 6 10.6a6 6 0 0 1-12 0c0-3 2.5-6.3 6-10.6z"/>',
  grain: `<circle cx="6" cy="7" r="1" ${F}/><circle cx="12" cy="5" r="1" ${F}/><circle cx="18" cy="8" r="1" ${F}/><circle cx="8" cy="13" r="1" ${F}/><circle cx="15" cy="12" r="1" ${F}/><circle cx="5" cy="18" r="1" ${F}/><circle cx="11" cy="18" r="1" ${F}/><circle cx="18" cy="17" r="1" ${F}/>`,
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7"/><circle cx="12" cy="12" r="6.2"/>'
};
// the symbols used in labels, and the icon each stands for
const GLYPH = { '▶': 'play', '⏸': 'pause', '■': 'stop', '⏹': 'stop', '⏭': 'next', '⏮': 'prev', '+': 'plus', '＋': 'plus', '✕': 'x', '✓': 'check', '⭳': 'download', '☰': 'queue', '🎵': 'music', '📁': 'folder', '📂': 'folder', '🔔': 'pads', '▦': 'layout', '★': 'star', '💾': 'save', '🗑': 'trash', '◻': 'square', '✎': 'edit', '⟳': 'refresh', '⇅': 'sort', '©': 'credit', '⤴': 'playnext', '🔗': 'link', '⋯': 'more', '◀': 'back', '♪': 'note', '🎧': 'headphones', '◫': 'splitR', '⊟': 'splitD', '⇄': 'swap', '?': 'help', '🔀': 'shuffle', '🌙': 'moon', '⚙': 'gear' };
const iconName = g => (ICONS[g] ? g : GLYPH[g] || '');
function ico(name, cls) {
  const n = iconName(name), e = document.createElement('span'); e.className = 'ico' + (cls ? ' ' + cls : '');
  if (n) e.dataset.i = n;
  if (n) e.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[n]}</svg>`; else e.textContent = name;
  return e;
}
// "▶ Play" becomes the play icon and the word; a lone symbol becomes just the icon
function setLabel(el, text) {
  // only a symbol in front ("▶ Play") becomes an icon; a plain word that happens to name one ("music 298") stays text
  const m = /^(\S+)(?:\s+(.+))?$/.exec(String(text)), n = m && !/^\p{L}+$/u.test(m[1]) && iconName(m[1]);
  if (!n) { el.textContent = text; return; }
  el.replaceChildren(ico(n), ...(m[2] ? [Object.assign(document.createElement('span'), { textContent: m[2] })] : []));
  el.classList.toggle('icon-only', !m[2]);
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const fmt = s => { s = Math.max(0, Math.floor(s || 0)); const hh = Math.floor(s / 3600), m = Math.floor(s / 60) % 60, x = String(s % 60).padStart(2, '0'); return hh ? `${hh}:${String(m).padStart(2, '0')}:${x}` : `${m}:${x}`; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const base = p => String(p).split(/[\\/]/).pop();
const dirOf = p => String(p).split(/[\\/]/).slice(0, -1).join('\\');
const titleOf = p => base(p).replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim() || 'Track';
const mediaUrl = p => 'app://music/media?p=' + encodeURIComponent(p);
// a track is a file on this computer (path) or a sound on the web (url), played through the app's own address either way
const remoteUrl = u => 'app://music/remote?u=' + encodeURIComponent(u);
const srcUrl = x => (x.path ? mediaUrl(x.path) : x.url ? remoteUrl(x.url) : '');
const keyOf = x => x.path || x.url || '';
const clone = v => JSON.parse(JSON.stringify(v));
const errText = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
// the music code from Critter VTT's Music window: the lobby code, then the key, like 4TBCEF-EMJQE-SQSW5
// (also takes "Lobby 4TBCEF, key EMJQE-SQSW5", or the whole thing without dashes)
function parseMusicCode(s) {
  const parts = String(s || '').toUpperCase().replace(/\b(LOBBY|KEY)\b/g, ' ').split(/[^A-Z0-9]+/).filter(Boolean);
  if (!parts.length) return { code: '', key: '' };
  if (parts.length === 1 && parts[0].length > 6) return { code: parts[0].slice(0, 6), key: parts[0].slice(6) };
  return { code: parts[0], key: parts.slice(1).join('') };
}
const showCode = (code, key) => [code, key.slice(0, 5), key.slice(5)].filter(Boolean).join('-');
const shuffled = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
// sliders fill up to their handle in the highlight colour
function paintRange(el) { const lo = +el.min || 0, hi = el.max === '' ? 100 : +el.max, v = +el.value; el.style.setProperty('--p', `${((v - lo) / ((hi - lo) || 1)) * 100}%`); }
const paintRanges = (root = document) => root.querySelectorAll('input[type=range]').forEach(paintRange);
document.addEventListener('input', e => { if (e.target.type === 'range') paintRange(e.target); }, true);
// a tip: a light blue box that explains a window, with an ✕ that hides it for good (Help › Show all tips again)
function tip(id, text) {
  if ((S().hiddenTips || []).includes(id)) return document.createTextNode('');
  const el = h('div', { class: 'hint note tip' }, h('span', { class: 'grow', text }),
    h('button', { type: 'button', class: 'ib tipx', text: '✕', title: 'Hide this tip', onclick: () => { S().hiddenTips = [...new Set([...(S().hiddenTips || []), id])]; save(); el.remove(); } }));
  return el;
}
function resetTips() { S().hiddenTips = []; save(); renderPanels(); toast('All tips are back.'); }
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.replaceChildren(h('span', { class: 'tbadge' }, ico(/could|couldn|failed|problem|wasn't|isn't|not /i.test(msg) ? 'help' : 'sparkle')), h('span', { text: msg })); t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 3800); }

/* ============================== the library: playlists, pads, scenes, layouts, settings ============================== */
const DEF = () => ({ fadeIn: 2, fadeOut: 3, xfade: 4, crossfade: true, pauseFade: 1, vol: 0.8, shuffle: false, loop: 'all', monitor: false, monVol: 0.7, prevVol: 0.7, theme: { accent: '#8800ff', accent2: '#4cc9f0', tone: 'midnight', scheme: 'dark', tint: 4, bleed: 1, fonts: 'Easy reading' }, sink: '', duck: 0.35, name: 'Critter Sounds', lobby: '', key: '', fx: mfxDefaults(), irPath: '', fsKey: '', queueOpen: true, chatLog: true });
let LIB = { playlists: [], web: [], pads: [], scenes: [], layouts: [], layout: null, queue: [], ytFiles: {}, sessions: [], tagColors: {}, set: DEF() };
let saveT = 0;
const save = () => { clearTimeout(saveT); saveT = setTimeout(() => desk.saveLib(LIB).catch(() => toast('Could not save the library.')), 400); };
const S = () => LIB.set;
const plById = id => LIB.playlists.find(p => p.id === id);
const missing = new Set();

async function loadLib() {
  const d = await desk.loadLib().catch(() => null);
  if (d && typeof d === 'object') {
    LIB.playlists = Array.isArray(d.playlists) ? d.playlists.filter(p => p && Array.isArray(p.items)) : [];
    LIB.web = Array.isArray(d.web) ? d.web : [];
    LIB.pads = Array.isArray(d.pads) ? d.pads : [];
    LIB.scenes = Array.isArray(d.scenes) ? d.scenes : [];
    LIB.layouts = Array.isArray(d.layouts) ? d.layouts.filter(l => l && l.tree) : [];
    LIB.queue = Array.isArray(d.queue) ? d.queue.filter(q => q && q.item && keyOf(q.item)) : [];
    LIB.set = { ...DEF(), ...(d.set || {}) }; LIB.set.fx = mfxClean(LIB.set.fx); LIB.set.theme = { ...DEF().theme, ...(LIB.set.theme || {}) };
    LIB.ytFiles = d.ytFiles && typeof d.ytFiles === 'object' ? d.ytFiles : {};
    LIB.sessions = Array.isArray(d.sessions) ? d.sessions.filter(x => x && Array.isArray(x.entries)).slice(-30) : [];
    LIB.tagColors = d.tagColors && typeof d.tagColors === 'object' ? d.tagColors : {};
    // pads from before tags existed get a best guess
    for (const p of LIB.pads) if (p.group === undefined) autoTag(p);
    if (/^Crit(board|ter) Music$/.test(LIB.set.name)) LIB.set.name = 'Critter Sounds';
    LIB.lastSrc = d.lastSrc || '';
    // a layout saved by this version, or the suggested one for whoever had playlists before windows existed
    LIB.layout = validTree(d.layout) ? d.layout : (LIB.playlists.length ? presetTree('Run a game') : null);
  }
}
const mkItem = p => ({ id: uid(), path: p, title: titleOf(p), dur: 0 });
const newPlaylist = name => { const pl = { id: uid(), name: name || 'New playlist', folders: [], items: [] }; LIB.playlists.push(pl); save(); return pl; };
async function newPlaylistFrom(paths, name) {
  const files = await desk.scan(paths);
  const pl = newPlaylist(name || (paths.length === 1 ? base(paths[0]) : 'New playlist'));
  pl.folders = paths.slice(); pl.items = files.map(mkItem);
  save(); showPlaylist(pl); renderAll();
  toast(files.length ? `${pl.name}: ${files.length} track${files.length === 1 ? '' : 's'}.` : 'No sound files in there.');
  durQueue(pl.items);
  return pl;
}
async function addToPlaylist(pl, paths, at) {
  const files = await desk.scan(paths), have = new Set(pl.items.map(i => keyOf(i).toLowerCase()));
  const add = files.filter(f => !have.has(f.toLowerCase())).map(mkItem);
  if (at === undefined || at < 0) pl.items.push(...add); else pl.items.splice(at, 0, ...add);
  for (const p of paths) if (!files.includes(p) && !pl.folders.includes(p)) { const st = await desk.exists([p]); if (!st[0]) pl.folders.push(p); }
  save(); renderAll(); toast(add.length ? `Added ${add.length} track${add.length === 1 ? '' : 's'} to ${pl.name}.` : 'Nothing new to add.');
  durQueue(add);
}
// copies of tracks (local or online) into a playlist, skipping ones it already has
function copyInto(pl, items) {
  const have = new Set(pl.items.map(keyOf)); let n = 0;
  for (const it of items) if (keyOf(it) && !have.has(keyOf(it))) { pl.items.push({ ...clone(it), id: uid() }); have.add(keyOf(it)); n++; }
  save(); renderPanels('playlist', 'playlists');
  toast(n ? `Added ${n} to ${pl.name}.` : `${pl.name} already has ${items.length > 1 ? 'them' : 'it'}.`);
}
// look in the playlist's folders again: new files are added, files that are gone are taken out
async function rescan(pl) {
  if (!pl.folders.length) { toast('This playlist has no folders to look in. Add a folder first.'); return; }
  const files = await desk.scan(pl.folders), now = new Set(files.map(f => f.toLowerCase())), have = new Set(pl.items.map(i => keyOf(i).toLowerCase()));
  const inFolder = p => pl.folders.some(f => p.toLowerCase().startsWith(f.toLowerCase() + '\\') || p.toLowerCase().startsWith(f.toLowerCase() + '/'));
  const before = pl.items.length;
  pl.items = pl.items.filter(i => !i.path || !inFolder(i.path) || now.has(i.path.toLowerCase()) || (E.cur && E.cur.item === i));
  const gone = before - pl.items.length, add = files.filter(f => !have.has(f.toLowerCase())).map(mkItem);
  pl.items.push(...add); save(); renderAll(); durQueue(add);
  toast(`${add.length} new, ${gone} gone.`);
}
// track lengths are read in the background, one file at a time
const durTodo = [];
let durBusy = false;
function durQueue(items) { for (const i of items) if (!i.dur && !durTodo.includes(i)) durTodo.push(i); durRun(); }
async function durRun() {
  if (durBusy) return; durBusy = true;
  while (durTodo.length) {
    const it = durTodo.shift();
    const d = await new Promise(r => { const a = new Audio(); a.preload = 'metadata'; const done = v => { a.removeAttribute('src'); try { a.load(); } catch {} r(v); }; a.onloadedmetadata = () => done(isFinite(a.duration) ? a.duration : 0); a.onerror = () => done(-1); setTimeout(() => done(0), 8000); a.src = srcUrl(it); });
    if (d > 0) it.dur = d; else if (d < 0 && it.path) missing.add(it.path);
    if (!durTodo.length || durTodo.length % 20 === 0) { save(); renderPanels('playlist'); renderQueue(); }
  }
  durBusy = false;
}
async function checkMissing(pl) {
  const sizes = await desk.exists(pl.items.map(i => i.path || ''));
  let changed = false; pl.items.forEach((i, k) => { if (!i.path) return; const m = !sizes[k]; if (m !== missing.has(i.path)) { changed = true; if (m) missing.add(i.path); else missing.delete(i.path); } });
  if (changed) renderPanels('playlist');
}

/* ============================== sound: decks, fades, the stream out ============================== */
let ac, master, duckG, padG, scapeG, dest, analyser, monFx, monG;
const decks = [];
const WEB = { g: null, src: null, stream: null, t: 0, state: { open: false } };
// cur: what's playing; q: the playlist it carries on with once the queue is empty
const E = { cur: null, state: 'stop', q: null, lastDeck: null, tok: 0, seqT: 0, stopT: 0, pauseT: 0, fails: 0 };
const G = v => { const g = ac.createGain(); g.gain.value = v; return g; };
function initAudio() {
  ac = new AudioContext({ latencyHint: 'playback', sampleRate: 48000 });
  master = G(S().vol); duckG = G(1); padG = G(1);
  duckG.connect(master); padG.connect(master);
  scapeG = G(1); scapeG.connect(master); // the soundscape: not ducked by pads, so the world keeps going under them
  dest =ac.createMediaStreamDestination(); dest.channelCount = 2; master.connect(dest);
  const tr = dest.stream.getAudioTracks()[0]; if (tr) tr.contentHint = 'music';
  const split = ac.createChannelSplitter(2); analyser = [ac.createAnalyser(), ac.createAnalyser()]; master.connect(split); analyser.forEach((a, i) => { a.fftSize = 512; split.connect(a, i); });
  monFx = createMusicFx(ac); monFx.set(S().fx); master.connect(monFx.input);
  monG = G(S().monitor ? S().monVol : 0); monFx.output.connect(monG).connect(ac.destination);
  for (let i = 0; i < 2; i++) decks.push(mkDeck());
  WEB.g = G(0); WEB.g.connect(duckG);
  if (S().sink && ac.setSinkId) ac.setSinkId(S().sink).catch(() => {});
}
function mkDeck() {
  const el = new Audio(); el.preload = 'auto';
  const g = G(0); ac.createMediaElementSource(el).connect(g).connect(duckG);
  const d = { el, g, item: null, stopT: 0, advanced: false, handedOff: false };
  el.addEventListener('ended', () => onEnded(d));
  return d;
}
// an equal-power fade from wherever the gain is now; starting a new one cancels the old
function fade(g, to, secs) {
  const p = g.gain, now = ac.currentTime, from = p.value;
  try { p.cancelAndHoldAtTime(now); } catch { p.cancelScheduledValues(now); }
  if (secs <= 0.02 || Math.abs(to - from) < 0.001) { p.setValueAtTime(to, now + 0.005); return; }
  const N = 96, c = new Float32Array(N);
  for (let i = 0; i < N; i++) { const x = i / (N - 1); c[i] = to > from ? from + (to - from) * Math.sin(x * Math.PI / 2) : to + (from - to) * Math.cos(x * Math.PI / 2); }
  try { p.setValueCurveAtTime(c, now + 0.005, secs); } catch { p.setValueAtTime(from, now); p.linearRampToValueAtTime(to, now + secs); }
}
function deckStop(d) { clearTimeout(d.stopT); try { d.g.gain.cancelScheduledValues(0); } catch {} d.g.gain.setValueAtTime(0, ac.currentTime); d.el.pause(); d.item = null; }
const gainOf = src => (src.kind === 'web' ? WEB.g : src.d.g);
// let a source go: fade it to silence, then stop it
function release(src, secs) {
  if (!src || src.pending) return;
  if (src.kind === 'web') { fade(WEB.g, 0, secs); clearTimeout(WEB.t); WEB.t = setTimeout(() => desk.webMedia(false), secs * 1000 + 80); }
  else { const d = src.d; fade(d.g, 0, secs); clearTimeout(d.stopT); d.stopT = setTimeout(() => { d.el.pause(); d.item = null; }, secs * 1000 + 80); }
}
async function startSource(entry, secs) {
  if (entry.kind === 'web') {
    await webCapture(); clearTimeout(WEB.t);
    await desk.webMedia(true); fade(WEB.g, 1, secs);
    return { kind: 'web', item: entry };
  }
  const d = decks.find(x => x !== E.lastDeck) || decks[0];
  deckStop(d); E.lastDeck = d;
  d.item = entry; d.advanced = false; d.handedOff = false;
  d.el.loop = S().loop === 'one'; d.el.src = srcUrl(entry);
  await d.el.play();
  fade(d.g, 1, secs);
  return { kind: 'file', d, item: entry };
}
const manualFade = () => (S().crossfade ? { out: S().xfade, inn: S().xfade, overlap: true } : { out: S().fadeOut, inn: S().fadeIn, overlap: false });
const startFade = () => (E.state === 'play' ? manualFade() : { out: 0, inn: S().fadeIn, overlap: true });
// from one thing to the next: crossfaded, or one fading out before the next fades in
async function transition(entry, o) {
  const tok = ++E.tok; clearTimeout(E.seqT); clearTimeout(E.stopT); clearTimeout(E.pauseT);
  if (ac.state !== 'running') ac.resume().catch(() => {});
  const old = E.cur, audible = E.state === 'play' || E.state === 'stopping' || E.state === 'changing';
  if (old && !old.pending) release(old, audible ? o.out : 0.05);
  E.cur = { kind: entry.kind || 'file', item: entry, pending: true };
  playingChanged();
  if (audible && !o.overlap && o.out > 0) { E.state = 'changing'; paint(); pub(); await sleep(o.out * 1000); if (tok !== E.tok) return; }
  E.state = 'play'; paint();
  try {
    const src = await startSource(entry, o.inn);
    if (tok !== E.tok) { release(src, 0.1); return; }
    E.cur = src; E.fails = 0; missing.delete(keyOf(entry));
    if (entry.kind === 'web') logEvent('web', entry.title || 'A web page');
    else logEvent('music', entry.title + (entry.source ? ' · ' + entry.source : ''), { title: entry.title, cr: entry.credit });
  } catch (e) {
    if (tok !== E.tok) return;
    if (entry.kind === 'web') { E.state = 'stop'; E.cur = null; toast('Could not capture the web page\'s sound: ' + errText(e)); playingChanged(); pub(); return; }
    missing.add(keyOf(entry)); E.fails++;
    toast(`Couldn't play ${entry.title}. Skipping it.`);
    const n = E.fails < 8 && nextEntry(true);
    if (n) return transition(n, { out: 0, inn: o.inn, overlap: true });
    E.state = 'stop'; E.cur = null;
  }
  playingChanged(); pub();
}
function pause() {
  if (E.state !== 'play' || !E.cur || E.cur.pending) return;
  const tok = ++E.tok, c = E.cur, secs = S().pauseFade;
  fade(gainOf(c), 0, secs); E.state = 'pause';
  E.pauseT = setTimeout(() => { if (tok !== E.tok) return; if (c.kind === 'web') desk.webMedia(false); else c.d.el.pause(); }, secs * 1000 + 60);
  paint(); pub();
}
function resume() {
  if (E.state !== 'pause' || !E.cur) return;
  ++E.tok; clearTimeout(E.pauseT); const c = E.cur;
  if (ac.state !== 'running') ac.resume().catch(() => {});
  if (c.kind === 'web') desk.webMedia(true); else c.d.el.play().catch(() => {});
  fade(gainOf(c), 1, S().pauseFade); E.state = 'play'; paint(); pub();
}
// stop fades out; a second press while it fades (or anything else is still sounding) cuts it at once
function stop() {
  if (E.state === 'play' && E.cur && !E.cur.pending) {
    const tok = ++E.tok, secs = S().fadeOut; release(E.cur, secs); E.state = 'stopping';
    E.stopT = setTimeout(() => { if (tok !== E.tok) return; E.state = 'stop'; playingChanged(); pub(); logEvent('stop', 'Music stopped'); }, secs * 1000 + 120);
    paint(); pub(); return;
  }
  hardStop();
}
function hardStop() {
  const was = E.state !== 'stop' && E.cur && !E.cur.pending;
  ++E.tok; clearTimeout(E.stopT); clearTimeout(E.seqT); clearTimeout(E.pauseT);
  decks.forEach(deckStop);
  if (WEB.g) { fade(WEB.g, 0, 0); if (E.cur && E.cur.kind === 'web') desk.webMedia(false); }
  if (E.cur && E.cur.pending) E.cur = null;
  E.state = 'stop'; playingChanged(); pub();
  if (was) logEvent('stop', 'Music stopped');
}
function playPause() {
  if (E.state === 'play') pause();
  else if (E.state === 'pause') resume();
  else if (E.state === 'stopping' || E.state === 'changing') { if (E.cur && E.cur.item) transition(E.cur.item, { out: 0.3, inn: S().fadeIn, overlap: true }); }
  else if (LIB.queue.length) { const n = nextEntry(true); if (n) transition(n, startFade()); }
  else if (E.cur && E.cur.item) transition(E.cur.item, { out: 0, inn: S().fadeIn, overlap: true });
  else {
    const leaf = focusedLeaf('playlist'), pl = (leaf && plById(leaf.s.plId)) || LIB.playlists.find(p => p.items.length);
    if (!pl || !pl.items.length) { toast('Nothing to play yet: make a playlist, or add something to the queue.'); return; }
    const first = (sel.size && pl.items.find(i => sel.has(i.id))) || (S().shuffle ? pl.items[Math.floor(Math.random() * pl.items.length)] : pl.items[0]);
    playItem(pl, first);
  }
}
// play a track from a playlist: the playlist carries on after it (and after anything queued)
function playItem(pl, item) { setContext(pl, item.id); transition(item, startFade()); }
// play something right now, without changing what comes after it
function playNow(item) { stopPreview(); transition(item, startFade()); }
function seek(t) {
  const c = E.cur; if (!c || c.kind !== 'file' || c.pending) return;
  const d = c.d, g = d.g.gain.value;
  fade(d.g, 0, 0.12);
  setTimeout(() => { try { d.el.currentTime = t; } catch {} d.advanced = false; if (E.state === 'play') fade(d.g, 1, 0.25); else d.g.gain.setValueAtTime(g, ac.currentTime); }, 140);
}

/* ---------- what plays next: the queue first, then the playlist that was playing ---------- */
function setContext(pl, startId) {
  const ids = pl.items.map(i => i.id);
  let order = ids;
  if (S().shuffle) { order = shuffled(ids.filter(x => x !== startId)); if (startId) order.unshift(startId); }
  E.q = { plId: pl.id, order, lastId: startId };
}
function contextOrder() {
  const pl = E.q && plById(E.q.plId); if (!pl || !pl.items.length) return null;
  const ids = pl.items.map(i => i.id), set = new Set(ids);
  let order;
  if (S().shuffle) { order = E.q.order.filter(id => set.has(id)); order = order.concat(shuffled(ids.filter(id => !order.includes(id)))); }
  else order = ids;
  E.q.order = order;
  return { pl, order };
}
// keeps up with edits to the playlist; manual skips always wrap around, the end of the list only does with repeat all
function step(dir, manual) {
  const c = contextOrder(); if (!c) return null;
  let { pl, order } = c;
  let pos = order.indexOf(E.cur && E.cur.item ? E.cur.item.id : '');
  if (pos < 0) pos = order.indexOf(E.q.lastId);
  if (pos < 0) pos = dir > 0 ? -1 : order.length;
  for (let tries = 0; tries < order.length; tries++) {
    pos += dir;
    if (pos >= order.length) { if (!manual && S().loop === 'off') return null; if (S().shuffle) { const last = order[order.length - 1]; order = shuffled(order); if (order[0] === last && order.length > 1) order.push(order.shift()); E.q.order = order; } pos = 0; }
    if (pos < 0) pos = manual || S().loop === 'all' ? order.length - 1 : 0;
    const it = pl.items.find(i => i.id === order[pos]);
    if (it && !missing.has(keyOf(it))) { E.q.lastId = it.id; return it; }
  }
  return null;
}
// what plays next takes it off the queue: the queue shows only what's still to come
function nextEntry(manual) {
  while (LIB.queue.length) { const q = LIB.queue.shift(); save(); if (!missing.has(keyOf(q.item))) return q.item; }
  return step(1, manual);
}
function next() { const n = nextEntry(true); if (n) transition(n, startFade()); else toast('Nothing to play next.'); }
function prev() {
  const c = E.cur;
  if (c && c.kind === 'file' && !c.pending && c.d.el.currentTime > 4) { seek(0); return; }
  const n = step(-1, true); if (n) transition(n, startFade());
}
function onEnded(d) {
  if (!E.cur || E.cur.d !== d) return;
  if (d.handedOff) return;
  d.advanced = true;
  const n = nextEntry(false);
  if (n) transition(n, { out: 0, inn: S().fadeIn, overlap: true });
  else { E.state = 'stop'; d.item = null; playingChanged(); pub(); }
}
// with crossfade on, the next track starts while this one is still fading out
setInterval(() => {
  const c = E.cur;
  if (E.state !== 'play' || !c || c.kind !== 'file' || c.pending || c.d.advanced || !S().crossfade || S().loop === 'one') return;
  const el = c.d.el, dur = el.duration; if (!isFinite(dur) || dur < 3) return;
  const left = dur - el.currentTime, xf = Math.min(S().xfade, dur / 3);
  if (left > xf) return;
  c.d.advanced = true;
  const n = nextEntry(false);
  if (n) { c.d.handedOff = true; transition(n, { out: left, inn: Math.max(0.3, left), overlap: true }); }
}, 150);

/* ---------- the queue ---------- */
const queued = it => LIB.queue.some(q => keyOf(q.item) === keyOf(it));
const isPlaying = it => !!(E.cur && E.cur.item && keyOf(E.cur.item) && keyOf(E.cur.item) === keyOf(it) && E.state !== 'stop');
function enqueue(items, front) {
  const add = items.filter(it => keyOf(it) && !queued(it) && !isPlaying(it)).map(it => ({ qid: uid(), item: { ...clone(it), id: it.id || uid() } }));
  if (!add.length) { toast(items.length > 1 ? 'They\'re already in the queue.' : 'That\'s already in the queue.'); return 0; }
  if (front) LIB.queue.unshift(...add); else LIB.queue.push(...add);
  save(); queueChanged();
  toast(front ? `Plays next: ${add.length > 1 ? add.length + ' tracks' : add[0].item.title}.` : `Queued ${add.length > 1 ? add.length + ' tracks' : add[0].item.title}.`);
  return add.length;
}
function dequeue(qid) { LIB.queue = LIB.queue.filter(q => q.qid !== qid); save(); queueChanged(); }
function queueChanged() { renderQueue(); paintQueued(); renderMini(); }
// something started or stopped: the queue, the buttons and the now-playing marks follow
function playingChanged() { paint(); renderQueue(); paintQueued(); }

/* ---------- the web source: a browser window whose sound is captured ---------- */
async function webCapture() {
  const live = WEB.stream && WEB.stream.getAudioTracks().some(t => t.readyState === 'live');
  if (live) return;
  if (!WEB.state.open) throw new Error('open a web page first');
  const s = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: { suppressLocalAudioPlayback: true, echoCancellation: false, noiseSuppression: false, autoGainControl: false }, systemAudio: 'exclude' });
  const a = s.getAudioTracks(); s.getVideoTracks().forEach(t => t.stop());
  if (!a.length) throw new Error('the page gave no sound');
  if (WEB.src) try { WEB.src.disconnect(); } catch {}
  WEB.stream = s; WEB.src = ac.createMediaStreamSource(new MediaStream(a)); WEB.src.connect(WEB.g);
  a[0].addEventListener('ended', () => { if (E.cur && E.cur.kind === 'web') { toast('The web page stopped sending sound.'); } WEB.stream = null; });
}
function playWeb() {
  if (!WEB.state.open) { toast('Open a web page first.'); return; }
  transition({ kind: 'web', id: 'web', title: WEB.state.title || WEB.state.url || 'Web page', path: '' }, startFade());
}

/* ---------- sound pads: one-shots or loops over the music, which dips under them ---------- */
const padsPlaying = new Map(); // pad id -> { el, g, pad, stopping, stopT, done }
const PADSTOP = { until: 0, t: 0 };
let GI = {};
fetch('gameicons.json').then(r => r.json()).then(j => { GI = j; padsChanged(); }).catch(() => {});
// a picture from game-icons.net (CC BY 3.0), in the colour of the text around it
function gi(name, cls) {
  const e = document.createElement('span'); e.className = 'gi' + (cls ? ' ' + cls : '');
  const x = GI[name] || GI['musical-notes'];
  if (x) e.innerHTML = `<svg viewBox="0 0 512 512" aria-hidden="true"><path d="${x.d}" fill="currentColor"/></svg>`; else e.append(ico('note'));
  return e;
}
function playPad(pad) {
  if (!ac || !pad) return;
  if (ac.state !== 'running') ac.resume().catch(() => {});
  if (padsPlaying.has(pad.id)) { stopPad(pad.id, 0.35); return; }
  const el = new Audio(srcUrl(pad)), g = G(clamp(pad.vol ?? 1, 0, 1.5)); el.loop = !!pad.loop;
  ac.createMediaElementSource(el).connect(g).connect(padG);
  const P = { el, g, pad, stopping: false, stopT: 0 };
  P.done = () => { if (padsPlaying.get(pad.id) === P) { padsPlaying.delete(pad.id); clearTimeout(P.stopT); duckEnd(); padsChanged(); } setTimeout(() => { try { g.disconnect(); } catch {} }, 200); };
  padsPlaying.set(pad.id, P); duckStart(); padsChanged();
  el.onended = P.done; el.onerror = () => { toast(`Couldn't play ${pad.name}.`); P.done(); };
  el.play().catch(P.done);
  logEvent('pad', pad.name, { id: pad.id });
}
function stopPad(id, secs) {
  const P = padsPlaying.get(id); if (!P) return;
  clearTimeout(P.stopT);
  if (secs > 0.02) { fade(P.g, 0, secs); P.stopping = true; P.stopT = setTimeout(() => { P.el.pause(); P.done(); }, secs * 1000 + 60); padsChanged(); }
  else { P.el.pause(); P.done(); }
}
// one press fades every pad out; a second press while they fade stops them at once
function stopAllPads() {
  if (!padsPlaying.size) return;
  if (Date.now() < PADSTOP.until) { for (const id of [...padsPlaying.keys()]) stopPad(id, 0); PADSTOP.until = 0; padsChanged(); return; }
  const secs = Math.max(0.3, Math.min(S().fadeOut, 3));
  PADSTOP.until = Date.now() + secs * 1000;
  for (const id of [...padsPlaying.keys()]) stopPad(id, secs);
  clearTimeout(PADSTOP.t); PADSTOP.t = setTimeout(() => { PADSTOP.until = 0; padsChanged(); }, secs * 1000 + 100);
  padsChanged();
}
const stopPads = stopAllPads;
function duckStart() { if (S().duck < 1) fade(duckG, S().duck, 0.18); }
function duckEnd() { if (![...padsPlaying.values()].some(P => !P.stopping)) fade(duckG, 1, 0.9); }
function makePads(items) {
  for (const i of items) { const p = { id: uid(), name: String(i.title || 'Sound').slice(0, 30), path: i.path, url: i.url, credit: i.credit, vol: 1, loop: false, srcTags: (i.tags || i.srcTags || []).slice(0, 12) }; autoTag(p); LIB.pads.push(p); }
  save(); padsChanged();
  toast(items.length > 1 ? `Made ${items.length} sound pads.` : `${items[0].title} is a sound pad now.`);
}
// the pads changed: their window, the list under the queue and the mini player follow
function padsChanged() { renderPanels('pads'); renderPadsNow(); renderMini(); }
const paintPads = padsChanged;
setInterval(() => {
  for (const P of padsPlaying.values()) {
    const d = P.el.duration; if (!isFinite(d) || !d) continue;
    const w = Math.min(100, (P.el.currentTime / d) * 100) + '%';
    document.querySelectorAll(`[data-padprog="${CSS.escape(P.pad.id)}"]`).forEach(b => { b.style.width = w; });
  }
}, 200);

/* ---------- a pad's icon, group and tag, guessed from its name (and the tags it came with), no AI ---------- */
// [words, game-icon, group, tag]: the rule with the most matching words wins, the earlier one on a tie
const PAD_RULES = [
  [['fireball', 'fire spell', 'firebolt'], 'fireball', 'Magic', 'fireball'],
  [['sword', 'blade', 'sabre', 'saber', 'katana', 'scimitar', 'rapier', 'unsheath', 'sheath', 'clang', 'slash'], 'crossed-swords', 'Weapons', 'sword'],
  [['axe', 'hatchet', 'cleave'], 'battle-axe', 'Weapons', 'axe'],
  [['crossbow'], 'crossbow', 'Weapons', 'crossbow'],
  [['bow', 'arrow', 'archer', 'quiver', 'volley'], 'bow-arrow', 'Weapons', 'bow'],
  [['gun', 'pistol', 'rifle', 'gunshot', 'musket', 'revolver', 'shotgun', 'shot'], 'pistol-gun', 'Weapons', 'gun'],
  [['cannon', 'artillery', 'mortar'], 'cannon', 'Weapons', 'cannon'],
  [['spear', 'lance', 'pike', 'javelin'], 'spears', 'Weapons', 'spear'],
  [['shield', 'parry', 'deflect'], 'shield', 'Weapons', 'shield'],
  [['whip', 'lash'], 'whip', 'Weapons', 'whip'],
  [['battle', 'war', 'fight', 'combat', 'skirmish', 'clash', 'siege', 'army', 'soldiers'], 'sword-clash', 'Combat', 'battle'],
  [['punch', 'kick', 'hit', 'impact', 'brawl', 'slap', 'smack', 'thud'], 'punch', 'Combat', 'punch'],
  [['explosion', 'explode', 'blast', 'boom', 'bomb', 'detonate', 'grenade', 'kaboom'], 'explosion-rays', 'Combat', 'explosion'],
  [['wound', 'hurt', 'pain', 'stab', 'blood', 'gore', 'injury'], 'sword-wound', 'Combat', 'wound'],
  [['thunder', 'lightning', 'thunderstorm', 'storm'], 'lightning-storm', 'Weather', 'thunder'],
  [['rain', 'drizzle', 'downpour', 'raindrop', 'raindrops', 'rainy'], 'raining', 'Weather', 'rain'],
  [['tornado', 'hurricane', 'cyclone', 'twister'], 'tornado', 'Weather', 'tornado'],
  [['wind', 'gust', 'breeze', 'blizzard', 'windy', 'gale'], 'whirlwind', 'Weather', 'wind'],
  [['snow', 'frost', 'ice', 'icy', 'freeze', 'frozen', 'winter'], 'snowflake-1', 'Weather', 'snow'],
  [['fog', 'mist', 'misty', 'haze', 'foggy'], 'fog', 'Weather', 'fog'],
  [['sun', 'sunny', 'heat', 'desert', 'summer', 'dawn', 'morning'], 'sun', 'Weather', 'sun'],
  [['tavern', 'inn', 'pub', 'bar', 'alehouse', 'drinking', 'cheers', 'beer', 'ale', 'mead', 'feast'], 'beer-stein', 'Atmosphere', 'tavern'],
  [['forest', 'woods', 'woodland', 'jungle', 'grove', 'trees', 'leaves'], 'pine-tree', 'Atmosphere', 'forest'],
  [['cave', 'cavern', 'grotto', 'underground', 'mine', 'tunnel'], 'cave-entrance', 'Atmosphere', 'cave'],
  [['castle', 'keep', 'throne', 'fortress', 'dungeon', 'prison', 'cell', 'palace'], 'castle', 'Atmosphere', 'castle'],
  [['church', 'chapel', 'cathedral', 'temple', 'monastery', 'choir', 'hymn', 'shrine'], 'church', 'Atmosphere', 'temple'],
  [['market', 'city', 'town', 'street', 'village', 'bazaar', 'harbor', 'harbour', 'square'], 'meeple-group', 'Atmosphere', 'town'],
  [['ship', 'sail', 'sailing', 'boat', 'dock', 'pirate', 'deck', 'galleon'], 'galleon', 'Atmosphere', 'ship'],
  [['mountain', 'mountains', 'cliff', 'peak', 'canyon'], 'mountains', 'Atmosphere', 'mountain'],
  [['night', 'crickets', 'nocturnal', 'midnight', 'moon'], 'night-sky', 'Atmosphere', 'night'],
  [['ocean', 'sea', 'wave', 'waves', 'beach', 'shore', 'surf', 'tide', 'coast'], 'big-wave', 'Nature', 'sea'],
  [['waterfall', 'cascade'], 'waterfall', 'Nature', 'waterfall'],
  [['river', 'stream', 'creek', 'brook'], 'river', 'Nature', 'river'],
  [['water', 'drip', 'dripping', 'drop', 'splash', 'puddle', 'pour'], 'water-drop', 'Nature', 'water'],
  [['fire', 'flame', 'flames', 'burn', 'burning', 'torch', 'blaze', 'fireplace', 'hearth', 'campfire', 'crackling'], 'campfire', 'Nature', 'fire'],
  [['volcano', 'lava', 'magma', 'earthquake', 'rumble', 'quake'], 'volcano', 'Nature', 'volcano'],
  [['dragon', 'wyvern', 'drake'], 'dragon-head', 'Creatures', 'dragon'],
  [['wolf', 'wolves', 'howl', 'howling', 'hound', 'dog', 'bark', 'barking'], 'wolf-howl', 'Creatures', 'wolf'],
  [['horse', 'hoof', 'hooves', 'gallop', 'galloping', 'neigh', 'cavalry', 'carriage', 'cart', 'wagon'], 'horse-head', 'Creatures', 'horse'],
  [['raven', 'crow', 'caw'], 'crow-dive', 'Creatures', 'crow'],
  [['owl', 'hoot'], 'owl', 'Creatures', 'owl'],
  [['eagle', 'hawk', 'falcon', 'screech'], 'eagle-head', 'Creatures', 'eagle'],
  [['bird', 'birds', 'chirp', 'chirping', 'tweet', 'birdsong', 'seagull', 'gull', 'songbird'], 'swallow', 'Creatures', 'birds'],
  [['cat', 'meow', 'purr'], 'cat', 'Creatures', 'cat'],
  [['frog', 'toad', 'croak', 'swamp', 'marsh', 'bog'], 'frog', 'Creatures', 'frog'],
  [['bee', 'bees', 'buzz', 'buzzing', 'insect', 'insects', 'fly', 'flies', 'mosquito', 'swarm'], 'bee', 'Creatures', 'insects'],
  [['snake', 'hiss', 'serpent', 'viper', 'cobra'], 'snake', 'Creatures', 'snake'],
  [['rat', 'rats', 'mouse', 'mice', 'squeak', 'rodent'], 'rat', 'Creatures', 'rat'],
  [['bear', 'grizzly'], 'bear-head', 'Creatures', 'bear'],
  [['spider', 'spiders', 'arachnid'], 'spider-web', 'Creatures', 'spider'],
  [['monster', 'creature', 'beast', 'troll', 'ogre', 'orc', 'goblin', 'growl', 'snarl'], 'monster-grasp', 'Creatures', 'monster'],
  [['roar', 'lion', 'tiger'], 'lion', 'Creatures', 'roar'],
  [['ghost', 'spirit', 'phantom', 'haunt', 'haunted', 'wraith', 'poltergeist', 'spooky', 'eerie', 'whisper'], 'ghost', 'Horror', 'ghost'],
  [['zombie', 'undead', 'skeleton', 'bones', 'lich', 'necro'], 'skull', 'Horror', 'undead'],
  [['vampire', 'bat', 'bats'], 'vampire-dracula', 'Horror', 'vampire'],
  [['witch', 'cackle', 'hag', 'coven'], 'witch-face', 'Horror', 'witch'],
  [['graveyard', 'cemetery', 'tomb', 'crypt', 'grave', 'funeral'], 'tombstone', 'Horror', 'graveyard'],
  [['scream', 'screaming', 'shriek', 'horror', 'terror', 'scary', 'creepy'], 'screaming', 'Horror', 'scream'],
  [['heart', 'heartbeat', 'pulse'], 'heart-beats', 'People', 'heartbeat'],
  [['shout', 'yell', 'warcry', 'battlecry', 'cry', 'laugh', 'laughing', 'giggle', 'chuckle'], 'shouting', 'People', 'voices'],
  [['footstep', 'footsteps', 'steps', 'walk', 'walking', 'running', 'sneak', 'sneaking', 'march', 'marching'], 'footprint', 'People', 'footsteps'],
  [['crowd', 'cheer', 'cheering', 'applause', 'clap', 'audience', 'chatter', 'murmur', 'talking', 'conversation', 'people'], 'meeple-group', 'People', 'crowd'],
  [['door', 'doors', 'gate', 'creak', 'creaking', 'knock', 'knocking', 'hinge', 'slam'], 'wooden-door', 'Objects', 'door'],
  [['key', 'keys', 'lock', 'unlock', 'latch', 'padlock'], 'key', 'Objects', 'lock'],
  [['glass', 'shatter', 'shattering', 'smash', 'bottle', 'window', 'break', 'breaking'], 'shattered-glass', 'Objects', 'glass'],
  [['coin', 'coins', 'gold', 'money', 'treasure', 'loot', 'purse', 'jingle'], 'coins', 'Objects', 'coins'],
  [['chest', 'box', 'crate', 'barrel', 'lid'], 'open-treasure-chest', 'Objects', 'chest'],
  [['book', 'books', 'page', 'pages', 'paper', 'scroll', 'quill', 'writing', 'letter', 'map'], 'open-book', 'Objects', 'book'],
  [['bell', 'bells', 'chime', 'chimes', 'ring', 'ringing', 'gong', 'toll'], 'ringing-bell', 'Objects', 'bell'],
  [['clock', 'tick', 'ticking', 'tock', 'timer', 'hourglass', 'countdown'], 'hourglass', 'Objects', 'clock'],
  [['chain', 'chains', 'shackle', 'shackles', 'manacle'], 'crossed-chains', 'Objects', 'chains'],
  [['hammer', 'anvil', 'forge', 'smith', 'blacksmith', 'metal', 'clank'], 'anvil', 'Objects', 'forge'],
  [['candle', 'candles'], 'candle-light', 'Objects', 'candle'],
  [['dice', 'die', 'roll', 'rolling'], 'rolling-dices', 'Objects', 'dice'],
  [['potion', 'bubble', 'bubbling', 'brew', 'cauldron', 'alchemy', 'flask', 'gulp', 'drink'], 'bubbling-flask', 'Magic', 'potion'],
  [['portal', 'teleport', 'warp', 'rift', 'vortex'], 'magic-portal', 'Magic', 'portal'],
  [['heal', 'healing', 'holy', 'divine', 'blessing', 'angel', 'angelic', 'prayer'], 'sparkles', 'Magic', 'holy'],
  [['crystal', 'orb', 'scry', 'oracle', 'prophecy'], 'crystal-ball', 'Magic', 'crystal'],
  [['wand', 'staff', 'wizard', 'sorcerer', 'mage', 'warlock'], 'wizard-staff', 'Magic', 'wizard'],
  [['magic', 'magical', 'spell', 'cast', 'casting', 'arcane', 'enchant', 'enchanted', 'sorcery', 'mystic', 'sparkle', 'shimmer', 'fairy'], 'magic-swirl', 'Magic', 'spell'],
  [['drum', 'drums', 'percussion', 'drumming', 'drumroll'], 'drum', 'Music', 'drums'],
  [['horn', 'trumpet', 'fanfare', 'bugle'], 'hunting-horn', 'Music', 'horn'],
  [['bagpipe', 'bagpipes'], 'bagpipes', 'Music', 'bagpipes'],
  [['violin', 'fiddle', 'cello', 'strings'], 'violin', 'Music', 'strings'],
  [['flute', 'whistle', 'ocarina', 'recorder', 'panpipe'], 'flute', 'Music', 'flute'],
  [['lute', 'lyre', 'harp', 'bard', 'guitar', 'mandolin'], 'lyre', 'Music', 'lute'],
  [['music', 'song', 'melody', 'tune', 'theme', 'soundtrack', 'ost', 'ballad'], 'musical-notes', 'Music', 'song'],
  [['robot', 'android', 'droid', 'mech', 'cyborg'], 'robot-golem', 'Sci-fi', 'robot'],
  [['laser', 'blaster', 'phaser', 'plasma'], 'laser-blast', 'Sci-fi', 'laser'],
  [['spaceship', 'starship', 'rocket', 'thruster', 'space', 'shuttle'], 'rocket', 'Sci-fi', 'spaceship'],
  [['alien', 'aliens', 'ufo'], 'ufo', 'Sci-fi', 'alien'],
  [['gear', 'gears', 'cog', 'machine', 'machinery', 'mechanism', 'clockwork', 'steam', 'engine', 'factory', 'piston'], 'gears', 'Machines', 'machine'],
  [['alarm', 'siren', 'alert', 'beep', 'computer', 'radio', 'static'], 'radio-tower', 'Machines', 'alarm']
];
const PAD_GROUPS = ['Atmosphere', 'Weather', 'Nature', 'Weapons', 'Combat', 'Creatures', 'People', 'Magic', 'Objects', 'Music', 'Horror', 'Sci-fi', 'Machines'];
const padWords = s => String(s || '').toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/[\s_-]+/).filter(Boolean);
const wordHit = (toks, w) => toks.some(t => t === w || t === w + 's' || t === w + 'es' || (w.length >= 5 && t.startsWith(w)));
function guessPad(text) {
  text = String(text || '').toLowerCase(); if (!text.trim()) return null;
  const toks = padWords(text); let best = null, bestN = 0;
  for (const r of PAD_RULES) { const n = r[0].filter(w => (w.includes(' ') ? text.includes(w) : wordHit(toks, w))).length; if (n > bestN) { best = r; bestN = n; } }
  return best ? { icon: best[1], group: best[2], tag: best[3] } : null;
}
// the name decides first; the tags a sound came with (Tabletop Audio, Freesound) only when the name says nothing
function autoTag(p, force) {
  const g = guessPad(p.name) || guessPad((p.srcTags || []).join(' '));
  if (force || !p.iconSet) p.icon = g ? g.icon : 'musical-notes';
  if (force || !p.tagSet) { p.group = g ? g.group : ''; p.tag = g ? g.tag : ''; }
}
const TAG_COLORS = ['#e5484d', '#ff7a1a', '#d4a64a', '#a3e635', '#22c55e', '#14b8a6', '#4cc9f0', '#3b82f6', '#8b5cf6', '#d946ef', '#ec4899', '#94a3b8'];
const hashStr = x => { let n = 0; for (const c of String(x)) n = (n * 31 + c.charCodeAt(0)) >>> 0; return n; };
const tagColor = t => (t ? (LIB.tagColors && LIB.tagColors[t]) || TAG_COLORS[hashStr(t) % TAG_COLORS.length] : '');
// a group's picture: the game icon of its first keyword rule
const groupIcon = g => { const r = PAD_RULES.find(x => x[2] === g); return r ? r[1] : 'musical-notes'; };
const padGroups = () => [...new Set([...PAD_GROUPS, ...LIB.pads.map(p => p.group).filter(Boolean)])];
const padTags = () => [...new Set(LIB.pads.map(p => p.tag).filter(Boolean))].sort();

/* ---------- a custom impulse response for the convolution space ---------- */
let IR = null; // { id, rate, parts: [b64...], name }
async function loadIR(path) {
  try {
    const buf = await (await fetch(mediaUrl(path))).arrayBuffer();
    const dec = await ac.decodeAudioData(buf);
    const rate = 22050, secs = Math.min(4, dec.duration), off = new OfflineAudioContext(1, Math.ceil(secs * rate), rate);
    const s = off.createBufferSource(); s.buffer = dec; s.connect(off.destination); s.start();
    const r = (await off.startRendering()).getChannelData(0);
    let pk = 0; for (const v of r) pk = Math.max(pk, Math.abs(v));
    const n = r.length, b = new Uint8Array(n * 2), tail = Math.floor(n * 0.95);
    for (let i = 0; i < n; i++) { let v = r[i] / (pk || 1) * (i > tail ? (n - i) / (n - tail) : 1); v = Math.round(clamp(v, -1, 1) * 32767); if (v < 0) v += 65536; b[2 * i] = v & 255; b[2 * i + 1] = v >> 8; }
    let bin = ''; for (let i = 0; i < b.length; i += 8192) bin += String.fromCharCode.apply(null, b.subarray(i, i + 8192));
    const b64 = btoa(bin), parts = []; for (let i = 0; i < b64.length; i += 36000) parts.push(b64.slice(i, i + 36000));
    IR = { id: 'ir' + uid(), rate, parts, name: base(path) };
    monFx.setCustomIR(mfxIrDecode(ac, rate, b64));
    S().irPath = path; save(); pub(); renderPanels('effects');
    return true;
  } catch (e) { console.warn('impulse response', e); toast('That file couldn\'t be read as an impulse response. Use a short WAV recording of a space.'); return false; }
}

/* ============================== the table: Homebase, the room, WebRTC ============================== */
const NET = { db: null, room: null, code: '', key: '', sid: uid(), on: false, peers: [], L: new Map(), offs: [], M: null, keyState: 'none', otherDj: false };
async function sha256hex(s) { const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)); return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join(''); }
async function connect() {
  const { code, key } = parseMusicCode($('#mcode').value);
  if (!code) { $('#mcode').focus(); return; }
  $('#mcode').value = showCode(code, key);
  if (!window.claude) { hint('Choose a Homebase first: the same one your table uses.', 'warn'); if (window.CRITTER_DESKTOP) window.CRITTER_DESKTOP.changeHomebase(); return; }
  await disconnect(true);
  $('#connBtn').disabled = true; chip('Connecting…');
  try {
    const db = await window.claude.use('db'), rc = await window.claude.use('room');
    const lob = await Promise.race([db.doc('lobbies/' + code).get(), sleep(12000).then(() => { throw new Error('timeout'); })]);
    if (!lob.exists) { chip('Not connected'); hint(`No lobby uses the code ${code} on this Homebase. Check the code, and that this app uses the same Homebase as the table.`, 'bad'); return; }
    Object.assign(NET, { db, code, key, on: true });
    S().lobby = code; S().key = key; save();
    NET.offs.push(db.doc(`lobbies/${code}/state/music`).onSnapshot(s => { NET.M = s.exists ? s.data() || {} : {}; checkKey(); }, () => {}));
    const room = NET.room = await rc.join('lobby-' + code.toLowerCase());
    NET.offs.push(room.on('music-live', onLive), room.onPeers(ch => onPeers(ch.peers)), room.onConnection(() => paintConn()));
    // a new room has never heard this app: send what it plays even if nothing changed since the last connection
    pubLast = ''; pub(true); onPeers(room.peers()); sessionOnConnect();
    setLabel($('#connBtn'), '🔗 Disconnect'); paintConn();
  } catch (e) { chip('Not connected', 'bad'); hint('Could not reach Homebase. Check your connection and the Homebase setting.', 'bad'); }
  finally { $('#connBtn').disabled = false; }
}
async function disconnect(quiet) {
  for (const l of NET.L.values()) try { l.pc.close(); } catch {}
  NET.L.clear();
  NET.offs.forEach(o => { try { o(); } catch {} }); NET.offs = [];
  if (NET.room) await NET.room.leave().catch(() => {});
  Object.assign(NET, { room: null, on: false, peers: [], M: null, keyState: 'none' });
  setLabel($('#connBtn'), '🔗 Connect'); if (!quiet) { chip('Not connected'); hint(''); }
}
async function checkKey() {
  const lk = NET.M && NET.M.lk;
  NET.keyState = !NET.key ? 'none' : !lk ? 'off' : (await sha256hex(NET.key)) === lk ? 'ok' : 'bad';
  paintConn();
}
// what the table sees of this app: it is a music source, what it plays, and the effects to apply
let pubT = 0, pubLast = '';
function pub(now) {
  if (!NET.room) return;
  clearTimeout(pubT);
  const go = () => {
    const c = E.cur, mst = E.state === 'play' || E.state === 'stopping' || E.state === 'changing' ? 'play' : E.state === 'pause' ? 'pause' : 'stop';
    // a soundscape on its own counts as playing too
    const scape = SC.run ? 'Soundscape: ' + ((scById(SC.active) || {}).name || 'Untitled') : '', st = mst === 'stop' && scape ? 'play' : mst;
    const p = { dj: 1, sid: NET.sid, n: S().name || 'Critter Sounds', t: c && c.item && mst !== 'stop' ? c.item.title : scape || (c && c.item ? c.item.title : ''), cr: c && c.item && c.item.credit ? String(c.item.credit).slice(0, 300) : '', st, fx: S().fx, ir: IR ? IR.id : null };
    const sig = JSON.stringify(p); if (sig === pubLast) return; pubLast = sig;
    NET.room.presence(p).catch(() => {});
  };
  if (now) go(); else pubT = setTimeout(go, 120);
}
function onPeers(peers) {
  NET.peers = peers;
  const here = new Set(peers.map(p => p.peer));
  for (const [peer, l] of NET.L) if (!here.has(peer)) { try { l.pc.close(); } catch {} NET.L.delete(peer); }
  NET.otherDj = peers.some(p => !p.sameTab && p.presence && p.presence.dj);
  paintConn();
}
async function onLive(msg) {
  const d = msg && msg.data, me = NET.peers.find(p => p.sameTab);
  if (!d || !me || d.to !== me.peer || msg.sameTab) return;
  const peer = msg.peer;
  if (d.k === 'hello') offerTo(peer);
  else if (d.k === 'answer' && typeof d.sdp === 'string') { const l = NET.L.get(peer); if (l) l.pc.setRemoteDescription({ type: 'answer', sdp: d.sdp }).catch(e => console.warn(e)); }
  else if (d.k === 'deny') { const l = NET.L.get(peer); if (l) { l.denied = d.why || 'key'; try { l.pc.close(); } catch {} } paintConn(); }
  else if (d.k === 'irreq' && IR) for (let i = 0; i < IR.parts.length; i++) await NET.room.emit('music-live', { k: 'ir', to: peer, id: IR.id, i, n: IR.parts.length, rate: IR.rate, b64: IR.parts[i] }).catch(() => {});
}
async function offerTo(peer) {
  const old = NET.L.get(peer); if (old) try { old.pc.close(); } catch {}
  const pc = new RTCPeerConnection(MFX_RTC), l = { pc, denied: false };
  NET.L.set(peer, l);
  pc.onconnectionstatechange = () => paintConn();
  const tr = dest.stream.getAudioTracks()[0];
  const sender = pc.addTrack(tr, dest.stream);
  try {
    const prm = sender.getParameters(); prm.encodings = prm.encodings && prm.encodings.length ? prm.encodings : [{}];
    prm.encodings[0].maxBitrate = 256000; prm.encodings[0].priority = 'high'; prm.encodings[0].networkPriority = 'high';
    await sender.setParameters(prm);
  } catch {}
  try {
    await pc.setLocalDescription(await pc.createOffer());
    await mfxIceDone(pc);
    if (NET.L.get(peer) !== l || !NET.room) return;
    await NET.room.emit('music-live', { k: 'offer', to: peer, sdp: mfxOpus(pc.localDescription.sdp), key: NET.key });
  } catch (e) { console.warn('offer', e); }
  paintConn();
}

/* ============================== online libraries: free music and sound effects ============================== */
// Each result is { id, title, url, dur, credit, license, source, by, link, ... }. It can be previewed here only,
// played now, queued, added to any playlist or made a sound pad, alone or several at once.
const ONLINE = {
  tabletop: null, incompetech: null, err: {}, busy: '',
  q: { tabletop: '', incompetech: '', openverse: '', freesound: '' }, tag: { tabletop: '', tabletopKind: '', incompetech: '' },
  ov: { kind: 'music', lic: '', len: '', page: 1, res: null, total: 0 }, fs: { len: '', page: 1, res: null, total: 0 },
  shown: { tabletop: 60, incompetech: 80 }, preview: null, previewId: '', picked: new Map(), seen: new Map()
};
const SOURCES = [
  ['tabletop', 'Tabletop Audio', '10-minute ambiences and music made for games'],
  ['incompetech', 'Incompetech', 'Kevin MacLeod\'s music, for any mood'],
  ['openverse', 'Openverse', 'Freesound effects, Jamendo and ccMixter music, and more'],
  ['freesound', 'Freesound', 'Sound effects, with your free API key']
];
const ccLabel = (lic, ver) => { lic = String(lic || '').toLowerCase(); return lic === 'cc0' ? 'CC0' : lic === 'pdm' ? 'Public domain' : lic ? `CC ${lic.toUpperCase()}${ver ? ' ' + ver : ''}` : ''; };
const decode = s => { const t = document.createElement('textarea'); t.innerHTML = String(s || ''); return t.value; };
async function loadCatalog(name, fresh) {
  if (ONLINE[name] && !fresh) return;
  ONLINE.busy = name;
  try { ONLINE[name] = await desk.catalog(name, !!fresh); ONLINE.err[name] = ''; }
  catch (e) { ONLINE.err[name] = errText(e); }
  ONLINE.busy = ''; renderPanels('online');
}
const ttaResult = t => ({ id: t.id, title: t.title, url: t.url, dur: 0, by: 'Tabletop Audio', source: 'Tabletop Audio', license: 'CC BY-NC-ND 4.0', link: 'https://tabletopaudio.com/', img: t.img, desc: t.desc, tags: t.tags, kind: t.kind, credit: `"${t.title}" by Tim Card, Tabletop Audio (tabletopaudio.com), CC BY-NC-ND 4.0` });
const incResult = p => ({ id: p.id, title: p.title, url: p.url, dur: p.dur, by: 'Kevin MacLeod', source: 'Incompetech', license: 'CC BY 4.0', link: 'https://incompetech.com/music/royalty-free/music.html', desc: [p.feel.join(', '), p.instruments, p.bpm ? p.bpm + ' bpm' : ''].filter(Boolean).join(' · '), credit: `"${p.title}" Kevin MacLeod (incompetech.com), licensed under Creative Commons: By Attribution 4.0 License` });
async function searchOpenverse(page) {
  const o = ONLINE.ov, q = ONLINE.q.openverse.trim(); if (!q) return;
  o.page = page || 1; ONLINE.busy = 'openverse'; renderPanels('online');
  const p = new URLSearchParams({ q, page_size: '20', page: String(o.page) });
  if (o.kind === 'music') p.set('category', 'music'); else if (o.kind === 'sfx') p.set('source', 'freesound,wikimedia_audio');
  if (o.lic) p.set('license_type', o.lic); if (o.len) p.set('length', o.len);
  try {
    const r = await desk.webGet('https://api.openverse.org/v1/audio/?' + p);
    if (r.status === 429) throw new Error('Openverse allows 20 searches a minute and 200 a day without an account. Wait a little and try again.');
    if (r.status !== 200) throw new Error('Openverse answered ' + r.status + '.');
    const j = JSON.parse(r.text);
    o.total = j.result_count || 0;
    o.res = (j.results || []).filter(x => x.url).map(x => ({ id: 'ov' + x.id, title: decode(x.title) || 'Untitled', url: x.url, dur: (x.duration || 0) / 1000, by: decode(x.creator) || 'unknown', source: { freesound: 'Freesound', jamendo: 'Jamendo', wikimedia_audio: 'Wikimedia Commons', ccmixter: 'ccMixter' }[x.source] || x.source || 'Openverse', license: ccLabel(x.license, x.license_version), link: x.foreign_landing_url, credit: decode(x.attribution) || `"${decode(x.title)}" by ${decode(x.creator)}, ${ccLabel(x.license, x.license_version)}` }));
    ONLINE.err.openverse = '';
  } catch (e) { ONLINE.err.openverse = errText(e); }
  ONLINE.busy = ''; renderPanels('online');
}
async function searchFreesound(page) {
  const o = ONLINE.fs, q = ONLINE.q.freesound.trim(), key = (S().fsKey || '').trim(); if (!q || !key) return;
  o.page = page || 1; ONLINE.busy = 'freesound'; renderPanels('online');
  const len = { short: 'duration:[0 TO 5]', medium: 'duration:[5 TO 30]', long: 'duration:[30 TO 600]', loop: 'tag:loop' }[o.len];
  const p = new URLSearchParams({ query: q, page: String(o.page), page_size: '30', sort: 'score', fields: 'id,name,username,license,duration,previews,url,tags' });
  if (len) p.set('filter', len);
  try {
    let r = await desk.webGet('https://freesound.org/apiv2/search/text/?' + p, { Authorization: 'Token ' + key });
    if (r.status === 404) r = await desk.webGet('https://freesound.org/apiv2/search/?' + p, { Authorization: 'Token ' + key });
    if (r.status === 401) throw new Error('Freesound didn\'t accept that API key. Check it on freesound.org.');
    if (r.status === 429) throw new Error('Freesound\'s daily limit for this key is used up. Try again tomorrow.');
    if (r.status !== 200) throw new Error('Freesound answered ' + r.status + '.');
    const j = JSON.parse(r.text);
    const lic = u => { const m = /licenses\/([a-z-]+)\/([\d.]+)/i.exec(u || ''); return /zero|publicdomain/i.test(u || '') ? 'CC0' : m ? ccLabel(m[1], m[2]) : ''; };
    o.total = j.count || 0;
    o.res = (j.results || []).map(x => ({ id: 'fs' + x.id, tags: Array.isArray(x.tags) ? x.tags.slice(0, 12) : [], title: x.name, url: (x.previews || {})['preview-hq-mp3'], dur: x.duration || 0, by: x.username, source: 'Freesound', license: lic(x.license), link: x.url || `https://freesound.org/s/${x.id}/`, credit: `"${x.name}" by ${x.username} (freesound.org/s/${x.id}), ${lic(x.license)}` })).filter(x => x.url);
    ONLINE.err.freesound = '';
  } catch (e) { ONLINE.err.freesound = errText(e); }
  ONLINE.busy = ''; renderPanels('online');
}
// a result as a track: it keeps its credit and license wherever it goes
const itemOf = r => ({ id: uid(), url: r.url, title: r.title, img: r.img || r.thumb || undefined, dur: r.dur || 0, credit: r.credit, license: r.license, source: r.source, link: r.link, tags: Array.isArray(r.tags) ? r.tags.slice(0, 12) : undefined });
async function saveOnline(r) {
  if (!r.url) return;
  toast(`Saving ${r.title}…`);
  try {
    const file = await desk.download({ url: r.url, source: r.source, title: r.title, credit: r.credit });
    for (const pl of LIB.playlists) for (const i of pl.items) if (i.url === r.url) i.path = file;
    for (const p of LIB.pads) if (p.url === r.url) p.path = file;
    for (const q of LIB.queue) if (q.item.url === r.url) q.item.path = file;
    save(); renderPanels('playlist', 'online'); toast(`Saved to ${file}. It plays from there now, even offline.`);
  } catch (e) { toast('Saving failed: ' + errText(e)); }
}
// listen first, on this computer only: the table doesn't hear previews
function preview(r) {
  if (ONLINE.previewId === r.id) { stopPreview(); return; }
  stopPreview();
  const a = new Audio(remoteUrl(r.url)); a.volume = clamp(S().prevVol, 0, 1);
  if (S().sink && a.setSinkId) a.setSinkId(S().sink).catch(() => {});
  a.onended = stopPreview; a.onerror = () => { toast('That one won\'t play.'); stopPreview(); };
  a.play().catch(() => {});
  ONLINE.preview = a; ONLINE.previewId = r.id; paintPreview();
}
function stopPreview() { if (ONLINE.preview) { ONLINE.preview.pause(); ONLINE.preview.removeAttribute('src'); } ONLINE.preview = null; ONLINE.previewId = ''; paintPreview(); }
function paintPreview() {
  document.querySelectorAll('[data-prev]').forEach(b => {
    const on = b.dataset.prev === ONLINE.previewId;
    b.replaceChildren(ico(on ? 'stop' : 'headphones'), h('span', { text: on ? 'Stop' : 'Preview' }));
    b.title = on ? 'Stop the preview' : 'Listen on this computer only: the table doesn\'t hear it';
    b.classList.toggle('on', on);
  });
}
// the queue buttons say what's going on: queued, playing, or ready to add again once it has played
function paintQueued() {
  document.querySelectorAll('[data-qurl]').forEach(b => {
    const it = { url: b.dataset.qurl }, playing = isPlaying(it), inq = !playing && queued(it);
    setLabel(b, playing ? '♪ Playing' : inq ? '✓ Queued' : '+ Queue');
    b.disabled = playing || inq; b.classList.toggle('done', playing || inq);
  });
}
function pickedItems() { return [...ONLINE.picked.values()]; }
function paintPicked() {
  document.querySelectorAll('[data-pick]').forEach(cb => { cb.checked = ONLINE.picked.has(cb.dataset.pick); cb.closest('.res,.tcard')?.classList.toggle('picked', cb.checked); });
  document.querySelectorAll('.bulk').forEach(b => {
    const n = ONLINE.picked.size; b.hidden = !n;
    const c = b.querySelector('.bn'); if (c) c.textContent = `${n} selected`;
  });
}
function togglePick(r, on) { if (on) ONLINE.picked.set(r.id, r); else ONLINE.picked.delete(r.id); paintPicked(); }
function bulkBar() {
  const n = ONLINE.picked.size, items = () => pickedItems().map(itemOf);
  const bar = h('div', { class: 'bulk', hidden: !n },
    h('b', { class: 'bn', text: `${n} selected` }),
    h('button', { type: 'button', class: 'btn tiny primary', text: '+ Queue them', onclick: () => { enqueue(items()); clearPicked(); } }),
    h('button', { type: 'button', class: 'btn tiny', text: 'Add to playlist ▾', onclick: e => choosePlaylist(e.currentTarget, pl => { copyInto(pl, items()); clearPicked(); }) }),
    h('button', { type: 'button', class: 'btn tiny', text: 'Make sound pads', onclick: () => { makePads(items()); clearPicked(); } }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '⭳ Save them', onclick: () => { pickedItems().forEach(saveOnline); clearPicked(); } }),
    h('span', { class: 'grow' }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '✕ Clear', onclick: clearPicked }));
  return bar;
}
function clearPicked() { ONLINE.picked.clear(); paintPicked(); }

/* ============================== the canvas: windows that split, resize and dock ============================== */
// The layout is a tree: a split holds two parts side by side ('row') or one above the other ('col') at ratio r;
// a leaf is one window showing one panel. Splitting a window halves it; dragging a divider resizes, snapping to
// thirds and quarters; dragging a window's title onto another window docks it at that edge, or swaps the two.
const L = (p, s) => ({ t: 'leaf', id: uid(), p, s: s || {} });
const SP = (dir, r, a, b) => ({ t: 'split', id: uid(), dir, r, a, b });
const PANELS = {
  playlists: { name: 'Playlists', icon: 'list', desc: 'Your playlists: make one from a music folder', render: panelPlaylists },
  playlist: { name: 'Playlist', icon: 'music', desc: 'The tracks in a playlist: play, queue, sort', render: panelPlaylist },
  online: { name: 'Online library', icon: 'globe', desc: 'Free music and sound effects to search and play', render: panelOnline },
  youtube: { name: 'YouTube', icon: 'youtube', desc: 'Find sound on YouTube, listen, and save it', render: panelYouTube },
  web: { name: 'Web source', icon: 'web', desc: 'Play the sound of any web page to the table', render: panelWeb },
  pads: { name: 'Sound pads', icon: 'pads', desc: 'Buttons for sound effects: one click plays', render: panelPads },
  scapes: { name: 'Soundscapes', icon: 'sparkle', desc: 'Living backgrounds made of layers of sound', render: panelScapes },
  scenes: { name: 'Scenes', icon: 'clapper', desc: 'Jump to a playlist with its effects in one click', render: panelScenes },
  effects: { name: 'Effects', icon: 'sliders', desc: 'Reverb, radio, muffle and more, for everyone', render: panelEffects },
  fades: { name: 'Fades', icon: 'wave', desc: 'How songs fade in, out and into each other', render: panelFades },
  bots: { name: 'Discord & Fluxer', icon: 'headphones', desc: 'Play into a voice channel with your own bot', render: panelBots },
  log: { name: 'Session log', icon: 'clock', desc: 'What played when, also in Critter VTT\'s chat', render: panelLog },
  help: { name: 'Help', icon: 'help', desc: 'Shortcuts, tips and thanks', render: panelHelp },
  pick: { name: 'New window', icon: 'plus', render: panelPick, hidden: true }
};
// layouts by what you're doing: during a game, or preparing for one (onb: offered in setup)
const PRESETS = [
  { name: 'Run a game', group: 'play', onb: 1, desc: 'Music, sound pads, soundscapes, scenes and effects: everything for a session', make: () => SP('row', 0.18, L('playlists'), SP('row', 0.58, SP('col', 0.56, L('playlist'), L('pads')), SP('col', 0.45, L('scapes'), SP('col', 0.5, L('scenes'), L('effects'))))) },
  { name: 'Simple player', group: 'play', onb: 1, desc: 'Your playlists beside their tracks', make: () => SP('row', 0.25, L('playlists'), L('playlist')) },
  { name: 'Voice chat game', group: 'play', onb: 1, desc: 'Playing to Discord or Fluxer: the bot, your tracks and pads', make: () => SP('row', 0.36, L('bots'), SP('col', 0.58, L('playlist'), L('pads'))) },
  { name: 'Ambience', group: 'play', desc: 'Soundscapes and sound pads, with effects', make: () => SP('row', 0.55, L('scapes'), SP('col', 0.6, L('pads'), L('effects'))) },
  { name: 'Web pages and scenes', group: 'play', desc: 'Sound from web pages, scenes, pads and effects', make: () => SP('row', 0.5, SP('col', 0.5, L('web'), L('scenes')), SP('col', 0.5, L('pads'), L('effects'))) },
  { name: 'Focus', group: 'play', desc: 'One track list, nothing else', make: () => L('playlist') },
  { name: 'Build playlists', group: 'prep', onb: 1, desc: 'Find music online and on YouTube, and sort it into playlists', make: () => SP('row', 0.2, L('playlists'), SP('row', 0.56, SP('col', 0.6, L('online'), L('youtube')), L('playlist'))) },
  { name: 'Make sound pads', group: 'prep', desc: 'Search free sound effects and turn them into pads', make: () => SP('row', 0.56, L('online'), L('pads')) },
  { name: 'Build soundscapes', group: 'prep', desc: 'Your soundscapes, with pads to borrow sounds from', make: () => SP('row', 0.6, L('scapes'), L('pads')) }
];
const PRESET_GROUPS = [['play', 'During a game'], ['prep', 'Preparing']];
const validTree = n => !!n && (n.t === 'leaf' ? !!PANELS[n.p] : n.t === 'split' && (n.dir === 'row' || n.dir === 'col') && validTree(n.a) && validTree(n.b));
const leaves = (n = LIB.layout, out = []) => { if (!n) return out; if (n.t === 'leaf') out.push(n); else { leaves(n.a, out); leaves(n.b, out); } return out; };
function parentOf(id, n = LIB.layout, p = null) { if (!n) return null; if (n.id === id) return { node: n, parent: p }; if (n.t === 'split') return parentOf(id, n.a, n) || parentOf(id, n.b, n); return null; }
function replaceNode(oldN, newN) {
  const f = parentOf(oldN.id); if (!f) return;
  if (!f.parent) LIB.layout = newN; else if (f.parent.a === oldN) f.parent.a = newN; else f.parent.b = newN;
}
let focusId = '';
function focusedLeaf(kind) {
  const all = leaves(), f = all.find(l => l.id === focusId);
  if (f && (!kind || f.p === kind)) return f;
  return kind ? all.filter(l => l.p === kind).sort((a, b) => (b.s.at || 0) - (a.s.at || 0))[0] || null : null;
}
function touch(leaf) { focusId = leaf.id; leaf.s.at = Date.now(); }
function splitLeaf(leaf, dir, panel, s, before) {
  const nl = L(panel || 'pick', s);
  replaceNode(leaf, before ? SP(dir, 0.5, nl, leaf) : SP(dir, 0.5, leaf, nl));
  layoutChanged(); return nl;
}
function closeLeaf(leaf) {
  const f = parentOf(leaf.id); if (!f) return;
  if (!f.parent) LIB.layout = null;
  else replaceNode(f.parent, f.parent.a === leaf ? f.parent.b : f.parent.a);
  if (leaf.p === 'online') stopPreview();
  layoutChanged();
}
// open a panel: in an empty "new window" first, else beside the window in focus, else on the empty canvas
function openPanel(p, s) {
  const blank = leaves().find(l => l.p === 'pick');
  if (blank) { blank.p = p; blank.s = s || {}; touch(blank); layoutChanged(); return blank; }
  if (!LIB.layout) { LIB.layout = L(p, s); touch(LIB.layout); layoutChanged(); return LIB.layout; }
  const at = leaves().find(l => l.id === focusId) || leaves().sort((a, b) => tileArea(b) - tileArea(a))[0];
  const el = document.querySelector(`.tile[data-id="${at.id}"]`), wide = !el || el.clientWidth >= el.clientHeight * 1.2;
  const nl = splitLeaf(at, wide ? 'row' : 'col', p, s); touch(nl); renderTree(); return nl;
}
const tileArea = l => { const el = document.querySelector(`.tile[data-id="${l.id}"]`); return el ? el.clientWidth * el.clientHeight : 0; };
function layoutChanged() { save(); renderTree(); }
function applyLayout(tree) {
  const fresh = n => (n.t === 'leaf' ? { ...n, id: uid(), s: clone(n.s || {}) } : { ...n, id: uid(), a: fresh(n.a), b: fresh(n.b) });
  LIB.layout = tree ? fresh(tree) : null; stopPreview(); layoutChanged();
}

function renderTree() {
  headRO.disconnect();
  const c = $('#canvas');
  const keep = new Map([...c.querySelectorAll('.tbod')].map(b => [b.dataset.id, b.scrollTop]));
  c.replaceChildren(LIB.layout ? nodeEl(LIB.layout) : emptyCanvas());
  for (const l of leaves()) renderLeaf(l, keep.get(l.id));
  paintPreview(); paintQueued(); paintPicked(); paintRanges(c);
}
function nodeEl(n) {
  if (n.t === 'leaf') return tileEl(n);
  const a = nodeEl(n.a), b = nodeEl(n.b), g = h('div', { class: 'gutter d' + n.dir, title: 'Drag to resize; double-click to make both halves equal' });
  a.style.flex = `0 0 calc(${n.r * 100}% - 3px)`; b.style.flex = '1 1 0';
  const box = h('div', { class: 'split d' + n.dir }, a, g, b); box.dataset.id = n.id;
  g.addEventListener('pointerdown', e => dragGutter(e, n, box, a));
  g.addEventListener('dblclick', () => { n.r = 0.5; layoutChanged(); });
  return box;
}
// dividers snap to halves, thirds and quarters, and no window gets smaller than about 180 by 120 pixels
const SNAPS = [0.25, 1 / 3, 0.5, 2 / 3, 0.75];
function dragGutter(e, n, box, a) {
  e.preventDefault(); const g = e.currentTarget; g.setPointerCapture(e.pointerId); g.classList.add('drag');
  const R = box.getBoundingClientRect(), size = n.dir === 'row' ? R.width : R.height, min = (n.dir === 'row' ? 180 : 120) / size;
  const move = ev => {
    let r = ((n.dir === 'row' ? ev.clientX - R.left : ev.clientY - R.top)) / size;
    const s = SNAPS.find(x => Math.abs(x - r) < 0.018); if (s && !ev.altKey) r = s;
    n.r = clamp(r, min, 1 - min); a.style.flex = `0 0 calc(${n.r * 100}% - 3px)`;
  };
  const up = () => { g.removeEventListener('pointermove', move); g.classList.remove('drag'); save(); };
  g.addEventListener('pointermove', move); g.addEventListener('pointerup', up, { once: true }); g.addEventListener('lostpointercapture', up, { once: true });
}
function tileEl(leaf) {
  const P = PANELS[leaf.p];
  const head = h('div', { class: 'th', draggable: true, title: 'Drag onto another window to dock it there' },
    h('span', { class: 'ti' }, ico(P.icon)), h('span', { class: 'tt', text: P.name }), h('span', { class: 'tx' }), h('span', { class: 'grow' }),
    h('span', { class: 'tbtns' },
      h('button', { type: 'button', class: 'ib', text: '◫', title: 'Split: a new window to the right', onclick: () => { const nl = splitLeaf(leaf, 'row'); touch(nl); } }),
      h('button', { type: 'button', class: 'ib', text: '⊟', title: 'Split: a new window below', onclick: () => { const nl = splitLeaf(leaf, 'col'); touch(nl); } }),
      h('button', { type: 'button', class: 'ib', text: '⇄', title: 'Show something else here', onclick: e => choosePanel(e.currentTarget, p => { leaf.p = p; leaf.s = {}; layoutChanged(); }) })),
    h('button', { type: 'button', class: 'ib tmore', text: '⋯', title: 'This window\'s buttons', onclick: e => headMenu(leaf, tile, e.currentTarget) }),
    // ✕ never folds away
    h('button', { type: 'button', class: 'ib tclose', text: '✕', title: 'Close this window', onclick: () => closeLeaf(leaf) }));
  const body = h('div', { class: 'tbod' }); body.dataset.id = leaf.id;
  const tile = h('div', { class: 'tile' + (leaf.id === focusId ? ' focus' : '') }, head, body, h('div', { class: 'dock' }));
  tile.dataset.id = leaf.id; tile.dataset.p = leaf.p; tile._tx = head.querySelector('.tx');
  headRO.observe(head);
  tile.addEventListener('pointerdown', () => { if (focusId !== leaf.id) { document.querySelectorAll('.tile.focus').forEach(t => t.classList.remove('focus')); tile.classList.add('focus'); } touch(leaf); }, true);
  head.addEventListener('dragstart', e => { e.dataTransfer.setData('text/x-tile', leaf.id); e.dataTransfer.effectAllowed = 'move'; document.body.classList.add('docking'); });
  head.addEventListener('dragend', () => { document.body.classList.remove('docking'); document.querySelectorAll('.dock').forEach(d => { d.className = 'dock'; }); });
  // docking: over a window's edge it goes beside it there, over its middle the two swap places
  const zone = e => { const r = tile.getBoundingClientRect(), x = (e.clientX - r.left) / r.width, y = (e.clientY - r.top) / r.height, m = Math.min(x, 1 - x, y, 1 - y); return m > 0.25 ? 'mid' : m === x ? 'left' : m === 1 - x ? 'right' : m === y ? 'top' : 'bottom'; };
  tile.addEventListener('dragover', e => { if (!e.dataTransfer.types.includes('text/x-tile')) return; e.preventDefault(); tile.querySelector('.dock').className = 'dock on ' + zone(e); });
  tile.addEventListener('dragleave', e => { if (!tile.contains(e.relatedTarget)) tile.querySelector('.dock').className = 'dock'; });
  tile.addEventListener('drop', e => {
    const id = e.dataTransfer.getData('text/x-tile'); if (!id) return; e.preventDefault();
    tile.querySelector('.dock').className = 'dock'; document.body.classList.remove('docking');
    dockLeaf(id, leaf, zone(e));
  });
  return tile;
}
function dockLeaf(id, target, where) {
  if (id === target.id) return;
  const src = leaves().find(l => l.id === id); if (!src) return;
  if (where === 'mid') { [src.p, target.p] = [target.p, src.p]; [src.s, target.s] = [target.s, src.s]; layoutChanged(); return; }
  closeLeafQuiet(src);
  const t = leaves().find(l => l.id === target.id); if (!t) return;
  replaceNode(t, where === 'left' ? SP('row', 0.5, src, t) : where === 'right' ? SP('row', 0.5, t, src) : where === 'top' ? SP('col', 0.5, src, t) : SP('col', 0.5, t, src));
  layoutChanged();
}
function closeLeafQuiet(leaf) { const f = parentOf(leaf.id); if (!f || !f.parent) return; replaceNode(f.parent, f.parent.a === leaf ? f.parent.b : f.parent.a); }
// re-render the windows showing these panels (all of them without arguments), keeping scroll and the field being typed in
let rpT = 0; const rpKinds = new Set();
function renderPanels(...kinds) {
  if (!kinds.length) rpKinds.add('*'); else kinds.forEach(k => rpKinds.add(k));
  if (rpT) return;
  rpT = requestAnimationFrame(() => {
    rpT = 0; const all = rpKinds.has('*'); const ks = new Set(rpKinds); rpKinds.clear();
    for (const l of leaves()) if (all || ks.has(l.p)) renderLeaf(l);
    paintPreview(); paintQueued(); paintPicked(); paintRanges($('#canvas'));
  });
}
function renderLeaf(leaf, scroll) {
  const body = document.querySelector(`.tbod[data-id="${leaf.id}"]`); if (!body) return;
  const a = document.activeElement, keep = a && body.contains(a) && a.dataset.k ? { k: a.dataset.k, s: a.selectionStart, e: a.selectionEnd } : null;
  const top = scroll ?? body.scrollTop;
  const tile = body.parentElement, extra = tile._tx || tile.querySelector('.tx'); extra.replaceChildren();
  body.replaceChildren();
  try { PANELS[leaf.p].render(body, leaf, extra); } catch (e) { console.error(e); body.append(h('p', { class: 'hint bad', text: 'This window had a problem: ' + errText(e) })); }
  body.scrollTop = top;
  fitHead(tile.querySelector('.th'), true);
  if (keep) { const f = body.querySelector(`[data-k="${keep.k}"]`); if (f) { f.focus(); try { f.setSelectionRange(keep.s, keep.e); } catch {} } }
}
function renderAll() { renderTree(); renderQueue(); paint(); }
// a picture of a layout, for the layout menu and the empty canvas
function miniLayout(n) {
  if (n.t === 'leaf') return h('div', { class: 'ml', title: PANELS[n.p].name }, ico(PANELS[n.p].icon));
  const a = miniLayout(n.a), b = miniLayout(n.b); a.style.flex = `0 0 calc(${n.r * 100}% - 1px)`; b.style.flex = '1 1 0';
  return h('div', { class: 'mls d' + n.dir }, a, b);
}
function emptyCanvas() {
  const logo = document.querySelector('#top .brand svg');
  return h('div', { class: 'blank first' },
    h('div', { class: 'blogo' }, logo ? logo.cloneNode(true) : h('span', { class: 'logomark', 'aria-hidden': 'true' })),
    window.APP_VERSION ? h('span', { class: 'appver notr', text: 'Version ' + window.APP_VERSION }) : null,
    h('h2', { text: 'Nothing here' }),
    h('p', { class: 'lead', text: 'Click on Windows to add your first window, or select a layout.' }),
    h('div', { class: 'row center' },
      h('button', { type: 'button', class: 'btn primary', text: '＋ Windows', onclick: e => windowMenu(e.currentTarget) }),
      h('button', { type: 'button', class: 'btn', text: '▦ Layouts', onclick: e => layoutMenu(e.currentTarget) })),
    h('button', { type: 'button', class: 'btn ghost tiny', text: '? New here? Take the quick tour', onclick: () => startTour('basic') }));
}
function panelPick(body, leaf) {
  body.append(h('p', { class: 'hint', text: 'What should this window show?' }),
    h('div', { class: 'pickgrid' }, ...Object.entries(PANELS).filter(([, P]) => !P.hidden).map(([k, P]) => h('button', { type: 'button', class: 'pickb', title: P.desc, onclick: () => { leaf.p = k; leaf.s = k === 'playlist' ? { plId: (LIB.playlists[0] || {}).id } : {}; layoutChanged(); } }, h('span', { class: 'pi2' }, ico(P.icon)), h('b', { text: P.name }), h('span', { class: 'hint', text: P.desc })))));
}

/* ---------- small menus and a question box ---------- */
let menuEl = null;
function closeMenu() { if (menuEl) { if (menuEl._restore) menuEl._restore(); menuEl.remove(); menuEl = null; } }
// A title bar that can't fit everything folds the window's own controls and its layout buttons behind one ⋯, so the
// title stays readable. It unfolds again once the window is wide enough for all of it.
const headRO = new ResizeObserver(es => { for (const e of es) fitHead(e.target); });
function fitHead(head, fresh) {
  if (!head || !head.isConnected) return;
  // 300px or less always folds, whatever fits; wider, it folds only when something overflows
  if (head.clientWidth > 0 && head.clientWidth <= 300) { head.classList.add('tight'); head.dataset.need = Math.max(301, +head.dataset.need || 0); return; }
  if (fresh || (head.classList.contains('tight') && head.clientWidth >= +head.dataset.need)) head.classList.remove('tight');
  if (head.classList.contains('tight')) return;
  const tt = head.querySelector('.tt'), tx = head.querySelector('.tx');
  const over = Math.max(0, head.scrollWidth - head.clientWidth) + Math.max(0, tt.scrollWidth - tt.clientWidth) + Math.max(0, tx.scrollWidth - tx.clientWidth);
  if (over > 1) { head.dataset.need = head.clientWidth + over + 12; head.classList.add('tight'); }
}
let headMoreRect = null;
function headMenu(leaf, tile, anchor) {
  closeMenu();
  const tx = tile._tx, mark = document.createComment('tx'), P = PANELS[leaf.p];
  menuEl = h('div', { class: 'menu thmenu' }, h('div', { class: 'mh', text: P.name }));
  // the real controls move in while it's open (dropdowns and sliders keep working), and go back when it closes
  if (tx && tx.childNodes.length) { tx.replaceWith(mark); tx.classList.add('inmenu'); menuEl.append(tx, h('hr')); }
  menuEl._restore = () => { if (mark.parentNode) { tx.classList.remove('inmenu'); mark.replaceWith(tx); } };
  const item = (icon, label, fn) => h('button', { type: 'button', class: 'mi', onclick: () => { const r = anchor.getBoundingClientRect(); closeMenu(); fn(r); } }, h('span', { class: 'mic' }, ico(icon)), h('span', { text: label }));
  menuEl.append(
    item('splitR', 'Split: a new window to the right', () => { const nl = splitLeaf(leaf, 'row'); touch(nl); }),
    item('splitD', 'Split: a new window below', () => { const nl = splitLeaf(leaf, 'col'); touch(nl); }),
    item('swap', 'Show something else here', () => choosePanel(anchor, p => { leaf.p = p; leaf.s = {}; layoutChanged(); })),
    item('x', 'Close this window', () => closeLeaf(leaf)));
  document.body.append(menuEl);
  const r = headMoreRect = anchor.getBoundingClientRect(), w = menuEl.offsetWidth, hh = menuEl.offsetHeight;
  menuEl.style.left = clamp(r.right - w, 6, innerWidth - w - 6) + 'px';
  menuEl.style.top = (r.bottom + hh + 6 < innerHeight ? r.bottom + 4 : Math.max(6, r.top - hh - 4)) + 'px';
}
function popMenu(anchor, items, x, y) {
  closeMenu();
  menuEl = h('div', { class: 'menu' }, ...items.filter(Boolean).map(it => it === '-' ? h('hr') : it.head ? h('div', { class: 'mh', text: it.head }) : h('button', { type: 'button', class: 'mi' + (it.cls ? ' ' + it.cls : ''), disabled: it.disabled, onclick: () => { closeMenu(); it.fn(); } }, it.dot ? h('span', { class: 'mic' }, h('i', { class: 'mdot', style: `background:${it.dot}` })) : it.icon ? h('span', { class: 'mic' }, ico(it.icon)) : h('span', { class: 'mic' }), it.sub ? h('span', { class: 'mlab' }, h('span', { text: it.label }), h('small', { text: it.sub })) : h('span', { text: it.label }), it.note ? h('span', { class: 'mn', text: it.note }) : null)));
  document.body.append(menuEl);
  let r = anchor ? anchor.getBoundingClientRect() : { left: x, bottom: y, top: y }; const w = menuEl.offsetWidth, hh = menuEl.offsetHeight;
  if (anchor && !r.width && headMoreRect) r = headMoreRect;
  menuEl.style.left = clamp(r.left, 6, innerWidth - w - 6) + 'px';
  menuEl.style.top = (r.bottom + hh + 6 < innerHeight ? r.bottom + 4 : Math.max(6, r.top - hh - 4)) + 'px';
}
addEventListener('pointerdown', e => { if (menuEl && !menuEl.contains(e.target)) closeMenu(); }, true);
function choosePlaylist(anchor, fn) {
  popMenu(anchor, [{ head: 'Add to which playlist?' }, ...LIB.playlists.map(pl => ({ label: pl.name, note: String(pl.items.length), icon: '🎵', fn: () => fn(pl) })), LIB.playlists.length ? '-' : null,
    { label: 'A new playlist…', icon: '＋', fn: async () => { const n = await ask('Name the new playlist', 'Online picks'); if (n) fn(newPlaylist(n.slice(0, 60))); } }]);
}
function choosePanel(anchor, fn, head) { popMenu(anchor, [{ head: head || 'Show in this window' }, ...Object.entries(PANELS).filter(([, P]) => !P.hidden).map(([k, P]) => ({ label: P.name, sub: P.desc, icon: P.icon, fn: () => fn(k) }))]); }
const windowMenu = anchor => choosePanel(anchor, p => openPanel(p, p === 'playlist' ? { plId: (LIB.playlists[0] || {}).id } : {}), 'Add a window');
// prompt() doesn't exist in the app, so this asks instead
function ask(title, value) {
  return new Promise(res => {
    const inp = h('input', { type: 'text', value: value || '', maxLength: 80 });
    const done = v => { box.remove(); res(v); };
    const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) done(null); } },
      h('form', { class: 'card', onsubmit: e => { e.preventDefault(); done(inp.value.trim() || null); } },
        h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('edit')), h('b', { class: 'grow', text: title })), inp,
        h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn ghost', text: 'Cancel', onclick: () => done(null) }), h('button', { type: 'submit', class: 'btn primary', text: 'OK' }))));
    inp.addEventListener('keydown', e => { if (e.key === 'Escape') done(null); });
    document.body.append(box); inp.focus(); inp.select();
  });
}
function layoutMenu(anchor) {
  popMenu(anchor, [...PRESET_GROUPS.flatMap(([g, title]) => [{ head: title }, ...PRESETS.filter(p => p.group === g).map(p => ({ label: p.name, sub: p.desc, icon: '▦', fn: () => applyLayout(p.make()) }))]),
    LIB.layouts.length ? { head: 'Your layouts' } : null, ...LIB.layouts.map(l => ({ label: l.name, icon: '★', fn: () => applyLayout(l.tree) })),
    '-', { label: 'Save this layout…', icon: '💾', disabled: !LIB.layout, fn: async () => { const n = await ask('Name this layout', 'My layout'); if (!n) return; const ex = LIB.layouts.find(l => l.name === n); if (ex) ex.tree = clone(LIB.layout); else LIB.layouts.push({ id: uid(), name: n.slice(0, 40), tree: clone(LIB.layout) }); save(); toast(`Saved the layout "${n}".`); } },
    LIB.layouts.length ? { label: 'Delete a saved layout…', icon: '🗑', fn: () => popMenu(anchor, [{ head: 'Delete which layout?' }, ...LIB.layouts.map(l => ({ label: l.name, icon: '✕', cls: 'bad', fn: () => { LIB.layouts = LIB.layouts.filter(x => x !== l); save(); toast(`Deleted "${l.name}".`); } }))]) } : null,
    { label: 'Clear the canvas', icon: '◻', disabled: !LIB.layout, fn: () => applyLayout(null) }]);
}

/* ============================== the panels ============================== */
const sel = new Set();
let lastSel = null;
// a playlist goes in the playlist window in focus, or a new one beside the playlists
function showPlaylist(pl) {
  let leaf = focusedLeaf('playlist');
  if (!leaf) { const from = focusedLeaf('playlists'); leaf = from ? splitLeaf(from, 'row', 'playlist', { plId: pl.id }) : openPanel('playlist', { plId: pl.id }); }
  leaf.s.plId = pl.id; touch(leaf); sel.clear(); save(); renderPanels('playlist', 'playlists');
  checkMissing(pl); durQueue(pl.items);
}
function panelPlaylists(body, leaf) {
  const shown = new Set(leaves().filter(l => l.p === 'playlist').map(l => l.s.plId));
  body.append(h('div', { class: 'vtools' },
    h('button', { type: 'button', class: 'btn tiny primary', text: '📁 From a folder', onclick: async () => { const p = await desk.pickFolder(); if (p.length) newPlaylistFrom(p); } }),
    h('button', { type: 'button', class: 'btn tiny', text: '＋ Empty', onclick: async () => { const n = await ask('Name the new playlist', 'New playlist'); if (n) showPlaylist(newPlaylist(n.slice(0, 60))); } })));
  const ul = h('ul', { class: 'navlist' });
  for (const pl of LIB.playlists) {
    const b = h('button', { type: 'button', icon: 'music', class: (shown.has(pl.id) ? 'on' : '') + (E.q && E.q.plId === pl.id && E.state === 'play' ? ' playing' : ''), onclick: () => showPlaylist(pl), title: 'Show it' }, h('span', { class: 'n', text: pl.name }), h('span', { class: 'c', text: String(pl.items.length) }));
    b.dataset.plid = pl.id;
    b.oncontextmenu = e => { e.preventDefault(); popMenu(null, [
      { label: 'Play it', icon: '▶', fn: () => { const it = S().shuffle ? pl.items[Math.floor(Math.random() * pl.items.length)] : pl.items[0]; if (it) playItem(pl, it); } },
      { label: 'Add it all to the queue', icon: '☰', fn: () => enqueue(pl.items) },
      { label: 'Rename…', icon: '✎', fn: async () => { const n = await ask('Rename the playlist', pl.name); if (n) { pl.name = n.slice(0, 60); save(); renderPanels('playlists', 'playlist'); } } },
      '-', { label: 'Delete it', icon: '🗑', cls: 'bad', fn: () => { if (confirm(`Delete the playlist "${pl.name}"? The music files stay where they are.`)) { LIB.playlists = LIB.playlists.filter(p => p !== pl); save(); renderPanels('playlists', 'playlist'); } } }], e.clientX, e.clientY); };
    const li = h('li', {}, b);
    li.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files') || e.dataTransfer.types.includes('text/x-cbm')) { e.preventDefault(); li.classList.add('drop'); } });
    li.addEventListener('dragleave', () => li.classList.remove('drop'));
    li.addEventListener('drop', e => { e.preventDefault(); e.stopPropagation(); li.classList.remove('drop'); dropInto(pl, e); });
    ul.append(li);
  }
  body.append(ul);
  if (!LIB.playlists.length) body.append(h('div', { class: 'empty', text: 'No playlists yet. Drop a music folder here to make one.' }));
  else body.append(tip('playlists', 'Drop folders here for a new playlist, or onto a playlist to add them. Right-click a playlist for more.'));
  body.ondragover = e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); };
  body.ondrop = e => { e.preventDefault(); const p = [...e.dataTransfer.files].map(f => desk.pathOf(f)).filter(Boolean); if (p.length) newPlaylistFrom(p); };
}
function dropInto(pl, e) {
  const ids = e.dataTransfer.getData('text/x-cbm');
  if (ids) { const want = ids.split(','), items = LIB.playlists.flatMap(p => p.items).filter(i => want.includes(i.id)); if (items.length) copyInto(pl, items); return; }
  const paths = [...e.dataTransfer.files].map(f => desk.pathOf(f)).filter(Boolean);
  if (paths.length) addToPlaylist(pl, paths);
}
function panelPlaylist(body, leaf, extra) {
  if (!plById(leaf.s.plId)) leaf.s.plId = (LIB.playlists[0] || {}).id;
  const pl = plById(leaf.s.plId);
  extra.append(h('select', { class: 'hsel', title: 'Which playlist', onchange: e => { leaf.s.plId = e.target.value; sel.clear(); save(); renderLeaf(leaf); renderPanels('playlists'); const p = plById(leaf.s.plId); if (p) { checkMissing(p); durQueue(p.items); } } },
    ...LIB.playlists.map(p => h('option', { value: p.id, text: p.name, selected: p === pl }))));
  if (!pl) { body.append(h('div', { class: 'empty' }, h('p', { text: 'No playlists yet.' }), h('button', { type: 'button', class: 'btn primary', text: '📁 Make one from a folder', onclick: async () => { const p = await desk.pickFolder(); if (p.length) newPlaylistFrom(p); } }))); return; }
  const dur = pl.items.reduce((s, i) => s + (i.dur || 0), 0), q = (leaf.s.q || '').trim().toLowerCase();
  const picked = () => pl.items.filter(i => sel.has(i.id));
  body.append(h('div', { class: 'vtools' },
    h('button', { type: 'button', class: 'btn tiny primary', text: '▶ Play', onclick: () => { const it = picked()[0] || (S().shuffle ? pl.items[Math.floor(Math.random() * pl.items.length)] : pl.items[0]); if (it) playItem(pl, it); } }),
    h('button', { type: 'button', class: 'btn tiny', text: '+ Queue', title: 'Add the selected tracks (or all of them) to the queue', onclick: () => enqueue(picked().length ? picked() : pl.items) }),
    h('button', { type: 'button', class: 'btn tiny', text: '📁 Add folder', onclick: async () => { const p = await desk.pickFolder(); if (p.length) addToPlaylist(pl, p); } }),
    h('button', { type: 'button', class: 'btn tiny', text: '＋ Add files', onclick: async () => { const p = await desk.pickFiles(); if (p.length) addToPlaylist(pl, p); } }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '⋯', title: 'More', onclick: e => popMenu(e.currentTarget, [
      { label: 'Look for changes in its folders', icon: '⟳', disabled: !pl.folders.length, fn: () => rescan(pl) },
      { label: 'Sort A–Z', icon: '⇅', fn: () => { pl.items.sort((a, b) => a.title.localeCompare(b.title, undefined, { numeric: true })); save(); renderLeaf(leaf); } },
      { label: 'Copy credits', note: 'for streams', icon: '©', disabled: !pl.items.some(i => i.credit), fn: () => copyCredits(pl) },
      { label: 'Rename…', icon: '✎', fn: async () => { const n = await ask('Rename the playlist', pl.name); if (n) { pl.name = n.slice(0, 60); save(); renderPanels('playlists', 'playlist'); } } },
      '-', { label: 'Delete the playlist', icon: '🗑', cls: 'bad', fn: () => { if (confirm(`Delete the playlist "${pl.name}"? The music files stay where they are.`)) { LIB.playlists = LIB.playlists.filter(p => p !== pl); save(); renderPanels('playlists', 'playlist'); } } }]) }),
    h('span', { class: 'grow' }),
    h('span', { class: 'hint', text: `${pl.items.length} tracks${dur ? ' · ' + fmt(dur) : ''}` }),
    h('input', { class: 'search', type: 'text', 'data-k': 'q', placeholder: 'Search', value: leaf.s.q || '', oninput: e => { leaf.s.q = e.target.value; renderLeaf(leaf); } })));
  if (!pl.items.length) { const z = h('div', { class: 'empty' }, h('p', { text: 'Drop music files or folders here, or use Add folder.' })); body.append(z); dropZone(body, pl); return; }
  const rows = pl.items.map((it, i) => [it, i]).filter(([it]) => !q || it.title.toLowerCase().includes(q) || keyOf(it).toLowerCase().includes(q) || (it.credit || '').toLowerCase().includes(q));
  const tb = h('tbody');
  for (const [it, i] of rows) {
    const tr = h('tr', { class: [sel.has(it.id) && 'sel', E.cur && E.cur.item && E.cur.item.id === it.id && E.state !== 'stop' && 'cur', missing.has(keyOf(it)) && 'missing'].filter(Boolean).join(' '), draggable: true, title: it.credit ? `${keyOf(it)}\n${it.credit}` : keyOf(it) },
      h('td', { class: 'num', text: String(i + 1) }), h('td', { class: 't', text: it.title }), h('td', { class: 'dir', text: it.path ? base(dirOf(it.path)) : '🌍 ' + (it.source || 'Online') }), h('td', { class: 'dur', text: it.dur ? fmt(it.dur) : '' }));
    tr.dataset.id = it.id;
    tr.onclick = e => select(pl, it, e);
    tr.ondblclick = () => playItem(pl, it);
    tr.oncontextmenu = e => { e.preventDefault(); if (!sel.has(it.id)) { sel.clear(); sel.add(it.id); paintSel(); } trackMenu(pl, leaf, e); };
    tr.ondragstart = e => { if (!sel.has(it.id)) { sel.clear(); sel.add(it.id); paintSel(); } e.dataTransfer.setData('text/x-cbm', [...sel].join(',')); e.dataTransfer.effectAllowed = 'copyMove'; };
    tr.ondragover = e => { if (e.dataTransfer.types.includes('text/x-tile')) return; e.preventDefault(); tr.classList.add('dragover'); };
    tr.ondragleave = () => tr.classList.remove('dragover');
    tr.ondrop = e => {
      if (e.dataTransfer.types.includes('text/x-tile')) return;
      e.preventDefault(); e.stopPropagation(); tr.classList.remove('dragover');
      const ids = e.dataTransfer.getData('text/x-cbm');
      if (ids) { const move = pl.items.filter(x => ids.split(',').includes(x.id)); if (!move.length) { dropInto(pl, e); return; } pl.items = pl.items.filter(x => !move.includes(x)); const at = pl.items.indexOf(it); pl.items.splice(at < 0 ? pl.items.length : at, 0, ...move); save(); renderLeaf(leaf); return; }
      const paths = [...e.dataTransfer.files].map(f => desk.pathOf(f)).filter(Boolean); if (paths.length) addToPlaylist(pl, paths, pl.items.indexOf(it));
    };
    tb.append(tr);
  }
  body.append(h('table', { class: 'tracks' }, h('thead', {}, h('tr', {}, h('th', { text: '#' }), h('th', { text: 'Title' }), h('th', { text: 'Folder' }), h('th', { text: 'Length', style: 'text-align:right' }))), tb),
    tip('playlist', 'Double-click plays. Drag tracks to reorder, onto a playlist to copy, or onto the queue. Right-click for more.'));
  dropZone(body, pl);
}
function dropZone(el, pl) {
  el.ondragover = e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); el.classList.add('dropzone'); } };
  el.ondragleave = e => { if (e.target === el) el.classList.remove('dropzone'); };
  el.ondrop = e => { el.classList.remove('dropzone'); if (!e.dataTransfer.files.length) return; e.preventDefault(); const paths = [...e.dataTransfer.files].map(f => desk.pathOf(f)).filter(Boolean); if (paths.length) addToPlaylist(pl, paths); };
}
function select(pl, it, e) {
  if (e.shiftKey && lastSel) { const a = pl.items.findIndex(x => x.id === lastSel), b = pl.items.indexOf(it); if (!e.ctrlKey) sel.clear(); for (let i = Math.min(a, b); i <= Math.max(a, b); i++) if (pl.items[i]) sel.add(pl.items[i].id); }
  else if (e.ctrlKey) { if (sel.has(it.id)) sel.delete(it.id); else sel.add(it.id); lastSel = it.id; }
  else { sel.clear(); sel.add(it.id); lastSel = it.id; }
  paintSel();
}
const paintSel = () => document.querySelectorAll('.tracks tr[data-id]').forEach(tr => tr.classList.toggle('sel', sel.has(tr.dataset.id)));
function removeSel(pl) {
  if (!pl || !sel.size) return;
  const n = sel.size; pl.items = pl.items.filter(i => !sel.has(i.id) || (E.cur && E.cur.item === i)); sel.clear(); save(); renderPanels('playlist', 'playlists'); toast(`Removed ${n} track${n === 1 ? '' : 's'}.`);
}
function trackMenu(pl, leaf, e) {
  const items = pl.items.filter(i => sel.has(i.id)), one = items[0], many = items.length > 1;
  popMenu(null, [
    { label: 'Play', icon: '▶', fn: () => playItem(pl, one) },
    { label: 'Play next', icon: '⤴', fn: () => enqueue(items, true) },
    { label: many ? `Add ${items.length} to the queue` : 'Add to the queue', icon: '☰', fn: () => enqueue(items) },
    { label: 'Add to another playlist…', icon: '🎵', fn: () => choosePlaylist(null, p => copyInto(p, items)) },
    { label: many ? 'Make them sound pads' : 'Make it a sound pad', icon: '🔔', fn: () => makePads(items) },
    one.path ? { label: 'Show in folder', icon: '📂', fn: () => desk.showItem(one.path) } : { label: 'Save to this computer', icon: '⭳', fn: () => items.forEach(saveOnline) },
    one.link ? { label: 'Open its web page', icon: '🔗', fn: () => desk.openExternal(one.link) } : null,
    '-', { label: many ? `Remove ${items.length} tracks` : 'Remove from the playlist', icon: '✕', cls: 'bad', fn: () => removeSel(pl) }], e.clientX, e.clientY);
}
function copyCredits(pl) {
  const lines = pl.items.filter(i => i.credit).map(i => i.credit);
  if (!lines.length) { toast('None of these tracks came from the online library, so there\'s nothing to credit.'); return; }
  navigator.clipboard.writeText([...new Set(lines)].join('\n')).then(() => toast(`Copied ${lines.length} credit${lines.length === 1 ? '' : 's'}. Paste them in your stream or video description.`), () => toast('Couldn\'t copy.'));
}

function panelOnline(body, leaf, extra) {
  const src = leaf.s.src || LIB.lastSrc || 'tabletop';
  extra.append(h('label', { class: 'pvol', title: 'How loud previews play on this computer' }, ico('headphones'),
    h('input', { type: 'range', min: 0, max: 100, value: Math.round(S().prevVol * 100), oninput: e => { S().prevVol = +e.target.value / 100; if (ONLINE.preview) ONLINE.preview.volume = S().prevVol; save(); } })));
  body.append(h('div', { class: 'tabs' }, ...SOURCES.map(([k, n, d]) => h('button', { type: 'button', class: 'tab' + (k === src ? ' on' : ''), title: d, onclick: () => { leaf.s.src = k; LIB.lastSrc = k; save(); renderLeaf(leaf); } }, h('b', { text: n }), h('span', { text: d })))));
  body.append(bulkBar());
  ({ tabletop: onlineTabletop, incompetech: onlineIncompetech, openverse: onlineOpenverse, freesound: onlineFreesound })[src](body, leaf);
}
function catalogState(v, name, label) {
  if (ONLINE.err[name]) { v.append(h('div', { class: 'card bad' }, h('p', { text: `Couldn't load ${label}: ${ONLINE.err[name]}` }), h('button', { type: 'button', class: 'btn', text: 'Try again', onclick: () => loadCatalog(name, true) }))); return false; }
  if (!ONLINE[name]) { v.append(h('p', { class: 'hint', text: `Loading ${label}'s list…` })); loadCatalog(name); return false; }
  return true;
}
const link = (text, url) => h('a', { href: '#', text, onclick: e => { e.preventDefault(); desk.openExternal(url); } });
function pickBox(r) { return h('input', { type: 'checkbox', class: 'pk', 'data-pick': r.id, title: 'Select it, to add several at once', checked: ONLINE.picked.has(r.id), onchange: e => togglePick(r, e.target.checked) }); }
function resultActions(r) {
  return h('div', { class: 'ra' },
    h('button', { type: 'button', class: 'btn tiny primary', text: '▶ Play now', title: 'Play it to the table now', onclick: () => playNow(itemOf(r)) }),
    h('button', { type: 'button', class: 'btn tiny qb', 'data-qurl': r.url, text: '+ Queue', title: 'Add it to the queue; it plays after what\'s playing', onclick: () => enqueue([itemOf(r)]) }),
    h('button', { type: 'button', class: 'btn tiny', text: 'Playlist ▾', title: 'Add it to a playlist', onclick: e => choosePlaylist(e.currentTarget, pl => copyInto(pl, [itemOf(r)])) }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: 'Pad', title: 'Make it a sound pad', onclick: () => makePads([itemOf(r)]) }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '⭳', title: 'Save it to this computer (Music › Critter Sounds)', onclick: () => saveOnline(r) }));
}
const prevBtn = (r, big) => h('button', { type: 'button', class: 'pvb' + (big ? ' big' : ''), 'data-prev': r.id, onclick: () => preview(r) });
function resultRow(r) {
  return h('div', { class: 'res' }, pickBox(r), prevBtn(r),
    h('div', { class: 'rt' }, h('div', { class: 'rn', text: r.title, title: r.credit }), h('div', { class: 'rd', text: [r.by, r.desc].filter(Boolean).join(' · ') })),
    h('span', { class: 'dur', text: r.dur ? fmt(r.dur) : '' }),
    h('a', { class: 'lic', text: r.license || '?', title: 'Open its page', href: '#', onclick: e => { e.preventDefault(); if (r.link) desk.openExternal(r.link); } }),
    resultActions(r));
}
function selectAllBtn(list) { return h('button', { type: 'button', class: 'btn tiny ghost', text: 'Select all shown', onclick: () => { list.forEach(r => ONLINE.picked.set(r.id, r)); paintPicked(); } }); }
function onlineTabletop(v, leaf) {
  v.append(h('p', { class: 'hint' }, 'Ambiences and music by Tim Card, free under ', link('CC BY-NC-ND 4.0', 'https://tabletopaudio.com/about.html'), '. Fine for your games and for small streams with credit. If you use it a lot, ', link('support it on Patreon', 'https://www.patreon.com/tabletopaudio'), '.'));
  if (!catalogState(v, 'tabletop', 'Tabletop Audio')) return;
  const all = ONLINE.tabletop, q = ONLINE.q.tabletop.toLowerCase(), tag = ONLINE.tag.tabletop, kind = ONLINE.tag.tabletopKind;
  const counts = {}; for (const t of all) for (const g of t.tags) counts[g] = (counts[g] || 0) + 1;
  const list = all.filter(t => (!tag || t.tags.includes(tag)) && (!kind || (kind === 'amb' ? /^ambience/i : /^music/i).test(t.kind)) && (!q || (t.title + ' ' + t.desc + ' ' + t.tags.join(' ')).toLowerCase().includes(q))).slice(0, ONLINE.shown.tabletop).map(ttaResult);
  v.append(h('div', { class: 'vtools' },
    h('input', { class: 'search', type: 'text', 'data-k': 'tq', placeholder: `Search ${all.length} tracks: tavern, storm, spaceship…`, value: ONLINE.q.tabletop, oninput: e => { ONLINE.q.tabletop = e.target.value; ONLINE.shown.tabletop = 60; renderPanels('online'); } }),
    h('select', { onchange: e => { ONLINE.tag.tabletopKind = e.target.value; renderPanels('online'); } }, ...[['', 'Ambience and music'], ['amb', 'Mostly ambience'], ['mus', 'Mostly music']].map(([k, n]) => h('option', { value: k, text: n, selected: k === kind }))),
    selectAllBtn(list), h('button', { type: 'button', class: 'btn ghost tiny', text: 'Refresh', title: 'Load the list again', onclick: () => loadCatalog('tabletop', true) })));
  v.append(h('div', { class: 'chips' }, ...Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([g, n]) => h('button', { type: 'button', class: 'chipb' + (g === tag ? ' on' : ''), icon: 'star', text: `${g} ${n}`, onclick: () => { ONLINE.tag.tabletop = g === tag ? '' : g; renderPanels('online'); } }))));
  const grid = h('div', { class: 'tgrid' });
  for (const r of list) grid.append(h('div', { class: 'tcard' },
    h('div', { class: 'timg', style: `background-image:url("${r.img}")` }, pickBox(r), prevBtn(r, true)),
    h('div', { class: 'tb2' }, h('div', { class: 'rn', text: r.title }), h('div', { class: 'rd', text: [r.kind, r.tags.join(', ')].filter(Boolean).join(' · ') }), h('div', { class: 'tdesc', text: r.desc }), resultActions(r))));
  v.append(grid);
  if (!list.length) v.append(h('p', { class: 'hint', text: 'Nothing matches.' }));
  const left = all.length > ONLINE.shown.tabletop && list.length === ONLINE.shown.tabletop;
  if (left) v.append(h('button', { type: 'button', class: 'btn', text: 'Show more', onclick: () => { ONLINE.shown.tabletop += 60; renderPanels('online'); } }));
}
function onlineIncompetech(v) {
  v.append(h('p', { class: 'hint' }, 'Music by Kevin MacLeod, free under ', link('CC BY 4.0', 'https://incompetech.com/music/royalty-free/faq.html'), ': use it anywhere, including streams and videos, as long as you credit him. Copy credits in a playlist gives you the text.'));
  if (!catalogState(v, 'incompetech', 'Incompetech')) return;
  const all = ONLINE.incompetech, q = ONLINE.q.incompetech.toLowerCase(), feel = ONLINE.tag.incompetech;
  const counts = {}; for (const p of all) for (const f of p.feel) counts[f] = (counts[f] || 0) + 1;
  const match = all.filter(p => (!feel || p.feel.includes(feel)) && (!q || (p.title + ' ' + p.desc + ' ' + p.feel.join(' ') + ' ' + p.instruments).toLowerCase().includes(q)));
  const list = match.slice(0, ONLINE.shown.incompetech).map(incResult);
  v.append(h('div', { class: 'vtools' },
    h('input', { class: 'search', type: 'text', 'data-k': 'iq', placeholder: `Search ${all.length} pieces: medieval, tense, harp…`, value: ONLINE.q.incompetech, oninput: e => { ONLINE.q.incompetech = e.target.value; ONLINE.shown.incompetech = 80; renderPanels('online'); } }),
    selectAllBtn(list), h('button', { type: 'button', class: 'btn ghost tiny', text: 'Refresh', onclick: () => loadCatalog('incompetech', true) })));
  v.append(h('div', { class: 'chips' }, ...Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 36).map(([f, n]) => h('button', { type: 'button', class: 'chipb' + (f === feel ? ' on' : ''), icon: 'sparkle', text: `${f} ${n}`, onclick: () => { ONLINE.tag.incompetech = f === feel ? '' : f; renderPanels('online'); } }))));
  const box = h('div', { class: 'results' }); list.forEach(r => box.append(resultRow(r))); v.append(box);
  if (!list.length) v.append(h('p', { class: 'hint', text: 'Nothing matches.' }));
  if (match.length > list.length) v.append(h('button', { type: 'button', class: 'btn', text: `Show more (${match.length - list.length} left)`, onclick: () => { ONLINE.shown.incompetech += 80; renderPanels('online'); } }));
}
function searchBar(name, placeholder, go, extra) {
  const inp = h('input', { class: 'search', type: 'text', 'data-k': name, placeholder, value: ONLINE.q[name], oninput: e => { ONLINE.q[name] = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') go(1); } });
  return h('div', { class: 'vtools' }, inp, ...extra, h('button', { type: 'button', class: 'btn primary tiny', text: ONLINE.busy === name ? 'Searching…' : 'Search', disabled: ONLINE.busy === name, onclick: () => go(1) }));
}
function pager(o, go, per) {
  if (!o.res) return null;
  const pages = Math.ceil(o.total / per);
  return h('div', { class: 'row', style: 'margin-top:8px' }, h('span', { class: 'hint', text: `${o.total} found${pages > 1 ? `, page ${o.page} of ${pages}` : ''}` }), h('span', { class: 'grow' }),
    selectAllBtn(o.res),
    h('button', { type: 'button', class: 'btn tiny', text: '← Back', disabled: o.page <= 1, onclick: () => go(o.page - 1) }),
    h('button', { type: 'button', class: 'btn tiny', text: 'More →', disabled: o.page >= pages, onclick: () => go(o.page + 1) }));
}
function onlineOpenverse(v) {
  const o = ONLINE.ov, pick = (val, opts, set) => h('select', { onchange: e => { set(e.target.value); if (ONLINE.q.openverse.trim()) searchOpenverse(1); } }, ...opts.map(([k, n]) => h('option', { value: k, text: n, selected: k === val })));
  v.append(h('p', { class: 'hint', text: 'Openly licensed sound from Freesound, Jamendo, Wikimedia Commons, ccMixter and others. CC0 and CC BY work anywhere with credit; NC means not for paid work; ND means as it is. Without an account Openverse allows 200 searches a day.' }));
  v.append(searchBar('openverse', 'Search: thunder, sword fight, tavern music…', searchOpenverse, [
    pick(o.kind, [['music', 'Music'], ['sfx', 'Sound effects'], ['', 'Everything']], x => { o.kind = x; }),
    pick(o.len, [['', 'Any length'], ['shortest', 'Under 30 s'], ['short', '30 s to 2 min'], ['medium', '2 to 10 min'], ['long', 'Over 10 min']], x => { o.len = x; }),
    pick(o.lic, [['', 'Any license'], ['commercial', 'OK for paid streams'], ['modification', 'May be changed']], x => { o.lic = x; })]));
  if (ONLINE.err.openverse) v.append(h('div', { class: 'card bad', text: ONLINE.err.openverse }));
  if (o.res) { const box = h('div', { class: 'results' }); o.res.forEach(r => box.append(resultRow(r))); v.append(box, pager(o, searchOpenverse, 20)); if (!o.res.length) v.append(h('p', { class: 'hint', text: 'Nothing found. Try other words, or "Everything".' })); }
}
function onlineFreesound(v) {
  const o = ONLINE.fs;
  if (!S().fsKey) {
    const k = h('input', { type: 'text', class: 'grow', placeholder: 'Paste your Freesound API key here' });
    v.append(h('div', { class: 'card' },
      h('p', {}, 'Freesound has over 600,000 sound effects. Searching it directly needs a free API key:'),
      h('ol', {}, h('li', {}, link('Make a free Freesound account', 'https://freesound.org/home/register/'), ', if you don\'t have one.'),
        h('li', {}, link('Ask for an API key', 'https://freesound.org/apiv2/apply/'), ' (any name and description will do).'),
        h('li', { text: 'Copy the "Client secret/Api key" here.' })),
      h('div', { class: 'row' }, k, h('button', { type: 'button', class: 'btn primary', text: 'Save the key', onclick: () => { if (k.value.trim()) { S().fsKey = k.value.trim(); save(); renderPanels('online'); } } })),
      h('p', { class: 'hint', text: 'Without a key, Freesound sounds still turn up under Openverse › Sound effects.' })));
    return;
  }
  v.append(searchBar('freesound', 'Search sound effects: door creak, dragon roar, crowd…', searchFreesound, [
    h('select', { onchange: e => { o.len = e.target.value; if (ONLINE.q.freesound.trim()) searchFreesound(1); } }, ...[['', 'Any length'], ['short', 'Under 5 s'], ['medium', '5 to 30 s'], ['long', '30 s to 10 min'], ['loop', 'Loops']].map(([k, n]) => h('option', { value: k, text: n, selected: k === o.len }))),
    h('button', { type: 'button', class: 'btn ghost tiny', text: 'Forget the key', onclick: () => { S().fsKey = ''; save(); renderPanels('online'); } })]));
  if (ONLINE.err.freesound) v.append(h('div', { class: 'card bad', text: ONLINE.err.freesound }));
  if (o.res) { const box = h('div', { class: 'results' }); o.res.forEach(r => box.append(resultRow(r))); v.append(box, pager(o, searchFreesound, 30)); if (!o.res.length) v.append(h('p', { class: 'hint', text: 'Nothing found.' })); }
}

function panelWeb(body) {
  const st = WEB.state;
  const url = h('input', { type: 'url', class: 'grow', 'data-k': 'url', placeholder: 'https://www.youtube.com/…  or any page that plays sound', value: st.open ? st.url : '' });
  const open = () => { if (url.value.trim()) desk.webOpen(url.value.trim()); };
  url.onkeydown = e => { if (e.key === 'Enter') open(); };
  body.append(h('div', { class: 'card' },
    h('div', { class: 'row' }, url, h('button', { type: 'button', class: 'btn', text: 'Open', onclick: open })),
    h('div', { class: 'row', style: 'margin-top:8px' },
      h('button', { type: 'button', class: 'btn tiny', text: '◀', title: 'Back', disabled: !st.back, onclick: () => desk.webNav('back') }),
      h('button', { type: 'button', class: 'btn tiny', text: '▶', title: 'Forward', disabled: !st.fwd, onclick: () => desk.webNav('fwd') }),
      h('button', { type: 'button', class: 'btn tiny', text: 'Reload', disabled: !st.open, onclick: () => desk.webNav('reload') }),
      h('button', { type: 'button', class: 'btn tiny', text: 'Show the window', disabled: !st.open, onclick: () => desk.webNav('show') }),
      h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn tiny primary', text: E.cur && E.cur.kind === 'web' && E.state === 'play' ? 'Playing to the table' : '▶ Play this page to the table', disabled: !st.open, onclick: playWeb }),
      h('button', { type: 'button', class: 'btn tiny ghost', text: 'Close it', disabled: !st.open, onclick: () => desk.webNav('close') })),
    h('p', { class: 'hint', text: st.open ? `${st.title || st.url}${st.audible ? ' · making sound' : ''}` : 'Opens in its own window. Sign in or pick a video there; the sound goes to the table through the same fades, volume and effects. Turn on "Here" in the bar to hear it yourself.' })));
  const name = h('input', { type: 'text', 'data-k': 'wname', placeholder: 'Name (optional)', maxLength: 60 });
  const list = h('div', { class: 'list' });
  for (const w of LIB.web) list.append(h('div', { class: 'item' }, h('span', { class: 'n', text: w.title || w.url, title: w.url }),
    h('button', { type: 'button', class: 'btn tiny', text: 'Open', onclick: () => desk.webOpen(w.url) }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: 'Remove', onclick: () => { LIB.web = LIB.web.filter(x => x !== w); save(); renderPanels('web'); } })));
  if (!LIB.web.length) list.append(tip('web', 'Save the pages you use often, like a rain sounds video or an ambience mixer.'));
  body.append(h('div', { class: 'sec', icon: 'web', text: 'Saved pages' }), h('div', { class: 'card' }, list, h('div', { class: 'row', style: 'margin-top:8px' }, name,
    h('button', { type: 'button', class: 'btn tiny', text: 'Save the open page', disabled: !st.open, onclick: () => { LIB.web.push({ id: uid(), url: st.url, title: name.value.trim() || st.title || st.url }); save(); renderPanels('web'); } }))));
}
function panelPads(body, leaf, extra) {
  const st = leaf.s, armed = Date.now() < PADSTOP.until;
  extra.append(h('button', { type: 'button', class: 'btn tiny', text: '＋ Sounds', onclick: async () => { const p = await desk.pickFiles(); if (p.length) makePads(p.map(x => ({ title: titleOf(x), path: x }))); } }),
    h('button', { type: 'button', class: 'btn tiny ' + (armed ? 'bad armed' : 'ghost'), text: armed ? '■ Stop now' : '■ Stop all', title: 'One press fades every pad out; a second press stops them at once', onclick: stopAllPads, disabled: !padsPlaying.size }));
  const q = (st.q || '').trim().toLowerCase();
  body.append(h('div', { class: 'vtools' },
    h('input', { class: 'search grow', type: 'text', 'data-k': 'padq', placeholder: 'Search pads: sword, rain, tavern…', value: st.q || '', oninput: e => { st.q = e.target.value; renderLeaf(leaf); } }),
    h('label', { class: 'duck', title: 'How quiet the music gets while a pad plays' }, h('span', { text: 'Music dips to' }), h('input', { type: 'range', min: 0, max: 100, value: Math.round(S().duck * 100), oninput: e => { S().duck = +e.target.value / 100; e.target.nextSibling.textContent = e.target.value + '%'; save(); } }), h('output', { text: Math.round(S().duck * 100) + '%' }))));
  // groups (colourless), then the tags inside the chosen group (in their colours)
  const inGroup = p => !st.group || p.group === st.group;
  const gcount = {}; for (const p of LIB.pads) if (p.group) gcount[p.group] = (gcount[p.group] || 0) + 1;
  if (LIB.pads.length) body.append(h('div', { class: 'chips' },
    h('button', { type: 'button', class: 'chipb' + (!st.group ? ' on' : ''), icon: 'pads', text: `All ${LIB.pads.length}`, onclick: () => { st.group = ''; st.tag = ''; save(); renderLeaf(leaf); } }),
    ...Object.entries(gcount).sort((a, b) => b[1] - a[1]).map(([g, n]) => h('button', { type: 'button', class: 'chipb' + (st.group === g ? ' on' : ''), gicon: groupIcon(g), text: `${g} ${n}`, onclick: () => { st.group = st.group === g ? '' : g; st.tag = ''; save(); renderLeaf(leaf); } }))));
  const tcount = {}; for (const p of LIB.pads) if (p.tag && inGroup(p)) tcount[p.tag] = (tcount[p.tag] || 0) + 1;
  // tags show once a group is picked (or when there are only a few), so the chips stay short
  if (Object.keys(tcount).length && (st.group || Object.keys(tcount).length <= 10 || st.tag)) body.append(h('div', { class: 'chips tags' }, ...Object.entries(tcount).sort((a, b) => a[0].localeCompare(b[0])).map(([t, n]) =>
    h('button', { type: 'button', class: 'chipb tagchip' + (st.tag === t ? ' on' : ''), icon: 'star', style: `--tc:${tagColor(t)}`, title: 'Right-click to change its colour', text: `${t} ${n}`, onclick: () => { st.tag = st.tag === t ? '' : t; save(); renderLeaf(leaf); }, oncontextmenu: e => { e.preventDefault(); tagColorDialog(t); } }))));
  // a search hides every pad whose name, group or tags don't fit
  const words = padWords(q), fits = p => inGroup(p) && (!st.tag || p.tag === st.tag) && (!words.length || words.every(w => padWords([p.name, p.group, p.tag, ...(p.srcTags || [])].join(' ')).some(t => t.startsWith(w))));
  const shown = LIB.pads.filter(fits);
  const g = h('div', { class: 'pads' }); shown.forEach(p => g.append(padTile(p)));
  if (!LIB.pads.length) g.append(h('div', { class: 'empty', text: 'No pads yet. Add sounds, or make pads from tracks, online results or YouTube. Keys 1 to 9 play the first nine.' }));
  else if (!shown.length) g.append(h('div', { class: 'empty', text: 'No pad fits that.' }));
  body.append(g, tip('pads', 'Click a pad to play it, again to stop it. Right-click for its group, tag, colour and icon. ⟳ loops it until you stop it.'));
}
function padTile(p, small) {
  const i = LIB.pads.indexOf(p), P = padsPlaying.get(p.id), tc = tagColor(p.tag);
  const el = h('div', { class: 'pad' + (P ? ' playing' : '') + (P && P.stopping ? ' stopping' : '') + (p.loop ? ' looping' : '') + (small ? ' small' : ''), tabIndex: 0, role: 'button', style: tc ? `--tc:${tc}` : '',
    title: [p.name, [p.group, p.tag].filter(Boolean).join(' · '), p.loop ? 'Loops until stopped' : '', p.credit].filter(Boolean).join('\n'),
    onclick: e => { if (!e.target.closest('.pa')) playPad(p); }, oncontextmenu: e => { e.preventDefault(); padMenu(p, null, e.clientX, e.clientY); } },
    gi(p.icon || 'musical-notes', 'padico'),
    !small && i < 9 ? h('span', { class: 'k', text: String(i + 1) }) : null,
    h('span', { class: 'pn', text: p.name }),
    !small ? h('div', { class: 'ptags' }, p.group ? h('span', { class: 'pg', text: p.group }) : null, p.tag ? h('span', { class: 'pt', text: p.tag }) : null) : null,
    !small ? h('div', { class: 'pa' },
      h('button', { type: 'button', class: 'ib' + (p.loop ? ' on' : ''), title: p.loop ? 'Looping: it plays until you stop it (click to play once)' : 'Plays once (click to loop it)', onclick: () => setPadLoop(p, !p.loop) }, ico('repeat')),
      h('input', { type: 'range', min: 0, max: 150, value: Math.round((p.vol ?? 1) * 100), title: 'Pad volume', oninput: e => { p.vol = +e.target.value / 100; const P2 = padsPlaying.get(p.id); if (P2) P2.g.gain.setTargetAtTime(clamp(p.vol, 0, 1.5), ac.currentTime, 0.05); save(); } }),
      h('button', { type: 'button', class: 'ib', text: '⋯', title: 'Group, tag, colour, icon…', onclick: e => padMenu(p, e.currentTarget) })) : (p.loop ? h('span', { class: 'lp' }, ico('repeat')) : null),
    P && !p.loop ? h('i', { class: 'pprog', 'data-padprog': p.id }) : null);
  el.dataset.id = p.id;
  return el;
}
function setPadLoop(p, on) { p.loop = !!on; const P = padsPlaying.get(p.id); if (P) P.el.loop = p.loop; save(); padsChanged(); }
function setPadGroup(p, g) { p.group = g; p.tagSet = true; save(); padsChanged(); }
function setPadTag(p, t) { p.tag = String(t || '').toLowerCase().trim().slice(0, 24); p.tagSet = true; save(); padsChanged(); }
function padMenu(p, anchor, x, y) {
  const playing = padsPlaying.has(p.id);
  popMenu(anchor, [
    { head: p.name },
    { label: playing ? 'Stop' : 'Play', icon: playing ? '■' : '▶', fn: () => playPad(p) },
    { label: p.loop ? 'Play once instead' : 'Loop until stopped', icon: 'repeat', fn: () => setPadLoop(p, !p.loop) },
    '-',
    { label: 'Group', note: p.group || 'none', icon: 'layout', fn: () => chooseGroup(p, anchor, x, y) },
    { label: 'Tag', note: p.tag || 'none', icon: 'star', fn: () => chooseTag(p, anchor, x, y) },
    p.tag ? { label: `Colour of "${p.tag}"`, dot: tagColor(p.tag), fn: () => tagColorDialog(p.tag) } : null,
    { label: 'Icon…', icon: 'pads', fn: () => iconPicker(p) },
    { label: 'Guess group, tag and icon again', icon: 'sparkle', fn: () => { p.tagSet = false; p.iconSet = false; autoTag(p, true); save(); padsChanged(); } },
    '-',
    { label: 'Rename…', icon: '✎', fn: async () => { const n = await ask('Name of the pad', p.name); if (n) { p.name = n.slice(0, 30); if (!p.tagSet || !p.iconSet) autoTag(p); save(); padsChanged(); } } },
    { label: 'Remove the pad', icon: '✕', cls: 'bad', fn: () => { stopPad(p.id, 0); LIB.pads = LIB.pads.filter(x => x !== p); save(); padsChanged(); } }], x, y);
}
// a broad, colourless group: Weapons, Weather, Atmosphere…
function chooseGroup(p, anchor, x, y) {
  popMenu(anchor, [{ head: 'Group (broad, no colour)' }, ...padGroups().map(g => ({ label: g, icon: p.group === g ? 'check' : '', fn: () => setPadGroup(p, g) })), '-',
    { label: 'New group…', icon: 'plus', fn: async () => { const n = await ask('Name the group', ''); if (n) setPadGroup(p, n.trim().slice(0, 24)); } },
    p.group ? { label: 'No group', icon: 'x', fn: () => setPadGroup(p, '') } : null], x, y);
}
// a specific tag with a colour: sword, glass, forest, tavern…
function chooseTag(p, anchor, x, y) {
  popMenu(anchor, [{ head: 'Tag (specific, with a colour)' }, ...padTags().map(t => ({ label: t, dot: tagColor(t), note: p.tag === t ? '✓' : '', fn: () => setPadTag(p, t) })), padTags().length ? '-' : null,
    { label: 'New tag…', icon: 'plus', fn: async () => { const n = await ask('Name the tag (like sword, glass or forest)', ''); if (n) setPadTag(p, n); } },
    p.tag ? { label: 'No tag', icon: 'x', fn: () => setPadTag(p, '') } : null], x, y);
}
// a tag's colour changes every pad that has the tag
function tagColorDialog(tag) {
  if (document.querySelector('.modal')) return;
  const card = h('div', { class: 'card appear' });
  const set = c => { LIB.tagColors[tag] = c; save(); padsChanged(); draw(); };
  const draw = () => card.replaceChildren(
    h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('palette')), h('b', { class: 'grow', text: `Colour of "${tag}"` }), h('button', { type: 'button', class: 'ib', text: '✕', title: 'Close', onclick: () => box.remove() })),
    h('p', { class: 'hint', text: `Every pad tagged "${tag}" takes this colour.` }),
    h('div', { class: 'swatches' }, ...TAG_COLORS.map(c => h('button', { type: 'button', class: 'sw' + (tagColor(tag).toLowerCase() === c ? ' on' : ''), style: `--c:${c}`, onclick: () => set(c) })),
      h('label', { class: 'sw custom', title: 'Any colour you like' }, ico('palette'), h('input', { type: 'color', value: tagColor(tag), oninput: e => { LIB.tagColors[tag] = e.target.value; save(); padsChanged(); }, onchange: () => draw() }))),
    h('div', { class: 'row end' }, LIB.tagColors[tag] ? h('button', { type: 'button', class: 'btn ghost', text: 'Back to its own colour', onclick: () => { delete LIB.tagColors[tag]; save(); padsChanged(); draw(); } }) : null, h('button', { type: 'button', class: 'btn primary', text: 'Done', onclick: () => box.remove() })));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) box.remove(); } }, card);
  draw(); document.body.append(box);
}
function iconPicker(p) {
  if (document.querySelector('.modal')) return;
  const grid = h('div', { class: 'iconpick' }), q = h('input', { type: 'text', placeholder: 'Search icons', class: 'grow' });
  const draw = () => { const t = q.value.trim().toLowerCase(); grid.replaceChildren(...Object.keys(GI).filter(n => !t || n.includes(t)).map(n => h('button', { type: 'button', class: 'ipk' + (p.icon === n ? ' on' : ''), title: n.replace(/-/g, ' '), onclick: () => { p.icon = n; p.iconSet = true; save(); padsChanged(); box.remove(); } }, gi(n)))); };
  q.oninput = draw;
  const card = h('div', { class: 'card appear wide' },
    h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('star')), h('b', { class: 'grow', text: `Icon for "${p.name}"` }), h('button', { type: 'button', class: 'ib', text: '✕', onclick: () => box.remove() })),
    h('div', { class: 'row' }, q, h('button', { type: 'button', class: 'btn', text: 'Automatic', onclick: () => { p.iconSet = false; autoTag(p); save(); padsChanged(); box.remove(); } })),
    grid, h('p', { class: 'hint', text: 'Icons by Lorc, Delapouite and others from game-icons.net, CC BY 3.0.' }));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) box.remove(); } }, card);
  draw(); document.body.append(box); q.focus();
}
// the pads that are playing, under the queue
function padsNowEl() {
  const list = [...padsPlaying.values()];
  if (!list.length) return h('div', { class: 'padsnow none' });
  const armed = Date.now() < PADSTOP.until;
  return h('div', { class: 'padsnow' },
    h('div', { class: 'qhead' }, h('div', { class: 'sec', icon: 'pads', text: `Sound pads playing (${list.length})` }), h('span', { class: 'grow' }),
      h('button', { type: 'button', class: 'btn tiny ' + (armed ? 'bad armed' : 'ghost'), text: armed ? '■ Stop now' : '■ Stop all', title: 'One press fades them all out; a second press stops them at once', onclick: stopAllPads })),
    ...list.map(P => h('div', { class: 'pnow' + (P.stopping ? ' stopping' : ''), style: tagColor(P.pad.tag) ? `--tc:${tagColor(P.pad.tag)}` : '' },
      gi(P.pad.icon || 'musical-notes', 'pnico'),
      h('div', { class: 'qtx' }, h('div', { class: 'qtt', text: P.pad.name }), P.pad.loop ? h('div', { class: 'hint', text: P.stopping ? 'Fading out…' : 'Looping until you stop it' }) : h('div', { class: 'pbar' }, h('i', { 'data-padprog': P.pad.id }))),
      h('button', { type: 'button', class: 'ib', text: '■', title: 'Stop it, with a short fade', onclick: () => stopPad(P.pad.id, 0.4) }))));
}
function renderPadsNow() { const old = document.querySelector('#queue .padsnow'); if (old) old.replaceWith(padsNowEl()); else renderQueue(); }
function panelScenes(body, leaf, extra) {
  extra.append(h('button', { type: 'button', class: 'btn tiny primary', text: '＋ Save scene', title: 'Save the current playlist, effects, volume, repeat and shuffle as a scene', onclick: async () => {
    const n = await ask('Name the scene (like "Tavern" or "Boss fight")', E.q && plById(E.q.plId) ? plById(E.q.plId).name : 'Scene'); if (!n) return;
    LIB.scenes.push({ id: uid(), name: n.slice(0, 40), plId: E.q ? E.q.plId : ((focusedLeaf('playlist') || { s: {} }).s.plId || ''), fx: clone(S().fx), vol: S().vol, loop: S().loop, shuffle: S().shuffle }); save(); renderPanels('scenes');
  } }));
  body.append(tip('scenes', 'A scene remembers a playlist with its effects, volume, repeat and shuffle. Starting one crossfades into it: handy for jumping from the tavern to a fight.'));
  const L2 = h('div', { class: 'list' });
  for (const sc of LIB.scenes) {
    const pl = plById(sc.plId), fx = mfxClean(sc.fx), on = MFX_LIST.filter(([k]) => fx[k].on).map(([, n]) => n);
    L2.append(h('div', { class: 'item' }, h('span', { class: 'n' }, h('b', { text: sc.name }), h('span', { class: 'hint', text: ` · ${pl ? pl.name : 'no playlist'}${on.length ? ' · ' + on.join(', ') : ''}` })),
      h('button', { type: 'button', class: 'btn tiny primary', text: '▶ Start', onclick: () => startScene(sc) }),
      h('button', { type: 'button', class: 'btn tiny', text: 'Update', title: 'Replace it with the current setup', onclick: () => { Object.assign(sc, { plId: E.q ? E.q.plId : sc.plId, fx: clone(S().fx), vol: S().vol, loop: S().loop, shuffle: S().shuffle }); save(); renderPanels('scenes'); toast('Scene updated.'); } }),
      h('button', { type: 'button', class: 'btn tiny ghost', text: '✕', title: 'Remove', onclick: () => { LIB.scenes = LIB.scenes.filter(x => x !== sc); save(); renderPanels('scenes'); } })));
  }
  if (!LIB.scenes.length) L2.append(h('p', { class: 'hint', text: 'No scenes yet.' }));
  body.append(L2);
}
function startScene(sc) {
  Object.assign(S(), { fx: mfxClean(sc.fx), vol: sc.vol ?? S().vol, loop: sc.loop || S().loop, shuffle: !!sc.shuffle });
  applySettings(); renderPanels('effects'); pub(); save();
  const pl = plById(sc.plId);
  if (pl && pl.items.length) { const it = S().shuffle ? pl.items[Math.floor(Math.random() * pl.items.length)] : pl.items[0]; setContext(pl, it.id); transition(it, E.state === 'play' ? { out: S().xfade, inn: S().xfade, overlap: true } : { out: 0, inn: S().fadeIn, overlap: true }); }
  toast(`Scene: ${sc.name}`); logEvent('music', `Scene: ${sc.name}`);
}

/* ============================== soundscapes ============================== */
// A soundscape is a little patch of nodes (scape.js), kept as a file in Music\Critter Sounds\Soundscapes and edited in a
// window of its own. It plays here, into the mix the table hears; only one at a time, and changing over crossfades.
const SC = { list: [], loaded: false, active: '', run: null, starting: 0, naming: '', fires: [] };
// words a soundscape's name tends to have, before the sound pads' rules get a look
const SCAPE_RULES = [
  [['tavern', 'inn', 'pub', 'bar', 'alehouse'], 'tavern-sign'], [['market', 'city', 'town', 'village', 'street', 'crowd', 'bazaar', 'festival'], 'meeple-group'],
  [['harbor', 'harbour', 'port', 'dock', 'docks', 'pier'], 'anchor'], [['ship', 'sea', 'ocean', 'sail', 'pirate', 'voyage', 'deck'], 'galleon'],
  [['dungeon', 'prison', 'cell', 'jail', 'crypt'], 'crossed-chains'], [['graveyard', 'cemetery', 'tomb', 'grave', 'barrow'], 'tombstone'],
  [['temple', 'church', 'chapel', 'shrine', 'monastery', 'abbey'], 'church'], [['library', 'study', 'archive', 'scriptorium'], 'open-book'],
  [['swamp', 'marsh', 'bog', 'fen'], 'frog'], [['desert', 'dunes', 'oasis'], 'sun'], [['mountain', 'mountains', 'peak', 'pass', 'cliff'], 'mountains'],
  [['night', 'midnight', 'stars', 'starry'], 'night-sky'], [['castle', 'keep', 'throne', 'palace', 'fortress'], 'castle'], [['camp', 'campfire', 'bonfire'], 'campfire'],
  [['cave', 'cavern', 'mine', 'underdark', 'grotto'], 'cave-entrance'], [['forest', 'woods', 'jungle', 'grove', 'glade'], 'forest'], [['storm', 'thunder', 'tempest'], 'lightning-storm'],
  [['rain', 'rainy', 'drizzle'], 'raining'], [['winter', 'snow', 'ice', 'frozen', 'arctic', 'tundra'], 'snowflake-1'], [['river', 'stream', 'brook'], 'river'],
  [['forge', 'smithy', 'blacksmith', 'workshop'], 'anvil'], [['battle', 'war', 'battlefield', 'siege', 'fight'], 'crossed-swords'], [['haunted', 'ghost', 'spooky', 'spirits'], 'ghost'],
  [['magic', 'wizard', 'arcane', 'tower', 'laboratory', 'lab'], 'magic-swirl'], [['space', 'station', 'starship', 'spaceship'], 'spaceship'], [['factory', 'engine', 'machine', 'steampunk'], 'gears']
];
function guessScapeIcon(name) {
  const toks = padWords(name);
  for (const [ws, icon] of SCAPE_RULES) if (ws.some(w => wordHit(toks, w))) return icon;
  const g = guessPad(name); return g ? g.icon : 'sparkles';
}
const scById = id => SC.list.find(d => d.id === id);
async function loadScapes() {
  try {
    if (!SC.loaded) SCAPE.loadCustom(await desk.scape.nodes(), (f, e) => toast(`Your node ${f} has a problem: ${e.message}`));
    SC.list = await desk.scape.list(); SC.loaded = true;
  } catch (e) { toast('Could not read the soundscapes: ' + errText(e)); }
  renderPanels('scapes');
}
function scapeState() { desk.scape.state({ active: SC.active, playing: !!SC.run }); }
// the triggers that fired, sent to the editors a few times a second so their nodes can blink in time
setInterval(() => { if (!SC.fires.length) return; desk.scape.state({ active: SC.active, playing: !!SC.run, now: ac.currentTime, fires: SC.fires }); SC.fires = []; }, 120);
// play one; whatever played before fades out as it fades in (each over its own Output's fade)
async function playScape(doc, quick) {
  if (!ac || !doc) return;
  if (ac.state !== 'running') ac.resume().catch(() => {});
  const tok = ++SC.starting;
  const sc = new SCAPE.Scape(ac, clone(doc), scapeG, { onError: () => renderPanels('scapes'), onFire: (id, port, t) => { if (SC.run === sc && SC.fires.length < 400) SC.fires.push([id, port, t]); } });
  try { await sc.load(); } catch (e) { toast('The soundscape could not load its sounds: ' + errText(e)); }
  if (tok !== SC.starting) return;
  sc.build();
  const was = SC.run, same = SC.active === doc.id;
  if (was) was.stop(quick ? 0.4 : 3);
  sc.start(); if (quick) { const g = sc.master.gain; g.cancelScheduledValues(0); g.setValueAtTime(0, ac.currentTime); g.linearRampToValueAtTime(1, ac.currentTime + 0.4); }
  sc.live();
  SC.run = sc; SC.active = doc.id;
  if (!same) logEvent('music', 'Soundscape: ' + (doc.name || 'Untitled'));
  const errs = Object.keys(sc.errors); if (errs.length && !quick) toast(`${errs.length} node${errs.length > 1 ? 's' : ''} in "${doc.name || 'Untitled'}" could not start: ${Object.values(sc.errors)[0]}`);
  renderPanels('scapes'); scapeState(); renderMini(); pub();
}
function stopScape(fade = 3) {
  SC.starting++;
  if (SC.run) { SC.run.stop(fade); SC.run = null; logEvent('stop', 'Soundscape stopped'); }
  SC.active = ''; renderPanels('scapes'); scapeState(); renderMini(); pub();
}
// what the editors ask: hear this, change that knob, take my changes
function onScapeCmd(m) {
  if (!m) return;
  if (m.op === 'hello') scapeState();
  else if (m.op === 'play' && m.doc) playScape(m.doc);
  else if (m.op === 'stop') { if (!m.id || m.id === SC.active) stopScape(m.fade ?? 2); }
  else if (m.op === 'set' && SC.run && m.id === SC.active) { if (!SC.run.set(m.node, m.param, m.v) && m.doc) playScape(m.doc, true); }
  else if (m.op === 'update' && m.doc && SC.run && m.doc.id === SC.active) playScape(m.doc, true);
  else if (m.op === 'hear' && !S().monitor) { $('#monOn').checked = true; $('#monOn').dispatchEvent(new Event('change')); toast('"Here" is on: you hear what plays on this computer too.'); }
  // named in the editor: the first name picks the icon, just as on the tile
  else if (m.op === 'name') { const d = scById(m.id); if (!d) return; const p = { name: String(m.name || '').slice(0, 60) }; if (m.first && p.name) { p.named = true; if (!d.iconSet) p.icon = guessScapeIcon(p.name); } Object.assign(d, p); renderPanels('scapes'); desk.scape.patch(d.id, p).catch(() => {}); }
}
async function newScape() {
  const d = SCAPE.newDoc('');
  try { await desk.scape.save(d); } catch (e) { toast('Could not save it: ' + errText(e)); return; }
  SC.list.push(d); SC.naming = d.id;
  if (!leaves().some(l => l.p === 'scapes')) openPanel('scapes');
  renderPanels('scapes');
}
// a name is "finished" when the field is left or Enter is pressed; the first time, it picks the icon too
async function nameScape(d, name) {
  name = String(name || '').trim().slice(0, 60); if (name === d.name && d.named) return;
  const p = { name };
  if (name && !d.named) { p.named = true; if (!d.iconSet) p.icon = guessScapeIcon(name); }
  Object.assign(d, p); SC.naming = '';
  renderPanels('scapes');
  try { await desk.scape.patch(d.id, p); } catch (e) { toast('Could not save the name: ' + errText(e)); }
}
function scapeIconPicker(d) {
  if (document.querySelector('.modal')) return;
  const grid = h('div', { class: 'iconpick' }), q = h('input', { type: 'text', placeholder: 'Search icons', class: 'grow' });
  const pick = async (icon, auto) => { Object.assign(d, { icon, iconSet: !auto }); box.remove(); renderPanels('scapes'); await desk.scape.patch(d.id, { icon, iconSet: !auto }).catch(() => {}); };
  const draw = () => { const t = q.value.trim().toLowerCase(); grid.replaceChildren(...Object.keys(GI).filter(n => !t || n.includes(t)).map(n => h('button', { type: 'button', class: 'ipk' + (d.icon === n ? ' on' : ''), title: n.replace(/-/g, ' '), onclick: () => pick(n) }, gi(n)))); };
  q.oninput = draw;
  const card = h('div', { class: 'card appear wide' },
    h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('star')), h('b', { class: 'grow', text: `Icon for "${d.name || 'Untitled'}"` }), h('button', { type: 'button', class: 'ib', text: '✕', onclick: () => box.remove() })),
    h('div', { class: 'row' }, q, h('button', { type: 'button', class: 'btn', text: 'From the name', onclick: () => pick(guessScapeIcon(d.name), true) })),
    grid, h('p', { class: 'hint', text: 'Icons by Lorc, Delapouite and others from game-icons.net, CC BY 3.0.' }));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) box.remove(); } }, card);
  draw(); document.body.append(box); q.focus();
}
function scapeMenu(d, anchor, x, y) {
  popMenu(anchor, [
    { head: d.name || 'Untitled soundscape' },
    { label: 'Edit', icon: 'edit', fn: () => desk.scape.edit(d.id) },
    { label: 'Rename', icon: 'edit', fn: () => { SC.naming = d.id; renderPanels('scapes'); } },
    { label: 'Change the icon…', icon: 'star', fn: () => scapeIconPicker(d) },
    { label: 'Make a copy', icon: 'plus', fn: async () => { const c = { ...clone(d), id: SCAPE.newDoc().id, name: (d.name || 'Untitled') + ' copy', created: Date.now() }; await desk.scape.save(c); SC.list.push(c); renderPanels('scapes'); } },
    { label: 'Show the file', icon: 'folder', fn: () => desk.scape.folder('Soundscapes') },
    '-',
    { label: 'Move to the recycle bin', icon: 'trash', cls: 'bad', fn: async () => { if (!confirm(`Move "${d.name || 'Untitled'}" to the recycle bin?`)) return; if (SC.active === d.id) stopScape(1); await desk.scape.remove(d.id); SC.list = SC.list.filter(x => x !== d); renderPanels('scapes'); } }
  ], x, y);
}
// a soundscape's Macro nodes become sliders on its tile, for steering it while it plays
const macrosOf = d => d.nodes.filter(n => n.type === 'macro');
function setMacro(d, n, v) {
  n.p = n.p || {}; n.p.v = v;
  if (SC.run && SC.active === d.id) SC.run.set(n.id, 'v', v);
  clearTimeout(n._t); n._t = setTimeout(() => desk.scape.patch(d.id, { macro: { node: n.id, v } }).catch(() => {}), 500);
}
function scapeTile(d) {
  const on = SC.active === d.id, naming = SC.naming === d.id || !d.named;
  const nameEl = naming
    ? h('input', { type: 'text', class: 'scname', 'data-k': 'scn-' + d.id, value: d.name || '', maxLength: 60, placeholder: 'Name it: Rainy tavern, Haunted crypt…',
        onkeydown: e => { if (e.key === 'Enter') e.target.blur(); if (e.key === 'Escape') { e.target.value = d.name || ''; e.target.blur(); } },
        // 'change' comes when the name is finished (Enter, or leaving the field), not on every key
        onchange: e => { if (e.target.value.trim() || d.named) nameScape(d, e.target.value); },
        onblur: e => { if (d.named && e.target.value.trim() === d.name) setTimeout(() => { if (SC.naming === d.id) { SC.naming = ''; renderPanels('scapes'); } }, 0); } })
    : h('div', { class: 'scn', text: d.name || 'Untitled', title: 'Double-click to rename', ondblclick: () => { SC.naming = d.id; renderPanels('scapes'); } });
  const nodes = d.nodes.filter(n => n.type !== 'output').length, macros = macrosOf(d);
  return h('div', { class: 'stile' + (on ? ' on' : ''), oncontextmenu: e => { e.preventDefault(); scapeMenu(d, null, e.clientX, e.clientY); } },
    h('button', { type: 'button', class: 'sic', title: 'Change the icon', onclick: () => scapeIconPicker(d) }, gi(d.icon || 'sparkles')),
    h('div', { class: 'stx' }, nameEl, h('div', { class: 'hint', text: nodes ? `${nodes} node${nodes > 1 ? 's' : ''}` + (on ? ' · playing' : '') : 'Empty: press Edit to build it' })),
    h('div', { class: 'sact' },
      h('button', { type: 'button', class: 'btn tiny ' + (on ? 'bad' : 'primary'), text: on ? '■ Stop' : '▶ Play', disabled: !on && !nodes, title: on ? 'Fade it out' : 'Play it to the table (fades over from any other soundscape)', onclick: () => (on ? stopScape() : playScape(d)) }),
      h('button', { type: 'button', class: 'btn tiny', text: '✎ Edit', title: 'Open the node editor in its own window', onclick: () => desk.scape.edit(d.id) }),
      h('button', { type: 'button', class: 'ib', text: '⋯', onclick: e => scapeMenu(d, e.currentTarget) })),
    macros.length ? h('div', { class: 'smac' }, ...macros.map(n => h('label', { class: 'mac' }, h('span', { text: (n.p && n.p.label) || 'Macro' }),
      h('input', { type: 'range', min: 0, max: 1000, value: Math.round(((n.p && n.p.v) ?? 0.5) * 1000), oninput: e => setMacro(d, n, +e.target.value / 1000) })))) : null);
}
function panelScapes(body, leaf, extra) {
  extra.append(h('button', { type: 'button', class: 'btn tiny primary', text: '＋ New', onclick: newScape }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '📂', title: 'Open the Soundscapes folder', onclick: () => desk.scape.folder('Soundscapes') }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '⋯', onclick: e => popMenu(e.currentTarget, [
      { label: 'Bring in a soundscape file…', icon: 'download', fn: async () => { const got = await desk.scape.import(); if (got.length) { SC.list.push(...got); renderPanels('scapes'); toast(`Brought in ${got.length} soundscape${got.length > 1 ? 's' : ''}.`); } } },
      { label: 'Rendered loops', icon: 'folder', fn: () => desk.scape.folder('Loops') },
      { label: 'Your own nodes', icon: 'folder', note: 'Nodes', fn: () => desk.scape.folder('Nodes') },
      { label: 'Read the soundscape files again', icon: 'refresh', fn: loadScapes }]) }));
  if (!SC.loaded) { body.append(h('p', { class: 'hint', text: 'Reading the soundscapes…' })); return; }
  if (SC.run) body.append(h('div', { class: 'scnow' }, h('span', { class: 'dot on' }), h('span', { class: 'grow', text: 'Playing: ' + ((scById(SC.active) || {}).name || 'a soundscape') }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '■ Fade out', onclick: () => stopScape() })));
  const g = h('div', { class: 'stiles' }, ...SC.list.map(scapeTile));
  g.append(h('button', { type: 'button', class: 'stile add', onclick: newScape }, h('span', { class: 'sic' }, ico('plus')), h('b', { text: 'New soundscape' })));
  body.append(g, tip('scapes', 'A soundscape layers loops, one-off sounds at random moments and slow changes into a living background: rain that comes and goes, a tavern with the odd clatter. Only one plays at a time. Its files are in Music › Critter Sounds › Soundscapes.'));
  if (SC.naming) requestAnimationFrame(() => { const f = body.querySelector(`[data-k="scn-${SC.naming}"]`); if (f && document.activeElement !== f) f.focus(); });
}

/* ============================== voice bots: Discord and Fluxer ============================== */
// For groups that meet in Discord or Fluxer instead of Critter VTT: a bot of their own joins a voice channel and plays the
// same mix the table hears, effects and all (bots/bot.js, the way Kenku FM does it). The mix is tapped after the effects
// as 48 kHz 16-bit PCM by an AudioWorklet (pcmtap.js), and sent only while a bot is in a channel.
const BOT = { tap: null, cfg: null, st: { discord: { state: 'off' }, fluxer: { state: 'off' } }, guilds: { discord: [], fluxer: [] }, user: {}, invite: '', err: {}, sel: { discord: {}, fluxer: {} }, rejoin: { discord: null, fluxer: null } };
const BOT_NAMES = { discord: 'Discord', fluxer: 'Fluxer' };
const botLive = () => Object.values(BOT.st).some(s => s.state === 'live');
async function botTap() {
  if (BOT.tap || !ac) return BOT.tap;
  await ac.audioWorklet.addModule('pcmtap.js');
  const n = new AudioWorkletNode(ac, 'pcm-tap', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 2, channelCountMode: 'explicit' });
  // after the effects, so Discord hears what the table hears; the silent output keeps it running
  monFx.output.connect(n); n.connect(G(0)).connect(ac.destination);
  n.port.onmessage = e => desk.bot.pcm(new Uint8Array(e.data));
  BOT.tap = n; return n;
}
function botTapOn() { const on = botLive(); if (on) botTap().then(n => n && n.port.postMessage({ on: botLive() })).catch(e => toast('Could not tap the sound for the bot: ' + errText(e))); else if (BOT.tap) BOT.tap.port.postMessage({ on: false }); }
function onBotEvent(m) {
  if (!m) return;
  if (m.ev === 'state' && BOT.st[m.svc]) {
    const was = BOT.st[m.svc].state; BOT.st[m.svc] = m;
    if (m.state === 'live' && was !== 'live') { toast(`${BOT_NAMES[m.svc]}: playing in ${m.channel}.`); BOT.err[m.svc] = ''; logEvent('session', `${BOT_NAMES[m.svc]} bot joined ${m.channel}`); }
    // back where it was: the last channel, joined again on its own
    if (m.state === 'ready' && was === 'connecting') { const r = BOT.rejoin[m.svc]; BOT.rejoin[m.svc] = null; if (r && r.channel) { BOT.sel[m.svc] = { ...r }; desk.bot.join(m.svc, r.guild, r.channel); } }
    if (m.state === 'live' && m.channelId) BOT.sel[m.svc] = { guild: m.guildId, channel: m.channelId };
    botTapOn();
  } else if (m.ev === 'guilds') { BOT.guilds[m.svc] = m.guilds || []; BOT.user[m.svc] = m.user; if (m.invite) BOT.invite = m.invite; }
  else if (m.ev === 'check') BOT.check = m.report;
  else if (m.ev === 'error') { if (m.svc) BOT.err[m.svc] = m.msg; toast((BOT_NAMES[m.svc] ? BOT_NAMES[m.svc] + ': ' : 'Voice bots: ') + m.msg); }
  renderPanels('bots');
}
// what plays, as a short line in the voice channel's chat (if that's switched on): music and its credit, not every pad
function botNote(e) {
  if (!botLive() || !['music', 'web', 'stop'].includes(e.ev)) return;
  const icon = e.ev === 'stop' ? '⏹' : e.ev === 'web' ? '🌐' : '🎵';
  desk.bot.note(`${icon} ${e.text}${e.cr ? ` · ${e.cr}` : ''}`);
}
async function botCfg() { BOT.cfg = await desk.bot.cfg(); for (const s of Object.keys(BOT.sel)) if (!BOT.sel[s].guild) BOT.sel[s] = { guild: BOT.cfg[s].guild, channel: BOT.cfg[s].channel }; renderPanels('bots'); }
function botHelp(svc) {
  if (document.querySelector('.modal')) return;
  const steps = svc === 'discord' ? [
    'Open the Discord Developer Portal (discord.com/developers/applications) and press New Application. Name it, for example "Table music".',
    'Under Bot, press Reset Token and copy the token. Keep it secret: anyone with it can use your bot.',
    'Paste the token here and press Connect.',
    'Press "Invite it to a server" (or under OAuth2, make an invite link with the bot scope and the Connect, Speak and Send Messages permissions) and add it to your server.',
    'Pick the voice channel and press Join. Everyone in that channel hears what you play, with your effects.'
  ] : [
    'In Fluxer\'s developer portal, create an application with a bot. Name it, for example "Table music".',
    'Copy the bot\'s token. Keep it secret: anyone with it can use your bot.',
    'Invite the bot to your community with the invite (OAuth2) link the portal gives you, with permission to connect and speak in voice.',
    'Paste the token here and press Connect. On a Fluxer you host yourself, fill in its address first.',
    'Pick the voice channel and press Join.'
  ];
  const card = h('div', { class: 'card appear wide' },
    h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('headphones')), h('b', { class: 'grow', text: `A ${BOT_NAMES[svc]} bot of your own` }), h('button', { type: 'button', class: 'ib', text: '✕', onclick: () => box.remove() })),
    h('p', { class: 'hint', text: 'Your group hears Critter Sounds in a voice channel, through a bot that only you control. Nothing goes through anyone else\'s server, and there\'s no shared bot to get banned or rate-limited.' }),
    h('ol', { class: 'botsteps' }, ...steps.map(s => h('li', { text: s }))),
    h('p', { class: 'hint', text: 'The bot plays your mix as a live stream: playlists, pads, soundscapes and web pages, after the effects. The token is stored encrypted on this computer.' }),
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn', text: svc === 'discord' ? 'Open the Developer Portal' : 'Open Fluxer', onclick: () => desk.openExternal(svc === 'discord' ? 'https://discord.com/developers/applications' : 'https://fluxer.app') }), h('button', { type: 'button', class: 'btn primary', text: 'Got it', onclick: () => box.remove() })));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) box.remove(); } }, card);
  document.body.append(box);
}
// the token lives in a menu once it's saved: pasting a new one (and, for Fluxer, the instance's address) signs in again
function botToken(svc) {
  if (document.querySelector('.modal')) return;
  const cfg = (BOT.cfg || {})[svc] || {};
  const tok = h('input', { type: 'password', placeholder: cfg.saved ? 'Paste the new token' : 'Paste the bot\'s token', autocomplete: 'off', spellcheck: false });
  const org = svc === 'fluxer' ? h('input', { type: 'url', value: cfg.origin || '', placeholder: 'Your own Fluxer\'s address (leave empty for fluxer.app)' }) : null;
  const go = async () => {
    if (!tok.value.trim() && !cfg.saved) { toast('Paste the bot\'s token first.'); return; }
    box.remove(); BOT.err[svc] = ''; BOT.rejoin[svc] = BOT.st[svc].state === 'live' ? { ...BOT.sel[svc] } : null;
    try { await desk.bot.login(svc, tok.value, org ? org.value : undefined); await botCfg(); } catch (e) { BOT.err[svc] = errText(e); renderPanels('bots'); }
  };
  tok.onkeydown = e => { if (e.key === 'Enter') go(); };
  const card = h('div', { class: 'card appear' },
    h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('link')), h('b', { class: 'grow', text: `${BOT_NAMES[svc]} bot token` }), h('button', { type: 'button', class: 'ib', text: '✕', onclick: () => box.remove() })),
    h('p', { class: 'hint', text: 'It\'s kept encrypted on this computer, and the bot signs in with it whenever Critter Sounds starts.' + (cfg.saved ? ' Leave it empty to keep the saved one.' : '') }),
    tok, org,
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn ghost', text: '? How to make a bot', onclick: () => { box.remove(); botHelp(svc); } }), h('button', { type: 'button', class: 'btn primary', text: 'Save and sign in', onclick: go })));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) box.remove(); } }, card);
  document.body.append(box); tok.focus();
}
function botMenu(svc, anchor) {
  const cfg = (BOT.cfg || {})[svc] || {}, on = BOT.st[svc].state !== 'off';
  popMenu(anchor, [
    { head: BOT_NAMES[svc] + (BOT.user[svc] ? ' · ' + BOT.user[svc] : '') },
    { label: cfg.saved ? 'Change the token…' : 'Add the token…', icon: 'edit', fn: () => botToken(svc) },
    svc === 'discord' && BOT.invite ? { label: 'Invite it to a server', icon: 'link', fn: () => desk.openExternal(BOT.invite) } : null,
    { label: 'How to make a bot', icon: 'help', fn: () => botHelp(svc) },
    '-',
    on ? { label: 'Sign out until next start', icon: 'x', fn: () => desk.bot.logout(svc) } : null,
    cfg.saved ? { label: 'Forget the token', icon: 'trash', cls: 'bad', fn: async () => { if (!confirm(`Forget the ${BOT_NAMES[svc]} bot's token? It signs out and won't sign in again on start.`)) return; await desk.bot.logout(svc, true); await botCfg(); } } : null
  ]);
}
// sign in again with the saved token; a bot that was in a channel goes back to it
function botReconnect(svc) {
  BOT.err[svc] = '';
  const st = BOT.st[svc]; BOT.rejoin[svc] = st.state === 'live' || st.state === 'joining' ? { ...BOT.sel[svc] } : BOT.rejoin[svc] || null;
  desk.bot.login(svc).catch(e => { BOT.err[svc] = errText(e); renderPanels('bots'); });
}
function botCard(svc) {
  const st = BOT.st[svc], cfg = (BOT.cfg || {})[svc] || {}, sel = BOT.sel[svc], gs = BOT.guilds[svc] || [];
  const state = st.state, busy = state === 'connecting' || state === 'joining', signedIn = state === 'ready' || state === 'joining' || state === 'live';
  const chip = h('span', { class: 'chip ' + (state === 'live' ? 'ok' : state === 'off' ? (cfg.saved && BOT.err[svc] ? 'bad' : '') : 'warn'), text: { off: cfg.saved ? (BOT.err[svc] ? 'Not signed in' : 'Signed out') : 'No bot yet', connecting: 'Signing in…', ready: 'Signed in' + (BOT.user[svc] ? ' as ' + BOT.user[svc] : ''), joining: 'Joining…', live: 'Playing in ' + (st.channel || 'a channel') }[state] || state });
  const card = h('div', { class: 'card botc' + (state === 'live' ? ' live' : '') },
    h('div', { class: 'row' }, h('b', { class: 'botn', text: BOT_NAMES[svc] }), chip, h('span', { class: 'grow' }),
      cfg.saved && state !== 'off' ? h('button', { type: 'button', class: 'btn tiny', text: busy && state === 'connecting' ? '⟳ Signing in…' : '⟳ Reconnect', disabled: state === 'connecting', title: 'Sign in again with the saved token (and go back to the channel it was in)', onclick: () => botReconnect(svc) }) : null,
      h('button', { type: 'button', class: 'ib', text: '⋯', title: 'Token, invite and more', onclick: e => botMenu(svc, e.currentTarget) })));
  if (!cfg.saved) {
    // the first time: the token is all it needs
    card.append(h('div', { class: 'row' }, h('span', { class: 'hint grow', text: `Make a ${BOT_NAMES[svc]} bot of your own, add its token, and it signs in whenever Critter Sounds starts.` }),
      h('button', { type: 'button', class: 'btn primary', text: '＋ Add the bot\'s token', onclick: () => botToken(svc) }), h('button', { type: 'button', class: 'btn ghost', text: '? How', onclick: () => botHelp(svc) })));
  } else if (signedIn) {
    // every voice channel the bot can see, with who's in it: a click joins (or moves there)
    const list = h('div', { class: 'vlist' });
    for (const g of gs) {
      if (gs.length > 1) list.append(h('div', { class: 'vg', text: g.name }));
      if (!g.channels.length) list.append(h('div', { class: 'hint', text: 'No voice channel the bot can see here.' }));
      for (const c of g.channels) {
        const here = state !== 'ready' && st.channel && sel.channel === c.id, n = (c.people || []).length;
        list.append(h('div', { class: 'vc' + (here ? ' here' : '') + (c.can ? '' : ' no'), title: c.can ? (here ? 'The bot is here' : 'Join this channel') : 'The bot may not connect or speak here: give it Connect and Speak in this channel', onclick: e => { if (e.target.closest('button') || here || !c.can || busy) return; sel.guild = g.id; sel.channel = c.id; BOT.err[svc] = ''; desk.bot.join(svc, g.id, c.id); renderPanels('bots'); } },
          h('span', { class: 'vi', text: here && state === 'live' ? '🔊' : '🔈' }),
          h('div', { class: 'vt' }, h('b', { text: c.name }), h('span', { class: 'hint', text: here ? (state === 'joining' ? 'Joining…' : n ? `Playing for ${c.people.join(', ')}` : 'Playing here; nobody else is in it yet') : n ? c.people.join(', ') : c.can ? 'Empty' : 'The bot may not speak here' })),
          n ? h('span', { class: 'vn', text: String(n) }) : null,
          here && state === 'live' ? h('button', { type: 'button', class: 'btn tiny bad', text: '■ Leave', onclick: () => desk.bot.leave(svc) }) : !here && c.can ? h('span', { class: 'vj', text: 'Join' }) : null));
      }
    }
    if (!gs.length) card.append(h('p', { class: 'hint warn', text: 'The bot isn\'t in any server yet: invite it first.' }), svc === 'discord' && BOT.invite ? h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn', text: 'Invite it to a server', onclick: () => desk.openExternal(BOT.invite) })) : null);
    else card.append(list);
    card.append(h('div', { class: 'row wrap' },
      h('label', { class: 'chk', title: 'A short line in the voice channel\'s text chat when a track or web page starts, with its credit' }, h('input', { type: 'checkbox', checked: !!cfg.notes, onchange: async e => { await desk.bot.set(svc, 'notes', e.target.checked); await botCfg(); } }), h('span', { text: 'Post what plays in the channel\'s chat' })),
      h('label', { class: 'chk', title: 'When Critter Sounds starts, the bot signs in and goes back to the last channel' }, h('input', { type: 'checkbox', checked: !!cfg.auto, onchange: async e => { await desk.bot.set(svc, 'auto', e.target.checked); await botCfg(); } }), h('span', { text: 'Join the last channel on start' }))));
  } else if (state === 'connecting') card.append(h('p', { class: 'hint', text: 'Signing in with the saved token…' }));
  else card.append(h('div', { class: 'row' }, h('span', { class: 'hint grow', text: BOT.err[svc] ? 'It couldn\'t sign in. Check the connection, or change the token in ⋯.' : 'Signed out. It signs in again when Critter Sounds starts.' }), h('button', { type: 'button', class: 'btn primary', text: '⟳ Sign in', onclick: () => botReconnect(svc) })));
  if (BOT.err[svc]) card.append(h('p', { class: 'hint bad', text: BOT.err[svc] }));
  return card;
}
function panelBots(body) {
  if (!BOT.cfg) { botCfg(); body.append(h('p', { class: 'hint', text: 'Loading…' })); return; }
  body.append(tip('bots', 'No Critter VTT? Play to a voice channel instead. A bot of your own joins Discord or Fluxer and plays exactly what the table would hear, effects included. It works alongside Critter VTT too.'),
    botCard('discord'), botCard('fluxer'),
    tip('bots-voice', 'Voice chat compresses sound more than Critter VTT does, so quiet ambiences can sound thinner. Keep "Here" off while listening in the voice channel, or you\'ll hear everything twice.'));
}

/* ---------- colours: the Critter Sounds purple by default, or any you like ---------- */
const ACCENTS = [['Critter Sounds', '#8800ff'], ['Lilac', '#b07cff'], ['Gold', '#d4a64a'], ['Ember', '#ff7a1a'], ['Crimson', '#e5484d'], ['Rose', '#ec4899'], ['Emerald', '#22c55e'], ['Teal', '#14b8a6'], ['Azure', '#3b82f6'], ['Ice', '#4cc9f0']];
const TONES = {
  midnight: { name: 'Midnight', bg: '#0b0a12', panel: '#13121b', panel2: '#1b1a26', line: 'rgba(255,255,255,.075)' },
  black: { name: 'Black', bg: '#050506', panel: '#0e0e11', panel2: '#17171b', line: 'rgba(255,255,255,.07)' },
  slate: { name: 'Slate', bg: '#0f131a', panel: '#161b24', panel2: '#1f2631', line: 'rgba(255,255,255,.08)' }
};
const inkOn = hex => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || ''); if (!m) return '#fff'; const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? '#0b0a12' : '#ffffff'; };
function applyTheme() {
  const t = { ...DEF().theme, ...(S().theme || {}) }, st = document.documentElement.style, tone = TONES[t.tone] || TONES.midnight;
  st.setProperty('--accent', t.accent); st.setProperty('--accent2', t.accent2);
  st.setProperty('--accent-ink', inkOn(t.accent)); st.setProperty('--accent2-ink', inkOn(t.accent2));
  // the shared design system: the background tone, light or dark, the surface tint, picture colour and fonts
  for (const k of ['bg', 'panel', 'panel2', 'line']) st.removeProperty('--' + k);
  st.setProperty('--tone-dark', tone.bg);
  document.documentElement.dataset.theme = t.scheme === 'light' ? 'light' : 'dark';
  st.setProperty('--hue', (Number.isFinite(t.tint) ? t.tint : 4) + '%');
  st.setProperty('--bleed', Number.isFinite(t.bleed) ? t.bleed : 1);
  st.setProperty('--grain', t.grain === 0 ? 0 : 1);
  applyFontSet(document.documentElement, t.fonts || 'Easy reading');
}
function appearance() {
  if (document.querySelector('.modal')) return;
  const t = S().theme;
  const set = patch => { Object.assign(t, patch); applyTheme(); save(); draw(); };
  const swatches = key => h('div', { class: 'swatches' }, ...ACCENTS.map(([n, c]) => h('button', { type: 'button', class: 'sw' + (t[key].toLowerCase() === c ? ' on' : ''), title: n, style: `--c:${c}`, onclick: () => set({ [key]: c }) })),
    h('label', { class: 'sw custom', title: 'Any colour you like' }, ico('palette'), h('input', { type: 'color', value: t[key], oninput: e => { t[key] = e.target.value; applyTheme(); save(); }, onchange: () => draw() })));
  const card = h('div', { class: 'card appear' });
  const draw = () => card.replaceChildren(
    h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('palette')), h('b', { class: 'grow', text: 'Appearance' }), h('button', { type: 'button', class: 'ib', text: '✕', title: 'Close', onclick: () => box.remove() })),
    h('div', { class: 'sec', icon: 'palette', text: 'Highlight' }), h('p', { class: 'hint', text: 'Buttons, the playing track, sliders and selections.' }), swatches('accent'),
    h('div', { class: 'sec', icon: 'palette', text: 'Second highlight' }), h('p', { class: 'hint', text: 'Previews, the level meter and other details.' }), swatches('accent2'),
    h('div', { class: 'sec', icon: 'moon', text: 'Light or dark' }),
    h('div', { class: 'seg' }, ...[['dark', 'Dark', 'moon'], ['light', 'Light', 'sun']].map(([k, l, ic]) => h('button', { type: 'button', icon: ic, class: (t.scheme || 'dark') === k ? 'on' : '', text: l, onclick: () => set({ scheme: k }) }))),
    h('div', { class: 'sec', icon: 'window', text: 'Background' }),
    h('div', { class: 'seg' }, ...Object.entries(TONES).map(([k, v]) => h('button', { type: 'button', icon: 'square', class: t.tone === k ? 'on' : '', text: v.name, onclick: () => set({ tone: k }) }))),
    h('div', { class: 'sec', icon: 'drop', text: 'Surface tint' }), h('p', { class: 'hint', text: 'How much the highlight colours the background and the windows.' }),
    (() => { const r = h('input', { type: 'range', min: 0, max: 14, step: 1, value: Number.isFinite(t.tint) ? t.tint : 4, 'aria-label': 'Surface tint', oninput: e => { t.tint = +e.target.value; paintRange(e.target); applyTheme(); save(); } }); paintRange(r); return r; })(),
    h('div', { class: 'sec', icon: 'image', text: 'Picture colour' }), h('p', { class: 'hint', text: 'How far the cover of what\'s playing spills its colours into the bar.' }),
    h('div', { class: 'seg' }, ...[[0, 'Off'], [0.6, 'Soft'], [1, 'Full']].map(([v, l]) => h('button', { type: 'button', icon: 'image', class: (Number.isFinite(t.bleed) ? t.bleed : 1) === v ? 'on' : '', text: l, onclick: () => set({ bleed: v }) }))),
    h('div', { class: 'sec', icon: 'grain', text: 'Film grain' }), h('p', { class: 'hint', text: 'A fine grain over the background, like film.' }),
    h('div', { class: 'seg' }, ...[[0, 'Off'], [1, 'On']].map(([v, l]) => h('button', { type: 'button', icon: 'grain', class: (t.grain ?? 1) === v ? 'on' : '', text: l, onclick: () => set({ grain: v }) }))),
    h('div', { class: 'sec', icon: 'font', text: 'Fonts' }),
    h('div', { class: 'fontsets', role: 'radiogroup', 'aria-label': 'Fonts' }, ...FONT_SETS.map(([n, d, u]) => {
      const on = (t.fonts || 'Easy reading') === n, b = h('button', { type: 'button', role: 'radio', 'aria-checked': String(on), class: 'fontset' + (on ? ' on' : ''), onclick: () => set(n === DYS_SET && t.fonts !== DYS_SET ? { fonts: n, fontsBefore: t.fonts || 'Easy reading' } : { fonts: n }) },
        h('small', { text: n }), h('b', { text: 'The dragon rolls a 20' }), h('span', { text: d === u ? d : `${d} + ${u}` }));
      applyFontSet(b, n); return b;
    })),
    h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn ghost', text: '⟳ Back to Critter Sounds colours', onclick: () => set({ ...DEF().theme }) }), h('button', { type: 'button', class: 'btn primary', text: '✓ Done', onclick: () => box.remove() })));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) box.remove(); } }, card);
  draw(); document.body.append(box);
}

/* ---------- YouTube: search or paste a link, listen, download the sound with yt-dlp ---------- */
const YT = { status: null, checking: false, installing: -1, busy: false, q: '', res: null, title: '', err: '', jobs: new Map(), picked: new Map(), cancelled: new Set() };
const ytFile = r => { const p = LIB.ytFiles && LIB.ytFiles[r.id]; return p || ''; };
async function ytCheck() { if (YT.checking) return; YT.checking = true; YT.status = await desk.yt.status().catch(e => ({ installed: false, error: errText(e) })); YT.checking = false; renderPanels('youtube'); }
function ytProgress({ job, pct }) {
  if (job === 'install') { YT.installing = pct; document.querySelectorAll('[data-ytjob="install"]').forEach(b => { b.style.width = Math.round(pct * 100) + '%'; }); return; }
  const j = YT.jobs.get(job); if (j) j.pct = pct;
  document.querySelectorAll(`[data-ytjob="${CSS.escape(job)}"]`).forEach(b => { b.style.width = Math.round(pct * 100) + '%'; });
}
async function ytInstall() {
  YT.installing = 0; renderPanels('youtube');
  try { const v = await desk.yt.install(); YT.status = { installed: true, version: v }; toast(`yt-dlp ${v} is installed.`); }
  catch (e) { toast('Installing yt-dlp failed: ' + errText(e)); }
  YT.installing = -1; renderPanels('youtube');
}
async function ytSearch() {
  const q = YT.q.trim(); if (!q) return;
  YT.busy = true; YT.err = ''; renderPanels('youtube');
  try {
    if (/^https?:\/\//i.test(q)) { const r = await desk.yt.info(q); YT.res = r.items; YT.title = r.items.length > 1 ? `${r.title}: ${r.items.length} videos` : ''; }
    else { YT.res = await desk.yt.search(q, 20); YT.title = ''; }
  } catch (e) { YT.err = errText(e); }
  YT.busy = false; renderPanels('youtube');
}
// a downloaded video, as a track: it goes into the "YouTube" playlist, and wherever else it was asked for
async function ytGet(r) {
  const have = ytFile(r);
  if (have && (await desk.exists([have]))[0]) return ytTrack(r, have);
  if (YT.jobs.has(r.id)) return YT.jobs.get(r.id).promise;
  const job = { pct: 0 };
  job.promise = (async () => {
    try {
      const file = await desk.yt.download(r.url, r.id);
      LIB.ytFiles[r.id] = file; save();
      return ytTrack(r, file);
    } finally { YT.jobs.delete(r.id); renderPanels('youtube'); }
  })();
  YT.jobs.set(r.id, job); renderPanels('youtube');
  return job.promise;
}
function ytTrack(r, file) {
  const it = { id: uid(), path: file, title: r.title, dur: r.dur || 0, source: 'YouTube', link: r.url, credit: `"${r.title}"${r.by ? ' by ' + r.by : ''} (YouTube)` };
  let pl = LIB.playlists.find(p => p.name === 'YouTube'); if (!pl) pl = newPlaylist('YouTube');
  if (!pl.items.some(i => i.path === file)) { pl.items.push(it); save(); renderPanels('playlists', 'playlist'); return it; }
  return pl.items.find(i => i.path === file);
}
async function ytDo(rs, what, pl) {
  const ok = [];
  for (const r of rs) { try { ok.push(await ytGet(r)); } catch (e) { if (!YT.cancelled.delete(r.id)) toast(`Couldn't download "${r.title}": ${errText(e)}`); } }
  if (!ok.length) return;
  if (what === 'queue') enqueue(ok); else if (what === 'playlist') copyInto(pl, ok); else if (what === 'pads') makePads(ok); else if (what === 'play') playNow(ok[0]);
  else toast(ok.length > 1 ? `Downloaded ${ok.length} into the YouTube playlist.` : `Downloaded "${ok[0].title}" into the YouTube playlist.`);
}
async function ytPreview(r) {
  if (ONLINE.previewId === r.id) { stopPreview(); return; }
  const have = ytFile(r);
  if (have) { stopPreview(); const a = new Audio(mediaUrl(have)); a.volume = clamp(S().prevVol, 0, 1); if (S().sink && a.setSinkId) a.setSinkId(S().sink).catch(() => {}); a.onended = stopPreview; a.play().catch(() => {}); ONLINE.preview = a; ONLINE.previewId = r.id; paintPreview(); return; }
  document.querySelectorAll(`[data-prev="${CSS.escape(r.id)}"]`).forEach(b => b.classList.add('wait'));
  try { const u = await desk.yt.stream(r.url); preview({ id: r.id, url: u }); }
  catch (e) { toast('Couldn\'t get that one\'s sound: ' + errText(e)); }
  document.querySelectorAll('.pvb.wait').forEach(b => b.classList.remove('wait'));
}
function panelYouTube(body, leaf, extra) {
  if (!YT.status) { body.append(h('p', { class: 'hint', text: 'Looking for yt-dlp…' })); ytCheck(); return; }
  if (YT.status.installed) extra.append(h('span', { class: 'chip', title: 'The tool that downloads from YouTube', text: 'yt-dlp ' + (YT.status.version || '') }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '⟳ Update', title: 'Get the newest yt-dlp (YouTube changes often)', onclick: async e => { const b = e.currentTarget; b.disabled = true; try { const v = await desk.yt.update(); YT.status.version = v; toast('yt-dlp is up to date: ' + v); } catch (er) { toast('Updating failed: ' + errText(er)); } renderPanels('youtube'); } }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '📂 Folder', title: 'Open the folder with the downloads', onclick: () => desk.yt.folder() }));
  body.append(tip('youtube', 'Downloads only the sound, into Music › Critter Sounds › YouTube, and adds it to your "YouTube" playlist. Please download only what you may use: your own videos, Creative Commons ones, or with the creator\'s permission. YouTube\'s terms don\'t allow other downloads.'));
  if (!YT.status.installed) {
    const busy = YT.installing >= 0;
    body.append(h('div', { class: 'card' },
      h('b', { text: 'This needs yt-dlp' }),
      h('p', {}, 'yt-dlp is a free, open-source downloader (', link('github.com/yt-dlp/yt-dlp', 'https://github.com/yt-dlp/yt-dlp'), '). Critter Sounds fetches it from its official GitHub releases, about 18 MB, and keeps it in its own folder. Nothing else is installed.'),
      busy ? h('div', { class: 'prog big' }, h('i', { 'data-ytjob': 'install', style: `width:${Math.round(YT.installing * 100)}%` })) : null,
      h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', text: busy ? 'Installing…' : '⭳ Install yt-dlp', disabled: busy, onclick: ytInstall }))));
    if (YT.status.error) body.append(h('p', { class: 'hint bad', text: YT.status.error }));
    return;
  }
  const inp = h('input', { class: 'search grow', type: 'text', 'data-k': 'ytq', placeholder: 'Search YouTube, or paste a video or playlist link', value: YT.q, oninput: e => { YT.q = e.target.value; }, onkeydown: e => { if (e.key === 'Enter') ytSearch(); } });
  body.append(h('div', { class: 'vtools' }, inp, h('button', { type: 'button', class: 'btn primary tiny', text: YT.busy ? 'Searching…' : 'Search', disabled: YT.busy, onclick: ytSearch })));
  if (YT.err) body.append(h('div', { class: 'card bad', text: YT.err }));
  if (!YT.res) return;
  if (YT.title) body.append(h('p', { class: 'hint', text: YT.title }));
  // several at once
  const n = YT.picked.size, picked = () => [...YT.picked.values()], clear = () => { YT.picked.clear(); renderPanels('youtube'); };
  if (n) body.append(h('div', { class: 'bulk' }, h('b', { class: 'bn', text: `${n} selected` }),
    h('button', { type: 'button', class: 'btn tiny primary', text: '+ Queue them', onclick: () => { ytDo(picked(), 'queue'); clear(); } }),
    h('button', { type: 'button', class: 'btn tiny', text: 'Add to playlist ▾', onclick: e => choosePlaylist(e.currentTarget, pl => { ytDo(picked(), 'playlist', pl); clear(); }) }),
    h('button', { type: 'button', class: 'btn tiny', text: 'Make sound pads', onclick: () => { ytDo(picked(), 'pads'); clear(); } }),
    h('button', { type: 'button', class: 'btn tiny ghost', text: '⭳ Just download', onclick: () => { ytDo(picked()); clear(); } }),
    h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn tiny ghost', text: '🗑 Clear', onclick: clear })));
  else if (YT.res.length > 1) body.append(h('div', { class: 'row', style: 'margin-bottom:8px' }, h('button', { type: 'button', class: 'btn tiny ghost', text: 'Select all', onclick: () => { YT.res.forEach(r => YT.picked.set(r.id, r)); renderPanels('youtube'); } })));
  const box = h('div', { class: 'ytlist' });
  for (const r of YT.res) {
    const job = YT.jobs.get(r.id), have = ytFile(r);
    box.append(h('div', { class: 'ytr' + (YT.picked.has(r.id) ? ' picked' : '') },
      h('input', { type: 'checkbox', class: 'pk', checked: YT.picked.has(r.id), title: 'Select it, to do several at once', onchange: e => { if (e.target.checked) YT.picked.set(r.id, r); else YT.picked.delete(r.id); renderPanels('youtube'); } }),
      h('div', { class: 'ytthumb', style: r.thumb ? `background-image:url("${r.thumb}")` : '' }, r.dur ? h('span', { class: 'ytdur', text: fmt(r.dur) }) : null),
      h('div', { class: 'rt' }, h('div', { class: 'rn', text: r.title, title: r.title }), h('div', { class: 'rd', text: [r.by, r.views ? r.views.toLocaleString() + ' views' : '', have ? '✓ downloaded' : ''].filter(Boolean).join(' · ') }),
        job ? h('div', { class: 'row', style: 'margin-top:6px' }, h('div', { class: 'prog grow' }, h('i', { 'data-ytjob': r.id, style: `width:${Math.round(job.pct * 100)}%` })), h('button', { type: 'button', class: 'btn tiny ghost', text: 'Cancel', onclick: () => { YT.cancelled.add(r.id); desk.yt.cancel(r.id); } }))
          : h('div', { class: 'ra' },
            h('button', { type: 'button', class: 'pvb', 'data-prev': r.id, onclick: () => ytPreview(r) }),
            h('button', { type: 'button', class: 'btn tiny primary', text: '▶ Play now', onclick: () => ytDo([r], 'play') }),
            h('button', { type: 'button', class: 'btn tiny', text: '+ Queue', onclick: () => ytDo([r], 'queue') }),
            h('button', { type: 'button', class: 'btn tiny', text: 'Playlist ▾', onclick: e => choosePlaylist(e.currentTarget, pl => ytDo([r], 'playlist', pl)) }),
            h('button', { type: 'button', class: 'btn tiny ghost', text: 'Pad', onclick: () => ytDo([r], 'pads') }),
            have ? null : h('button', { type: 'button', class: 'btn tiny ghost', text: '⭳', title: 'Just download it', onclick: () => ytDo([r]) }))),
      h('a', { class: 'lic', href: '#', text: 'Open', title: 'Open it on YouTube', onclick: e => { e.preventDefault(); desk.openExternal(r.url); } })));
  }
  if (!YT.res.length) box.append(h('p', { class: 'hint', text: 'Nothing found.' }));
  body.append(box);
}

function panelEffects(body, leaf, extra) {
  extra.append(h('button', { type: 'button', class: 'btn tiny ghost', text: '⟳ Reset', onclick: () => { S().fx = mfxDefaults(); fxChanged(); renderPanels('effects'); } }));
  body.append(tip('effects', 'They run on each player\'s computer, so everyone hears them, and players can turn them off for themselves.'));
  const fx = S().fx, box = h('div', { class: 'fxgrid' });
  const slider = (label, k, p, min, max, stepv, show) => h('div', { class: 'sl' }, h('span', { text: label }),
    h('input', { type: 'range', min, max, step: stepv, value: fx[k][p], oninput: e => { fx[k][p] = +e.target.value; e.target.nextSibling.textContent = show(fx[k][p]); fxChanged(); } }), h('output', { text: show(fx[k][p]) }));
  const pct = v => Math.round(v * 100) + '%', sec = v => v.toFixed(2) + 's', db = v => (v > 0 ? '+' : '') + v + 'dB';
  const parts = {
    reverb: () => [slider('Mix', 'reverb', 'mix', 0, 1, 0.01, pct), slider('Size', 'reverb', 'size', 0, 1, 0.01, pct), slider('Damping', 'reverb', 'damp', 0, 1, 0.01, pct)],
    space: () => [h('select', { onchange: e => { fx.space.ir = e.target.value; fxChanged(); renderPanels('effects'); if (fx.space.ir === 'custom' && !IR) pickIR(); } }, ...MFX_SPACES.map(([v, n]) => h('option', { value: v, text: n, selected: fx.space.ir === v }))),
      fx.space.ir === 'custom' ? h('div', { class: 'row' }, h('span', { class: 'hint', text: IR ? IR.name : 'No file yet' }), h('button', { type: 'button', class: 'btn tiny', text: 'Choose file', onclick: pickIR })) : null,
      slider('Mix', 'space', 'mix', 0, 1, 0.01, pct)],
    echo: () => [slider('Time', 'echo', 'time', 0.05, 1.5, 0.01, sec), slider('Feedback', 'echo', 'fb', 0, 0.9, 0.01, pct), slider('Mix', 'echo', 'mix', 0, 1, 0.01, pct)],
    trem: () => [slider('Speed', 'trem', 'rate', 0.5, 12, 0.1, v => v.toFixed(1) + 'Hz'), slider('Depth', 'trem', 'depth', 0, 1, 0.01, pct)],
    chorus: () => [slider('Mix', 'chorus', 'mix', 0, 1, 0.01, pct), slider('Depth', 'chorus', 'depth', 0, 1, 0.01, pct)],
    flanger: () => [slider('Speed', 'flanger', 'speed', 0.05, 4, 0.05, v => v.toFixed(2) + 'Hz'), slider('Feedback', 'flanger', 'fb', 0, 0.9, 0.01, pct), slider('Mix', 'flanger', 'mix', 0, 1, 0.01, pct)],
    autopan: () => [slider('Speed', 'autopan', 'speed', 0.05, 4, 0.05, v => v.toFixed(2) + 'Hz'), slider('Depth', 'autopan', 'depth', 0, 1, 0.01, pct)],
    width: () => [slider('Width', 'width', 'w', 0, 2, 0.01, v => (v < 0.04 ? 'mono' : Math.round(v * 100) + '%'))]
  };
  body.append(h('div', { class: 'fxpre' }, h('span', { class: 'hint', text: 'Presets' }), ...FX_PRESETS.map(([n, d, fx]) => h('button', { type: 'button', class: 'chipb', icon: 'sparkle', title: d, text: n, onclick: () => { S().fx = presetFx(fx); fxChanged(); renderPanels('effects'); toast(`Effects: ${n}`); } }))));
  for (const [k, name] of MFX_LIST) {
    const cb = h('input', { type: 'checkbox', checked: fx[k].on, onchange: e => { fx[k].on = e.target.checked; card.classList.toggle('on', fx[k].on); fxChanged(); } });
    const card = h('div', { class: 'fx' + (fx[k].on ? ' on' : '') }, h('label', { class: 'fxh' }, cb, h('span', { text: name })),
      h('div', { class: 'fxb' }, ...(parts[k] ? parts[k]() : [slider('Amount', k, 'amt', 0, 1, 0.01, pct)])));
    box.append(card);
  }
  box.append(h('div', { class: 'fx on' }, h('div', { class: 'fxh', text: 'Tone' }), h('div', { class: 'fxb' }, slider('Bass', 'eq', 'bass', -12, 12, 1, db), slider('Treble', 'eq', 'treble', -12, 12, 1, db))));
  body.append(box);
}
async function pickIR() { const p = await desk.pickFiles('ir'); if (p[0]) await loadIR(p[0]); }
let fxT = 0;
function fxChanged() { if (monFx) monFx.set(S().fx); clearTimeout(fxT); fxT = setTimeout(() => { save(); pub(); }, 150); }
function panelFades(body) {
  const s = S();
  const row = (label, key, min, max, stepv, title) => h('div', { class: 'sl', title }, h('span', { text: label }),
    h('input', { type: 'range', min, max, step: stepv, value: s[key], disabled: key === 'xfade' && !s.crossfade, oninput: e => { s[key] = +e.target.value; e.target.nextSibling.textContent = s[key] + 's'; save(); } }), h('output', { text: s[key] + 's' }));
  body.append(row('Fade in', 'fadeIn', 0, 15, 0.5, 'How long a song takes to come in'),
    row('Fade out', 'fadeOut', 0.5, 20, 0.5, 'How long stopping or changing a song takes'),
    h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: s.crossfade, onchange: e => { s.crossfade = e.target.checked; save(); renderPanels('fades'); } }), 'Crossfade between tracks'),
    row('Crossfade', 'xfade', 0.5, 15, 0.5, 'How long two songs overlap'),
    row('Pause fade', 'pauseFade', 0, 5, 0.25, 'How long pausing and resuming takes'),
    h('p', { class: 'hint', text: 'Stop fades out. Press stop again to cut the sound at once.' }));
}
/* ---------- the session log: what played when, here and (as small notes) in Critter VTT's chat ---------- */
const SLOG = { lastPad: new Map(), writes: 0 };
const curSession = () => LIB.sessions[LIB.sessions.length - 1] || newSession(true);
function newSession(quiet) {
  const ses = { id: uid(), start: Date.now(), lobby: NET.on ? NET.code : '', entries: [] };
  LIB.sessions.push(ses); if (LIB.sessions.length > 30) LIB.sessions.shift(); save();
  if (!quiet) logEvent('session', 'Session started');
  renderPanels('log');
  return ses;
}
// connecting starts a new session, unless this one is from the same table and still going
function sessionOnConnect() {
  const ses = LIB.sessions[LIB.sessions.length - 1], last = ses ? (ses.entries.length ? ses.entries[ses.entries.length - 1].ts : ses.start) : 0;
  if (!ses || (ses.lobby && ses.lobby !== NET.code) || Date.now() - last > 6 * 3600e3) newSession();
  else if (!ses.lobby) { ses.lobby = NET.code; save(); pushLog({ ts: ses.start, ev: 'session', text: 'Session started' }); }
}
function logEvent(ev, text, o = {}) {
  // the same pad pressed again within 20 seconds is one note
  if (ev === 'pad') { const last = SLOG.lastPad.get(o.id); SLOG.lastPad.set(o.id, Date.now()); if (last && Date.now() - last < 20000) return; }
  const e = { ts: Date.now(), ev, text: String(text || '').slice(0, 200) };
  if (o.title) e.title = String(o.title).slice(0, 80);
  if (o.cr) e.cr = String(o.cr).slice(0, 200);
  const ses = curSession(); ses.entries.push(e); if (ses.entries.length > 2000) ses.entries.shift();
  save(); renderPanels('log'); pushLog(e); botNote(e);
}
// to Critter VTT: lobbies/<code>/soundlog/<id>, the newest 100 kept
async function pushLog(e) {
  if (!NET.on || !NET.db || !S().chatLog) return;
  const doc = { ev: e.ev, text: e.text.slice(0, 120), n: S().name || 'Critter Sounds', ts: e.ts };
  if (e.title) doc.title = e.title.slice(0, 80);
  if (e.cr) doc.cr = e.cr.slice(0, 80);
  try { await NET.db.doc(`lobbies/${NET.code}/soundlog/${uid()}`).set(doc); } catch { return; }
  if (++SLOG.writes % 10 === 1) pruneLog();
}
async function pruneLog() {
  try { const r = await NET.db.collection(`lobbies/${NET.code}/soundlog`).orderBy('ts', 'desc').get(); r.docs.slice(100).forEach(d => NET.db.doc(`lobbies/${NET.code}/soundlog/${d.id}`).delete().catch(() => {})); } catch {}
}
const LOG_ICON = { session: 'clock', music: 'music', pad: 'pads', web: 'web', stop: 'stop' };
const hhmm = ts => new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
function panelLog(body, leaf, extra) {
  const ss = LIB.sessions; if (!ss.some(x => x.id === leaf.s.sid)) leaf.s.sid = (ss[ss.length - 1] || {}).id;
  const ses = ss.find(x => x.id === leaf.s.sid);
  extra.append(ss.length ? h('select', { class: 'hsel', title: 'Earlier sessions', onchange: e => { leaf.s.sid = e.target.value; renderLeaf(leaf); } },
    ...ss.slice().reverse().map(x => h('option', { value: x.id, text: new Date(x.start).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' }) + (x.lobby ? ' · ' + x.lobby : ''), selected: x === ses }))) : null,
    h('button', { type: 'button', class: 'btn tiny', text: '＋ New session', title: 'Start a new session (Critter VTT\'s chat says so)', onclick: () => { const n = newSession(); leaf.s.sid = n.id; renderLeaf(leaf); } }),
    ses ? h('button', { type: 'button', class: 'btn tiny ghost', text: 'Copy', title: 'Copy this session\'s log as text', onclick: () => navigator.clipboard.writeText([`Session ${new Date(ses.start).toLocaleString()}${ses.lobby ? ' · ' + ses.lobby : ''}`, ...ses.entries.map(e => `${hhmm(e.ts)}  ${e.text}`)].join('\n')).then(() => toast('Copied the log.'), () => toast('Couldn\'t copy.')) }) : null);
  body.append(h('label', { class: 'chk' }, h('input', { type: 'checkbox', checked: S().chatLog, onchange: e => { S().chatLog = e.target.checked; save(); } }), 'Show it in Critter VTT\'s chat too, as small notes'));
  if (!ses || !ses.entries.length) { body.append(h('div', { class: 'empty', text: 'Nothing played yet. Connecting to a table starts a session; every track, page and pad played shows here.' })); return; }
  const list = h('div', { class: 'slog' });
  for (const e of ses.entries.slice().reverse()) {
    if (e.ev === 'session') { list.append(h('div', { class: 'sdiv' }, h('span', { text: `${e.text} · ${new Date(e.ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` }))); continue; }
    list.append(h('div', { class: 'srow ev-' + e.ev, title: e.cr || '' }, h('span', { class: 'st', text: hhmm(e.ts) }), h('span', { class: 'si' }, ico(LOG_ICON[e.ev] || 'note')), h('span', { class: 'sx', text: e.text })));
  }
  body.append(list);
}

function panelHelp(body) {
  body.append(h('div', { class: 'card' }, h('b', { text: 'Learn Critter Sounds' }), h('p', { class: 'hint', text: 'The tours show you around the real screen, changing the layout as they go; at the end you can keep it or go back to yours.' }),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn primary', text: '▶ Quick tour', onclick: () => startTour('basic') }), h('button', { type: 'button', class: 'btn', text: '☰ Full tour', onclick: () => startTour('full') }), h('button', { type: 'button', class: 'btn ghost', text: 'Setup', onclick: onboarding })),
    h('p', { class: 'hint', text: 'The soundscape editor has its own guided first loop: open a soundscape with ✎ Edit, then Help › Guided first loop.' })));
  const k = (keys, what) => h('tr', {}, h('td', {}, ...keys.map(x => h('span', { class: 'kbd', text: x }))), h('td', { text: what }));
  body.append(h('div', { class: 'card' }, h('b', { text: 'Getting started' }), h('ol', {},
    h('li', { text: 'Make a playlist from a music folder (Playlists window), or find music in the Online library.' }),
    h('li', { text: 'In Critter VTT, the lobby owner opens Music and copies the music code. Paste it at the top and press Connect.' }),
    h('li', { text: 'Press play. Everyone at the table hears it, through their own Critter VTT and with their own volume.' }))));
  body.append(h('div', { class: 'card' }, h('b', { text: 'Windows' }), h('ul', {},
    h('li', { text: '◫ and ⊟ split a window to the right or below. Drag the line between two windows to resize them; it clicks into place at halves, thirds and quarters (hold Alt to place it freely). Double-click the line to make both halves equal.' }),
    h('li', { text: 'Drag a window by its title onto another one: near an edge it docks there, in the middle the two swap.' }),
    h('li', { text: '▦ Layout has suggested layouts, and saves your own.' }))));
  body.append(h('div', { class: 'card' }, h('b', { text: 'Shortcuts' }), h('table', { class: 'help' }, h('tbody', {},
    k(['Space'], 'Play or pause, with a short fade'), k(['S'], 'Stop with a fade; press again to stop at once'), k(['N'], 'Next: the queue first, then the playlist'), k(['P'], 'Previous track (or back to the start)'),
    k(['←', '→'], 'Jump back or ahead 10 seconds'), k(['↑', '↓'], 'Table volume'), k(['1', '…', '9'], 'Sound pads'), k(['Q'], 'Add the selected tracks to the queue'), k(['Ctrl', 'M'], 'Mini player, which stays on top'),
    k(['Ctrl', 'F'], 'Search the window in focus'), k(['Delete'], 'Remove the selected tracks'), k(['Media keys'], 'Play, pause, next, previous and stop work from any app')))));
  body.append(h('div', { class: 'card' }, h('b', { text: 'Good to know' }), h('ul', {},
    h('li', { text: 'Your music isn\'t uploaded: it plays live from this computer, so there are no size limits. Keep the app open while you play.' }),
    h('li', { text: 'The queue on the right plays first; then the playlist you last played from carries on. A track leaves the queue when it starts.' }),
    h('li', { text: 'Sound pad icons are by Lorc, Delapouite and others from game-icons.net, under CC BY 3.0.' }),
    h('li', { text: 'Turn on "Here" in the bar to listen on this computer, with the effects. Leave it off if you also have Critter VTT open here, or you\'ll hear it twice.' }),
    h('li', { text: 'Online library: Tabletop Audio, Incompetech, Openverse and Freesound, free to use with credit. 🎧 Preview plays on this computer only, at its own volume. Tick several results to queue them, add them to a playlist or make pads in one go. ⭳ saves to Music › Critter Sounds to play offline.' }))));
  // the people and projects Critter Sounds is built on
  const ty = (name, url, what) => h('li', {}, h('a', { href: url, text: name, onclick: e => { e.preventDefault(); desk.openExternal(url); } }), h('span', { text: ': ' + what }));
  body.append(h('div', { class: 'card thanks' }, h('b', { text: 'Thank you' }),
    h('p', { class: 'hint', text: 'Critter Sounds stands on the work of these people and projects.' }), h('ul', {},
      ty('Kenku FM', 'https://www.kenku.fm', 'by Owlbear Rodeo, for the idea of a tabletop soundboard that plays straight into voice chat. Our Discord and Fluxer bots work the way Kenku FM does.'),
      ty('Tabletop Audio', 'https://tabletopaudio.com', 'by Tim Gerrish, for hundreds of ten-minute ambiences and pieces made for the table (CC BY-NC-ND 4.0).'),
      ty('Incompetech', 'https://incompetech.com', 'by Kevin MacLeod, for his whole catalogue of music (CC BY 4.0).'),
      ty('Freesound', 'https://freesound.org', 'and its many recordists, for sound effects under Creative Commons.'),
      ty('Openverse', 'https://openverse.org', 'for searching openly licensed sound across Freesound, Jamendo, ccMixter and Wikimedia.'),
      ty('game-icons.net', 'https://game-icons.net', 'by Lorc, Delapouite and others, for the sound pad and soundscape icons (CC BY 3.0).'),
      ty('yt-dlp', 'https://github.com/yt-dlp/yt-dlp', 'and its contributors, for listening to and saving sound from YouTube.'),
      ty('discord.js', 'https://discord.js.org', 'and @discordjs/voice, with @snazzah/davey for Discord\'s voice encryption, for the Discord bot.'),
      ty('Fluxer', 'https://fluxer.app', 'and fluxer.js, with LiveKit\'s rtc-node, for the Fluxer bot.'),
      ty('opusscript, prism-media and @noble/ciphers', 'https://github.com/abalabahaha/opusscript', 'for encoding and encrypting the voice stream without anything to compile.'),
      ty('Electron', 'https://www.electronjs.org', 'and Chromium, whose Web Audio and WebRTC carry every sound to the table.'),
      ty('Cloudflare Workers', 'https://workers.cloudflare.com', 'for running Homebase, which connects this app to Critter VTT.'),
      h('li', { text: 'Critter VTT, the table this app plays to, and everyone who plays at it.' }))));
}

/* ============================== learning Critter Sounds: setup, a quick tour and a full tour ============================== */
const presetTree = n => (PRESETS.find(p => p.name === n) || PRESETS[0]).make();
const tileOf = p => () => document.querySelector(`.tile[data-p="${p}"]`);
const tileHead = p => () => document.querySelector(`.tile[data-p="${p}"] .th`) || document.querySelector('.tile .th');
// the tours change the layout as they go; at the end it can stay, or go back to how it was
function startTour(kind) {
  closeMenu(); document.querySelectorAll('.modal').forEach(m => m.remove());
  if (document.body.classList.contains('mini')) toggleMini();
  const before = LIB.layout ? clone(LIB.layout) : null;
  const finish = [{ label: 'Back to my layout', fn: () => applyLayout(before) }, { label: 'Keep this layout', primary: true }];
  const steps = kind === 'full' ? tourFull(finish) : tourBasic(finish);
  Tour.run(steps, { onEnd: done => { if (!done) { applyLayout(before); toast('Tour ended: your layout is back as it was. Help › Quick tour starts it again.'); } } });
}
const T_START = (title, more) => ({ title, text: ['Critter Sounds plays music, sound effects and ambience for your tabletop game, live to everyone at your table.', more, 'The tour changes your layout as it goes. At the end you can keep the new one or go back to yours.'], nextLabel: 'Start', wide: true });
const T_CANVAS = { before: () => applyLayout(null), el: '#canvas', title: 'The canvas', text: 'This big space holds windows. Each window is one tool: your playlists, sound pads, soundscapes, effects and more. Right now it\'s empty.' };
const T_WINDOWS = { el: '#openBtn', title: 'Windows adds a window', text: ['Click Windows and pick a tool: it opens on the canvas. Each new window shares the space with the ones already there.', 'Every window has a short description in that list, so you can see what it\'s for before opening it.'] };
const T_LAYOUTS = { before: () => applyLayout(presetTree('Simple player')), el: '#layoutBtn', title: 'Layouts open several at once', text: ['A layout is a ready-made set of windows. We just picked "Simple player": your playlists beside their tracks.', 'There are layouts for running a game, building playlists, making sound pads and playing to voice chat, and you can save your own.'] };
const T_PLAYLISTS = { el: tileOf('playlists'), title: 'Playlists', text: ['"From a folder" turns a folder of music into a playlist, folders inside it included. Your files stay where they are: nothing is uploaded.', '"＋ Empty" makes an empty one to fill from the online library or YouTube.'] };
const T_TRACKS = { el: tileOf('playlist'), title: 'The tracks', text: 'Double-click a track to play it. Select tracks and press Q, or drag them onto the queue, to play them next. Right-click a track for more.' };
const T_QUEUE = { el: '#queue', title: 'Up next', text: 'The queue plays first, then the playlist you played from carries on. Drag to reorder, ✕ to remove. Sound pads that are playing show up below it. ☰ Queue in the top bar hides or shows it.' };
const T_PLAY = { el: '#bar .trans', title: 'Playing', list: ['▶ plays and pauses, always with a gentle fade', '■ fades out; press it twice to stop at once', '⏮ ⏭ go back and ahead', '⇄ shuffles, ⟳ repeats the playlist or one track'] };
const T_VOLS = { el: '#bar .vols', title: 'Two volumes', text: ['Table is how loud everyone hears it.', 'Here plays it on this computer too, with the effects, so you can listen along. Leave it off if Critter VTT is open on this computer as well, or you\'ll hear it twice.'] };
const T_CONN = { el: '#conn', title: 'Playing to your table', text: ['In Critter VTT, the lobby owner opens the Music window and copies the music code. Paste it here and press Connect: everyone in the lobby hears what you play.', 'Meeting in Discord or Fluxer instead? The "Discord & Fluxer" window puts a bot of your own in a voice channel.'] };
const T_EDIT = { el: () => document.querySelector('.tile[data-p="playlist"] .th') || document.querySelector('.tile .th'), title: 'Make it yours', text: 'Every window has these buttons in its title bar:', list: ['◫ splits it: a new window to the right. ⊟ splits it downwards', '⇄ shows something else in the same window', '✕ closes it', 'Drag a window by its title onto another: near an edge it docks there, on the middle the two swap', 'Drag the line between two windows to resize them. It clicks into place at halves, thirds and quarters'], wide: true };
function tourBasic(finish) {
  return [
    T_START('Welcome to Critter Sounds', 'This quick tour takes about two minutes.'),
    T_CANVAS, T_WINDOWS, T_LAYOUTS, T_PLAYLISTS, T_TRACKS, T_QUEUE, T_PLAY, T_VOLS, T_CONN,
    { before: () => applyLayout(presetTree('Run a game')), el: '#canvas', title: 'A layout for game night', text: ['"Run a game" puts playlists, sound pads, soundscapes, scenes and effects side by side, everything a session needs.', 'The full tour (in Help) explains each of these windows.'] },
    T_EDIT,
    { el: '#helpBtn', title: 'Help is always here', text: ['Help has this tour, the full tour with every window, the setup, and the Help window with shortcuts.', 'Keep the "Run a game" layout, or go back to what you had?'], actions: finish }
  ];
}
function tourFull(finish) {
  const lay = t => () => applyLayout(t);
  return [
    T_START('The full tour', 'It shows every window, what you can do with it, and how to arrange them. About ten minutes; you can stop at any time.'),
    T_CANVAS, T_WINDOWS, T_LAYOUTS, T_PLAYLISTS, T_TRACKS, T_QUEUE, T_PLAY, T_VOLS,
    // arranging windows, shown as it happens
    { before: lay(L('playlist')), el: '#canvas', title: 'Arranging windows', text: 'Now one window fills the canvas. Watch the next steps change it, then try it yourself any time.' },
    { before: () => { const l = leaves()[0]; if (l) splitLeaf(l, 'row', 'pads'); }, el: tileOf('pads'), title: '◫ Split', text: 'Pressing ◫ in a window\'s title splits it: the new window opens on the right. Here, it shows the sound pads. ⊟ splits downwards instead.' },
    { before: () => { const n = LIB.layout; if (n && n.t === 'split') { n.r = 0.66; layoutChanged(); } }, el: () => document.querySelector('.gutter'), pad: 10, title: 'Resize', text: 'Drag the line between two windows to make one bigger. It clicks into place at halves, thirds and quarters (hold Alt to place it freely). Double-click the line to make both halves equal.' },
    { before: () => { const l = leaves().find(x => x.p === 'pads'); if (l) { l.p = 'effects'; l.s = {}; layoutChanged(); } }, el: tileOf('effects'), title: '⇄ Show something else', text: '⇄ swaps what a window shows without changing the layout: the pads window now shows the effects.' },
    { before: () => { const a = leaves().find(x => x.p === 'playlist'), b = leaves().find(x => x.p === 'effects'); if (a && b) dockLeaf(b.id, a, 'top'); }, el: tileHead('effects'), title: 'Dock: drag by the title', text: ['Drag a window by its title onto another one. Near an edge, it docks on that side; on the middle, the two trade places.', 'We just docked the effects above the tracks.'] },
    { el: '#layoutBtn', title: 'Save your layout', text: 'Layouts › "Save this layout…" keeps an arrangement under a name, to come back to it with one click. "Clear the canvas" starts over.' },
    // what each window is for
    { before: lay(presetTree('Build playlists')), el: tileOf('online'), title: 'Online library', text: ['Free music and sound effects from Tabletop Audio, Incompetech, Openverse and Freesound, each credited as it plays.', '🎧 previews on this computer only. + Queue, Playlist ▾ and Pad add a result; ⭳ saves it to play offline. Tick several to add them all at once.'] },
    { el: tileOf('youtube'), title: 'YouTube', text: 'Search YouTube or paste a link, listen first, and save just the sound to Music › Critter Sounds › YouTube. It lands in a "YouTube" playlist. Only download what you may use.' },
    { el: tileOf('playlist'), title: 'Building a playlist', text: 'The playlist on the right fills as you add from the online library or YouTube. The layout you\'re looking at is "Build playlists".' },
    { before: lay(presetTree('Run a game')), el: tileOf('pads'), title: 'Sound pads', text: ['One click plays a sound effect; a second click stops it. Keys 1 to 9 play the first nine.', 'Pads get an icon and a group by their name. Right-click one to change its group, tag, colour or icon. ⟳ makes a pad loop until you stop it; the music dips while a pad plays.'] },
    { el: tileOf('scapes'), title: 'Soundscapes', text: ['A soundscape is a living background built from layers: rain that comes and goes, a tavern with the odd clatter.', '▶ plays one (only one at a time). ✎ Edit opens the soundscape editor, which has its own guided first loop.'] },
    { el: tileOf('scenes'), title: 'Scenes', text: 'A scene remembers a playlist with its effects, volume and repeat. Starting one crossfades into it: from the tavern to a fight in one click.' },
    { el: tileOf('effects'), title: 'Effects', text: 'Reverb, radio, muffle, crackle and more, with presets like "Underwater" and "Old gramophone". They play on everyone\'s computer and never make the music louder.' },
    { before: lay(SP('row', 0.5, SP('col', 0.5, L('fades'), L('log')), SP('col', 0.5, L('web'), L('bots')))), el: tileOf('fades'), title: 'Fades', text: 'How long songs take to fade in and out, and whether one track crossfades into the next.' },
    { el: tileOf('log'), title: 'Session log', text: 'What played when, session by session. It also shows as small notes in Critter VTT\'s chat (you can switch that off), and Copy gives the text.' },
    { el: tileOf('web'), title: 'Web source', text: 'Open any web page that plays sound, like an ambience site or a video, and its sound goes to the table.' },
    { el: tileOf('bots'), title: 'Discord & Fluxer', text: 'For groups that meet in a voice channel: a bot of your own joins and plays exactly what the table would hear. It signs in on its own once its token is saved.' },
    T_CONN,
    { el: '#themeBtn', title: 'Look', text: 'Change the highlight colours and the background: any colour you like.' },
    { el: '#miniBtn', title: 'Mini player', text: 'A small player that stays on top of other apps (Ctrl+M), with Up next and a few pads. Handy while you run the game in Critter VTT.' },
    { before: lay(presetTree('Run a game')), el: '#helpBtn', title: 'That\'s everything', text: ['Help has the quick tour, this tour, the setup, and the Help window with every shortcut.', 'Keep the "Run a game" layout, or go back to what you had?'], actions: finish }
  ];
}

// setup, the first time Critter Sounds starts (and from Help): where the group listens, some music, a layout, a tour
function onboarding() {
  if (document.querySelector('.modal.onb')) return;
  closeMenu(); Tour.end(false);
  const st = { step: 0, listen: '', sound: '', soundNote: '', layout: '', tour: '' };
  const card = h('div', { class: 'card onbc' }), box = h('div', { class: 'modal onb' }, card);
  const finish = () => {
    box.remove(); S().onboarded = true; save();
    if (st.layout === '-') applyLayout(null); else if (st.layout) applyLayout(presetTree(st.layout));
    if (st.listen === 'bots' && !leaves().some(l => l.p === 'bots')) openPanel('bots');
    if (st.sound === 'online' && !leaves().some(l => l.p === 'online')) openPanel('online');
    if (st.tour) setTimeout(() => startTour(st.tour), 300); else toast('All set. Help › Quick tour shows you around any time.');
  };
  const skip = () => { box.remove(); S().onboarded = true; save(); toast('Setup skipped. Help › Setup brings it back.'); };
  const choice = (key, val, icon, title, sub, extra) => h('button', { type: 'button', class: 'onbch' + (st[key] === val ? ' on' : ''), onclick: () => { st[key] = val; draw(); } }, h('span', { class: 'oi' }, ico(icon)), h('span', { class: 'ot' }, h('b', { text: title }), h('span', { text: sub })), extra || null);
  const STEPS = [
    () => [h('div', { class: 'onblogo' }, (document.querySelector('#top .brand svg') || h('span')).cloneNode(true)), window.APP_VERSION ? h('span', { class: 'appver notr', text: 'Version ' + window.APP_VERSION }) : null,
      h('h2', { text: 'Welcome to Critter Sounds' }),
      h('p', { text: 'Music, sound effects and ambience for your tabletop game, played live to everyone at your table: in Critter VTT, or in a Discord or Fluxer voice channel.' }),
      h('p', { class: 'hint', text: 'Three quick questions set it up for you. You can skip, and change everything later.' })],
    () => [h('h2', { text: 'Where does your group listen?' }),
      choice('listen', 'critter', 'home', 'In Critter VTT', 'Everyone hears it in their own Critter VTT, with their own volume.'),
      st.listen === 'critter' ? h('div', { class: 'onbsub' }, h('p', { class: 'hint', text: 'The lobby owner finds the music code in Critter VTT\'s Music window. You can also paste it into the top bar later.' }),
        h('div', { class: 'row' }, h('input', { type: 'text', class: 'grow', id: 'onbCode', placeholder: 'Music code, like 4TBCEF-EMJQE-SQSW5', value: $('#mcode').value }),
          h('button', { type: 'button', class: 'btn primary', text: 'Connect', onclick: () => { const v = $('#onbCode').value.trim(); if (!v) return; $('#mcode').value = v; connect(); toast('Connecting to the table…'); } }))) : null,
      choice('listen', 'bots', 'headphones', 'In Discord or Fluxer', 'A bot of your own plays into your voice channel. Its window opens when setup is done.'),
      choice('listen', 'here', 'music', 'Only here, on this computer', 'For trying it out, or a table where everyone sits in one room.')],
    () => [h('h2', { text: 'Where is your music?' }),
      choice('sound', 'folder', 'folder', 'A folder on this computer', st.soundNote || 'Pick a folder: it becomes a playlist. Nothing is uploaded.', st.sound === 'folder' && !st.soundNote ? h('span', { class: 'btn tiny primary', text: 'Choose…' }) : null),
      choice('sound', 'online', 'globe', 'Free music and sounds online', 'Tabletop Audio, Incompetech, Freesound and more. The online library opens when setup is done.'),
      choice('sound', 'later', 'clock', 'I\'ll add it later', 'Playlists › From a folder, whenever you like.')],
    () => [h('h2', { text: 'Pick a layout' }), h('p', { class: 'hint', text: 'A layout is a set of windows. Change it any time with Layouts in the top bar.' }),
      h('div', { class: 'onblay' }, ...PRESETS.filter(p => p.onb).map(p => h('button', { type: 'button', class: 'preset' + (st.layout === p.name ? ' on' : ''), onclick: () => { st.layout = p.name; draw(); } }, miniLayout(p.make()), h('b', { text: p.name }), h('span', { class: 'hint', text: p.desc }))),
        h('button', { type: 'button', class: 'preset' + (st.layout === '-' ? ' on' : ''), onclick: () => { st.layout = '-'; draw(); } }, h('div', { class: 'ml blankml' }, h('span', { text: '' })), h('b', { text: 'Empty' }), h('span', { class: 'hint', text: 'Start with nothing and add windows yourself' })))],
    () => [h('h2', { text: 'Want a quick look around?' }),
      choice('tour', 'basic', 'play', 'Quick tour', 'About two minutes: the screen, playing, and arranging windows.'),
      choice('tour', 'full', 'list', 'Full tour', 'About ten minutes: every window, and what you can do with it.'),
      choice('tour', '', 'check', 'No thanks', 'Both tours are in Help, any time.')]
  ];
  // picking "a folder" opens the folder chooser straight away
  const pickFolder = async () => { const p = await desk.pickFolder(); if (!p.length) { st.sound = ''; draw(); return; } await newPlaylistFrom(p); const pl = LIB.playlists[LIB.playlists.length - 1]; st.soundNote = pl ? `Done: "${pl.name}" with ${pl.items.length} track${pl.items.length === 1 ? '' : 's'}.` : 'Done.'; draw(); };
  const draw = () => {
    if (st.step === 2 && st.sound === 'folder' && !st.soundNote && !st.picking) { st.picking = true; pickFolder().finally(() => { st.picking = false; }); }
    if (st.step === 3 && !st.layout) st.layout = st.listen === 'bots' ? 'Voice chat game' : st.sound === 'online' ? 'Build playlists' : 'Run a game';
    if (st.step === 1 && st.listen === 'here' && !S().monitor) { $('#monOn').checked = true; $('#monOn').dispatchEvent(new Event('change')); }
    const last = st.step === STEPS.length - 1;
    card.replaceChildren(
      h('div', { class: 'onbdots' }, ...STEPS.map((_, i) => h('i', { class: i === st.step ? 'on' : i < st.step ? 'done' : '' })), h('span', { class: 'grow' }), h('button', { type: 'button', class: 'btn tiny ghost', text: 'Skip setup', onclick: skip })),
      h('div', { class: 'onbbody' }, ...STEPS[st.step]()),
      h('div', { class: 'row end' },
        st.step ? h('button', { type: 'button', class: 'btn ghost', text: 'Back', onclick: () => { st.step--; draw(); } }) : null,
        h('span', { class: 'grow' }),
        h('button', { type: 'button', class: 'btn primary', text: st.step === 0 ? 'Let\'s go' : last ? (st.tour ? 'Start the tour' : 'Done') : 'Next', onclick: () => { if (last) finish(); else { st.step++; draw(); } } })));
  };
  draw(); document.body.append(box);
}
function helpMenu(anchor) {
  popMenu(anchor, [{ head: 'Learn Critter Sounds' },
    { label: 'Quick tour', sub: 'Two minutes: the screen, playing, arranging windows', icon: 'play', fn: () => startTour('basic') },
    { label: 'Full tour', sub: 'Every window and what it\'s for', icon: 'list', fn: () => startTour('full') },
    { label: 'Setup', sub: 'Where your group listens, your music, a layout', icon: 'sparkle', fn: onboarding },
    '-',
    { label: 'Show all tips again', sub: 'The light blue boxes you closed with ✕', icon: 'refresh', fn: resetTips },
    { label: 'Settings…', sub: 'Language, folders, keys and more', icon: 'gear', fn: settings },
    { label: 'Help window', sub: 'Shortcuts, tips and thanks', icon: 'help', fn: () => { const l = leaves().find(x => x.p === 'help'); if (l) touch(l); else openPanel('help'); } },
    ...(desk.updates ? ['-', { label: 'Check for updates…', sub: 'A newer Critter Sounds, from GitHub', icon: 'refresh', fn: () => desk.updates.check() },
      { label: 'Critter Sounds on GitHub', sub: 'The code, the releases and what changed', icon: 'github', fn: () => desk.updates.github() }] : [])]);
}

/* ---------- settings: what's useful now and then, but needn't be on screen ---------- */
async function settings() {
  if (document.querySelector('.modal')) return;
  closeMenu();
  const s = S(), dir = await desk.csDir().catch(() => ({ dir: '' })), upd = desk.updates ? await desk.updates.get().catch(() => null) : null;
  const SETSEC = { General: 'gear', Accessibility: 'font', Sound: 'sliders', Folders: 'folder', Connection: 'link', 'Tips and help': 'help', Reset: 'refresh' };
  const sec = (title, ...kids) => h('section', { class: 'setsec' }, h('div', { class: 'sec', icon: SETSEC[title] || 'sliders', text: title }), ...kids);
  const chk = (label, sub, get, set) => h('label', { class: 'setchk' }, h('input', { type: 'checkbox', checked: !!get(), onchange: e => { set(e.target.checked); save(); } }), h('span', {}, h('b', { text: label }), sub ? h('small', { text: sub }) : null));
  const slider = (label, key, min, max, stepv, show) => h('div', { class: 'sl' }, h('span', { text: label }),
    h('input', { type: 'range', min, max, step: stepv, value: s[key], oninput: e => { s[key] = +e.target.value; e.target.nextSibling.textContent = show(s[key]); save(); if (key === 'prevVol' && ONLINE.preview) ONLINE.preview.volume = s.prevVol; } }), h('output', { text: show(s[key]) }));
  const dirLine = h('code', { class: 'setpath notr', text: dir.dir });
  const card = h('div', { class: 'card appear wide setc' },
    h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('gear')), h('b', { class: 'grow', text: 'Settings' }), h('button', { type: 'button', class: 'ib', text: '✕', onclick: () => box.remove() })),
    h('div', { class: 'setbody' },
      sec('General',
        h('div', { class: 'setrow' }, h('span', { text: 'Language' }), h('select', { onchange: async e => { s.lang = e.target.value; await desk.saveLib(LIB).catch(() => {}); await desk.reloadAll(); } },
          h('option', { value: 'auto', text: 'System language', selected: !s.lang || s.lang === 'auto' }), h('option', { value: 'en', text: 'English', selected: s.lang === 'en' }), h('option', { value: 'de', text: 'Deutsch', selected: s.lang === 'de' }))),
        h('div', { class: 'setrow' }, h('span', { text: 'Your name at the table' }), h('input', { type: 'text', value: s.name || '', maxLength: 40, placeholder: 'Critter Sounds', oninput: e => { s.name = e.target.value.trim() || 'Critter Sounds'; save(); pub(); } })),
        chk('Connect to the last table on start', 'Uses the music code from last time.', () => s.autoConnect !== false, v => { s.autoConnect = v; }),
        chk('Ask before quitting while something plays', '', () => s.confirmQuit !== false, v => { s.confirmQuit = v; }),
        chk('Media keys work even when the app is in the background', 'Play, pause, next, previous and stop on the keyboard.', () => s.mediaKeys !== false, v => { s.mediaKeys = v; desk.mediaKeys(v); })),
      sec('Accessibility',
        chk('A font for dyslexia', "OpenDyslexic, with a little more space between lines and words. Its letters have heavier bottoms, so they don't flip or swap.",
          () => (s.theme || {}).fonts === DYS_SET,
          v => { const t = s.theme || (s.theme = { ...DEF().theme }); if (v) { if (t.fonts !== DYS_SET) t.fontsBefore = t.fonts || 'Easy reading'; t.fonts = DYS_SET; } else t.fonts = t.fontsBefore && t.fontsBefore !== DYS_SET ? t.fontsBefore : 'Easy reading'; applyTheme(); })),
      sec('Sound',
        slider('Music dips under pads to', 'duck', 0, 1, 0.05, v => Math.round(v * 100) + '%'),
        slider('Pause fade', 'pauseFade', 0, 5, 0.1, v => v.toFixed(1) + 's'),
        slider('Preview volume', 'prevVol', 0, 1, 0.05, v => Math.round(v * 100) + '%'),
        chk('Show what plays in Critter VTT\'s chat', 'Small notes in the lobby\'s chat, from the session log.', () => s.chatLog !== false, v => { s.chatLog = v; })),
      sec('Folders',
        h('p', { class: 'hint', text: 'Downloads, YouTube, soundscapes and rendered loops go here. Moving it doesn\'t move what\'s already saved.' }),
        dirLine,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn tiny', text: '📂 Open', onclick: () => desk.scape.folder('') }),
          h('button', { type: 'button', class: 'btn tiny', text: 'Change…', disabled: dir.fixed, onclick: async () => { const d = await desk.csDirPick(false); if (d) { dirLine.textContent = d; toast('New downloads and loops go to ' + d); } } }),
          dir.custom ? h('button', { type: 'button', class: 'btn tiny ghost', text: 'Back to the Music folder', onclick: async () => { dirLine.textContent = await desk.csDirPick(true); } }) : null),
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn tiny ghost', text: 'Open the app\'s data folder', title: 'Your library, settings and bot tokens', onclick: () => desk.dataFolder() }),
          h('button', { type: 'button', class: 'btn tiny ghost', text: 'Back up the library…', title: 'Playlists, pads, scenes, layouts and settings, as one file', onclick: async () => { await desk.saveLib(LIB).catch(() => {}); const f = await desk.libBackup(); if (f) toast('Saved a backup: ' + f); } }))),
      sec('Connection',
        h('div', { class: 'row' }, h('span', { class: 'grow hint', text: 'Homebase connects this app to Critter VTT. Use the same one as your table.' }), h('button', { type: 'button', class: 'btn tiny', text: 'Homebase…', onclick: () => { box.remove(); if (window.CRITTER_DESKTOP) window.CRITTER_DESKTOP.changeHomebase(); } }))),
      upd ? sec('Updates',
        h('label', { class: 'setchk' }, h('input', { type: 'checkbox', checked: upd.auto, onchange: e => desk.updates.set(e.target.checked) }), h('span', {}, h('b', { text: 'Check for updates when Critter Sounds starts' }), h('small', { text: 'A quiet look a few seconds after starting; it only speaks up when there is something new.' }))),
        h('div', { class: 'row' }, h('span', { class: 'grow hint notr', text: 'Critter Sounds ' + upd.version }),
          h('button', { type: 'button', class: 'btn tiny', text: 'Check for updates', onclick: () => desk.updates.check() }),
          h('button', { type: 'button', class: 'btn tiny ghost', text: 'GitHub', title: 'Critter Sounds on GitHub', onclick: () => desk.updates.github() })),
        h('p', { class: 'hint', text: 'Made with love by booskers / Polychrome.' })) : null,
      sec('Tips and help',
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn tiny', text: 'Show all tips again', onclick: resetTips }),
          h('button', { type: 'button', class: 'btn tiny', text: 'Run the setup again', onclick: () => { box.remove(); onboarding(); } }),
          h('button', { type: 'button', class: 'btn tiny ghost', text: 'Quick tour', onclick: () => { box.remove(); startTour('basic'); } }))),
      sec('Reset',
        h('div', { class: 'row' }, h('span', { class: 'grow hint', text: 'Puts every setting back as it was at first. Playlists, pads, scenes, soundscapes and layouts stay.' }),
          h('button', { type: 'button', class: 'btn tiny bad', text: 'Reset all settings', onclick: async () => {
            if (!confirm('Reset all settings? Playlists, pads, scenes, soundscapes and layouts stay.')) return;
            const keep = { lobby: s.lobby, key: s.key, fsKey: s.fsKey, onboarded: true };
            LIB.set = { ...DEF(), ...keep }; await desk.saveLib(LIB).catch(() => {}); await desk.reloadAll();
          } })))));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) box.remove(); } }, card);
  document.body.append(box); paintRanges(card);
}

/* ---------- the queue, on the right ---------- */
function renderQueue() {
  const box = $('#queue'); if (!box) return;
  document.body.classList.toggle('noqueue', !S().queueOpen);
  if (!S().queueOpen) { box.replaceChildren(); return; }
  const keep = box.querySelector('.qlist') ? box.querySelector('.qlist').scrollTop : 0, af = document.activeElement && box.contains(document.activeElement) && document.activeElement.dataset.k ? document.activeElement : null, afv = af && [af.value, af.selectionStart];
  const c = E.cur, playingNow = c && c.item && E.state !== 'stop';
  const nowBox = h('div', { class: 'qnow' + (playingNow ? '' : ' idle') },
    h('div', { class: 'sec', icon: 'play', text: 'Now playing' }),
    h('div', { class: 'qt', text: playingNow ? c.item.title : 'Nothing' }),
    h('div', { class: 'hint', text: playingNow ? (c.kind === 'web' ? 'From a web page' : [c.item.source || (E.q && plById(E.q.plId) && keyOf(c.item) && plById(E.q.plId).items.some(i => i.id === c.item.id) ? plById(E.q.plId).name : 'This computer'), c.item.license].filter(Boolean).join(' · ')) : LIB.queue.length ? 'Press play to start the queue.' : 'Play a track, or add some to the queue.' }));
  const list = h('ol', { class: 'qlist' });
  LIB.queue.forEach((q, i) => {
    const li = h('li', { class: 'qi', draggable: true, title: q.item.credit || keyOf(q.item) },
      h('span', { class: 'qh', title: 'Drag to reorder' }, ico('grip')), h('span', { class: 'qn', text: String(i + 1) }),
      h('div', { class: 'qtx' }, h('div', { class: 'qtt', text: q.item.title }), h('div', { class: 'hint', text: [q.item.source || (q.item.path ? 'This computer' : 'Online'), q.item.dur ? fmt(q.item.dur) : ''].filter(Boolean).join(' · ') })),
      h('button', { type: 'button', class: 'ib', text: '▶', title: 'Play it now', onclick: () => { dequeue(q.qid); transition(q.item, startFade()); } }),
      h('button', { type: 'button', class: 'ib', text: '✕', title: 'Take it off the queue', onclick: () => dequeue(q.qid) }));
    li.dataset.qid = q.qid;
    li.ondblclick = () => { dequeue(q.qid); transition(q.item, startFade()); };
    li.ondragstart = e => { e.dataTransfer.setData('text/x-q', q.qid); e.dataTransfer.effectAllowed = 'move'; };
    li.ondragover = e => { if (e.dataTransfer.types.includes('text/x-q') || e.dataTransfer.types.includes('text/x-cbm')) { e.preventDefault(); li.classList.add('dragover'); } };
    li.ondragleave = () => li.classList.remove('dragover');
    li.ondrop = e => { e.preventDefault(); e.stopPropagation(); li.classList.remove('dragover'); queueDrop(e, LIB.queue.indexOf(q)); };
    list.append(li);
  });
  // after the queue, a look at what the playlist plays next
  const ctx = contextOrder(), then = [];
  if (ctx && S().loop !== 'one') {
    let pos = ctx.order.indexOf(c && c.item ? c.item.id : ''); if (pos < 0) pos = ctx.order.indexOf(E.q.lastId);
    for (let k = 1; k <= Math.min(6, ctx.order.length - 1 + (pos < 0 ? 1 : 0)); k++) { let p = pos + k; if (p >= ctx.order.length) { if (S().loop === 'off' || S().shuffle) break; p %= ctx.order.length; } const it = ctx.pl.items.find(x => x.id === ctx.order[p]); if (it) then.push(it); }
  }
  const add = h('input', { type: 'text', class: 'qadd', 'data-k': 'qadd', placeholder: '＋ Add a track: type to search your playlists' });
  const found = h('div', { class: 'qfound' });
  add.oninput = () => {
    const t = add.value.trim().toLowerCase(); found.replaceChildren(); if (t.length < 2) return;
    const hits = []; for (const pl of LIB.playlists) for (const it of pl.items) if (it.title.toLowerCase().includes(t)) { hits.push([it, pl]); if (hits.length >= 8) break; }
    if (!hits.length) found.append(h('div', { class: 'hint', text: 'Nothing in your playlists matches.' }));
    for (const [it, pl] of hits) found.append(h('button', { type: 'button', class: 'qfb', onclick: () => { enqueue([it]); add.value = ''; found.replaceChildren(); } }, h('span', { text: it.title }), h('span', { class: 'hint', text: pl.name })));
  };
  add.onkeydown = e => { if (e.key === 'Enter') { const b = found.querySelector('.qfb'); if (b) b.click(); } if (e.key === 'Escape') { add.value = ''; found.replaceChildren(); } };
  box.replaceChildren(...[nowBox,
    h('div', { class: 'qhead' }, h('div', { class: 'sec', icon: 'queue', text: `Up next${LIB.queue.length ? ` (${LIB.queue.length})` : ''}` }), h('span', { class: 'grow' }),
      LIB.queue.length ? h('button', { type: 'button', class: 'btn tiny ghost', text: '🔀 Shuffle', onclick: () => { LIB.queue = shuffled(LIB.queue); save(); queueChanged(); } }) : null,
      LIB.queue.length ? h('button', { type: 'button', class: 'btn tiny ghost', text: '🗑 Clear', onclick: () => { LIB.queue = []; save(); queueChanged(); } }) : null),
    add, found,
    LIB.queue.length ? list : h('div', { class: 'qempty', text: 'The queue is empty. Use + Queue on a track or an online result, or drag tracks here.' }),
    then.length ? h('div', { class: 'qthen' }, h('div', { class: 'sec', icon: 'music', text: `Then from ${ctx.pl.name}${S().shuffle ? ' (shuffled)' : ''}` }), ...then.map(it => h('div', { class: 'qti', title: 'Double-click to play it now', ondblclick: () => playItem(ctx.pl, it) }, h('span', { text: it.title }), h('span', { class: 'hint', text: it.dur ? fmt(it.dur) : '' })))) : null, padsNowEl()].filter(Boolean));
  const ql = box.querySelector('.qlist'); if (ql) ql.scrollTop = keep;
  if (afv) { add.value = afv[0]; add.focus(); try { add.setSelectionRange(afv[1], afv[1]); } catch {} add.oninput(); }
  box.ondragover = e => { if (e.dataTransfer.types.includes('text/x-cbm') || e.dataTransfer.types.includes('text/x-q')) { e.preventDefault(); box.classList.add('dropzone'); } };
  box.ondragleave = e => { if (!box.contains(e.relatedTarget)) box.classList.remove('dropzone'); };
  box.ondrop = e => { e.preventDefault(); box.classList.remove('dropzone'); queueDrop(e, LIB.queue.length); };
}
// drops on the queue: queue items move, tracks from a playlist are added at that spot
function queueDrop(e, at) {
  const qid = e.dataTransfer.getData('text/x-q');
  if (qid) { const q = LIB.queue.find(x => x.qid === qid); if (!q) return; const from = LIB.queue.indexOf(q); LIB.queue.splice(from, 1); LIB.queue.splice(at > from ? at - 1 : at, 0, q); save(); queueChanged(); return; }
  const ids = e.dataTransfer.getData('text/x-cbm');
  if (ids) {
    const want = ids.split(','), items = LIB.playlists.flatMap(p => p.items).filter(i => want.includes(i.id)).filter(it => !queued(it));
    if (!items.length) return;
    LIB.queue.splice(clamp(at, 0, LIB.queue.length), 0, ...items.map(it => ({ qid: uid(), item: clone(it) }))); save(); queueChanged();
    toast(`Queued ${items.length > 1 ? items.length + ' tracks' : items[0].title}.`);
  }
}

/* ============================== the bar, connection and painting ============================== */
function chip(text, cls) { const c = $('#connState'); c.textContent = text; c.className = 'chip ' + (cls || ''); }
function hint(text, cls) { const c = $('#connHint'); c.textContent = text; c.className = 'connhint ' + (cls || ''); }
function paintConn() {
  if (!NET.on) return;
  const table = NET.peers.filter(p => !p.sameTab && !(p.presence && (p.presence.dj || p.presence.app))).length;
  const live = [...NET.L.values()].filter(l => l.pc.connectionState === 'connected').length;
  const rc = NET.room && NET.room.connected();
  chip(rc ? `${NET.code} · ${live}/${table} hearing it` : `${NET.code} · reconnecting…`, !rc ? 'warn' : live ? 'ok' : '');
  const ks = NET.keyState;
  if (ks === 'none') hint('That\'s only the lobby code. Paste the whole music code from Critter VTT\'s Music window (the lobby owner has it); the table only plays music from an app that has it.', 'warn');
  else if (ks === 'off') hint('The lobby owner hasn\'t made a music code yet (Critter VTT › Music), so the table won\'t play this app.', 'warn');
  else if (ks === 'bad') hint('That music code is out of date: the owner made a new one. Copy it again from Critter VTT\'s Music window.', 'bad');
  else if (NET.otherDj) hint('Another Critter Sounds app is in this lobby too. The table plays whichever joined first.', 'warn');
  else if (!table) hint('Connected. Nobody has the table open yet; they\'ll hear the music as soon as they do.');
  else hint('');
}
/* ---------- the cover in the bar, and its colour bleeding into the bar ---------- */
// The picture in the file (or its folder, or a YouTube thumbnail, or the online library's), else a colour from the title.
const ART = { key: '', tok: 0 };
function artColour(img) {
  try {
    const c = document.createElement('canvas'); c.width = c.height = 24; const x = c.getContext('2d', { willReadFrequently: true });
    x.drawImage(img, 0, 0, 24, 24); const d = x.getImageData(0, 0, 24, 24).data;
    // colourful, mid-bright pixels count most, so a cover's character wins over its dark or grey parts
    let r = 0, g = 0, b = 0, w = 0;
    for (let i = 0; i < d.length; i += 4) { const R = d[i], G = d[i + 1], B = d[i + 2], mx = Math.max(R, G, B), mn = Math.min(R, G, B), sat = mx ? (mx - mn) / mx : 0, k = 0.05 + sat * sat * (mx > 40 && mx < 250 ? 1 : 0.2); r += R * k; g += G * k; b += B * k; w += k; }
    return w ? `rgb(${Math.round(r / w)} ${Math.round(g / w)} ${Math.round(b / w)})` : '';
  } catch { return ''; }
}
function paintArt(c) {
  const it = c && c.item, key = it ? keyOf(it) + '|' + (it.img || '') : c && c.kind === 'web' ? 'web' : '';
  if (key === ART.key) return; ART.key = key;
  const tok = ++ART.tok, box = $('#nowArt'), glow = $('#barGlow'), bar = $('#bar'), root = document.documentElement.style;
  const plain = () => { box.style.backgroundImage = ''; box.classList.remove('has'); glow.style.backgroundImage = ''; bar.classList.remove('art'); bar.classList.toggle('tint', !!it); root.setProperty('--art', it ? `hsl(${hashStr(it.title || '') % 360} 65% 55%)` : 'var(--accent)'); };
  if (!it) { plain(); return; }
  const urls = [it.path && 'app://music/cover?p=' + encodeURIComponent(it.path), it.img && remoteUrl(it.img)].filter(Boolean);
  const next = i => {
    if (tok !== ART.tok) return;
    if (i >= urls.length) { plain(); return; }
    const img = new Image();
    img.onload = () => { if (tok !== ART.tok) return; const u = `url("${urls[i]}")`; box.style.backgroundImage = u; box.classList.add('has'); glow.style.backgroundImage = u; bar.classList.add('art'); bar.classList.remove('tint'); root.setProperty('--art', artColour(img) || 'var(--accent)'); };
    img.onerror = () => next(i + 1);
    img.src = urls[i];
  };
  next(0);
}
function paint() {
  const c = E.cur, st = E.state;
  queueMicrotask(() => { for (const b of document.querySelectorAll('#bar .tb')) if (b.title) b.setAttribute('aria-label', b.title); });
  paintArt(c);
  $('#nowTitle').textContent = c && c.item ? c.item.title : 'Nothing playing';
  const pl = E.q && plById(E.q.plId), fromPl = pl && c && c.item && pl.items.some(i => i.id === c.item.id);
  const sub = st === 'stopping' ? 'Fading out… press stop again to stop at once' : st === 'changing' ? 'Fading out before the next track…' : st === 'pause' ? 'Paused' : st === 'stop' ? (c ? 'Stopped' : LIB.queue.length ? `${LIB.queue.length} in the queue` : '') : c && c.kind === 'web' ? 'From the web page' : [fromPl ? `From ${pl.name}` : 'From the queue', c && c.item && c.item.license ? `${c.item.source || 'online'}, ${c.item.license}` : ''].filter(Boolean).join(' · ');
  $('#nowSub').textContent = sub; $('#nowSub').title = c && c.item && c.item.credit || ''; $('#nowSub').className = 'nowsub' + (st === 'stopping' ? ' warn' : '');
  $('#playBtn').replaceChildren(ico(st === 'play' ? 'pause' : 'play')); $('#playBtn').title = st === 'play' ? 'Pause (Space)' : 'Play (Space)';
  $('#stopBtn').classList.toggle('armed', st === 'stopping' || st === 'changing');
  document.body.classList.toggle('playing', st === 'play');
  $('#stopBtn').title = st === 'stopping' || st === 'changing' ? 'Press again to stop at once' : 'Stop with a fade; press again to stop at once (S)';
  $('#shuffleBtn').setAttribute('aria-pressed', String(S().shuffle));
  $('#loopBtn').replaceChildren(ico({ all: 'repeat', one: 'repeat1', off: 'arrow' }[S().loop])); $('#loopBtn').title = { all: 'Repeat the playlist', one: 'Repeat this track', off: 'No repeat' }[S().loop];
  $('#loopBtn').setAttribute('aria-pressed', String(S().loop !== 'off'));
  $('#queueBtn').classList.toggle('on', S().queueOpen);
  document.title = c && c.item && st === 'play' ? `♪ ${c.item.title} · Critter Sounds` : 'Critter Sounds';
  $('#winTitle').textContent = c && c.item && st !== 'stop' ? `${st === 'pause' ? '❚❚' : '♪'} ${c.item.title}` : '';
  document.querySelectorAll('[data-plid]').forEach(b => b.classList.toggle('playing', !!(E.q && b.dataset.plid === E.q.plId && st === 'play')));
  document.querySelectorAll('.tracks tr[data-id]').forEach(tr => tr.classList.toggle('cur', !!(c && c.item && tr.dataset.id === c.item.id && st !== 'stop')));
  paintTime();
}
function paintTime() {
  const c = E.cur, sk = $('#seek');
  if (c && c.kind === 'file' && !c.pending) {
    const el = c.d.el, dur = isFinite(el.duration) ? el.duration : (c.item.dur || 0);
    if (document.activeElement !== sk) { sk.max = String(Math.max(1, dur)); sk.value = String(el.currentTime); }
    sk.disabled = false; $('#tCur').textContent = fmt(el.currentTime); $('#tDur').textContent = fmt(dur); paintRange(sk);
  } else { sk.disabled = true; sk.value = '0'; $('#tCur').textContent = c && c.kind === 'web' ? 'live' : '0:00'; $('#tDur').textContent = ''; }
}
const meterBuf = new Float32Array(512);
function meter() {
  if (analyser) analyser.forEach((a, i) => { a.getFloatTimeDomainData(meterBuf); let pk = 0; for (const v of meterBuf) pk = Math.max(pk, Math.abs(v)); $(i ? '#meterR' : '#meterL').style.width = Math.min(100, Math.sqrt(pk) * 100) + '%'; });
  requestAnimationFrame(meter);
}
setInterval(paintTime, 500);

/* ---------- settings and controls ---------- */
function applySettings() {
  const s = S();
  if (master) master.gain.setTargetAtTime(s.vol, ac.currentTime, 0.05);
  if (monG) monG.gain.setTargetAtTime(s.monitor ? s.monVol : 0, ac.currentTime, 0.05);
  if (monFx) monFx.set(s.fx);
  for (const d of decks) d.el.loop = s.loop === 'one' && E.cur && E.cur.d === d;
  $('#vol').value = Math.round(s.vol * 100); $('#volV').textContent = Math.round(s.vol * 100);
  $('#monOn').checked = s.monitor; $('#monVol').value = Math.round(s.monVol * 100); $('#monV').textContent = Math.round(s.monVol * 100);
  paintRanges($('#bar')); paint();
}
function bind() {
  $('#vol').oninput = e => { S().vol = +e.target.value / 100; $('#volV').textContent = e.target.value; master.gain.setTargetAtTime(S().vol, ac.currentTime, 0.05); save(); };
  $('#monOn').onchange = e => { S().monitor = e.target.checked; applySettings(); save(); };
  $('#monVol').oninput = e => { S().monVol = +e.target.value / 100; S().monitor = true; applySettings(); save(); };
  $('#playBtn').onclick = playPause; $('#stopBtn').onclick = stop; $('#nextBtn').onclick = next; $('#prevBtn').onclick = prev;
  $('#shuffleBtn').onclick = () => { S().shuffle = !S().shuffle; const pl = E.q && plById(E.q.plId); if (pl) setContext(pl, E.cur && E.cur.item ? E.cur.item.id : ''); save(); paint(); renderQueue(); toast(S().shuffle ? 'Shuffle on' : 'Shuffle off'); };
  $('#loopBtn').onclick = () => { S().loop = { all: 'one', one: 'off', off: 'all' }[S().loop]; applySettings(); save(); renderQueue(); toast({ all: 'Repeating the playlist', one: 'Repeating this track', off: 'No repeat' }[S().loop]); };
  $('#seek').onchange = e => seek(+e.target.value);
  $('#conn').onsubmit = e => { e.preventDefault(); if (NET.on) disconnect(); else connect(); };
  $('#mcode').addEventListener('input', e => { const p = e.target.selectionStart; e.target.value = e.target.value.toUpperCase(); e.target.setSelectionRange(p, p); });
  $('#hbBtn').onclick = () => window.CRITTER_DESKTOP && window.CRITTER_DESKTOP.changeHomebase();
  $('#miniBtn').onclick = toggleMini;
  $('#themeBtn').onclick = appearance;
  // the top bar's and the transport's icons
  for (const [id, ic, label] of [['openBtn', 'plus', 'Windows'], ['layoutBtn', 'layout', 'Layouts'], ['helpBtn', 'help', 'Help'], ['folderBtn', 'folder', ''], ['setBtn', 'gear', ''], ['queueBtn', 'queue', 'Queue'], ['themeBtn', 'palette', ''], ['hbBtn', 'home', ''], ['miniBtn', 'mini', '']]) { const b = $('#' + id); b.replaceChildren(ico(ic), ...(label ? [h('span', { text: label })] : [])); b.classList.toggle('icon-only', !label); if (!label) b.setAttribute('aria-label', b.title); }
  for (const [id, ic] of [['shuffleBtn', 'shuffle'], ['prevBtn', 'prev'], ['stopBtn', 'stop'], ['nextBtn', 'next']]) $('#' + id).replaceChildren(ico(ic));
  // the title bar: the menu, and the window's own buttons
  $('#appMenu').onclick = () => { const r = $('#appMenu').getBoundingClientRect(); desk.winCmd('menu', { x: r.left, y: r.bottom }); };
  $('.wb-min').onclick = () => desk.winCmd('min'); $('.wb-max').onclick = () => desk.winCmd('max'); $('.wb-close').onclick = () => desk.winCmd('close');
  desk.onWinState(s => { document.body.classList.toggle('wmax', !!s.max); document.body.classList.toggle('wblur', !s.focus); document.body.classList.toggle('wfull', !!s.full); $('.wb-max').title = $('.wb-max').ariaLabel = s.max ? 'Restore' : 'Maximize'; });
  setLabel($('#connBtn'), '🔗 Connect');
  $('#openBtn').onclick = e => windowMenu(e.currentTarget);
  $('#helpBtn').onclick = e => helpMenu(e.currentTarget);
  $('#folderBtn').onclick = () => desk.scape.folder('');
  $('#setBtn').onclick = settings;
  $('#layoutBtn').onclick = e => layoutMenu(e.currentTarget);
  $('#queueBtn').onclick = () => { S().queueOpen = !S().queueOpen; save(); renderQueue(); paint(); };
  $('#sleep').onchange = e => setSleep(+e.target.value);
  $('#sink').onchange = e => { S().sink = e.target.value; save(); if (ac.setSinkId) ac.setSinkId(e.target.value).catch(() => toast('That output isn\'t available.')); };
  addEventListener('keydown', onKey);
  desk.onKey(k => { if (k === 'appearance') appearance(); else if (k === 'toggle') playPause(); else if (k === 'next') next(); else if (k === 'prev') prev(); else if (k === 'stop') stop(); else if (k === 'mini') toggleMini(); else if (k === 'tour-basic') startTour('basic'); else if (k === 'tour-full') startTour('full'); else if (k === 'setup') onboarding(); else if (k === 'settings') settings(); });
  desk.onWeb(st => { WEB.state = st; if (!st.open && E.cur && E.cur.kind === 'web' && E.state !== 'stop') { hardStop(); toast('The web page was closed.'); } renderPanels('web'); if (E.cur && E.cur.kind === 'web' && st.title) { E.cur.item.title = st.title; paint(); pub(); renderQueue(); } });
  desk.onCloseAsked(() => { if (S().confirmQuit !== false && (E.state === 'play' || E.state === 'stopping' || SC.run) && !confirm('Music is still playing for the table. Quit anyway?')) return; desk.quitOk(); });
  navigator.mediaDevices.addEventListener('devicechange', fillSinks);
  addEventListener('resize', () => closeMenu());
}
function onKey(e) {
  if (document.querySelector('.modal')) return;
  if (e.target.matches('input[type=text],input[type=url],input:not([type]),textarea,select') && e.key !== 'Escape') return;
  const leaf = focusedLeaf();
  if (e.ctrlKey && e.key.toLowerCase() === 'f') { const s = (leaf && document.querySelector(`.tbod[data-id="${leaf.id}"] .search`)) || $('.search'); if (s) { e.preventDefault(); s.focus(); } return; }
  if (e.ctrlKey || e.altKey || e.metaKey) return;
  const c = E.cur, plLeaf = focusedLeaf('playlist'), pl = plLeaf && plById(plLeaf.s.plId);
  if (e.key === ' ') { e.preventDefault(); playPause(); }
  else if (e.key.toLowerCase() === 's') stop();
  else if (e.key.toLowerCase() === 'n') next();
  else if (e.key.toLowerCase() === 'p') prev();
  else if (e.key.toLowerCase() === 'q' && pl && sel.size) enqueue(pl.items.filter(i => sel.has(i.id)));
  else if (e.key === 'ArrowRight' && c && c.kind === 'file' && !c.pending) seek(c.d.el.currentTime + 10);
  else if (e.key === 'ArrowLeft' && c && c.kind === 'file' && !c.pending) seek(Math.max(0, c.d.el.currentTime - 10));
  else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); S().vol = clamp(S().vol + (e.key === 'ArrowUp' ? 0.05 : -0.05), 0, 1); applySettings(); save(); }
  else if (/^[1-9]$/.test(e.key) && LIB.pads[+e.key - 1]) playPad(LIB.pads[+e.key - 1]);
  else if (e.key === 'Delete' && pl) removeSel(pl);
  else if (e.key === 'Enter' && pl && sel.size) { const it = pl.items.find(i => sel.has(i.id)); if (it) playItem(pl, it); }
  else if (e.key === 'Escape') { closeMenu(); if (document.body.classList.contains('mini')) toggleMini(); }
}
const MINI = { tab: '', q: '' };
const miniHeight = () => (MINI.tab ? 520 : 250);
async function toggleMini() { const on = !document.body.classList.contains('mini'); document.body.classList.toggle('mini', on); await desk.mini(on, miniHeight()); renderMini(); }
function miniTab(t) { MINI.tab = MINI.tab === t ? '' : t; desk.mini(true, miniHeight()); renderMini(); }
// the mini player's own small queue (drag to reorder) and small pads
function renderMini() {
  const box = $('#miniX'); if (!box || !document.body.classList.contains('mini')) return;
  const playing = padsPlaying.size;
  const tabs = h('div', { class: 'mx-tabs' },
    h('button', { type: 'button', class: MINI.tab === 'queue' ? 'on' : '', onclick: () => miniTab('queue') }, ico('queue'), h('span', { text: `Up next${LIB.queue.length ? ' ' + LIB.queue.length : ''}` })),
    h('button', { type: 'button', class: MINI.tab === 'pads' ? 'on' : '', onclick: () => miniTab('pads') }, ico('pads'), h('span', { text: 'Pads' }), playing ? h('b', { class: 'mx-n', text: String(playing) }) : null),
    h('span', { class: 'grow' }),
    playing ? h('button', { type: 'button', class: 'mx-stop' + (Date.now() < PADSTOP.until ? ' armed' : ''), title: 'Stop all pads: one press fades, a second stops at once', onclick: stopAllPads }, ico('stop'), h('span', { text: 'Pads' })) : null);
  const bodyEl = h('div', { class: 'mx-body' });
  if (MINI.tab === 'queue') {
    if (!LIB.queue.length) bodyEl.append(h('p', { class: 'hint', text: 'The queue is empty.' }));
    LIB.queue.forEach((q, i) => {
      const li = h('div', { class: 'qi', draggable: true }, h('span', { class: 'qh' }, ico('grip')), h('span', { class: 'qn', text: String(i + 1) }), h('div', { class: 'qtx' }, h('div', { class: 'qtt', text: q.item.title })),
        h('button', { type: 'button', class: 'ib', text: '▶', title: 'Play it now', onclick: () => { dequeue(q.qid); transition(q.item, startFade()); } }),
        h('button', { type: 'button', class: 'ib', text: '✕', title: 'Take it off the queue', onclick: () => dequeue(q.qid) }));
      li.ondragstart = e => { e.dataTransfer.setData('text/x-q', q.qid); e.dataTransfer.effectAllowed = 'move'; };
      li.ondragover = e => { if (e.dataTransfer.types.includes('text/x-q')) { e.preventDefault(); li.classList.add('dragover'); } };
      li.ondragleave = () => li.classList.remove('dragover');
      li.ondrop = e => { e.preventDefault(); li.classList.remove('dragover'); queueDrop(e, LIB.queue.indexOf(q)); };
      bodyEl.append(li);
    });
  } else if (MINI.tab === 'pads') {
    const inp = h('input', { type: 'text', class: 'search', 'data-k': 'mxq', placeholder: 'Search pads', value: MINI.q, oninput: e => { MINI.q = e.target.value; renderMini(); } });
    const words = padWords(MINI.q), grid = h('div', { class: 'pads mini' });
    LIB.pads.filter(p => !words.length || words.every(w => padWords([p.name, p.group, p.tag].join(' ')).some(t => t.startsWith(w)))).forEach(p => grid.append(padTile(p, true)));
    bodyEl.append(inp, grid);
  }
  const a = document.activeElement, keep = a && box.contains(a) && a.dataset.k ? a.selectionStart : null;
  box.replaceChildren(...[tabs, MINI.tab ? bodyEl : null].filter(Boolean));
  if (keep !== null) { const f = box.querySelector('[data-k="mxq"]'); if (f) { f.focus(); f.setSelectionRange(keep, keep); } }
}

let sleepT = 0, sleepAt = 0;
function setSleep(min) {
  clearTimeout(sleepT); sleepAt = 0;
  if (!min) { toast('Sleep timer off.'); return; }
  sleepAt = Date.now() + min * 60000;
  sleepT = setTimeout(() => { if (E.state === 'play') { const was = S().fadeOut; S().fadeOut = Math.max(was, 10); stop(); S().fadeOut = was; } $('#sleep').value = '0'; sleepAt = 0; toast('Sleep timer: the music faded out.'); }, min * 60000);
  toast(`The music fades out and stops in ${min} minutes.`);
}
setInterval(() => { if (sleepAt) { const o = $('#sleep').selectedOptions[0]; if (o) o.textContent = `Stops in ${Math.ceil((sleepAt - Date.now()) / 60000)} min`; } else for (const o of $('#sleep').options) if (+o.value) o.textContent = o.value >= 60 ? `Stop in ${o.value / 60 === 1.5 ? '1½' : o.value / 60} hour${o.value > 60 ? 's' : ''}` : `Stop in ${o.value} min`; }, 15000);
async function fillSinks() {
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'audiooutput');
    const s = $('#sink'); s.replaceChildren(h('option', { value: '', text: 'This computer: default output' }), ...devs.filter(d => d.deviceId !== 'default').map(d => h('option', { value: d.deviceId, text: d.label || 'Output device' })));
    s.value = devs.some(d => d.deviceId === S().sink) ? S().sink : '';
  } catch {}
}

/* ---------- start ---------- */
(async () => {
  await loadLib();
  { const lang = I18N.pick(S().lang, await desk.sysLang().catch(() => '')); await desk.setLang(lang).catch(() => {}); I18N.start(lang); }
  applyTheme(); desk.yt.onProgress(ytProgress);
  initAudio(); bind(); applySettings(); renderAll(); fillSinks(); meter();
  $('#mcode').value = S().lobby ? showCode(S().lobby, S().key || '') : '';
  if (S().irPath) loadIR(S().irPath).catch(() => {});
  if (!S().onboarded) { if (LIB.playlists.length || LIB.pads.length) { S().onboarded = true; save(); } else setTimeout(onboarding, 300); }
  desk.webState();
  desk.scape.onCmd(onScapeCmd);
  desk.scape.onSaved(d => { const i = SC.list.findIndex(x => x.id === d.id); if (d.deleted) { if (i >= 0) SC.list.splice(i, 1); if (SC.active === d.id) stopScape(1); } else if (i >= 0) SC.list[i] = d; else SC.list.push(d); renderPanels('scapes'); });
  loadScapes();
  desk.bot.onEvent(onBotEvent);
  // bots set to join on start connect again (and then join their last channel)
  // a saved token signs in on start; with "Join the last channel on start" it goes back to that channel too
  desk.bot.cfg().then(c => { BOT.cfg = c; for (const s of Object.keys(c)) if (c[s].saved) { BOT.sel[s] = { guild: c[s].guild, channel: c[s].channel }; if (c[s].auto && c[s].channel) BOT.rejoin[s] = { guild: c[s].guild, channel: c[s].channel }; desk.bot.login(s).catch(() => {}); } }).catch(() => {});
  for (const l of leaves()) if (l.p === 'playlist' && plById(l.s.plId)) { checkMissing(plById(l.s.plId)); durQueue(plById(l.s.plId).items); }
  // back where you left off: the last lobby connects again on its own
  if (S().lobby && window.claude && S().autoConnect !== false) connect();
  if (S().mediaKeys === false) desk.mediaKeys(false);
  // the app hands over self-test settings just after the page loads
  for (let i = 0; i < 30 && !window.SELFTEST; i++) await sleep(100);
  if (window.SELFTEST) selftest(window.SELFTEST);
})();
// automated check used when building: connect, make a playlist from the given files and play
async function selftest(T) {
  if (T.code) { $('#mcode').value = T.code + '-' + (T.key || ''); await connect(); }
  if (T.files) { const p = await newPlaylistFrom(T.files, 'Selftest'); Object.assign(S(), T.set || {}); applySettings(); if (T.fx) { S().fx = mfxClean(T.fx); fxChanged(); } playItem(p, p.items[0]); }
  if (T.web) { await desk.webOpen(T.web); await sleep(3500); playWeb(); }
}
window.CBM = { startTour, onboarding, PANELS, BOT, SC, playScape, stopScape, loadScapes, guessScapeIcon, E, NET, WEB, LIB, ONLINE, decks, S, fxChanged, loadIR, playPad, enqueue, dequeue, nextEntry, openPanel, applyLayout, leaves, splitLeaf, closeLeaf, dockLeaf, PRESETS, duckG: () => duckG.gain.value, transition, stop, next, prev, pause, resume, playPause, playWeb, playNow, itemOf, preview, stopPreview, level: () => { const b = new Float32Array(512); analyser[0].getFloatTimeDomainData(b); let pk = 0; for (const v of b) pk = Math.max(pk, Math.abs(v)); return pk; } };
