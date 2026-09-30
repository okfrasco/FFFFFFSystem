import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate, stepOf, vel } from '../../helpers/sim';

const run = (gates: number[], params: Record<string, number> = {}, bars = 1, seed = 1) => {
  const sim = simulate(
    [TRANSPORT, { id: 'g', module: 'gates', params, config: { gates } }],
    [{ from: 'tr.bar', to: 'g.phase' }],
    ['g.trig'],
    seed,
  );
  sim.runTo(bars);
  return sim.events('g.trig');
};

describe('Gates', () => {
  it('la tabella copre un ciclo, i valori sono velocity', () => {
    const ev = run([1, 0, 0.5, 0]);
    expect(ev.map((e) => [stepOf(e.t, 4), vel(e)])).toEqual([[0, 1], [2, 0.5]]);
  });

  it('5 step su una battuta sono quintine', () => {
    const ev = run([1, 1, 1, 1, 1]);
    expect(ev.map((e) => e.t)).toEqual([0, 0.4, 0.8, 1.2, 1.6].map((t) => expect.closeTo(t, 9)));
  });

  it('rotazione', () => {
    expect(run([1, 0, 0, 0], { rotate: 1 }).map((e) => stepOf(e.t, 4))).toEqual([1]);
  });

  it('mutazione deterministica a seed fisso', () => {
    const table = [1, 0, 1, 0, 0, 1, 0, 0];
    const a = compact(run(table, { mutation: 0.5 }, 8, 3), 8);
    expect(a).toEqual(compact(run(table, { mutation: 0.5 }, 8, 3), 8));
    expect(a).toMatchSnapshot();
  });
});
