import { describe, expect, it } from 'vitest';
import { SR, audioSim, rms } from '../../../../tests/helpers/audio';

const ramp = (t: number) => (t % 1) - 0.5;

const run = (params: Record<string, number>, seconds = 1) =>
  audioSim(
    [
      { id: 's', module: 'signal', config: { fn: ramp } },
      { id: 'b', module: 'buffer', params },
    ],
    [{ from: 's.out', to: 'b.in' }],
    ['b.out'],
  )
    .run(seconds)
    .get('b.out')![0]!;

describe('Buffer', () => {
  it('spento: passa il segnale com è', () => {
    const x = run({ active: 0 }, 0.1);
    for (const i of [10, 1000, 4000]) expect(x[i]).toBeCloseTo(ramp(i / SR), 5);
  });

  it('repeat: il segnale si ripete ogni length', () => {
    const x = run({ active: 1, mode: 0, length: 0.05 });
    const len = Math.round(0.05 * SR);
    for (let i = 20000; i < 21000; i += 97) {
      const k = i % len;
      if (k > 100 && k < len - 100) expect(x[i]).toBeCloseTo(x[i + len]!, 5);
    }
  });

  it('tape stop: il nastro si ferma e resta il silenzio', () => {
    const x = run({ active: 1, mode: 2, stopTime: 0.2 });
    expect(rms(x, 0.02 * SR, 0.05 * SR)).toBeGreaterThan(0.1);
    expect(rms(x, 0.5 * SR, 0.9 * SR)).toBeLessThan(0.02);
  });
});
