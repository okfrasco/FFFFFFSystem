import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';
import { bendCurve } from './index';

function clockAfterBend(params: Record<string, number>, bars = 1, onTick?: (sim: ReturnType<typeof simulate>, t0: number) => void) {
  const sim = simulate(
    [TRANSPORT, { id: 'b', module: 'phaseBend', params }, { id: 'c', module: 'clock', params: { division: 4 } }],
    [
      { from: 'tr.bar', to: 'b.in' },
      { from: 'b.out', to: 'c.phase' },
    ],
    ['c.trig', 'b.out'],
  );
  sim.runTo(bars, onTick ? (t0) => onTick(sim, t0) : undefined);
  return sim;
}

describe('bendCurve', () => {
  it('passa per 0 e 1 e cresce sempre, in entrambi i modi', () => {
    for (const mode of [0, 1]) {
      for (const amount of [-1, -0.5, 0, 0.5, 1]) {
        expect(bendCurve(0, amount, mode)).toBeCloseTo(0, 12);
        expect(bendCurve(1, amount, mode)).toBeCloseTo(1, 12);
        let prev = -1;
        for (let i = 0; i <= 100; i++) {
          const y = bendCurve(i / 100, amount, mode);
          expect(y).toBeGreaterThanOrEqual(prev);
          prev = y;
        }
      }
    }
    expect(bendCurve(0.3, 0, 0)).toBeCloseTo(0.3, 12);
    expect(bendCurve(0.3, 0, 1)).toBeCloseTo(0.3, 12);
  });
});

describe('Ø Bend', () => {
  it('a quantità 0 non cambia niente', () => {
    expect(clockAfterBend({ amount: 0 }).events('c.trig').map((e) => stepOf(e.t, 4))).toEqual([0, 1, 2, 3]);
  });

  it('bend 0.5: gli step arrivano dove la curva vale k/4 (lento all\'inizio, poi accelera)', () => {
    const p = Math.pow(4, 0.5);
    const got = clockAfterBend({ amount: 0.5 }).events('c.trig').map((e) => stepOf(e.t, 4));
    const expected = [0, 1, 2, 3].map((k) => +(Math.pow(k / 4, 1 / p) * 4).toFixed(6));
    got.forEach((x, i) => expect(x).toBeCloseTo(expected[i]!, 4));
    // stessi quattro colpi per battuta: la piegatura sposta, non toglie
    expect(clockAfterBend({ amount: 0.5 }, 4).events('c.trig')).toHaveLength(16);
  });

  it('la quantità cambiata a metà ciclo vale dal ciclo successivo', () => {
    const sim = clockAfterBend({ amount: 0 }, 2, (s, t0) => {
      if (Math.abs(t0 - 1) < 1e-9) s.graph.setParam('b', 'amount', 0.8);
    });
    const steps = sim.events('c.trig').map((e) => stepOf(e.t, 4));
    expect(steps.slice(0, 4)).toEqual([0, 1, 2, 3]);
    expect(steps[5]).toBeGreaterThan(5); // la seconda battuta è piegata
    expect(steps).toHaveLength(8);
  });

  it('i confini di battuta non si muovono', () => {
    const sim = clockAfterBend({ amount: 0.9, mode: 1 }, 3);
    const downbeats = sim.events('c.trig').filter((e) => (e as { value: number }).value === 0).map((e) => stepOf(e.t, 4));
    expect(downbeats).toEqual([0, 4, 8]);
  });
});
