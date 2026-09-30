import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Shift Register', () => {
  it('i valori scorrono di cella in cella a ogni colpo', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 's', module: 'steps', config: { values: [1, 2, 3, 4] } },
        { id: 'r', module: 'shiftRegister', params: { length: 3 } },
      ],
      [
        { from: 'tr.bar', to: 's.phase' },
        { from: 's.trig', to: 'r.clock' },
      ],
      ['r.out', 'r.trig'],
    );
    sim.runTo(1);
    expect(Array.from(sim.values('r.out').at(-1)!)).toEqual([4, 3, 2]);
    const lastStep = sim.events('r.trig').filter((e) => Math.abs(e.t - 1.5) < 1e-9);
    expect(lastStep.map((e) => [e.voice, (e as { value: number }).value])).toEqual([
      [0, 4],
      [1, 3],
      [2, 2],
    ]);
  });
});
