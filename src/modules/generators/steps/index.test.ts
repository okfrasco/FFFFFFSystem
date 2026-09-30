import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate, stepOf } from '../../../../tests/helpers/sim';

describe('Steps', () => {
  it('emette un trigger per step con il valore, e tiene il valore', () => {
    const sim = simulate(
      [TRANSPORT, { id: 's', module: 'steps', config: { values: [0, 2, 4, 7] } }],
      [{ from: 'tr.bar', to: 's.phase' }],
      ['s.trig', 's.value'],
    );
    sim.runTo(2);
    const ev = sim.events('s.trig');
    expect(ev.map((e) => (e.kind === 'trig' ? e.value : null))).toEqual([0, 2, 4, 7, 0, 2, 4, 7]);
    expect(ev.map((e) => stepOf(e.t, 4))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(sim.values('s.value')[150]![0]).toBe(2); // secondo quarto della prima battuta
  });

  it('mutazione pesca altri valori della tabella, in modo riproducibile', () => {
    const run = () => {
      const sim = simulate(
        [TRANSPORT, { id: 's', module: 'steps', params: { mutation: 0.3 }, config: { values: [0, 1, 2, 3] } }],
        [{ from: 'tr.bar', to: 's.phase' }],
        ['s.trig'],
        11,
      );
      sim.runTo(8);
      return sim.events('s.trig');
    };
    const ev = run();
    expect(compact(ev, 4)).toEqual(compact(run(), 4));
    const off = ev.filter((e, i) => e.kind === 'trig' && e.value !== i % 4).length;
    expect(off).toBeGreaterThan(0);
    expect(off).toBeLessThan(ev.length / 2);
    expect(compact(ev, 4)).toMatchSnapshot();
  });
});
