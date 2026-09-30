import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate } from '../../../../tests/helpers/sim';
import { walkStep } from './index';

function run(params: Record<string, number>, seed = 1, bars = 16) {
  const sim = simulate([TRANSPORT, { id: 'w', module: 'randomWalk', params }], [{ from: 'tr.bar', to: 'w.phase' }], ['w.trig', 'w.out'], seed);
  sim.runTo(bars);
  return sim;
}

describe('walkStep', () => {
  it('rimbalza sui limiti e si ferma se i limiti coincidono', () => {
    expect(walkStep(0.9, 1, 0.3, 0, 0.5, 0, 1)).toBeCloseTo(0.8, 9);
    expect(walkStep(0.1, -1, 0.3, 0, 0.5, 0, 1)).toBeCloseTo(0.2, 9);
    expect(walkStep(0.4, 1, 0.3, 0, 0.5, 0.6, 0.6)).toBe(0.6);
    expect(walkStep(0.2, 0, 0.1, 1, 0.5, 0, 1)).toBeCloseTo(0.5, 9); // attrazione piena: torna al centro
  });
});

describe('Random walk', () => {
  it('un passo per step, sempre dentro i limiti', () => {
    const ev = run({ steps: 8, size: 0.3, lo: 0.2, hi: 0.7 }).events('w.trig');
    expect(ev).toHaveLength(128);
    for (const e of ev) {
      const x = (e as { value: number }).value;
      expect(x).toBeGreaterThanOrEqual(0.2);
      expect(x).toBeLessThanOrEqual(0.7);
    }
  });

  it('l\'attrazione tiene il valore vicino al centro', () => {
    const spread = (attract: number) => {
      const xs = run({ steps: 16, size: 0.15, attract, center: 0.5 }, 3, 32).events('w.trig').map((e) => (e as { value: number }).value);
      return xs.reduce((s, x) => s + Math.abs(x - 0.5), 0) / xs.length;
    };
    expect(spread(0.5)).toBeLessThan(spread(0) / 1.5);
  });

  it('glide: l\'uscita scivola verso il passo', () => {
    const out = run({ steps: 1, size: 0.4, glide: 1 }, 2, 2).values('w.out').map((v) => v[0]!);
    const jumps = out.slice(1).map((x, i) => Math.abs(x - out[i]!));
    expect(Math.max(...jumps)).toBeLessThan(0.02);
  });

  it('riproducibile a seed fisso', () => {
    const a = compact(run({ steps: 8 }, 7).events('w.trig'), 8);
    expect(a).toEqual(compact(run({ steps: 8 }, 7).events('w.trig'), 8));
    expect(a).not.toEqual(compact(run({ steps: 8 }, 8).events('w.trig'), 8));
  });
});
