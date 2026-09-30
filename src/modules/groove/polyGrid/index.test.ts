import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Griglia polimetrica', () => {
  it('corsie 16/4, 5/4, 7/2: stessi sedicesimi, cicli diversi', () => {
    const sim = simulate([TRANSPORT, { id: 'g', module: 'polyGrid' }], [{ from: 'tr.beat', to: 'g.phase' }], ['g.step', 'g.phase']);
    sim.runTo(1);
    const lane = (v: number) => sim.events('g.step').filter((e) => e.voice === v);
    expect(lane(0)).toHaveLength(16);
    expect(lane(1)).toHaveLength(16);
    expect(lane(2)).toHaveLength(8);
    expect(lane(1).map((e) => (e.kind === 'trig' ? e.value : -1)).slice(0, 7)).toEqual([0, 1, 2, 3, 4, 0, 1]);
    // la corsia da 7 ottavi ricomincia dopo 3.5 beat
    const last = sim.phases('g.phase').at(-1)!;
    expect(last.end[2]).toBeCloseTo(4 / 3.5, 3);
  });
});
