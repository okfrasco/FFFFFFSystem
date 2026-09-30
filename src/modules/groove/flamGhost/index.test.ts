import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, vel } from '../../../../tests/helpers/sim';

const run = (params: Record<string, number>) => {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4 } }, { id: 'f', module: 'flamGhost', params }],
    [
      { from: 'tr.bar', to: 'c.phase' },
      { from: 'c.trig', to: 'f.in' },
      { from: 'tr.bar', to: 'f.phase' },
    ],
    ['f.out'],
  );
  sim.runTo(1);
  return sim.events('f.out');
};

describe('Flam / Ghost', () => {
  it('flam sempre: un colpo di grazia 20 ms prima, più piano', () => {
    const ev = run({ flamProb: 1, flamTime: 0.02, flamVel: 0.5, ghostProb: 0 });
    expect(ev.map((e) => e.t).slice(0, 4)).toEqual([-0.02, 0, 0.48, 0.5].map((x) => expect.closeTo(x, 9)));
    expect(vel(ev[2]!)).toBeCloseTo(0.5, 9);
  });

  it('ghost sempre, un sedicesimo dopo', () => {
    const ev = run({ flamProb: 0, ghostProb: 1, ghostOffset: 0.0625, ghostSide: 0, ghostVel: 0.3 });
    expect(ev).toHaveLength(8);
    expect(ev.map((e) => e.t).slice(0, 4)).toEqual([0, 0.125, 0.5, 0.625].map((x) => expect.closeTo(x, 9)));
    expect(vel(ev[1]!)).toBeCloseTo(0.3, 9);
  });

  it('probabilità a metà: stesso seed, stessi colpi', () => {
    const a = run({ flamProb: 0.5, ghostProb: 0.5 }).map((e) => e.t);
    const b = run({ flamProb: 0.5, ghostProb: 0.5 }).map((e) => e.t);
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(4);
  });
});
