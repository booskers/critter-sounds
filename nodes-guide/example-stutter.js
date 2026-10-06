// An example of your own node: "Stutter" repeats each trigger a few times, getting quieter and faster,
// like a ball bouncing to rest. It shows a trigger input, a trigger output, a control output and knobs.
// Wire Sometimes -> Stutter -> Sample for footsteps on creaky boards or dripping water.
CritterNode({
  type: 'stutter',
  name: 'Stutter',
  cat: 'custom',
  icon: 'sparkle',
  desc: 'Repeats each trigger a few times, faster and faster, like a bouncing ball. Its Level output falls with each bounce.',
  ins: [['in', 'trig', 'In']],
  outs: [['out', 'trig', 'Bounces'], ['level', 'ctl', 'Level']],
  params: [
    { id: 'n', label: 'Bounces', kind: 'num', min: 1, max: 12, def: 4, step: 1 },
    { id: 'gap', label: 'First gap', kind: 'num', min: 0.05, max: 2, def: 0.4, step: 0.01, unit: 's' },
    { id: 'shrink', label: 'Speeds up', kind: 'num', min: 0.3, max: 1, def: 0.7, step: 0.01, unit: '×' }
  ],
  build(x) {
    const out = { targets: [], fire(t) { for (const f of out.targets) f(t); } };
    const level = x.ctx.createConstantSource(); level.offset.value = 0; level.start();
    return {
      ins: {
        in: t => {
          let at = t, gap = x.p.gap;
          for (let i = 0; i < x.p.n; i++) {
            out.fire(at);
            level.offset.setValueAtTime(1 - i / x.p.n, at);   // 1, then less with each bounce
            at += gap; gap *= x.p.shrink;
          }
          level.offset.setValueAtTime(0, at);
        }
      },
      outs: { out, level },
      stop(t) { try { level.stop(t); } catch {} }
    };
  }
});
