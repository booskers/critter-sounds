/* Critter Sounds: the soundscape editor, a window of its own.
   Nodes sit on a canvas; dragging from an output dot to an input dot patches a cable. Sound cables are blue,
   control cables (slow numbers, about -1..1) amber, trigger cables pink. The soundscape plays in the main window,
   so it reaches the table; this window tells it what changed, and blinks the triggers as they fire.
   Changes save on their own to Music › Critter Sounds › Soundscapes. */
'use strict';
const $ = s => document.querySelector(s);
function h(tag, props, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v; else if (k === 'html') e.innerHTML = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (k in e && k !== 'list') e[k] = v; else e.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat()) if (c !== null && c !== undefined && c !== false) e.append(c);
  return e;
}
const F = 'fill="currentColor" stroke="none"';
const ICONS = {
  play: `<path d="M8 5.5v13l10.5-6.5z" ${F}/>`, stop: `<rect x="6" y="6" width="12" height="12" rx="2.5" ${F}/>`, plus: '<path d="M12 5v14M5 12h14"/>', x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  wave: '<path d="M3 15c2.5 0 3-9 6-9s3.5 12 6 12 3.5-6 6-6"/>', sliders: '<path d="M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="18" r="2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.2 2"/>', sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM18.5 15.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8z"/>',
  list: `<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1.1" ${F}/><circle cx="4.5" cy="12" r="1.1" ${F}/><circle cx="4.5" cy="18" r="1.1" ${F}/>`,
  shuffle: '<path d="M3 7h3.5c2 0 3.2.8 4.3 2.4l2.4 3.6c1.1 1.6 2.3 2.4 4.3 2.4H21M3 17h3.5c1.4 0 2.4-.4 3.2-1.2M14.5 8.2c.8-.8 1.8-1.2 3.1-1.2H21M18 4l3 3-3 3M18 12.4l3 3-3 3"/>',
  edit: '<path d="M15.5 4.5l4 4L8.5 19.5H4.5v-4z"/>', headphones: '<path d="M4 15v-2.5a8 8 0 0 1 16 0V15"/><rect x="3.5" y="14" width="4.5" height="6.5" rx="1.5"/><rect x="16" y="14" width="4.5" height="6.5" rx="1.5"/>',
  note: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>',
  pads: '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>', help: `<circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 1 1 3.4 2.3c-.6.3-1 .8-1 1.5v.4"/><circle cx="12" cy="16.8" r=".8" ${F}/>`,
  fit: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>', folder: '<path d="M3.5 7.5A2 2 0 0 1 5.5 5.5h3.8l2 2h7.2a2 2 0 0 1 2 2v7.5a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  file: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/>', code: '<path d="M8.5 7 3.5 12l5 5M15.5 7l5 5-5 5"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5.5A1.5 1.5 0 0 0 14.5 4h-9A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8"/>'
};
function ico(name) { const e = document.createElement('span'); e.className = 'ico'; e.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ICONS.sparkle}</svg>`; return e; }
const btn = (cls, icon, label, props = {}) => h('button', { type: 'button', class: cls, ...props }, icon ? ico(icon) : null, label ? h('span', { text: label }) : null);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const clone = v => JSON.parse(JSON.stringify(v));
const errText = e => String(e && e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
let toastT = 0;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 4200); }
let GI = {};
function gi(name) { const e = document.createElement('span'); e.className = 'gi'; const x = GI[name] || GI.sparkles; if (x) e.innerHTML = `<svg viewBox="0 0 512 512" aria-hidden="true"><path d="${x.d}" fill="currentColor"/></svg>`; return e; }

/* ---------- the soundscape, and what's around it ---------- */
const ID = new URLSearchParams(location.search).get('id') || '';
const T = SCAPE.TYPES;
let doc = null, LIBD = { pads: [], playlists: [] };
const ST = { active: '', playing: false };
const here = () => ST.active === ID && ST.playing;
const V = { x: 0, y: 0, z: 1 };
const sel = { node: '', edge: -1 };
const CAT_COL = { source: 'var(--accent2)', control: '#fbbf24', trigger: '#ec4899', math: '#94a3b8', effect: 'var(--accent)', output: '#4ade80', custom: '#14b8a6' };
const KIND = { sig: 'Sound', ctl: 'Control', param: 'Control', trig: 'Trigger' };
const portsOf = n => { const d = T[n.type]; return d ? { ins: d.ins, outs: d.outs } : { ins: [], outs: [] }; };
const portKind = (n, dir, pid) => { const p = portsOf(n)[dir === 'out' ? 'outs' : 'ins'].find(x => x[0] === pid); return p ? p[1] : ''; };
const nodeById = id => doc.nodes.find(n => n.id === id);
const pval = (n, d) => (n.p && n.p[d.id] !== undefined ? n.p[d.id] : d.def);

/* ---------- saving (on its own), undo, and telling the main window ---------- */
let saveT = 0, dirty = false;
function save(now) {
  dirty = true; $('#saveSt').textContent = 'Saving…';
  clearTimeout(saveT);
  const go = async () => { dirty = false; doc.view = { ...V }; try { await desk.scape.save(doc); $('#saveSt').textContent = 'Saved'; } catch (e) { $('#saveSt').textContent = 'Not saved: ' + errText(e); } };
  if (now) go(); else saveT = setTimeout(go, 500);
}
addEventListener('beforeunload', () => { if (dirty) { clearTimeout(saveT); doc.view = { ...V }; desk.scape.save(doc); } });
const UNDO = { past: [], future: [], last: '' };
const snap = () => JSON.stringify({ nodes: doc.nodes, edges: doc.edges });
function remember() { const s = snap(); if (s === UNDO.last) return; if (UNDO.last) UNDO.past.push(UNDO.last); if (UNDO.past.length > 80) UNDO.past.shift(); UNDO.future = []; UNDO.last = s; }
function undo(back) {
  const from = back ? UNDO.past : UNDO.future, to = back ? UNDO.future : UNDO.past; if (!from.length) return;
  to.push(UNDO.last); UNDO.last = from.pop(); const d = JSON.parse(UNDO.last); doc.nodes = d.nodes; doc.edges = d.edges;
  sel.node = ''; sel.edge = -1; drawAll(); structChanged(true);
}
// a knob moved: the playing soundscape turns that knob; anything else means building it again
let updT = 0, remT = 0;
function paramChanged(n, d, v) {
  n.p = n.p || {}; n.p[d.id] = v; save();
  clearTimeout(remT); remT = setTimeout(remember, 400);
  if (here()) desk.scape.cmd({ op: 'set', id: ID, node: n.id, param: d.id, v, doc: clone(doc) });
}
function structChanged(noRemember) {
  if (!noRemember) remember(); save();
  clearTimeout(updT); if (here()) updT = setTimeout(() => desk.scape.cmd({ op: 'update', doc: clone(doc) }), 250);
}

/* ---------- the canvas: pan, zoom ---------- */
const cv = $('#cv'), world = $('#world'), wires = $('#wires'), nodesEl = $('#nodes');
function applyView() { world.style.transform = `translate(${V.x}px,${V.y}px) scale(${V.z})`; $('#zoomSt').textContent = Math.round(V.z * 100) + '%'; cv.style.setProperty('--z', V.z); cv.style.backgroundPosition = `${V.x}px ${V.y}px`; cv.style.backgroundSize = `${24 * V.z}px ${24 * V.z}px`; }
const toWorld = (cx, cy) => { const r = cv.getBoundingClientRect(); return { x: (cx - r.left - V.x) / V.z, y: (cy - r.top - V.y) / V.z }; };
cv.addEventListener('wheel', e => {
  e.preventDefault();
  const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
  if (e.ctrlKey || !e.shiftKey) {
    const z = clamp(V.z * Math.pow(1.0015, -e.deltaY), 0.25, 2);
    V.x = mx - (mx - V.x) * z / V.z; V.y = my - (my - V.y) * z / V.z; V.z = z;
  } else { V.x -= e.deltaY; }
  applyView(); saveViewSoon();
}, { passive: false });
let viewT = 0;
const saveViewSoon = () => { clearTimeout(viewT); viewT = setTimeout(() => { doc.view = { ...V }; save(); }, 1500); };
function fit() {
  if (!doc.nodes.length) return;
  const els = [...nodesEl.children]; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
  for (const el of els) { const n = nodeById(el.dataset.id); if (!n) continue; x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + el.offsetWidth); y1 = Math.max(y1, n.y + el.offsetHeight); }
  const r = cv.getBoundingClientRect(), z = clamp(Math.min((r.width - 80) / (x1 - x0), (r.height - 80) / (y1 - y0)), 0.3, 1);
  V.z = z; V.x = (r.width - (x1 - x0) * z) / 2 - x0 * z; V.y = (r.height - (y1 - y0) * z) / 2 - y0 * z; applyView(); saveViewSoon();
}
// dragging the empty canvas moves it; so does the middle button anywhere
cv.addEventListener('pointerdown', e => {
  const bg = e.target === cv || e.target === world || e.target === nodesEl || e.target === wires;
  if (!(e.button === 1 || (e.button === 0 && bg))) return;
  e.preventDefault(); cv.focus({ preventScroll: true });
  if (bg && e.button === 0) { sel.node = ''; sel.edge = -1; paintSel(); }
  const sx = e.clientX, sy = e.clientY, vx = V.x, vy = V.y; cv.classList.add('panning');
  const mv = ev => { V.x = vx + ev.clientX - sx; V.y = vy + ev.clientY - sy; applyView(); };
  const up = () => { cv.classList.remove('panning'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); saveViewSoon(); };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
});
cv.addEventListener('dblclick', e => { if (e.target === cv || e.target === world || e.target === nodesEl || e.target === wires) quickAdd(e.clientX, e.clientY); });

/* ---------- nodes ---------- */
function drawAll() { nodesEl.replaceChildren(...doc.nodes.map(nodeEl)); drawWires(); paintSel(); hintEmpty(); }
function hintEmpty() {
  const only = doc.nodes.every(n => n.type === 'output');
  $('#cvHint').replaceChildren(...(only ? [h('b', { text: 'Start with a sound' }), h('span', { text: 'Pick a node on the left (a Bed for rain or wind, a Sample for one-off sounds), or drop sound files here. Then drag from its blue dot to the Output\'s.' })] : []));
  $('#cvHint').hidden = !only;
}
function nodeEl(n) {
  const d = T[n.type];
  if (!d) return h('div', { class: 'node missing', 'data-id': n.id, style: `transform:translate(${n.x}px,${n.y}px)` },
    h('div', { class: 'nh' }, h('b', { text: n.type }), btn('ib', 'x', '', { title: 'Remove', onclick: () => removeNode(n.id) })),
    h('p', { class: 'hint', text: 'This node type isn\'t here: it may come from a file in Music › Critter Sounds › Nodes that is missing.' }));
  const el = h('div', { class: 'node c-' + d.cat + (n.type === 'output' ? ' out' : ''), 'data-id': n.id, style: `transform:translate(${n.x}px,${n.y}px);--cc:${CAT_COL[d.cat] || CAT_COL.custom}` });
  const head = h('div', { class: 'nh', title: d.desc || '' }, ico(d.icon || 'sparkle'), h('b', { text: d.name }),
    n.type === 'sample' ? btn('ib', 'play', '', { title: 'Hear the sound here, in this window', onclick: () => tryNode(n) }) : null,
    n.type !== 'output' ? btn('ib', 'x', '', { title: 'Remove (Delete)', onclick: () => removeNode(n.id) }) : null);
  head.addEventListener('pointerdown', e => dragNode(e, n, el));
  el.append(head);
  el.addEventListener('pointerdown', () => { if (sel.node !== n.id) { sel.node = n.id; sel.edge = -1; paintSel(); } }, true);
  // inputs and outputs side by side; a knob's control input sits on the knob's own row
  const plain = d.ins.filter(p => p[1] !== 'param'), outs = d.outs, rows = Math.max(plain.length, outs.length);
  for (let i = 0; i < rows; i++) {
    const a = plain[i], b = outs[i];
    el.append(h('div', { class: 'prow' }, a ? h('span', { class: 'pin' }, dot(n, 'in', a), h('span', { text: a[2] })) : h('span'), b ? h('span', { class: 'pout' }, h('span', { text: b[2] }), dot(n, 'out', b)) : null));
  }
  const pbox = h('div', { class: 'params' });
  for (const pd of d.params) { const port = d.ins.find(p => p[1] === 'param' && p[0] === pd.id); pbox.append(paramRow(n, pd, port)); }
  // a modulation input without a knob of its own
  for (const p of d.ins.filter(p => p[1] === 'param' && !d.params.some(x => x.id === p[0]))) pbox.append(h('div', { class: 'prm' }, dot(n, 'in', p), h('span', { class: 'pl', text: p[2] })));
  if (pbox.childNodes.length) el.append(pbox);
  if (n.type === 'script') el.append(h('div', { class: 'nerr', 'data-err': n.id }));
  if (n.type === 'script') checkScript(n, el);
  return el;
}
function dot(n, dir, p) {
  const k = p[1], e = h('i', { class: `dot k-${k} ${dir}`, title: `${p[2]}: ${KIND[k]} ${dir === 'out' ? 'out' : 'in'}`, 'data-node': n.id, 'data-dir': dir, 'data-port': p[0], 'data-kind': k });
  e.addEventListener('pointerdown', ev => startWire(ev, n, dir, p));
  return e;
}
// a number knob is a slider; long ranges (like Hz) slide on a log scale
const toSl = (d, v) => (d.log ? Math.log(v / d.min) / Math.log(d.max / d.min) : (v - d.min) / (d.max - d.min)) * 1000;
const fromSl = (d, s) => { let v = d.log ? d.min * Math.pow(d.max / d.min, s / 1000) : d.min + (d.max - d.min) * s / 1000; const st = d.step || 0.01; v = Math.round(v / st) * st; return +v.toFixed(4); };
const showV = (d, v) => { const st = d.step || 0.01, dec = st >= 1 ? 0 : st >= 0.1 ? 1 : 2; return (+v).toFixed(dec) + (d.unit ? (d.unit === '×' || d.unit === '±' ? d.unit : ' ' + d.unit) : ''); };
function paramRow(n, d, port) {
  const v = pval(n, d), lead = port ? dot(n, 'in', port) : h('i', { class: 'dot none' });
  if (d.kind === 'num') {
    const out = h('output', { text: showV(d, v), title: 'Double-click to type a value' });
    const r = h('input', { type: 'range', min: 0, max: 1000, value: Math.round(toSl(d, v)), oninput: e => { const x = fromSl(d, +e.target.value); out.textContent = showV(d, x); paramChanged(n, d, x); } });
    out.addEventListener('dblclick', () => { const i = h('input', { type: 'text', class: 'pv', value: String(pval(n, d)) }); out.replaceWith(i); i.focus(); i.select();
      const done = ok => { if (ok) { const x = clamp(parseFloat(i.value), d.min, d.max); if (Number.isFinite(x)) { paramChanged(n, d, x); r.value = Math.round(toSl(d, x)); out.textContent = showV(d, x); } } i.replaceWith(out); };
      i.onkeydown = e => { if (e.key === 'Enter') done(true); if (e.key === 'Escape') done(false); }; i.onblur = () => done(true); });
    paintR(r);
    return h('div', { class: 'prm' + (port ? ' mod' : '') }, lead, h('span', { class: 'pl', text: d.label }), r, out);
  }
  if (d.kind === 'sel') return h('div', { class: 'prm' }, lead, h('span', { class: 'pl', text: d.label }), h('select', { onchange: e => paramChanged(n, d, e.target.value) }, ...d.opts.map(([k, l]) => h('option', { value: k, text: l, selected: k === v }))));
  if (d.kind === 'bool') return h('label', { class: 'prm chk' }, lead, h('input', { type: 'checkbox', checked: !!v, onchange: e => paramChanged(n, d, e.target.checked) }), h('span', { class: 'pl', text: d.label }));
  if (d.kind === 'text') return h('div', { class: 'prm' }, lead, h('span', { class: 'pl', text: d.label }), h('input', { type: 'text', class: 'grow', value: v || '', spellcheck: false, oninput: e => paramChanged(n, d, e.target.value) }));
  if (d.kind === 'sound') return h('div', { class: 'prm snd' }, lead, h('button', { type: 'button', class: 'sndb' + (v ? '' : ' empty'), title: v ? (v.path || v.url) : 'Choose a sound', onclick: e => soundMenu(e.currentTarget, n, d) }, ico('note'), h('span', { text: v ? v.name : 'Choose a sound…' })));
  if (d.kind === 'code') {
    const ta = h('textarea', { class: 'code', spellcheck: false, value: v || '', rows: 9, onkeydown: e => { if (e.key === 'Tab') { e.preventDefault(); ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); } if (e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); ta.blur(); } } });
    ta.addEventListener('change', () => { n.p = n.p || {}; n.p[d.id] = ta.value; checkScript(n); structChanged(); });
    return h('div', { class: 'prm codep' }, ta, h('span', { class: 'hint', text: 'Applies when you click away (or Ctrl+Enter).' }));
  }
  return h('div');
}
function paintR(el) { el.style.setProperty('--p', (el.value / 10) + '%'); el.addEventListener('input', () => el.style.setProperty('--p', (el.value / 10) + '%')); }
function checkScript(n, el) {
  let err = ''; try { new Function('t', 'dt', 'state', 'trig', 'out', 'fire', 'rnd', (n.p && n.p.code) ?? T.script.params[0].def); } catch (e) { err = e.message; }
  const box = (el || document).querySelector(`[data-err="${n.id}"]`); if (box) { box.textContent = err ? 'Problem: ' + err : ''; box.hidden = !err; }
}
function dragNode(e, n, el) {
  if (e.button !== 0 || e.target.closest('button')) return;
  e.preventDefault(); e.stopPropagation();
  const sx = e.clientX, sy = e.clientY, x0 = n.x, y0 = n.y; let moved = false;
  el.classList.add('drag');
  const mv = ev => { moved = true; n.x = Math.round((x0 + (ev.clientX - sx) / V.z) / 4) * 4; n.y = Math.round((y0 + (ev.clientY - sy) / V.z) / 4) * 4; el.style.transform = `translate(${n.x}px,${n.y}px)`; drawWires(); };
  const up = () => { el.classList.remove('drag'); removeEventListener('pointermove', mv); removeEventListener('pointerup', up); if (moved) { remember(); save(); } };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
let nid = 0;
const newId = type => { let id; do id = type.replace(/[^a-z]/gi, '').slice(0, 6) + (++nid).toString(36) + Math.random().toString(36).slice(2, 4); while (nodeById(id)); return id; };
function addNode(type, x, y, extra) {
  const d = T[type]; if (!d) return null;
  const n = { id: newId(type), type, x: Math.round(x), y: Math.round(y), p: { ...(extra || {}) } };
  doc.nodes.push(n); nodesEl.append(nodeEl(n)); sel.node = n.id; sel.edge = -1; paintSel(); hintEmpty(); structChanged();
  return n;
}
function removeNode(id) {
  const n = nodeById(id); if (!n || n.type === 'output') return;
  doc.nodes = doc.nodes.filter(x => x !== n); doc.edges = doc.edges.filter(e => e.from[0] !== id && e.to[0] !== id);
  if (sel.node === id) sel.node = '';
  drawAll(); structChanged();
}
function duplicate(id) {
  const n = nodeById(id); if (!n || n.type === 'output') return;
  addNode(n.type, n.x + 30, n.y + 30, clone(n.p || {}));
}
// a Sample's sound, heard here
let tryEl = null;
function tryNode(n) { const s = n.p && n.p.sound; if (!s) { toast('Choose its sound first.'); return; } if (tryEl) tryEl.pause(); tryEl = new Audio(SCAPE.srcUrlOf(s)); tryEl.volume = 0.8; tryEl.play().catch(e => toast('Could not play it: ' + errText(e))); }

/* ---------- cables ---------- */
const NS = 'http://www.w3.org/2000/svg';
function dotPos(nodeId, dir, port) {
  const el = nodesEl.querySelector(`.dot[data-node="${CSS.escape(nodeId)}"][data-dir="${dir}"][data-port="${CSS.escape(port)}"]`); if (!el) return null;
  const r = el.getBoundingClientRect(), w = world.getBoundingClientRect();
  return { x: (r.left + r.width / 2 - w.left) / V.z, y: (r.top + r.height / 2 - w.top) / V.z };
}
const curve = (a, b) => { const dx = Math.max(40, Math.abs(b.x - a.x) * 0.5); return `M${a.x},${a.y} C${a.x + dx},${a.y} ${b.x - dx},${b.y} ${b.x},${b.y}`; };
function drawWires() {
  const frag = document.createDocumentFragment();
  doc.edges.forEach((e, i) => {
    const a = dotPos(e.from[0], 'out', e.from[1]), b = dotPos(e.to[0], 'in', e.to[1]); if (!a || !b) return;
    const k = portKind(nodeById(e.from[0]), 'out', e.from[1]) || 'sig', d = curve(a, b);
    const g = document.createElementNS(NS, 'g'); g.setAttribute('class', `w k-${k}${sel.edge === i ? ' sel' : ''}`); g.dataset.i = i; g.dataset.from = e.from.join(':');
    const hit = document.createElementNS(NS, 'path'); hit.setAttribute('d', d); hit.setAttribute('class', 'hit');
    const p = document.createElementNS(NS, 'path'); p.setAttribute('d', d); p.setAttribute('class', 'line');
    g.append(hit, p);
    g.addEventListener('pointerdown', ev => { ev.stopPropagation(); sel.edge = i; sel.node = ''; paintSel(); cv.focus({ preventScroll: true }); });
    g.addEventListener('dblclick', ev => { ev.stopPropagation(); removeEdge(i); });
    g.addEventListener('contextmenu', ev => { ev.preventDefault(); removeEdge(i); });
    frag.append(g);
  });
  wires.replaceChildren(frag);
  // which dots have a cable
  nodesEl.querySelectorAll('.dot.on').forEach(x => x.classList.remove('on'));
  for (const e of doc.edges) for (const [nd, dir, pt] of [[e.from[0], 'out', e.from[1]], [e.to[0], 'in', e.to[1]]]) { const el = nodesEl.querySelector(`.dot[data-node="${CSS.escape(nd)}"][data-dir="${dir}"][data-port="${CSS.escape(pt)}"]`); if (el) el.classList.add('on'); }
}
function removeEdge(i) { doc.edges.splice(i, 1); sel.edge = -1; drawWires(); structChanged(); }
function paintSel() {
  nodesEl.querySelectorAll('.node').forEach(el => el.classList.toggle('sel', el.dataset.id === sel.node));
  wires.querySelectorAll('g.w').forEach(g => g.classList.toggle('sel', +g.dataset.i === sel.edge));
}
// would a cable from a to b make a loop? (sound can't run in a circle, and triggers would fire forever)
function loops(fromId, toId) {
  const seen = new Set(), stack = [toId];
  while (stack.length) { const id = stack.pop(); if (id === fromId) return true; if (seen.has(id)) continue; seen.add(id); for (const e of doc.edges) if (e.from[0] === id) stack.push(e.to[0]); }
  return false;
}
function canWire(o, i) {
  if (!o || !i || o.node === i.node) return false;
  const ok = SCAPE.PORT_COMPAT(o.kind, i.kind);
  return ok && !doc.edges.some(e => e.from[0] === o.node && e.from[1] === o.port && e.to[0] === i.node && e.to[1] === i.port) && !loops(o.node, i.node);
}
function connect(o, i) {
  if (!canWire(o, i)) return false;
  doc.edges.push({ from: [o.node, o.port], to: [i.node, i.port] }); drawWires(); structChanged(); return true;
}
// dragging from a dot: from an output, a new cable; from an input that has one, that cable comes loose
function startWire(e, n, dir, p) {
  if (e.button !== 0) return;
  e.preventDefault(); e.stopPropagation();
  let from;
  if (dir === 'in') {
    const i = doc.edges.findIndex(x => x.to[0] === n.id && x.to[1] === p[0]);
    if (i < 0) { from = { node: n.id, port: p[0], kind: p[1], dir: 'in' }; }
    else { const ed = doc.edges.splice(i, 1)[0]; drawWires(); from = { node: ed.from[0], port: ed.from[1], kind: portKind(nodeById(ed.from[0]), 'out', ed.from[1]), dir: 'out', loose: true }; }
  } else from = { node: n.id, port: p[0], kind: p[1], dir: 'out' };
  const a = dotPos(from.node, from.dir, from.port); if (!a) return;
  const tmp = document.createElementNS(NS, 'path'); tmp.setAttribute('class', 'tmp k-' + from.kind); wires.append(tmp);
  document.body.classList.add('wiring', 'wiring-' + (from.dir === 'out' ? 'out' : 'in'));
  // the dots it could go to light up
  const targets = [...nodesEl.querySelectorAll(`.dot[data-dir="${from.dir === 'out' ? 'in' : 'out'}"]`)].filter(el => {
    const t = { node: el.dataset.node, port: el.dataset.port, kind: el.dataset.kind };
    return from.dir === 'out' ? canWire(from, t) : canWire(t, from);
  });
  targets.forEach(el => el.classList.add('can'));
  const mv = ev => { const b = toWorld(ev.clientX, ev.clientY); tmp.setAttribute('d', from.dir === 'out' ? curve(a, b) : curve(b, a)); };
  mv(e);
  const up = ev => {
    removeEventListener('pointermove', mv); removeEventListener('pointerup', up);
    // on a dot that fits, or close enough to one
    const t = document.elementFromPoint(ev.clientX, ev.clientY);
    let el = t && t.closest('.dot.can');
    if (!el) { let best = 22; for (const x of targets) { const r = x.getBoundingClientRect(), dd = Math.hypot(r.left + r.width / 2 - ev.clientX, r.top + r.height / 2 - ev.clientY); if (dd < best) { best = dd; el = x; } } }
    tmp.remove(); targets.forEach(x => x.classList.remove('can')); document.body.classList.remove('wiring', 'wiring-out', 'wiring-in');
    if (el) { const o2 = { node: el.dataset.node, port: el.dataset.port, kind: el.dataset.kind }; if (from.dir === 'out') connect(from, o2); else connect(o2, from); }
    else if (from.loose) structChanged();
    // let go on empty canvas: pick a node to put there, wired up already
    else if (t && (t === cv || t === world || t === nodesEl || t === wires || t.closest('#wires'))) quickAdd(ev.clientX, ev.clientY, from);
  };
  addEventListener('pointermove', mv); addEventListener('pointerup', up);
}
// a trigger fired (in the main window): its dot, its cables and its node blink, in time with the sound
function flash(nodeId, port) {
  const d = nodesEl.querySelector(`.dot[data-node="${CSS.escape(nodeId)}"][data-dir="out"][data-port="${CSS.escape(port)}"]`);
  const gs = wires.querySelectorAll(`g.w[data-from="${CSS.escape(nodeId + ':' + port)}"]`);
  const targets = doc.edges.filter(e => e.from[0] === nodeId && e.from[1] === port).map(e => nodesEl.querySelector(`.node[data-id="${CSS.escape(e.to[0])}"]`));
  for (const el of [d, ...gs, ...targets]) if (el) { el.classList.remove('fire'); void el.getBoundingClientRect(); el.classList.add('fire'); }
}

/* ---------- adding nodes: the list on the left, or a quick search where you double-click ---------- */
function palette() {
  const q = $('#palQ').value.trim().toLowerCase(), L = $('#palL'); L.replaceChildren();
  for (const [cat, label] of SCAPE.CATS) {
    const list = Object.values(T).filter(d => d.cat === cat && d.type !== 'output' && (!q || (d.name + ' ' + (d.desc || '') + ' ' + d.type).toLowerCase().includes(q)));
    if (!list.length) continue;
    L.append(h('div', { class: 'pcat', style: `--cc:${CAT_COL[cat] || CAT_COL.custom}`, text: label }));
    for (const d of list) {
      const b = h('button', { type: 'button', class: 'pitem', style: `--cc:${CAT_COL[cat] || CAT_COL.custom}`, title: d.desc || '', draggable: true }, ico(d.icon || 'sparkle'), h('span', { class: 'grow', text: d.name }));
      b.onclick = () => { const r = cv.getBoundingClientRect(), c = toWorld(r.left + r.width / 2 - 110 + Math.random() * 60, r.top + r.height / 2 - 80 + Math.random() * 60); addNode(d.type, c.x, c.y); };
      b.ondragstart = e => { e.dataTransfer.setData('text/x-node', d.type); e.dataTransfer.effectAllowed = 'copy'; };
      L.append(b);
    }
  }
  if (!L.childNodes.length) L.append(h('p', { class: 'hint', text: 'No node fits that.' }));
  L.append(h('div', { class: 'pfoot' }, btn('btn tiny ghost', 'folder', 'Your own nodes', { title: 'Music › Critter Sounds › Nodes: drop .js files there (see the README in it)', onclick: () => desk.scape.folder('Nodes') })));
}
$('#palQ').addEventListener('input', palette);
cv.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; });
cv.addEventListener('drop', e => {
  e.preventDefault();
  const at = toWorld(e.clientX, e.clientY), type = e.dataTransfer.getData('text/x-node');
  if (type) { addNode(type, at.x - 20, at.y - 16); return; }
  // sound files: onto a node, its sound; onto the canvas, a Sample each
  const files = [...e.dataTransfer.files].map(f => desk.pathOf(f)).filter(p => /\.(mp3|ogg|oga|opus|wav|flac|m4a|aac|webm)$/i.test(p));
  if (!files.length) return;
  const onNode = e.target.closest && e.target.closest('.node'), n = onNode && nodeById(onNode.dataset.id);
  if (n && T[n.type] && T[n.type].params.some(p => p.kind === 'sound')) { setSound(n, T[n.type].params.find(p => p.kind === 'sound'), { path: files[0], name: titleOf(files[0]) }); return; }
  files.forEach((p, i) => addNode('sample', at.x + i * 24, at.y + i * 24, { sound: { path: p, name: titleOf(p) } }));
});
const titleOf = p => String(p).split(/[\\/]/).pop().replace(/\.[^.]+$/, '').replace(/_+/g, ' ').trim();
let qaEl = null;
function closeQA() { if (qaEl) { qaEl.remove(); qaEl = null; } }
function quickAdd(cx, cy, from) {
  closeQA(); closeMenu();
  const at = toWorld(cx, cy);
  // when a cable was dragged out, only nodes it can plug into
  const fits = d => !from || (from.dir === 'out' ? d.ins.some(p => SCAPE.PORT_COMPAT(from.kind, p[1])) : d.outs.some(p => SCAPE.PORT_COMPAT(p[1], from.kind)));
  const q = h('input', { type: 'text', placeholder: from ? `Plug into… (${KIND[from.kind]})` : 'Add a node…' }), L = h('div', { class: 'qal' });
  let items = [], hi = 0;
  const pick = d => {
    closeQA();
    const n = addNode(d.type, from && from.dir === 'in' ? at.x - 230 : at.x - 10, at.y - 20); if (!n || !from) return;
    if (from.dir === 'out') { const p = d.ins.find(p => p[1] !== 'param' && SCAPE.PORT_COMPAT(from.kind, p[1])) || d.ins.find(p => SCAPE.PORT_COMPAT(from.kind, p[1])); if (p) connect(from, { node: n.id, port: p[0], kind: p[1] }); }
    else { const p = d.outs.find(p => SCAPE.PORT_COMPAT(p[1], from.kind)); if (p) connect({ node: n.id, port: p[0], kind: p[1] }, from); }
  };
  const draw = () => {
    const t = q.value.trim().toLowerCase();
    // nodes that take the cable on a real input come before those that would only take it on a knob
    const main = d => (from && from.dir === 'out' && !d.ins.some(p => p[1] !== 'param' && SCAPE.PORT_COMPAT(from.kind, p[1])) ? 1 : 0);
    items = Object.values(T).filter(d => d.type !== 'output' && fits(d) && (!t || (d.name + ' ' + (d.desc || '')).toLowerCase().includes(t))).sort((a, b) => main(a) - main(b));
    hi = clamp(hi, 0, Math.max(0, items.length - 1));
    L.replaceChildren(...items.map((d, i) => h('button', { type: 'button', class: 'qai' + (i === hi ? ' on' : ''), style: `--cc:${CAT_COL[d.cat] || CAT_COL.custom}`, onclick: () => pick(d) }, ico(d.icon || 'sparkle'), h('b', { text: d.name }), h('span', { class: 'hint', text: (SCAPE.CATS.find(c => c[0] === d.cat) || [, ''])[1] }))));
  };
  q.oninput = () => { hi = 0; draw(); };
  q.onkeydown = e => { if (e.key === 'ArrowDown') { hi++; draw(); e.preventDefault(); } else if (e.key === 'ArrowUp') { hi--; draw(); e.preventDefault(); } else if (e.key === 'Enter' && items[hi]) pick(items[hi]); else if (e.key === 'Escape') closeQA(); };
  qaEl = h('div', { class: 'qa' }, q, L); document.body.append(qaEl);
  qaEl.style.left = clamp(cx, 8, innerWidth - 300) + 'px'; qaEl.style.top = clamp(cy, 8, innerHeight - 360) + 'px';
  draw(); q.focus();
}
addEventListener('pointerdown', e => { if (qaEl && !qaEl.contains(e.target)) closeQA(); if (menuEl && !menuEl.contains(e.target)) closeMenu(); }, true);

/* ---------- a sound for a Sample or a Bed: one of your pads, a track from a playlist, or a file ---------- */
let menuEl = null;
function closeMenu() { if (menuEl) { menuEl.remove(); menuEl = null; } }
function setSound(n, d, s) { n.p = n.p || {}; n.p[d.id] = s; const el = nodesEl.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`); if (el) el.replaceWith(nodeEl(n)); drawWires(); paintSel(); structChanged(); }
function soundMenu(anchor, n, d) {
  closeMenu(); closeQA();
  const q = h('input', { type: 'text', placeholder: 'Search your pads and playlists…' }), L = h('div', { class: 'sml' });
  const all = [
    ...LIBD.pads.filter(p => p.path || p.url).map(p => ({ name: p.name, path: p.path, url: p.url, where: 'Pad' + (p.tag ? ' · ' + p.tag : '') })),
    ...LIBD.playlists.flatMap(pl => pl.items.filter(i => i.path || i.url).map(i => ({ name: i.title, path: i.path, url: i.url, where: pl.name })))
  ];
  const draw = () => {
    const t = q.value.trim().toLowerCase(), hits = all.filter(x => !t || (x.name + ' ' + x.where).toLowerCase().includes(t)).slice(0, 120);
    L.replaceChildren(...hits.map(x => h('button', { type: 'button', class: 'mi', onclick: () => { closeMenu(); setSound(n, d, { name: x.name, ...(x.path ? { path: x.path } : { url: x.url }) }); } }, ico('note'), h('span', { class: 'grow', text: x.name }), h('span', { class: 'mn', text: x.where }))));
    if (!hits.length) L.append(h('p', { class: 'hint', text: all.length ? 'Nothing fits that.' : 'No pads or playlists yet: choose a file instead.' }));
  };
  q.oninput = draw;
  menuEl = h('div', { class: 'menu smenu' },
    h('div', { class: 'row' }, btn('btn tiny primary', 'file', 'A file…', { onclick: async () => { closeMenu(); const p = await desk.pickFiles(); if (p[0]) setSound(n, d, { path: p[0], name: titleOf(p[0]) }); } }),
      pval(n, d) ? btn('btn tiny ghost', 'x', 'None', { onclick: () => { closeMenu(); setSound(n, d, null); } }) : null), q, L);
  document.body.append(menuEl);
  const r = anchor.getBoundingClientRect(); menuEl.style.left = clamp(r.left, 6, innerWidth - 380) + 'px'; menuEl.style.top = clamp(r.bottom + 4, 6, innerHeight - 420) + 'px';
  draw(); q.focus();
}

/* ---------- keys ---------- */
cv.addEventListener('keydown', e => {
  if (e.target.closest('input,textarea,select')) return;
  const c = e.ctrlKey || e.metaKey;
  if (e.key === 'Delete' || e.key === 'Backspace') { if (sel.edge >= 0) removeEdge(sel.edge); else if (sel.node) removeNode(sel.node); }
  else if (c && e.key.toLowerCase() === 'd') { e.preventDefault(); if (sel.node) duplicate(sel.node); }
  else if (c && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(!e.shiftKey); }
  else if (c && e.key.toLowerCase() === 'y') { e.preventDefault(); undo(false); }
  else if (e.key.toLowerCase() === 'f' && !c) fit();
  else if (e.key === ' ') { e.preventDefault(); playStop(); }
  else if (e.key === 'Tab') { e.preventDefault(); const r = cv.getBoundingClientRect(); quickAdd(r.left + r.width / 2 - 140, r.top + 80); }
});

/* ---------- the bar on top: name, play, render ---------- */
function playStop() { if (here()) desk.scape.cmd({ op: 'stop', id: ID }); else desk.scape.cmd({ op: 'play', doc: clone(doc) }); }
function paintTop() {
  const on = here(), pb = $('#playB');
  pb.replaceChildren(ico(on ? 'stop' : 'play'), h('span', { text: on ? 'Stop' : 'Play to the table' }));
  pb.className = 'btn ' + (on ? 'bad' : 'primary');
  $('#playSt').textContent = on ? 'Playing in Critter Sounds: changes are heard as you make them.' : ST.playing ? 'Another soundscape is playing; this one would fade over it.' : '';
  document.body.classList.toggle('live', on);
  $('#scIcon').replaceChildren(gi(doc.icon || 'sparkles'));
  document.title = (doc.name || 'Untitled') + ': soundscape editor';
  $('#winTitle').textContent = doc.name || 'Untitled soundscape';
}
$('#playB').onclick = playStop;
$('#fitB').replaceChildren(ico('fit')); $('#fitB').onclick = fit;
$('#renderB').replaceChildren(ico('download'), h('span', { text: 'Render a loop' })); $('#renderB').onclick = renderDialog;
$('#helpB').replaceChildren(ico('help'), h('span', { text: 'Help' })); $('#helpB').onclick = e => helpMenu2(e.currentTarget);
$('#scName').addEventListener('keydown', e => { if (e.key === 'Enter') e.target.blur(); });
$('#scName').addEventListener('change', e => {
  const name = e.target.value.trim().slice(0, 60); const first = !doc.named && !!name;
  doc.name = name; if (first) doc.named = true; paintTop(); save();
  // the main window picks the icon from the name, the first time it's given
  desk.scape.cmd({ op: 'name', id: ID, name, first });
});
for (const [c, cmd] of [['.wb-min', 'min'], ['.wb-max', 'max'], ['.wb-close', 'close']]) $(c).onclick = () => desk.winCmd(cmd);
$('#titlebar').addEventListener('dblclick', e => { if (!e.target.closest('button')) desk.winCmd('max'); });
desk.onWinState(s => { document.body.classList.toggle('wmax', !!s.max); document.body.classList.toggle('wblur', !s.focus); });

/* ---------- rendering a loop: here, offline, faster than it plays ---------- */
function renderDialog() {
  if (document.querySelector('.modal')) return;
  let secs = 120, xf = 4, busy = false, file = '';
  const name = h('input', { type: 'text', class: 'grow', value: (doc.name || 'Soundscape') + ' loop', maxLength: 80 });
  const lenOut = h('output'), xfOut = h('output'), bar = h('i'), status = h('p', { class: 'hint' });
  const fmtLen = s => (s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ' ' + (s % 60) + ' s' : ''}` : s + ' s');
  const len = h('input', { type: 'range', min: 10, max: 600, step: 5, value: secs, oninput: e => { secs = +e.target.value; lenOut.textContent = fmtLen(secs); xf = Math.min(xf, Math.floor(secs / 3)); xfR.max = Math.min(15, Math.floor(secs / 3)); xfR.value = xf; xfOut.textContent = xf + ' s'; paintR2(); } });
  const xfR = h('input', { type: 'range', min: 0, max: 15, step: 1, value: xf, oninput: e => { xf = +e.target.value; xfOut.textContent = xf + ' s'; paintR2(); } });
  const paintR2 = () => { for (const r of [len, xfR]) r.style.setProperty('--p', ((r.value - r.min) / (r.max - r.min) * 100) + '%'); };
  lenOut.textContent = fmtLen(secs); xfOut.textContent = xf + ' s'; paintR2();
  const go = btn('btn primary', 'download', 'Render');
  const showB = btn('btn', 'folder', 'Show the file'); showB.hidden = true; showB.onclick = () => desk.showItem(file);
  go.onclick = async () => {
    if (busy) return; busy = true; go.disabled = true; status.textContent = 'Loading the sounds…'; bar.style.width = '0%';
    const t0 = performance.now();
    try {
      const r = await SCAPE.renderLoop(clone(doc), secs, xf, p => { bar.style.width = Math.round(p * 100) + '%'; status.textContent = `Rendering… ${Math.round(p * 100)}%`; });
      status.textContent = 'Saving…';
      file = await desk.scape.saveLoop(name.value, r.wav); LAST_RENDER = file;
      status.textContent = `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${file.split(/[\\/]/).pop()}${r.peak > 0.98 ? ' (it was turned down a little so it doesn\'t clip)' : ''}`;
      showB.hidden = false;
    } catch (e) { status.textContent = 'It could not be rendered: ' + errText(e); }
    busy = false; go.disabled = false;
  };
  const card = h('div', { class: 'card appear' },
    h('div', { class: 'row' }, h('b', { class: 'grow', text: 'Render a loop' }), btn('ib', 'x', '', { onclick: () => { if (!busy) box.remove(); } })),
    h('p', { class: 'hint', text: 'Plays the soundscape here, silently and faster than real time, and saves it as a WAV file that loops without a seam: the end is crossfaded into the start. It goes to Music › Critter Sounds › Loops, ready for a playlist, a pad, or any other player.' }),
    h('label', { class: 'rl' }, h('span', { text: 'Length' }), len, lenOut),
    h('label', { class: 'rl' }, h('span', { text: 'Seam crossfade' }), xfR, xfOut),
    h('label', { class: 'rl' }, h('span', { text: 'File name' }), name),
    h('div', { class: 'rbar' }, bar), status,
    h('div', { class: 'row end' }, showB, go));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box && !busy) box.remove(); } }, card);
  document.body.append(box);
}

/* ---------- help ---------- */
function help() {
  if (document.querySelector('.modal')) return;
  const sw = (k, t) => h('span', { class: 'hk' }, h('i', { class: 'dot k-' + k }), h('span', { text: t }));
  const card = h('div', { class: 'card appear wide helpc' },
    h('div', { class: 'row' }, h('b', { class: 'grow', text: 'How soundscapes work' }), btn('ib', 'x', '', { onclick: () => box.remove() })),
    h('p', { text: 'Nodes make, shape and steer sound. Drag from an output dot (on the right of a node) to an input dot (on the left) to patch them together. Let go on empty space to pick a node that plugs in there. Drag a cable off an input to unplug it; double-click a cable to remove it.' }),
    h('div', { class: 'hkeys' }, sw('sig', 'Sound'), sw('ctl', 'Control: a slow number, about −1 to 1'), sw('trig', 'Trigger: "now!"')),
    h('p', { text: 'A control wired into a knob\'s dot swings that knob: an LFO into a Filter\'s Sweep makes wind that rises and falls; a Drift into a Bed\'s Volume makes rain that comes and goes. Triggers from a Clock, Sometimes or Sequencer play Samples, and can pass through Chance, Wait, Every Nth or Pick one first.' }),
    h('p', { text: 'Everything you hear goes to the Output. Press Play to hear it at the table; while it plays, every change is heard straight away. A Macro becomes a slider on the soundscape\'s tile in the main window.' }),
    h('div', { class: 'sec', text: 'Keys' }),
    h('p', { class: 'hint', text: 'Double-click or Tab: add a node · Delete: remove · Ctrl+D: copy · Ctrl+Z / Ctrl+Y: undo / redo · F: show everything · Space: play or stop · scroll: zoom · drag the background: move around' }),
    h('div', { class: 'sec', text: 'Recipes' }),
    h('ul', { class: 'hint' },
      h('li', { text: 'Gusty wind: Noise (pink) → Filter (bandpass) → Output; Drift → Filter Sweep and Drift → Noise Volume.' }),
      h('li', { text: 'Distant thunder: Sometimes (every 40 s) → Sample (thunder, pitch varies 0.2) → Filter (lowpass) → Reverb (cave) → Output.' }),
      h('li', { text: 'Busy tavern: Bed (tavern crowd) plus Sometimes → Pick one → three Samples (mugs, laughter, door), all into a Merge → Output.' }),
      h('li', { text: 'Rising dread: Tone (low saw) → Filter → Level → Output, with a Macro into the Level\'s dot. Its slider on the tile swells the drone during play.' })),
    h('div', { class: 'sec', text: 'Your own nodes' }),
    h('p', { class: 'hint', text: 'A Script node runs a few lines of JavaScript. For whole new node types, put a .js file in Music › Critter Sounds › Nodes: there\'s a README and an example there. Reopen the window to load changes.' }));
  const box = h('div', { class: 'modal', onpointerdown: e => { if (e.target === box) box.remove(); } }, card);
  document.body.append(box);
}


/* ---------- the guided first loop: the sound of the sea, from nothing to a WAV file ---------- */
// The first time the editor opens (and from ? › Guided first loop). No sound files needed: noise is the water,
// a slow LFO makes the waves, and the end is a rendered loop in Music › Critter Sounds › Loops.
let LAST_RENDER = '';
const TOUR_KEY = 'cs.scapeTour.v1';
const firstOf = type => doc.nodes.find(n => n.type === type);
const elOf = type => () => { const n = firstOf(type); return n ? nodesEl.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`) : null; };
const dotOf = (type, dir, port) => { const n = firstOf(type); return n ? nodesEl.querySelector(`.dot[data-node="${CSS.escape(n.id)}"][data-dir="${dir}"][data-port="${port}"]`) : null; };
const palItem = name => () => [...document.querySelectorAll('#palL .pitem')].find(b => b.textContent.trim() === name);
const wired = (ft, fp, tt, tp) => doc.edges.some(e => { const a = nodeById(e.from[0]), b = nodeById(e.to[0]); return a && b && a.type === ft && e.from[1] === fp && b.type === tt && e.to[1] === tp; });
const knobRow = (type, label) => () => { const el = elOf(type)(); return el ? [...el.querySelectorAll('.prm')].find(r => (r.querySelector('.pl') || {}).textContent === label) : null; };
// put a node where the next cable is short, and show both
function placeNear(type, ref, dx, dy) {
  const n = firstOf(type), r = firstOf(ref); if (!n || !r) return;
  n.x = r.x + dx; n.y = r.y + dy;
  const el = nodesEl.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`); if (el) el.style.transform = `translate(${n.x}px,${n.y}px)`;
  drawWires(); save(); fit();
}
function setKnob(type, pid, v) { const n = firstOf(type); if (!n) return; const d = T[type].params.find(p => p.id === pid); paramChanged(n, d, v); const el = nodesEl.querySelector(`.node[data-id="${CSS.escape(n.id)}"]`); if (el) el.replaceWith(nodeEl(n)); drawWires(); paintSel(); }
function firstLoopTour() {
  closeMenu(); closeQA(); document.querySelectorAll('.modal').forEach(m => m.remove());
  const out = () => firstOf('output');
  Tour.run([
    { title: 'Your first soundscape loop', wide: true, text: ['Let\'s make the sound of the sea, from scratch: noise for the water, a slow wave for the surf. Then we\'ll save it as a loop you can play anywhere.', 'It takes about three minutes and needs no sound files. Each step waits for you, and "Do it for me" is there if you\'d rather watch. Skip any time with ✕.'], nextLabel: 'Start', before: () => fit() },
    { el: () => Tour.around(document.querySelector('#pal'), elOf('output')()), title: 'Nodes and the Output', text: ['On the left are nodes, by kind: sound sources make sound, controls move knobs, triggers say "now", and effects change sound.', 'Everything you hear goes into the Output (the green one). It\'s the only node that\'s here from the start.'] },
    { el: palItem('Noise'), title: 'Add some water', text: 'Sound sources make sound. Noise makes an endless hiss that sounds like water. Click Noise in the list (or drag it onto the canvas).', wait: () => !!firstOf('noise'), doIt: () => { const o = out(); addNode('noise', o.x - 330, o.y); }, waitText: 'Click Noise in the list.' },
    { before: () => placeNear('noise', 'output', -330, 0), el: knobRow('noise', 'Colour'), title: 'A deeper sea', text: 'Every node has knobs. Set Colour to Brown: a deep rumble, like the sea from a cliff. (Pink is rain, white is hiss.)', wait: () => (firstOf('noise').p || {}).color === 'brown', doIt: () => setKnob('noise', 'color', 'brown'), waitText: 'Choose Brown in the Colour list.' },
    { el: () => Tour.around(elOf('noise')(), elOf('output')()), pad: 10, title: 'Plug it in', text: ['Cables carry sound from an output (the dots on the right of a node) to an input (on the left).', 'Drag from the Noise\'s blue Sound dot to the Output\'s blue Sound dot.'], wait: () => wired('noise', 'out', 'output', 'in'), doIt: () => connect({ node: firstOf('noise').id, port: 'out', kind: 'sig' }, { node: out().id, port: 'in', kind: 'sig' }), waitText: 'Drag from one blue dot to the other.' },
    { el: '#playB', title: 'Hear it', text: ['Play sends it to the table, through Critter Sounds\' main window, like everything else you play.', 'To hear it yourself, "Here" must be on in the main window\'s bottom bar. "Do it for me" turns it on and plays.'], wait: () => here(), doIt: () => { desk.scape.cmd({ op: 'hear' }); if (!here()) playStop(); }, waitText: 'Press Play to the table.' },
    { el: palItem('LFO'), title: 'Now the waves', text: 'Controls don\'t make sound: they move knobs. An LFO is a slow wave that goes up and down. Add one.', wait: () => !!firstOf('lfo'), doIt: () => { const n = firstOf('noise'); addNode('lfo', n.x - 320, n.y + 40); }, waitText: 'Click LFO in the list.' },
    { before: () => placeNear('lfo', 'noise', -320, 60), el: () => Tour.around(elOf('lfo')(), elOf('noise')()), pad: 10, title: 'Let it move the volume', text: ['Control cables are amber, and plug into the diamond beside a knob.', 'Drag from the LFO\'s Wave diamond to the diamond beside the Noise\'s Volume. Listen: the sea starts to breathe.'], wait: () => wired('lfo', 'out', 'noise', 'vol'), doIt: () => connect({ node: firstOf('lfo').id, port: 'out', kind: 'ctl' }, { node: firstOf('noise').id, port: 'vol', kind: 'param' }), waitText: 'Drag from the amber diamond to the Volume diamond.' },
    { el: knobRow('lfo', 'Depth'), title: 'Shape the waves', text: ['Depth is how far the LFO swings the knob. Turn it down to about 0.6, so the water pulls back between waves instead of cutting out.', 'Speed sets how often: 0.10 Hz is one wave every ten seconds.'], wait: () => { const p = firstOf('lfo').p || {}; return p.depth !== undefined && p.depth <= 0.75; }, doIt: () => setKnob('lfo', 'depth', 0.6), waitText: 'Drag Depth to about 0.6.' },
    { el: '#renderB', title: 'Make it a file', text: 'Render a loop plays the soundscape here, silently and faster than real time, and saves a WAV that loops without a seam. Open it.', wait: () => !!document.querySelector('.modal .rbar'), doIt: () => renderDialog(), waitText: 'Press Render a loop.' },
    { el: () => document.querySelector('.modal .card'), side: 'right', title: 'Render it', text: ['30 seconds is plenty for a first loop: drag Length down if you like, then press Render.', 'It\'s saved to Music › Critter Sounds › Loops, ready for a playlist, a sound pad, or any other player.'], wait: () => !!LAST_RENDER, doIt: () => { const r = document.querySelector('.modal input[type=range]'); if (r) { r.value = 30; r.dispatchEvent(new Event('input')); } const g = [...document.querySelectorAll('.modal .btn.primary')].pop(); if (g) g.click(); }, waitText: 'Press Render.', pause: 1400 },
    { before: () => { const m = document.querySelector('.modal'); if (m) m.remove(); }, title: 'Your first loop is done', wide: true, text: ['It\'s in Music › Critter Sounds › Loops. This soundscape saved itself too, so its tile in the main window plays it live.', 'Ideas for next time:'], list: ['A Filter after the Noise (lowpass) makes the sea sound farther away', 'Sometimes → Sample plays a seagull or a ship\'s bell now and then', 'A Macro shows up as a slider on the soundscape\'s tile, to steer it during a game', 'Double-click the canvas (or press Tab) to find any node by name'],
      actions: [{ label: 'Show the file', fn: () => LAST_RENDER && desk.showItem(LAST_RENDER), next: false }, { label: 'Done', primary: true }] }
  ], { onEnd: () => { try { localStorage.setItem(TOUR_KEY, '1'); } catch {} } });
}
function helpMenu2(anchor) {
  closeMenu(); closeQA();
  const item = (icon, label, sub, fn) => h('button', { type: 'button', class: 'mi', onclick: () => { closeMenu(); fn(); } }, h('span', { class: 'mic' }, ico(icon)), h('span', { class: 'mlab' }, h('span', { text: label }), h('small', { text: sub })));
  menuEl = h('div', { class: 'menu' }, h('div', { class: 'mh', text: 'Learn the editor' }),
    item('play', 'Guided first loop', 'Build the sound of the sea and save it as a loop', firstLoopTour),
    item('help', 'How it works', 'Cables, nodes, keys and recipes', help));
  document.body.append(menuEl);
  const r = anchor.getBoundingClientRect(); menuEl.style.left = Math.max(6, Math.min(innerWidth - menuEl.offsetWidth - 6, r.right - menuEl.offsetWidth)) + 'px'; menuEl.style.top = r.bottom + 4 + 'px';
}

/* ---------- start ---------- */
const TONES = { midnight: { bg: '#0b0a12', panel: '#13121b', panel2: '#1b1a26', line: 'rgba(255,255,255,.075)' }, black: { bg: '#050506', panel: '#0e0e11', panel2: '#17171b', line: 'rgba(255,255,255,.07)' }, slate: { bg: '#0f131a', panel: '#161b24', panel2: '#1f2631', line: 'rgba(255,255,255,.08)' } };
const inkOn = hex => { const m = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex || ''); if (!m) return '#fff'; const [r, g, b] = m.slice(1).map(x => parseInt(x, 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32 ? '#0b0a12' : '#ffffff'; };
function applyTheme(t) {
  t = { accent: '#8800ff', accent2: '#4cc9f0', tone: 'midnight', ...(t || {}) }; const st = document.documentElement.style, tone = TONES[t.tone] || TONES.midnight;
  st.setProperty('--accent', t.accent); st.setProperty('--accent2', t.accent2); st.setProperty('--accent-ink', inkOn(t.accent)); st.setProperty('--accent2-ink', inkOn(t.accent2));
  // the same look as the main window (the shared design system)
  st.setProperty('--tone-dark', tone.bg); document.documentElement.dataset.theme = t.scheme === 'light' ? 'light' : 'dark';
  st.setProperty('--hue', (Number.isFinite(t.tint) ? t.tint : 4) + '%'); st.setProperty('--bleed', Number.isFinite(t.bleed) ? t.bleed : 1);
  applyFontSet(document.documentElement, t.fonts || 'Easy reading');
}
(async () => {
  const lib = await desk.loadLib().catch(() => null);
  { const lang = I18N.pick(lib && lib.set && lib.set.lang, await desk.sysLang().catch(() => '')); I18N.start(lang); }
  if (lib) { LIBD = { pads: Array.isArray(lib.pads) ? lib.pads : [], playlists: Array.isArray(lib.playlists) ? lib.playlists.filter(p => p && Array.isArray(p.items)) : [] }; applyTheme(lib.set && lib.set.theme); }
  fetch('gameicons.json').then(r => r.json()).then(j => { GI = j; if (doc) paintTop(); }).catch(() => {});
  SCAPE.loadCustom(await desk.scape.nodes().catch(() => []), (f, e) => toast(`Your node ${f} has a problem: ${e.message}`));
  doc = await desk.scape.get(ID);
  if (!doc) { document.body.replaceChildren(h('p', { class: 'hint', style: 'padding:40px', text: 'This soundscape isn\'t there any more.' })); return; }
  if (!doc.nodes.some(n => n.type === 'output')) doc.nodes.push({ id: 'out', type: 'output', x: 900, y: 300, p: {} });
  Object.assign(V, doc.view || {}); applyView();
  $('#scName').value = doc.name || '';
  UNDO.last = snap();
  palette(); drawAll(); paintTop();
  if (!doc.view || (!doc.view.x && !doc.view.y)) requestAnimationFrame(fit);
  let toured = false; try { toured = !!localStorage.getItem(TOUR_KEY); } catch {}
  if (!toured && doc.nodes.every(n => n.type === 'output')) setTimeout(firstLoopTour, 500);
  $('#saveSt').textContent = 'Saves on its own';
  desk.scape.onState(s => {
    if (s.fires) { const now = s.now || 0; for (const [id, port, t] of s.fires) setTimeout(() => flash(id, port), Math.max(0, (t - now) * 1000)); }
    const was = here(); ST.active = s.active; ST.playing = s.playing; if (was !== here() || !s.fires) paintTop();
  });
  desk.scape.cmd({ op: 'hello' });
  // the main window changed the name, icon or a macro: take those, keep everything else
  desk.scape.onSaved(d => {
    if (d.id !== ID) return;
    if (d.deleted) { window.close(); return; }
    const iconWas = doc.icon;
    for (const k of ['name', 'icon', 'named', 'iconSet']) if (d[k] !== undefined) doc[k] = d[k];
    for (const n of d.nodes || []) if (n.type === 'macro') { const m = nodeById(n.id); if (m && n.p && m.p && m.p.v !== n.p.v) { m.p.v = n.p.v; const el = nodesEl.querySelector(`.node[data-id="${CSS.escape(m.id)}"]`); if (el) el.replaceWith(nodeEl(m)); drawWires(); } }
    if (document.activeElement !== $('#scName')) $('#scName').value = doc.name || '';
    paintTop();
    if (dirty || iconWas !== doc.icon) save();
  });
  addEventListener('resize', drawWires);
})();
