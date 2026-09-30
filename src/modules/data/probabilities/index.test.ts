import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Probabilities', () => {
  it('0 e 1 sono certi', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'p', module: 'probabilities', config: { probs: [1, 0, 1, 0] } }],
      [{ from: 'tr.bar', to: 'p.phase' }],
      ['p.trig'],
    );
    sim.runTo(2);
    expect(sim.events('p.trig').map((e) => e.t)).toEqual([0, 1, 2, 3]);
  });

  it('a 0.5 ne passa circa metà, sempre gli stessi con lo stesso seed', () => {
    const run = () => {
      const sim = simulate([TRANSPORT, { id: 'p', module: 'probabilities', config: { probs: [0.5] } }, { id: 'c', module: 'clock', params: { division: 16 } }], [
        { from: 'tr.bar', to: 'p.phase' },
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.trig', to: 'p.in' },
      ], ['p.trig']);
      sim.runTo(16);
      return sim.events('p.trig').map((e) => e.t);
    };
    const a = run();
    expect(a.length).toBeGreaterThan(100);
    expect(a.length).toBeLessThan(156);
    expect(run()).toEqual(a);
  });

  it('come filtro usa la probabilità dello step in cui cade l evento; bias −1 blocca tutto', () => {
    const run = (bias: number) => {
      const sim = simulate([TRANSPORT, { id: 'p', module: 'probabilities', params: { bias }, config: { probs: [1, 0] } }, { id: 'c', module: 'clock', params: { division: 8 } }], [
        { from: 'tr.bar', to: 'p.phase' },
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.trig', to: 'p.in' },
      ], ['p.trig']);
      sim.runTo(1);
      return sim.events('p.trig').map((e) => e.t);
    };
    expect(run(0)).toEqual([0, 0.25, 0.5, 0.75].map((x) => expect.closeTo(x, 9)));
    expect(run(-1)).toEqual([]);
  });
});
