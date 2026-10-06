/* Critter Sounds: languages. The interface is written in English; in German, every text the page shows is looked up
   in I18N_DE (exact text) or I18N_DE_P (patterns for texts with numbers or names in them) as it appears, so the rest of
   the code doesn't change. A watcher translates anything added later: menus, toasts, tours, windows.
   Language: Settings › Language, "System language" (the default) follows Windows: German if it's German, else English. */
'use strict';
(function (W) {
  let lang = 'en', obs = null;
  const D = () => W.I18N_DE || {}, PATS = () => W.I18N_DE_P || [];
  const GL = /^([^\p{L}\p{N}\s"'„(]{1,2})\s+([\s\S]+)$/u; // a symbol in front, like "▶ Play"
  // buttons show "▶ Play" as an icon and the word "Play" on its own: the words without their symbol, too
  let bare = null;
  const bareIdx = () => { if (bare) return bare; bare = {}; const d = D(); for (const [k, v] of Object.entries(d)) { const a = GL.exec(k), b = GL.exec(v); if (a && b && !(a[2] in d)) bare[a[2]] = b[2]; } return bare; };
  const has = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  function look(t, deep) {
    const d = D();
    if (has(d, t)) return d[t];
    if (has(bareIdx(), t)) return bare[t];
    const g = GL.exec(t); if (g && has(d, g[2])) return g[1] + ' ' + d[g[2]];
    for (const [re, rep] of PATS()) { if (rep == null) continue; if (re.test(t)) return t.replace(re, rep); }
    // a label with a count after it: "Weather 3", "Up next (2)"
    if (!deep) { const m = /^(.*?\S)(\s+\(?\d+\)?)$/.exec(t); if (m) { const r = look(m[1], true); if (r !== undefined) return r + m[2]; } }
    return undefined;
  }
  function tr(s) {
    if (lang !== 'de' || typeof s !== 'string' || !s) return s;
    const t = s.trim(); if (!t || !/\p{L}/u.test(t)) return s;
    const r = look(t);
    return r === undefined ? s : s.replace(t, r);
  }
  const ATTRS = ['title', 'placeholder', 'aria-label'];
  const skip = n => { const el = n.nodeType === 1 ? n : n.parentElement; return !el || el.closest('textarea,script,style,.notr,[contenteditable]'); };
  function doText(n) { if (skip(n)) return; const v = n.nodeValue, t = tr(v); if (t !== v) n.nodeValue = t; }
  function doEl(el) { for (const a of ATTRS) { const v = el.getAttribute(a); if (v) { const t = tr(v); if (t !== v) el.setAttribute(a, t); } } }
  function apply(root) {
    if (!root) return;
    if (root.nodeType === 3) { doText(root); return; }
    if (root.nodeType !== 1 || skip(root)) return;
    doEl(root);
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.nextNode(); n; n = w.nextNode()) { if (n.nodeType === 3) doText(n); else doEl(n); }
  }
  function start(l) {
    lang = l === 'de' ? 'de' : 'en';
    document.documentElement.lang = lang;
    if (lang !== 'de' || obs) return;
    apply(document.documentElement);
    document.title = tr(document.title);
    obs = new MutationObserver(ms => {
      for (const m of ms) {
        if (m.type === 'characterData') doText(m.target);
        else if (m.type === 'attributes') { if (!skip(m.target)) doEl(m.target); }
        else for (const n of m.addedNodes) apply(n);
      }
    });
    obs.observe(document.documentElement, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });
    const c = W.confirm.bind(W); W.confirm = q => c(tr(q));
  }
  // "auto" follows the system: German for any German locale, English for everything else
  const pick = (setting, sys) => (setting === 'de' || setting === 'en' ? setting : /^de\b/i.test(sys || navigator.language || '') ? 'de' : 'en');
  W.I18N = { start, tr, pick, get lang() { return lang; } };
  W.tr = tr;
})(window);
