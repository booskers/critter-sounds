/* Critter Sounds soundscapes: a small graph of Web Audio nodes and timed triggers.
   The same graph runs live (an AudioContext) and renders loops offline (an OfflineAudioContext), so a loop sounds
   like what you heard. Signals:
     sig    sound (audio)                         ctl    a control signal, about -1..1 (also a signal)
     param  a knob's modulation input: a ±1 control swings the knob across its range
     trig   events ("now"), sent ahead of time so they land exactly
   All signal maths runs in native Web Audio nodes; only triggers run in JavaScript, scheduled 50 ms at a time.
   New node types: SCAPE.defineNode({ type, name, cat, ins, outs, params, build }) (see Music › Critter Sounds › Nodes). */
'use strict';
(function (W) {
const TYPES = {};
const CATS = [['source', 'Sound sources'], ['control', 'Control'], ['trigger', 'Triggers'], ['math', 'Signal maths'], ['effect', 'Effects'], ['output', 'Output'], ['custom', 'Custom']];
const clampN = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const srcUrlOf = s => (!s ? '' : s.path ? 'app://music/media?p=' + encodeURIComponent(s.path) : s.url ? 'app://music/remote?u=' + encodeURIComponent(s.url) : '');
function defineNode(def) {
  if (!def || !/^[\w-]{1,40}$/.test(def.type || '')) throw new Error('a node needs a type made of letters, digits, - or _');
  def.ins = def.ins || []; def.outs = def.outs || []; def.params = def.params || []; def.cat = def.cat || 'custom';
  TYPES[def.type] = def;
}
// ports: [id, kind, label, extra]; params: { id, label, kind: 'num'|'sel'|'bool'|'text'|'sound'|'code', min, max, step, def, unit, opts, mod }
// a param with mod: true also gets a 'param' input port of the same id; its signal is scaled by mod (the swing for ±1)
const P = (id, label, min, max, def, o = {}) => ({ id, label, kind: 'num', min, max, def, step: o.step || (max - min) / 100, unit: o.unit || '', mod: o.mod, log: o.log });
const SEL = (id, label, opts, def) => ({ id, label, kind: 'sel', opts, def });
const BOOL = (id, label, def) => ({ id, label, kind: 'bool', def });
const SOUND = (id, label) => ({ id, label, kind: 'sound', def: null });

// one-press helper: the "emitter" behind a trigger output
// (a loop of triggers firing each other at once is cut off after a few rounds)
const emitter = () => { let depth = 0; const e = { targets: [], fire(t) { if (depth > 8) return; depth++; try { for (const f of e.targets) { try { f(t); } catch (er) { console.warn(er); } } } finally { depth--; } } }; return e; };
// a control output made of a ConstantSource, set ahead of time from JavaScript
function constOut(ctx, v = 0) { const c = ctx.createConstantSource(); c.offset.value = v; c.start(); return c; }
const GAIN = (ctx, v) => { const g = ctx.createGain(); g.gain.value = v; return g; };
function shaper(ctx, fn, n = 2048) { const w = ctx.createWaveShaper(), c = new Float32Array(n); for (let i = 0; i < n; i++) c[i] = fn(i / (n - 1) * 2 - 1); w.curve = c; return w; }
function noiseBuf(ctx, color) {
  const n = ctx.sampleRate * 4, b = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let ch = 0; ch < 2; ch++) {
    const d = b.getChannelData(ch); let b0 = 0, b1 = 0, b2 = 0, last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (color === 'pink') { b0 = 0.99765 * b0 + w * 0.099; b1 = 0.963 * b1 + w * 0.2965; b2 = 0.57 * b2 + w * 1.0527; d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.11; }
      else if (color === 'brown') { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      else d[i] = w * 0.5;
    }
  }
  return b;
}

/* ============================== the built-in nodes ============================== */
// sound sources
defineNode({ type: 'sample', name: 'Sample', cat: 'source', icon: 'pads', desc: 'Plays a sound each time it is triggered, with a little variation if you like.',
  ins: [['play', 'trig', 'Play'], ['vol', 'param', 'Volume']], outs: [['out', 'sig', 'Sound']],
  params: [SOUND('sound', 'Sound'), P('vol', 'Volume', 0, 1.5, 1, { mod: 1 }), P('rate', 'Pitch', 0.25, 2, 1, { unit: '×' }), P('vary', 'Pitch varies', 0, 0.5, 0.05, { unit: '±' }), BOOL('loop', 'Loop while playing', false), P('voices', 'At once', 1, 8, 3, { step: 1 })],
  build(x) {
    const out = GAIN(x.ctx, x.p.vol), playing = [];
    return { ins: { play: t => { const buf = x.buffer(x.p.sound); if (!buf) return; while (playing.length >= x.p.voices) { try { playing.shift().stop(t); } catch {} }
        const s = x.ctx.createBufferSource(); s.buffer = buf; s.loop = !!x.p.loop; s.playbackRate.value = clampN(x.p.rate * (1 + (Math.random() * 2 - 1) * x.p.vary), 0.1, 4); s.connect(out); s.start(t); playing.push(s); s.onended = () => { const i = playing.indexOf(s); if (i >= 0) playing.splice(i, 1); }; },
      vol: out.gain }, outs: { out }, set(id, v) { if (id === 'vol') x.ramp(out.gain, v); }, stop(t) { playing.forEach(s => { try { s.stop(t); } catch {} }); } };
  } });
defineNode({ type: 'bed', name: 'Bed', cat: 'source', icon: 'wave', desc: 'A sound that loops for as long as the soundscape plays: rain, wind, a tavern.',
  ins: [['vol', 'param', 'Volume']], outs: [['out', 'sig', 'Sound']],
  params: [SOUND('sound', 'Sound'), P('vol', 'Volume', 0, 1.5, 0.8, { mod: 0.75 }), P('rate', 'Speed', 0.5, 1.5, 1, { unit: '×' }), BOOL('rnd', 'Start somewhere random', true)],
  build(x) {
    const out = GAIN(x.ctx, x.p.vol); let s = null;
    return { ins: { vol: out.gain }, outs: { out }, set(id, v) { if (id === 'vol') x.ramp(out.gain, v); if (id === 'rate' && s) x.ramp(s.playbackRate, v); },
      start(t) { const buf = x.buffer(x.p.sound); if (!buf) return; s = x.ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.playbackRate.value = x.p.rate; s.connect(out); s.start(t, x.p.rnd ? Math.random() * buf.duration : 0); },
      stop(t) { if (s) try { s.stop(t); } catch {} } };
  } });
defineNode({ type: 'noise', name: 'Noise', cat: 'source', icon: 'wave', desc: 'Endless noise: white is hiss, pink is rain-like, brown is a deep rumble. Filter it into wind or surf.',
  ins: [['vol', 'param', 'Volume']], outs: [['out', 'sig', 'Sound']],
  params: [{ ...SEL('color', 'Colour', [['white', 'White'], ['pink', 'Pink'], ['brown', 'Brown']], 'pink'), rebuild: true }, P('vol', 'Volume', 0, 1, 0.3, { mod: 0.5 })],
  build(x) {
    const out = GAIN(x.ctx, x.p.vol), s = x.ctx.createBufferSource(); s.buffer = noiseBuf(x.ctx, x.p.color); s.loop = true; s.connect(out);
    return { ins: { vol: out.gain }, outs: { out }, set(id, v) { if (id === 'vol') x.ramp(out.gain, v); }, start(t) { s.start(t, Math.random() * 3); }, stop(t) { try { s.stop(t); } catch {} } };
  } });
defineNode({ type: 'tone', name: 'Tone', cat: 'source', icon: 'note', desc: 'A steady tone or drone. Wire a control into Pitch to make it bend.',
  ins: [['freq', 'param', 'Pitch'], ['vol', 'param', 'Volume']], outs: [['out', 'sig', 'Sound']],
  params: [SEL('wave', 'Wave', [['sine', 'Sine'], ['triangle', 'Triangle'], ['sawtooth', 'Saw'], ['square', 'Square']], 'sine'), P('freq', 'Pitch', 30, 1000, 110, { unit: 'Hz', mod: 1200, step: 1 }), P('vol', 'Volume', 0, 1, 0.15, { mod: 0.15 })],
  build(x) {
    const o = x.ctx.createOscillator(), out = GAIN(x.ctx, x.p.vol); o.type = x.p.wave; o.frequency.value = x.p.freq; o.connect(out);
    // pitch is swung in cents (±1 = ±1200, an octave), which sounds even across the range
    return { ins: { freq: o.detune, vol: out.gain }, outs: { out }, set(id, v) { if (id === 'freq') x.ramp(o.frequency, v); if (id === 'vol') x.ramp(out.gain, v); if (id === 'wave') o.type = v; }, start(t) { o.start(t); }, stop(t) { try { o.stop(t); } catch {} } };
  } });

// control: slow numbers that move things
defineNode({ type: 'lfo', name: 'LFO', cat: 'control', icon: 'wave', desc: 'A slow wave, from -1 to 1. Wire it into a knob to make that knob sway. Its Peak output fires at each top of the wave.',
  ins: [['rate', 'param', 'Speed']], outs: [['out', 'ctl', 'Wave'], ['peak', 'trig', 'Peak']],
  params: [SEL('shape', 'Shape', [['sine', 'Sine'], ['triangle', 'Triangle'], ['square', 'Square'], ['sawtooth', 'Saw']], 'sine'), P('rate', 'Speed', 0.01, 5, 0.1, { unit: 'Hz', step: 0.01, mod: 0.5 }), P('depth', 'Depth', 0, 1, 1), P('offset', 'Offset', -1, 1, 0)],
  build(x) {
    const o = x.ctx.createOscillator(), dep = GAIN(x.ctx, x.p.depth), off = constOut(x.ctx, x.p.offset), out = GAIN(x.ctx, 1), peak = emitter();
    o.type = x.p.shape; o.frequency.value = x.p.rate; o.connect(dep).connect(out); off.connect(out);
    let t0 = 0, next = 0;
    return { ins: { rate: o.frequency }, outs: { out, peak }, set(id, v) { if (id === 'rate') x.ramp(o.frequency, v); if (id === 'depth') x.ramp(dep.gain, v); if (id === 'offset') x.ramp(off.offset, v); if (id === 'shape') o.type = v; },
      start(t) { o.start(t); t0 = t; next = t + 0.25 / x.p.rate; }, tick(t, dt) { while (next < t + dt) { if (next >= t) peak.fire(next); next += 1 / Math.max(0.01, x.p.rate); } }, stop(t) { try { o.stop(t); off.stop(t); } catch {} } };
  } });
defineNode({ type: 'drift', name: 'Drift', cat: 'control', icon: 'sparkle', desc: 'Wanders to a new random value now and then, smoothly: random bounces for anything. Fires a trigger each time it picks a new one.',
  ins: [], outs: [['out', 'ctl', 'Value'], ['moved', 'trig', 'New value']],
  params: [P('min', 'Lowest', -1, 1, -1), P('max', 'Highest', -1, 1, 1), P('every', 'About every', 0.2, 60, 6, { unit: 's', step: 0.1 }), P('glide', 'Glide', 0, 20, 2, { unit: 's', step: 0.1 })],
  build(x) {
    const c = constOut(x.ctx, 0), moved = emitter(); let next = 0;
    return { outs: { out: c, moved }, start(t) { next = t; }, stop(t) { try { c.stop(t); } catch {} },
      tick(t, dt) { while (next < t + dt) { const v = x.p.min + Math.random() * (x.p.max - x.p.min); c.offset.setTargetAtTime(v, Math.max(next, x.ctx.currentTime), Math.max(0.01, x.p.glide / 3)); moved.fire(next); next += x.p.every * (0.5 + Math.random()); } } };
  } });
defineNode({ type: 'const', name: 'Value', cat: 'control', icon: 'sliders', desc: 'A fixed number, for adding, offsetting or as a starting point.',
  outs: [['out', 'ctl', 'Value']], params: [P('v', 'Value', -2, 2, 0.5, { step: 0.01 })],
  build(x) { const c = constOut(x.ctx, x.p.v); return { outs: { out: c }, set(id, v) { x.ramp(c.offset, v); }, stop(t) { try { c.stop(t); } catch {} } }; } });
defineNode({ type: 'macro', name: 'Macro', cat: 'control', icon: 'sliders', desc: 'A slider that shows on the soundscape\'s tile in the main window, for changing it while it plays: intensity, danger, weather…',
  outs: [['out', 'ctl', 'Value']], params: [{ id: 'label', label: 'Name', kind: 'text', def: 'Intensity' }, P('v', 'Value', 0, 1, 0.5, { step: 0.01 })],
  build(x) { const c = constOut(x.ctx, x.p.v); return { outs: { out: c }, set(id, v) { if (id === 'v') x.ramp(c.offset, v, 0.2); }, stop(t) { try { c.stop(t); } catch {} } }; } });
defineNode({ type: 'script', name: 'Script', cat: 'control', icon: 'edit', desc: 'Your own few lines of JavaScript, run 20 times a second of soundscape time.',
  ins: [['in', 'trig', 'Trigger']], outs: [['out', 'ctl', 'Value'], ['fire', 'trig', 'Fire']],
  params: [{ id: 'code', label: 'Code', kind: 'code', def: '// t: seconds since the start, dt: time since the last run\n// state: an object of your own; trig: true when a trigger arrived\n// out(v): set the Value output (about -1..1); fire(): send a trigger\n// rnd(): a random number from 0 to 1\nif (trig || rnd() < dt / 8) fire();      // on a trigger, or about every 8 s\nout(Math.sin(t / 3));                    // a slow swing\n' }],
  build(x) {
    const c = constOut(x.ctx, 0), fireE = emitter(), state = {}; let fn = null, err = '', got = false;
    try { fn = new Function('t', 'dt', 'state', 'trig', 'out', 'fire', 'rnd', x.p.code); } catch (e) { err = e.message; }
    x.error(err);
    return { ins: { in: () => { got = true; } }, outs: { out: c, fire: fireE }, stop(t) { try { c.stop(t); } catch {} },
      tick(t, dt) { if (!fn) return; const trig = got; got = false; try { fn(t - x.t0(), dt, state, trig, v => { if (Number.isFinite(+v)) c.offset.setValueAtTime(+v, Math.max(t, x.ctx.currentTime)); }, () => fireE.fire(t), Math.random); } catch (e) { fn = null; x.error(e.message); } } };
  } });

// triggers: when things happen
defineNode({ type: 'clock', name: 'Clock', cat: 'trigger', icon: 'clock', desc: 'Fires every few seconds. Swing makes it less regular.',
  outs: [['out', 'trig', 'Tick']], params: [P('every', 'Every', 0.1, 120, 4, { unit: 's', step: 0.1 }), P('swing', 'Swing', 0, 0.9, 0.1, { unit: '±' }), BOOL('first', 'Fire at the start', false)],
  build(x) { const e = emitter(); let next = 0; return { outs: { out: e }, start(t) { next = t + (x.p.first ? 0 : x.p.every); }, tick(t, dt) { while (next < t + dt) { e.fire(next); next += x.p.every * (1 + (Math.random() * 2 - 1) * x.p.swing); } } }; } });
defineNode({ type: 'sometimes', name: 'Sometimes', cat: 'trigger', icon: 'sparkle', desc: 'Fires at random moments, on average every so often, but never twice within the shortest gap.',
  outs: [['out', 'trig', 'Now']], params: [P('avg', 'On average every', 0.5, 300, 20, { unit: 's', step: 0.5 }), P('gap', 'At least', 0, 60, 3, { unit: 's', step: 0.5 })],
  build(x) { const e = emitter(); let next = 0; const pick = () => x.p.gap + -Math.log(1 - Math.random()) * Math.max(0.1, x.p.avg - x.p.gap);
    return { outs: { out: e }, start(t) { next = t + pick(); }, tick(t, dt) { while (next < t + dt) { e.fire(next); next += pick(); } } }; } });
defineNode({ type: 'seq', name: 'Sequencer', cat: 'trigger', icon: 'list', desc: 'Steps through a pattern: x fires, . waits. "x..x..x." is a rhythm; every step lasts Step long.',
  outs: [['out', 'trig', 'Hit']], params: [{ id: 'pattern', label: 'Pattern', kind: 'text', def: 'x...x.x.' }, P('step', 'Step', 0.05, 10, 0.5, { unit: 's', step: 0.05 })],
  build(x) { const e = emitter(); let next = 0, i = 0; return { outs: { out: e }, start(t) { next = t; i = 0; }, tick(t, dt) { const pat = String(x.p.pattern || 'x').replace(/\s/g, '') || 'x'; while (next < t + dt) { if (/[x1*]/i.test(pat[i % pat.length])) e.fire(next); i++; next += x.p.step; } } }; } });
defineNode({ type: 'chance', name: 'Chance', cat: 'trigger', icon: 'sparkle', desc: 'Lets a trigger through only some of the time.',
  ins: [['in', 'trig', 'In']], outs: [['out', 'trig', 'Out']], params: [P('p', 'Chance', 0, 1, 0.5, { step: 0.01, unit: '' })],
  build(x) { const e = emitter(); return { ins: { in: t => { if (Math.random() < x.p.p) e.fire(t); } }, outs: { out: e } }; } });
defineNode({ type: 'delay-t', name: 'Wait', cat: 'trigger', icon: 'clock', desc: 'Passes a trigger on a little later: thunder after lightning.',
  ins: [['in', 'trig', 'In']], outs: [['out', 'trig', 'Later']], params: [P('d', 'Wait', 0, 30, 2, { unit: 's', step: 0.1 }), P('vary', 'Varies by', 0, 10, 1, { unit: '±s', step: 0.1 })],
  build(x) { const e = emitter(); return { ins: { in: t => e.fire(t + Math.max(0, x.p.d + (Math.random() * 2 - 1) * x.p.vary)) }, outs: { out: e } }; } });
defineNode({ type: 'every', name: 'Every Nth', cat: 'trigger', icon: 'list', desc: 'Passes every Nth trigger on: every 4th drum hit, every 3rd footstep.',
  ins: [['in', 'trig', 'In']], outs: [['out', 'trig', 'Out']], params: [P('n', 'Every', 1, 16, 4, { step: 1 })],
  build(x) { const e = emitter(); let c = 0; return { ins: { in: t => { if (++c >= x.p.n) { c = 0; e.fire(t); } } }, outs: { out: e } }; } });
defineNode({ type: 'pick', name: 'Pick one', cat: 'trigger', icon: 'shuffle', desc: 'Sends each trigger to one of its outputs at random, so several samples take turns.',
  ins: [['in', 'trig', 'In']], outs: [['a', 'trig', 'A'], ['b', 'trig', 'B'], ['c', 'trig', 'C'], ['d', 'trig', 'D']], params: [P('n', 'Outputs used', 2, 4, 3, { step: 1 })],
  build(x) { const es = { a: emitter(), b: emitter(), c: emitter(), d: emitter() }; return { ins: { in: t => es['abcd'[Math.floor(Math.random() * x.p.n)]].fire(t) }, outs: es }; } });

// signal maths: on sound and control alike, all in Web Audio
const mathNode = (type, name, desc, ins, params, make) => defineNode({ type, name, cat: 'math', icon: 'sliders', desc, ins, outs: [['out', 'sig', 'Out']], params, build: make });
mathNode('merge', 'Merge', 'Adds up to four signals into one: mix several sounds.', [['a', 'sig', 'A'], ['b', 'sig', 'B'], ['c', 'sig', 'C'], ['d', 'sig', 'D']], [],
  x => { const s = GAIN(x.ctx, 1); return { ins: { a: s, b: s, c: s, d: s }, outs: { out: s } }; });
mathNode('level', 'Level', 'Turns a signal up or down. Wire a control into Level to make it swell and fade.', [['in', 'sig', 'In'], ['gain', 'param', 'Level']], [P('gain', 'Level', 0, 2, 1, { mod: 1, step: 0.01, unit: '×' })],
  x => { const g = GAIN(x.ctx, x.p.gain); return { ins: { in: g, gain: g.gain }, outs: { out: g }, set(id, v) { x.ramp(g.gain, v); } }; });
mathNode('boost', 'Boost', 'Makes a signal louder or quieter in decibels.', [['in', 'sig', 'In']], [P('db', 'Boost', -24, 24, 6, { unit: 'dB', step: 0.5 })],
  x => { const g = GAIN(x.ctx, Math.pow(10, x.p.db / 20)); return { ins: { in: g }, outs: { out: g }, set(id, v) { x.ramp(g.gain, Math.pow(10, v / 20)); } }; });
mathNode('add', 'Add', 'A + B.', [['a', 'sig', 'A'], ['b', 'sig', 'B']], [],
  x => { const s = GAIN(x.ctx, 1); return { ins: { a: s, b: s }, outs: { out: s } }; });
mathNode('sub', 'Subtract', 'A − B.', [['a', 'sig', 'A'], ['b', 'sig', 'B']], [],
  x => { const s = GAIN(x.ctx, 1), n = GAIN(x.ctx, -1); n.connect(s); return { ins: { a: s, b: n }, outs: { out: s } }; });
mathNode('invert', 'Invert', 'Flips a signal: −x, or 1 − x (for 0..1 controls).', [['in', 'sig', 'In']], [SEL('mode', 'Mode', [['neg', '−x'], ['one', '1 − x']], 'neg')],
  x => { const s = GAIN(x.ctx, 1), n = GAIN(x.ctx, -1), one = constOut(x.ctx, x.p.mode === 'one' ? 1 : 0); n.connect(s); one.connect(s);
    return { ins: { in: n }, outs: { out: s }, set(id, v) { one.offset.value = v === 'one' ? 1 : 0; }, stop(t) { try { one.stop(t); } catch {} } }; });
mathNode('mul', 'Multiply', 'A × B: B (a control from 0 to 1) sets how loud A is. A sound times an LFO is a tremolo.', [['a', 'sig', 'A'], ['b', 'sig', 'B']], [],
  x => { const g = GAIN(x.ctx, 0); return { ins: { a: g, b: g.gain }, outs: { out: g } }; });
mathNode('range', 'Range', 'Maps a −1..1 control onto Lowest..Highest.', [['in', 'sig', 'In']], [P('lo', 'Lowest', -2, 2, 0, { step: 0.01 }), P('hi', 'Highest', -2, 2, 1, { step: 0.01 })],
  x => { const g = GAIN(x.ctx, (x.p.hi - x.p.lo) / 2), s = GAIN(x.ctx, 1), mid = constOut(x.ctx, (x.p.hi + x.p.lo) / 2); g.connect(s); mid.connect(s);
    return { ins: { in: g }, outs: { out: s }, set() { x.ramp(g.gain, (x.p.hi - x.p.lo) / 2); x.ramp(mid.offset, (x.p.hi + x.p.lo) / 2); }, stop(t) { try { mid.stop(t); } catch {} } }; });
mathNode('cutout', 'Cutout', 'Gate: silences everything quieter than the threshold. Clip: flattens everything louder. Works on −1..1 signals.', [['in', 'sig', 'In']], [SEL('mode', 'Mode', [['gate', 'Gate'], ['clip', 'Clip']], 'gate'), P('thr', 'Threshold', 0, 1, 0.3, { step: 0.01 })],
  x => { const mk = () => shaper(x.ctx, v => (x.p.mode === 'clip' ? clampN(v, -x.p.thr, x.p.thr) : Math.abs(v) < x.p.thr ? 0 : v)); let w = mk(); const out = GAIN(x.ctx, 1), inp = GAIN(x.ctx, 1); inp.connect(w).connect(out);
    return { ins: { in: inp }, outs: { out }, set() { const n = mk(); inp.disconnect(); inp.connect(n).connect(out); try { w.disconnect(); } catch {} w = n; } }; });
mathNode('smooth', 'Smooth', 'Takes the edges off a control: a jumpy value becomes a glide.', [['in', 'sig', 'In']], [P('time', 'Glide', 0.02, 5, 0.5, { unit: 's', step: 0.01 })],
  x => { const f = x.ctx.createBiquadFilter(); f.type = 'lowpass'; f.Q.value = 0.5; f.frequency.value = 1 / (2 * Math.PI * x.p.time); return { ins: { in: f }, outs: { out: f }, set(id, v) { x.ramp(f.frequency, 1 / (2 * Math.PI * v)); } }; });
mathNode('abs', 'Absolute', 'Makes negative values positive: a −1..1 wave becomes two 0..1 humps.', [['in', 'sig', 'In']], [],
  x => { const w = shaper(x.ctx, v => Math.abs(v)); return { ins: { in: w }, outs: { out: w } }; });

// effects
const fxNode = (type, name, desc, ins, params, make) => defineNode({ type, name, cat: 'effect', icon: 'sliders', desc, ins: [['in', 'sig', 'In'], ...ins], outs: [['out', 'sig', 'Out']], params, build: make });
fxNode('filter', 'Filter', 'Lowpass makes things muffled or distant, highpass thin, bandpass like wind through a gap. Sweep moves it by up to two octaves.', [['sweep', 'param', 'Sweep']],
  [SEL('type', 'Type', [['lowpass', 'Lowpass'], ['highpass', 'Highpass'], ['bandpass', 'Bandpass'], ['notch', 'Notch']], 'lowpass'), P('freq', 'Frequency', 20, 18000, 1200, { unit: 'Hz', step: 1, log: true }), P('q', 'Resonance', 0.1, 20, 0.8, { step: 0.1 }), P('sweep', 'Sweep', 0, 1, 0, { mod: 2400 })],
  x => { const f = x.ctx.createBiquadFilter(); f.type = x.p.type; f.frequency.value = x.p.freq; f.Q.value = x.p.q; return { ins: { in: f, sweep: f.detune }, outs: { out: f }, set(id, v) { if (id === 'type') f.type = v; if (id === 'freq') x.ramp(f.frequency, v); if (id === 'q') x.ramp(f.Q, v); } }; });
fxNode('echo', 'Echo', 'Repeats the sound, fading: canyons, halls, dreams.', [],
  [P('time', 'Time', 0.02, 2, 0.4, { unit: 's', step: 0.01 }), P('fb', 'Repeats', 0, 0.9, 0.4, { step: 0.01 }), P('mix', 'Mix', 0, 1, 0.35, { step: 0.01 })],
  x => { const inp = GAIN(x.ctx, 1), out = GAIN(x.ctx, 1), d = x.ctx.createDelay(2.5), fb = GAIN(x.ctx, x.p.fb), wet = GAIN(x.ctx, x.p.mix), lp = x.ctx.createBiquadFilter(); lp.frequency.value = 4000; d.delayTime.value = x.p.time;
    inp.connect(out); inp.connect(d); d.connect(lp).connect(fb).connect(d); lp.connect(wet).connect(out);
    return { ins: { in: inp }, outs: { out }, set(id, v) { if (id === 'time') x.ramp(d.delayTime, v, 0.1); if (id === 'fb') x.ramp(fb.gain, v); if (id === 'mix') x.ramp(wet.gain, v); } }; });
fxNode('reverb', 'Reverb', 'Puts the sound in a space, from a small room to a cathedral.', [],
  [SEL('space', 'Space', [['gen', 'Adjustable'], ['room', 'Wooden room'], ['hall', 'Great hall'], ['cathedral', 'Cathedral'], ['cave', 'Cave'], ['plate', 'Plate']], 'hall'), P('size', 'Size', 0, 1, 0.5, { step: 0.01 }), P('mix', 'Mix', 0, 1, 0.35, { step: 0.01 })],
  x => { const inp = GAIN(x.ctx, 1), out = GAIN(x.ctx, 1), dry = GAIN(x.ctx, 1 - x.p.mix * 0.5), wet = GAIN(x.ctx, x.p.mix), cv = x.ctx.createConvolver();
    const ir = () => { cv.buffer = typeof mfxImpulse === 'function' ? mfxImpulse(x.ctx, x.p.space, x.p.size, 0.4) : null; }; ir();
    inp.connect(dry).connect(out); inp.connect(cv).connect(wet).connect(out);
    return { ins: { in: inp }, outs: { out }, set(id, v) { if (id === 'mix') { x.ramp(wet.gain, v); x.ramp(dry.gain, 1 - v * 0.5); } else ir(); } }; });
fxNode('pan', 'Pan', 'Places the sound left or right. An LFO into Pan makes it drift side to side.', [['pan', 'param', 'Pan']],
  [P('pan', 'Pan', -1, 1, 0, { step: 0.01, mod: 1 })], x => { const p = x.ctx.createStereoPanner(); p.pan.value = x.p.pan; return { ins: { in: p, pan: p.pan }, outs: { out: p }, set(id, v) { x.ramp(p.pan, v); } }; });
fxNode('drive', 'Distort', 'Grit and crunch: radios, machines, fire.', [],
  [P('amt', 'Amount', 0, 1, 0.4, { step: 0.01 })], x => { const mk = () => { const k = 1 + x.p.amt * 20; return shaper(x.ctx, v => Math.tanh(k * v) / Math.tanh(k)); }; let w = mk(); const inp = GAIN(x.ctx, 1), out = GAIN(x.ctx, 0.8); inp.connect(w).connect(out);
    return { ins: { in: inp }, outs: { out }, set() { const n = mk(); inp.disconnect(); inp.connect(n).connect(out); try { w.disconnect(); } catch {} w = n; } }; });
fxNode('comp', 'Even out', 'Evens out loud and quiet moments.', [],
  [P('thr', 'Threshold', -60, 0, -24, { unit: 'dB', step: 1 }), P('ratio', 'Ratio', 1, 20, 4, { step: 0.5 })],
  x => { const c = x.ctx.createDynamicsCompressor(); c.threshold.value = x.p.thr; c.ratio.value = x.p.ratio; return { ins: { in: c }, outs: { out: c }, set(id, v) { if (id === 'thr') x.ramp(c.threshold, v); if (id === 'ratio') x.ramp(c.ratio, v); } }; });
fxNode('mfx', 'Music effects', 'All of Critter Sounds\' effects in one, as a preset: Underwater, Old gramophone, Haunted…', [],
  [SEL('preset', 'Preset', (W.FX_PRESETS || []).map(([n]) => [n, n]), 'Underwater')],
  x => { if (typeof createMusicFx !== 'function') { const g = GAIN(x.ctx, 1); return { ins: { in: g }, outs: { out: g } }; } const fx = createMusicFx(x.ctx); const apply = () => { const pr = (W.FX_PRESETS || []).find(p => p[0] === x.p.preset); fx.set(pr && W.presetFx ? W.presetFx(pr[2]) : null); }; apply();
    return { ins: { in: fx.input }, outs: { out: fx.output }, set() { apply(); }, stop() { setTimeout(() => fx.dispose(), 4000); } }; });

// the way out
defineNode({ type: 'output', name: 'Output', cat: 'output', icon: 'headphones', desc: 'Where the soundscape comes out. In the main window, that\'s the table.',
  ins: [['in', 'sig', 'Sound'], ['vol', 'param', 'Volume']], outs: [], params: [P('vol', 'Volume', 0, 1.5, 0.9, { mod: 0.5 }), P('fade', 'Fades in over', 0, 20, 3, { unit: 's', step: 0.5 })],
  build(x) { const g = GAIN(x.ctx, x.p.vol); g.connect(x.dest); return { ins: { in: g, vol: g.gain }, outs: {}, set(id, v) { if (id === 'vol') x.ramp(g.gain, v); } }; } });

/* ============================== running a graph ============================== */
const PORT_COMPAT = (o, i) => (o === 'trig' ? i === 'trig' : i !== 'trig');
const TICK = 0.05;
// load and decode the sounds a graph uses (shared between runs; an AudioBuffer works in any context)
const bufCache = new Map();
async function loadSound(ctx, s) {
  const u = srcUrlOf(s); if (!u) return null;
  if (!bufCache.has(u)) bufCache.set(u, fetch(u).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); }).then(b => ctx.decodeAudioData(b)).catch(e => { console.warn('sound', u, e); bufCache.delete(u); return null; }));
  return bufCache.get(u);
}
class Scape {
  constructor(ctx, doc, dest, opts = {}) {
    this.ctx = ctx; this.doc = doc; this.dest = dest; this.opts = opts;
    this.master = GAIN(ctx, 0); this.master.connect(dest);
    this.nodes = new Map(); this.bufs = new Map(); this.vt = 0; this.t0 = 0; this.timer = 0; this.errors = {};
  }
  async load() {
    const sounds = []; for (const n of this.doc.nodes) { const def = TYPES[n.type]; if (!def) continue; for (const p of def.params) if (p.kind === 'sound' && n.p && n.p[p.id]) sounds.push(n.p[p.id]); }
    await Promise.all(sounds.map(async s => { this.bufs.set(srcUrlOf(s), await loadSound(this.ctx, s)); }));
    return this;
  }
  build() {
    const ctx = this.ctx;
    for (const n of this.doc.nodes) {
      const def = TYPES[n.type]; if (!def) { this.errors[n.id] = 'unknown node type: ' + n.type; continue; }
      const p = this.params(n), self = this;
      const x = { ctx, p, node: n, dest: this.master, buffer: s => (s ? this.bufs.get(srcUrlOf(s)) || null : null), t0: () => self.t0,
        ramp: (param, v, tc = 0.03) => param.setTargetAtTime(v, ctx.currentTime, tc), error: msg => { if (msg) self.errors[n.id] = msg; else delete self.errors[n.id]; if (self.opts.onError) self.opts.onError(n.id, msg); } };
      try {
        const rt = def.build(x) || {}; rt.ins = rt.ins || {}; rt.outs = rt.outs || {};
        // every trigger a node sends can be shown in the editor
        if (this.opts.onFire) for (const [pid, o] of Object.entries(rt.outs)) if (o && o.targets) { const f = o.fire; o.fire = t => { this.opts.onFire(n.id, pid, t); f(t); }; }
        this.nodes.set(n.id, { def, n, p, rt });
      }
      catch (e) { this.errors[n.id] = e.message; console.warn('node', n.type, e); }
    }
    for (const e of this.doc.edges) this.wire(e);
    return this;
  }
  params(n) { const def = TYPES[n.type], p = {}; for (const d of def.params) p[d.id] = n.p && n.p[d.id] !== undefined ? n.p[d.id] : d.def; return p; }
  wire(e) {
    const a = this.nodes.get(e.from[0]), b = this.nodes.get(e.to[0]); if (!a || !b) return;
    const out = a.rt.outs[e.from[1]], inp = b.rt.ins[e.to[1]]; if (!out || !inp) return;
    if (out.targets) { if (typeof inp === 'function') out.targets.push(inp); return; }
    const pdef = b.def.params.find(p => p.id === e.to[1]);
    try {
      // a knob's input: the signal is scaled so ±1 swings it across its range
      if (inp instanceof AudioParam && pdef && pdef.mod) { const s = GAIN(this.ctx, pdef.mod); out.connect(s); s.connect(inp); }
      else out.connect(inp);
    } catch (er) { console.warn('wire', er); }
  }
  start(when) {
    const t = Math.max(when || 0, this.ctx.currentTime);
    this.t0 = t; this.vt = t;
    for (const { rt } of this.nodes.values()) if (rt.start) try { rt.start(t); } catch (e) { console.warn(e); }
    const out = this.doc.nodes.find(n => n.type === 'output'), fadeIn = out ? +((out.p || {}).fade ?? 3) : 3;
    this.master.gain.setValueAtTime(0, t); this.master.gain.linearRampToValueAtTime(1, t + Math.max(0.02, fadeIn));
    return this;
  }
  // run the triggers up to a moment: live, a little ahead of the clock; offline, the whole length at once
  advance(until) {
    let n = 0;
    while (this.vt < until && n++ < 100000) {
      for (const { rt } of this.nodes.values()) if (rt.tick) try { rt.tick(this.vt, TICK); } catch (e) { console.warn(e); }
      this.vt += TICK;
    }
  }
  live() { this.advance(this.ctx.currentTime + 0.3); this.timer = setInterval(() => this.advance(this.ctx.currentTime + 0.3), 50); return this; }
  // a knob turned while it plays: false when that change needs the node built again (a new sound, new code)
  set(nodeId, pid, v) {
    const x = this.nodes.get(nodeId); if (!x) return false;
    const d = x.def.params.find(p => p.id === pid); if (!d || d.kind === 'sound' || d.kind === 'code' || d.rebuild) return false;
    x.p[pid] = v; if (x.rt.set) try { x.rt.set(pid, v); } catch (e) { console.warn(e); }
    return true;
  }
  stop(fade = 1) {
    clearInterval(this.timer);
    const t = this.ctx.currentTime, g = this.master.gain;
    try { g.cancelAndHoldAtTime(t); } catch { g.cancelScheduledValues(t); }
    g.setTargetAtTime(0, t, Math.max(0.01, fade / 4));
    setTimeout(() => { for (const { rt } of this.nodes.values()) if (rt.stop) try { rt.stop(this.ctx.currentTime); } catch {} try { this.master.disconnect(); } catch {} }, fade * 1000 + 300);
  }
}
// render a loop offline: the length plus a crossfade's worth, then the end is laid over the start so it loops without a seam
async function renderLoop(doc, seconds, xfade, onProgress, rate = 44100) {
  seconds = clampN(+seconds || 60, 5, 600); xfade = clampN(+xfade || 0, 0, Math.min(15, seconds / 3));
  const total = seconds + xfade, ctx = new OfflineAudioContext(2, Math.ceil(total * rate), rate);
  const sc = new Scape(ctx, doc, ctx.destination); await sc.load(); sc.build(); sc.start(0);
  sc.master.gain.cancelScheduledValues(0); sc.master.gain.setValueAtTime(1, 0);   // a loop starts at full level
  sc.advance(total);
  const steps = 20; for (let i = 1; i < steps; i++) ctx.suspend(total * i / steps).then(() => { if (onProgress) onProgress(i / steps); ctx.resume(); });
  const buf = await ctx.startRendering(); if (onProgress) onProgress(1);
  const n = Math.round(seconds * rate), xf = Math.round(xfade * rate), outL = new Float32Array(n), outR = new Float32Array(n), L = buf.getChannelData(0), R = buf.getChannelData(1);
  outL.set(L.subarray(0, n)); outR.set(R.subarray(0, n));
  for (let i = 0; i < xf; i++) { const a = Math.sqrt(i / xf), b = Math.sqrt(1 - i / xf); outL[i] = L[i] * a + L[n + i] * b; outR[i] = R[i] * a + R[n + i] * b; }
  // a little headroom if it ran hot
  let pk = 0; for (let i = 0; i < n; i++) pk = Math.max(pk, Math.abs(outL[i]), Math.abs(outR[i]));
  const k = pk > 0.98 ? 0.98 / pk : 1;
  return { wav: wav16([outL, outR], rate, k), seconds, peak: pk };
}
function wav16(ch, rate, k = 1) {
  const n = ch[0].length, b = new ArrayBuffer(44 + n * 4), v = new DataView(b), s = (o, t) => { for (let i = 0; i < t.length; i++) v.setUint8(o + i, t.charCodeAt(i)); };
  s(0, 'RIFF'); v.setUint32(4, 36 + n * 4, true); s(8, 'WAVEfmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 2, true); v.setUint32(24, rate, true); v.setUint32(28, rate * 4, true); v.setUint16(32, 4, true); v.setUint16(34, 16, true); s(36, 'data'); v.setUint32(40, n * 4, true);
  let o = 44; for (let i = 0; i < n; i++) for (let c = 0; c < 2; c++) { const x = clampN(ch[c][i] * k, -1, 1); v.setInt16(o, x < 0 ? x * 32768 : x * 32767, true); o += 2; }
  return new Uint8Array(b);
}
// a fresh soundscape: just an output, waiting for sounds
const newDoc = name => ({ v: 1, id: 'sc' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: name || '', icon: 'wave', named: false, iconSet: false, created: Date.now(), nodes: [{ id: 'out', type: 'output', x: 900, y: 300, p: {} }], edges: [], view: { x: 0, y: 0, z: 1 } });
// custom node types from Music › Critter Sounds › Nodes
function loadCustom(files, onError) { for (const f of files || []) { try { new Function('CritterNode', 'SCAPE', f.code)(defineNode, W.SCAPE); } catch (e) { if (onError) onError(f.file, e); } } }
W.SCAPE = { TYPES, CATS, defineNode, Scape, renderLoop, newDoc, loadCustom, PORT_COMPAT, srcUrlOf };
})(window);
