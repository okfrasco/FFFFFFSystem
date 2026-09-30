import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { readCurve } from './index';

describe('readCurve', () => {
  it('a gradini o lineare, e ciclica', () => {
    const p = [0, 1, 0.5, 0];
    expect(readCurve(p, 0.3, 0)).toBe(1);
    expect(readCurve(p, 0.375, 1)).toBeCloseTo(0.75, 9);
    expect(readCurve(p, 1.3, 0)).toBe(1);
    expect(readCurve(p, 0.875, 1)).toBeCloseTo(0, 9); // l'ultimo punto torna al primo
  });
});

describe('Curve', () => {
  it('letta dalla fase, tra lo e hi', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'curve', params: { smooth: 0, lo: 0.2, hi: 0.4 }, config: { points: [0, 1] } }],
      [{ from: 'tr.bar', to: 'c.phase' }],
      ['c.out'],
    );
    sim.runTo(1);
    expect(sim.values('c.out')[100]![0]).toBeCloseTo(0.2, 6);
    expect(sim.values('c.out')[300]![0]).toBeCloseTo(0.4, 6);
  });
});
