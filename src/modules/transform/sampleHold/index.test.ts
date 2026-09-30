import { describe, expect, it } from 'vitest';
import { TRANSPORT, simulate } from '../../../../tests/helpers/sim';

describe('Sample & Hold', () => {
  it('campiona una rampa a ogni quarto e tiene il valore', () => {
    const sim = simulate(
      [
        TRANSPORT,
        { id: 'l', module: 'lfo', params: { shape: 2 } },
        { id: 'c', module: 'clock', params: { division: 4 } },
        { id: 'sh', module: 'sampleHold' },
      ],
      [
        { from: 'tr.bar', to: 'l.phase' },
        { from: 'tr.bar', to: 'c.phase' },
        { from: 'l.out', to: 'sh.in' },
        { from: 'c.trig', to: 'sh.trig' },
      ],
      ['sh.trig', 'sh.out'],
    );
    sim.runTo(1);
    const vals = sim.events('sh.trig').map((e) => +(e as { value: number }).value.toFixed(4));
    // il valore della rampa alla fine del tick del trigger (tick da 5 ms = 0.0025 di battuta)
    expect(vals).toEqual([0.0025, 0.2525, 0.5025, 0.7525]);
    expect(sim.values('sh.out')[150]![0]).toBeCloseTo(0.2525, 4);
  });
});
