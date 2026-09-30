import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';

function run(params: Record<string, number>, withPhase: boolean, seed = 1) {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4 } }, { id: 'r', module: 'ratchet', params }],
    [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.trig', to: 'r.trig' }, ...(withPhase ? [{ from: 'tr.bar', to: 'r.phase' }] : [])],
    ['r.trig'],
    seed,
  );
  sim.runTo(2);
  return sim.events('r.trig').map((e) => +stepOf(e.t, 4).toFixed(4));
}

describe('Ratchet', () => {
  it('probabilità 1: ogni step diventa N colpi dentro lo step (con la fase)', () => {
    expect(run({ prob: 1, repeats: 2, steps: 4 }, true)).toEqual([0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5]);
  });

  it('senza fase misura lo step dall\'intervallo (dal secondo colpo)', () => {
    const got = run({ prob: 1, repeats: 3 }, false);
    expect(got.slice(0, 5)).toEqual([0, 1, 1.3333, 1.6667, 2]);
  });

  it('probabilità 0: passa tutto invariato; 0.5: riproducibile', () => {
    expect(run({ prob: 0 }, true)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    expect(run({ prob: 0.5 }, true, 4)).toEqual(run({ prob: 0.5 }, true, 4));
  });
});
