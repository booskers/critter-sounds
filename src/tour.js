/* Critter Sounds: guided tours, for the player and the soundscape editor.
   A tour is a list of steps; each can point at part of the screen (a spotlight with a speech bubble beside it),
   set things up first, and wait for the person to do something (with "Do it for me" as a way out).
     { el: '#playBtn' | () => element, title, text, before(), wait: () => bool, doIt(), actions: [{ label, fn, primary }], wide }
   Tour.run(steps, { onEnd(finished) }). Esc or Skip ends it at any point. */
'use strict';
(function (W) {
  let cur = null;
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  function run(steps, opts = {}) {
    end(false);
    const T = { steps: steps.filter(Boolean), i: 0, opts, timer: 0, waitT: 0, spot: mk('div', 'tour-spot'), bub: mk('div', 'tour-bub'), done: false };
    T.spot.hidden = true;
    document.body.append(T.spot, T.bub);
    cur = T;
    T.key = e => { if (e.key === 'Escape') { e.stopPropagation(); end(false); } };
    addEventListener('keydown', T.key, true);
    T.resize = () => place(T);
    addEventListener('resize', T.resize);
    show(T, 0);
    return T;
  }
  // a target is an element, or anything with getBoundingClientRect (Tour.around() makes one around several elements)
  const target = s => { try { const e = typeof s.el === 'function' ? s.el() : s.el ? document.querySelector(s.el) : null; if (!e) return null; const r = e.getBoundingClientRect(); return r.width || r.height ? e : null; } catch { return null; } };
  const around = (...els) => { els = els.filter(Boolean); if (!els.length) return null; const rs = els.map(e => e.getBoundingClientRect()); const l = Math.min(...rs.map(r => r.left)), t = Math.min(...rs.map(r => r.top)), r2 = Math.max(...rs.map(r => r.right)), b = Math.max(...rs.map(r => r.bottom)); return { getBoundingClientRect: () => ({ left: l, top: t, right: r2, bottom: b, width: r2 - l, height: b - t }) }; };
  async function show(T, i) {
    clearInterval(T.timer); clearTimeout(T.waitT);
    if (i < 0) i = 0;
    if (i >= T.steps.length) { end(true); return; }
    T.i = i; const s = T.steps[i];
    if (s.before) { try { await s.before(); } catch (e) { console.warn('tour', e); } }
    if (cur !== T) return;
    await new Promise(r => setTimeout(r, 40)); // let the layout settle (a timer: frames pause in a window that isn't in front)
    const b = T.bub; b.replaceChildren(); b.className = 'tour-bub' + (s.wide ? ' wide' : '');
    const head = mk('div', 'tour-h');
    head.append(mk('span', 'tour-n', `${i + 1} of ${T.steps.length}`), mk('span', 'tour-sp'));
    const x = mk('button', 'tour-x', '✕'); x.type = 'button'; x.title = 'End the tour (Esc)'; x.onclick = () => end(false); head.append(x);
    b.append(head);
    if (s.title) b.append(mk('b', 'tour-t', s.title));
    for (const para of [].concat(s.text || [])) b.append(mk('p', 'tour-p', para));
    if (s.list) { const ul = mk('ul', 'tour-l'); for (const li of s.list) ul.append(mk('li', '', li)); b.append(ul); }
    const waitNote = s.wait ? mk('p', 'tour-w', s.waitText || 'Your turn: try it.') : null;
    if (waitNote) b.append(waitNote);
    const row = mk('div', 'tour-btns');
    const btn = (label, cls, fn) => { const e = mk('button', 'btn ' + cls, label); e.type = 'button'; e.onclick = fn; return e; };
    if (i > 0 && !s.noBack) row.append(btn('Back', 'ghost', () => show(T, i - 1)));
    row.append(mk('span', 'tour-sp'));
    if (s.actions) for (const a of s.actions) row.append(btn(a.label, a.primary ? 'primary' : '', async () => { if (a.fn) await a.fn(); if (a.next !== false) show(T, i + 1); }));
    let next = null;
    if (!s.actions || s.next) {
      if (s.doIt) row.append(btn('Do it for me', '', async () => { try { await s.doIt(); } catch (e) { console.warn('tour', e); } }));
      next = btn(i === T.steps.length - 1 ? (s.doneLabel || 'Done') : (s.nextLabel || 'Next'), 'primary', () => show(T, i + 1));
      row.append(next);
    }
    b.append(row);
    // waiting for the person: Next lights up (and moves on by itself) once it's done
    if (s.wait && next) {
      const ok = () => { try { return !!s.wait(); } catch { return false; } };
      const check = () => {
        if (cur !== T || T.i !== i) return;
        if (ok()) { next.disabled = false; waitNote.textContent = s.doneText || 'That\'s it!'; waitNote.classList.add('ok'); T.waitT = setTimeout(() => { if (cur === T && T.i === i) show(T, i + 1); }, s.pause ?? 900); }
        else { next.disabled = !s.canSkip; T.waitT = setTimeout(check, 250); }
      };
      check();
    }
    place(T);
    T.timer = setInterval(() => place(T), 200); // the screen changes as people work: follow the target
  }
  function place(T) {
    if (cur !== T) return;
    const s = T.steps[T.i], el = target(s), b = T.bub, pad = s.pad ?? 6;
    const vw = innerWidth, vh = innerHeight, bw = b.offsetWidth, bh = b.offsetHeight;
    if (!el) { T.spot.hidden = true; b.classList.add('center'); b.style.left = Math.round((vw - bw) / 2) + 'px'; b.style.top = Math.round((vh - bh) / 2) + 'px'; document.body.classList.add('touring-dim'); return; }
    document.body.classList.remove('touring-dim'); b.classList.remove('center');
    const r = el.getBoundingClientRect(), sp = T.spot;
    sp.hidden = false;
    Object.assign(sp.style, { left: r.left - pad + 'px', top: r.top - pad + 'px', width: r.width + pad * 2 + 'px', height: r.height + pad * 2 + 'px' });
    // the bubble goes where there's room: below, above, right, left, or over the middle of a big target
    const gap = 14, cands = [
      [r.left + r.width / 2 - bw / 2, r.bottom + pad + gap, vh - r.bottom - pad - gap >= bh],
      [r.left + r.width / 2 - bw / 2, r.top - pad - gap - bh, r.top - pad - gap >= bh],
      [r.right + pad + gap, r.top + r.height / 2 - bh / 2, vw - r.right - pad - gap >= bw],
      [r.left - pad - gap - bw, r.top + r.height / 2 - bh / 2, r.left - pad - gap >= bw]
    ];
    const c = s.side === 'left' ? cands[3] : s.side === 'right' ? cands[2] : s.side === 'top' ? cands[1] : cands.find(x => x[2]) || [r.left + r.width / 2 - bw / 2, r.top + Math.min(r.height - bh, 40), true];
    b.style.left = Math.round(Math.min(vw - bw - 10, Math.max(10, c[0]))) + 'px';
    b.style.top = Math.round(Math.min(vh - bh - 10, Math.max(10, c[1]))) + 'px';
  }
  function end(finished) {
    const T = cur; if (!T) return;
    cur = null; clearInterval(T.timer); clearTimeout(T.waitT);
    removeEventListener('keydown', T.key, true); removeEventListener('resize', T.resize);
    T.spot.remove(); T.bub.remove(); document.body.classList.remove('touring-dim');
    if (T.opts.onEnd) try { T.opts.onEnd(finished); } catch (e) { console.warn(e); }
  }
  W.Tour = { run, end, around, active: () => !!cur, next: () => cur && show(cur, cur.i + 1) };
})(window);
