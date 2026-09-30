import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { smoothNoise } from './index';

function run(params: Record<string, number>, seed = 1, voices = 1, bars = 8) {
  const nodes = [TRANSPORT, { id: 'd', module: 'phaseDrift', params }];
  const conns = [{ from: 'tr.bar', to: 'd.in' }];
  if (voices > 1) {
    nodes.push({ id: 'sp', module: 'phaseSplit', params: { count: voices, spread: 0 } } as never);
    conns[0] = { from: 'tr.bar', to: 'sp.in' };
    conns.push({ from: 'sp.out', to: 'd.in' });
  }
  const sim = simulate(nodes, conns, ['d.out', 'd.offset', 'tr.bar'], seed);
  sim.runTo(bars);
  return sim;
}

describe('smoothNoise', () => {
  it('è continuo, limitato e riproducibile', () => {
    let prev = smoothNoise(3, 0, 0);
    for (let i = 1; i < 2000; i++) {
      const y = smoothNoise(3, 0, i / 100);
      expect(Math.abs(y)).toBeLessThanOrEqual(1);
      expect(Math.abs(y - prev)).toBeLessThan(0.05);
      prev = y;
    }
    expect(smoothNoise(3, 0, 1.23)).toBe(smoothNoise(3, 0, 1.23));
    expect(smoothNoise(3, 0, 1.23)).not.toBe(smoothNoise(4, 0, 1.23));
  });
});

describe('Ø Drift', () => {
  it('lo scarto resta entro amount, la fase è continua e non torna mai indietro', () => {
    const sim = run({ amount: 0.05, rate: 1 });
    const out = sim.phases('d.out');
    const inp = sim.phases('tr.bar');
    let maxOff = 0;
    for (let i = 0; i < out.length; i++) {
      maxOff = Math.max(maxOff, Math.abs(out[i]!.end[0]! - inp[i]!.end[0]!));
      expect(out[i]!.end[0]!).toBeGreaterThanOrEqual(out[i]!.start[0]!);
      if (i > 0) expect(out[i]!.start[0]).toBe(out[i - 1]!.end[0]);
    }
    expect(maxOff).toBeLessThanOrEqual(0.05 + 1e-9);
    expect(maxOff).toBeGreaterThan(0.01); // deriva davvero
  });

  it('stesso seed stessa deriva, seed diverso deriva diversa', () => {
    const off = (seed: number) => run({ amount: 0.05, rate: 1 }, seed).values('d.offset').map((x) => x[0]);
    expect(off(5)).toEqual(off(5));
    expect(off(5)).not.toEqual(off(6));
  });

  it('correlazione 1: tutte le voci insieme; 0: ognuna per conto suo', () => {
    const last = (corr: number) => run({ amount: 0.05, rate: 1, correlation: corr }, 1, 3).values('d.offset').at(-1)!;
    const together = last(1);
    expect(together[1]).toBeCloseTo(together[0]!, 9);
    expect(together[2]).toBeCloseTo(together[0]!, 9);
    const apart = last(0);
    expect(Math.abs(apart[1]! - apart[0]!)).toBeGreaterThan(1e-4);
  });
});
