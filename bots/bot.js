// Critter Sounds' voice bots: plays the table's mix into a Discord or Fluxer voice channel, for groups that meet there
// instead of in Critter. Runs in a process of its own (Electron's utilityProcess), so a stuck connection can't stall the player.
//
// It works the way Kenku FM does: the player mixes everything with Web Audio and taps the result as 48 kHz stereo 16-bit
// PCM; that comes here in small chunks and goes out as the bot's voice.
//   Discord: discord.js logs in, @discordjs/voice joins (with Discord's DAVE end-to-end encryption) and encodes the PCM
//            to Opus (opusscript, so nothing native to build).
//   Fluxer:  @fluxerjs/core logs in, @fluxerjs/voice joins the channel's LiveKit room, and the PCM is published there as
//            a stereo LiveKit audio track (@livekit/rtc-node).
//
// From the app: { op: 'login'|'join'|'leave'|'logout'|'notes', svc, ... }, { op: 'pcm', data }, { op: 'note', text }
// To the app:   { ev: 'state', svc, state, ... }, { ev: 'guilds', svc, guilds }, { ev: 'error', svc, msg }
'use strict';
const { PassThrough } = require('node:stream');
const port = process.parentPort;
const send = m => { try { port.postMessage(m); } catch {} };
const errMsg = e => String((e && e.message) || e || 'unknown problem').slice(0, 300);
const RATE = 48000, CH = 2, BYTES = 4; // per sample frame: 2 channels × 16 bits
const withTimeout = (p, ms, what) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(what + ' took too long')), ms))]);

/* ============================== Discord ============================== */
const D = { client: null, conn: null, player: null, pcm: null, ch: null, notes: false, state: 'off', invite: '' };
function dState(state, extra) { D.state = state; send({ ev: 'state', svc: 'discord', state, channel: D.ch ? D.ch.name : '', channelId: D.ch ? D.ch.id : '', guild: D.ch && D.ch.guild ? D.ch.guild.name : '', guildId: D.ch && D.ch.guild ? D.ch.guild.id : '', ...extra }); }
async function discordLogin(token) {
  await discordLogout();
  const { Client, GatewayIntentBits, Events } = require('discord.js');
  const c = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates] });
  D.client = c; dState('connecting');
  c.on('error', e => { if (D.state !== 'connecting') send({ ev: 'error', svc: 'discord', msg: errMsg(e) }); }); // while signing in, the sign-in itself reports it
  const ready = new Promise(res => c.once(Events.ClientReady, res));
  try { await c.login(token); await withTimeout(ready, 30000, 'Logging in'); }
  catch (e) { D.client = null; try { c.destroy(); } catch {} dState('off'); throw new Error(/token/i.test(errMsg(e)) ? 'That token wasn\'t accepted: copy it again from the Developer Portal (Bot › Reset Token).' : errMsg(e)); }
  D.invite = c.user ? `https://discord.com/oauth2/authorize?client_id=${c.user.id}&scope=bot&permissions=3148800` : '';
  sendGuilds('discord', true);
  dState('ready');
}
// the voice channels the bot can see, with who is in each and whether it may join and speak there
function discordGuilds() {
  const c = D.client; if (!c) return [];
  const { PermissionFlagsBits: P } = require('discord.js');
  const out = [];
  for (const g of c.guilds.cache.values()) {
    const me = g.members.me;
    const chans = [...g.channels.cache.values()].filter(ch => ch.isVoiceBased && ch.isVoiceBased() && (!me || ch.permissionsFor(me).has(P.ViewChannel))).sort((a, b) => a.rawPosition - b.rawPosition);
    out.push({ id: g.id, name: g.name, channels: chans.map(ch => ({ id: ch.id, name: ch.name, can: !!(ch.joinable && (ch.speakable !== false)), full: !!ch.full,
      people: [...ch.members.values()].filter(m => !me || m.id !== me.id).map(m => m.displayName || m.user.username).slice(0, 30) })) });
  }
  return out;
}
async function discordJoin(guildId, channelId) {
  if (!D.client) throw new Error('Connect the bot first.');
  discordLeave(true);
  const V = require('@discordjs/voice');
  const ch = await D.client.channels.fetch(channelId);
  if (!ch || !ch.isVoiceBased()) throw new Error('That isn\'t a voice channel.');
  if (!ch.joinable) throw new Error('The bot may not join that channel: give it Connect and Speak there.');
  D.ch = ch; dState('joining');
  const conn = V.joinVoiceChannel({ channelId: ch.id, guildId: ch.guild.id, adapterCreator: ch.guild.voiceAdapterCreator, selfDeaf: true });
  D.conn = conn;
  try { await V.entersState(conn, V.VoiceConnectionStatus.Ready, 30000); }
  catch (e) { discordLeave(); throw new Error('Could not join the voice channel: ' + errMsg(e)); }
  // the player never pauses for want of listeners; missing audio for up to a minute is just silence
  const player = V.createAudioPlayer({ behaviors: { noSubscriber: V.NoSubscriberBehavior.Play, maxMissedFrames: 3000 } });
  const pcm = new PassThrough({ highWaterMark: RATE * BYTES });
  player.play(V.createAudioResource(pcm, { inputType: V.StreamType.Raw }));
  player.on('error', e => send({ ev: 'error', svc: 'discord', msg: errMsg(e) }));
  conn.subscribe(player);
  D.player = player; D.pcm = pcm;
  // dropped (a network change, a region switch): it tries to get back for a few seconds before giving up
  conn.on(V.VoiceConnectionStatus.Disconnected, async () => {
    try { await Promise.race([V.entersState(conn, V.VoiceConnectionStatus.Signalling, 5000), V.entersState(conn, V.VoiceConnectionStatus.Connecting, 5000)]); }
    catch { if (D.conn === conn) { discordLeave(); send({ ev: 'error', svc: 'discord', msg: 'The voice connection was lost.' }); } }
  });
  conn.on('error', e => send({ ev: 'error', svc: 'discord', msg: errMsg(e) }));
  dState('live'); sendGuilds('discord', true);
}
function discordLeave(quiet) {
  if (D.pcm) { try { D.pcm.end(); } catch {} D.pcm = null; }
  if (D.player) { try { D.player.stop(true); } catch {} D.player = null; }
  if (D.conn) { try { D.conn.destroy(); } catch {} D.conn = null; }
  if (!quiet) { D.ch = null; dState(D.client ? 'ready' : 'off'); }
}
async function discordLogout() { discordLeave(true); D.ch = null; if (D.client) { try { await D.client.destroy(); } catch {} D.client = null; } dState('off'); }
function discordPcm(buf) {
  // a little ahead is fine; far ahead means the clocks drifted, so that chunk is skipped
  if (D.pcm && D.pcm.readableLength < RATE * BYTES * 0.4) D.pcm.write(buf);
}

/* ============================== Fluxer ============================== */
const FX = { client: null, vm: null, conn: null, room: null, source: null, track: null, ch: null, notes: false, state: 'off', rest: null, AudioFrame: null };
function fState(state, extra) { FX.state = state; send({ ev: 'state', svc: 'fluxer', state, channel: FX.ch ? FX.ch.name : '', channelId: FX.ch ? FX.ch.id : '', guild: FX.ch && FX.guildName ? FX.guildName : '', guildId: FX.ch ? FX.ch.guildId : '', ...extra }); }
async function fluxerLogin(token, origin) {
  await fluxerLogout();
  const { Client, Events } = require('@fluxerjs/core');
  const { getVoiceManager } = require('@fluxerjs/voice');
  fState('connecting');
  let c;
  try { c = origin ? await withTimeout(Client.fromDiscovery(origin, { waitForGuilds: true }), 20000, 'Finding that Fluxer instance') : new Client({ waitForGuilds: true }); }
  catch (e) { fState('off'); throw new Error('Could not reach that Fluxer instance: ' + errMsg(e)); }
  FX.client = c; FX.vm = getVoiceManager(c); // before logging in, so it sees who is in which channel
  c.on('error', e => { if (FX.state !== 'connecting') send({ ev: 'error', svc: 'fluxer', msg: errMsg(e) }); });
  const ready = new Promise(res => c.once(Events.Ready, res));
  try { await c.login(token); await withTimeout(ready, 40000, 'Logging in'); }
  catch (e) { FX.client = null; FX.vm = null; try { c.destroy(); } catch {} fState('off'); throw new Error(/token|401|unauthor/i.test(errMsg(e)) ? 'That token wasn\'t accepted: copy the bot token again from your Fluxer application.' : errMsg(e)); }
  sendGuilds('fluxer', true);
  fState('ready');
}
function fluxerGuilds() {
  const c = FX.client; if (!c) return [];
  const { VoiceChannel } = require('@fluxerjs/core');
  const all = [...c.channels.values()], meId = c.user && c.user.id;
  const who = (g, ch) => { try { return FX.vm.listParticipantsInChannel(g, ch).filter(id => id !== meId).map(id => { const u = c.users.get && c.users.get(id); return (u && (u.globalName || u.username)) || 'someone'; }).slice(0, 30); } catch { return []; } };
  return [...c.guilds.values()].map(g => ({ id: g.id, name: g.name, channels: all.filter(ch => ch instanceof VoiceChannel && ch.guildId === g.id).sort((a, b) => (a.position || 0) - (b.position || 0)).map(ch => ({ id: ch.id, name: ch.name || 'Voice', can: true, people: who(g.id, ch.id) })) }));
}
async function fluxerJoin(guildId, channelId) {
  if (!FX.client) throw new Error('Connect the bot first.');
  await fluxerLeave(true);
  const { AudioSource, AudioFrame, LocalAudioTrack, TrackPublishOptions, TrackSource } = require('@livekit/rtc-node');
  const ch = FX.client.channels.get(channelId) || await FX.client.channels.resolve(channelId);
  if (!ch) throw new Error('That channel isn\'t there any more.');
  FX.ch = ch; const g = FX.client.guilds.get(guildId); FX.guildName = g ? g.name : '';
  fState('joining');
  let conn;
  try { conn = await withTimeout(FX.vm.join(ch), 30000, 'Joining the voice channel'); }
  catch (e) { FX.ch = null; fState('ready'); throw new Error('Could not join the voice channel: ' + errMsg(e)); }
  FX.conn = conn;
  // @fluxerjs/voice connects the channel's LiveKit room; the mix is published there as a stereo track of its own
  const room = conn.room;
  if (!room || !room.localParticipant) { await fluxerLeave(); throw new Error('This Fluxer server\'s voice isn\'t the LiveKit kind Critter Sounds can stream to.'); }
  const source = new AudioSource(RATE, CH);
  const track = LocalAudioTrack.createAudioTrack('Critter Sounds', source);
  const opts = new TrackPublishOptions(); opts.source = TrackSource.SOURCE_MICROPHONE; opts.dtx = false;
  await room.localParticipant.publishTrack(track, opts);
  Object.assign(FX, { room, source, track, AudioFrame, rest: null });
  // the server can send the bot away (a token runs out): join again, as the voice guide suggests
  if (conn.on) conn.on('serverLeave', () => { if (FX.conn === conn) { const id = ch.id; fluxerJoin(guildId, id).catch(e => send({ ev: 'error', svc: 'fluxer', msg: errMsg(e) })); } });
  if (conn.on) conn.on('error', e => send({ ev: 'error', svc: 'fluxer', msg: errMsg(e) }));
  fState('live'); sendGuilds('fluxer', true);
}
async function fluxerLeave(quiet) {
  const { track, room, source, conn, ch } = FX;
  Object.assign(FX, { track: null, room: null, source: null, conn: null, rest: null });
  if (track && room) { try { await room.localParticipant.unpublishTrack(track.sid); } catch {} }
  if (source) { try { await source.close(); } catch {} }
  if (conn && FX.vm) { try { FX.vm.leave(ch && ch.guildId); } catch {} try { conn.disconnect && conn.disconnect(); } catch {} }
  if (!quiet) { FX.ch = null; fState(FX.client ? 'ready' : 'off'); }
}
async function fluxerLogout() { await fluxerLeave(true); FX.ch = null; if (FX.client) { try { await FX.client.destroy(); } catch {} FX.client = null; FX.vm = null; } fState('off'); }
const F10 = RATE / 100; // LiveKit takes 10 ms frames
function fluxerPcm(buf) {
  if (!FX.source) return;
  // whole 10 ms frames; what's left over waits for the next chunk
  const b = FX.rest ? Buffer.concat([FX.rest, buf]) : buf, step = F10 * BYTES;
  let o = 0;
  if (FX.source.queuedDuration > 400) { FX.rest = null; return; } // drifted ahead: skip, so the delay stays short
  for (; o + step <= b.length; o += step) {
    const s = new Int16Array(b.buffer.slice(b.byteOffset + o, b.byteOffset + o + step));
    FX.source.captureFrame(new FX.AudioFrame(s, RATE, CH, F10)).catch(() => {});
  }
  FX.rest = o < b.length ? Buffer.from(b.subarray(o)) : null;
}

/* ============================== the channel lists, kept up to date ============================== */
// read from each library's own cache every few seconds (nothing goes over the network), and sent only when they change
const lastGuilds = { discord: '', fluxer: '' };
function sendGuilds(svc, force) {
  let guilds; try { guilds = svc === 'discord' ? discordGuilds() : fluxerGuilds(); } catch (e) { return; }
  const sig = JSON.stringify(guilds); if (!force && sig === lastGuilds[svc]) return; lastGuilds[svc] = sig;
  const c = svc === 'discord' ? D.client : FX.client;
  send({ ev: 'guilds', svc, user: c && c.user ? c.user.username : '', guilds, invite: svc === 'discord' ? D.invite : '' });
}
setInterval(() => { if (D.client && D.state !== 'connecting') sendGuilds('discord'); if (FX.client && FX.state !== 'connecting') sendGuilds('fluxer'); }, 3000);

/* ============================== notes in the voice channel's chat ============================== */
async function note(text) {
  text = String(text || '').slice(0, 300); if (!text) return;
  if (D.notes && D.ch && D.state === 'live') D.ch.send({ content: text, allowedMentions: { parse: [] } }).catch(e => send({ ev: 'error', svc: 'discord', msg: 'Could not post in the channel\'s chat: ' + errMsg(e) }));
  if (FX.notes && FX.ch && FX.state === 'live' && FX.ch.send) FX.ch.send({ content: text }).catch(e => send({ ev: 'error', svc: 'fluxer', msg: 'Could not post in the channel\'s chat: ' + errMsg(e) }));
}

/* ============================== a check that everything it needs loads (Help › voice bots, and tests) ============================== */
function check() {
  const out = {};
  const t = (k, fn) => { try { out[k] = fn() || 'ok'; } catch (e) { out[k] = 'FAILED: ' + errMsg(e); } };
  t('discord.js', () => require('discord.js').version);
  t('voice', () => require('@discordjs/voice').generateDependencyReport().replace(/-{3,}/g, '').replace(/\n+/g, ' | ').trim());
  t('opus', () => { const prism = require('prism-media'); const enc = new prism.opus.Encoder({ rate: RATE, channels: CH, frameSize: 960 }); let got = 0; enc.on('data', d => { got = d.length; }); enc.write(Buffer.alloc(960 * BYTES)); return 'encoder ready'; });
  t('aes-256-gcm', () => (require('node:crypto').getCiphers().includes('aes-256-gcm') ? 'yes' : 'no'));
  t('fluxer', () => typeof require('@fluxerjs/core').Client + ' / ' + typeof require('@fluxerjs/voice').getVoiceManager);
  t('livekit', () => { const L = require('@livekit/rtc-node'); const s = new L.AudioSource(RATE, CH); s.captureFrame(new L.AudioFrame(new Int16Array(F10 * CH), RATE, CH, F10)).catch(() => {}); return 'AudioSource ok'; });
  return out;
}

/* ============================== messages from the app ============================== */
let queue = Promise.resolve();
port.on('message', ({ data: m }) => {
  if (!m) return;
  if (m.op === 'pcm') { const b = Buffer.from(m.data.buffer, m.data.byteOffset, m.data.byteLength); discordPcm(b); fluxerPcm(b); return; }
  if (m.op === 'note') { note(m.text); return; }
  if (m.op === 'notes') { (m.svc === 'discord' ? D : FX).notes = !!m.on; return; }
  if (m.op === 'check') { send({ ev: 'check', report: check() }); return; }
  // everything else in order, one at a time
  queue = queue.then(async () => {
    const dc = m.svc === 'discord';
    try {
      if (m.op === 'login') await (dc ? discordLogin(m.token) : fluxerLogin(m.token, m.origin));
      else if (m.op === 'join') await (dc ? discordJoin(m.guild, m.channel) : fluxerJoin(m.guild, m.channel));
      else if (m.op === 'leave') await (dc ? discordLeave() : fluxerLeave());
      else if (m.op === 'logout') await (dc ? discordLogout() : fluxerLogout());
    } catch (e) { send({ ev: 'error', svc: m.svc, msg: errMsg(e) }); }
  });
});
process.on('uncaughtException', e => send({ ev: 'error', svc: '', msg: errMsg(e) }));
process.on('unhandledRejection', e => send({ ev: 'error', svc: '', msg: errMsg(e) }));
send({ ev: 'hello' });
