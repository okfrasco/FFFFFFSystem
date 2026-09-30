import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Clock Quantize', () => {
  it('trattiene i colpi fino al clock, con il loro valore; più colpi ne danno uno', () => {
    const events = [0.1, 0.3, 0.35, 1.2].map((t, i) => ({ kind: 'trig' as const, t, voice: 0, vel: 1, value: i }));
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'src', module: 'script', config: { events } },
        { id: 'c', module: 'clock', params: { division: 4 } },
        { id: 'q', module: 'clockQuantize' },
      ],
      [
        { from: 'src.out', to: 'q.in' },
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'c.trig', to: 'q.clock' },
      ],
      ['q.trig'],
    );
    sim.runTo(1);
    const out = sim.events('q.trig') as { t: number; value: number }[];
    expect(out.map((e) => [+e.t.toFixed(6), e.value])).toEqual([
      [0.5, 2],
      [1.5, 3],
    ]);
  });
});
