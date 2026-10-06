YOUR OWN SOUNDSCAPE NODES
=========================

Every .js file in this folder is read when Critter Sounds starts and whenever a soundscape editor opens.
Each file can add one or more node types. They appear under "Custom" in the editor's list.
A soundscape that uses a node type only works where that file is present, so share the file along with the soundscape.

These files run as code inside Critter Sounds, so only use files you wrote or trust.


THE SHAPE OF A NODE
-------------------

    CritterNode({
      type: 'my-node',          // a unique id: letters, digits, - and _
      name: 'My node',          // what the editor shows
      cat: 'custom',            // source, control, trigger, math, effect, output or custom (sets its colour and place in the list)
      icon: 'sparkle',          // wave, sliders, clock, sparkle, list, shuffle, edit, note, pads, headphones
      desc: 'What it does, in a sentence.',
      ins:  [['in', 'sig', 'In'], ['go', 'trig', 'Go'], ['amt', 'param', 'Amount']],
      outs: [['out', 'sig', 'Out'], ['done', 'trig', 'Done']],
      params: [ { id: 'amt', label: 'Amount', kind: 'num', min: 0, max: 1, def: 0.5, step: 0.01, mod: 1 } ],
      build(x) { ... return { ins, outs, set, start, tick, stop }; }
    });

Each port is [id, kind, label]. There are four kinds:

    sig     sound, or any signal (a Web Audio AudioNode)
    ctl     a control output: a slow signal, about -1..1 (also an AudioNode, usually a ConstantSourceNode)
    param   an input that moves a knob (an AudioParam). A control of ±1 swings it by the param's "mod" amount.
    trig    a trigger: "now!", at an exact time in seconds on the audio clock

A param can be one of these kinds:
    num   (min, max, def, step, unit, log: true for frequency-like ranges, mod: the swing of its dot)
    sel   (opts: [[value, label], ...])
    bool
    text
    sound
    code

Give a param `rebuild: true` when changing it means building the node again.


build(x)
--------

`x` holds what a node needs:

    x.ctx           the AudioContext: live, or an OfflineAudioContext when a loop is rendered
    x.p             the params' current values; it stays up to date as knobs move
    x.ramp(param, value, time?)   glide an AudioParam to a value (no clicks)
    x.buffer(sound) the decoded AudioBuffer of a sound param's value (or null)
    x.t0()          when the soundscape started (audio clock seconds)
    x.error(text)   show a problem (an empty text clears it)
    x.dest          only for an output: where its sound goes

Return an object with:

    ins    { portId: AudioNode | AudioParam | function(time) }
           A function is a trigger input; an AudioNode or AudioParam is a sig or param input.
    outs   { portId: AudioNode | emitter }
           For a trigger output, return an object { targets: [] , fire(t) { ... } }.
           The simplest way is this:

               const done = { targets: [], fire(t) { for (const f of done.targets) f(t); } };

    set(id, value)   a knob moved while it plays (optional)
    start(time)      the soundscape starts (optional)
    tick(time, dt)   called for every 50 ms of soundscape time, a little ahead of the clock. Schedule anything that
                     falls between time and time + dt at its exact moment. This runs ahead in real time, and all at
                     once when a loop is rendered, so never use Date.now() or setTimeout.
    stop(time)       stop sources here (optional)


TIPS
----

* For maths on signals, use Web Audio nodes (GainNode, WaveShaperNode, ConstantSourceNode and so on) rather than
  JavaScript. They are fast and sample-exact, and they work the same when a loop is rendered.
* Keep tick() light: it runs 20 times a second for every node.
* For a quick idea without a file, use the Script node in the editor.
* See example-stutter.js in this folder for a complete working node.


IDEAS FOR MORE MODULES
----------------------

These are common in soundscape and ambience tools, if you want to build them:

* Envelope (attack/decay on a trigger, as a control)
* Sample & Hold
* Slew limiter
* Euclidean rhythm (k hits spread over n steps)
* Granular cloud (tiny random slices of a sound, for textures)
* Binaural/stereo widener
* Doppler pass-by (a pitch and pan sweep for carts, arrows and dragons flying past)
* Distance (lowpass, quieter and more reverb as one control rises)
* Day/night or weather cycle (one slow master control that drives many others)
* Ducker (one sound pushes another down)
* Spatial scatter (each trigger gets a random pan and distance)
* Convolution with your own impulse response
* Pitch-shifted drone layers
* Markov chain or weighted Pick one (a more likely and less likely sound)
