// copied from critboard/critboard.html (the MUSICFX block) by build.mjs: change it there

const MFX_SPACES = [['hall', 'Great hall'], ['cathedral', 'Cathedral'], ['cave', 'Cave'], ['room', 'Wooden room'], ['plate', 'Plate'], ['spring', 'Spring tank'], ['custom', 'Your own impulse file']];
const MFX_LIST = [['reverb', 'Reverb'], ['space', 'Convolution space'], ['echo', 'Echo'], ['radio', 'Old radio'], ['crackle', 'Vinyl crackle'], ['warble', 'Tape warble'], ['muffle', 'Muffled'], ['lofi', 'Lo-fi'], ['trem', 'Tremolo'], ['comp', 'Even out loudness'], ['drive', 'Overdrive'], ['chorus', 'Chorus'], ['flanger', 'Flanger'], ['autopan', 'Auto-pan'], ['width', 'Stereo width']];
const MFX_RTC = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] };
function mfxDefaults() {
  return { reverb: { on: false, mix: 0.3, size: 0.5, damp: 0.4 }, space: { on: false, mix: 0.4, ir: 'hall' }, echo: { on: false, time: 0.35, fb: 0.35, mix: 0.25 }, radio: { on: false, amt: 0.6 }, crackle: { on: false, amt: 0.5 }, warble: { on: false, amt: 0.4 }, muffle: { on: false, amt: 0.6 }, lofi: { on: false, amt: 0.5 }, trem: { on: false, rate: 5, depth: 0.5 }, comp: { on: false, amt: 0.5 }, drive: { on: false, amt: 0.4 }, chorus: { on: false, mix: 0.5, depth: 0.5 }, flanger: { on: false, speed: 0.25, fb: 0.5, mix: 0.5 }, autopan: { on: false, speed: 0.3, depth: 0.7 }, width: { on: false, w: 1.5 }, eq: { bass: 0, treble: 0 } };
}
function mfxClean(o) {
  const d = mfxDefaults(), RANGE = { mix: [0, 1], size: [0, 1], damp: [0, 1], time: [0.05, 1.5], fb: [0, 0.9], amt: [0, 1], rate: [0.5, 12], depth: [0, 1], bass: [-12, 12], treble: [-12, 12], speed: [0.05, 4], w: [0, 2] };
  if (!o || typeof o !== 'object') return d;
  for (const [k, def] of Object.entries(d)) {
    const src = o[k] && typeof o[k] === 'object' ? o[k] : {};
    for (const [p, v] of Object.entries(def)) {
      if (p === 'on') def.on = !!src.on;
      else if (p === 'ir') def.ir = MFX_SPACES.some(s => s[0] === src.ir) ? src.ir : v;
      else { const x = Number(src[p]); def[p] = Number.isFinite(x) ? Math.min(RANGE[p][1], Math.max(RANGE[p][0], x)) : v; }
    }
  }
  return d;
}
// impulse responses made on the spot: early reflections, then a stereo noise tail that darkens as it dies away
function mfxImpulse(ac, kind, size = 0.5, damp = 0.4) {
  const P = { hall: [0.02, 2.8, 0.45, 8, 0.07], cathedral: [0.045, 6.5, 0.3, 6, 0.12], cave: [0.015, 3.6, 0.75, 3, 0.05], room: [0.003, 0.75, 0.6, 16, 0.025], plate: [0, 2.2, 0.12, 0, 0], spring: [0, 2.1, 0.35, 0, 0] }[kind];
  const [pre, len, dmp, taps, spread] = P || [0.01, 0.4 + size * 5.6, damp, 5, 0.04];
  const sr = ac.sampleRate, p0 = Math.floor(pre * sr), n = p0 + Math.floor(len * sr), buf = ac.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch); let lp = 0;
    for (let i = p0; i < n; i++) {
      const t = (i - p0) / sr, a = Math.max(0.03, 1 - dmp * (0.25 + 0.7 * t / len));
      lp += a * ((Math.random() * 2 - 1) - lp);
      d[i] = lp * Math.exp(-6.9 * t / len) * (kind === 'spring' ? 0.35 : 1);
    }
    for (let k = 0; k < taps; k++) { const i = p0 + Math.floor(Math.random() * spread * sr); if (i < n) d[i] += (Math.random() < 0.5 ? -1 : 1) * (0.4 + Math.random() * 0.5) * (1 - k / (taps + 1)); }
    if (kind === 'cave') for (let k = 1; k <= 6; k++) { const s = p0 + Math.floor((0.11 * k + Math.random() * 0.02) * sr), amp = 0.7 * Math.pow(0.62, k); for (let j = 0; j < 400 && s + j < n; j++) d[s + j] += amp * (Math.random() * 2 - 1) * Math.exp(-j / 80); }
    if (kind === 'spring') for (let t0 = 0.002 * ch; t0 < len; t0 += 0.033) {
      // the drip of a spring tank: a falling chirp that comes back each time it runs along the spring
      const s = Math.floor(t0 * sr), amp = 0.8 * Math.exp(-6.9 * t0 / len), L = sr * 0.007; let ph = 0;
      for (let j = 0; j < L && s + j < n; j++) { ph += 2 * Math.PI * (4200 - 3800 * j / L) / sr; d[s + j] += amp * Math.sin(ph) * (1 - j / L); }
    }
  }
  return buf;
}
function mfxCrackle(ac) {
  const n = Math.floor(ac.sampleRate * 6), b = ac.createBuffer(2, n, ac.sampleRate), L = b.getChannelData(0), R = b.getChannelData(1);
  let c = 0, rum = 0;
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.0003) c = (Math.random() < 0.5 ? -1 : 1) * Math.pow(Math.random(), 2.5) * 0.7;
    if (Math.random() < 0.000015) c = (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.4);
    rum += 0.002 * ((Math.random() * 2 - 1) - rum);
    const v = c + (Math.random() * 2 - 1) * 0.005 + rum * 0.25;
    L[i] = v; R[i] = v * 0.9 + (Math.random() * 2 - 1) * 0.002; c *= 0.82;
  }
  return b;
}
function createMusicFx(ac) {
  const live = [];
  const G = v => { const g = ac.createGain(); g.gain.value = v; return g; };
  const BQ = (type, f, q, gain) => { const b = ac.createBiquadFilter(); b.type = type; b.frequency.value = f; if (q) b.Q.value = q; if (gain) b.gain.value = gain; return b; };
  const OSC = f => { const o = ac.createOscillator(); o.frequency.value = f; o.start(); live.push(o); return o; };
  const LOOP = buf => { const s = ac.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); live.push(s); return s; };
  const to = (p, v, tc = 0.05) => p.setTargetAtTime(v, ac.currentTime, tc);
  const input = G(1), bus = G(1), output = G(1);
  const bass = BQ('lowshelf', 220), treble = BQ('highshelf', 3200);
  input.connect(bass).connect(treble);
  // each effect in the chain blends a dry path with its own wet one, so switching it is a short crossfade
  let head = treble;
  const stage = (into, from) => { const s = { o: G(1), dry: G(1), wet: G(0) }; head.connect(s.dry).connect(s.o); head.connect(into); from.connect(s.wet).connect(s.o); head = s.o; return s; };
  // even out loudness: a gentle compressor, so quiet passages don't vanish under the table's chatter
  const cmp = ac.createDynamicsCompressor(); cmp.knee.value = 12; cmp.ratio.value = 4; cmp.attack.value = 0.02; cmp.release.value = 0.35;
  const comp = stage(cmp, cmp);
  // overdrive: a warm, lopsided clip with its harsh top rounded off
  const dSh = ac.createWaveShaper(), dLp = BQ('lowpass', 7000), dOut = G(0.7); dSh.oversample = '2x'; dSh.connect(dLp).connect(dOut);
  const drive = stage(dSh, dOut);
  const mufLp = BQ('lowpass', 1200, 0.9), muffle = stage(mufLp, mufLp);
  const rHp = BQ('highpass', 400), rPk = BQ('peaking', 1700, 1.2, 7), rSh = ac.createWaveShaper(), rLp = BQ('lowpass', 3000), rOut = G(0.5), rHiss = G(0);
  rHp.connect(rPk).connect(rSh).connect(rLp).connect(rOut);
  const white = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate); { const d = white.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  LOOP(white).connect(BQ('bandpass', 2600, 0.7)).connect(rHiss).connect(rOut);
  const radio = stage(rHp, rOut);
  const lfSh = ac.createWaveShaper(), lfLp = BQ('lowpass', 6000); lfSh.connect(lfLp);
  const lofi = stage(lfSh, lfLp);
  const wDl = ac.createDelay(0.1), wowG = G(0), flutG = G(0); wDl.delayTime.value = 0.015;
  OSC(0.55).connect(wowG).connect(wDl.delayTime); OSC(6.3).connect(flutG).connect(wDl.delayTime);
  const warble = stage(wDl, wDl);
  // chorus: three slowly drifting copies spread left, centre and right, on top of the music
  const chIn = G(1), chOut = G(1), chWet = G(0.3), chMods = []; chIn.connect(chOut);
  [[0.021, 0.27, -0.7], [0.028, 0.34, 0], [0.035, 0.41, 0.7]].forEach(([d, f, pan]) => { const dl = ac.createDelay(0.1), mg = G(0.002), pn = ac.createStereoPanner(); dl.delayTime.value = d; pn.pan.value = pan; OSC(f).connect(mg).connect(dl.delayTime); chMods.push(mg); chIn.connect(dl).connect(pn).connect(chWet); });
  chWet.connect(chOut);
  const chorus = stage(chIn, chOut);
  // flanger: a very short delay sweeping back and forth, fed back into itself
  const flIn = G(1), flOut = G(1), flDl = ac.createDelay(0.05), flFb = G(0.4), flWet = G(0.5), flMod = G(0.002), flLfo = OSC(0.25); flDl.delayTime.value = 0.004;
  flLfo.connect(flMod).connect(flDl.delayTime); flIn.connect(flOut); flIn.connect(flDl); flDl.connect(flFb).connect(flDl); flDl.connect(flWet).connect(flOut);
  const flanger = stage(flIn, flOut);
  const tG = G(1), tLG = G(0), tLfo = OSC(5); tLfo.connect(tLG).connect(tG.gain);
  const trem = stage(tG, tG);
  // auto-pan: the music drifts slowly from side to side
  const apP = ac.createStereoPanner(), apG = G(0), apLfo = OSC(0.3); apLfo.connect(apG).connect(apP.pan);
  const autopan = stage(apP, apP);
  // stereo width: mono at 0, as it is at 1, extra wide at 2 (each side gets some of the other, in or out of phase)
  const wIn = G(1), wSp = ac.createChannelSplitter(2), wMg = ac.createChannelMerger(2), wLL = G(1), wRL = G(0), wRR = G(1), wLR = G(0);
  wIn.channelCountMode = 'explicit'; wIn.channelCount = 2; wIn.connect(wSp);
  wSp.connect(wLL, 0); wSp.connect(wLR, 0); wSp.connect(wRR, 1); wSp.connect(wRL, 1);
  wLL.connect(wMg, 0, 0); wRL.connect(wMg, 0, 0); wRR.connect(wMg, 0, 1); wLR.connect(wMg, 0, 1);
  const width = stage(wIn, wMg);
  const cLp = BQ('lowpass', 9000), cOut = G(1), cBed = G(0); cLp.connect(cOut); LOOP(mfxCrackle(ac)).connect(cBed).connect(cOut);
  const crackle = stage(cLp, cOut);
  // after the chain: the dry sound plus echo, reverb and convolution sends, then a limiter so nothing clips
  const dryG = G(1); head.connect(dryG).connect(bus);
  const eDl = ac.createDelay(2), eFb = G(0.35), eLp = BQ('lowpass', 3500), eOut = G(0);
  head.connect(eDl); eDl.connect(eLp).connect(eFb).connect(eDl); eLp.connect(eOut).connect(bus);
  const rv = ac.createConvolver(), rvG = G(0), sp = ac.createConvolver(), spG = G(0);
  head.connect(rv).connect(rvG).connect(bus); head.connect(sp).connect(spG).connect(bus);
  const lim = ac.createDynamicsCompressor(); lim.threshold.value = -2; lim.knee.value = 2; lim.ratio.value = 16; lim.attack.value = 0.003; lim.release.value = 0.15;
  // loudness matching: the effects may colour the music but never make it louder, and their crackle and hiss
  // follow the music's level (and so the volume): the output is turned down to the level of what comes in
  // Both sides are measured the way ears hear, not as raw energy (roughly A-weighting): bass counts for little and
  // 1-4 kHz for more. Otherwise "Old radio", which drops the bass and pushes clipped mids, matches on paper but sounds louder.
  const makeup = G(1), aIn = ac.createAnalyser(), aOut = ac.createAnalyser(); aIn.fftSize = aOut.fftSize = 2048;
  const weigh = () => { const a = BQ('highpass', 60, 0.5), c = BQ('peaking', 2500, 0.8, 1), d = BQ('lowpass', 12000, 0.7); a.connect(c).connect(d); return [a, d]; };
  const [wiA, wiB] = weigh(), [woA, woB] = weigh();
  bus.connect(lim).connect(makeup).connect(output); input.connect(wiA); wiB.connect(aIn); lim.connect(woA); woB.connect(aOut);
  const lvl = new Float32Array(2048), pow = a => { a.getFloatTimeDomainData(lvl); let s = 0; for (let i = 0; i < lvl.length; i++) s += lvl[i] * lvl[i]; return s / lvl.length; };
  let pIn = 0, pOut = 0;
  // always on: the limiter adds a little gain of its own even with every effect off
  const lvlT = setInterval(() => {
    pIn = pIn * 0.85 + pow(aIn) * 0.15; pOut = pOut * 0.85 + pow(aOut) * 0.15;
    makeup.gain.setTargetAtTime(Math.min(1, Math.sqrt((pIn + 1e-10) / (pOut + 1e-10))), ac.currentTime, 0.25);
  }, 100);
  const curve = fn => { const c = new Float32Array(16384); for (let i = 0; i < c.length; i++) c[i] = fn(i / (c.length - 1) * 2 - 1); return c; };
  let last = {}, customIR = null, rvT = 0;
  const sw = (st, on) => { to(st.wet.gain, on ? 1 : 0); to(st.dry.gain, on ? 0 : 1); };
  function set(raw) {
    const f = mfxClean(raw), p = last; last = f;
    to(bass.gain, f.eq.bass); to(treble.gain, f.eq.treble);
    to(mufLp.frequency, 3200 * Math.pow(0.08, f.muffle.amt)); sw(muffle, f.muffle.on);
    if (!p.radio || p.radio.amt !== f.radio.amt) { const k = 1 + f.radio.amt * 14; rSh.curve = curve(x => Math.tanh(k * x) / Math.tanh(k)); }
    to(rHp.frequency, 250 + f.radio.amt * 350); to(rLp.frequency, 4300 - f.radio.amt * 1900); to(rHiss.gain, 0.01 + f.radio.amt * 0.05); sw(radio, f.radio.on);
    if (!p.lofi || p.lofi.amt !== f.lofi.amt) { const lv = Math.pow(2, 11 - f.lofi.amt * 8) / 2; lfSh.curve = curve(x => Math.round(x * lv) / lv); }
    to(lfLp.frequency, 11000 * Math.pow(0.25, f.lofi.amt)); sw(lofi, f.lofi.on);
    to(wowG.gain, f.warble.amt * 0.0035); to(flutG.gain, f.warble.amt * 0.0004); sw(warble, f.warble.on);
    to(tLfo.frequency, f.trem.rate); to(tG.gain, 1 - f.trem.depth / 2); to(tLG.gain, f.trem.depth / 2); sw(trem, f.trem.on);
    to(cLp.frequency, 14000 * Math.pow(0.45, f.crackle.amt)); to(cBed.gain, 0.15 + f.crackle.amt * 0.85); sw(crackle, f.crackle.on);
    cmp.threshold.setTargetAtTime(-8 - f.comp.amt * 32, ac.currentTime, 0.05); sw(comp, f.comp.on);
    if (!p.drive || p.drive.amt !== f.drive.amt) { const k = 1 + f.drive.amt * 9; dSh.curve = curve(x => (x >= 0 ? Math.tanh(k * x) : 0.8 * Math.tanh(k * x / 0.8)) / Math.tanh(k)); }
    to(dLp.frequency, 9000 - f.drive.amt * 5000); sw(drive, f.drive.on);
    chMods.forEach(g => to(g.gain, 0.0008 + f.chorus.depth * 0.004)); to(chWet.gain, f.chorus.mix * 0.6); sw(chorus, f.chorus.on);
    to(flLfo.frequency, f.flanger.speed); to(flFb.gain, f.flanger.fb * 0.85); to(flWet.gain, f.flanger.mix); sw(flanger, f.flanger.on);
    to(apLfo.frequency, f.autopan.speed); to(apG.gain, f.autopan.depth); sw(autopan, f.autopan.on);
    to(wLL.gain, (1 + f.width.w) / 2); to(wRR.gain, (1 + f.width.w) / 2); to(wRL.gain, (1 - f.width.w) / 2); to(wLR.gain, (1 - f.width.w) / 2); sw(width, f.width.on);
    to(eDl.delayTime, f.echo.time, 0.1); to(eFb.gain, f.echo.fb); to(eOut.gain, f.echo.on ? f.echo.mix : 0);
    if (f.reverb.on && (!rv.buffer || !p.reverb || p.reverb.size !== f.reverb.size || p.reverb.damp !== f.reverb.damp)) { clearTimeout(rvT); rvT = setTimeout(() => { rv.buffer = mfxImpulse(ac, 'gen', last.reverb.size, last.reverb.damp); }, rv.buffer ? 200 : 0); }
    to(rvG.gain, f.reverb.on ? f.reverb.mix : 0);
    if (f.space.on && (!p.space || p.space.ir !== f.space.ir || !sp.buffer)) sp.buffer = f.space.ir === 'custom' ? customIR : mfxImpulse(ac, f.space.ir);
    to(spG.gain, f.space.on ? f.space.mix : 0);
    to(dryG.gain, 1 - 0.45 * Math.max(f.reverb.on ? f.reverb.mix : 0, f.space.on ? f.space.mix : 0));
  }
  set(null);
  return {
    input, output, set,
    setCustomIR(buf) { customIR = buf; if (last.space && last.space.on && last.space.ir === 'custom') sp.buffer = buf; },
    dispose() { clearInterval(lvlT); live.forEach(s => { try { s.stop(); } catch {} }); try { input.disconnect(); output.disconnect(); } catch {} }
  };
}
// a custom impulse response travels as 16-bit mono samples in base64, in pieces that each fit one room message
// it is resampled to this computer's rate on arrival, because a convolver only takes its own rate
function mfxIrDecode(ac, rate, b64) {
  const bin = atob(b64), n = bin.length >> 1, src = new Float32Array(Math.max(1, n));
  for (let i = 0; i < n; i++) { let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8); if (v > 32767) v -= 65536; src[i] = v / 32768; }
  const k = rate / ac.sampleRate, m = Math.max(1, Math.floor(src.length / k)), buf = ac.createBuffer(1, m, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < m; i++) { const x = i * k, j = Math.floor(x), f = x - j; d[i] = src[j] * (1 - f) + (src[j + 1] ?? 0) * f; }
  return buf;
}
// opus in stereo at a music bitrate (WebRTC otherwise sends speech-quality mono)
function mfxOpus(sdp) {
  const m = /a=rtpmap:(\d+) opus\/48000/i.exec(sdp); if (!m) return sdp;
  return sdp.replace(new RegExp('a=fmtp:' + m[1] + ' ([^\\r\\n]*)'), (line, params) => 'a=fmtp:' + m[1] + ' ' + params.split(';').filter(x => !/^(stereo|sprop-stereo|maxaveragebitrate|cbr|useinbandfec)=/.test(x.trim())).concat(['stereo=1', 'sprop-stereo=1', 'maxaveragebitrate=256000', 'cbr=0', 'useinbandfec=1']).join(';'));
}
// the whole description goes at once instead of candidate by candidate: fewer messages through Homebase
function mfxIceDone(pc, ms = 2500) {
  return new Promise(r => {
    if (pc.iceGatheringState === 'complete') return r();
    const t = setTimeout(r, ms);
    pc.addEventListener('icegatheringstatechange', () => { if (pc.iceGatheringState === 'complete') { clearTimeout(t); r(); } });
  });
}
