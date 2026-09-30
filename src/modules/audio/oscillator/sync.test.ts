import { describe, expect, it } from 'vitest';
import { audioSim } from '../../../../tests/helpers/audio';

describe('Oscillatore: hard sync', () => {
  it('con il sync a 100 Hz il ciclo si ripete ogni 480 campioni, qualunque sia la nota', () => {
    const x = audioSim(
      [
        { id: 's', module: 'signal', config: { fn: (t: number) => (Math.floor(t * 200 + 1e-9) % 2 === 0 ? 1 : -1) } },
        { id: 'o', module: 'oscillator', params: { wave: 2, pitch: 63.3 } },
      ],
      [{ from: 's.out', to: 'o.sync' }],
      ['o.out'],
    )
      .run(0.1)
      .get('o.out')![0]!;
    for (let i = 1000; i < 2000; i += 37) expect(x[i]).toBeCloseTo(x[i + 480]!, 5);
  });
});
