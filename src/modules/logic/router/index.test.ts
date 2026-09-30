import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';

describe('Router', () => {
  it('a turno sulle uscite; con advance cambia solo ai suoi colpi', () => {
    const run = (withAdvance: boolean) => {
      const sim = simulate(
        [
          TRANSPORT,
          { id: 'c', module: 'clock', params: { division: 8 } },
          { id: 'a', module: 'clock', params: { division: 2 } },
          { id: 'r', module: 'router', params: { count: 3 } },
        ],
        [
          { from: 'tr.bar', to: 'c.phase' },
          { from: 'tr.bar', to: 'a.phase' },
          { from: 'c.trig', to: 'r.in' },
          ...(withAdvance ? [{ from: 'a.trig', to: 'r.advance' }] : []),
        ],
        ['r.out1', 'r.out2', 'r.out3'],
      );
      sim.runTo(1);
      return [1, 2, 3].map((k) => sim.events(`r.out${k}`).map((e) => stepOf(e.t, 8)));
    };
    expect(run(false)).toEqual([
      [0, 3, 6],
      [1, 4, 7],
      [2, 5],
    ]);
    // advance a 0 e a metà: i primi quattro vanno alla 2, gli altri alla 3
    expect(run(true)).toEqual([[], [0, 1, 2, 3], [4, 5, 6, 7]]);
  });

  it('la chiusura di un gate segue la sua apertura', () => {
    const sim = simulate(
      [TRANSPORT, { id: 'c', module: 'clock', params: { division: 4, gate: 0.5 } }, { id: 'r', module: 'router', params: { count: 2 } }],
      [{ from: 'tr.bar', to: 'c.phase' }, { from: 'c.gate', to: 'r.in' }],
      ['r.out1', 'r.out2'],
    );
    sim.runTo(1);
    for (const k of [1, 2]) {
      const ev = sim.events(`r.out${k}`) as { on: boolean }[];
      ev.forEach((e, i) => expect(e.on).toBe(i % 2 === 0));
    }
  });
});
