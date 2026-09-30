import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';

describe('Gate Repeat', () => {
  it('ripete a sedicesimi finché il gate è alto', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'c', module: 'clock', params: { division: 2, gate: 0.25 } },
        { id: 'r', module: 'gateRepeat', params: { rate: 0.0625 } },
      ],
      [
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.gate', to: 'r.gate' },
        { from: 'tr.bar', to: 'r.phase' },
      ],
      ['r.trig'],
    );
    sim.runTo(1);
    // gate alto per un ottavo (2 sedicesimi) a 0 e a 8
    expect(sim.events('r.trig').map((e) => +stepOf(e.t).toFixed(3))).toEqual([0, 1, 8, 9]);
  });
});
