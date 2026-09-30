import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { gridShift } from './index';

describe('gridShift', () => {
  it('da sedicesimi a terzine: il quarto sedicesimo va al terzo ottavo di terzina', () => {
    expect(gridShift(3 / 16, 16, 24, 1)).toBeCloseTo(5 / 24 - 3 / 16, 12);
    expect(gridShift(3 / 16, 16, 24, 0.5)).toBeCloseTo((5 / 24 - 3 / 16) / 2, 12);
    expect(gridShift(0.25, 16, 24, 1)).toBe(0);
  });
});

describe('Grid Blend', () => {
  it('sedicesimi dritti portati sulla griglia da 12: ognuno al punto più vicino', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'clock', params: { division: 16 } }, { id: 'g', module: 'gridBlend', params: { a: 16, b: 12, blend: 1 } }],
      [
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.trig', to: 'g.in' },
        { from: 'tr.bar', to: 'g.phase' },
      ],
      ['g.out'],
    );
    sim.runTo(1);
    // 0, 1/16, 2/16, 3/16 → 0, 1/12, 2/12, 2/12 (3/16 · 12 = 2.25)
    const t = sim.events('g.out').map((e) => e.t / 2);
    expect(t).toHaveLength(16);
    [0, 1 / 12, 2 / 12, 2 / 12].forEach((x, i) => expect(t[i]).toBeCloseTo(x, 3));
  });
});
