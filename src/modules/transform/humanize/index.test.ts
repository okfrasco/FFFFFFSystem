import { describe, expect, it } from 'vitest';
import { TRANSPORT, compact, simulate } from '../../../../tests/helpers/sim';

function run(params: Record<string, number>, seed = 1) {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 16 } }, { id: 'h', module: 'humanize', params }],
    [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.trig', to: 'h.in' }],
    ['c.trig', 'h.out'],
    seed,
  );
  sim.runTo(4);
  return sim;
}

describe('Humanize', () => {
  it('sposta solo in avanti, entro il tempo, senza perdere colpi', () => {
    const sim = run({ time: 0.02, velocity: 0.3 });
    const a = sim.events('c.trig');
    const b = sim.events('h.out');
    expect(b).toHaveLength(a.length);
    b.forEach((e, i) => {
      const d = e.t - a[i]!.t;
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(0.02 + 1e-9);
    });
    expect(new Set(b.map((e) => (e as { vel: number }).vel.toFixed(3))).size).toBeGreaterThan(10);
  });

  it('riproducibile a seed fisso', () => {
    expect(compact(run({}, 3).events('h.out'))).toEqual(compact(run({}, 3).events('h.out')));
    expect(compact(run({}, 3).events('h.out'))).not.toEqual(compact(run({}, 4).events('h.out')));
  });
});
