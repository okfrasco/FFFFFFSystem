import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { mathOp } from './index';

describe('Math', () => {
  it('le sei operazioni', () => {
    expect([0, 1, 2, 3, 4, 5].map((op) => mathOp(op, 0.6, 0.2))).toEqual([0.8, 0.39999999999999997, 0.12, 0.2, 0.6, 0.4]);
  });

  it('nel grafo: A da un LFO, B dal parametro quando non è collegato', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'l', module: 'lfo', params: { shape: 2 } }, { id: 'm', module: 'math', params: { op: 0, b: 0.25 } }],
      [{ from: 'tr.bar', to: 'l.phase' }, { from: 'l.out', to: 'm.a' }],
      ['m.out', 'l.out'],
    );
    sim.runTo(1);
    const i = 200;
    expect(sim.values('m.out')[i]![0]).toBeCloseTo(sim.values('l.out')[i]![0]! + 0.25, 6);
  });
});
