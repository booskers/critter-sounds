<p align="center">
  <img src="docs/img/sounds-logo.svg" alt="Critter Sounds" height="72">
</p>

<p align="center"><b>Music, sound effects and ambience for your tabletop game, played live to the table.</b></p>

<p align="center">
  <a href="https://github.com/booskers/critter-sounds/releases/latest">Download for Windows</a> ·
  <a href="https://booskers.github.io/critter-sounds/">Website</a> ·
  <a href="https://booskers.github.io/critter/">Critter</a>
</p>

![Critter Sounds](docs/img/sounds-game.png)

Critter Sounds is a Windows app for whoever runs the music at a [Critter](https://booskers.github.io/critter/) table. It plays from your computer and streams to every player over WebRTC, so there's nothing to upload and no limit on tracks. It can also play into a Discord or Fluxer voice channel.

- **Playlists** from your folders, a queue, fades and crossfades.
- **Sound pads** with automatic icons and tags; keys 1 to 9 play them.
- **Soundscapes:** a node editor for living backgrounds, rendered to seamless loops.
- **Effects** such as Tavern next door, Underwater and Cave, applied on each player's side.
- **Online library:** Tabletop Audio, Incompetech, Openverse and Freesound, each credited.
- **Discord and Fluxer bots** that play the same mix in a voice channel.

## Getting started

1. Download and run **Critter Sounds Setup** from [Releases](https://github.com/booskers/critter-sounds/releases/latest).
2. In Critter, the lobby owner opens **Music** in the bottom bar and copies the table's music code.
3. Paste it into Critter Sounds and press **Connect**.

The installer isn't code-signed yet, so Windows SmartScreen may warn the first time: choose **More info › Run anyway**.

## Building it yourself

You need [Node.js](https://nodejs.org) 20 or newer, on Windows.

```bash
npm install
npm start
```

`npm run dist` builds the installer into `dist/`.

| Folder | What it is |
|---|---|
| `main.js`, `preload.js` | The Electron app: windows, files, YouTube (yt-dlp), the online library and the bots. |
| `src/` | The player page, the soundscape engine (`scape.js`) and its editor. |
| `bots/` | The Discord and Fluxer voice bots, run in a utility process. |
| `nodes-guide/` | The guide and an example for writing your own soundscape nodes. |
| `shared/` | Code that comes from [Critter](https://github.com/booskers/critter): the music effects and the Homebase client. |
| `docs/` | This project's website (GitHub Pages). |

**Shared with Critter:** the music effects (`shared/musicfx.js`) are the `MUSICFX` block of Critter's `crittervtt.html`, so the table and the app always sound the same. When this folder sits inside a Critter checkout (`crittervtt-desktop/music`), every build refreshes `shared/` from Critter's sources. On its own, it builds from the copies in `shared/`.

**Homebase:** the app connects to the Homebase in `shared/homebase.config.json`. Set `HOMEBASE_SERVER=<url>` for a build that uses another one.

### In a browser: sounds.crittervtt.com

`node build.mjs --web` builds the same app into `web/` for browsers, with `src/desk-web.js` standing in for the desktop app's main process. Sounds you add stay in that browser's storage on that device; nothing is uploaded. Saving sounds from the web, YouTube, voice-chat bots, web page sound and rendering loops say **Available on Desktop**. `web-worker/` serves it on Cloudflare (`cd web-worker && npx wrangler deploy`), and passes online sounds and catalogues through `/proxy`, as the desktop app's `app://music/remote` does.

On a phone (720px wide or less) it becomes one screen at a time with a tab bar, a mini player and a Now playing sheet (`src/mobile.js`). On a touch tablet it gets a sidebar, playlists beside their tracks, and the desktop's player bar. Both get iOS-style gestures:
- **Sheets:** swipe the player sheet down to close it.
- **Going back:** swipe from the left edge.
- **Skipping:** swipe the mini player left or right.
- **Rows:** swipe a track right for Play next, or left to add it to the queue.
- **Menus:** press and hold for a menu.

Every gesture also has a button. Settings › Screen layout picks the layout by hand.

### Nearby: one Critter Sounds controls another

Critter Sounds finds the others on the same network through Homebase's `lan` room (same public address, or a pairing code), and lists them under **Nearby**. Any of them can ask to control a desktop app; the desktop shows who's asking and a 4-digit code that must match, and nothing happens until someone there presses **Allow**. They then connect directly with WebRTC and no STUN or TURN server, keeping only local-network addresses, so everything after the handshake stays on the network (`src/lan.js`). The controlling side shows the desktop's library and plays, queues and downloads there; downloads are saved on the desktop only.

The technical notes (streaming, effects, soundscapes, bots) are in Critter's [README](https://github.com/booskers/crittervtt/blob/main/crittervtt-desktop/README.md#critter-sounds-the-desktop-music-player).

## Updates

The app updates itself from this repository's releases (`updater.js`, electron-updater): it looks when it starts (Settings › Updates turns that off), and Help, Settings and the Critter Sounds menu have **Check for updates**. The pop-up lists up to five changes and offers Update now, Later or Skip this version. What changed in each version: [CHANGELOG.md](CHANGELOG.md).

Installing uses **Critter Setup** (`installer/`, the same in Critter VTT, Critter Sounds and Critter Notes): one small C# program, compiled when building with the C# compiler every Windows has, and the app's files packed behind it by `installer/pack.mjs` (name, colour, logo and files come from `package.json` › `critterSetup`, so the engine itself doesn't change from release to release). Its window follows the Critter look in dark or light, Windows' high-contrast colours, text size and animation settings, and reads out properly in screen readers. It installs for the user without administrator rights (`/S` silent, `/D=<folder>`, `--no-desktop`) and puts an uninstaller in the app's folder. Updates happen inside Critter Sounds: the pop-up downloads the new setup file (only the parts that changed, usually a megabyte or two), unpacks it beside the app with its own progress bar, and Critter Sounds restarts and says **Update successful**. Afterwards the download and everything else the update used are deleted; only the updater's `installer.exe` stays (a copy of the installed version, so the next update downloads just what changed). Installs made by the old NSIS installer switch over on their first update (a small progress window, then the app opens again). A release needs `Critter-Sounds-Setup.exe`, its `.blockmap` and `latest.yml` from `dist/` (`npm run dist` makes all three). Testing: `UPDATE_TEST_FEED=<url of a folder with latest.yml>`, `UPDATE_TEST_VERSION=<x.y.z>`; `SETUP_TEST=1 node installer/pack.mjs` packs a " Test" edition with its own folder and Apps entry.

## License

[MIT](LICENSE), made with love by booskers / Polychrome: use, change and share it freely, as long as you keep the copyright notice and give credit. Pad icons come from [game-icons.net](https://game-icons.net) (CC BY 3.0), and library tracks keep their own licenses.
