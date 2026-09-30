import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';
import { realign } from './index';

describe('Cicli', () => {
  it('ogni corsia colpisce ogni L step; align quando si riallineano tutte', () => {
    expect(realign([3, 5, 7])).toBe(105);
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'cycles', params: { lanes: 2, division: 4, len1: 3, len2: 4 } }],
      [{ from: 'tr.bar', to: 'c.phase' }],
      ['c.trig', 'c.align'],
    );
    sim.runTo(6); // 24 quarti
    const lane = (i: number) => sim.events('c.trig').filter((e) => e.voice === i).map((e) => Math.round(e.t / 0.5));
    expect(lane(0)).toEqual([0, 3, 6, 9, 12, 15, 18, 21]);
    expect(lane(1)).toEqual([0, 4, 8, 12, 16, 20]);
    expect(sim.events('c.align').map((e) => Math.round(e.t / 0.5))).toEqual([0, 12]);
  });
});
