import { describe, expect, it } from 'vitest';
import { attractionId, cellId, markovParams } from '../../../src/modules/generators/markov';
import { TRANSPORT, compact, simulate, stepOf } from '../../helpers/sim';

const values = (ev: { kind: string; value?: number }[]) => ev.map((e) => e.value);

function run(params: Record<string, number> = {}, bars = 2, seed = 1, extraNodes = [] as never[], extraConn = [] as never[]) {
  const sim = simulate(
    [TRANSPORT, { id: 'mk', module: 'markov', params }, ...extraNodes],
    [{ from: 'tr.bar', to: 'mk.phase' }, ...extraConn],
    ['mk.trig', 'mk.value', 'mk.state'],
    seed,
  );
  sim.runTo(bars);
  return sim;
}

const cycle3 = markovParams(
  [
    [0, 1, 0],
    [0, 0, 1],
    [1, 0, 0],
  ],
  [1, 2, 3],
);

describe('Markov a matrice', () => {
  it('segue solo le celle con peso', () => {
    const ev = run({ ...cycle3, steps: 4 }).events('mk.trig');
    // parte dallo stato 0: 2, 3, 1, 2, ...
    expect(values(ev as never)).toEqual([2, 3, 1, 2, 3, 1, 2, 3]);
    expect(ev.map((e) => stepOf(e.t, 4))).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  it('ignora le celle oltre size', () => {
    // la riga 1 punta allo stato 5, che con size 3 non esiste: ricade sulla scelta uniforme tra 0..2
    const p = { ...cycle3, [cellId(1, 1)]: 0, [cellId(1, 2)]: 0, [cellId(1, 5)]: 1, steps: 16 };
    const ev = run(p, 8).events('mk.trig');
    expect(ev.every((e) => [1, 2, 3].includes((e as { value: number }).value))).toBe(true);
  });

  it('una cella modulata da un cavo cambia la catena', () => {
    // 0→1 e 0→2 entrambe a 0; un Constant su m0_2 apre la strada verso lo stato 2
    const p = { ...cycle3, [cellId(0, 1)]: 0, [cellId(1, 2)]: 0, [cellId(1, 0)]: 1, [cellId(2, 0)]: 1, steps: 4 };
    const sim = simulate(
      [TRANSPORT, { id: 'mk', module: 'markov', params: p }, { id: 'k', module: 'steps', config: { values: [1] } }],
      [
        { from: 'tr.bar', to: 'mk.phase' },
        { from: 'tr.bar', to: 'k.phase' },
        { from: 'k.value', to: `mk.param:${cellId(0, 2)}` },
      ],
      ['mk.trig'],
    );
    sim.runTo(1);
    // lo step 0 di Steps e di Markov cadono nello stesso tick: Steps gira prima, la cella è già aperta
    expect(values(sim.events('mk.trig') as never)).toEqual([3, 1, 3, 1]);
  });

  it('attrazione 0 vieta uno stato, attrazione alta lo rende dominante', () => {
    const uniform = markovParams(Array.from({ length: 4 }, () => [1, 1, 1, 1]), [0, 1, 2, 3]);
    const count = (ev: unknown[], x: number) => ev.filter((e) => (e as { value: number }).value === x).length;
    const banned = run({ ...uniform, [attractionId(2)]: 0, steps: 16 }, 20).events('mk.trig');
    expect(count(banned, 2)).toBe(0);
    const pulled = run({ ...uniform, [attractionId(3)]: 1, steps: 16 }, 20).events('mk.trig');
    // peso 4 contro 1+1+1: circa 4/7
    expect(count(pulled, 3) / pulled.length).toBeGreaterThan(0.5);
  });

  it('mutazione 1 sceglie in modo quasi uniforme', () => {
    const p = { ...markovParams([[0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1], [1, 0, 0, 0]], [0, 1, 2, 3]), steps: 16, mutation: 1 };
    const ev = run(p, 100).events('mk.trig');
    const counts = [0, 0, 0, 0];
    for (const e of ev) counts[(e as { value: number }).value]!++;
    for (const c of counts) expect(c / ev.length).toBeGreaterThan(0.2);
  });

  it('avanza sui trigger quando l\'ingresso trig è collegato', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'eu', module: 'euclid', params: { steps: 8, pulses: 3 } }, { id: 'mk', module: 'markov' }],
      [{ from: 'tr.bar', to: 'eu.phase' }, { from: 'eu.trig', to: 'mk.trig' }],
      ['mk.trig', 'eu.trig'],
    );
    sim.runTo(4);
    expect(sim.events('mk.trig').map((e) => e.t)).toEqual(sim.events('eu.trig').map((e) => e.t));
  });

  it('matrice di default: riproducibile a seed fisso', () => {
    const a = compact(run({ steps: 8 }, 8, 42).events('mk.trig'), 8);
    expect(a).toEqual(compact(run({ steps: 8 }, 8, 42).events('mk.trig'), 8));
    expect(a).not.toEqual(compact(run({ steps: 8 }, 8, 43).events('mk.trig'), 8));
    expect(a.slice(0, 32)).toMatchSnapshot();
  });
});
