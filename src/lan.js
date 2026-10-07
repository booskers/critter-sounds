/* Critter Sounds nearby: finds the other Critter Sounds on the same network, and lets one control another.
   Loaded after app.js, whose top-level names (LIB, E, SC, padsPlaying, playItem, playPad…) it uses and, while this
   one controls another, stands in for.

   Finding each other: every Critter Sounds joins Homebase's "lan" room (homebase-server, homebase-cloudflare: everyone whose connection
   comes from the same network shares one) and says its name and whether it's the desktop app or a browser. When a
   network hides that (some IPv6 setups, a phone on mobile data next to the computer), a pairing code does the same.

   Controlling, one side asks and the other confirms:
     1. the asking side makes a WebRTC offer with NO STUN or TURN server, so it only holds this device's own network
        addresses, and sends it with "cs-ask". Both screens show a 4-digit code made from the offer's fingerprint.
     2. the desktop app shows who's asking and the code: Allow or Decline. Nothing happens without Allow.
     3. on Allow it answers ("cs-ok"); the two connect directly. Every address that isn't on the local network
        (a private IPv4 range, link-local IPv6, unique local IPv6, or a browser's .local name) is dropped from both
        sides, so the connection can't leave the network. Homebase only carries these few handshake messages.
   After that everything goes over that connection: the controlling side shows the desktop's library and what it
   plays, and its buttons play, stop, queue and download there. Downloads land on the desktop, never on the
   controlling device. Either side can end it at any time. Only the desktop app can be controlled. */
'use strict';
(() => {
  const ON_WEB = !!window.CS_WEB, KIND = ON_WEB ? 'web' : 'desktop';
  const rnd = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join('');
  const LAN = window.LAN = {
    ws: null, open: false, me: 'p' + rnd(12), rooms: new Map(), backoff: 1000, t: 0,
    pair: '', pairT: 0, joined: new Set(), home: '', homeRoom: '', known: [],
    ctl: null,   // the desktop this one controls: { peer, name, pc, dc }
    host: null,  // the device controlling this one
    asking: null, prompts: new Map(), lastSig: '', name: ''
  };
  const deskName = () => (S().deviceName || LAN.name || (ON_WEB ? 'Critter Sounds in a browser' : 'Critter Sounds')).slice(0, 40);
  const enabled = () => S().lanFind !== false && !!window.CRITTER_DESKTOP && /^https?:/.test(window.CRITTER_DESKTOP.server || '');

  /* ---------- the handshake's messenger: a socket of its own to Homebase ---------- */
  function lanStart() {
    if (LAN.ws || !enabled()) return;
    let uid = localStorage.getItem('hb.uid'), key = localStorage.getItem('hb.key');
    if (!uid || !key) return;
    const ws = LAN.ws = new WebSocket(window.CRITTER_DESKTOP.server.replace(/^http/, 'ws') + '/ws');
    ws.onopen = () => { ws.send(JSON.stringify({ t: 'hello', uid, key })); };
    ws.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'hello') { if (!m.ok) return; LAN.open = true; LAN.backoff = 1000; for (const r of ['lan', ...LAN.joined]) join(r); paintLan(); }
      else if (m.t === 'peers') { LAN.rooms.set(m.room, (m.peers || []).filter(p => p.peer !== LAN.me && p.presence && p.presence.app === 'critter-sounds')); paintLan(); }
      else if (m.t === 'evt' && m.data && m.data.to === LAN.me && m.peer !== LAN.me) onSignal(m.topic, m.data, m.peer, m.room);
    };
    ws.onclose = () => {
      if (LAN.ws !== ws) return;
      LAN.ws = null; LAN.open = false; LAN.rooms.clear(); paintLan();
      if (enabled()) { clearTimeout(LAN.t); LAN.t = setTimeout(lanStart, LAN.backoff); LAN.backoff = Math.min(30000, LAN.backoff * 2); }
    };
  }
  function lanStop() { clearTimeout(LAN.t); const ws = LAN.ws; LAN.ws = null; LAN.open = false; LAN.rooms.clear(); try { ws && ws.close(); } catch {} paintLan(); }
  const raw = m => { if (LAN.open) try { LAN.ws.send(JSON.stringify(m)); } catch {} };
  const presence = () => ({ app: 'critter-sounds', name: deskName(), kind: KIND, v: window.APP_VERSION || '', busy: !!(LAN.ctl || LAN.host) });
  function join(room) { if (room !== 'lan') LAN.joined.add(room); raw({ t: 'join', room, peer: LAN.me, presence: presence() }); }
  function leave(room) { LAN.joined.delete(room); LAN.rooms.delete(room); raw({ t: 'leave', room }); paintLan(); }

  /* ---------- remembered devices: found again wherever they are ----------
     Grouping by network fails when one device reaches Homebase from another address than the other: iCloud Private
     Relay, mobile data, or IPv6 on one and not the other. So each desktop app keeps a private home key and always sits
     in a room named after its hash. A device that controlled it once (after someone pressed Allow there) is handed the
     key over the direct connection and remembers it; from then on both join that room and find each other by
     themselves. Controlling still only works on the same network, and still needs Allow every time. */
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const roomOf = async k => 'csh-' + (await sha('critter-sounds-home|' + k)).slice(0, 32);
  const MAX_KNOWN = 5;   // Homebase lets a connection sit in 8 rooms: lan, its own home, a pairing code, and these
  async function homeRooms() {
    if (!ON_WEB) {
      let k = ''; try { k = localStorage.getItem('cs.home') || ''; if (k.length < 16) { k = rnd(24); localStorage.setItem('cs.home', k); } } catch { k = rnd(24); }
      LAN.home = k; LAN.homeRoom = await roomOf(k); LAN.joined.add(LAN.homeRoom);
    }
    try { LAN.known = JSON.parse(localStorage.getItem('cs.known') || '[]').filter(x => x && typeof x.k === 'string' && x.k.length >= 16).slice(0, MAX_KNOWN); } catch { LAN.known = []; }
    for (const x of LAN.known) { x.room = await roomOf(x.k); LAN.joined.add(x.room); }
  }
  const saveKnown = () => { try { localStorage.setItem('cs.known', JSON.stringify(LAN.known.map(({ k, n, t }) => ({ k, n, t })))); } catch {} };
  async function remember(k, n) {
    if (typeof k !== 'string' || k.length < 16 || k.length > 64 || k === LAN.home) return;
    const room = await roomOf(k), i = LAN.known.findIndex(x => x.k === k);
    if (i >= 0) LAN.known.splice(i, 1);
    LAN.known.unshift({ k, n: String(n || 'Critter Sounds').slice(0, 40), t: Date.now(), room });
    for (const d of LAN.known.splice(MAX_KNOWN)) leave(d.room);
    saveKnown(); if (!LAN.joined.has(room)) join(room);
  }
  function forgetKnown() { for (const x of LAN.known) leave(x.room); LAN.known = []; saveKnown(); toast('Forgot the remembered computers.'); }
  // a desktop app forgets everyone it handed its key to: a new key, a new room
  async function newHome() {
    if (ON_WEB) return;
    if (LAN.homeRoom) leave(LAN.homeRoom);
    try { localStorage.removeItem('cs.home'); } catch {}
    LAN.known.forEach(x => LAN.joined.add(x.room));
    await homeRooms(); join(LAN.homeRoom);
    toast('Devices that controlled this one have to pair again.');
  }
  function announce() { for (const r of LAN.rooms.keys()) raw({ t: 'presence', room: r, peer: LAN.me, presence: presence() }); }
  // to one device; the room is wherever it was seen
  function signal(peer, topic, data) {
    const room = [...LAN.rooms].find(([, list]) => list.some(p => p.peer === peer));
    raw({ t: 'emit', room: room ? room[0] : 'lan', peer: LAN.me, to: peer, topic, data: { ...data, to: peer } });
  }
  setInterval(() => raw({ t: 'ping' }), 30000);
  // everyone nearby, once each (a device can be in the lan room and a pairing room)
  function nearby() { const out = new Map(); for (const list of LAN.rooms.values()) for (const p of list) out.set(p.peer, p); return [...out.values()]; }

  /* ---------- a direct connection that stays on the local network ---------- */
  const localAddr = a => /\.local$/i.test(a) || /^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a) || /^(fe[89ab][0-9a-f]?:|f[cd][0-9a-f]{2}:)/i.test(a);
  const localCand = line => { const p = line.replace(/^a=/, '').split(' '); return p[7] === 'host' && localAddr(p[4] || ''); };
  const localOnly = sdp => String(sdp).split(/\r?\n/).filter(l => !/^a=candidate:/.test(l) || localCand(l)).join('\r\n');
  const gathered = pc => new Promise(r => { if (pc.iceGatheringState === 'complete') return r(); const t = setTimeout(r, 3000); pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } }); });
  async function codeOf(sdp) {
    const fp = (/a=fingerprint:\S+ ([0-9A-F:]+)/i.exec(sdp) || [])[1] || sdp;
    const d = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(fp)));
    return String(((d[0] << 16) | (d[1] << 8) | d[2]) % 10000).padStart(4, '0');
  }
  const newPc = () => new RTCPeerConnection({ iceServers: [] });

  // messages over the channel: JSON, in parts when long
  function wire(S2, dc, onMsg) {
    const parts = new Map();
    S2.send = m => {
      if (dc.readyState !== 'open') return;
      const s = JSON.stringify(m);
      if (s.length <= 60000) { dc.send(s); return; }
      const id = rnd(8), n = Math.ceil(s.length / 60000);
      for (let i = 0; i < n; i++) dc.send(JSON.stringify({ t: 'part', id, i, n, s: s.slice(i * 60000, (i + 1) * 60000) }));
    };
    dc.onmessage = ev => {
      let m; try { m = JSON.parse(ev.data); } catch { return; }
      if (m.t === 'part') {
        const p = parts.get(m.id) || { n: m.n, got: 0, s: [] }; p.s[m.i] = m.s; p.got++; parts.set(m.id, p);
        if (p.got < p.n) return; parts.delete(m.id); try { m = JSON.parse(p.s.join('')); } catch { return; }
      }
      try { onMsg(m); } catch (e) { console.warn('remote', e); }
    };
  }

  /* ---------- asking: this device wants to control a desktop app ---------- */
  async function askControl(p) {
    if (LAN.ctl || LAN.host || LAN.asking) { toast('End the remote control you have first.'); return; }
    if (p.presence.kind !== 'desktop') { toast('Only the desktop app can be controlled: its sounds are on that computer.'); return; }
    const pc = newPc(), dc = pc.createDataChannel('critter-sounds'), sid = rnd(10);
    const A = LAN.asking = { sid, peer: p.peer, name: p.presence.name || 'Critter Sounds', pc, dc, box: null };
    try {
      await pc.setLocalDescription(await pc.createOffer()); await gathered(pc);
      const sdp = localOnly(pc.localDescription.sdp);
      if (!/a=candidate:/.test(sdp)) throw new Error('This device has no address on a local network.');
      A.code = await codeOf(sdp);
      signal(p.peer, 'cs-ask', { sid, sdp, name: deskName(), kind: KIND });
      A.box = waitBox(A);
      A.t = setTimeout(() => askEnd(A, 'No answer from ' + A.name + '.'), 75000);
      dc.onopen = () => { if (LAN.asking !== A) return; clearTimeout(A.t); A.box && A.box.remove(); LAN.asking = null; startControl(A); };
    } catch (e) { askEnd(A, errText(e)); }
  }
  function askEnd(A, why) {
    if (LAN.asking !== A) return;
    clearTimeout(A.t); LAN.asking = null; A.box && A.box.remove(); try { A.pc.close(); } catch {}
    if (why) toast(why);
  }
  function waitBox(A) {
    const box = h('div', { class: 'modal lanm' }, h('div', { class: 'card appear' },
      h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('link')), h('b', { class: 'grow', text: 'Asking ' + A.name })),
      h('p', { text: 'Someone at ' + A.name + ' needs to allow it there. Check that it shows the same code:' }),
      h('div', { class: 'lancode notr', text: A.code.split('').join(' ') }),
      h('p', { class: 'hint', text: 'Once allowed, this connects straight to it over your network. Nothing goes over the internet.' }),
      h('div', { class: 'row end' }, h('button', { type: 'button', class: 'btn ghost', text: '✕ Cancel', onclick: () => { signal(A.peer, 'cs-cancel', { sid: A.sid }); askEnd(A, ''); } }))));
    document.body.append(box); return box;
  }

  /* ---------- being asked: someone wants to control this desktop app ---------- */
  async function onSignal(topic, d, peer) {
    if (topic === 'cs-ask') {
      if (ON_WEB) return signal(peer, 'cs-no', { sid: d.sid, why: 'web' });
      if (LAN.ctl || LAN.host || LAN.prompts.size) return signal(peer, 'cs-no', { sid: d.sid, why: 'busy' });
      const code = await codeOf(d.sdp || ''), who = String(d.name || 'Another device').slice(0, 40);
      const P = { sid: d.sid, peer, name: who, kind: d.kind === 'web' ? 'web' : 'desktop', sdp: d.sdp };
      LAN.prompts.set(d.sid, P);
      P.box = h('div', { class: 'modal lanm' }, h('div', { class: 'card appear' },
        h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('link')), h('b', { class: 'grow', text: 'Remote control?' })),
        h('p', {}, h('b', { class: 'notr', text: who }), h('span', { text: P.kind === 'web' ? ' (in a browser) wants to control Critter Sounds on this computer.' : ' (the desktop app) wants to control Critter Sounds on this computer.' })),
        h('p', { class: 'hint', text: 'It could play, stop and queue sounds here, change playlists and pads, and download sounds to this computer. Only allow it if it shows this code:' }),
        h('div', { class: 'lancode notr', text: code.split('').join(' ') }),
        h('div', { class: 'row end' },
          h('button', { type: 'button', class: 'btn ghost', text: '✕ Decline', onclick: () => decline(P) }),
          h('button', { type: 'button', class: 'btn primary', text: '✓ Allow', onclick: () => allow(P) }))));
      document.body.append(P.box);
      P.t = setTimeout(() => decline(P), 60000);
      try { new Notification('Critter Sounds: remote control?', { body: who + ' wants to control this Critter Sounds.', silent: false }); } catch {}
    } else if (topic === 'cs-cancel') {
      const P = LAN.prompts.get(d.sid); if (P) { clearTimeout(P.t); P.box.remove(); LAN.prompts.delete(d.sid); toast(P.name + ' stopped asking.'); }
    } else if (topic === 'cs-ok') {
      const A = LAN.asking; if (!A || A.sid !== d.sid || A.peer !== peer) return;
      try { await A.pc.setRemoteDescription({ type: 'answer', sdp: localOnly(d.sdp) }); } catch (e) { askEnd(A, errText(e)); return; }
      A.box && A.box.querySelector('p').replaceChildren(document.createTextNode('Allowed. Connecting over your network…'));
      clearTimeout(A.t); A.t = setTimeout(() => askEnd(A, 'Couldn\'t reach ' + A.name + ' directly. Both need to be on the same network, and the network must let devices see each other (a guest Wi-Fi often doesn\'t).'), 15000);
    } else if (topic === 'cs-no') {
      const A = LAN.asking; if (!A || A.sid !== d.sid) return;
      askEnd(A, d.why === 'busy' ? A.name + ' is busy with another remote control.' : d.why === 'web' ? 'Only the desktop app can be controlled.' : A.name + ' declined.');
    }
  }
  function decline(P) {
    if (!LAN.prompts.has(P.sid)) return;
    clearTimeout(P.t); P.box.remove(); LAN.prompts.delete(P.sid); signal(P.peer, 'cs-no', { sid: P.sid, why: 'no' });
  }
  async function allow(P) {
    if (!LAN.prompts.has(P.sid)) return;
    clearTimeout(P.t); P.box.remove(); LAN.prompts.delete(P.sid);
    const pc = newPc();
    try {
      await pc.setRemoteDescription({ type: 'offer', sdp: localOnly(P.sdp) });
      await pc.setLocalDescription(await pc.createAnswer()); await gathered(pc);
      const sdp = localOnly(pc.localDescription.sdp);
      if (!/a=candidate:/.test(sdp)) throw new Error('This computer has no address on a local network.');
      signal(P.peer, 'cs-ok', { sid: P.sid, sdp });
    } catch (e) { toast('Couldn\'t connect: ' + errText(e)); try { pc.close(); } catch {} return; }
    const t = setTimeout(() => { if (!LAN.host) { try { pc.close(); } catch {} toast('Couldn\'t reach ' + P.name + ' directly over the network.'); } }, 15000);
    pc.ondatachannel = ev => { clearTimeout(t); startHosting({ peer: P.peer, name: P.name, kind: P.kind, pc, dc: ev.channel }); };
  }

  /* ---------- the session: shared by both sides ---------- */
  // what stays with each device: how its windows are laid out, its look, language and its own connection
  const LOCAL_SET = ['screen', 'theme', 'lang', 'queueOpen', 'hiddenTips', 'sink', 'onboarded', 'deviceName', 'lanFind', 'autoConnect', 'confirmQuit', 'mediaKeys', 'lobby', 'key', 'fsKey', 'prevVol'];
  const shareable = lib => { const o = JSON.parse(JSON.stringify(lib)); delete o.layout; delete o.layouts; for (const k of LOCAL_SET) if (o.set) delete o.set[k]; return o; };
  const withLocal = (d, local) => { const o = JSON.parse(JSON.stringify(d)); o.layout = local.layout; o.layouts = local.layouts; o.set = { ...(o.set || {}) }; for (const k of LOCAL_SET) if (local.set && local.set[k] !== undefined) o.set[k] = local.set[k]; return o; };
  // the library as app.js reads it on start, from a given object
  async function takeLib(d) { const real = desk.loadLib; desk.loadLib = async () => d; try { await loadLib(); } finally { desk.loadLib = real; } }
  function hookEnd(X, onEnd) {
    let ended = false;
    X.end = (why, quiet) => {
      if (ended) return; ended = true;
      try { X.send && X.send({ t: 'bye' }); } catch {}
      setTimeout(() => { try { X.dc.close(); } catch {} try { X.pc.close(); } catch {} }, 200);
      onEnd(); paintLan(); announce();
      if (!quiet) toast(why || 'Remote control ended.');
    };
    X.dc.onclose = () => X.end(X.who + ' is gone: remote control ended.');
    X.pc.onconnectionstatechange = () => { if (X.pc.connectionState === 'failed' || X.pc.connectionState === 'closed') X.end('The connection to ' + X.who + ' was lost.'); };
  }

  /* ---------- hosting: this desktop app is being controlled ---------- */
  const ACTS = {
    playItem: (plId, itemId) => { const pl = plById(plId), it = pl && pl.items.find(i => i.id === itemId); if (it) playItem(pl, it); },
    transition: (entry, o) => entry && transition(findItem(entry), o || startFade()),
    playNow: item => item && playNow(findItem(item)),
    playPause: () => playPause(), pause: () => pause(), resume: () => resume(), stop: () => stop(), hardStop: () => hardStop(),
    next: () => next(), prev: () => prev(), seek: t => seek(+t || 0),
    playPad: id => { const p = LIB.pads.find(x => x.id === id); if (p) playPad(p); },
    stopPad: (id, secs) => stopPad(id, secs), stopAllPads: () => stopAllPads(),
    startScene: id => { const sc = LIB.scenes.find(s => s.id === id); if (sc) startScene(sc); },
    playScape: (id, quick) => { const d = scById(id); if (d) playScape(d, quick); },
    stopScape: f => stopScape(f),
    setMacro: (id, node, v) => { const d = scById(id), n = d && d.nodes.find(x => x.id === node); if (n) setMacro(d, n, +v); },
    setSleep: m => { setSleep(+m || 0); $('#sleep').value = String(+m || 0); }
  };
  function findItem(x) {
    if (!x || !x.id) return x;
    for (const pl of LIB.playlists) { const i = pl.items.find(y => y.id === x.id); if (i) return i; }
    for (const q of LIB.queue) if (q.item && q.item.id === x.id) return q.item;
    for (const p of LIB.pads) if (p.id === x.id) return p;
    return x;
  }
  // what the controlling side may ask of this app's desk: the library is sent as a whole, never read as files
  const HOST_CALLS = new Set(['exists', 'catalog', 'webGet', 'download', 'csDir', 'yt.status', 'yt.install', 'yt.update', 'yt.search', 'yt.info', 'yt.stream', 'yt.download', 'yt.cancel', 'scape.list', 'scape.get', 'scape.save', 'scape.patch', 'scape.remove', 'scape.nodes']);
  const deskFn = (d, name) => name.split('.').reduce((o, k) => o && o[k], d);
  function startHosting(X) {
    X.who = X.name; LAN.host = X;
    const offs = [];
    wire(X, X.dc, async m => {
      if (m.t === 'act' && Object.hasOwn(ACTS, m.fn)) ACTS[m.fn](...(m.args || []));
      else if (m.t === 'call') {
        try {
          if (!HOST_CALLS.has(m.fn)) throw new Error('not allowed');
          X.send({ t: 'ret', id: m.id, v: await deskFn(desk, m.fn)(...(m.args || [])) });
        } catch (e) { X.send({ t: 'ret', id: m.id, err: errText(e) }); }
      } else if (m.t === 'lib' && m.lib) hostTakeLib(m.lib);
      else if (m.t === 'bye') X.end(X.name + ' ended the remote control.');
    });
    hookEnd(X, () => { LAN.host = null; offs.forEach(f => { try { f(); } catch {} }); clearInterval(X.tick); document.body.classList.remove('lanhost'); remoteBar(); });
    // what plays here, a few times a second while it changes, else once a second for the clock
    let last = '', lastT = 0;
    X.tick = setInterval(() => {
      const st = hostState(), sig = JSON.stringify({ ...st, cur: st.cur && { ...st.cur, t: 0 }, pads: st.pads.map(p => ({ ...p, t: 0 })) });
      if (sig !== last || Date.now() - lastT > 1000) { last = sig; lastT = Date.now(); X.send({ t: 'st', st }); }
    }, 250);
    // downloads' progress and soundscape changes are passed on
    offs.push(desk.yt.onProgress(p => X.send({ t: 'yt', p })));
    offs.push(desk.scape.onSaved(() => setTimeout(() => X.send({ t: 'scapes', list: SC.list }), 50)));
    LAN.lastSig = '';
    sendLib(X);
    X.send({ t: 'scapes', list: SC.list });
    // the key to this computer's room: the other device finds it again by itself next time, wherever it is
    if (LAN.home) X.send({ t: 'home', k: LAN.home, n: deskName() });
    document.body.classList.add('lanhost'); remoteBar(); announce();
    toast(X.name + ' is controlling this Critter Sounds now.');
  }
  function hostState() {
    const c = E.cur, el = c && c.d && c.d.el;
    return {
      state: E.state, q: E.q,
      cur: c ? { kind: c.kind, item: c.item ? JSON.parse(JSON.stringify(c.item)) : null, pending: !!c.pending, t: el ? el.currentTime : 0, dur: el && isFinite(el.duration) ? el.duration : (c.item && c.item.dur) || 0 } : null,
      pads: [...padsPlaying.values()].map(P => ({ id: P.pad.id, stopping: !!P.stopping, t: P.el.currentTime || 0, dur: isFinite(P.el.duration) ? P.el.duration : 0, loop: !!P.el.loop })),
      sc: { active: SC.active, run: !!SC.run }, sleep: $('#sleep').value
    };
  }
  function sendLib(X) {
    const lib = shareable(LIB), sig = JSON.stringify(lib);
    if (sig === LAN.lastSig) return; LAN.lastSig = sig; X.send({ t: 'lib', lib });
  }
  async function hostTakeLib(lib) {
    LAN.lastSig = JSON.stringify(lib);
    const was = { shuffle: S().shuffle, ir: S().irPath };
    await takeLib(withLocal(lib, LIB));
    applySettings(); renderAll(); renderMini();
    // a pad's volume, the playlist order and the room's echo follow at once
    for (const P of padsPlaying.values()) { const p = LIB.pads.find(x => x.id === P.pad.id); if (p) { P.pad = p; try { P.g.gain.setTargetAtTime(clamp(p.vol ?? 1, 0, 1.5), ac.currentTime, 0.05); } catch {} } }
    if (S().shuffle !== was.shuffle && E.q && plById(E.q.plId)) setContext(plById(E.q.plId), E.cur && E.cur.item ? E.cur.item.id : '');
    if (S().irPath && S().irPath !== was.ir) loadIR(S().irPath).catch(() => {});
    pub(); save();
  }
  // this app's own saves go to the controlling side too (desk-boot.js made desk changeable)
  { const real = desk.saveLib; desk.saveLib = async d => { const r = await real(d); if (LAN.host) sendLib(LAN.host); return r; }; }

  /* ---------- controlling: this device plays the desktop app's library, over there ---------- */
  const NATIVE = {}, calls = new Map();
  const ACT_NAMES = Object.keys(ACTS);
  const ser = {
    playItem: (pl, it) => [pl.id, it.id], playPad: p => [p.id], startScene: sc => [sc.id], playScape: (d, quick) => [d.id, !!quick],
    setMacro: (d, n, v) => { n.p = n.p || {}; n.p.v = v; return [d.id, n.id, v]; },
    transition: (e, o) => [JSON.parse(JSON.stringify(e || null)), o || null], playNow: it => [JSON.parse(JSON.stringify(it || null))]
  };
  // app.js's functions are global; while controlling, these happen over there instead of here
  for (const n of ACT_NAMES) {
    const orig = window[n]; if (typeof orig !== 'function') continue;
    window[n] = function (...a) { if (!LAN.ctl) return orig.apply(this, a); LAN.ctl.send({ t: 'act', fn: n, args: ser[n] ? ser[n](...a) : a }); };
  }
  // sound files over there can't be measured from here: the desktop does it
  { const orig = window.durQueue; if (typeof orig === 'function') window.durQueue = items => (LAN.ctl ? undefined : orig(items)); }
  const call = (fn, args) => new Promise((ok, no) => { const id = rnd(8); calls.set(id, { ok, no }); LAN.ctl.send({ t: 'call', id, fn, args }); setTimeout(() => { if (calls.delete(id)) no(new Error(LAN.ctl ? LAN.ctl.name + ' took too long to answer.' : 'Remote control ended.')); }, 600000); });
  const notHere = what => async () => { toast(what); return []; };
  function proxyDesk(X) {
    const set = (name, fn) => { const p = name.split('.'), o = p.length > 1 ? desk[p[0]] : desk, k = p[p.length - 1]; NATIVE[name] = o[k]; o[k] = fn; };
    for (const n of HOST_CALLS) set(n, (...a) => call(n, a));
    set('loadLib', async () => X.lib);
    set('saveLib', async d => { const lib = shareable(d), sig = JSON.stringify(lib); if (sig !== LAN.lastSig) { LAN.lastSig = sig; X.send({ t: 'lib', lib }); } return true; });
    const there = `Add files on ${X.name} itself: sounds stay on that computer.`;
    for (const n of ['pickFolder', 'pickFiles', 'scan']) set(n, notHere(there));
    set('pathOf', () => '');
    set('readFile', async () => null);
    set('scape.import', notHere(`Bring in soundscapes on ${X.name} itself.`));
    set('scape.edit', async () => { toast(`Soundscapes are edited on ${X.name} itself.`); return false; });
    set('scape.folder', async () => false); set('yt.folder', async () => false);
  }
  function unproxyDesk() { for (const [name, fn] of Object.entries(NATIVE)) { const p = name.split('.'), o = p.length > 1 ? desk[p[0]] : desk; o[p[p.length - 1]] = fn; delete NATIVE[name]; } }

  const clock = (t, dur, running, loop) => { const at = performance.now(); return { loop: !!loop, duration: dur || NaN, paused: !running, get currentTime() { let v = t + (running ? (performance.now() - at) / 1000 : 0); if (loop && dur) v %= dur; return dur ? Math.min(v, dur) : v; } }; };
  const QUIET_GAIN = { gain: { setTargetAtTime() {}, cancelScheduledValues() {}, setValueAtTime() {} } };
  const FAKE_RUN = { set: () => true, stop() {} };
  let mirrorSig = '';
  function mirror(st) {
    E.state = st.state; E.q = st.q;
    E.cur = st.cur ? { kind: st.cur.kind, item: st.cur.item ? findItem(st.cur.item) : null, pending: st.cur.pending, d: { el: clock(st.cur.t, st.cur.dur, st.state === 'play') } } : null;
    padsPlaying.clear();
    for (const p of st.pads || []) padsPlaying.set(p.id, { pad: LIB.pads.find(x => x.id === p.id) || { id: p.id, name: 'Sound pad' }, stopping: p.stopping, el: clock(p.t, p.dur, true, p.loop), g: QUIET_GAIN });
    SC.active = st.sc ? st.sc.active : ''; SC.run = st.sc && st.sc.run ? FAKE_RUN : null;
    if ($('#sleep').value !== String(st.sleep || 0)) $('#sleep').value = String(st.sleep || 0);
    const sig = JSON.stringify([st.state, st.q && st.q.plId, st.cur && st.cur.item && st.cur.item.id, st.cur && st.cur.pending, (st.pads || []).map(p => p.id + p.stopping), SC.active, !!SC.run]);
    if (sig !== mirrorSig) { mirrorSig = sig; paint(); padsChanged(); renderPanels('scapes'); renderMini(); }
    else paintTime();
  }
  async function startControl(A) {
    const X = { peer: A.peer, name: A.name, who: A.name, pc: A.pc, dc: A.dc, lib: null };
    wire(X, X.dc, m => {
      if (m.t === 'ret') { const c = calls.get(m.id); if (c) { calls.delete(m.id); if (m.err) c.no(new Error(m.err)); else c.ok(m.v); } }
      else if (m.t === 'lib' && m.lib) ctlTakeLib(X, m.lib);
      else if (m.t === 'st' && LAN.ctl === X) mirror(m.st);
      else if (m.t === 'scapes' && LAN.ctl === X) { SC.list = Array.isArray(m.list) ? m.list : []; SC.loaded = true; renderPanels('scapes'); }
      else if (m.t === 'yt' && typeof ytProgress === 'function') ytProgress(m.p);
      else if (m.t === 'home') remember(m.k, m.n);
      else if (m.t === 'bye') X.end(X.name + ' ended the remote control.');
    });
    // nothing plays here any more: it all plays over there
    hardStop(); stopAllPads(); stopScape(0); try { stopPreview(); } catch {}
    if (NET.on) await disconnect(true);
    X.own = JSON.parse(JSON.stringify(LIB)); X.ownScapes = SC.list;
    proxyDesk(X);
    LAN.ctl = X; LAN.lastSig = ''; mirrorSig = '';
    YT.status = null; YT.res = null; missing.clear();
    hookEnd(X, async () => {
      if (LAN.ctl !== X) return;
      LAN.ctl = null; unproxyDesk();
      for (const c of calls.values()) c.no(new Error('Remote control ended.')); calls.clear();
      // back to this device's own library, with any change to its windows and look kept
      const mine = withLocal(shareable(X.own), LIB);
      E.cur = null; E.state = 'stop'; E.q = null; padsPlaying.clear(); SC.active = ''; SC.run = null; SC.list = X.ownScapes || [];
      YT.status = null; YT.res = null; missing.clear();
      await takeLib(mine); save();
      document.body.classList.remove('lanctl'); remoteBar(); applySettings(); renderAll(); renderMini(); loadScapes();
    });
    document.body.classList.add('lanctl'); remoteBar(); announce();
    toast('You\'re controlling ' + X.name + '. Sounds play there.');
  }
  async function ctlTakeLib(X, lib) {
    X.lib = lib; LAN.lastSig = JSON.stringify(lib);
    await takeLib(withLocal(lib, LIB));
    applySettings(); renderAll(); renderMini();
  }

  /* ---------- what shows ---------- */
  function remoteBar() {
    document.getElementById('lanBar')?.remove();
    const X = LAN.ctl || LAN.host; if (!X) return;
    const bar = h('div', { id: 'lanBar', class: 'lanbar', role: 'status' },
      h('span', { class: 'lanbadge' }, ico('link')),
      LAN.ctl ? h('span', { class: 'grow' }, h('span', { text: 'Controlling ' }), h('b', { class: 'notr', text: X.name }), h('span', { class: 'lanwhy', text: '. Sounds play there, and downloads are saved there.' }))
        : h('span', { class: 'grow' }, h('b', { class: 'notr', text: X.name }), h('span', { text: ' is controlling this Critter Sounds.' })),
      h('button', { type: 'button', class: 'btn tiny', text: '✕ End remote control', onclick: () => X.end() }));
    $('#top').after(bar);
  }
  function paintLan() {
    const b = $('#lanBtn'); if (!b) return;
    if (!b.querySelector('.lann')) b.replaceChildren(ico('link'), h('span', { class: 'lanl', text: 'Nearby' }), h('span', { class: 'lann notr' }));
    const n = nearby().length;
    b.hidden = !enabled();
    b.classList.toggle('on', !!(LAN.ctl || LAN.host));
    b.querySelector('.lann').textContent = n ? String(n) : '';
    b.title = n ? `${n} Critter Sounds nearby` : 'Critter Sounds nearby: control a desktop app from here';
  }
  function lanMenu(anchor) {
    const list = nearby(), X = LAN.ctl || LAN.host;
    popMenu(anchor, [
      { head: 'Critter Sounds nearby' },
      ...list.map(p => {
        const pr = p.presence, desktop = pr.kind === 'desktop', mine = LAN.ctl && LAN.ctl.peer === p.peer;
        return { label: pr.name || 'Critter Sounds', icon: desktop ? 'window' : 'web',
          sub: mine ? 'You control it now' : pr.busy ? (desktop ? 'Desktop app · busy with a remote control' : 'In a browser · busy') : desktop ? 'Desktop app · control it from here' : 'In a browser · it can control this one',
          disabled: !desktop || (pr.busy && !mine) || !!X, fn: () => askControl(p) };
      }),
      // remembered computers that aren't open right now
      ...LAN.known.filter(x => !(LAN.rooms.get(x.room) || []).length).map(x => ({ label: x.n, icon: 'window', sub: 'Remembered · not open right now', disabled: true })),
      list.length || LAN.known.length ? null : { label: 'Nothing nearby yet', sub: 'Open Critter Sounds on another device on this network', icon: 'search', disabled: true },
      '-',
      X ? { label: 'End remote control', icon: 'x', fn: () => X.end() } : null,
      { label: 'Pair with a code…', sub: LAN.known.length ? 'For a computer you haven\'t controlled yet' : 'When a device doesn\'t show up here: once is enough', icon: 'link', fn: pairDialog },
      LAN.known.length ? { label: 'Forget remembered computers', icon: 'trash', fn: forgetKnown } : null,
      { label: 'This device: ' + deskName(), sub: 'Rename it in Settings', icon: 'edit', fn: () => settings() }
    ]);
  }
  // a pairing code: both devices join the same small room, and see each other as if on the same network
  function pairDialog() {
    if (!LAN.open) { toast('Not connected to Homebase yet: try again in a moment.'); return; }
    if (!LAN.pair) { LAN.pair = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0'); join('csp-' + LAN.pair); }
    const inp = h('input', { type: 'text', inputMode: 'numeric', maxLength: 7, placeholder: '123 456', class: 'notr', 'aria-label': 'The other device\'s code' });
    // the same code as a link, and as a QR code the phone's camera opens straight into the web version
    const link = 'https://sounds.crittervtt.com/#pair=' + LAN.pair;
    let qr = null;
    try { const q = qrcode(0, 'M'); q.addData(link); q.make(); qr = h('div', { class: 'lanqr', role: 'img', 'aria-label': 'QR code for ' + link }); qr.innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); } catch {}
    const box = h('div', { class: 'modal lanm', onpointerdown: e => { if (e.target === box) box.remove(); } }, h('form', { class: 'card appear', onsubmit: e => {
      e.preventDefault(); const c = inp.value.replace(/\D/g, '');
      if (c.length !== 6) { inp.focus(); return; }
      if (c === LAN.pair) { toast('That\'s this device\'s own code: enter the other device\'s.'); return; }
      join('csp-' + c); box.remove(); toast('Looking for the other device… it shows up under Nearby.');
      setTimeout(() => { if (nearby().length) lanMenu($('#lanBtn')); }, 1500);
    } },
      h('div', { class: 'row dlgh' }, h('span', { class: 'dlgb' }, ico('link')), h('b', { class: 'grow', text: 'Pair with a code' }), h('button', { type: 'button', class: 'ib', text: '✕', title: 'Close', onclick: () => box.remove() })),
      h('p', { class: 'hint', text: 'Scan the QR code with your phone\'s camera, or enter one device\'s code on the other. Once a device has controlled this one, they find each other by themselves after that. They still connect only over your local network, so both must be on it.' }),
      h('div', { class: 'sec', icon: 'window', text: 'This device\'s code' }),
      h('div', { class: 'lanpair' }, qr, h('div', { class: 'lancode notr', text: LAN.pair.slice(0, 3) + ' ' + LAN.pair.slice(3) })),
      h('div', { class: 'sec', icon: 'link', text: 'The other device\'s code' }),
      h('div', { class: 'row' }, inp, h('button', { type: 'submit', class: 'btn primary', text: '🔗 Pair' }))));
    document.body.append(box); inp.focus();
  }

  /* ---------- start ---------- */
  window.lanSettings = () => [
    h('div', { class: 'setrow' }, h('span', { text: 'This device\'s name' }), h('input', { type: 'text', value: S().deviceName || '', maxLength: 40, placeholder: LAN.name || 'Critter Sounds', oninput: e => { S().deviceName = e.target.value.trim(); save(); clearTimeout(LAN.nameT); LAN.nameT = setTimeout(announce, 600); } })),
    h('label', { class: 'setchk' }, h('input', { type: 'checkbox', checked: S().lanFind !== false, onchange: e => { S().lanFind = e.target.checked; save(); if (e.target.checked) lanStart(); else { (LAN.ctl || LAN.host)?.end(); lanStop(); } } }),
      h('span', {}, h('b', { text: 'Find Critter Sounds on this network' }), h('small', { text: ON_WEB ? 'So you can control a Critter Sounds desktop app from here. Others nearby see this device\'s name.' : 'So a phone, tablet or another computer can control this one: you always confirm first. Others nearby see this device\'s name.' }))),
    h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn tiny', text: '🔗 Pair with a code…', onclick: () => { document.querySelector('.modal')?.remove(); pairDialog(); } }),
      LAN.known.length ? h('button', { type: 'button', class: 'btn tiny ghost', text: '🗑 Forget remembered computers', onclick: forgetKnown }) : null,
      ON_WEB ? null : h('button', { type: 'button', class: 'btn tiny ghost', text: '⟳ Forget devices that controlled this one', title: 'They have to pair again before they find this computer by themselves', onclick: newHome }))
  ];
  window.lanMenu = lanMenu;
  (async () => {
    for (let i = 0; i < 100 && !(LIB && LIB.set && $('#lanBtn')); i++) await sleep(100);
    LAN.name = (await desk.hostName().catch(() => '')) || '';
    $('#lanBtn').onclick = e => lanMenu(e.currentTarget);
    paintLan();
    // after the library has loaded (and Homebase has made this device's key)
    for (let i = 0; i < 50 && !localStorage.getItem('hb.key'); i++) await sleep(200);
    await homeRooms();
    lanStart();
    // opened from a pairing QR code or link (sounds.crittervtt.com/#pair=123456): pair with that device straight away
    const pm = /(?:^|[#&])pair=(\d{6})\b/.exec(location.hash);
    if (pm) {
      try { history.replaceState(history.state, '', location.pathname + location.search); } catch {}
      for (let i = 0; i < 50 && !LAN.open; i++) await sleep(200);
      if (LAN.open) { join('csp-' + pm[1]); toast('Paired: looking for the other device…'); for (let i = 0; i < 15 && !nearby().length; i++) await sleep(200); if (nearby().length) lanMenu($('#lanBtn')); }
    }
  })();
  addEventListener('beforeunload', () => { (LAN.ctl || LAN.host)?.end('', true); });
})();
