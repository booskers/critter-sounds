/* Critter Sounds: the one-click effect presets, shared by the player and the soundscape editor */
'use strict';
// one-click sets of effects; anything left out is off
var FX_PRESETS = [
  ['Clean', 'Every effect off', {}],
  ['Tavern next door', 'Muffled through a wall, in a small room', { muffle: { on: true, amt: 0.55 }, space: { on: true, ir: 'room', mix: 0.35 }, comp: { on: true, amt: 0.5 } }],
  ['Underwater', 'Deep, wobbly and far off', { muffle: { on: true, amt: 0.85 }, warble: { on: true, amt: 0.7 }, chorus: { on: true, mix: 0.6, depth: 0.8 }, reverb: { on: true, mix: 0.35, size: 0.6, damp: 0.6 } }],
  ['Old gramophone', 'Crackly, thin and mono', { crackle: { on: true, amt: 0.7 }, radio: { on: true, amt: 0.35 }, lofi: { on: true, amt: 0.3 }, warble: { on: true, amt: 0.25 }, width: { on: true, w: 0 } }],
  ['Radio broadcast', 'A tinny, squashed radio', { radio: { on: true, amt: 0.75 }, comp: { on: true, amt: 0.6 }, width: { on: true, w: 0 } }],
  ['Distant memory', 'Soft, washed out and wavering', { reverb: { on: true, mix: 0.55, size: 0.8, damp: 0.6 }, muffle: { on: true, amt: 0.35 }, warble: { on: true, amt: 0.3 }, eq: { bass: 0, treble: -4 } }],
  ['Cave', 'Echoing stone', { space: { on: true, ir: 'cave', mix: 0.6 }, echo: { on: true, time: 0.45, fb: 0.4, mix: 0.25 }, eq: { bass: 2, treble: 0 } }],
  ['Cathedral', 'A huge stone hall', { space: { on: true, ir: 'cathedral', mix: 0.65 } }],
  ['Dream', 'Swirling and wide', { chorus: { on: true, mix: 0.6, depth: 0.7 }, reverb: { on: true, mix: 0.5, size: 0.9, damp: 0.3 }, autopan: { on: true, speed: 0.2, depth: 0.5 } }],
  ['Haunted', 'Sweeping, shivering and hollow', { flanger: { on: true, speed: 0.15, fb: 0.6, mix: 0.5 }, trem: { on: true, rate: 2.5, depth: 0.35 }, reverb: { on: true, mix: 0.45, size: 0.7, damp: 0.4 } }],
  ['Boss fight', 'Punchy, wide and driven', { drive: { on: true, amt: 0.35 }, comp: { on: true, amt: 0.6 }, eq: { bass: 4, treble: 1 }, width: { on: true, w: 1.4 } }],
  ['Even and quiet', 'Background music that never jumps out', { comp: { on: true, amt: 0.8 }, eq: { bass: 0, treble: -2 } }]
];
function presetFx(p) { const d = mfxDefaults(); for (const [k, v] of Object.entries(p)) d[k] = { ...d[k], ...v }; return mfxClean(d); }
