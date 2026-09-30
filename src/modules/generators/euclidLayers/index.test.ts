import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate, stepOf } from '../../../../tests/helpers/sim';
import { layerAt } from './index';

describe('layerAt', () => {
  it('accenti tra i colpi, ghost nei buchi, fill solo nel ciclo di fill', () => {
    const row = (fill: boolean) => Array.from({ length: 8 }, (_, i) => layerAt(i, 8, 3, 1, 2, fill, 8));
    // E(3,8) = x..x..x. ; accenti E(1,3) sul primo colpo; ghost E(2,5) = x.x.. sui buchi (1° e 3° buco: step 1 e 4)
    expect(row(false)).toEqual(['accent', 'ghost', null, 'normal', 'ghost', null, 'normal', null]);
    expect(row(true)).toEqual(['accent', 'ghost', 'fill', 'normal', 'ghost', 'fill', 'normal', 'fill']);
  });
});

describe('Euclideo multistrato', () => {
  it('velocity per strato e uscite separate', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'e', module: 'euclidLayers', params: { steps: 8, pulses: 3, accents: 1, ghosts: 2, fillEvery: 0 } }],
      [{ from: 'tr.bar', to: 'e.phase' }],
      ['e.trig', 'e.accent', 'e.ghost'],
    );
    sim.runTo(1);
    expect(sim.events('e.trig').map((e) => [stepOf(e.t, 8), +(e as { vel: number }).vel.toFixed(2)])).toEqual([
      [0, 1],
      [1, 0.3],
      [3, 0.7],
      [4, 0.3],
      [6, 0.7],
    ]);
    expect(sim.events('e.accent').map((e) => stepOf(e.t, 8))).toEqual([0]);
    expect(sim.events('e.ghost').map((e) => stepOf(e.t, 8))).toEqual([1, 4]);
  });

  it('il fill arriva nell\'ultima battuta di ogni gruppo', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'e', module: 'euclidLayers', params: { steps: 8, pulses: 2, accents: 0, ghosts: 0, fillEvery: 2, fillPulses: 8 } }],
      [{ from: 'tr.bar', to: 'e.phase' }],
      ['e.trig'],
    );
    sim.runTo(4);
    const perBar = [0, 1, 2, 3].map((b) => sim.events('e.trig').filter((e) => Math.floor(e.t / 2) === b).length);
    expect(perBar).toEqual([2, 8, 2, 8]);
  });

  it('mutazione riproducibile a seed fisso', () => {
    const run = (seed: number) => {
      const sim = simulate([TRANSPORT, { id: 'e', module: 'euclidLayers', params: { mutation: 0.5 } }], [{ from: 'tr.bar', to: 'e.phase' }], ['e.trig'], seed);
      sim.runTo(4);
      return compact(sim.events('e.trig'));
    };
    expect(run(2)).toEqual(run(2));
    expect(run(2)).not.toEqual(run(3));
  });
});
