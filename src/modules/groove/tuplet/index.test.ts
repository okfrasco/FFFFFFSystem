import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Tupla', () => {
  it('5 colpi in un quarto di battuta: quintine, con l indice come valore', () => {
    const sim = simulate([TRANSPORT, { id: 't', module: 'tuplet', params: { n: 5, span: 0.25 } }], [{ from: 'tr.bar', to: 't.phase' }], ['t.trig']);
    sim.runTo(1);
    const ev = sim.events('t.trig');
    expect(ev).toHaveLength(20);
    ev.forEach((e, i) => expect(e.t).toBeCloseTo(i * 0.1, 6));
    expect(ev.slice(0, 6).map((e) => (e.kind === 'trig' ? e.value : -1))).toEqual([0, 1, 2, 3, 4, 0]);
  });

  it('3 in mezza battuta: terzine di minima', () => {
    const sim = simulate([TRANSPORT, { id: 't', module: 'tuplet', params: { n: 3, span: 0.5 } }], [{ from: 'tr.bar', to: 't.phase' }], ['t.trig']);
    sim.runTo(1);
    expect(sim.events('t.trig').map((e) => Math.round(e.t * 3000) / 1000)).toEqual([0, 1, 2, 3, 4, 5]);
  });
});
