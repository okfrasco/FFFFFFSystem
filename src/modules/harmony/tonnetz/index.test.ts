import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { pc } from '../theory';

describe('Tonnetz', () => {
  it('sequenza PLR da Do maggiore: Do minore, La♭ maggiore, Fa minore', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'clock', params: { division: 1 } }, { id: 't', module: 'tonnetz', params: { mode: 1 }, config: { sequence: 'PLR' } }],
      [
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.trig', to: 't.trig' },
      ],
      ['t.chord', 't.change'],
    );
    sim.runTo(2.5);
    expect(sim.events('t.change').map((e) => (e.kind === 'trig' ? e.value : 9))).toEqual([-1, 0, 1, 2]);
    expect([...new Set(sim.values('t.chord').at(-1)!.map(pc))].sort((a, b) => a - b)).toEqual([0, 5, 8]);
  });
});
