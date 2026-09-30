import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../helpers/sim';

function run(coupling: number, tether: number, bars: number) {
  const sim = simulate(
    [
      TRANSPORT,
      { id: 'sp', module: 'phaseSplit', params: { count: 4, spread: 1 } },
      { id: 'cp', module: 'coupling', params: { coupling, tether } },
    ],
    [
      { from: 'tr.bar', to: 'sp.in' },
      { from: 'sp.out', to: 'cp.in' },
    ],
    ['sp.out', 'cp.out', 'cp.sync'],
  );
  sim.runTo(bars);
  return sim;
}

describe('Accoppiamento', () => {
  it('a coupling 0 ogni voce segue il proprio ingresso', () => {
    const sim = run(0, 0.1, 4);
    const inp = sim.phases('sp.out').at(-1)!.end;
    const out = sim.phases('cp.out').at(-1)!.end;
    out.forEach((x, i) => expect(Math.abs(x - inp[i]!)).toBeLessThan(0.001));
    expect(sim.values('cp.sync').at(-1)![0]).toBeLessThan(0.01); // 4 voci distribuite sul ciclo
  });

  it('a coupling alto le fasi si fondono', () => {
    const sim = run(1, 0, 16);
    expect(sim.values('cp.sync').at(-1)![0]).toBeGreaterThan(0.99);
  });

  it('il richiamo trattiene: sincronia parziale', () => {
    const r = run(0.5, 0.5, 16).values('cp.sync').at(-1)![0]!;
    expect(r).toBeGreaterThan(0.05);
    expect(r).toBeLessThan(0.99);
  });

  it('l\'uscita è continua tick per tick', () => {
    const out = run(0.7, 0.1, 4).phases('cp.out');
    for (let i = 1; i < out.length; i++) out[i]!.start.forEach((x, v) => expect(x).toBe(out[i - 1]!.end[v]));
  });

  it('riproducibile a seed fisso', () => {
    const a = run(0.4, 0.1, 8).phases('cp.out').at(-1)!.end;
    const b = run(0.4, 0.1, 8).phases('cp.out').at(-1)!.end;
    expect(a).toEqual(b);
  });
});
