/* Critter Sounds and Critter Notes. Loaded after app.js, whose top-level names (NET, LIB, SC, playItem, playPad,
   startScene, playScape…) it uses. While connected to a table it:
   - publishes what it can play to lobbies/<code>/soundcat/main { n, ts, scenes, playlists, pads, scapes: [{ id, name }] },
     so Notes can offer it as cues while the GM plans;
   - takes cues from lobbies/<code>/cues/<id> { op: 'play'|'stop', kind, ref, name, ts, sig }. sig is
     SHA-256 of "<music key>|<id>|<op>|<kind>|<ref>", so only someone with the music key can cue it. A cue is played
     once, then deleted; Notes takes the deletion as the answer. */
(() => {
  const B = { code: '', offs: [], sig: '', done: new Set(), t: 0 };
  const catalog = () => ({
    scenes: LIB.scenes.map(s => ({ id: s.id, name: String(s.name || 'Scene').slice(0, 60) })).slice(0, 100),
    playlists: LIB.playlists.map(p => ({ id: p.id, name: String(p.name || 'Playlist').slice(0, 60) })).slice(0, 200),
    pads: LIB.pads.map(p => ({ id: p.id, name: String(p.name || 'Pad').slice(0, 60), ...(typeof tagColor === 'function' && tagColor(p.tag) ? { color: tagColor(p.tag) } : {}) })).slice(0, 300),
    scapes: (SC.list || []).map(d => ({ id: d.id, name: String(d.name || 'Untitled').slice(0, 60) })).slice(0, 100)
  });
  function attach() {
    detach(); B.code = NET.code; const db = NET.db, base = `lobbies/${NET.code}`;
    B.offs.push(db.collection(base + '/cues').onSnapshot(s => s.docs.forEach(d => take(db, base, d.id, d.data() || {})), () => {}));
    B.sig = ''; publish();
  }
  function detach() { B.offs.forEach(f => { try { f(); } catch {} }); B.offs = []; B.code = ''; }
  // German for the toasts below (i18n.js translates what shows on the page)
  if (Array.isArray(window.I18N_DE_P)) window.I18N_DE_P.push([/^Critter Notes: stopped the pads$/, 'Critter Notes: Pads gestoppt'], [/^Critter Notes: stopped the music$/, 'Critter Notes: Musik gestoppt'], [/^Critter Notes: a cue$/, 'Critter Notes: ein Einsatz']);
  async function publish() {
    // the soundscapes fill in after start; the list waits for them
    if (!NET.on || !NET.db || !NET.code || !SC.loaded) return;
    const c = catalog(), sig = JSON.stringify(c);
    // the list again when it changes, and once an hour so Notes can tell Sounds is about
    if (sig === B.sig && Date.now() - B.t < 3600e3) return;
    B.sig = sig; B.t = Date.now();
    try { await NET.db.doc(`lobbies/${NET.code}/soundcat/main`).set({ n: S().name || 'Critter Sounds', ts: Date.now(), ...c }); } catch {}
  }
  async function take(db, base, id, q) {
    if (B.done.has(id) || !NET.key || !/^[\w-]{1,40}$/.test(id)) return;
    if (!(+q.ts > Date.now() - 120000)) return;
    const want = await sha256hex([NET.key, id, q.op, q.kind, q.ref].join('|'));
    if (want !== q.sig) return;
    B.done.add(id); if (B.done.size > 300) B.done = new Set([...B.done].slice(-150));
    try { await run(q); } catch (e) { console.warn('cue', e); }
    db.doc(`${base}/cues/${id}`).delete().catch(() => {});
  }
  async function run(q) {
    const ref = String(q.ref || '');
    if (q.op === 'stop') {
      if (q.kind === 'pads') stopAllPads();
      else { if (E.state === 'play') stop(); if (SC.run) stopScape(); }
      toast('Critter Notes: stopped ' + (q.kind === 'pads' ? 'the pads' : 'the music'));
      return;
    }
    if (q.kind === 'playlist') { const pl = plById(ref); if (!pl || !pl.items.length) return; const it = S().shuffle ? pl.items[Math.floor(Math.random() * pl.items.length)] : pl.items[0]; playItem(pl, it); }
    else if (q.kind === 'pad') { const p = LIB.pads.find(x => x.id === ref); if (!p || padsPlaying.has(p.id)) return; playPad(p); }
    else if (q.kind === 'scene') { const sc = LIB.scenes.find(x => x.id === ref); if (!sc) return; startScene(sc); }
    else if (q.kind === 'scape') { if (!SC.loaded) await loadScapes(); const d = scById(ref); if (!d) return; await playScape(d); }
    else return;
    toast('Critter Notes: ' + (q.name || 'a cue'));
  }
  setInterval(() => {
    if (NET.on && NET.db && NET.code) { if (B.code !== NET.code) attach(); else publish(); }
    else if (B.code) detach();
  }, 3000);
})();
