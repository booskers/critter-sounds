/* window.desk is how the page asks the app for things. In the desktop app, preload.js hands it over as deskNative,
   which can't be changed; this makes a plain copy, so remote control (lan.js) can answer some calls from another
   Critter Sounds. In a browser, desk-web.js has made window.desk already. */
'use strict';
if (!window.desk && window.deskNative) {
  const copy = o => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v && typeof v === 'object' ? copy(v) : v]));
  window.desk = copy(window.deskNative);
}
