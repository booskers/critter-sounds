/* Critter Sounds on a phone or a tablet (the web version). Loaded after app.js and lan.js, whose top-level names it uses.
   A tablet (a touch screen up to 1366px wide) gets a mix of the two: an iPad-style sidebar of sections instead of the
   top bar, playlists beside their tracks, the desktop's player bar along the bottom and the queue beside the rest (or
   sliding in over it when the tablet stands upright). Swipes, long presses and touch-sized controls are as on a phone.
   Settings › Screen layout picks phone, tablet or the desktop's windows by hand.
   A phone (720px wide or less): one screen at a time instead of the canvas of windows, the way iPhone apps work.
     - a tab bar at the bottom: Music, Pads, Soundscapes, Online, More; a large title at the top
     - a mini player above the tabs; tap it (or swipe it up) for Now playing, a full-height sheet with the player, the
       queue and the volumes; swipe the sheet down to close it
     - going deeper (a playlist, Effects…) slides in a screen; swipe from the left edge, or the back button, to go back.
       Each screen and the sheet is a step in the browser's history, so the phone's own back gesture works too
     - swipe a track right to play it next, left to add it to the end of the queue (as in Apple Music); swipe a queued
       track left to take it off, right to play it now
     - swipe the mini player left or right for the next or previous track
     - press and hold a track, a pad or a soundscape for its menu; menus open as action sheets from the bottom
   Every gesture also has a button that does the same, for anyone who can't or doesn't swipe: the back button, the
   sheet's Close, the mini player's buttons, and the menus with Play next and Add to queue. */
'use strict';
(() => {
  if (!window.CS_WEB) return;
  const MQ = matchMedia('(max-width: 720px)');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TABS = [['music', 'Music', 'music', 'playlists'], ['pads', 'Pads', 'pads', 'pads'], ['scapes', 'Soundscapes', 'sparkle', 'scapes'], ['online', 'Online', 'globe', 'online'], ['more', 'More', 'more', '']];
  const MOB = window.MOB = { on: false, tabOn: false, mode: null, tab: 'music', tsec: 'music', stack: [], roots: {}, byId: {}, sheet: false, n: 0 };
  const touchy = () => MOB.on || MOB.tabOn;
  const COARSE = matchMedia('(pointer: coarse)');
  // an iPad says it's a Mac; its touch points give it away
  const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const touchScreen = () => COARSE.matches || IOS;
  // phone, tablet or the desktop's windows ('')
  function wantMode() {
    const p = (typeof LIB !== 'undefined' && LIB.set && LIB.set.screen) || 'auto';
    if (p === 'phone' || p === 'tablet') return p; if (p === 'desktop') return '';
    if (innerWidth <= 720) return 'phone';
    return innerWidth <= 1400 && touchScreen() ? 'tablet' : '';
  }
  const el = {};
  // no glimpse of the desktop layout while the library loads
  { const m = wantMode(); if (m) document.body.classList.add(m); }
  const vib = ms => { try { navigator.vibrate && navigator.vibrate(ms); } catch {} };
  const iosBrowser = IOS && !navigator.standalone && !matchMedia('(display-mode: standalone)').matches;

  /* ---------- the shell ---------- */
  function build() {
    el.title = h('h1', { class: 'mtitle', id: 'mTitle' });
    el.back = h('button', { type: 'button', class: 'mback', 'aria-label': 'Back', onclick: () => history.back() }, ico('back'), h('span', { class: 'mbackl' }));
    el.right = h('div', { class: 'mright' },
      h('button', { type: 'button', class: 'ib', title: 'Settings', 'aria-label': 'Settings', onclick: () => settings() }, ico('gear')));
    el.head = h('header', { class: 'mhead' }, el.back, el.title, el.right);
    el.tools = h('div', { class: 'mtools' });
    el.view = h('main', { class: 'mview', id: 'mView', tabIndex: -1 });
    el.miniArt = h('div', { class: 'mart', 'aria-hidden': 'true' }, ico('note'));
    el.miniT = h('div', { class: 'mmt' }); el.miniS = h('div', { class: 'mms' });
    el.miniPlay = h('button', { type: 'button', class: 'ib mplay', onclick: e => { e.stopPropagation(); playPause(); } });
    el.miniNext = h('button', { type: 'button', class: 'ib', title: 'Next', 'aria-label': 'Next track', onclick: e => { e.stopPropagation(); next(); } }, ico('next'));
    el.miniOpen = h('button', { type: 'button', class: 'mmopen', 'aria-label': 'Now playing: open the player', onclick: () => openSheet() }, el.miniArt, h('span', { class: 'mmtx' }, el.miniT, el.miniS));
    el.prog = h('i');
    el.mini = h('div', { class: 'mmini', role: 'region', 'aria-label': 'Player' }, el.miniOpen, el.miniPlay, el.miniNext, h('div', { class: 'mprog', 'aria-hidden': 'true' }, el.prog));
    // how far the track is, as a thin line along the mini player
    setInterval(() => { if (!MOB.on) return; const c = E.cur, x = c && c.d && c.d.el, d = x && (isFinite(x.duration) ? x.duration : c.item && c.item.dur); el.prog.style.width = d && E.state !== 'stop' ? Math.min(100, x.currentTime / d * 100) + '%' : '0'; }, 500);
    el.tabs = h('nav', { class: 'mtabs', 'aria-label': 'Sections' }, ...TABS.map(([k, n, ic]) => h('button', { type: 'button', class: 'mtab', 'data-tab': k, onclick: () => tabTap(k) }, ico(ic), h('span', { text: n }))));
    el.root = h('div', { id: 'mob' }, el.head, el.tools, el.view, el.mini, el.tabs);
    el.conn = $('#conn');
    el.sheetBody = h('div', { class: 'msbody' });
    el.sheet = h('div', { class: 'msheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Now playing', hidden: true },
      h('div', { class: 'msgrab', 'aria-hidden': 'true' }),
      h('div', { class: 'mshead' }, h('button', { type: 'button', class: 'ib', 'aria-label': 'Close the player', title: 'Close', onclick: () => history.back() }, ico('down')), h('b', { text: 'Now playing' }), h('span', { class: 'grow' })),
      el.sheetBody);
    el.scrim = h('div', { class: 'mscrim', hidden: true, onclick: () => history.back() });
    document.body.append(el.root, el.scrim, el.sheet);
    swipeBack(); sheetDrag(); miniSwipe(); rowSwipes();
  }
  // the desktop layout's pieces the phone uses too move in while it's a phone, and back when it isn't
  const moved = [];
  function borrow(node, into) { if (!node) return; const mark = document.createComment('m'); node.replaceWith(mark); moved.push([node, mark]); into.append(node); }
  function giveBack() { for (const [node, mark] of moved.splice(0)) mark.replaceWith(node); }

  /* ---------- screens ---------- */
  const leafFor = (key, p, s) => (MOB.roots[key] && MOB.roots[key].p === p ? MOB.roots[key] : (MOB.roots[key] = { t: 'leaf', id: 'm-' + key, p, s: s || {} }));
  const cur = () => MOB.stack[MOB.stack.length - 1] || { root: true, leaf: TABS.find(t => t[0] === MOB.tab)[3] ? leafFor(MOB.tab, TABS.find(t => t[0] === MOB.tab)[3]) : null };
  function titleOf(v) {
    if (v.title) return v.title;
    if (v.root) return TABS.find(t => t[0] === MOB.tab)[1];
    if (v.leaf && v.leaf.p === 'playlist') { const pl = plById(v.leaf.s.plId); return pl ? pl.name : 'Playlist'; }
    if (v.leaf) return PANELS[v.leaf.p].name;
    return TABS.find(t => t[0] === MOB.tab)[1];
  }
  function render(dir) {
    if (!MOB.on) return;
    const v = cur(), top = MOB.stack.length;
    for (const b of el.tabs.children) { const on = b.dataset.tab === MOB.tab; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current'); }
    el.title.textContent = titleOf(v);
    el.back.hidden = !top;
    el.back.querySelector('.mbackl').textContent = top ? titleOf(MOB.stack[top - 2] || { root: true }) : '';
    el.tools.replaceChildren(); el.view.replaceChildren();
    if (v.leaf) {
      const tx = h('span', { class: 'tx' }), th = h('div', { class: 'th mth' }, h('span', { class: 'tt' }), tx);
      const body = h('div', { class: 'tbod mbod' }); body.dataset.id = v.leaf.id; MOB.byId[v.leaf.id] = v.leaf;
      const tile = h('div', { class: 'tile mtile' }, th, body); tile._tx = tx; tile.dataset.p = v.leaf.p;
      el.view.append(tile);
      renderLeaf(v.leaf, 0);
      el.tools.append(th); el.tools.hidden = !tx.childNodes.length;
    } else { el.tools.hidden = true; el.view.append(moreList()); }
    if (dir && !reduced()) { el.view.classList.remove('in-l', 'in-r'); void el.view.offsetWidth; el.view.classList.add(dir > 0 ? 'in-r' : 'in-l'); }
    paintRanges(el.root);
  }
  function moreList() {
    const row = (icon, label, sub, fn) => h('button', { type: 'button', class: 'mrow', onclick: fn }, h('span', { class: 'dlgb' }, ico(icon)), h('span', { class: 'mlab' }, h('b', { text: label }), sub ? h('small', { text: sub }) : null), ico('chev', 'mchev'));
    const conn = h('div', { class: 'mgroup mconn' }, h('div', { class: 'sec', icon: 'link', text: 'Your table' }));
    const box = h('div', { class: 'mgroup' },
      ...['scenes', 'effects', 'fades', 'log'].map(p => row(PANELS[p].icon, PANELS[p].name, PANELS[p].desc, () => push({ leaf: leafFor('more-' + p, p) }))),
      row('link', 'Nearby', 'Control a Critter Sounds desktop app from here', e => lanMenu ? lanMenu(e.currentTarget) : null),
      ...['youtube', 'web', 'bots'].filter(p => !(PANELS[p].hideOff && panelOff(PANELS[p]))).map(p => row(PANELS[p].icon, PANELS[p].name, panelOff(PANELS[p]) ? offNote(PANELS[p]) : PANELS[p].desc, () => push({ leaf: leafFor('more-' + p, p) }))));
    const box2 = h('div', { class: 'mgroup' },
      row('palette', 'Look', 'Colours, light or dark, fonts', () => appearance()),
      row('gear', 'Settings', 'Language, nearby devices, accessibility', () => settings()),
      row('help', 'Help', 'Shortcuts, tips and thanks', () => push({ leaf: leafFor('more-help', 'help') })),
      row('window', 'Homebase', 'Which Homebase to connect through', () => window.CRITTER_DESKTOP && window.CRITTER_DESKTOP.changeHomebase()));
    const wrap = h('div', { class: 'mmore' }, conn, box, box2);
    // the music code and Connect, borrowed from the top bar
    if (el.conn) { if (moved.some(([n]) => n === el.conn)) conn.append(el.conn); else borrow(el.conn, conn); }
    return wrap;
  }
  function push(v) {
    MOB.stack.push(v); history.pushState({ mob: ++MOB.n }, '');
    render(1); focusTitle();
  }
  function setTab(k) { MOB.tab = k; while (MOB.stack.length) { MOB.stack.pop(); } render(0); }
  function tabTap(k) {
    if (MOB.tab === k) {
      // the tab that's open: back to its first screen, or to the top of it (as on iOS)
      if (MOB.stack.length) { const n = MOB.stack.length; MOB.stack = []; MOB.skip = 1; history.go(-n); render(-1); }
      else el.view.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
      return;
    }
    if (MOB.stack.length) { const n = MOB.stack.length; MOB.stack = []; MOB.skip = 1; history.go(-n); }
    setTab(k); focusTitle();
  }
  const focusTitle = () => { el.title.setAttribute('tabindex', '-1'); el.title.focus({ preventScroll: true }); };
  // the browser's back (the phone's back gesture or button, and ours) closes the sheet first, then goes up a screen
  addEventListener('popstate', () => {
    if (!MOB.on) return;
    if (MOB.skip) { MOB.skip--; return; }
    closeMenuSheet();
    if (MOB.sheet) { closeSheet(true); return; }
    if (MOB.stack.length) { MOB.stack.pop(); render(-1); focusTitle(); }
  });

  /* ---------- Now playing ---------- */
  function openSheet() {
    if (MOB.sheet) return;
    MOB.sheet = true; MOB.lastFocus = document.activeElement;
    el.sheet.hidden = false; el.scrim.hidden = false;
    history.pushState({ mob: ++MOB.n, sheet: 1 }, '');
    requestAnimationFrame(() => { el.sheet.classList.add('open'); el.scrim.classList.add('open'); });
    renderQueue(); paint();
    setTimeout(() => el.sheet.querySelector('.mshead button').focus(), 50);
    document.body.classList.add('msheet-open');
  }
  function closeSheet(fromHistory) {
    if (!MOB.sheet) return;
    if (!fromHistory) { history.back(); return; }
    MOB.sheet = false; el.sheet.classList.remove('open'); el.scrim.classList.remove('open'); el.sheet.style.transform = '';
    document.body.classList.remove('msheet-open');
    setTimeout(() => { if (!MOB.sheet) { el.sheet.hidden = true; el.scrim.hidden = true; } }, reduced() ? 0 : 300);
    if (MOB.lastFocus && MOB.lastFocus.isConnected) MOB.lastFocus.focus({ preventScroll: true }); else el.miniOpen.focus({ preventScroll: true });
  }
  addEventListener('keydown', e => { if (MOB.on && e.key === 'Escape' && MOB.sheet && !document.querySelector('.modal')) { e.preventDefault(); history.back(); } });
  function paintMini() {
    if (!MOB.on) return;
    const c = E.cur, st = E.state, on = c && c.item;
    el.miniT.textContent = on ? c.item.title : 'Nothing playing';
    el.miniS.textContent = st === 'pause' ? 'Paused' : on && st !== 'stop' ? ($('#nowSub').textContent || '') : padsPlaying.size ? `${padsPlaying.size} sound pad${padsPlaying.size === 1 ? '' : 's'} playing` : SC.run ? 'A soundscape is playing' : 'Tap to open the player';
    el.miniPlay.replaceChildren(ico(st === 'play' ? 'pause' : 'play'));
    el.miniPlay.setAttribute('aria-label', st === 'play' ? 'Pause' : 'Play'); el.miniPlay.title = st === 'play' ? 'Pause' : 'Play';
    el.miniOpen.setAttribute('aria-label', 'Now playing: ' + (on ? c.item.title : 'nothing') + '. Open the player');
    const art = $('#nowArt'); el.miniArt.style.backgroundImage = art ? art.style.backgroundImage : ''; el.miniArt.classList.toggle('has', !!(art && art.style.backgroundImage));
  }

  /* ---------- gestures ---------- */
  // one finger's drag, told apart from a scroll: it's ours once it moves further sideways than down (or the other way)
  function drag(target, { axis, start, move, end, canStart }) {
    target.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' || !touchy() || (canStart && !canStart(e))) return;
      const x0 = e.clientX, y0 = e.clientY, t0 = performance.now(); let mine = null, d = 0;
      const mv = ev => {
        if (ev.pointerId !== e.pointerId) return;
        const dx = ev.clientX - x0, dy = ev.clientY - y0;
        if (mine === null) {
          if (Math.hypot(dx, dy) < 10) return;
          mine = axis === 'x' ? Math.abs(dx) > Math.abs(dy) * 1.2 : Math.abs(dy) > Math.abs(dx) * 1.2;
          if (!mine) { stop(); return; }
          try { target.setPointerCapture(e.pointerId); } catch {}
          start && start(e);
        }
        d = axis === 'x' ? dx : dy; move(d, ev); ev.preventDefault();
      };
      const up = ev => { if (ev.pointerId !== e.pointerId) return; stop(); if (mine) { const v = d / Math.max(1, performance.now() - t0); end(d, v, ev); suppressClick(); } };
      const stop = () => { removeEventListener('pointermove', mv, true); removeEventListener('pointerup', up, true); removeEventListener('pointercancel', up, true); };
      addEventListener('pointermove', mv, { capture: true, passive: false }); addEventListener('pointerup', up, true); addEventListener('pointercancel', up, true);
    });
  }
  const suppressClick = () => { const k = e => { e.stopPropagation(); e.preventDefault(); }; addEventListener('click', k, { capture: true, once: true }); setTimeout(() => removeEventListener('click', k, true), 400); };
  // from the left edge: back a screen (iOS Safari does this itself, through the history)
  function swipeBack() {
    drag(el.view, {
      axis: 'x', canStart: e => !iosBrowser && MOB.stack.length > 0 && e.clientX < 28,
      start: () => { el.view.style.transition = 'none'; },
      move: d => { el.view.style.transform = `translateX(${Math.max(0, d)}px)`; },
      end: (d, v) => {
        el.view.style.transition = reduced() ? 'none' : 'transform .22s ease';
        if (d > innerWidth * 0.33 || v > 0.5) { el.view.style.transform = `translateX(${innerWidth}px)`; setTimeout(() => { el.view.style.transition = 'none'; el.view.style.transform = ''; history.back(); }, reduced() ? 0 : 200); }
        else el.view.style.transform = '';
      }
    });
  }
  // the sheet follows a finger down from its top (or anywhere while its list is scrolled to the top)
  function sheetDrag() {
    drag(el.sheet, {
      axis: 'y', canStart: e => !e.target.closest('input[type=range],select,.qlist li') && (e.target.closest('.msgrab,.mshead') || el.sheetBody.scrollTop <= 0),
      start: () => { el.sheet.style.transition = 'none'; },
      move: d => { el.sheet.style.transform = `translateY(${Math.max(0, d)}px)`; },
      end: (d, v) => { el.sheet.style.transition = ''; el.sheet.style.transform = ''; if (d > 120 || v > 0.6) history.back(); }
    });
  }
  // the mini player: sideways for the next or previous track, up for the player
  function miniSwipe() {
    drag(el.miniOpen, {
      axis: 'x',
      move: d => { el.miniOpen.style.transform = `translateX(${d * 0.6}px)`; el.miniOpen.style.opacity = String(1 - Math.min(0.6, Math.abs(d) / 300)); },
      end: d => {
        el.miniOpen.style.transform = ''; el.miniOpen.style.opacity = '';
        if (d < -60) { vib(8); next(); } else if (d > 60) { vib(8); prev(); }
      }
    });
    drag(el.miniOpen, { axis: 'y', move: () => {}, end: (d, v) => { if (d < -30 || v < -0.4) openSheet(); } });
  }
  // a track or a queued track: sideways to queue it, play it or take it off
  function rowSwipes() {
    const hint = h('div', { class: 'mswipe', 'aria-hidden': 'true' }); document.body.append(hint);
    const rowOf = e => e.target.closest('.tracks tr[data-id], .qlist li.qi');
    const what = (row, d) => {
      if (row.matches('li.qi')) return d > 0 ? ['play', 'Play now', 'go'] : ['trash', 'Take off', 'bad'];
      return d > 0 ? ['playnext', 'Play next', 'go'] : ['queue', 'Add to queue', 'alt'];
    };
    let row = null;
    const root = document.body;
    drag(root, {
      axis: 'x', canStart: e => { row = rowOf(e); return !!row && !(MOB.stack.length && e.clientX < 28); },
      start: () => { row.style.transition = 'none'; },
      move: d => {
        row.style.transform = `translateX(${d}px)`;
        const r = row.getBoundingClientRect(), [ic, label, cls] = what(row, d), far = Math.abs(d) > 90;
        hint.className = 'mswipe on ' + cls + (far ? ' far' : '');
        Object.assign(hint.style, { top: r.top + 'px', height: r.height + 'px', left: (d > 0 ? r.left - d : r.right) + 'px', width: Math.abs(d) + 'px', justifyContent: d > 0 ? 'flex-start' : 'flex-end' });
        hint.replaceChildren(ico(ic), h('span', { text: label }));
      },
      end: d => {
        const r = row; row = null; hint.className = 'mswipe';
        r.style.transition = reduced() ? 'none' : 'transform .2s ease'; r.style.transform = '';
        if (Math.abs(d) < 90) return;
        vib(10);
        if (r.matches('li.qi')) { const q = LIB.queue.find(x => x.qid === r.dataset.qid); if (!q) return; dequeue(q.qid); if (d > 0) transition(q.item, startFade()); return; }
        const lf = (r.closest('.tbod') && MOB.byId[r.closest('.tbod').dataset.id]) || cur().leaf, pl = lf && plById(lf.s.plId), it = pl && pl.items.find(i => i.id === r.dataset.id);
        if (it) enqueue([it], d > 0);
      }
    });
  }
  // press and hold: the menu a right-click opens on a computer (iPhones don't send one themselves)
  let lastTouch = 0;
  addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch' || !touchy()) return;
    lastTouch = Date.now();
    const target = e.target.closest('.tracks tr[data-id], .pad, .stile, .qi, [data-plid]'); if (!target) return;
    const x = e.clientX, y = e.clientY;
    const t = setTimeout(() => { done(); vib(12); suppressClick(); target.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y })); }, 520);
    const mv = ev => { if (Math.hypot(ev.clientX - x, ev.clientY - y) > 10) done(); };
    const done = () => { clearTimeout(t); removeEventListener('pointermove', mv, true); removeEventListener('pointerup', done, true); removeEventListener('pointercancel', done, true); };
    addEventListener('pointermove', mv, true); addEventListener('pointerup', done, true); addEventListener('pointercancel', done, true);
  }, true);
  // a double tap is two taps, as in an iOS app: no double-click behaviour from a finger (a tap already plays a track)
  addEventListener('dblclick', e => { if (touchy() && Date.now() - lastTouch < 1500) { e.preventDefault(); e.stopPropagation(); } }, true);
  // Android sends its own on a long press: ours is the one that counts
  addEventListener('contextmenu', e => { if (touchy() && e.isTrusted && Date.now() - lastTouch < 1500) { e.preventDefault(); e.stopPropagation(); } }, true);

  /* ---------- menus as action sheets ---------- */
  let menuScrim = null;
  function closeMenuSheet() { if (menuEl) closeMenu(); }
  const origPop = popMenu;
  window.popMenu = function (anchor, items, x, y) {
    origPop(anchor, items, x, y);
    if (!MOB.on || !menuEl) return;
    menuEl.classList.add('msmenu'); menuEl.setAttribute('role', 'menu');
    menuEl.prepend(h('div', { class: 'msgrab', 'aria-hidden': 'true' }));
    menuEl.append(h('button', { type: 'button', class: 'mi mcancel', onclick: () => closeMenu() }, h('span', { text: 'Cancel' })));
    menuScrim = h('div', { class: 'mscrim open menu-scrim', onclick: () => closeMenu() }); menuEl.before(menuScrim);
    const m = menuEl, restore = m._restore; m._restore = () => { restore && restore(); if (menuScrim) { menuScrim.remove(); menuScrim = null; } };
    drag(m, { axis: 'y', canStart: e => !!e.target.closest('.msgrab') || m.scrollTop <= 0, move: d => { m.style.transform = `translateY(${Math.max(0, d)}px)`; }, end: (d, v) => { m.style.transform = ''; if (d > 80 || v > 0.5) closeMenu(); } });
    setTimeout(() => { const f = m.querySelector('button.mi:not([disabled])'); if (f) f.focus({ preventScroll: true }); }, 30);
  };

  /* ---------- app.js, for a phone ---------- */
  const wrap = (name, fn) => { const o = window[name]; if (typeof o !== 'function') return; window[name] = function (...a) { return fn(o, a, this); }; };
  wrap('showPlaylist', (o, [pl]) => {
    if (MOB.tabOn) { sel.clear(); checkMissing(pl); durQueue(pl.items); MOB.tsec = 'music'; leafFor('t-pl', 'playlist').s.plId = pl.id; renderTablet(); return; }
    if (!MOB.on) return o(pl);
    sel.clear(); checkMissing(pl); durQueue(pl.items);
    const top = cur();
    if (top.leaf && top.leaf.p === 'playlist' && !top.root) { top.leaf.s.plId = pl.id; render(0); return; }
    if (MOB.tab !== 'music') setTab('music');
    push({ leaf: { t: 'leaf', id: 'm-pl-' + pl.id, p: 'playlist', s: { plId: pl.id } } });
  });
  wrap('openPanel', (o, [p, s]) => {
    if (MOB.tabOn) { MOB.tsec = p === 'playlists' || p === 'playlist' ? 'music' : p; if (p === 'playlist' && s && s.plId) leafFor('t-pl', 'playlist').s.plId = s.plId; renderTablet(); return visibleLeaves().find(l => l.p === p) || visibleLeaves()[0]; }
    if (!MOB.on) return o(p, s);
    const tab = TABS.find(t => t[3] === p);
    if (tab && !s) { tabTap(tab[0]); return cur().leaf; }
    const leaf = { t: 'leaf', id: 'm-' + p + '-' + Date.now().toString(36), p, s: s || {} };
    push({ leaf }); return leaf;
  });
  wrap('focusedLeaf', (o, [kind]) => { if (MOB.tabOn) return visibleLeaves().find(l => !kind || l.p === kind) || null; if (!MOB.on) return o(kind); const v = cur(); return v.leaf && (!kind || v.leaf.p === kind) ? v.leaf : null; });
  wrap('renderPanels', (o, kinds) => {
    o(...kinds);
    if (MOB.tabOn) { cancelAnimationFrame(MOB.rpT); MOB.rpT = requestAnimationFrame(() => { for (const l of visibleLeaves()) if (!kinds.length || kinds.includes(l.p)) renderLeaf(l); }); return; }
    if (!MOB.on) return;
    const v = cur(); if (!v.leaf) return;
    if (!kinds.length || kinds.includes(v.leaf.p)) { cancelAnimationFrame(MOB.rpT); MOB.rpT = requestAnimationFrame(() => { if (el.view.querySelector('.tbod')) renderLeaf(v.leaf); el.tools.hidden = !el.tools.querySelector('.tx').childNodes.length; }); }
  });
  wrap('renderTree', (o, a) => { if (MOB.tabOn) return renderTablet(); if (!MOB.on) return o(...a); render(0); });
  wrap('paint', (o, a) => { o(...a); paintMini(); });
  wrap('renderMini', (o, a) => { o(...a); paintMini(); });
  // a tip says what to do with a finger
  // (in German: translated first, then the German words for a mouse become the ones for a finger)
  const fingerDe = s => String(s).replace(/[^.]*\bziehen\b[^.]*\.\s*/g, '').replace(/Doppelklick(e|en)?/g, 'Tippen').replace(/Rechtsklick(e|en)?/g, 'Langes Drücken').replace(/\bKlick(e|en)?\b/g, 'Tippen').replace(/\bklicke\b/g, 'tippe').replace(/\bklicken\b/g, 'tippen');
  wrap('tip', (o, [id, text]) => o(id, touchy() && window.I18N && I18N.lang === 'de' ? fingerDe(I18N.tr(text)) : touchy() ? String(text).replace(/\bRight-click\b/g, 'Press and hold').replace(/\bright-click\b/g, 'press and hold').replace(/\bDouble-click\b/g, 'Tap').replace(/\bdouble-click\b/g, 'tap').replace(/\bClick\b/g, 'Tap').replace(/\bclick\b/g, 'tap').replace(/,? or drag (it|them) onto[^.]*/g, '').replace(/Drag (tracks|them) to reorder[^.]*\.\s*/g, '') : text));
  // a tap on a track plays it, as in Apple Music (the menu, from a long press, has the rest)
  addEventListener('click', e => {
    if (!touchy()) return;
    const r = e.target.closest('.mview .tracks tr[data-id], #tab .tracks tr[data-id]'); if (!r || e.target.closest('button,input,select,a,label')) return;
    const lf = (r.closest('.tbod') && MOB.byId[r.closest('.tbod').dataset.id]) || cur().leaf, pl = lf && plById(lf.s.plId), it = pl && pl.items.find(i => i.id === r.dataset.id);
    if (!it) return;
    e.stopPropagation(); e.preventDefault(); playItem(pl, it);
  }, true);
  addEventListener('click', e => {
    if (!touchy()) return;
    const li = e.target.closest('.msheet .qlist li.qi, .tqueue .qlist li.qi'); if (!li || e.target.closest('button')) return;
    const q = LIB.queue.find(x => x.qid === li.dataset.qid); if (!q) return;
    e.stopPropagation(); dequeue(q.qid); transition(q.item, startFade());
  }, true);
  // the tours point at the big-screen layout
  wrap('startTour', (o, a) => { if (MOB.tabOn) { toast('The tours show the windows of the desktop layout. On a tablet: the sections are on the left, the player along the bottom, and Up next on the right.'); return; } if (!MOB.on) return o(...a); toast('The tours show the layout for bigger screens. On a phone: the tabs at the bottom are your sections, and the player opens from the bar above them.'); });

  /* ---------- a tablet: an iPad-style sidebar, two panes side by side, the desktop's player and queue ---------- */
  const T = {};
  const visibleLeaves = () => [...document.querySelectorAll('#tab .tbod')].map(b => MOB.byId[b.dataset.id]).filter(Boolean);
  function buildTablet() {
    T.nav = h('nav', { class: 'tside', 'aria-label': 'Sections' });
    T.conn = h('div', { class: 'tconn' }); T.lanBox = h('div', { class: 'tlan' });
    T.title = h('h1', { class: 'mtitle ttitle', tabIndex: -1 });
    T.qBtn = h('button', { type: 'button', class: 'btn ghost', 'aria-expanded': 'false', onclick: () => toggleQueue() }, ico('queue'), h('span', { text: 'Up next' }));
    T.panes = h('div', { class: 'tpanes' });
    T.main = h('main', { class: 'tmain' }, h('header', { class: 'thead' }, T.title, h('span', { class: 'grow' }), T.qBtn), T.panes);
    T.side = h('aside', { class: 'tqueue', 'aria-label': 'Up next' });
    T.scrim = h('div', { class: 'mscrim tscrim', hidden: true, onclick: () => toggleQueue(false) });
    T.root = h('div', { id: 'tab' }, T.nav, T.main, T.side);
    $('#main').before(T.root); T.root.append(T.scrim);
    // Up next slides in from the right when the tablet stands upright; a swipe to the right puts it away
    drag(T.side, { axis: 'x', canStart: e => document.body.classList.contains('tq-over') && !e.target.closest('.qlist li.qi'), move: d => { T.side.style.transform = `translateX(${Math.max(0, d)}px)`; }, end: (d, v) => { T.side.style.transform = ''; if (d > 80 || v > 0.5) toggleQueue(false); } });
    addEventListener('keydown', e => { if (MOB.tabOn && e.key === 'Escape' && document.body.classList.contains('tq-over') && !document.querySelector('.modal')) toggleQueue(false); });
  }
  const wide = () => innerWidth >= 1100;
  function toggleQueue(force) {
    if (wide()) { MOB.tqHidden = force === undefined ? !MOB.tqHidden : !force; }
    else { const on = force === undefined ? !document.body.classList.contains('tq-over') : force; document.body.classList.toggle('tq-over', on); T.scrim.hidden = !on; T.scrim.classList.toggle('open', on); if (on) setTimeout(() => { const f = T.side.querySelector('button,input'); if (f) f.focus({ preventScroll: true }); }, 50); else T.qBtn.focus({ preventScroll: true }); }
    paintTabQueue();
  }
  function paintTabQueue() {
    const col = wide() && !MOB.tqHidden, over = !wide() && document.body.classList.contains('tq-over');
    document.body.classList.toggle('tq-col', col);
    if (wide()) { document.body.classList.remove('tq-over'); T.scrim.hidden = true; }
    T.qBtn.setAttribute('aria-expanded', String(col || over));
  }
  function navTablet() {
    const item = (k, label, icon, note) => h('button', { type: 'button', class: 'tnav' + (MOB.tsec === k ? ' on' : ''), 'aria-current': MOB.tsec === k ? 'page' : null, onclick: () => { MOB.tsec = k; renderTablet(); T.title.focus({ preventScroll: true }); } }, ico(icon), h('span', { text: label }), note ? h('small', { class: 'deskchip', text: note }) : null);
    const more = ['youtube', 'scenes', 'effects', 'fades', 'web', 'bots', 'log', 'help'].filter(p => !(PANELS[p].hideOff && panelOff(PANELS[p])));
    const foot = (icon, label, fn) => h('button', { type: 'button', class: 'tnav', onclick: fn }, ico(icon), h('span', { text: label }));
    T.nav.replaceChildren(
      h('div', { class: 'tbrand' }, T.logo || (T.logo = ($('#top .brand svg') || h('b', { text: 'Critter Sounds' })).cloneNode(true))),
      T.conn,
      h('div', { class: 'tlist' }, item('music', 'Music', 'music'), ...['pads', 'scapes', 'online'].map(p => item(p, PANELS[p].name, PANELS[p].icon))),
      h('div', { class: 'sec tsec', text: 'More' }),
      h('div', { class: 'tlist' }, ...more.map(p => item(p, PANELS[p].name, PANELS[p].icon, panelOff(PANELS[p]) ? 'Desktop' : ''))),
      h('span', { class: 'grow' }),
      h('div', { class: 'tlist tfoot' }, T.lanBox, foot('palette', 'Look', () => appearance()), foot('gear', 'Settings', () => settings()), foot('window', 'Homebase', () => window.CRITTER_DESKTOP && window.CRITTER_DESKTOP.changeHomebase())));
  }
  function pane(leaf, into) {
    MOB.byId[leaf.id] = leaf;
    const tx = h('span', { class: 'tx' }), P = PANELS[leaf.p];
    const th = h('div', { class: 'th' }, h('span', { class: 'ti' }, ico(P.icon)), h('span', { class: 'tt', text: leaf.p === 'playlist' && plById(leaf.s.plId) ? plById(leaf.s.plId).name : P.name }), tx);
    const body = h('div', { class: 'tbod' }); body.dataset.id = leaf.id;
    const tile = h('div', { class: 'tile ttile' }, th, body); tile._tx = tx; tile.dataset.p = leaf.p;
    into.append(tile); renderLeaf(leaf, 0);
  }
  function renderTablet() {
    if (!MOB.tabOn) return;
    const k = PANELS[MOB.tsec] || MOB.tsec === 'music' ? MOB.tsec : 'music';
    navTablet();
    T.title.textContent = k === 'music' ? 'Music' : PANELS[k].name;
    T.panes.replaceChildren(); T.panes.className = 'tpanes' + (k === 'music' ? ' two' : '');
    if (k === 'music') { const pl = leafFor('t-pl', 'playlist'); if (!plById(pl.s.plId)) pl.s.plId = (LIB.playlists[0] || {}).id; pane(leafFor('t-pls', 'playlists'), T.panes); pane(pl, T.panes); }
    else pane(leafFor('t-' + k, k), T.panes);
    paintTabQueue(); paintRanges(T.root);
  }

  /* ---------- on and off ---------- */
  function apply() {
    const m = wantMode();
    if (m === MOB.mode) { if (MOB.tabOn) paintTabQueue(); return; }
    // leave the layout it had
    if (MOB.on) { if (MOB.sheet) closeSheet(true); el.root.hidden = true; }
    if (MOB.tabOn) { T.root.hidden = true; document.body.classList.remove('tq-over', 'tq-col'); T.scrim.hidden = true; }
    giveBack(); if (MOB.qo !== undefined) { S().queueOpen = MOB.qo; MOB.qo = undefined; }
    MOB.mode = m; MOB.on = m === 'phone'; MOB.tabOn = m === 'tablet';
    document.body.classList.toggle('phone', MOB.on); document.body.classList.toggle('tablet', MOB.tabOn);
    closeMenu();
    if (MOB.tabOn) {
      if (!T.root) buildTablet();
      T.root.hidden = false;
      MOB.qo = S().queueOpen; S().queueOpen = true;
      $('#canvas').replaceChildren();
      borrow($('#conn'), T.conn); borrow($('#connHint'), T.conn); borrow($('#lanBtn'), T.lanBox); borrow($('#queue'), T.side);
      renderTablet(); renderQueue(); paint();
    } else if (MOB.on) {
      if (!el.root) build();
      el.root.hidden = false;
      MOB.qo = S().queueOpen; S().queueOpen = true;
      $('#canvas').replaceChildren();
      borrow($('#bar'), el.sheetBody); borrow($('#queue'), el.sheetBody); borrow($('#lanBtn'), el.right);
      MOB.stack = []; render(0); paintMini();
    } else renderAll();
  }
  let rsT = 0; addEventListener('resize', () => { clearTimeout(rsT); rsT = setTimeout(apply, 120); });
  MQ.addEventListener('change', apply); COARSE.addEventListener('change', apply);
  // Settings › General: the layout, chosen by hand
  window.screenSettings = () => h('div', { class: 'setrow' }, h('span', { text: 'Screen layout' }),
    h('select', { 'aria-label': 'Screen layout', onchange: e => { S().screen = e.target.value; save(); apply(); } },
      ...[['auto', 'Automatic'], ['phone', 'Phone'], ['tablet', 'Tablet'], ['desktop', 'Desktop: windows']].map(([v, n]) => h('option', { value: v, text: n, selected: (S().screen || 'auto') === v }))));
  (async () => { for (let i = 0; i < 100 && !(LIB && LIB.set && document.querySelector('#bar .trans')); i++) await sleep(50); await sleep(50); apply(); })();
})();
