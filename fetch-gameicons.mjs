// Fetches the sound pad icons from game-icons.net (github.com/game-icons/icons, CC BY 3.0) into src/gameicons.json.
// Run once with: node fetch-gameicons.mjs <list file>, where each line is "name=author/name.svg".
// The app only reads the JSON; it needs no internet for the icons.
import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const list = (await readFile(process.argv[2], 'utf8')).replace(/^﻿/, '').split(/\r?\n/).filter(Boolean).map(l => l.split('='));
const out = {};
await Promise.all(list.map(async ([name, file]) => {
  const r = await fetch('https://raw.githubusercontent.com/game-icons/icons/master/' + file);
  if (!r.ok) { console.warn('missing', name, r.status); return; }
  const svg = await r.text();
  // every path but the black square behind the icon
  const d = [...svg.matchAll(/<path[^>]*\sd="([^"]+)"/g)].map(m => m[1]).filter(x => !/^M0 0h512v512H0z$/.test(x.trim()));
  if (d.length) out[name] = { d: d.join(' '), by: file.split('/')[0] };
}));
const sorted = Object.fromEntries(Object.entries(out).sort(([a], [b]) => a.localeCompare(b)));
await writeFile(join(here, 'src', 'gameicons.json'), JSON.stringify(sorted));
console.log(Object.keys(sorted).length, 'icons,', (JSON.stringify(sorted).length / 1024).toFixed(0), 'KB; authors:', [...new Set(Object.values(sorted).map(x => x.by))].join(', '));
