import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Blend', () => {
  it('mix 0.25 tra A e B', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'a', module: 'steps', config: { values: [0] } },
        { id: 'b', module: 'steps', config: { values: [1] } },
        { id: 'bl', module: 'blend', params: { mix: 0.25 } },
      ],
      [
        { from: 'tr.bar', to: 'a.phase' },
        { from: 'tr.bar', to: 'b.phase' },
        { from: 'a.value', to: 'bl.a' },
        { from: 'b.value', to: 'bl.b' },
      ],
      ['bl.out'],
    );
    sim.runTo(0.1);
    expect(sim.values('bl.out').at(-1)![0]).toBeCloseTo(0.25, 6);
  });
});
