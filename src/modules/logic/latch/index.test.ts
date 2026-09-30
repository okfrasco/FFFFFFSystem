import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate, stepOf } from '../../../../tests/helpers/sim';

describe('Latch', () => {
  it('alterna a ogni trigger; in modo fissa, il reset spegne', () => {
    const run = (mode: number, withReset: boolean) => {
      const sim = simulate(
        [
          TRANSPORT,
          { id: 'c', module: 'clock', params: { division: 4 } },
          { id: 'r', module: 'clock', params: { division: 2, offset: 0.5 } },
          { id: 'l', module: 'latch', params: { mode } },
        ],
        [
          { from: 'tr.bar', to: 'c.phase' },
          { from: 'tr.bar', to: 'r.phase' },
          { from: 'c.trig', to: 'l.trig' },
          ...(withReset ? [{ from: 'r.trig', to: 'l.reset' }] : []),
        ],
        ['l.gate'],
      );
      sim.runTo(1);
      return sim.events('l.gate').map((e) => [+stepOf(e.t, 4).toFixed(3), (e as { on: boolean }).on]);
    };
    expect(run(0, false)).toEqual([
      [0, true],
      [1, false],
      [2, true],
      [3, false],
    ]);
    // fissa: si accende al primo; ai quarti 1 e 3 trigger e reset coincidono e il reset, che viene dopo, spegne
    expect(run(1, true)).toEqual([
      [0, true],
      [1, false],
      [2, true],
      [3, false],
    ]);
  });
});
