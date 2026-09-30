import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';

function run(params: Record<string, number>) {
  const sim = simulate(
    [TRANSPORT, { id: 'c', module: 'clock', params: { division: 8 } }, { id: 'd', module: 'clockDiv', params }],
    [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.trig', to: 'd.trig' }],
    ['d.trig'],
  );
  sim.runTo(1);
  return sim.events('d.trig').map((e) => +stepOf(e.t, 8).toFixed(4));
}

describe('Clock Divide / Multiply', () => {
  it('divide per 3, con offset', () => {
    expect(run({ divide: 3 })).toEqual([0, 3, 6]);
    expect(run({ divide: 3, offset: 1 })).toEqual([1, 4, 7]);
  });

  it('moltiplica per 2: un colpo in più a metà di ogni intervallo (dal secondo)', () => {
    expect(run({ divide: 1, multiply: 2 })).toEqual([0, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5]);
  });
});
