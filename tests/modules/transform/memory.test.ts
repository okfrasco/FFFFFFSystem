import { describe, expect, it } from 'vitest';
import type { ControlEvent } from '../../../src/core/types';
import { BAR, TRANSPORT, compact, simulate, vel } from '../../helpers/sim';

/** Steps (8 valori per battuta, swing) → Memoria. */
function setup(memParams: Record<string, number>, seed = 1) {
  return simulate(
    [
      TRANSPORT,
      { id: 's', module: 'steps', params: { swing: 0.4 }, config: { values: [0, 1, 2, 3, 4, 5, 6, 7] } },
      { id: 'm', module: 'memory', params: { length: 1, ...memParams } },
    ],
    [
      { from: 'tr.bar', to: 's.phase' },
      { from: 'tr.bar', to: 'm.phase' },
      { from: 's.trig', to: 'm.in' },
    ],
    ['s.trig', 'm.out'],
    seed,
  );
}

const inBar = (ev: ControlEvent[], bar: number) => ev.filter((e) => e.t >= bar * BAR - 1e-9 && e.t < (bar + 1) * BAR - 1e-9);
/** Contenuto di una battuta relativo al suo inizio, per confrontare battute diverse. */
const shape = (ev: ControlEvent[], bar: number) =>
  inBar(ev, bar).map((e) => `${(e.t - bar * BAR).toFixed(6)}:${e.kind === 'trig' ? e.value : ''}:${vel(e).toFixed(3)}`);

describe('Memoria', () => {
  it('in ascolto lascia passare l\'ingresso invariato', () => {
    const sim = setup({ hold: 0 });
    sim.runTo(3);
    expect(sim.events('m.out')).toEqual(sim.events('s.trig'));
  });

  it('in ripeti senza mutazione rilegge l\'ultimo ciclo, microtiming compreso, e ignora l\'ingresso', () => {
    const sim = setup({ hold: 0, mutation: 0, anchor: 0 });
    sim.runTo(2);
    sim.graph.setParam('m', 'hold', 1);
    sim.graph.setParam('s', 'rotate', 3); // l'ingresso cambia: la memoria non deve accorgersene
    sim.runTo(6);
    const out = sim.events('m.out');
    const captured = shape(sim.events('s.trig'), 1);
    for (const bar of [2, 3, 4, 5]) expect(shape(out, bar)).toEqual(captured);
    // lo swing è conservato: il secondo evento non cade sulla griglia degli ottavi
    expect(captured[1]!.startsWith('0.300000')).toBe(true);
  });

  it('con mutazione le ripetizioni derivano e le mutazioni si accumulano', () => {
    const sim = setup({ hold: 0, mutation: 0.3, anchor: 0 });
    sim.runTo(2);
    sim.graph.setParam('m', 'hold', 1);
    sim.runTo(42);
    const out = sim.events('m.out');
    const original = shape(out, 2);
    const distance = (bar: number) => {
      const a = new Set(original);
      const b = shape(out, bar);
      return b.filter((x) => !a.has(x)).length + original.filter((x) => !new Set(b).has(x)).length;
    };
    expect(distance(3)).toBeGreaterThan(0);
    const early = [3, 4, 5, 6].map(distance).reduce((x, y) => x + y);
    const late = [38, 39, 40, 41].map(distance).reduce((x, y) => x + y);
    expect(late).toBeGreaterThan(early);
  });

  it('l\'ancora tiene le ripetizioni vicine all\'originale', () => {
    const drift = (anchor: number) => {
      const sim = setup({ hold: 0, mutation: 0.3, anchor }, 4);
      sim.runTo(2);
      sim.graph.setParam('m', 'hold', 1);
      sim.runTo(42);
      const out = sim.events('m.out');
      const original = new Set(shape(out, 2));
      let d = 0;
      for (let bar = 22; bar < 42; bar++) d += shape(out, bar).filter((x) => !original.has(x)).length;
      return d;
    };
    // con ancora 1 ogni giro riparte dall'originale e muta una volta sola; con 0 la deriva si accumula
    expect(drift(1)).toBeLessThan(drift(0) * 0.7);
  });

  it('riproducibile a seed fisso, e diverso con un altro seed', () => {
    const run = (seed: number) => {
      const sim = setup({ hold: 0, mutation: 0.4, anchor: 0.1 }, seed);
      sim.runTo(1);
      sim.graph.setParam('m', 'hold', 1);
      sim.runTo(12);
      return compact(sim.events('m.out'), 8);
    };
    expect(run(3)).toEqual(run(3));
    expect(run(3)).not.toEqual(run(4));
    expect(run(3).slice(8, 48)).toMatchSnapshot();
  });

  it('lo stato salvato riprende la stessa deriva', () => {
    const a = setup({ hold: 0, mutation: 0.4 }, 2);
    a.runTo(1);
    a.graph.setParam('m', 'hold', 1);
    a.runTo(5);
    const saved = JSON.parse(JSON.stringify({ m: a.graph.node('m').instance.getState(), tr: a.graph.node('tr').instance.getState() }));
    const rngState = a.graph.node('m').ctx.rng.getState();
    a.runTo(9);
    const b = setup({ hold: 1, mutation: 0.4 }, 2);
    b.graph.node('m').instance.setState(saved.m);
    b.graph.node('tr').instance.setState(saved.tr);
    b.graph.node('m').ctx.rng.setState(rngState);
    // b riparte dalla battuta 5 con tempi relativi: confronta la forma delle battute
    b.runTo(4);
    for (let i = 0; i < 4; i++) expect(shape(b.events('m.out'), i)).toEqual(shape(a.events('m.out'), 5 + i));
  });
});
