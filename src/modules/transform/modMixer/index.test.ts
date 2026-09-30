import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Mod Mixer', () => {
  it('somma pesata più offset, pesi negativi compresi', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'a', module: 'steps', config: { values: [0.5] } },
        { id: 'b', module: 'steps', config: { values: [0.2] } },
        { id: 'mm', module: 'modMixer', params: { amt1: 1, amt2: -0.5, offset: 0.1 } },
      ],
      [
        { from: 'tr.bar', to: 'a.phase' },
        { from: 'tr.bar', to: 'b.phase' },
        { from: 'a.value', to: 'mm.in1' },
        { from: 'b.value', to: 'mm.in2' },
      ],
      ['mm.out'],
    );
    sim.runTo(0.1);
    expect(sim.values('mm.out').at(-1)![0]).toBeCloseTo(0.5 - 0.1 + 0.1, 6);
  });
});
