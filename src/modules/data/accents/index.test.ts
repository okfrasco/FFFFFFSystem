import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, vel } from '../../../../tests/helpers/sim';

describe('Accents', () => {
  it('pausa, normale e accento, con le velocity dei parametri', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'a', module: 'accents', params: { normal: 0.5, strong: 1 }, config: { cells: [2, 0, 1, 1] } }],
      [{ from: 'tr.bar', to: 'a.phase' }],
      ['a.trig', 'a.accent'],
    );
    sim.runTo(2);
    const trig = sim.events('a.trig');
    expect(trig.map((e) => e.t)).toEqual([0, 1, 1.5, 2, 3, 3.5]);
    expect(trig.map(vel)).toEqual([1, 0.5, 0.5, 1, 0.5, 0.5]);
    expect(trig.map((e) => (e.kind === 'trig' ? e.value : 0))).toEqual([2, 1, 1, 2, 1, 1]);
    expect(sim.events('a.accent').map((e) => e.t)).toEqual([0, 2]);
  });
});
