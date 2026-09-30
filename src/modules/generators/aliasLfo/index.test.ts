import { describe, expect, it } from 'vitest';
import { aliasedLfo } from './index';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('aliasedLfo', () => {
  it('rimbalza tra 0 e 1 come nel visualizzatore', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map((t) => aliasedLfo(t, 25))).toEqual([0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]);
    expect([0, 1, 2, 3, 4].map((t) => aliasedLfo(t, 50))).toEqual([0, 0.5, 1, 0.5, 0]);
    for (let t = 0; t < 100; t++) {
      const v = aliasedLfo(t, 37);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });
});

describe('LFO aliasato nel grafo', () => {
  const run = (params: Record<string, number>, bars = 1) => {
    const sim = simulate(
      [TRANSPORT, { id: 'l', module: 'aliasLfo', params }],
      [{ from: 'tr.bar', to: 'l.phase' }],
      ['l.out'],
    );
    sim.runTo(bars);
    // un valore per sedicesimo: 25 tick a 120 BPM
    return sim.values('l.out').filter((_, i) => i % 25 === 5).map((v) => +v[0]!.toFixed(4));
  };

  it('tiene il valore per tutto lo step', () => {
    expect(run({ pattern: 25 }).slice(0, 9)).toEqual([0, 0.25, 0.5, 0.75, 1, 0.75, 0.5, 0.25, 0]);
  });

  it('length fa ripartire t', () => {
    expect(run({ pattern: 30, length: 3 }).slice(0, 7)).toEqual([0, 0.3, 0.6, 0, 0.3, 0.6, 0]);
  });

  it('polarità bipolare', () => {
    expect(run({ pattern: 50, polarity: 1 }).slice(0, 3)).toEqual([-1, 0, 1]);
  });
});
