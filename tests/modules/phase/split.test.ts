import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../helpers/sim';

describe('Ø Split', () => {
  it('N voci in ritardo di i · spread / N cicli', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'sp', module: 'phaseSplit', params: { count: 4, spread: 0.5 } }],
      [{ from: 'tr.bar', to: 'sp.in' }],
      ['tr.bar', 'sp.out'],
    );
    sim.runTo(3);
    const inp = sim.phases('tr.bar').at(-1)!.end[0]!;
    const out = sim.phases('sp.out').at(-1)!.end;
    expect(out).toHaveLength(4);
    out.forEach((x, i) => expect(x).toBeCloseTo(inp - (i * 0.5) / 4, 9));
  });

  it('il numero di voci segue il parametro', () => {
    const sim = simulate([TRANSPORT, { id: 'sp', module: 'phaseSplit', params: { count: 7 } }], [{ from: 'tr.bar', to: 'sp.in' }], ['sp.out']);
    sim.runTo(0.1);
    expect(sim.phases('sp.out').at(-1)!.end).toHaveLength(7);
  });
});
