import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

const run = (params: Record<string, number>) => {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 16 } }, { id: 'd', module: 'correlatedDrift', params }],
    [
      { from: 'tr.bar', to: 'c.phase' },
      { from: 'c.trig', to: 'd.in' },
    ],
    ['d.out'],
    7,
  );
  sim.runTo(8);
  return sim.events('d.out').map((e, i) => e.t - i * 0.125);
};

describe('Drift correlato', () => {
  it('scarti entro ±amount, in entrambe le direzioni, e colpi vicini simili', () => {
    const d = run({ amount: 20, rate: 0.3, correlation: 1 });
    expect(d).toHaveLength(128);
    const rest = d;
    expect(Math.max(...rest.map(Math.abs))).toBeLessThanOrEqual(0.02 + 1e-9);
    expect(Math.min(...rest)).toBeLessThan(-0.002);
    expect(Math.max(...rest)).toBeGreaterThan(0.002);
    for (let i = 2; i < d.length; i++) expect(Math.abs(d[i]! - d[i - 1]!)).toBeLessThan(0.004);
  });

  it('amount 0 non sposta niente', () => {
    expect(run({ amount: 0 }).every((x) => Math.abs(x) < 1e-9)).toBe(true);
  });
});
