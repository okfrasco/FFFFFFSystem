import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('N-Latch', () => {
  it('cicla tra gli stati; avanti e indietro rimbalza; i gate poly seguono lo stato', () => {
    const run = (mode: number) => {
      const sim = simulate(
        [TRANSPORT, { id: 'c', module: 'clock', params: { division: 8 } }, { id: 'n', module: 'nLatch', params: { states: 3, mode } }],
        [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.trig', to: 'n.trig' }],
        ['n.trig', 'n.gates'],
      );
      sim.runTo(1);
      return sim;
    };
    expect(run(0).events('n.trig').map((e) => (e as { value: number }).value)).toEqual([1, 2, 0, 1, 2, 0, 1, 2]);
    expect(run(2).events('n.trig').map((e) => (e as { value: number }).value)).toEqual([1, 2, 1, 0, 1, 2, 1, 0]);
    const last = run(0).values('n.gates').at(-1)!;
    expect(last).toEqual([0, 0, 1]);
  });
});
