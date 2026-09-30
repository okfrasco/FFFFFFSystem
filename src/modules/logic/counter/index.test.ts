import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';

describe('Counter', () => {
  it('scatta ogni N colpi; in modo una volta, solo la prima', () => {
    const run = (mode: number) => {
      const sim = simulate(
        [TRANSPORT, { id: 'c', module: 'clock', params: { division: 8 } }, { id: 'n', module: 'counter', params: { threshold: 3, mode } }],
        [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.trig', to: 'n.trig' }],
        ['n.trig'],
      );
      sim.runTo(2);
      return sim.events('n.trig').map((e) => stepOf(e.t, 8));
    };
    expect(run(0)).toEqual([2, 5, 8, 11, 14]);
    expect(run(1)).toEqual([2]);
  });
});
