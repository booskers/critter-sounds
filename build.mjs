// Puts Critter Sounds's page into ./www: the player, Homebase (the same client the Critter app uses)
// and the music effects, copied out of critboard.html so both always sound the same.
// Three things come from Critter. They're kept in ./shared, so this project also builds on its own:
//   shared/musicfx.js            the MUSICFX block of critboard/critboard.html (the effects: change them there)
//   shared/homebase-client.js    critboard-desktop/app/shim/homebase-client.js
//   shared/homebase.config.json  critboard-desktop/app/homebase.config.json, the built-in Homebase address
// When Critter's sources sit next to this folder (../app, ../../critboard), each build refreshes ./shared from them.
//   HOMEBASE_SERVER=<url>          use another built-in Homebase for this build (for testing)
import { readFile, writeFile, mkdir, rm, readdir, copyFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'www'), shared = join(here, 'shared');
await mkdir(out, { recursive: true }); await mkdir(shared, { recursive: true });
for (const f of await readdir(out)) await rm(join(out, f), { recursive: true, force: true });

const critterPage = join(here, '..', '..', 'critboard', 'critboard.html'), critterApp = join(here, '..', 'app');
let from = 'shared/';
if (existsSync(critterPage) && existsSync(join(critterApp, 'shim', 'homebase-client.js'))) {
  const page = await readFile(critterPage, 'utf8');
  const fx = /\/\* MUSICFX START \*\/([\s\S]*?)\/\* MUSICFX END \*\//.exec(page);
  if (!fx) throw new Error('critboard.html has no MUSICFX block; the effects live there');
  await writeFile(join(shared, 'musicfx.js'), '// copied from critboard/critboard.html (the MUSICFX block) by build.mjs: change it there\n' + fx[1]);
  await copyFile(join(critterApp, 'shim', 'homebase-client.js'), join(shared, 'homebase-client.js'));
  if (existsSync(join(critterApp, 'homebase.config.json'))) await copyFile(join(critterApp, 'homebase.config.json'), join(shared, 'homebase.config.json'));
  from = 'Critter\'s sources (refreshed shared/)';
}
for (const f of ['musicfx.js', 'homebase-client.js']) if (!existsSync(join(shared, f))) throw new Error(`shared/${f} is missing: build once next to Critter's sources, or copy it in`);

const cfgFile = join(shared, 'homebase.config.json');
const cfg = existsSync(cfgFile) ? JSON.parse(await readFile(cfgFile, 'utf8')) : {};
if (process.env.HOMEBASE_SERVER !== undefined) cfg.server = process.env.HOMEBASE_SERVER;
if (!cfg.server) delete cfg.server;
delete cfg.firebase;
await build({ entryPoints: [join(shared, 'homebase-client.js')], bundle: true, format: 'iife', minify: true, target: 'chrome120', outfile: join(out, 'homebase.js'), logLevel: 'warning' });
const fxCode = await readFile(join(shared, 'musicfx.js'), 'utf8');
await copyFile(join(shared, 'musicfx.js'), join(out, 'musicfx.js'));

// the player, and the soundscape editor that opens in a window of its own
for (const f of ['style.css', 'app.js', 'fxpresets.js', 'scape.js', 'scape.html', 'scape-editor.js', 'scape.css', 'pcmtap.js', 'tour.js', 'i18n.js', 'i18n-de.js', 'i18n-de2.js', 'notes-bridge.js', 'fonts.js',
  'atkinson-latin.woff2', 'atkinson-latin-ext.woff2', 'atkinson-italic-latin.woff2', 'atkinson-italic-latin-ext.woff2', 'OFL-Atkinson-Hyperlegible-Next.txt']) await copyFile(join(here, 'src', f), join(out, f));
// the Critter Sounds logo (src/logo.svg) in the header, and its emblem (src/icon.svg, made by make-icons.cjs) in the title bar
const logo = (await readFile(join(here, 'src', 'logo.svg'), 'utf8')).replace(/^[\s\S]*?(<svg)/, '$1').replace(/<svg[^>]*?viewBox="([^"]+)"[^>]*>/, (m, vb) => `<svg class="logo-svg" viewBox="${vb}" role="img" aria-label="Critter Sounds">`);
await copyFile(join(here, 'src', 'icon.svg'), join(out, 'icon.svg'));
// the sound pad icons from game-icons.net (CC BY 3.0), fetched once by fetch-gameicons.mjs
await copyFile(join(here, 'src', 'gameicons.json'), join(out, 'gameicons.json'));
await writeFile(join(out, 'index.html'), (await readFile(join(here, 'src', 'index.html'), 'utf8')).replace('<!--LOGO-->', () => logo));
// the version shows under the big logos; it comes from package.json
const version = JSON.parse(await readFile(join(here, 'package.json'), 'utf8')).version;
await writeFile(join(out, 'config.js'), `window.HOMEBASE_CONFIG = ${JSON.stringify(cfg)};\nwindow.APP_VERSION = ${JSON.stringify(version)};\n`);
console.log(`www ready: Homebase ${cfg.server ? 'at ' + cfg.server : 'not configured (the app will ask)'}, effects ${(fxCode.length / 1024).toFixed(0)} KB, shared code from ${from}`);
