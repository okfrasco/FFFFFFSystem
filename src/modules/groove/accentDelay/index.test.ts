import { describe, expect, it } from 'vitest';
import { simulate } from '../../../../tests/helpers/sim';

describe('Accento → ritardo', () => {
  it('forti indietro, deboli avanti, attorno al centro', () => {
    const sim = simulate(
      [
        { id: 's', module: 'script', config: { events: [0.5, 1, 1.5].map((t, i) => ({ kind: 'trig', t, voice: 0, vel: [1, 0.5, 0][i] })) } },
        { id: 'a', module: 'accentDelay', params: { amount: 40, pivot: 0.5 } },
      ],
      [{ from: 's.out', to: 'a.in' }],
      ['a.out'],
    );
    sim.runTo(1);
    expect(sim.events('a.out').map((e) => e.t)).toEqual([0.52, 1, 1.48].map((x) => expect.closeTo(x, 9)));
  });
});
