import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

function run(d: number) {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 16, accent: 0.7 } }, { id: 'd', module: 'density', params: { density: d } }],
    [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.trig', to: 'd.in' }],
    ['d.out'],
  );
  sim.runTo(4);
  return sim.events('d.out') as { vel: number }[];
}

describe('Densità', () => {
  it('0.5 lascia tutto, sotto tiene i più forti, sopra aggiunge ghost', () => {
    expect(run(0.5)).toHaveLength(64);
    const thin = run(0.2); // soglia 0.6: resta solo il primo di ogni battuta (vel 1, gli altri 0.3)
    expect(thin).toHaveLength(4);
    expect(thin.every((e) => e.vel === 1)).toBe(true);
    const dense = run(1);
    expect(dense.length).toBe(128);
  });
});
