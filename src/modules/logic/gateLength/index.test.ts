import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Gate Length', () => {
  it('ogni trigger diventa un gate lungo quanto la durata; con la fase, in cicli', () => {
    const run = (params: Record<string, number>, withPhase: boolean) => {
      const sim = simulate(
        [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4 } }, { id: 'g', module: 'gateLength', params }],
        [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.trig', to: 'g.trig' }, ...(withPhase ? [{ from: 'tr.bar', to: 'g.phase' }] : [])],
        ['g.gate'],
      );
      sim.runTo(1);
      const ev = sim.events('g.gate') as { t: number; on: boolean }[];
      return ev.filter((e) => !e.on).map((e, i) => +(e.t - ev.filter((x) => x.on)[i]!.t).toFixed(6));
    };
    expect(run({ length: 0.1 }, false)).toEqual([0.1, 0.1, 0.1, 0.1]);
    expect(run({ length: 0.125 }, true)).toEqual([0.25, 0.25, 0.25, 0.25]); // un ottavo di battuta = 0.25 s
  });

  it('un nuovo trigger con il gate aperto lo chiude e lo riapre', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4 } }, { id: 'g', module: 'gateLength', params: { length: 1 } }],
      [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.trig', to: 'g.trig' }],
      ['g.gate'],
    );
    sim.runTo(1);
    const at05 = (sim.events('g.gate') as { t: number; on: boolean }[]).filter((e) => Math.abs(e.t - 0.5) < 1e-9);
    expect(at05.map((e) => e.on)).toEqual([false, true]);
  });
});
