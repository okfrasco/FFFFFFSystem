import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { conditionHolds } from './index';

function bars(params: Record<string, number>, seed = 1) {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 1 } }, { id: 'k', module: 'condition', params }],
    [
      { from: 'tr.bar', to: 'c.phase' },
      { from: 'c.trig', to: 'k.trig' },
      { from: 'tr.bar', to: 'k.phase' },
    ],
    ['k.trig'],
    seed,
  );
  sim.runTo(8);
  return sim.events('k.trig').map((e) => Math.round(e.t / 2));
}

describe('conditionHolds', () => {
  it('A:B sceglie il ciclo A di ogni B', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7].filter((c) => conditionHolds(0, c, 2, 3, false, false))).toEqual([1, 4, 7]);
  });
});

describe('Condizione (un colpo per battuta)', () => {
  it('1:2, 4:4, NOT 1:4', () => {
    expect(bars({ mode: 0, a: 1, b: 2 })).toEqual([0, 2, 4, 6]);
    expect(bars({ mode: 0, a: 4, b: 4 })).toEqual([3, 7]);
    expect(bars({ mode: 1, a: 1, b: 4 })).toEqual([1, 2, 3, 5, 6, 7]);
  });

  it('1ST e NOT 1ST', () => {
    expect(bars({ mode: 2 })).toEqual([0]);
    expect(bars({ mode: 3 })).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('probabilità: riproducibile a seed fisso', () => {
    const a = bars({ mode: 6, prob: 0.5 }, 3);
    expect(a).toEqual(bars({ mode: 6, prob: 0.5 }, 3));
    expect(a.length).toBeGreaterThan(0);
    expect(a.length).toBeLessThan(8);
  });
});
