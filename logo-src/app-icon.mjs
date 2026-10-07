// Makes Critter Sounds' icons for phones, tablets and browsers from its mark (src/icon.svg): the purple mark on the
// dark tone, as Critter VTT's are (crittervtt-desktop/app/logo-src/app-icon.py). A transparent icon shows up on white
// on an iPhone's home screen, so these are always on dark.
//   src/app-icon.svg        the square icon (iOS and Android cut the corners themselves)
//   src/favicon.svg         the browser tab's icon: a dark rounded square
//   src/app-icon.png        1024 px, for the web app's manifest and Android
//   src/apple-touch-icon.png  180 px, what iPhones and iPads put on the home screen (iOS takes no SVG here)
//   android/res/...         the adaptive launcher icon's foreground (a vector) and the older PNG sizes
// Run:  node logo-src/app-icon.mjs   (the PNGs are drawn by Microsoft Edge, headless)
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const TONE = '#0b0a12', PURPLE = '#8800ff';
const src = fs.readFileSync(path.join(ROOT, 'src', 'icon.svg'), 'utf8');
const [vx, vy, vw] = src.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
const [ps, , , , ptx, pty] = src.match(/transform="matrix\(([^)]+)\)"/)[1].split(',').map(Number);
const D = src.match(/ d="([^"]+)"/)[1];
if (!/^[MLCZ0-9.,\s-]+$/.test(D)) throw new Error('the mark should use absolute M/L/C/Z only');
// the mark's path, `size` wide, in the middle of a `canvas`-wide square, in the square's own units
const mark = (canvas, size) => {
  const s = size / vw, ox = (canvas - size) / 2 - vx * s, oy = (canvas - size) / 2 - vy * s;
  return D.replace(/-?\d*\.?\d+,-?\d*\.?\d+/g, p => { const [x, y] = p.split(',').map(Number); return `${(ox + (ptx + x * ps) * s).toFixed(3)},${(oy + (pty + y * ps) * s).toFixed(3)}`; });
};
const square = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"><rect width="1024" height="1024" fill="${TONE}"/><path d="${mark(1024, 1024 * 0.72)}" fill="${PURPLE}" fill-rule="evenodd"/></svg>\n`;
const fav = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${TONE}"/><path d="${mark(64, 64 * 0.8)}" fill="${PURPLE}" fill-rule="evenodd"/></svg>\n`;
fs.writeFileSync(path.join(ROOT, 'src', 'app-icon.svg'), square);
fs.writeFileSync(path.join(ROOT, 'src', 'favicon.svg'), fav);

// Android: a 108dp layer, of which launchers show the middle 72dp and may cut it to a circle (66dp across): the mark is 56dp
const res = path.join(ROOT, 'android', 'res');
fs.mkdirSync(path.join(res, 'drawable'), { recursive: true });
fs.writeFileSync(path.join(res, 'drawable', 'ic_launcher_foreground.xml'), `<?xml version="1.0" encoding="utf-8"?>
<!-- made by logo-src/app-icon.mjs from src/icon.svg; change the mark and run it again rather than this file -->
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">
    <path android:fillColor="#FF8800FF" android:fillType="evenOdd" android:pathData="${mark(108, 56)}" />
</vector>
`);

// the PNGs, drawn by headless Edge at 1024 px
const edge = ['C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe'].find(p => fs.existsSync(p));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cs-icon-'));
const draw = (svg, size, out) => {
  const page = path.join(tmp, 'icon.html'), shot = path.join(tmp, 'shot.png');
  fs.writeFileSync(page, `<!doctype html><style>html,body{margin:0;background:${TONE}}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  execFileSync(edge, ['--headless', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1', `--window-size=${size},${size}`, `--user-data-dir=${path.join(tmp, 'p')}`, `--screenshot=${shot}`, 'file:///' + page.replace(/\\/g, '/')], { stdio: 'ignore' });
  fs.copyFileSync(shot, out);
};
draw(square, 1024, path.join(ROOT, 'src', 'app-icon.png'));
draw(square, 180, path.join(ROOT, 'src', 'apple-touch-icon.png'));
for (const [dir, px] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
  fs.mkdirSync(path.join(res, 'mipmap-' + dir), { recursive: true });
  draw(square, px, path.join(res, 'mipmap-' + dir, 'ic_launcher.png'));
}
fs.rmSync(tmp, { recursive: true, force: true });
console.log('icons: src/app-icon.svg, src/favicon.svg, src/app-icon.png, src/apple-touch-icon.png, android launcher icon');
