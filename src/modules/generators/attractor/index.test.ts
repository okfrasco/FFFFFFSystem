import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { deriv, normalizeAttractor, rk4 } from './index';

describe('sistemi', () => {
  it('Lorenz resta sull\'attrattore (limitato, senza fermarsi)', () => {
    let p: [number, number, number] = [1, 1, 1];
    let maxAbs = 0;
    for (let i = 0; i < 20000; i++) {
      p = rk4(0, p, 0.6, 0.005);
      maxAbs = Math.max(maxAbs, ...p.map(Math.abs));
    }
    expect(maxAbs).toBeLessThan(60);
    expect(Math.hypot(...deriv(0, p, 0.6))).toBeGreaterThan(1);
  });

  it('normalizzazione in 0–1', () => {
    for (const x of normalizeAttractor(0, [100, -100, 25])) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
    }
  });
});

describe('Attrattore', () => {
  it('avanza con la fase, tre uscite correlate e trigger sulla sezione', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'a', module: 'attractor', params: { speed: 4 } }],
      [{ from: 'tr.bar', to: 'a.phase' }],
      ['a.x', 'a.z', 'a.trig'],
    );
    sim.runTo(16);
    const xs = sim.values('a.x').map((v) => v[0]!);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(0.3);
    expect(sim.events('a.trig').length).toBeGreaterThan(2);
  });

  it('a musica ferma (fase ferma) il sistema non si muove', () => {
    const sim = simulate([{ id: 'tr', module: 'transport', params: { bpm: 20 } }, { id: 'a', module: 'attractor', params: { speed: 0.05 } }], [{ from: 'tr.bar', to: 'a.phase' }], ['a.x']);
    sim.runTo(0.05);
    const xs = sim.values('a.x').map((v) => v[0]!);
    expect(Math.max(...xs) - Math.min(...xs)).toBeLessThan(0.001);
  });
});
