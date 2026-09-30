import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, vel } from '../../../../tests/helpers/sim';

const run = (params: Record<string, number>, config: Record<string, unknown>) => {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4 } }, { id: 'g', module: 'grooveTemplate', params, config }],
    [
      { from: 'tr.bar', to: 'c.phase' },
      { from: 'c.trig', to: 'g.in' },
      { from: 'tr.bar', to: 'g.phase' },
    ],
    ['g.out'],
  );
  sim.runTo(1);
  return sim.events('g.out');
};

describe('Groove template', () => {
  it('offset e velocity per step (4 step: uno step = 0.5 s)', () => {
    const ev = run({ division: 4, amount: 1 }, { offsets: [0, 0.1, 0, -0.05], velocity: [1, 0.5, 1, 0.8] });
    expect(ev.map((e) => e.t)).toEqual([0, 0.55, 1, 1.475].map((x) => expect.closeTo(x, 6)));
    expect(ev.map(vel)).toEqual([1, 0.5, 1, 0.8].map((x) => expect.closeTo(x, 6)));
  });

  it('amount 0 lascia tutto dritto', () => {
    const ev = run({ division: 4, amount: 0 }, { offsets: [0, 0.1, 0, -0.05], velocity: [1, 0.5, 1, 0.8] });
    expect(ev.map((e) => e.t)).toEqual([0, 0.5, 1, 1.5].map((x) => expect.closeTo(x, 6)));
    expect(ev.map(vel)).toEqual([1, 1, 1, 1]);
  });
});
