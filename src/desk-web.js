/* Critter Sounds in a browser: stands in for what the desktop app's main process does (preload.js's window.desk).
   Your sounds stay on this device: files you add are kept in this browser's own storage (IndexedDB), never uploaded.
   What only the desktop app can do (saving sounds from the web, YouTube, voice-chat bots, web page sound, rendering
   loops to WAV) answers "Available on Desktop", unless this page is controlling a desktop app on the network (lan.js).
   Files are named like paths, so the player treats them as it does on the desktop:
     web/<file id>/<name.mp3>                       a file added on its own
     webdir/<folder id>/<Folder>                    a folder you added; its files are webdir/<folder id>/<Folder>/<file id>/<name.mp3> */
'use strict';
(() => {
  window.CS_WEB = true;
  const AUDIO = /\.(mp3|ogg|oga|opus|wav|flac|m4a|aac|webm)$/i;
  const DESK_ONLY = 'Available on Desktop';
  const deskOnly = () => Promise.reject(Object.assign(new Error(DESK_ONLY), { deskOnly: true }));
  // the web version's own server passes sounds and catalogues through, as the desktop app does (web-worker/worker.js)
  const PROXY = u => '/proxy?u=' + encodeURIComponent(u);
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /* ---------- storage: IndexedDB ---------- */
  let dbp = null;
  const db = () => dbp || (dbp = new Promise((ok, no) => {
    const r = indexedDB.open('critter-sounds', 1);
    r.onupgradeneeded = () => { const d = r.result; for (const s of ['kv', 'files', 'folders', 'scapes']) if (!d.objectStoreNames.contains(s)) d.createObjectStore(s); };
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  }));
  const tx = async (store, mode, fn) => { const d = await db(); return new Promise((ok, no) => { const t = d.transaction(store, mode), s = t.objectStore(store); let v; Promise.resolve(fn(s)).then(x => { v = x; }); t.oncomplete = () => ok(v && v.result !== undefined ? v.result : v); t.onerror = () => no(t.error); t.onabort = () => no(t.error); }); };
  const get = (store, k) => tx(store, 'readonly', s => s.get(k));
  const put = (store, k, v) => tx(store, 'readwrite', s => { s.put(v, k); });
  const del = (store, k) => tx(store, 'readwrite', s => { s.delete(k); });
  const all = store => tx(store, 'readonly', s => s.getAll());
  // ask the browser to keep this storage even when the disk fills up
  try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch {}

  /* ---------- files: a page address for each one, made once ---------- */
  const urls = new Map(), sizes = new Map(), saving = new Map();
  const idOf = p => { const s = String(p || '').split('/'); return (s[0] === 'web' || s[0] === 'webdir') && s.length >= 3 ? s[s.length - 2] : ''; };
  const ready = (async () => {
    try { for (const f of await all('files')) if (f && f.id && f.blob) { urls.set(f.id, URL.createObjectURL(f.blob)); sizes.set(f.id, f.size || f.blob.size); } } catch (e) { console.warn('storage', e); }
  })();
  function keep(file, folder) {
    const id = uid(), path = (folder ? folder + '/' : 'web/') + id + '/' + String(file.name || 'Sound').replace(/[\\/]/g, ' ');
    urls.set(id, URL.createObjectURL(file)); sizes.set(id, file.size);
    saving.set(id, put('files', id, { id, name: file.name, blob: file, size: file.size, added: Date.now() }).catch(e => { console.warn(e); toastSoon('This browser has no room left for that file.'); }).finally(() => saving.delete(id)));
    return path;
  }
  const toastSoon = m => setTimeout(() => { try { toast(m); } catch {} }, 0);
  // the player's hooks for where a sound or a picture comes from (app.js: mediaUrl, remoteUrl, coverUrl)
  window.CS_MEDIA = p => urls.get(idOf(p)) || '';
  window.CS_REMOTE = u => (/^(blob|data):/.test(u) ? u : PROXY(u));
  window.CS_COVER = () => '';

  // a file chooser; the browser only opens one in answer to a click, which is where these are called from
  const choose = (accept, dir) => new Promise(resolve => {
    const i = document.createElement('input'); i.type = 'file'; i.multiple = true; if (accept) i.accept = accept; if (dir) i.webkitdirectory = true;
    i.style.display = 'none'; document.body.append(i);
    let done = false; const fin = v => { if (done) return; done = true; i.remove(); resolve(v); };
    i.onchange = () => fin([...(i.files || [])]);
    i.oncancel = () => fin([]);
    i.click();
  });

  /* ---------- the scape editor's messages between tabs (on the desktop they go through the main process) ---------- */
  const chan = name => { try { return new BroadcastChannel('critter-sounds-' + name); } catch { return { postMessage() {}, addEventListener() {}, removeEventListener() {} }; } };
  const CH = { cmd: chan('scape-cmd'), state: chan('scape-state'), saved: chan('scape-saved') };
  const listen = (c, fn) => { const h = e => fn(e.data); c.addEventListener('message', h); return () => c.removeEventListener('message', h); };
  const scapeSaved = d => { try { CH.saved.postMessage(JSON.parse(JSON.stringify(d))); } catch {} };
  const validDoc = d => d && typeof d === 'object' && typeof d.id === 'string' && Array.isArray(d.nodes);

  const cachedCatalog = async (name, fresh, make) => {
    const c = fresh ? null : await get('kv', 'catalog-' + name).catch(() => null);
    if (c && Date.now() - c.t < (name === 'tabletop' ? 24 : 72) * 3600e3) return c.v;
    try { const v = await make(); await put('kv', 'catalog-' + name, { t: Date.now(), v }); return v; }
    catch (e) { if (c) return c.v; throw e; }
  };
  const getText = async (url, headers) => { const r = await fetch(PROXY(url), { headers: headers || {} }); return { status: r.status, text: await r.text(), limit: r.headers.get('x-ratelimit-available-anon_burst') }; };
  const unhtml = s => String(s || '').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&rsquo;/g, '\'').replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  // the same two catalogues the desktop app reads (main.js: tabletopAudio, incompetech); keep them in step
  async function tabletopAudio() {
    const { text } = await getText('https://tabletopaudio.com/'), out = [];
    for (const block of text.split('<!--song ').slice(1)) {
      const num = parseInt(block, 10), save = /saveAs\('([^']+)'\)/.exec(block);
      if (!num || !save) continue;
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
  async function incompetech() {
    const { text } = await getText('https://incompetech.com/music/royalty-free/pieces.json');
    const sec = t => String(t || '').split(':').reduce((s, x) => s * 60 + (+x || 0), 0);
    return JSON.parse(text).filter(p => p && p.filename).map(p => ({ id: 'inc' + (p.isrc || p.filename), title: p.title, desc: p.description || '', feel: String(p.feel || '').split(',').map(s => s.trim()).filter(Boolean), instruments: p.instruments || '', bpm: +p.bpm || 0, dur: sec(p.length), uploaded: p.uploaded || '', url: 'https://incompetech.com/music/royalty-free/mp3-royaltyfree/' + encodeURIComponent(p.filename) }));
  }

  const nothing = () => () => {};
  const platform = () => { const u = navigator.userAgent; return /Android/i.test(u) ? 'Android' : /iPhone|iPad/i.test(u) ? 'iPhone or iPad' : /Mac/i.test(u) ? 'Mac' : /Windows/i.test(u) ? 'Windows' : /Linux/i.test(u) ? 'Linux' : 'this device'; };

  window.desk = {
    web: true,
    loadLib: async () => { await ready; return (await get('kv', 'lib').catch(() => null)) || null; },
    saveLib: async data => { await put('kv', 'lib', JSON.parse(JSON.stringify(data))); return true; },
    pickFolder: async () => {
      const files = (await choose('', true)).filter(f => AUDIO.test(f.name));
      if (!files.length) return [];
      const name = String((files[0].webkitRelativePath || '').split('/')[0] || 'Folder'), fid = uid(), folder = `webdir/${fid}/${name}`;
      files.sort((a, b) => (a.webkitRelativePath || a.name).localeCompare(b.webkitRelativePath || b.name, undefined, { numeric: true }));
      const paths = files.map(f => keep(f, folder));
      await put('folders', fid, { id: fid, name, paths });
      return [folder];
    },
    pickFiles: async kind => (await choose(kind === 'ir' ? '.wav,audio/wav' : 'audio/*,.mp3,.ogg,.opus,.wav,.flac,.m4a,.aac', false)).filter(f => kind === 'ir' || AUDIO.test(f.name) || /^audio\//.test(f.type)).map(f => keep(f)),
    scan: async paths => {
      const out = [];
      for (const p of [].concat(paths || [])) {
        const s = String(p).split('/');
        if (s[0] === 'webdir' && s.length === 3) { const f = await get('folders', s[1]).catch(() => null); if (f) out.push(...f.paths.filter(x => sizes.has(idOf(x)))); }
        else if (idOf(p) && sizes.has(idOf(p))) out.push(p);
      }
      return out;
    },
    exists: async paths => { await ready; return [].concat(paths || []).map(p => sizes.get(idOf(p)) || 0); },
    readFile: async p => { const id = idOf(p); if (saving.has(id)) await saving.get(id); const f = await get('files', id).catch(() => null); return f ? new Uint8Array(await f.blob.arrayBuffer()) : null; },
    // a file dropped onto the page: kept in this browser, and named like the others
    pathOf: file => (file && (AUDIO.test(file.name || '') || /^audio\//.test(file.type || '')) ? keep(file) : ''),
    webOpen: deskOnly, webNav: async () => false, webMedia: async () => false, webState: async () => ({ open: false }),
    onWeb: nothing, onKey: nothing, onCloseAsked: nothing, quitOk() {}, mini: async () => false, winCmd() {}, onWinState: nothing,
    yt: {
      status: async () => ({ installed: false, web: true, error: DESK_ONLY }),
      install: deskOnly, update: deskOnly, search: deskOnly, info: deskOnly, stream: deskOnly, download: deskOnly, cancel: async () => false, folder: async () => false,
      onProgress: nothing
    },
    scape: {
      list: async () => (await all('scapes').catch(() => [])).filter(validDoc).sort((a, b) => (a.created || 0) - (b.created || 0)),
      get: async id => (await get('scapes', id).catch(() => null)) || null,
      save: async doc => { if (!validDoc(doc)) throw new Error('that isn\'t a soundscape'); await put('scapes', doc.id, JSON.parse(JSON.stringify(doc))); scapeSaved(doc); return doc.id; },
      patch: async (id, p) => {
        const d = await get('scapes', id).catch(() => null); if (!d) return null;
        for (const k of ['name', 'icon', 'named', 'iconSet']) if (p[k] !== undefined) d[k] = p[k];
        if (p.macro) { const n = d.nodes.find(m => m.id === p.macro.node); if (n) { n.p = n.p || {}; n.p.v = +p.macro.v; } }
        await put('scapes', id, d); scapeSaved(d); return d;
      },
      remove: async id => { await del('scapes', id); scapeSaved({ id, deleted: true }); return true; },
      import: async () => {
        const got = [];
        for (const f of await choose('.json,application/json', false)) {
          try {
            const d = JSON.parse((await f.text()).replace(/^﻿/, '')); if (!validDoc(d)) continue;
            // someone else's Script nodes run their own code: only when this person says so
            if (d.nodes.some(n => n.type === 'script') && !confirm(`"${d.name || f.name}" has Script nodes, which run their own code. Only bring it in if you trust where it came from. Bring it in?`)) continue;
            if (await get('scapes', d.id).catch(() => null)) d.id = 'sc' + uid();
            d.created = Date.now(); await put('scapes', d.id, d); scapeSaved(d); got.push(d);
          } catch {}
        }
        return got;
      },
      // the editor opens in a tab of its own; the two talk over a BroadcastChannel
      edit: async id => { window.open('scape.html?id=' + encodeURIComponent(id), 'scape-' + id); return true; },
      cmd: msg => { try { CH.cmd.postMessage(JSON.parse(JSON.stringify(msg))); } catch {} },
      state: st => { try { CH.state.postMessage(JSON.parse(JSON.stringify(st))); } catch {} },
      saveLoop: deskOnly,
      nodes: async () => [],
      folder: async () => false,
      onSaved: fn => listen(CH.saved, fn),
      onCmd: fn => listen(CH.cmd, fn),
      onState: fn => listen(CH.state, fn)
    },
    bot: {
      cfg: async () => ({}), login: deskOnly, join: deskOnly, leave: async () => false, logout: async () => false, set: async () => false,
      pcm() {}, note() {}, check: async () => ({}), onEvent: nothing
    },
    sysLang: async () => navigator.language || 'en',
    setLang: async () => true,
    reloadAll: async () => { location.reload(); },
    csDir: async () => ({ dir: '', web: true, fixed: true }),
    csDirPick: async () => null,
    dataFolder: async () => false,
    // a backup of the library (playlists, pads, scenes, settings) as a file; the sounds themselves stay in the browser
    libBackup: async () => {
      const lib = await get('kv', 'lib').catch(() => null); if (!lib) return null;
      const name = `Critter Sounds library ${new Date().toISOString().slice(0, 10)}.json`, a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([JSON.stringify(lib, null, 1)], { type: 'application/json' })); a.download = name;
      document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 8000);
      return name;
    },
    mediaKeys: async () => true,
    openExternal: async url => { if (/^https?:\/\//i.test(url)) window.open(url, '_blank', 'noopener'); return true; },
    showItem: async () => false,
    catalog: (name, fresh) => name === 'tabletop' ? cachedCatalog('tabletop', fresh, tabletopAudio) : name === 'incompetech' ? cachedCatalog('incompetech', fresh, incompetech) : Promise.reject(new Error('unknown catalogue')),
    webGet: getText,
    download: deskOnly,
    hostName: async () => 'Browser on ' + platform()
  };
})();
