import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Offset per voce', () => {
  it('ogni corsia col suo offset, anche in anticipo', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4 } }, { id: 'o', module: 'voiceOffset', params: { off1: 20, off2: -15 } }],
      [
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.trig', to: 'o.in1' },
        { from: 'c.trig', to: 'o.in2' },
      ],
      ['o.out1', 'o.out2'],
    );
    sim.runTo(2);
    expect(sim.events('o.out1').map((e) => e.t).slice(0, 3)).toEqual([0.02, 0.52, 1.02].map((x) => expect.closeTo(x, 9)));
    // 15 ms prima (il primo cade a −15 ms, prima dell'avvio)
    expect(sim.events('o.out2').map((e) => e.t).slice(1, 3)).toEqual([0.485, 0.985].map((x) => expect.closeTo(x, 9)));
  });
});
